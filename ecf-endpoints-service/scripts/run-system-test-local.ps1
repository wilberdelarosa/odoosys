param(
    [int]$Port = 3400,
    [string]$HostName = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$projectRoot = Split-Path -Parent $scriptRoot
$storageRoot = Join-Path $env:TEMP ("ecf-system-test-" + [guid]::NewGuid().ToString('N'))
$pidFile = Join-Path $storageRoot 'server.pid'

function Stop-StartedProcess {
    if (Test-Path $pidFile) {
        $startedPid = Get-Content -Path $pidFile | Select-Object -First 1
        if ($startedPid) {
            Stop-Process -Id ([int]$startedPid) -ErrorAction SilentlyContinue
        }
    }
}

Push-Location $projectRoot
try {
    if (-not (Test-Path 'dist\server.js')) {
        npm.cmd run build
    }

    New-Item -ItemType Directory -Force -Path $storageRoot | Out-Null

    $env:PORT = [string]$Port
    $env:HOST = $HostName
    $env:PUBLIC_BASE_URL = "http://$HostName`:$Port"
    $env:STORAGE_ROOT = $storageRoot
    $env:GENERATE_DEMO_CERT = 'true'

    $process = Start-Process -FilePath 'node' -ArgumentList @('dist/server.js') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII

    $deadline = (Get-Date).AddSeconds(25)
    do {
        try {
            $health = Invoke-WebRequest -Uri "http://$HostName`:$Port/health" -UseBasicParsing -TimeoutSec 5
            if ($health.StatusCode -eq 200) {
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    } while ((Get-Date) -lt $deadline)

    if (-not $health -or $health.StatusCode -ne 200) {
        throw 'Servidor temporal no respondio /health.'
    }

    $env:TEST_BASE_URL = "http://$HostName`:$Port"
    npm.cmd run test:system
}
finally {
    Stop-StartedProcess
    Pop-Location
}
