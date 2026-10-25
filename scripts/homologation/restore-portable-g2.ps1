param(
    [Parameter(Mandatory=$true)][string]$KeyFile,
    [string]$PackageDir = $PSScriptRoot,
    [switch]$ConfirmOwnAccess,
    [switch]$LocalValidation
)
# Windows PowerShell 5.1: binary data never enters the PowerShell text pipeline.
# Only a newly created, label-verified Docker container is a restore target.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Hash-Bytes([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Invoke-Binary {
    param([string]$File,[string[]]$Arguments,[byte[]]$InputBytes = @(),[hashtable]$Environment = @{},[int]$TimeoutMs = 120000)
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $File
    # All controlled arguments avoid embedded quotes/newlines/trailing slash.
    $info.Arguments = ($Arguments | ForEach-Object {
        if ($_ -match '["\r\n]' -or $_.EndsWith('\')) { throw 'INVALID_ARGUMENT' }
        '"' + $_ + '"'
    }) -join ' '
    $info.UseShellExecute=$false; $info.CreateNoWindow=$true
    $info.RedirectStandardInput=$true; $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
    foreach ($name in $Environment.Keys) { $info.EnvironmentVariables[$name]=$Environment[$name] }
    $proc=New-Object Diagnostics.Process; $proc.StartInfo=$info
    $memory=New-Object IO.MemoryStream
    try {
        [void]$proc.Start()
        $copy=$proc.StandardOutput.BaseStream.CopyToAsync($memory)
        $errors=$proc.StandardError.ReadToEndAsync()
        $proc.StandardInput.BaseStream.Write($InputBytes,0,$InputBytes.Length)
        $proc.StandardInput.Close()
        if (-not $proc.WaitForExit($TimeoutMs)) { $proc.Kill(); throw 'PROCESS_TIMEOUT' }
        [void]$copy.GetAwaiter().GetResult()
        # Discard errors: database errors can contain restored personal data.
        [void]$errors.GetAwaiter().GetResult()
        if ($proc.ExitCode -ne 0) { throw 'PROCESS_FAILED' }
        return [pscustomobject]@{ Bytes=$memory.ToArray() }
    } finally { $memory.Dispose(); $proc.Dispose() }
}
function Docker-Text([string[]]$Arguments,[byte[]]$InputBytes=@()) {
    $r=Invoke-Binary -File $docker -Arguments $Arguments -InputBytes $InputBytes
    return $utf8.GetString($r.Bytes).Trim()
}
function Assert-Container {
    $inspect=@((Docker-Text @('inspect',$container) | ConvertFrom-Json))[0]
    if ($inspect.Name -ne ('/'+$container) -or $inspect.Config.Labels.'continental.g2.run' -ne $runId -or
        $inspect.HostConfig.NetworkMode -ne 'none' -or $inspect.HostConfig.Privileged -or
        @($inspect.Mounts | Where-Object { $_.Type -ne 'tmpfs' }).Count -ne 0 -or
        ($null -ne $inspect.HostConfig.PortBindings -and @($inspect.HostConfig.PortBindings.PSObject.Properties).Count -ne 0)) {
        throw 'CONTAINER_IDENTITY_OR_ISOLATION_MISMATCH'
    }
}
function Sql([string]$Query) {
    Assert-Container
    return Docker-Text @('exec','-i',$container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',$database) $utf8.GetBytes($Query)
}
$runId=[Guid]::NewGuid().ToString('N')
$container='continental-g2-'+$runId
$database='g2_restore_'+$runId
$docker=(Get-Command docker -ErrorAction Stop).Source
$package=[IO.Path]::GetFullPath($PackageDir).TrimEnd('\')
$keyPath=[IO.Path]::GetFullPath($KeyFile)
if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) { throw 'KEY_FILE_MISSING' }
if ($keyPath.StartsWith($package+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'KEEP_KEY_OUTSIDE_PACKAGE' }
if ((Get-Item -LiteralPath $keyPath).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'KEY_LINK_NOT_ALLOWED' }
$resultDir=Join-Path $env:LOCALAPPDATA ('continental-g2-results\'+$runId)
[void](New-Item -ItemType Directory -Path $resultDir)
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
[void](Invoke-Binary 'icacls.exe' @($resultDir,'/inheritance:r','/grant:r',('*'+$sid+':(OI)(CI)F')))
$machineId=(Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid
$result=[ordered]@{ runId=$runId; startedAt=[DateTime]::UtcNow.ToString('o'); stage='preflight'; success=$false;
    localValidation=[bool]$LocalValidation; ownAccessConfirmed=[bool]$ConfirmOwnAccess;
    machineFingerprint=(Hash-Bytes $utf8.GetBytes($machineId)); accountFingerprint=(Hash-Bytes $utf8.GetBytes($sid));
    sourceConnected=$false; sharedDatabaseWritten=$false; providerCalls=0; migrationsApplied=$false;
    stockAdjusted=$false; independentRecoveryProven=$false; g2Closed=$false; productionReady=$false }
$created=$false; $dump=$null; $cleanupFailed=$false
try {
    $manifest=Get-Content -LiteralPath (Join-Path $package 'MANIFEST.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $result.backupSha256=$manifest.backupSha256
    $result.differentMachine=$result.machineFingerprint -ne $manifest.sourceMachineFingerprint
    $result.differentAccount=$result.accountFingerprint -ne $manifest.sourceAccountFingerprint
    if (-not $LocalValidation -and (-not $result.differentMachine -or -not $result.differentAccount)) { throw 'INDEPENDENT_MACHINE_ACCOUNT_REQUIRED' }
    foreach ($property in $manifest.files.PSObject.Properties) {
        if ($property.Name -match '(^[\\/]|\.\.|:)') { throw 'UNSAFE_PACKAGE_PATH' }
        $file=Join-Path $package $property.Name
        if ((Hash-Bytes ([IO.File]::ReadAllBytes($file))) -ne $property.Value) { throw 'PACKAGE_HASH_MISMATCH' }
    }
    if ((Docker-Text @('info','--format','{{.OSType}}')) -ne 'linux') { throw 'LINUX_CONTAINERS_REQUIRED' }
    $result.stage='image'
    try { [void](Docker-Text @('image','inspect',$manifest.postgresImage)) }
    catch { [void](Invoke-Binary $docker @('pull',$manifest.postgresImage) -TimeoutMs 600000) }
    $result.postgresImage=$manifest.postgresImage
    $result.stage='decrypt'
    $timer=[Diagnostics.Stopwatch]::StartNew()
    $decoded=Invoke-Binary (Join-Path $package 'tools\age.exe') @('--decrypt','--identity',$keyPath,(Join-Path $package 'source.dump.age'))
    $dump=$decoded.Bytes
    if ($dump.Length -ne $manifest.backupBytes -or (Hash-Bytes $dump) -ne $manifest.backupSha256) { throw 'DUMP_INTEGRITY_MISMATCH' }
    $result.decryptAndHashMs=$timer.ElapsedMilliseconds
    $result.dumpHashVerified=$true
    $result.stage='provision'
    $timer.Restart()
    $random=New-Object byte[] 32; $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($random) } finally { $rng.Dispose() }
    $password=[Convert]::ToBase64String($random); [Array]::Clear($random,0,$random.Length)
    # tmpfs at the image VOLUME root avoids anonymous persistent volumes.
    [void](Invoke-Binary $docker @('run','--detach','--rm','--network','none','--name',$container,
        '--label',('continental.g2.run='+$runId),'--tmpfs','/var/lib/postgresql','--env','PGDATA=/var/lib/postgresql/g2-data',
        '--env','POSTGRES_PASSWORD',$manifest.postgresImage) -Environment @{POSTGRES_PASSWORD=$password})
    $created=$true; $password=$null
    Assert-Container
    $ready=$false
    for ($i=0;$i -lt 60;$i++) {
        try { [void](Docker-Text @('exec',$container,'pg_isready','-h','127.0.0.1','-U','postgres')); $ready=$true; break }
        catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'DATABASE_NOT_READY' }
    Assert-Container
    [void](Docker-Text @('exec',$container,'createdb','-U','postgres',$database))
    if ((Sql "SELECT count(*) FROM pg_tables WHERE schemaname='public';") -ne '0') { throw 'TARGET_NOT_EMPTY' }
    [void](Sql 'DROP SCHEMA public;')
    $result.provisionMs=$timer.ElapsedMilliseconds
    $result.stage='restore';$timer.Restart()
    Assert-Container
    [void](Invoke-Binary $docker @('exec','-i',$container,'pg_restore','--no-owner','--no-acl','--exit-on-error',
        '--single-transaction','-U','postgres','-d',$database) -InputBytes $dump)
    [Array]::Clear($dump,0,$dump.Length);$dump=$null;$decoded=$null
    $result.restoreMs=$timer.ElapsedMilliseconds
    $result.stage='validate';$timer.Restart()
    $sqlText=[IO.File]::ReadAllText((Join-Path $package 'VERIFY.sql'),$utf8)
    $observed=Sql $sqlText
    $expected=[IO.File]::ReadAllText((Join-Path $package 'EXPECTED.jsonl'),$utf8).Trim()
    $normalized=$observed.Replace("`r`n","`n")
    if ($normalized -cne $expected.Replace("`r`n","`n")) { throw 'RESTORED_BASELINE_MISMATCH' }
    $records=@($normalized.Split("`n") | ForEach-Object { $_ | ConvertFrom-Json })
    $result.tables=@($records | Where-Object {$_.kind -eq 'table'} | Select-Object table,rows)
    $result.baselineSha256=Hash-Bytes $utf8.GetBytes($normalized)
    $result.dataStructureSequencesVerified=$true
    $result.validationMs=$timer.ElapsedMilliseconds
    $result.success=$true;$result.stage='validated'
    $result.independentRecoveryProven=(-not $LocalValidation -and $result.differentMachine -and $result.differentAccount -and $ConfirmOwnAccess)
} catch {
    $result.success=$false
    $code=$_.Exception.Message
    $result.failureCode=if ($code -cmatch '^[A-Z_]+$') { $code } else { 'STEP_FAILED_DETAILS_WITHHELD' }
    $result.failureLine=$_.InvocationInfo.ScriptLineNumber
    $result.failureType=$_.Exception.GetType().FullName
} finally {
    if ($null -ne $dump) { [Array]::Clear($dump,0,$dump.Length) }
    if ($created) {
        try {
            Assert-Container
            [void](Docker-Text @('stop','--time','5',$container))
            $remaining=Docker-Text @('ps','-a','--filter',('label=continental.g2.run='+$runId),'--format','{{.ID}}')
            if ($remaining) { throw 'CONTAINER_NOT_REMOVED' }
            $result.containerRemoved=$true
        } catch { $cleanupFailed=$true;$result.containerRemoved=$false;$result.cleanupContainer=$container }
    } else { $result.containerCreated=$false }
    if ($cleanupFailed) { $result.success=$false; $result.independentRecoveryProven=$false }
    $result.finishedAt=[DateTime]::UtcNow.ToString('o')
    $result.notes='Timing excludes manual access/transfer. No RPO/RTO compliance inferred. Roles/grants, integrations, retention and final opening require separate acceptance.'
    $report=Join-Path $resultDir 'RESULTADO-G2.json'
    [IO.File]::WriteAllText($report,($result | ConvertTo-Json -Depth 12),$utf8)
    Write-Output ('Relatorio sanitizado: '+$report)
    Write-Output ('Restauracao validada: '+$result.success+'; recuperacao independente comprovada: '+$result.independentRecoveryProven)
}
if (-not $result.success) { exit 1 }
