# Somente leitura no Sandbox. Nao solicita estorno nem processa filas.
# Confere a lista completa de parcelas; ausencia de refunds nao prova historico vazio.
# -RefundHistory: consulta tambem /refunds para cada uma das 12 cobrancas validadas.
param([switch]$RefundHistory)

$parcelSecret = $null
$parcelHttpStatus = $null
$parcelLookupAttempted = $false
$parcelPhase = 'installment_baseline_read'
$parcelHistoriesChecked = 0
$parcelHistoryOrdinal = $null
$parcelHistoryVerified = $false
$parcelRefundTotalCount = 0
$parcelHistoryShape = 'NOT_READ'
$parcelHistoryStage = 'NOT_STARTED'
$parcelHistoryPage = $null
try {
    $parcelSecret = Read-Host 'Cole a chave API do Asaas SANDBOX (entrada oculta)' -AsSecureString
    $parcelKey = ([System.Net.NetworkCredential]::new('', $parcelSecret)).Password
    if ([string]::IsNullOrWhiteSpace($parcelKey) -or $parcelKey -match '\s' -or $parcelKey.StartsWith('$aact_prod_')) {
        throw 'INVALID_KEY'
    }
    $parcelExpected = @(
        'pay_4up6nmdy5f3jnroi', 'pay_fw5t1y2s80csmad4', 'pay_vx438d7nhy7pnw77',
        'pay_8w368nd78idgbf0r', 'pay_xremxnsqueb3j0s8', 'pay_08oyn1p40kf6bjn1',
        'pay_8au5r76oduxllrvj', 'pay_97zelg69feyuew0o', 'pay_230v6ur3x6qb6em6',
        'pay_1oqb6kkw85hmrrx6', 'pay_f5k55pa5ac0elo2o', 'pay_ynsc4y7qrsdgrmhe'
    )
    $parcelHeaders = @{ access_token = $parcelKey }
    $parcelLookupAttempted = $true
    $parcelResponse = Invoke-WebRequest -Uri 'https://api-sandbox.asaas.com/v3/installments/cb6d68ce-0b2a-4e10-ab36-8edc15cbdff4/payments?limit=100&offset=0' `
        -Method Get -Headers $parcelHeaders -UserAgent 'Commerce-Sandbox-Diagnostic/1.0' `
        -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -ErrorAction Stop
    $parcelHttpStatus = [int]$parcelResponse.StatusCode
    $parcelBody = $parcelResponse.Content | ConvertFrom-Json -ErrorAction Stop
    $parcelComplete = $parcelBody.data -is [System.Array] -and $parcelBody.data.Count -eq 12 -and
        $parcelBody.hasMore -is [bool] -and -not $parcelBody.hasMore -and $parcelBody.totalCount -eq 12
    $parcelIdentityMatches = $parcelComplete
    $parcelRows = @()
    $parcelSeen = @()
    $parcelSum = [decimal]0
    if ($parcelBody.data -is [System.Array] -and $parcelBody.data.Count -le 100) {
        foreach ($parcelCharge in $parcelBody.data) {
            $parcelOrdinal = [array]::IndexOf($parcelExpected, $parcelCharge.id) + 1
            $parcelAmount = $null
            if ($parcelCharge.value -is [int] -or $parcelCharge.value -is [long] -or
                $parcelCharge.value -is [double] -or $parcelCharge.value -is [decimal]) {
                $parcelAmount = [decimal]$parcelCharge.value
            }
            $parcelMatch = $parcelOrdinal -gt 0 -and $parcelCharge.id -cnotin $parcelSeen -and
                $parcelCharge.installmentNumber -eq $parcelOrdinal -and
                $parcelCharge.installment -ceq 'cb6d68ce-0b2a-4e10-ab36-8edc15cbdff4' -and
                $parcelCharge.externalReference -ceq 'ae14cb17-49fa-47ae-98eb-b48ef3f8ada1' -and
                $parcelCharge.billingType -ceq 'CREDIT_CARD' -and $parcelAmount -eq [decimal]30.06
            $parcelIdentityMatches = $parcelIdentityMatches -and $parcelMatch
            $parcelSeen += $parcelCharge.id
            $parcelSum += $parcelAmount
            $parcelStatus = $null
            if ($parcelCharge.status -is [string] -and $parcelCharge.status -cmatch '^[A-Z_]{1,40}$') { $parcelStatus = $parcelCharge.status }
            $parcelDeleted = $null
            if ($parcelCharge.deleted -is [bool]) { $parcelDeleted = $parcelCharge.deleted }
            $parcelRefunds = $parcelCharge.PSObject.Properties['refunds']
            $parcelRefundCount = $null
            if ($null -ne $parcelRefunds -and $parcelRefunds.Value -is [System.Array]) { $parcelRefundCount = $parcelRefunds.Value.Count }
            $parcelRows += [pscustomobject][ordered]@{
                expectedOrdinal = $parcelOrdinal; identityMatches = [bool]$parcelMatch
                status = $parcelStatus; deleted = $parcelDeleted; refundCountInList = $parcelRefundCount
            }
        }
    }
    $parcelIdentityMatches = $parcelIdentityMatches -and $parcelSum -eq [decimal]360.72
    if ($RefundHistory -and $parcelIdentityMatches -and $parcelHttpStatus -eq 200) {
        $parcelPhase = 'installment_refund_history_read'
        foreach ($parcelRow in ($parcelRows | Sort-Object expectedOrdinal)) {
            $parcelHistoryOrdinal = $parcelRow.expectedOrdinal
            $parcelPaymentId = $parcelExpected[$parcelHistoryOrdinal - 1]
            $parcelHttpStatus = $null
            $parcelHistoryStage = 'HTTP_READ'
            $parcelHistoryShape = 'NOT_READ'
            $parcelHistoryPage = $null
            $parcelHistoryResponse = Invoke-WebRequest -Uri "https://api-sandbox.asaas.com/v3/payments/$parcelPaymentId/refunds?limit=100&offset=0" `
                -Method Get -Headers $parcelHeaders -UserAgent 'Commerce-Sandbox-Diagnostic/1.0' `
                -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -ErrorAction Stop
            $parcelHttpStatus = [int]$parcelHistoryResponse.StatusCode
            if ($parcelHttpStatus -ne 200) { throw 'HISTORY_HTTP_UNRESOLVED' }
            $parcelHistoryText = [string]$parcelHistoryResponse.Content
            $parcelRecords = $null
            $parcelHistoryStage = 'JSON_PARSE'
            # Wrapping preserves empty/single root arrays on PowerShell 5 and 7.
            if ($parcelHistoryText.TrimStart().StartsWith('[')) {
                $parcelHistoryBody = ('{"refunds":' + $parcelHistoryText + '}') | ConvertFrom-Json -ErrorAction Stop
                $parcelHistoryShape = 'ROOT_ARRAY'
                $parcelRecords = $parcelHistoryBody.refunds
            }
            else {
                $parcelHistoryBody = $parcelHistoryText | ConvertFrom-Json -ErrorAction Stop
                $parcelHistoryShape = 'UNRECOGNIZED'
                $parcelHistoryStage = 'PAGE_VALIDATION'
                $parcelDataField = $null
                if ($null -ne $parcelHistoryBody) { $parcelDataField = $parcelHistoryBody.PSObject.Properties['data'] }
                $parcelDataKind = 'ABSENT'
                if ($null -ne $parcelDataField) {
                    $parcelDataKind = $(if ($null -eq $parcelDataField.Value) { 'NULL' }
                        elseif ($parcelDataField.Value -is [System.Array]) { 'ARRAY' } else { 'OTHER' })
                }
                # Only structural metadata from known fields may enter the diagnostic.
                $parcelHistoryPage = [ordered]@{ isList = ($parcelHistoryBody.object -ceq 'list'); dataKind = $parcelDataKind }
                foreach ($parcelPageField in @('totalCount', 'offset', 'limit')) {
                    $parcelPageNumber = $parcelHistoryBody.$parcelPageField
                    $parcelHistoryPage[$parcelPageField] = $(if (($parcelPageNumber -is [int] -or $parcelPageNumber -is [long]) -and
                        $parcelPageNumber -ge 0 -and $parcelPageNumber -le 2147483647) { $parcelPageNumber } else { $null })
                }
                $parcelHistoryPage['hasMore'] = $(if ($parcelHistoryBody.hasMore -is [bool]) { $parcelHistoryBody.hasMore } else { $null })
                # Same strict empty-page contract as services/payment/refund-history.ts (9d07510).
                $parcelExplicitEmpty = $parcelHistoryPage.isList -and $parcelDataKind -eq 'NULL' -and
                    $null -ne $parcelHistoryPage.totalCount -and $parcelHistoryPage.totalCount -eq 0 -and
                    $null -ne $parcelHistoryPage.offset -and $parcelHistoryPage.offset -eq 0 -and
                    $null -ne $parcelHistoryPage.limit -and $parcelHistoryPage.limit -gt 0 -and
                    $parcelHistoryBody.hasMore -is [bool] -and -not $parcelHistoryBody.hasMore
                if ($parcelExplicitEmpty) {
                    $parcelHistoryShape = 'EXPLICIT_EMPTY_PAGE'
                    $parcelRecords = @()
                }
                elseif ($parcelHistoryBody.refunds -is [System.Array]) {
                    $parcelHistoryShape = 'REFUNDS_ARRAY'
                    $parcelRecords = $parcelHistoryBody.refunds
                }
                elseif ($parcelHistoryBody.data -is [System.Array] -and
                    $parcelHistoryBody.hasMore -is [bool] -and -not $parcelHistoryBody.hasMore) {
                    $parcelHistoryShape = 'DATA_ARRAY'
                    $parcelRecords = $parcelHistoryBody.data
                }
                # Never treat explicit incomplete pagination as a complete history.
                if ($null -ne $parcelHistoryBody -and $null -ne $parcelHistoryBody.PSObject.Properties['hasMore'] -and
                    ($parcelHistoryBody.hasMore -isnot [bool] -or $parcelHistoryBody.hasMore)) {
                    throw 'HISTORY_PAGINATION_UNRESOLVED'
                }
            }
            $parcelHistoryStage = 'RECORD_VALIDATION'
            if ($parcelRecords -isnot [System.Array] -or $parcelRecords.Count -gt 100) { throw 'HISTORY_SHAPE_UNRESOLVED' }
            $parcelSafeRecords = @()
            foreach ($parcelRecord in $parcelRecords) {
                if ($parcelRecord.status -cnotin @('DONE', 'PENDING', 'CANCELLED', 'AWAITING_CRITICAL_ACTION_AUTHORIZATION') -or
                    -not ($parcelRecord.value -is [int] -or $parcelRecord.value -is [long] -or
                        $parcelRecord.value -is [double] -or $parcelRecord.value -is [decimal])) {
                    throw 'HISTORY_RECORD_UNRESOLVED'
                }
                $parcelRefundValue = [decimal]$parcelRecord.value
                if ($parcelRefundValue -le 0 -or [decimal]::Round($parcelRefundValue, 2) -ne $parcelRefundValue) {
                    throw 'HISTORY_VALUE_UNRESOLVED'
                }
                $parcelSafeRecords += [ordered]@{ status = $parcelRecord.status; value = $parcelRefundValue }
            }
            $parcelHistoryStage = 'RESULT_BUILD'
            $parcelRow | Add-Member -NotePropertyName refundHistoryShape -NotePropertyValue $parcelHistoryShape
            $parcelRow | Add-Member -NotePropertyName refunds -NotePropertyValue $parcelSafeRecords
            $parcelRow | Add-Member -NotePropertyName refundHistoryCount -NotePropertyValue $parcelRecords.Count
            $parcelRefundTotalCount += $parcelRecords.Count
            $parcelHistoriesChecked++
        }
        $parcelHistoryVerified = $parcelHistoriesChecked -eq 12
    }
    $parcelCode = 'INSTALLMENT_SCOPE_UNRESOLVED'
    if ($parcelIdentityMatches) { $parcelCode = 'INSTALLMENT_IDENTITY_VERIFIED' }
    if ($parcelHistoryVerified) {
        $parcelCode = $(if ($parcelRefundTotalCount -eq 0) { 'INSTALLMENT_REFUND_HISTORIES_EMPTY' } else { 'INSTALLMENT_REFUND_RECORDS_FOUND' })
    }
    [ordered]@{
        phase = $parcelPhase; at = [DateTime]::UtcNow.ToString('o'); diagnosticVersion = 2
        ok = [bool]$parcelIdentityMatches
        code = $parcelCode
        httpStatus = $parcelHttpStatus; lookupAttempted = $true; requestAttempted = $false; processingAttempted = $false
        expectedOrderNumber = 4; expectedOrderId = 'ae14cb17-49fa-47ae-98eb-b48ef3f8ada1'
        expectedContractId = 'cb6d68ce-0b2a-4e10-ab36-8edc15cbdff4'; expectedValue = 360.72
        completeList = [bool]$parcelComplete; identityMatches = [bool]$parcelIdentityMatches
        observedCount = $parcelRows.Count; observedValue = $parcelSum
        charges = @($parcelRows | Sort-Object expectedOrdinal)
        refundHistoryRequested = [bool]$RefundHistory; refundHistoryVerified = $parcelHistoryVerified
        refundHistoriesChecked = $parcelHistoriesChecked
        refundRecordCount = $(if ($parcelHistoryVerified) { $parcelRefundTotalCount } else { $null })
        instruction = 'Enviar este JSON. Consulta somente leitura; nao executar estorno nem processar filas com base apenas neste resultado.'
    } | ConvertTo-Json -Depth 7
}
catch {
    if ($_.Exception.Response) { $parcelHttpStatus = [int]$_.Exception.Response.StatusCode }
    $parcelFailureReason = 'LOCAL_OR_TRANSPORT_ERROR'
    if ($_.Exception.Message -cin @('INVALID_KEY', 'HISTORY_HTTP_UNRESOLVED', 'HISTORY_PAGINATION_UNRESOLVED',
        'HISTORY_SHAPE_UNRESOLVED', 'HISTORY_RECORD_UNRESOLVED', 'HISTORY_VALUE_UNRESOLVED')) {
        $parcelFailureReason = $_.Exception.Message
    }
    @{ phase = $parcelPhase; ok = $false; code = 'LOOKUP_UNRESOLVED'; diagnosticVersion = 2
        reason = $parcelFailureReason; historyStage = $parcelHistoryStage
        historyShape = $parcelHistoryShape; historyPage = $parcelHistoryPage
        httpStatus = $parcelHttpStatus; lookupAttempted = $parcelLookupAttempted
        refundHistoryVerified = $false; refundHistoriesChecked = $parcelHistoriesChecked
        failedHistoryOrdinal = $parcelHistoryOrdinal
        requestAttempted = $false; processingAttempted = $false } | ConvertTo-Json -Depth 4
}
finally {
    if ($parcelSecret) { $parcelSecret.Dispose() }
    Remove-Variable parcelSecret, parcelKey, parcelHeaders, parcelResponse, parcelBody, parcelCharge,
        parcelHistoryResponse, parcelHistoryBody, parcelHistoryText, parcelRecords, parcelRecord -ErrorAction SilentlyContinue
}
