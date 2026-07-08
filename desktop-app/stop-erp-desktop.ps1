$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$rootPath = Split-Path -Parent $scriptRoot
$odooPath = Join-Path $rootPath 'odoo-dgii-stack'
$runtimePath = Join-Path $env:LOCALAPPDATA 'DGII-ERP-Desktop'
$gatewayPidPath = Join-Path $runtimePath 'gateway-supervisor.pid'

function Stop-ProcessTree {
    param([int]$ProcessId)

    $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId }
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId $child.ProcessId
    }

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    }
}

if (Test-Path $gatewayPidPath) {
    $pidValue = Get-Content -Path $gatewayPidPath -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pidValue) {
        Stop-ProcessTree -ProcessId ([int]$pidValue)
    }
    Remove-Item -Path $gatewayPidPath -Force -ErrorAction SilentlyContinue
}

Push-Location $odooPath
try {
    & docker compose stop
}
finally {
    Pop-Location
}

Write-Host 'ERP detenido.'
