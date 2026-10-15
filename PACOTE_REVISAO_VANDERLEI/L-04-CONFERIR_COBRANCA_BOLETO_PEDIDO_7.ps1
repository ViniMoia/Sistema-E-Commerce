# Somente leitura: um GET no Asaas Sandbox para a cobranca exata do #7.
# Nao cancela, restaura, paga, processa filas ou consulta boleto/QR.
# Usar a mesma chave API Sandbox configurada no Preview, em entrada oculta.
# Nunca colar a chave no arquivo nem no chat. HTTP 404 nao comprova exclusao.
$boletoProofSecret = $null
$boletoProofHeaders = $null
$boletoProofHttpStatus = $null
$boletoProofLookupAttempted = $false
try {
    $boletoProofSecret = Read-Host 'Cole ASAAS_API_KEY do Preview SANDBOX (nao CRON_SECRET nem token de webhook)' -AsSecureString
    $boletoProofKey = ([System.Net.NetworkCredential]::new('', $boletoProofSecret)).Password
    if ([string]::IsNullOrWhiteSpace($boletoProofKey) -or $boletoProofKey -match '\s' -or $boletoProofKey.StartsWith('$aact_prod_')) {
        @{ ok = $false; code = 'INVALID_SANDBOX_KEY_INPUT'; lookupAttempted = $false;
            processingAttempted = $false } | ConvertTo-Json
        return
    }
    $boletoProofHeaders = @{ access_token = $boletoProofKey }
    $boletoProofLookupAttempted = $true
    $boletoProofResponse = Invoke-WebRequest -Uri 'https://api-sandbox.asaas.com/v3/payments/pay_ddili6nqoxts9jp3' `
        -Method Get -Headers $boletoProofHeaders -UserAgent 'Commerce-Sandbox-Diagnostic/1.0' `
        -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -ErrorAction Stop
    $boletoProofHttpStatus = [int]$boletoProofResponse.StatusCode
    $boletoProofBody = $boletoProofResponse.Content | ConvertFrom-Json -ErrorAction Stop
    $boletoProofIdentityMatches = $boletoProofBody.id -ceq 'pay_ddili6nqoxts9jp3' -and
        $boletoProofBody.externalReference -ceq 'cd2153ce-9b36-4c9a-ba89-376bf201ae91' -and
        $boletoProofBody.billingType -ceq 'BOLETO' -and [decimal]$boletoProofBody.value -eq [decimal]49.90
    $boletoProofDeletedField = $boletoProofBody.PSObject.Properties['deleted']
    $boletoProofDeleted = $null
    if ($null -ne $boletoProofDeletedField -and $boletoProofDeletedField.Value -is [bool]) {
        $boletoProofDeleted = $boletoProofDeletedField.Value
    }
    $boletoProofStatus = $null
    if ($boletoProofBody.status -is [string] -and $boletoProofBody.status -cmatch '^[A-Z_]{1,40}$') {
        $boletoProofStatus = $boletoProofBody.status
    }
    $boletoProofStateMatches = @('PENDING', 'OVERDUE', 'DELETED') -ccontains $boletoProofStatus
    $boletoProofVerified = $boletoProofHttpStatus -eq 200 -and $boletoProofIdentityMatches -and
        $boletoProofDeleted -eq $true -and $boletoProofStateMatches
    $boletoProofCode = 'DELETION_NOT_PROVEN'
    if (-not $boletoProofIdentityMatches) { $boletoProofCode = 'CHARGE_IDENTITY_MISMATCH' }
    elseif (-not $boletoProofStateMatches) { $boletoProofCode = 'CHARGE_STATE_REQUIRES_REVIEW' }
    elseif ($boletoProofVerified) { $boletoProofCode = 'CHARGE_DELETION_VERIFIED' }
    [ordered]@{
        phase = 'charge_lookup'; at = [DateTime]::UtcNow.ToString('o'); ok = [bool]$boletoProofVerified; code = $boletoProofCode
        httpStatus = $boletoProofHttpStatus; lookupAttempted = $true; processingAttempted = $false
        expectedOrderId = 'cd2153ce-9b36-4c9a-ba89-376bf201ae91'; expectedOrderNumber = 7
        expectedPaymentId = 'pay_ddili6nqoxts9jp3'; expectedValue = 49.90
        identityMatches = [bool]$boletoProofIdentityMatches; status = $boletoProofStatus; deleted = $boletoProofDeleted
    } | ConvertTo-Json -Depth 4
}
catch {
    if ($_.Exception.Response) { $boletoProofHttpStatus = [int]$_.Exception.Response.StatusCode }
    @{ phase = 'charge_lookup'; ok = $false; code = 'LOOKUP_UNRESOLVED'; httpStatus = $boletoProofHttpStatus
        lookupAttempted = $boletoProofLookupAttempted; processingAttempted = $false
        instruction = 'Consulta inconclusiva; enviar este JSON, sem repetir o cancelamento.' } | ConvertTo-Json
}
finally {
    if ($boletoProofSecret) { $boletoProofSecret.Dispose() }
    Remove-Variable boletoProofSecret, boletoProofKey, boletoProofHeaders, boletoProofResponse, boletoProofBody -ErrorAction SilentlyContinue
}
