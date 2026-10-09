# Controlled cmdlet doubles; no Vercel, Neon, Asaas or email requests.
$ErrorActionPreference = 'Stop'
$pixReplayTestTarget = Join-Path $PSScriptRoot '../../scripts/homologation/replay-paid-pix-event.ps1'
$pixReplayTestFile = Join-Path ([System.IO.Path]::GetTempPath()) ('pix-replay-test-' + [guid]::NewGuid() + '.json')

function Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    $global:pixReplayMockReads++
    $values = @('DO_NOT_LOG_CRON', 'DO_NOT_LOG_BYPASS', 'DO_NOT_LOG_WEBHOOK')
    $value = $values[$global:pixReplayMockReads - 1]
    if ($global:pixReplayMockMode -eq 'bad_secret') { $value += "`n" }
    return ConvertTo-SecureString $value -AsPlainText -Force
}
function Invoke-RestMethod {
    [CmdletBinding()]
    param([string]$Uri, [string]$Method, [hashtable]$Headers, [int]$MaximumRedirection,
          [int]$TimeoutSec, [string]$Body, [string]$ContentType)
    $global:pixReplayMockCalls.Add($Method)
    $base = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app'
    if ($MaximumRedirection -ne 0 -or $TimeoutSec -ne 60 -or
        $Headers['x-vercel-protection-bypass'] -cne 'DO_NOT_LOG_BYPASS') { throw 'Invalid request fixture' }
    if ($global:pixReplayMockMode -eq 'redirect') {
        $PSCmdlet.ThrowTerminatingError([System.Management.Automation.ErrorRecord]::new(
            [System.InvalidOperationException]::new('DO_NOT_LOG_RESPONSE'), 'MaximumRedirectExceeded',
            [System.Management.Automation.ErrorCategory]::InvalidOperation, $null))
    }
    if (($global:pixReplayMockMode -in @('post_timeout', 'late_post_timeout') -and $Method -eq 'Post') -or
        ($global:pixReplayMockMode -in @('after_timeout', 'late_after_timeout') -and $global:pixReplayMockCalls.Count -eq 3)) {
        throw [System.Net.WebException]::new('DO_NOT_LOG_RESPONSE', [System.Net.WebExceptionStatus]::Timeout)
    }
    if ($Method -eq 'Post') {
        if ($Uri -cne "$base/api/webhooks/asaas" -or $Headers['asaas-access-token'] -cne 'DO_NOT_LOG_WEBHOOK' -or
            $Headers.ContainsKey('Authorization') -or $ContentType -cne 'application/json; charset=utf-8') { throw 'Invalid webhook fixture' }
        $sent = $Body | ConvertFrom-Json
        if ($global:pixReplayMockMode.StartsWith('late_')) {
            if ($sent.id -cne 'evt_hml_test_order_1_late_pending_v1' -or $sent.payment.id -cne 'pay_r4gdsmosa0lh851z' -or
                $sent.dateCreated -cne '2026-10-08 13:30:00' -or $sent.payment.status -cne 'PENDING') { throw 'Late fixture changed' }
            return @{ received = $true; eventId = $sent.id;
                status = $(if ($global:pixReplayMockMode -eq 'late_completed') { 'PROCESSED' } else { 'RECEIVED' }) }
        }
        if ($sent.id -cne 'evt_original' -or $sent.payment.id -cne 'pay_original' -or $sent.dateCreated -cne '2026-10-08 15:53:38') { throw 'Original fields changed' }
        return @{ received = $true; eventId = 'evt_original'; status = $(if ($global:pixReplayMockMode -eq 'new_event') { 'RECEIVED' } else { 'PROCESSED' }) }
    }
    if ($Method -ne 'Get' -or $Uri -cne "$base/api/cron/payments/status" -or
        $Headers.Authorization -cne 'Bearer DO_NOT_LOG_CRON' -or $Headers.ContainsKey('asaas-access-token')) { throw 'Invalid supervision fixture' }
    $inboxRows = @(@{ status = $(if ($global:pixReplayMockMode -in @('pending', 'late_before_pending')) { 'READY' } else { 'COMPLETED' }); _count = 1 })
    if ($global:pixReplayMockMode.StartsWith('late_') -and $global:pixReplayMockCalls.Count -eq 3 -and
        $global:pixReplayMockMode -ne 'late_missing_ready') {
        $inboxRows += @{ status = 'READY'; _count = $(if ($global:pixReplayMockMode -eq 'late_extra_ready') { 2 } else { 1 }) }
    }
    return [pscustomobject]@{ schemaVersion = 1;
        accountScope = $(if ($global:pixReplayMockMode -eq 'wrong_scope') { 'production' } else { 'sandbox-hml' });
        uncertain = 0; overdue = 0; abandonedLeases = 0; untrackedLegacyOrders = 0;
        oldestUnresolvedInboxAt = $null; operations = @();
        inbox = $inboxRows;
        outbox = @(@{ status = 'COMPLETED'; _count = $(if ($global:pixReplayMockMode -in @('changed_queues', 'late_outbox_changed') -and $global:pixReplayMockCalls.Count -eq 3) { 4 } else { 3 }) }) }
}
function Test-PixReplayScript([string]$Mode, [string]$ExpectedCode, [string]$ExpectedCalls, [bool]$Attempted) {
    $global:pixReplayMockMode = $Mode
    $global:pixReplayMockReads = 0
    $global:pixReplayMockCalls = [System.Collections.Generic.List[string]]::new()
    $event = @{ id = 'evt_original'; event = 'PAYMENT_RECEIVED'; dateCreated = '2026-10-08 15:53:38';
        payment = @{ id = 'pay_original'; externalReference = '04e34a9a-70da-4816-b691-3e31c85935b9'; billingType = 'PIX'; value = 24.95; status = 'RECEIVED' } }
    $late = $Mode.StartsWith('late_')
    if ($late) {
        $event = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../scripts/homologation/pix-order-1-late-pending-test-event.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    if ($Mode -eq 'late_wrong_payment') { $event.payment.id = 'pay_another' }
    if ($Mode -eq 'wrong_order') { $event.payment.externalReference = 'another-order' }
    if ($Mode -eq 'private_payload') { $event.payment.customer = 'DO_NOT_LOG_CUSTOMER' }
    $event | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $pixReplayTestFile -Encoding UTF8
    $raw = (& $pixReplayTestTarget -EventFile $pixReplayTestFile -LatePending:$late | Out-String).Trim()
    if ($raw -match 'DO_NOT_LOG') { throw 'Sensitive fixture leaked' }
    $result = $raw | ConvertFrom-Json
    if ($result.code -cne $ExpectedCode -or ($global:pixReplayMockCalls -join ',') -cne $ExpectedCalls -or
        $result.replayAttempted -ne $Attempted -or $result.processingAttempted -ne $false) { throw "Unexpected result in $Mode : $raw" }
    if ($Mode -eq 'success' -and ($result.ok -ne $true -or $result.queuesUnchanged -ne $true)) { throw 'Duplicate not accepted' }
    if ($Mode -eq 'late_success' -and ($result.ok -ne $true -or $result.syntheticEvent -ne $true -or
        $result.oneNewInboxReady -ne $true -or $result.outboxUnchanged -ne $true)) { throw 'Late event not queued' }
    if ($Mode -notin @('success', 'late_success') -and $result.ok -ne $false) { throw 'Failure accepted' }
    Write-Output "PASS: $Mode"
}
try {
    Test-PixReplayScript 'success' 'DUPLICATE_ACCEPTED' 'Get,Post,Get' $true
    Test-PixReplayScript 'wrong_scope' 'STATE_REQUIRES_REVIEW' 'Get' $false
    Test-PixReplayScript 'pending' 'STATE_REQUIRES_REVIEW' 'Get' $false
    Test-PixReplayScript 'wrong_order' 'INVALID_EVENT_INPUT' '' $false
    Test-PixReplayScript 'private_payload' 'INVALID_EVENT_INPUT' '' $false
    Test-PixReplayScript 'bad_secret' 'INVALID_SECRET_INPUT' '' $false
    Test-PixReplayScript 'new_event' 'REPLAY_REQUIRES_REVIEW' 'Get,Post,Get' $true
    Test-PixReplayScript 'changed_queues' 'REPLAY_REQUIRES_REVIEW' 'Get,Post,Get' $true
    Test-PixReplayScript 'post_timeout' 'REQUEST_UNRESOLVED' 'Get,Post' $true
    Test-PixReplayScript 'after_timeout' 'REQUEST_UNRESOLVED' 'Get,Post,Get' $true
    Test-PixReplayScript 'redirect' 'REDIRECT_BLOCKED' 'Get' $false
    Test-PixReplayScript 'late_success' 'LATE_EVENT_QUEUED' 'Get,Post,Get' $true
    Test-PixReplayScript 'late_wrong_payment' 'INVALID_EVENT_INPUT' '' $false
    Test-PixReplayScript 'late_before_pending' 'STATE_REQUIRES_REVIEW' 'Get' $false
    Test-PixReplayScript 'late_completed' 'REPLAY_REQUIRES_REVIEW' 'Get,Post,Get' $true
    Test-PixReplayScript 'late_missing_ready' 'REPLAY_REQUIRES_REVIEW' 'Get,Post,Get' $true
    Test-PixReplayScript 'late_extra_ready' 'STATE_REQUIRES_REVIEW' 'Get,Post,Get' $true
    Test-PixReplayScript 'late_outbox_changed' 'REPLAY_REQUIRES_REVIEW' 'Get,Post,Get' $true
    Test-PixReplayScript 'late_post_timeout' 'REQUEST_UNRESOLVED' 'Get,Post' $true
    Test-PixReplayScript 'late_after_timeout' 'REQUEST_UNRESOLVED' 'Get,Post,Get' $true
} finally {
    # Only the unique temporary leaf created by this harness is removed.
    Remove-Item -LiteralPath $pixReplayTestFile -ErrorAction SilentlyContinue
    Remove-Variable pixReplayMockMode, pixReplayMockReads, pixReplayMockCalls -Scope Global -ErrorAction SilentlyContinue
}
