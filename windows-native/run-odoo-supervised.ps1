$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$runtimePath = Join-Path $scriptRoot 'runtime'
$logsPath = Join-Path $runtimePath 'logs'
$logPath = Join-Path $logsPath 'odoo-native.log'
$pidPath = Join-Path $runtimePath 'odoo-supervisor.pid'
$odooSourcePath = Join-Path $runtimePath 'odoo-17'
$alternateOdooSourcePath = Join-Path $runtimePath 'odoo-17-native'
$venvPython = Join-Path $runtimePath 'odoo-venv\Scripts\python.exe'
$odooConfigPath = Join-Path $runtimePath 'odoo-native.conf'

New-Item -ItemType Directory -Force -Path $logsPath | Out-Null
Set-Content -Path $pidPath -Value $PID -Encoding ASCII

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $logPath -Value "[$timestamp] $Message" -Encoding ASCII
}

Write-Log 'Supervisor nativo de Odoo iniciado.'

if ((-not (Test-Path (Join-Path $odooSourcePath 'odoo-bin'))) -and (Test-Path (Join-Path $alternateOdooSourcePath 'odoo-bin'))) {
    $odooSourcePath = $alternateOdooSourcePath
    Write-Log "Usando Odoo source alternativo en $odooSourcePath."
}

while ($true) {
    try {
        Write-Log 'Lanzando Odoo nativo.'
        $odooCommand = Join-Path $odooSourcePath 'odoo-bin'
        $commandLine = '"{0}" "{1}" -c "{2}" >> "{3}" 2>&1' -f $venvPython, $odooCommand, $odooConfigPath, $logPath
        & cmd.exe /c $commandLine
        Write-Log "Odoo termino con codigo $LASTEXITCODE."
    }
    catch {
        Write-Log ('Fallo lanzando Odoo: ' + $_.Exception.Message)
    }

    Write-Log 'Reintentando Odoo en 10 segundos.'
    Start-Sleep -Seconds 10
}