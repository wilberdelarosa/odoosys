param(
    [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$rootPath = Split-Path -Parent $scriptRoot
$startScript = Join-Path $scriptRoot 'start-erp-desktop.ps1'
$stopScript = Join-Path $scriptRoot 'stop-erp-desktop.ps1'
$desktopPath = [Environment]::GetFolderPath('Desktop')
$startupPath = [Environment]::GetFolderPath('Startup')

function Get-IconPath {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path ${env:ProgramFiles} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    return $null
}

function New-Shortcut {
    param(
        [string]$Path,
        [string]$TargetPath,
        [string]$Arguments,
        [string]$WorkingDirectory,
        [string]$Description
    )

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($Path)
    $shortcut.TargetPath = $TargetPath
    $shortcut.Arguments = $Arguments
    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.Description = $Description
    $iconPath = Get-IconPath
    if ($iconPath) {
        $shortcut.IconLocation = $iconPath
    }
    $shortcut.Save()
}

$startArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
$stopArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$stopScript`""
$powerShellExe = (Get-Command powershell.exe -ErrorAction Stop).Source

New-Shortcut -Path (Join-Path $desktopPath 'ERP DGII Desktop.lnk') -TargetPath $powerShellExe -Arguments $startArgs -WorkingDirectory $rootPath -Description 'Abrir ERP DGII como app de escritorio'
New-Shortcut -Path (Join-Path $desktopPath 'Detener ERP DGII.lnk') -TargetPath $powerShellExe -Arguments $stopArgs -WorkingDirectory $rootPath -Description 'Detener ERP DGII local'
New-Shortcut -Path (Join-Path $startupPath 'ERP DGII Desktop.lnk') -TargetPath $powerShellExe -Arguments $startArgs -WorkingDirectory $rootPath -Description 'Autoarranque del ERP DGII'

Write-Host 'Accesos directos creados en Escritorio y Inicio.'

if ($StartNow) {
    & $powerShellExe -NoProfile -ExecutionPolicy Bypass -File $startScript
}
