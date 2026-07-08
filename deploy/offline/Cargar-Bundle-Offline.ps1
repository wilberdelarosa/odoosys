$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$imagesPath = Join-Path $scriptRoot 'images'

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker no esta disponible en PATH. Instala Docker Desktop antes de cargar el bundle.'
}

& cmd.exe /c "docker info >nul 2>nul"
if ($LASTEXITCODE -ne 0) {
    throw 'Docker no responde. Abre Docker Desktop y espera a que este listo.'
}

if (-not (Test-Path $imagesPath)) {
    throw ("No existe la carpeta de imagenes: " + $imagesPath + ". Crea el bundle primero con Crear-Bundle-Offline.ps1 en una maquina con internet.")
}

$tarFiles = Get-ChildItem -Path $imagesPath -Filter '*.tar' -ErrorAction SilentlyContinue
if (-not $tarFiles -or $tarFiles.Count -eq 0) {
    throw ("No se encontraron archivos .tar en " + $imagesPath)
}

$loaded = 0
foreach ($tar in $tarFiles) {
    Write-Step ("Cargando " + $tar.Name)
    & docker load -i $tar.FullName
    if ($LASTEXITCODE -ne 0) {
        throw ("No se pudo cargar la imagen desde " + $tar.Name)
    }
    $loaded++
}

Write-Host ''
Write-Host 'IMAGENES CARGADAS EN DOCKER LOCAL'
Write-Host (" Total: " + $loaded)
Write-Host ''
Write-Host 'Imagenes Odoo/PostgreSQL disponibles localmente:'
& docker images --format '{{.Repository}}:{{.Tag}} ({{.Size}})' | Where-Object { $_ -match '^(postgres|odoo|caddy|node):' }
Write-Host ''
Write-Host 'Ahora puedes instalar sin internet con install-dgii-suite.ps1.'
