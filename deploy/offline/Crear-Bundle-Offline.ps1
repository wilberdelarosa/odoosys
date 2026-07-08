param(
    [switch]$IncludeVps
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$imagesPath = Join-Path $scriptRoot 'images'

# Imagenes minimas para el stack local (Odoo + PostgreSQL).
$images = @(
    @{ Name = 'postgres:15'; File = 'postgres-15.tar' },
    @{ Name = 'odoo:17.0';   File = 'odoo-17.0.tar' }
)

# Imagenes adicionales solo para el despliegue VPS con Caddy y gateway Docker.
if ($IncludeVps) {
    $images += @{ Name = 'caddy:2-alpine'; File = 'caddy-2-alpine.tar' }
    $images += @{ Name = 'node:22-alpine'; File = 'node-22-alpine.tar' }
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker no esta disponible en PATH. Instala Docker Desktop antes de crear el bundle.'
}

& cmd.exe /c "docker info >nul 2>nul"
if ($LASTEXITCODE -ne 0) {
    throw 'Docker no responde. Abre Docker Desktop y espera a que este listo.'
}

New-Item -ItemType Directory -Force -Path $imagesPath | Out-Null

$manifest = @()

foreach ($image in $images) {
    $targetTar = Join-Path $imagesPath $image.File

    Write-Step ("Descargando imagen " + $image.Name)
    & docker pull $image.Name
    if ($LASTEXITCODE -ne 0) {
        throw ("No se pudo descargar la imagen " + $image.Name)
    }

    Write-Step ("Guardando " + $image.Name + " -> " + $image.File)
    & docker save $image.Name -o $targetTar
    if ($LASTEXITCODE -ne 0) {
        throw ("No se pudo guardar la imagen " + $image.Name)
    }

    $fileInfo = Get-Item $targetTar
    $manifest += [PSCustomObject]@{
        image = $image.Name
        file  = $image.File
        bytes = $fileInfo.Length
    }
}

$manifestPath = Join-Path $imagesPath 'manifest.json'
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding ASCII

Write-Host ''
Write-Host 'BUNDLE OFFLINE CREADO'
Write-Host ("Carpeta: " + $imagesPath)
foreach ($entry in $manifest) {
    $mb = [math]::Round($entry.bytes / 1MB, 1)
    Write-Host (" - " + $entry.image + " (" + $mb + " MB) -> " + $entry.file)
}
Write-Host ''
Write-Host 'Copia esta carpeta a la maquina destino y ejecuta Cargar-Bundle-Offline.ps1 alli.'
