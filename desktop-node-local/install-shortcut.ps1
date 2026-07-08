param(
    [string]$ShortcutName = 'DGII e-CF Node Local'
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$startScript = Join-Path $scriptRoot 'start-dgii-node-desktop.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "$ShortcutName.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
$shortcut.WorkingDirectory = $scriptRoot
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Description = 'Inicia el facturador DGII e-CF local sin Docker, Odoo ni PostgreSQL.'
$shortcut.Save()

Write-Host "Acceso directo creado: $shortcutPath"
