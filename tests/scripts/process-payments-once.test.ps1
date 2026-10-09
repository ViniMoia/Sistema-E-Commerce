# Controlled cmdlet doubles: no Preview, provider or database requests.
$ErrorActionPreference = 'Stop'
$pixMockTarget = Join-Path $PSScriptRoot '../../scripts/homologation/process-payments-once.ps1'

function Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    $global:pixMockReads++
    $value = if ($global:pixMockReads -eq 1) { 'DO_NOT_LOG_CRON' } else { 'DO_NOT_LOG_BYPASS' }
    if ($global:pixMockMode -eq 'bad_input') { $value += "`n" }
    return ConvertTo-SecureString $value -AsPlainText -Force
}
function Invoke-RestMethod {
    [CmdletBinding()]
    param([string]$Uri, [string]$Method, [hashtable]$Headers, [int]$MaximumRedirection, [int]$TimeoutSec)
    $global:pixMockCalls.Add($Method)
    if (-not $Uri.StartsWith('https://continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app/api/cron/payments') -or
        $MaximumRedirection -ne 0 -or $Headers.Authorization -cne 'Bearer DO_NOT_LOG_CRON' -or
        $Headers['x-vercel-protection-bypass'] -cne 'DO_NOT_LOG_BYPASS') { throw 'Invalid fixture request' }
    if ($global:pixMockMode -eq 'redirect') {
        $PSCmdlet.ThrowTerminatingError([System.Management.Automation.ErrorRecord]::new(
            [System.InvalidOperationException]::new('DO_NOT_LOG_RESPONSE'), 'MaximumRedirectExceeded',
            [System.Management.Automation.ErrorCategory]::InvalidOperation, $null))
    }
    if ($global:pixMockMode -eq 'timeout' -or ($global:pixMockMode -eq 'post_timeout' -and $Method -eq 'Post')) {
        throw [System.Net.WebException]::new('DO_NOT_LOG_RESPONSE', [System.Net.WebExceptionStatus]::Timeout)
    }
    if ($global:pixMockMode -eq 'unknown') { throw 'DO_NOT_LOG_RESPONSE' }
    if ($Method -eq 'Get') {
        return [pscustomobject]@{ schemaVersion = 1;
            accountScope = $(if ($global:pixMockMode -eq 'wrong_scope') { 'production' } else { 'sandbox-hml' });
            untrackedLegacyOrders = $(if ($global:pixMockMode -eq 'legacy') { 1 } else { 0 }) }
    }
    if ($Method -ne 'Post' -or $Uri -notlike '*?limit=1' -or $TimeoutSec -ne 330) { throw 'Invalid processing fixture' }
    return @{ inbox = @{ claimed = 1; completed = 1; retried = 0; review = 0 } }
}
function Test-PaymentScript {
    param([string]$Mode, [bool]$StatusOnly, [string]$ExpectedCode, [string]$ExpectedCalls)
    $global:pixMockMode = $Mode
    $global:pixMockReads = 0
    $global:pixMockCalls = [System.Collections.Generic.List[string]]::new()
    $raw = (& $pixMockTarget -StatusOnly:$StatusOnly | Out-String).Trim()
    if ($raw -match 'DO_NOT_LOG') { throw 'Sensitive fixture data leaked' }
    $result = $raw | ConvertFrom-Json
    if (($global:pixMockCalls -join ',') -cne $ExpectedCalls) { throw "Unexpected request count/method in $Mode" }
    if ($ExpectedCode -and $result.code -cne $ExpectedCode) { throw "Unexpected diagnostic code in $Mode" }
    if ($Mode -eq 'timeout' -and $result.transportStatus -cne 'Timeout') { throw 'Timeout classification missing' }
    if ($Mode -eq 'post_timeout') {
        if ($result.phase -cne 'processing' -or $result.processingAttempted -ne $true) { throw 'Lost POST not marked uncertain' }
    } elseif ($result.processingAttempted -eq $true) { throw 'Unexpected processing attempt' }
    if ($Mode -eq 'success' -and $StatusOnly -and ($result.ok -ne $true -or $result.processingAttempted -ne $false)) { throw 'Read-only status failed' }
    if ($Mode -eq 'success' -and -not $StatusOnly -and $result.inbox.completed -ne 1) { throw 'Processing summary missing' }
    Write-Output "PASS: $Mode / StatusOnly=$StatusOnly"
}

try {
    Test-PaymentScript 'success' $true 'SCOPE_VERIFIED' 'Get'
    Test-PaymentScript 'success' $false '' 'Get,Post'
    Test-PaymentScript 'redirect' $true 'REDIRECT_BLOCKED' 'Get'
    Test-PaymentScript 'timeout' $true 'REQUEST_UNRESOLVED' 'Get'
    Test-PaymentScript 'unknown' $true 'REQUEST_UNRESOLVED' 'Get'
    Test-PaymentScript 'wrong_scope' $false 'UNEXPECTED_SCOPE' 'Get'
    Test-PaymentScript 'legacy' $false 'LEGACY_ORDERS_REQUIRE_REVIEW' 'Get'
    Test-PaymentScript 'bad_input' $false 'INVALID_SECRET_INPUT' ''
    Test-PaymentScript 'post_timeout' $false 'REQUEST_UNRESOLVED' 'Get,Post'
} finally {
    Remove-Variable pixMockMode, pixMockReads, pixMockCalls -Scope Global -ErrorAction SilentlyContinue
}
