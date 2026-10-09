# Somente leitura: um GET da cobranca especifica no Asaas Sandbox.
# Nao solicita estorno, nao processa filas e nao consulta QR Code.
# Inclui status/valor dos refunds; nao imprime descricao, comprovantes ou dados pessoais.
# Cole a chave Sandbox somente na entrada oculta; nunca no arquivo/chat.
# -RefundHistory: apos validar a cobranca, faz um segundo GET em /refunds.
param([switch]$RefundHistory)

$refundProofSecret = $null
$refundProofHttpStatus = $null
$refundProofLookupAttempted = $false
$refundProofPhase = 'refund_charge_lookup'
$refundProofChargeHttpStatus = $null
$refundProofHistoryHttpStatus = $null
$refundProofHistoryLookupAttempted = $false
$refundProofRecordsSource = 'charge'
$refundProofHistoryShape = $null
$refundProofHistoryHasMore = $null
try {
    $refundProofSecret = Read-Host 'Cole a chave API do Asaas SANDBOX (nao o token do webhook)' -AsSecureString
    $refundProofKey = ([System.Net.NetworkCredential]::new('', $refundProofSecret)).Password
    if ([string]::IsNullOrWhiteSpace($refundProofKey) -or $refundProofKey -match '\s' -or $refundProofKey.StartsWith('$aact_prod_')) {
        @{ ok = $false; code = 'INVALID_SANDBOX_KEY_INPUT'; lookupAttempted = $false;
            processingAttempted = $false; requestAttempted = $false } | ConvertTo-Json
        return
    }
    $refundProofHeaders = @{ access_token = $refundProofKey }
    $refundProofLookupAttempted = $true
    $refundProofResponse = Invoke-WebRequest -Uri 'https://api-sandbox.asaas.com/v3/payments/pay_cra35xq1ltkb6oka' `
        -Method Get -Headers $refundProofHeaders -UserAgent 'Commerce-Sandbox-Diagnostic/1.0' `
        -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -ErrorAction Stop
    $refundProofHttpStatus = [int]$refundProofResponse.StatusCode
    $refundProofChargeHttpStatus = $refundProofHttpStatus
    $refundProofBody = $refundProofResponse.Content | ConvertFrom-Json -ErrorAction Stop
    $refundProofIdentityMatches = $refundProofBody.id -ceq 'pay_cra35xq1ltkb6oka' -and
        $refundProofBody.externalReference -ceq '5b5bef57-2fd2-4f88-83fd-bf3d76238c40' -and
        $refundProofBody.billingType -ceq 'PIX' -and [decimal]$refundProofBody.value -eq [decimal]49.90
    $refundProofStatus = $null
    if ($refundProofBody.status -is [string] -and $refundProofBody.status -cmatch '^[A-Z_]{1,40}$') {
        $refundProofStatus = $refundProofBody.status
    }
    $refundProofDeleted = $null
    $refundProofDeletedField = $refundProofBody.PSObject.Properties['deleted']
    if ($null -ne $refundProofDeletedField -and $refundProofDeletedField.Value -is [bool]) {
        $refundProofDeleted = $refundProofDeletedField.Value
    }
    $refundProofRecordsField = $refundProofBody.PSObject.Properties['refunds']
    $refundProofRecordsPresent = $null -ne $refundProofRecordsField -and $null -ne $refundProofRecordsField.Value
    $refundProofRecordsValid = $refundProofRecordsPresent -and $refundProofRecordsField.Value -is [System.Array]
    $refundProofInputRecords = $(if ($refundProofRecordsValid) { $refundProofRecordsField.Value } else { $null })
    if ($RefundHistory -and $refundProofHttpStatus -eq 200 -and $refundProofIdentityMatches) {
        $refundProofPhase = 'refund_history_lookup'
        $refundProofRecordsSource = 'refund_history'
        $refundProofHistoryLookupAttempted = $true
        $refundProofHttpStatus = $null
        $refundProofHistoryResponse = Invoke-WebRequest -Uri 'https://api-sandbox.asaas.com/v3/payments/pay_cra35xq1ltkb6oka/refunds' `
            -Method Get -Headers $refundProofHeaders -UserAgent 'Commerce-Sandbox-Diagnostic/1.0' `
            -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -ErrorAction Stop
        $refundProofHttpStatus = [int]$refundProofHistoryResponse.StatusCode
        $refundProofHistoryHttpStatus = $refundProofHttpStatus
        $refundProofRecordsPresent = $false; $refundProofRecordsValid = $false
        $refundProofInputRecords = $null
        $refundProofHistoryContent = [string]$refundProofHistoryResponse.Content
        # Wrapping preserves root arrays with zero/one items on PowerShell 5/7.
        if ($refundProofHistoryContent.TrimStart().StartsWith('[')) {
            $refundProofHistoryBody = ('{"refunds":' + $refundProofHistoryContent + '}') | ConvertFrom-Json -ErrorAction Stop
            $refundProofInputRecords = $refundProofHistoryBody.refunds
            $refundProofHistoryShape = 'ROOT_ARRAY'
            $refundProofRecordsPresent = $true; $refundProofRecordsValid = $true
        }
        else {
            $refundProofHistoryBody = $refundProofHistoryContent | ConvertFrom-Json -ErrorAction Stop
            $refundProofHistoryShape = 'UNRECOGNIZED'
            $refundProofHistoryField = $refundProofHistoryBody.PSObject.Properties['refunds']
            if ($null -ne $refundProofHistoryField -and $refundProofHistoryField.Value -is [System.Array]) {
                $refundProofHistoryShape = 'REFUNDS_ARRAY'
                $refundProofInputRecords = $refundProofHistoryField.Value
                $refundProofRecordsPresent = $true; $refundProofRecordsValid = $true
            }
            else {
                $refundProofHistoryField = $refundProofHistoryBody.PSObject.Properties['data']
                if ($null -ne $refundProofHistoryField -and $refundProofHistoryField.Value -is [System.Array]) {
                    $refundProofHistoryShape = 'DATA_ARRAY'
                    $refundProofInputRecords = $refundProofHistoryField.Value
                    $refundProofRecordsPresent = $true
                    # A paginated response must explicitly prove the final page.
                    if ($refundProofHistoryBody.hasMore -is [bool]) {
                        $refundProofHistoryHasMore = $refundProofHistoryBody.hasMore
                        $refundProofRecordsValid = -not $refundProofHistoryHasMore
                    }
                }
            }
        }
    }
    $refundProofRecords = @()
    $refundProofCompletedAmount = [decimal]0
    $refundProofPendingAmount = [decimal]0
    $refundProofCancelledAmount = [decimal]0
    $refundProofAwaitingAuthorizationAmount = [decimal]0
    if ($refundProofRecordsValid) {
        if ($refundProofInputRecords.Count -gt 100) { $refundProofRecordsValid = $false }
        else {
            foreach ($refundProofRecord in $refundProofInputRecords) {
                $refundProofRecordStatus = $null
                if ($refundProofRecord.status -is [string] -and $refundProofRecord.status -cmatch '^[A-Z_]{1,40}$') {
                    $refundProofRecordStatus = $refundProofRecord.status
                }
                $refundProofRecordValue = $null
                if ($refundProofRecord.value -is [int] -or $refundProofRecord.value -is [long] -or
                    $refundProofRecord.value -is [double] -or $refundProofRecord.value -is [decimal]) {
                    $refundProofRecordValue = [decimal]$refundProofRecord.value
                    if ($refundProofRecordValue -le 0 -or $refundProofRecordValue -gt [decimal]49.90 -or
                        [decimal]::Round($refundProofRecordValue, 2) -ne $refundProofRecordValue) {
                        $refundProofRecordValue = $null
                    }
                }
                $refundProofRecordDate = $null
                if ($refundProofRecord.dateCreated -is [string] -and
                    $refundProofRecord.dateCreated -cmatch '^[0-9TZ:.+ -]{10,40}$') {
                    $refundProofRecordDate = $refundProofRecord.dateCreated
                }
                if ($null -eq $refundProofRecordValue -or $refundProofRecordStatus -cnotin @('DONE', 'PENDING', 'CANCELLED', 'AWAITING_CRITICAL_ACTION_AUTHORIZATION')) {
                    $refundProofRecordsValid = $false
                }
                else {
                    if ($refundProofRecordStatus -ceq 'DONE') { $refundProofCompletedAmount += $refundProofRecordValue }
                    elseif ($refundProofRecordStatus -ceq 'PENDING') { $refundProofPendingAmount += $refundProofRecordValue }
                    elseif ($refundProofRecordStatus -ceq 'CANCELLED') { $refundProofCancelledAmount += $refundProofRecordValue }
                    elseif ($refundProofRecordStatus -ceq 'AWAITING_CRITICAL_ACTION_AUTHORIZATION') { $refundProofAwaitingAuthorizationAmount += $refundProofRecordValue }
                }
                $refundProofRecords += [ordered]@{ status = $refundProofRecordStatus; value = $refundProofRecordValue; dateCreated = $refundProofRecordDate }
            }
        }
    }
    if (-not $refundProofRecordsValid) {
        $refundProofCompletedAmount = $null; $refundProofPendingAmount = $null; $refundProofCancelledAmount = $null
        $refundProofAwaitingAuthorizationAmount = $null
    }
    # Este ensaio solicitou exatamente um estorno integral, sem estornos anteriores.
    $refundProofFullRecord = $refundProofRecordsValid -and $refundProofRecords.Count -eq 1 -and
        $refundProofCompletedAmount -eq [decimal]49.90
    $refundProofVerified = $refundProofHttpStatus -eq 200 -and $refundProofIdentityMatches -and
        $refundProofStatus -ceq 'REFUNDED' -and $refundProofDeleted -ne $true -and $refundProofFullRecord
    $refundProofCode = 'REFUND_NOT_PROVEN'
    if (-not $refundProofIdentityMatches) { $refundProofCode = 'CHARGE_IDENTITY_MISMATCH' }
    elseif ($refundProofVerified) { $refundProofCode = 'CHARGE_REFUND_VERIFIED' }
    elseif (-not $refundProofRecordsValid) { $refundProofCode = 'REFUND_DETAILS_UNRESOLVED' }
    elseif ($refundProofFullRecord) { $refundProofCode = 'REFUND_STATUS_DIVERGENCE' }
    elseif ($refundProofAwaitingAuthorizationAmount -gt 0) { $refundProofCode = 'REFUND_AWAITING_PROVIDER_AUTHORIZATION' }
    elseif ($refundProofPendingAmount -gt 0) { $refundProofCode = 'REFUND_PENDING_AT_PROVIDER' }
    elseif ($refundProofRecords.Count -eq 0) { $refundProofCode = 'REFUND_RECORD_NOT_OBSERVED' }
    elseif ($refundProofCancelledAmount -gt 0 -and $refundProofCompletedAmount -eq 0) { $refundProofCode = 'REFUND_CANCELLED_AT_PROVIDER' }
    [ordered]@{
        phase = $refundProofPhase; ok = [bool]$refundProofVerified; code = $refundProofCode
        httpStatus = $refundProofHttpStatus; lookupAttempted = $true
        chargeHttpStatus = $refundProofChargeHttpStatus; refundHistoryHttpStatus = $refundProofHistoryHttpStatus
        refundHistoryLookupAttempted = $refundProofHistoryLookupAttempted
        refundRecordsSource = $refundProofRecordsSource; refundHistoryShape = $refundProofHistoryShape
        refundHistoryHasMore = $refundProofHistoryHasMore
        requestAttempted = $false; processingAttempted = $false
        expectedOrderId = '5b5bef57-2fd2-4f88-83fd-bf3d76238c40'
        expectedPaymentId = 'pay_cra35xq1ltkb6oka'; expectedValue = 49.90
        identityMatches = [bool]$refundProofIdentityMatches; status = $refundProofStatus; deleted = $refundProofDeleted
        refundRecordsPresent = [bool]$refundProofRecordsPresent; refundRecordsValid = [bool]$refundProofRecordsValid
        refundCount = $(if ($refundProofRecordsValid) { $refundProofRecords.Count } else { $null })
        completedRefundAmount = $refundProofCompletedAmount; pendingRefundAmount = $refundProofPendingAmount
        awaitingAuthorizationRefundAmount = $refundProofAwaitingAuthorizationAmount
        cancelledRefundAmount = $refundProofCancelledAmount; refunds = $refundProofRecords
        instruction = 'Enviar este JSON; nao repetir REFUND nem acionar estorno no painel.'
    } | ConvertTo-Json -Depth 5
}
catch {
    if ($_.Exception.Response) { $refundProofHttpStatus = [int]$_.Exception.Response.StatusCode }
    if ($refundProofHistoryLookupAttempted) { $refundProofHistoryHttpStatus = $refundProofHttpStatus }
    @{ phase = $refundProofPhase; ok = $false; code = 'LOOKUP_UNRESOLVED'; httpStatus = $refundProofHttpStatus
        chargeHttpStatus = $refundProofChargeHttpStatus; refundHistoryHttpStatus = $refundProofHistoryHttpStatus
        refundHistoryLookupAttempted = $refundProofHistoryLookupAttempted
        lookupAttempted = $refundProofLookupAttempted; requestAttempted = $false; processingAttempted = $false
        instruction = 'Consulta inconclusiva; enviar este JSON, sem repetir o estorno.' } | ConvertTo-Json
}
finally {
    if ($refundProofSecret) { $refundProofSecret.Dispose() }
    Remove-Variable refundProofSecret, refundProofKey, refundProofHeaders, refundProofResponse, refundProofBody,
        refundProofHistoryResponse, refundProofHistoryBody, refundProofHistoryContent -ErrorAction SilentlyContinue
}
