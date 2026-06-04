$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$desktopStopScript = Join-Path $scriptRoot 'desktop-app\stop-erp-desktop.ps1'

& $desktopStopScript