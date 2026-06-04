param(
    [string]$ConfigPath = '.\install-config.json',
    [switch]$ForceDatabaseRecreate,
    [switch]$SkipOpen
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$resolvedConfigPath = Join-Path $scriptRoot $ConfigPath
$exampleConfigPath = Join-Path $scriptRoot 'install-config.example.json'
$installScriptPath = Join-Path $scriptRoot 'install-dgii-suite.ps1'
$startScriptPath = Join-Path $scriptRoot 'start-local.ps1'

if (-not (Test-Path $resolvedConfigPath)) {
    Copy-Item -Path $exampleConfigPath -Destination $resolvedConfigPath
    Write-Host "Se creo $ConfigPath desde install-config.example.json"
}

$installArgs = @{
    ConfigPath = $ConfigPath
}

if ($ForceDatabaseRecreate) {
    $installArgs.ForceDatabaseRecreate = $true
}

& $installScriptPath @installArgs

$startArgs = @{}
if ($SkipOpen) {
    $startArgs.SkipOpen = $true
}

& $startScriptPath @startArgs

$config = Get-Content -Path $resolvedConfigPath -Raw | ConvertFrom-Json

Write-Host ''
Write-Host 'Credenciales demo:'
Write-Host ('- Base de datos: ' + $config.databaseName)
Write-Host ('- Usuario Odoo: ' + $config.adminLogin)
Write-Host ('- Clave Odoo: ' + $config.adminPassword)
Write-Host ('- Odoo: http://localhost:8069/web/login')
Write-Host ('- Gateway: http://localhost:' + $config.gatewayPort)