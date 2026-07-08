param(
    [switch]$StartAtLogin
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$desktopPath = [Environment]::GetFolderPath('Desktop')
$startupPath = [Environment]::GetFolderPath('Startup')
$startScript = Join-Path $scriptRoot 'start-native.ps1'
$stopScript = Join-Path $scriptRoot 'stop-native.ps1'
$powerShellExe = (Get-Command powershell.exe -ErrorAction Stop).Source

function Get-IconPath {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path ${env:ProgramFiles} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'),
        $powerShellExe
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }
    return $null
}

function New-Shortcut {
    param([string]$Path, [string]$TargetPath, [string]$Arguments, [string]$Description)
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($Path)
    $shortcut.TargetPath = $TargetPath
    $shortcut.Arguments = $Arguments
    $shortcut.WorkingDirectory = $scriptRoot
    $shortcut.Description = $Description
    $iconPath = Get-IconPath
    if ($iconPath) {
        $shortcut.IconLocation = $iconPath
    }
    $shortcut.Save()
}

$startArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
$stopArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$stopScript`""

New-Shortcut -Path (Join-Path $desktopPath 'ERP DGII Nativo.lnk') -TargetPath $powerShellExe -Arguments $startArgs -Description 'Abrir ERP DGII nativo sin Docker'
New-Shortcut -Path (Join-Path $desktopPath 'Detener ERP DGII Nativo.lnk') -TargetPath $powerShellExe -Arguments $stopArgs -Description 'Detener ERP DGII nativo'

if ($StartAtLogin) {
    New-Shortcut -Path (Join-Path $startupPath 'ERP DGII Nativo.lnk') -TargetPath $powerShellExe -Arguments $startArgs -Description 'Autoarranque ERP DGII nativo'
}

Write-Host 'Accesos directos nativos creados.'