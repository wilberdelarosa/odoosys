$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$runtimePath = Join-Path $scriptRoot 'runtime'
$logsPath = Join-Path $runtimePath 'logs'
$statusPath = Join-Path $runtimePath 'elevated-setup-status.json'
$logPath = Join-Path $logsPath 'elevated-setup.log'
$transcriptPath = Join-Path $logsPath 'elevated-setup-transcript.log'

New-Item -ItemType Directory -Force -Path $logsPath | Out-Null

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $logPath -Value "[$timestamp] $Message" -Encoding ASCII
}

function Save-Status {
    param(
        [string]$State,
        [string]$Step,
        [string]$Message
    )

    $payload = [pscustomobject]@{
        state = $State
        step = $Step
        message = $Message
        updatedAt = (Get-Date).ToString('s')
    }

    $payload | ConvertTo-Json | Set-Content -Path $statusPath -Encoding ASCII
}

function Invoke-Step {
    param(
        [string]$StepName,
        [scriptblock]$Action
    )

    Write-Log "START $StepName"
    Save-Status -State 'running' -Step $StepName -Message 'En progreso'
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "El paso fallo con codigo ${LASTEXITCODE}: $StepName"
    }
    Write-Log "DONE $StepName"
}

try {
    Set-Location $scriptRoot
    Start-Transcript -Path $transcriptPath -Append | Out-Null
    Save-Status -State 'running' -Step 'inicio' -Message 'Preparando instalacion nativa elevada'
    Write-Log 'Inicio de instalacion nativa elevada.'

    Invoke-Step -StepName 'install-postgres' {
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-native.ps1 -InstallPostgres
    }

    Invoke-Step -StepName 'test-static-after-postgres' {
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test-native.ps1 -StaticOnly
    }

    Invoke-Step -StepName 'initialize-db-and-modules' {
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-native.ps1 -SkipOdooClone -SkipNpmInstall -InitializeDatabase -ResetDatabase -InstallOdooModules
    }

    Invoke-Step -StepName 'start-native' {
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-native.ps1
    }

    Invoke-Step -StepName 'test-full-runtime' {
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\test-native.ps1
    }

    Save-Status -State 'success' -Step 'done' -Message 'Sistema nativo listo para pruebas'
    Write-Log 'Instalacion nativa elevada completada.'
}
catch {
    $errorMessage = $_.Exception.Message
    Save-Status -State 'failed' -Step 'error' -Message $errorMessage
    Write-Log ("ERROR " + $errorMessage)
    throw
}
finally {
    try {
        Stop-Transcript | Out-Null
    }
    catch {
    }
}
