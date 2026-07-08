param(
    [int]$Port = 3069,
    [string]$HostName = '127.0.0.1',
    [string]$DataRoot = '',
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $scriptRoot
$serviceRoot = Join-Path $repoRoot 'ecf-endpoints-service'
$appDataRoot = if ($DataRoot) { $DataRoot } else { Join-Path $env:APPDATA 'DGII-ECF-Node' }
$pidFile = Join-Path $appDataRoot 'dgii-ecf-node.pid'

function Invoke-Health {
    Invoke-WebRequest -Uri "http://$HostName`:$Port/health" -UseBasicParsing -TimeoutSec 5
}

New-Item -ItemType Directory -Force -Path $appDataRoot | Out-Null

if (Test-Path $pidFile) {
    $existingPid = Get-Content -Path $pidFile | Select-Object -First 1
    if ($existingPid -and (Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue)) {
        try {
            $health = Invoke-Health
            if ($health.StatusCode -eq 200) {
                if (-not $NoBrowser) {
                    Start-Process "http://$HostName`:$Port/"
                }
                Write-Host "DGII e-CF Node ya esta corriendo en http://$HostName`:$Port/"
                return
            }
        } catch {
            Stop-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

Push-Location $serviceRoot
try {
    if (-not (Test-Path 'dist\server.js')) {
        npm.cmd run build
    }

    $existingPort = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($existingPort) {
        throw "El puerto $Port ya esta ocupado. Ejecuta con -Port para usar otro puerto."
    }

    $env:PORT = [string]$Port
    $env:HOST = $HostName
    $env:PUBLIC_BASE_URL = "http://$HostName`:$Port"
    $env:STORAGE_ROOT = $appDataRoot
    $env:GENERATE_DEMO_CERT = 'true'

    $process = Start-Process -FilePath 'node' -ArgumentList @('dist/server.js') -WorkingDirectory $serviceRoot -WindowStyle Hidden -PassThru
    Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII

    $deadline = (Get-Date).AddSeconds(25)
    do {
        try {
            $health = Invoke-Health
            if ($health.StatusCode -eq 200) {
                break
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    } while ((Get-Date) -lt $deadline)

    if (-not $health -or $health.StatusCode -ne 200) {
        throw 'El servicio Node local no respondio /health.'
    }

    if (-not $NoBrowser) {
        Start-Process "http://$HostName`:$Port/"
    }

    Write-Host "DGII e-CF Node iniciado en http://$HostName`:$Port/"
    Write-Host "Datos locales: $appDataRoot"
    Write-Host "PID: $($process.Id)"
}
finally {
    Pop-Location
}
