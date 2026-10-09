param([switch]$StatusOnly)

# One processing batch in the fixed homologation Preview. No scheduler or retry.
# -StatusOnly performs only the authenticated GET; never sends processing POST.
$pixProcessCron = $null
$pixProcessBypass = $null
$pixProcessHeaders = $null
$pixProcessPhase = 'authentication'
try {
    $pixProcessCron = Read-Host 'Cole o CRON_SECRET da homologacao' -AsSecureString
    $pixProcessBypass = Read-Host 'Cole o segredo de bypass da Vercel' -AsSecureString
    $pixProcessCronValue = ([System.Net.NetworkCredential]::new('', $pixProcessCron)).Password
    $pixProcessBypassValue = ([System.Net.NetworkCredential]::new('', $pixProcessBypass)).Password
    if ([string]::IsNullOrWhiteSpace($pixProcessCronValue) -or $pixProcessCronValue -match '\s' -or
        [string]::IsNullOrWhiteSpace($pixProcessBypassValue) -or $pixProcessBypassValue -match '\s') {
        @{ ok = $false; phase = $pixProcessPhase; code = 'INVALID_SECRET_INPUT';
            instruction = 'Copiar somente o valor de cada segredo, sem espacos ou quebras de linha.' } | ConvertTo-Json
        return
    }
    $pixProcessHeaders = @{
        Authorization = 'Bearer ' + $pixProcessCronValue
        'x-vercel-protection-bypass' = $pixProcessBypassValue
    }
    $pixProcessPhase = 'scope_check'
    $pixProcessBase = 'https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app'
    $pixProcessStatus = Invoke-RestMethod -Uri "$pixProcessBase/api/cron/payments/status" -Method Get `
        -Headers $pixProcessHeaders -MaximumRedirection 0 -TimeoutSec 60 -ErrorAction Stop
    if ($pixProcessStatus.schemaVersion -ne 1 -or $pixProcessStatus.accountScope -cne 'sandbox-hml') {
        @{ ok = $false; phase = $pixProcessPhase; code = 'UNEXPECTED_SCOPE' } | ConvertTo-Json
        return
    }
    if ($null -eq $pixProcessStatus.untrackedLegacyOrders -or $pixProcessStatus.untrackedLegacyOrders -ne 0) {
        @{ ok = $false; phase = $pixProcessPhase; code = 'LEGACY_ORDERS_REQUIRE_REVIEW' } | ConvertTo-Json
        return
    }
    if ($StatusOnly) {
        @{ ok = $true; phase = $pixProcessPhase; code = 'SCOPE_VERIFIED';
            processingAttempted = $false; status = $pixProcessStatus } | ConvertTo-Json -Depth 8
        return
    }
    $pixProcessPhase = 'processing'
    Invoke-RestMethod -Uri "$pixProcessBase/api/cron/payments?limit=1" -Method Post `
        -Headers $pixProcessHeaders -MaximumRedirection 0 -TimeoutSec 330 -ErrorAction Stop |
        ConvertTo-Json -Depth 8
}
catch {
    $pixProcessHttpStatus = $null
    if ($_.Exception.Response) { $pixProcessHttpStatus = [int]$_.Exception.Response.StatusCode }
    $pixProcessTransportStatus = $null
    $pixProcessException = $_.Exception
    while ($pixProcessException) {
        if ($pixProcessException -is [System.Net.WebException]) {
            $pixProcessTransportStatus = $pixProcessException.Status.ToString()
        }
        $pixProcessException = $pixProcessException.InnerException
    }
    $pixProcessFailureCode = 'REQUEST_UNRESOLVED'
    # Windows PowerShell may omit Exception.Response when redirect limit is hit.
    # Classify the cmdlet error identifier; never print its raw message/target.
    if (($_.FullyQualifiedErrorId -split ',')[0] -eq 'MaximumRedirectExceeded' -or
        ($null -ne $pixProcessHttpStatus -and $pixProcessHttpStatus -ge 300 -and $pixProcessHttpStatus -lt 400)) {
        $pixProcessFailureCode = 'REDIRECT_BLOCKED'
    }
    $pixProcessInstruction = 'Nao repetir automaticamente; conferir o estado existente.'
    if ($pixProcessPhase -eq 'scope_check') {
        $pixProcessInstruction = 'POST de processamento nao enviado; conferir acesso ao Preview com -StatusOnly.'
    }
    @{ ok = $false; phase = $pixProcessPhase; httpStatus = $pixProcessHttpStatus;
        exceptionType = $_.Exception.GetType().Name;
        transportStatus = $pixProcessTransportStatus; code = $pixProcessFailureCode;
        processingAttempted = ($pixProcessPhase -eq 'processing'); instruction = $pixProcessInstruction } | ConvertTo-Json
}
finally {
    if ($pixProcessCron) { $pixProcessCron.Dispose() }
    if ($pixProcessBypass) { $pixProcessBypass.Dispose() }
    Remove-Variable pixProcessCron, pixProcessBypass, pixProcessHeaders, pixProcessCronValue, pixProcessBypassValue -ErrorAction SilentlyContinue
}
