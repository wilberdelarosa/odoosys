param(
    [switch]$SkipOpen,
    [switch]$UpdateModules
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$rootPath = Split-Path -Parent $scriptRoot
$odooPath = Join-Path $rootPath 'odoo-dgii-stack'
$gatewayPath = Join-Path $rootPath 'ecf-endpoints-service'
$runtimePath = Join-Path $env:LOCALAPPDATA 'DGII-ERP-Desktop'
$logsPath = Join-Path $runtimePath 'logs'
$gatewayPidPath = Join-Path $runtimePath 'gateway-supervisor.pid'
$configPath = Join-Path $scriptRoot 'desktop-app.config.json'
$odooUrl = 'http://localhost:8069/web/login'
$gatewayHealthUrl = 'http://localhost:3000/health'
$runMode = 'local'

if (Test-Path $configPath) {
    $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
    if ($config.PSObject.Properties['mode'] -and $config.mode) {
        $runMode = [string]$config.mode
    }
    if ($config.PSObject.Properties['odooUrl'] -and $config.odooUrl) {
        $odooUrl = [string]$config.odooUrl
    }
    if ($config.PSObject.Properties['gatewayHealthUrl'] -and $config.gatewayHealthUrl) {
        $gatewayHealthUrl = [string]$config.gatewayHealthUrl
    }
}

New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
New-Item -ItemType Directory -Force -Path $logsPath | Out-Null

function Write-Status {
    param([string]$Message)

    Write-Host ('[ERP Desktop] ' + $Message)
}

function Test-Endpoint {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    }
    catch {
        return $false
    }
}

function Wait-ForEndpoint {
    param(
        [string]$Url,
        [string]$Label,
        [int]$TimeoutSeconds = 180
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Endpoint -Url $Url) {
            Write-Status "$Label listo en $Url"
            return
        }
        Start-Sleep -Seconds 2
    }

    throw "Tiempo agotado esperando $Label en $Url"
}

function Get-DockerDesktopPath {
    $candidates = @(
        (Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'),
        (Join-Path ${env:LocalAppData} 'Docker\Docker\Docker Desktop.exe')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Test-DockerReady {
    & cmd.exe /c "docker info >nul 2>nul"
    return ($LASTEXITCODE -eq 0)
}

function Start-DockerEngine {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI no esta disponible en PATH.'
    }

    if (Test-DockerReady) {
        Write-Status 'Docker ya estaba disponible.'
        return
    }

    $dockerDesktop = Get-DockerDesktopPath
    if (-not $dockerDesktop) {
        throw 'No encontre Docker Desktop para iniciarlo automaticamente.'
    }

    Write-Status 'Iniciando Docker Desktop.'
    Start-Process -FilePath $dockerDesktop | Out-Null

    $deadline = (Get-Date).AddMinutes(5)
    while ((Get-Date) -lt $deadline) {
        if (Test-DockerReady) {
            Write-Status 'Docker Desktop ya responde.'
            return
        }
        Start-Sleep -Seconds 3
    }

    throw 'Docker Desktop no quedo listo a tiempo.'
}

function Test-ProcessAlive {
    param([string]$PidFile)

    if (-not (Test-Path $PidFile)) {
        return $false
    }

    $pidValue = Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $pidValue) {
        return $false
    }

    return [bool](Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue)
}

function Start-GatewaySupervisor {
    if (Test-Endpoint -Url $gatewayHealthUrl) {
        Write-Status 'Gateway ya esta respondiendo.'
        return
    }

    if (Test-ProcessAlive -PidFile $gatewayPidPath) {
        Write-Status 'Supervisor del gateway ya estaba iniciado; esperando respuesta.'
        Wait-ForEndpoint -Url $gatewayHealthUrl -Label 'Gateway' -TimeoutSeconds 90
        return
    }

    Write-Status 'Lanzando supervisor del gateway en segundo plano.'
    $supervisorScript = Join-Path $scriptRoot 'run-gateway-supervised.ps1'
    $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-File', $supervisorScript
    ) -WorkingDirectory $gatewayPath -WindowStyle Hidden -PassThru

    Set-Content -Path $gatewayPidPath -Value $process.Id -Encoding ASCII
    Wait-ForEndpoint -Url $gatewayHealthUrl -Label 'Gateway' -TimeoutSeconds 120
}

function Start-OdooStack {
    Write-Status 'Levantando stack de Odoo.'
    Push-Location $odooPath
    try {
        & docker compose up -d
        if ($LASTEXITCODE -ne 0) {
            throw 'docker compose up -d fallo.'
        }

        if ($UpdateModules) {
            Write-Status 'Actualizando modulos custom.'
            & docker exec -i dgii_odoo_app odoo -c /etc/odoo/odoo.conf --db_host=db --db_user=odoo --db_password=odoo -d dgii_demo -u stock_scan_do,operations_ui_do,ecf_test_lab_do --stop-after-init --no-http
            if ($LASTEXITCODE -ne 0) {
                throw 'La actualizacion de modulos Odoo fallo.'
            }
            & docker restart dgii_odoo_app | Out-Null
        }
    }
    finally {
        Pop-Location
    }

    Wait-ForEndpoint -Url $odooUrl -Label 'Odoo' -TimeoutSeconds 240
}

function Get-AppBrowser {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path ${env:ProgramFiles} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Open-ErpWindow {
    if ($SkipOpen) {
        return
    }

    $browser = Get-AppBrowser
    if ($browser) {
        Write-Status 'Abriendo Odoo como app de escritorio.'
        Start-Process -FilePath $browser -ArgumentList @("--app=$odooUrl", '--new-window') | Out-Null
        return
    }

    Write-Status 'No encontre Edge/Chrome; abriendo navegador por defecto.'
    Start-Process $odooUrl | Out-Null
}

if ($runMode -eq 'remote') {
    Write-Status 'Modo remoto activo: se omite Docker y gateway local.'
    Wait-ForEndpoint -Url $odooUrl -Label 'Odoo remoto' -TimeoutSeconds 120
}
else {
    Start-DockerEngine
    Start-GatewaySupervisor
    Start-OdooStack
}

Open-ErpWindow
Write-Status 'ERP listo para usarse.'
