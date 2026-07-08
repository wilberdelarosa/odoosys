$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$runtimePath = Join-Path $scriptRoot 'runtime'
$logsPath = Join-Path $runtimePath 'logs'
$transcriptPath = Join-Path $logsPath 'elevated-native-setup.log'
$successMarkerPath = Join-Path $runtimePath 'elevated-native-setup.ok'
$failureMarkerPath = Join-Path $runtimePath 'elevated-native-setup.failed'

New-Item -ItemType Directory -Force -Path $logsPath | Out-Null
Remove-Item -Path $successMarkerPath -Force -ErrorAction SilentlyContinue
Remove-Item -Path $failureMarkerPath -Force -ErrorAction SilentlyContinue

Set-Location $scriptRoot
Start-Transcript -Path $transcriptPath -Force | Out-Null

try {
    & (Join-Path $scriptRoot 'install-native.ps1') -InstallPostgres
    & (Join-Path $scriptRoot 'install-native.ps1') -SkipOdooClone -SkipNpmInstall -InitializeDatabase -InstallOdooModules
    Set-Content -Path $successMarkerPath -Value (Get-Date -Format 's') -Encoding ASCII
}
catch {
    Set-Content -Path $failureMarkerPath -Value $_.Exception.ToString() -Encoding UTF8
    throw
}
finally {
    Stop-Transcript | Out-Null
}