param(
    [string]$DataRoot = ''
)

$ErrorActionPreference = 'Stop'

$appDataRoot = if ($DataRoot) { $DataRoot } else { Join-Path $env:APPDATA 'DGII-ECF-Node' }
$pidFile = Join-Path $appDataRoot 'dgii-ecf-node.pid'

if (-not (Test-Path $pidFile)) {
    Write-Host 'No hay PID registrado para DGII e-CF Node.'
    return
}

$pidValue = Get-Content -Path $pidFile | Select-Object -First 1
if ($pidValue) {
    Stop-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host 'DGII e-CF Node detenido.'
