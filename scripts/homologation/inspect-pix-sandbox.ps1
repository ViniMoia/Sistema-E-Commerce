param(
    [ValidatePattern('^[a-fA-F0-9-]{36}$')]
    [string]$OrderId = '04e34a9a-70da-4816-b691-3e31c85935b9'
)

# Read-only: two Sandbox GETs at most; no database, payment confirmation or creation.
$pixInspectSecret = $null
$pixInspectKey = $null
$pixInspectHeaders = $null

function Get-PixSandboxJson {
    param([string]$Uri, [hashtable]$Headers)
    try {
        $pixInspectBody = Invoke-RestMethod -Uri $Uri -Method Get -Headers $Headers `
            -MaximumRedirection 0 -TimeoutSec 20 -ErrorAction Stop
        return @{ ok = $true; body = $pixInspectBody }
    }
    catch {
        $pixInspectStatus = $null
        if ($_.Exception.Response) {
            $pixInspectStatus = [int]$_.Exception.Response.StatusCode
        }
        $pixInspectCodes = @()
        try {
            $pixInspectError = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction Stop
            $pixInspectCodes = @($pixInspectError.errors | ForEach-Object {
                if ($_.code -match '^[A-Za-z0-9_:-]{1,80}$') { $_.code }
            })
        }
        catch { }
        return @{ ok = $false; httpStatus = $pixInspectStatus; errorCodes = $pixInspectCodes }
    }
}

function Get-PixFieldState {
    param($Object, [string]$Name)
    if ($null -eq $Object.PSObject.Properties[$Name]) { return 'absent' }
    if ($null -eq $Object.$Name) { return 'null' }
    return 'present'
}

try {
    $pixInspectSecret = Read-Host 'Cole a chave API do Asaas SANDBOX (nao o token do webhook)' -AsSecureString
    $pixInspectKey = ([System.Net.NetworkCredential]::new('', $pixInspectSecret)).Password
    if ([string]::IsNullOrWhiteSpace($pixInspectKey) -or $pixInspectKey -match '[\r\n]' -or $pixInspectKey.StartsWith('$aact_prod_')) {
        throw 'Chave vazia, invalida ou de producao. Consulta cancelada.'
    }
    $pixInspectHeaders = @{ access_token = $pixInspectKey; 'User-Agent' = 'Commerce-Sandbox-Diagnostic/1.0' }
    $pixInspectReference = [Uri]::EscapeDataString($OrderId)
    $pixInspectList = Get-PixSandboxJson -Uri "https://api-sandbox.asaas.com/v3/payments?externalReference=$pixInspectReference&limit=100&offset=0" -Headers $pixInspectHeaders
    if (-not $pixInspectList.ok) {
        @{ stage = 'lookup'; httpStatus = $pixInspectList.httpStatus; errorCodes = $pixInspectList.errorCodes } | ConvertTo-Json -Depth 4
        return
    }
    if ($pixInspectList.body.hasMore -ne $false) {
        @{ stage = 'lookup'; result = 'incomplete_list' } | ConvertTo-Json
        return
    }
    $pixInspectMatches = @($pixInspectList.body.data | Where-Object { $_.externalReference -ceq $OrderId })
    if ($pixInspectMatches.Count -ne 1) {
        @{ stage = 'lookup'; matchingCharges = $pixInspectMatches.Count; result = 'expected_one_charge' } | ConvertTo-Json
        return
    }
    $pixInspectPayment = $pixInspectMatches[0]
    $pixInspectSummary = [ordered]@{
        stage = 'inspection'
        matchingCharges = 1
        paymentId = $pixInspectPayment.id
        billingType = $pixInspectPayment.billingType
        status = $pixInspectPayment.status
        value = $pixInspectPayment.value
        externalReferenceMatches = $true
        installmentField = Get-PixFieldState -Object $pixInspectPayment -Name 'installment'
        installmentNumberField = Get-PixFieldState -Object $pixInspectPayment -Name 'installmentNumber'
    }
    if ($pixInspectPayment.billingType -eq 'PIX' -and $pixInspectPayment.id -match '^[A-Za-z0-9_-]{1,128}$') {
        $pixInspectId = [Uri]::EscapeDataString($pixInspectPayment.id)
        $pixInspectQr = Get-PixSandboxJson -Uri "https://api-sandbox.asaas.com/v3/payments/$pixInspectId/pixQrCode" -Headers $pixInspectHeaders
        $pixInspectSummary.qrLookupSucceeded = $pixInspectQr.ok
        if ($pixInspectQr.ok) {
            $pixInspectSummary.hasPayload = -not [string]::IsNullOrWhiteSpace($pixInspectQr.body.payload)
            $pixInspectSummary.hasEncodedImage = -not [string]::IsNullOrWhiteSpace($pixInspectQr.body.encodedImage)
        }
        else {
            $pixInspectSummary.qrHttpStatus = $pixInspectQr.httpStatus
            $pixInspectSummary.qrErrorCodes = $pixInspectQr.errorCodes
        }
    }
    $pixInspectSummary | ConvertTo-Json -Depth 4
}
finally {
    if ($pixInspectSecret) { $pixInspectSecret.Dispose() }
    Remove-Variable pixInspectSecret, pixInspectKey, pixInspectHeaders -ErrorAction SilentlyContinue
}
