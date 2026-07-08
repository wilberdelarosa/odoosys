param(
    [string]$Executable = "",
    [switch]$SkipSystemTests
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$repositoryRoot = Split-Path -Parent $projectRoot
if (-not $Executable) {
    $Executable = Join-Path $projectRoot 'src-tauri\target\release\dgii-ecf-desktop.exe'
}
$Executable = (Resolve-Path $Executable).Path
$storageRoot = Join-Path $env:TEMP ("dgii-tauri-test-" + [guid]::NewGuid().ToString('N'))
$appProcess = $null
$backendProcess = $null
$secondInstance = $null

try {
    New-Item -ItemType Directory -Path $storageRoot | Out-Null
    $env:DGII_ECF_STORAGE_ROOT = $storageRoot
    $appProcess = Start-Process -FilePath $Executable -WorkingDirectory (Split-Path -Parent $Executable) -PassThru

    $deadline = (Get-Date).AddSeconds(35)
    $port = $null
    while ((Get-Date) -lt $deadline -and -not $port) {
        Start-Sleep -Milliseconds 400
        $backendProcess = Get-CimInstance Win32_Process |
            Where-Object { $_.ParentProcessId -eq $appProcess.Id -and $_.Name -eq 'ecf-service.exe' } |
            Select-Object -First 1
        if ($backendProcess) {
            $port = Get-NetTCPConnection -State Listen -OwningProcess $backendProcess.ProcessId -ErrorAction SilentlyContinue |
                Select-Object -First 1 -ExpandProperty LocalPort
        }
    }

    if (-not $port) {
        throw 'El shell Tauri no inicio el backend autonomo.'
    }

    $secondInstance = Start-Process -FilePath $Executable -WorkingDirectory (Split-Path -Parent $Executable) -PassThru
    if (-not $secondInstance.WaitForExit(10000)) {
        throw 'La segunda instancia no fue rechazada.'
    }
    $backendCount = @(Get-CimInstance Win32_Process |
        Where-Object { $_.ParentProcessId -eq $appProcess.Id -and $_.Name -eq 'ecf-service.exe' }).Count
    if ($backendCount -ne 1) {
        throw "La instancia unica dejo $backendCount procesos backend."
    }

    $health = Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 5
    $page = Invoke-WebRequest "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 5
    if (-not $SkipSystemTests) {
        $env:TEST_BASE_URL = "http://127.0.0.1:$port"
        npm.cmd --prefix (Join-Path $repositoryRoot 'ecf-endpoints-service') run test:system
        if ($LASTEXITCODE -ne 0) {
            throw 'La prueba funcional contra Tauri fallo.'
        }
    }

    if (-not (Test-Path (Join-Path $storageRoot 'facturador.sqlite'))) {
        throw 'El runtime Tauri no creo la base SQLite en la ubicacion configurada.'
    }

    $children = @(Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $appProcess.Id })
    $processIds = @($appProcess.Id) + @($children.ProcessId)
    $workingSet = (Get-Process -Id $processIds -ErrorAction SilentlyContinue |
        Measure-Object WorkingSet64 -Sum).Sum

    $closed = $appProcess.CloseMainWindow()
    if (-not $closed -or -not $appProcess.WaitForExit(15000)) {
        throw 'La aplicacion Tauri no cerro normalmente.'
    }
    Start-Sleep -Seconds 2
    if (Get-Process -Id $backendProcess.ProcessId -ErrorAction SilentlyContinue) {
        throw 'El backend quedo activo despues de cerrar la aplicacion.'
    }

    [pscustomobject]@{
        ok = $health.ok
        uiStatus = $page.StatusCode
        port = $port
        workingSetMb = [math]::Round($workingSet / 1MB, 2)
        sqlite = $true
        singleInstance = $true
        gracefulClose = $true
        backendStopped = $true
    } | ConvertTo-Json
}
finally {
    if ($appProcess -and -not $appProcess.HasExited) {
        Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($backendProcess) {
        Stop-Process -Id $backendProcess.ProcessId -Force -ErrorAction SilentlyContinue
    }
    if ($secondInstance -and -not $secondInstance.HasExited) {
        Stop-Process -Id $secondInstance.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:\DGII_ECF_STORAGE_ROOT -ErrorAction SilentlyContinue
    Remove-Item Env:\TEST_BASE_URL -ErrorAction SilentlyContinue
    if (Test-Path $storageRoot) {
        $resolvedStorage = (Resolve-Path $storageRoot).Path
        $tempRoot = [IO.Path]::GetFullPath($env:TEMP)
        if (-not $resolvedStorage.StartsWith($tempRoot)) {
            throw "La ruta temporal no esta dentro de TEMP: $resolvedStorage"
        }
        Remove-Item -LiteralPath $resolvedStorage -Recurse -Force
    }
}
