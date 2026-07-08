$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$rootPath = Split-Path -Parent $scriptRoot
$runtimePath = Join-Path $scriptRoot 'runtime'
$logsPath = Join-Path $runtimePath 'logs'
$logPath = Join-Path $logsPath 'gateway-native.log'
$pidPath = Join-Path $runtimePath 'gateway-supervisor.pid'
$gatewayPath = Join-Path $rootPath 'ecf-endpoints-service'
$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path $logsPath | Out-Null
Set-Content -Path $pidPath -Value $PID -Encoding ASCII

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $logPath -Value "[$timestamp] $Message" -Encoding ASCII
}

Write-Log 'Supervisor nativo del gateway iniciado.'

while ($true) {
    try {
        Write-Log 'Lanzando gateway Node.'
        Push-Location $gatewayPath
        $commandLine = '"{0}" start >> "{1}" 2>&1' -f $npmCommand, $logPath
        & cmd.exe /c $commandLine
        Write-Log "Gateway termino con codigo $LASTEXITCODE."
    }
    catch {
        Write-Log ('Fallo lanzando gateway: ' + $_.Exception.Message)
    }
    finally {
        Pop-Location -ErrorAction SilentlyContinue
    }

    Write-Log 'Reintentando gateway en 5 segundos.'
    Start-Sleep -Seconds 5
}