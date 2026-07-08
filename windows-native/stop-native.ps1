$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$runtimePath = Join-Path $scriptRoot 'runtime'
$pidFiles = @(
    (Join-Path $runtimePath 'gateway-supervisor.pid'),
    (Join-Path $runtimePath 'odoo-supervisor.pid')
)

function Stop-ProcessTree {
    param([int]$ProcessId)
    $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId }
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId $child.ProcessId
    }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

foreach ($pidFile in $pidFiles) {
    if (Test-Path $pidFile) {
        $pidValue = Get-Content -Path $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($pidValue) {
            Stop-ProcessTree -ProcessId ([int]$pidValue)
        }
        Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Host 'ERP nativo detenido.'