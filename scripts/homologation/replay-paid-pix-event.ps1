param([Parameter(Mandatory = $true)][string]$EventFile, [switch]$LatePending)

# Replay a completed event, or queue the fixed synthetic late-pending fixture.
# No processing batch, provider mutation, scheduler or automatic retry.
$pixReplayPhase = 'event_validation'
$pixReplayAttempted = $false
$pixReplaySecrets = @()
$pixReplayHeaders = $null
$pixReplayWebhookHeaders = $null

function Get-PixReplayQueueSnapshot {
    param($Status, [switch]$AllowReady)
    if ($Status.schemaVersion -ne 1 -or $Status.accountScope -cne 'sandbox-hml') { throw 'INVALID_SCOPE' }
    foreach ($name in @('uncertain', 'overdue', 'abandonedLeases', 'untrackedLegacyOrders')) {
        if ($null -eq $Status.$name -or $Status.$name -ne 0) { throw 'UNRESOLVED_WORK' }
    }
    if (@($Status.operations).Count -gt 0 -or (-not $AllowReady -and $null -ne $Status.oldestUnresolvedInboxAt)) { throw 'UNRESOLVED_WORK' }
    $snapshot = [ordered]@{}
    foreach ($name in @('inbox', 'outbox')) {
        $rows = @($Status.$name)
        $completed = @($rows | Where-Object { $_.status -ceq 'COMPLETED' })
        $ready = @($rows | Where-Object { $_.status -ceq 'READY' })
        if ($completed.Count -ne 1 -or $completed[0]._count -lt 1) { throw 'UNRESOLVED_WORK' }
        if ($AllowReady -and $name -eq 'inbox') {
            if ($ready.Count -gt 1 -or ($ready.Count -eq 1 -and $ready[0]._count -ne 1) -or
                $rows.Count -ne ($completed.Count + $ready.Count)) { throw 'UNRESOLVED_WORK' }
        } elseif ($rows.Count -ne 1) { throw 'UNRESOLVED_WORK' }
        $snapshot[$name] = [ordered]@{ status = 'COMPLETED'; count = $completed[0]._count }
        if ($AllowReady -and $name -eq 'inbox') { $snapshot[$name]['readyCount'] = $(if ($ready.Count) { 1 } else { 0 }) }
    }
    return $snapshot
}

try {
    $pixReplayFile = Get-Item -LiteralPath $EventFile -ErrorAction Stop
    if ($pixReplayFile.PSIsContainer -or $pixReplayFile.Length -gt 16384) { throw 'INVALID_EVENT_FILE' }
    $pixReplayEvent = Get-Content -LiteralPath $EventFile -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    foreach ($name in $pixReplayEvent.PSObject.Properties.Name) {
        if ($name -cnotin @('id', 'event', 'dateCreated', 'payment')) { throw 'UNEXPECTED_EVENT_FIELD' }
    }
    foreach ($name in $pixReplayEvent.payment.PSObject.Properties.Name) {
        if ($name -cnotin @('id', 'externalReference', 'billingType', 'value', 'status')) { throw 'UNEXPECTED_PAYMENT_FIELD' }
    }
    if ($pixReplayEvent.id -isnot [string] -or $pixReplayEvent.id -notmatch '^evt_\S{1,156}$' -or
        $pixReplayEvent.payment.id -isnot [string] -or $pixReplayEvent.payment.id -notmatch '^pay_\S{1,124}$' -or
        $pixReplayEvent.payment.billingType -cne 'PIX' -or
        $pixReplayEvent.payment.value -is [string] -or $pixReplayEvent.payment.value -ne 24.95) { throw 'INVALID_OR_UNRELATED_EVENT' }
    if ($LatePending) {
        # Synthetic identity/date: this is not an original event from Asaas.
        # Fixed ID prevents a second execution from creating another test event.
        if ($pixReplayEvent.id -cne 'evt_hml_test_order_1_late_pending_v1' -or
            $pixReplayEvent.event -cne 'PAYMENT_CREATED' -or $pixReplayEvent.dateCreated -cne '2026-10-08 13:30:00' -or
            $pixReplayEvent.payment.id -cne 'pay_r4gdsmosa0lh851z' -or
            $pixReplayEvent.payment.externalReference -cne '04e34a9a-70da-4816-b691-3e31c85935b9' -or
            $pixReplayEvent.payment.status -cne 'PENDING') { throw 'INVALID_LATE_EVENT_FIXTURE' }
    } elseif ($pixReplayEvent.event -cnotin @('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED') -or
              $pixReplayEvent.payment.status -cnotin @('RECEIVED', 'CONFIRMED')) { throw 'INVALID_OR_UNRELATED_EVENT' }
    if ($pixReplayEvent.PSObject.Properties.Name -ccontains 'dateCreated') {
        if ($pixReplayEvent.dateCreated -isnot [string] -or $pixReplayEvent.dateCreated.Length -gt 64) { throw 'INVALID_EVENT_DATE' }
    }
    if ($pixReplayEvent.payment.PSObject.Properties.Name -ccontains 'externalReference') {
        if ($pixReplayEvent.payment.externalReference -cne '04e34a9a-70da-4816-b691-3e31c85935b9') { throw 'WRONG_ORDER' }
    }
    $pixReplayBody = $pixReplayEvent | ConvertTo-Json -Depth 5 -Compress
    $pixReplayPhase = 'authentication'
    foreach ($prompt in @('Cole o CRON_SECRET da homologacao', 'Cole o segredo de bypass da Vercel',
                          'Cole o ASAAS_WEBHOOK_TOKEN da homologacao (nao a chave API Asaas)')) {
        $pixReplaySecrets += Read-Host $prompt -AsSecureString
    }
    $pixReplayValues = @($pixReplaySecrets | ForEach-Object { ([System.Net.NetworkCredential]::new('', $_)).Password })
    foreach ($value in $pixReplayValues) {
        if ([string]::IsNullOrWhiteSpace($value) -or $value -match '\s') { throw 'INVALID_SECRET_INPUT' }
    }
    $pixReplayBase = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app'
    $pixReplayHeaders = @{ Authorization = 'Bearer ' + $pixReplayValues[0]; 'x-vercel-protection-bypass' = $pixReplayValues[1] }
    $pixReplayWebhookHeaders = @{ 'asaas-access-token' = $pixReplayValues[2]; 'x-vercel-protection-bypass' = $pixReplayValues[1] }
    $pixReplayPhase = 'scope_check'
    $pixReplayBeforeStatus = Invoke-RestMethod -Uri "$pixReplayBase/api/cron/payments/status" -Method Get `
        -Headers $pixReplayHeaders -MaximumRedirection 0 -TimeoutSec 60 -ErrorAction Stop
    $pixReplayBefore = Get-PixReplayQueueSnapshot $pixReplayBeforeStatus
    $pixReplayPhase = 'webhook_replay'
    $pixReplayAttempted = $true
    $pixReplayResponse = Invoke-RestMethod -Uri "$pixReplayBase/api/webhooks/asaas" -Method Post `
        -Headers $pixReplayWebhookHeaders -Body $pixReplayBody -ContentType 'application/json; charset=utf-8' `
        -MaximumRedirection 0 -TimeoutSec 60 -ErrorAction Stop
    $pixReplayPhase = 'after_check'
    $pixReplayAfterStatus = Invoke-RestMethod -Uri "$pixReplayBase/api/cron/payments/status" -Method Get `
        -Headers $pixReplayHeaders -MaximumRedirection 0 -TimeoutSec 60 -ErrorAction Stop
    $pixReplayAfter = Get-PixReplayQueueSnapshot $pixReplayAfterStatus -AllowReady:$LatePending
    if ($LatePending) {
        $pixReplayOutboxUnchanged = $pixReplayBefore.outbox.count -eq $pixReplayAfter.outbox.count
        $pixReplayOneQueued = $pixReplayBefore.inbox.count -eq $pixReplayAfter.inbox.count -and
            $pixReplayAfter.inbox.readyCount -eq 1 -and $pixReplayOutboxUnchanged
        $pixReplayQueued = $pixReplayOneQueued -and $pixReplayResponse.received -eq $true -and
            $pixReplayResponse.eventId -ceq $pixReplayEvent.id -and $pixReplayResponse.status -ceq 'RECEIVED'
        @{ ok = $pixReplayQueued; phase = $pixReplayPhase;
            code = $(if ($pixReplayQueued) { 'LATE_EVENT_QUEUED' } else { 'REPLAY_REQUIRES_REVIEW' });
            syntheticEvent = $true; webhookStatus = $pixReplayResponse.status;
            oneNewInboxReady = $pixReplayOneQueued; outboxUnchanged = $pixReplayOutboxUnchanged;
            before = $pixReplayBefore; after = $pixReplayAfter;
            replayAttempted = $true; processingAttempted = $false } | ConvertTo-Json -Depth 6
        return
    }
    $pixReplayUnchanged = ($pixReplayBefore | ConvertTo-Json -Compress) -ceq ($pixReplayAfter | ConvertTo-Json -Compress)
    $pixReplayAccepted = $pixReplayResponse.received -eq $true -and
        $pixReplayResponse.eventId -ceq $pixReplayEvent.id -and $pixReplayResponse.status -ceq 'PROCESSED'
    @{ ok = ($pixReplayAccepted -and $pixReplayUnchanged); phase = $pixReplayPhase;
        code = $(if ($pixReplayAccepted -and $pixReplayUnchanged) { 'DUPLICATE_ACCEPTED' } else { 'REPLAY_REQUIRES_REVIEW' });
        webhookStatus = $pixReplayResponse.status; queuesUnchanged = $pixReplayUnchanged;
        before = $pixReplayBefore; after = $pixReplayAfter;
        replayAttempted = $true; processingAttempted = $false } | ConvertTo-Json -Depth 6
}
catch {
    $pixReplayHttpStatus = $null
    if ($_.Exception.Response) { $pixReplayHttpStatus = [int]$_.Exception.Response.StatusCode }
    $pixReplayCode = 'REQUEST_UNRESOLVED'
    if ($pixReplayPhase -eq 'event_validation') { $pixReplayCode = 'INVALID_EVENT_INPUT' }
    elseif ($pixReplayPhase -eq 'authentication') { $pixReplayCode = 'INVALID_SECRET_INPUT' }
    elseif ($_.Exception.Message -cin @('INVALID_SCOPE', 'UNRESOLVED_WORK')) { $pixReplayCode = 'STATE_REQUIRES_REVIEW' }
    elseif ($pixReplayHttpStatus -eq 409) { $pixReplayCode = 'EVENT_CONTENT_CONFLICT' }
    elseif (($_.FullyQualifiedErrorId -split ',')[0] -eq 'MaximumRedirectExceeded') { $pixReplayCode = 'REDIRECT_BLOCKED' }
    @{ ok = $false; phase = $pixReplayPhase; code = $pixReplayCode; httpStatus = $pixReplayHttpStatus;
        replayAttempted = $pixReplayAttempted; processingAttempted = $false;
        instruction = 'Parar e conferir o estado existente; nao repetir automaticamente nem enviar lote de processamento.' } | ConvertTo-Json
}
finally {
    foreach ($secret in $pixReplaySecrets) { if ($secret) { $secret.Dispose() } }
    Remove-Variable pixReplaySecrets, pixReplayValues, pixReplayHeaders, pixReplayWebhookHeaders, value, secret -ErrorAction SilentlyContinue
}
