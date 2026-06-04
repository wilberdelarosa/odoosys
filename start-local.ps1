param(
    [switch]$SkipOpen,
    [switch]$UpdateModules
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$desktopStartScript = Join-Path $scriptRoot 'desktop-app\start-erp-desktop.ps1'

$args = @{}
if ($SkipOpen) {
    $args.SkipOpen = $true
}
if ($UpdateModules) {
    $args.UpdateModules = $true
}

& $desktopStartScript @args