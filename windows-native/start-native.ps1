param(
    [switch]$SkipOpen
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$runtimePath = Join-Path $scriptRoot 'runtime'
$logsPath = Join-Path $runtimePath 'logs'
$odooPidPath = Join-Path $runtimePath 'odoo-supervisor.pid'
$gatewayPidPath = Join-Path $runtimePath 'gateway-supervisor.pid'
$odooUrl = 'http://localhost:8069/web/login'
$gatewayHealthUrl = 'http://localhost:3000/health'

New-Item -ItemType Directory -Force -Path $logsPath | Out-Null

function Write-Status {
    param([string]$Message)
    Write-Host ('[ERP Native] ' + $Message)
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
    param([string]$Url, [string]$Label, [int]$TimeoutSeconds)
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

function Start-Supervisor {
    param([string]$Name, [string]$ScriptPath, [string]$PidFile)
    if (Test-ProcessAlive -PidFile $PidFile) {
        Write-Status "$Name ya estaba iniciado."
        return
    }
    Write-Status "Iniciando $Name."
    $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-File', ('"{0}"' -f $ScriptPath)
    ) -WorkingDirectory $scriptRoot -WindowStyle Hidden -PassThru
    Set-Content -Path $PidFile -Value $process.Id -Encoding ASCII
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

Start-Supervisor -Name 'gateway nativo' -ScriptPath (Join-Path $scriptRoot 'run-gateway-supervised.ps1') -PidFile $gatewayPidPath
Start-Supervisor -Name 'Odoo nativo' -ScriptPath (Join-Path $scriptRoot 'run-odoo-supervised.ps1') -PidFile $odooPidPath

Wait-ForEndpoint -Url $gatewayHealthUrl -Label 'Gateway' -TimeoutSeconds 120
Wait-ForEndpoint -Url $odooUrl -Label 'Odoo' -TimeoutSeconds 240

if (-not $SkipOpen) {
    $browser = Get-AppBrowser
    if ($browser) {
        Start-Process -FilePath $browser -ArgumentList @("--app=$odooUrl", '--new-window') | Out-Null
    }
    else {
        Start-Process $odooUrl | Out-Null
    }
}

Write-Status 'ERP nativo listo.'