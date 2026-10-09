# Somente leitura: um GET no Asaas Sandbox, sem consulta de QR ou mutacoes.
# A chave e solicitada em entrada oculta; nao colar credenciais no arquivo/chat.
$pixProofSecret = $null
$pixProofHeaders = $null
$pixProofHttpStatus = $null
$pixProofLookupAttempted = $false
try {
    $pixProofSecret = Read-Host 'Cole a chave API do Asaas SANDBOX (nao o token do webhook)' -AsSecureString
    $pixProofKey = ([System.Net.NetworkCredential]::new('', $pixProofSecret)).Password
    if ([string]::IsNullOrWhiteSpace($pixProofKey) -or $pixProofKey -match '\s' -or $pixProofKey.StartsWith('$aact_prod_')) {
        @{ ok = $false; code = 'INVALID_SANDBOX_KEY_INPUT'; lookupAttempted = $false;
            processingAttempted = $false } | ConvertTo-Json
        return
    }
    $pixProofHeaders = @{ access_token = $pixProofKey }
    $pixProofLookupAttempted = $true
    $pixProofResponse = Invoke-WebRequest -Uri 'https://api-sandbox.asaas.com/v3/payments/pay_3cuzqjn8kvzirv3k' `
        -Method Get -Headers $pixProofHeaders -UserAgent 'Commerce-Sandbox-Diagnostic/1.0' `
        -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -ErrorAction Stop
    $pixProofHttpStatus = [int]$pixProofResponse.StatusCode
    $pixProofBody = $pixProofResponse.Content | ConvertFrom-Json -ErrorAction Stop
    $pixProofIdentityMatches = $pixProofBody.id -ceq 'pay_3cuzqjn8kvzirv3k' -and
        $pixProofBody.externalReference -ceq 'e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0' -and
        $pixProofBody.billingType -ceq 'PIX' -and [decimal]$pixProofBody.value -eq [decimal]49.90
    $pixProofDeletedField = $pixProofBody.PSObject.Properties['deleted']
    $pixProofDeleted = $null
    if ($null -ne $pixProofDeletedField -and $pixProofDeletedField.Value -is [bool]) {
        $pixProofDeleted = $pixProofDeletedField.Value
    }
    $pixProofVerified = $pixProofHttpStatus -eq 200 -and $pixProofIdentityMatches -and $pixProofDeleted -eq $true
    $pixProofCode = 'DELETION_NOT_PROVEN'
    if (-not $pixProofIdentityMatches) { $pixProofCode = 'CHARGE_IDENTITY_MISMATCH' }
    elseif ($pixProofVerified) { $pixProofCode = 'CHARGE_DELETION_VERIFIED' }
    $pixProofStatus = $null
    if ($pixProofBody.status -cmatch '^[A-Z_]{1,40}$') { $pixProofStatus = $pixProofBody.status }
    [ordered]@{
        phase = 'charge_lookup'; ok = [bool]$pixProofVerified; code = $pixProofCode
        httpStatus = $pixProofHttpStatus; lookupAttempted = $true; processingAttempted = $false
        expectedOrderId = 'e0bfe582-e85b-41e7-8b5c-d877b1e1a7e0'
        expectedPaymentId = 'pay_3cuzqjn8kvzirv3k'; expectedValue = 49.90
        identityMatches = [bool]$pixProofIdentityMatches; status = $pixProofStatus; deleted = $pixProofDeleted
    } | ConvertTo-Json -Depth 4
}
catch {
    if ($_.Exception.Response) { $pixProofHttpStatus = [int]$_.Exception.Response.StatusCode }
    @{ phase = 'charge_lookup'; ok = $false; code = 'LOOKUP_UNRESOLVED'; httpStatus = $pixProofHttpStatus
        lookupAttempted = $pixProofLookupAttempted; processingAttempted = $false
        instruction = 'Consulta inconclusiva; enviar este JSON, sem repetir o cancelamento.' } | ConvertTo-Json
}
finally {
    if ($pixProofSecret) { $pixProofSecret.Dispose() }
    Remove-Variable pixProofSecret, pixProofKey, pixProofHeaders, pixProofResponse, pixProofBody -ErrorAction SilentlyContinue
}
