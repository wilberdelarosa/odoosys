$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$rootPath = Split-Path -Parent $scriptRoot
$gatewayPath = Join-Path $rootPath 'ecf-endpoints-service'
$runtimePath = Join-Path $env:LOCALAPPDATA 'DGII-ERP-Desktop'
$logsPath = Join-Path $runtimePath 'logs'
$logPath = Join-Path $logsPath 'gateway-supervisor.log'
$pidPath = Join-Path $runtimePath 'gateway-supervisor.pid'

New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
New-Item -ItemType Directory -Force -Path $logsPath | Out-Null
Set-Content -Path $pidPath -Value $PID -Encoding ASCII

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source

function Write-Log {
    param([string]$Message)

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $logPath -Value "[$timestamp] $Message" -Encoding ASCII
}

Write-Log 'Supervisor del gateway iniciado.'

while ($true) {
    $exitCode = 0
    try {
        Write-Log 'Lanzando gateway con npm start.'
        Push-Location $gatewayPath
        & $npmCommand 'start' *>> $logPath
        $exitCode = $LASTEXITCODE
        Write-Log "El gateway termino con codigo $exitCode."
    }
    catch {
        Write-Log ("Fallo del supervisor: " + $_.Exception.Message)
        $exitCode = 1
    }
    finally {
        Pop-Location -ErrorAction SilentlyContinue
    }

    Write-Log 'Reintentando en 5 segundos.'
    Start-Sleep -Seconds 5
}
