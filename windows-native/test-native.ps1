param(
    [switch]$StaticOnly
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$runtimePath = Join-Path $scriptRoot 'runtime'
$odooConfigPath = Join-Path $runtimePath 'odoo-native.conf'
$odooSourcePath = Join-Path $runtimePath 'odoo-17'
$alternateOdooSourcePath = Join-Path $runtimePath 'odoo-17-native'
$venvPython = Join-Path $runtimePath 'odoo-venv\Scripts\python.exe'

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param([string]$Name, [bool]$Ok, [string]$Detail)
    $checks.Add([pscustomobject]@{ Name = $Name; Ok = $Ok; Detail = $Detail }) | Out-Null
}

function Test-CommandExists {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Resolve-PostgresBinPath {
    $psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCommand -and (Test-PostgresBinPathComplete -BinPath (Split-Path -Parent $psqlCommand.Source))) {
        return (Split-Path -Parent $psqlCommand.Source)
    }

    $preferredBinPath = Join-Path $runtimePath 'postgresql-15\bin'
    if (Test-PostgresBinPathComplete -BinPath $preferredBinPath) {
        return $preferredBinPath
    }

    $searchRoots = @(
        (Join-Path $env:ProgramFiles 'PostgreSQL'),
        (Join-Path ${env:ProgramFiles(x86)} 'PostgreSQL')
    )

    foreach ($root in $searchRoots) {
        if (-not $root -or -not (Test-Path $root)) {
            continue
        }

        $binPath = Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName 'bin' } |
            Where-Object { Test-PostgresBinPathComplete -BinPath $_ } |
            Select-Object -First 1

        if ($binPath) {
            return $binPath
        }
    }

    return $null
}

function Test-PostgresBinPathComplete {
    param([string]$BinPath)

    if (-not $BinPath -or -not (Test-Path $BinPath)) {
        return $false
    }

    $installRoot = Split-Path -Parent $BinPath
    return (
        (Test-Path (Join-Path $BinPath 'psql.exe')) -and
        (Test-Path (Join-Path $BinPath 'initdb.exe')) -and
        (Test-Path (Join-Path $BinPath 'pg_ctl.exe')) -and
        (Test-Path (Join-Path $installRoot 'lib\dict_snowball.dll'))
    )
}

function Test-Python311 {
    $candidates = @(
        'py -3.11',
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
        (Join-Path $env:ProgramFiles 'Python311\python.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Python311\python.exe')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -eq 'py -3.11') {
            & cmd.exe /c "py -3.11 --version >nul 2>nul"
            if ($LASTEXITCODE -eq 0) {
                return $true
            }
        }
        elseif ($candidate -and (Test-Path $candidate)) {
            & $candidate --version *> $null
            if ($LASTEXITCODE -eq 0) {
                return $true
            }
        }
    }

    return $false
}

function Test-PostgresService {
    return [bool](Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue)
}

function Get-OdooSourcePath {
    if (Test-Path (Join-Path $odooSourcePath 'odoo-bin')) {
        return $odooSourcePath
    }

    if (Test-Path (Join-Path $alternateOdooSourcePath 'odoo-bin')) {
        return $alternateOdooSourcePath
    }

    return $odooSourcePath
}

function Test-OdooRuntime {
    param([string]$SourcePath)

    if ((-not (Test-Path $venvPython)) -or (-not (Test-Path (Join-Path $SourcePath 'odoo-bin')))) {
        return $false
    }

    $script = "import sys; sys.path.insert(0, r'$SourcePath'); import odoo, psycopg2, lxml, werkzeug, reportlab, PIL, sass, urllib3"
    & $venvPython -c $script *> $null
    return ($LASTEXITCODE -eq 0)
}

$resolvedOdooSourcePath = Get-OdooSourcePath

Add-Check 'PowerShell' $true $PSVersionTable.PSVersion.ToString()
Add-Check 'Git' (Test-CommandExists 'git') 'Necesario para descargar Odoo 17.'
Add-Check 'Node/npm' (Test-CommandExists 'npm.cmd') 'Necesario para gateway e-CF.'
Add-Check 'Python 3.11' (Test-Python311) 'Odoo 17 debe usar Python 3.11 en esta instalacion.'
Add-Check 'PostgreSQL psql' ([bool](Resolve-PostgresBinPath)) 'Necesario si se inicializa PostgreSQL local desde script.'
Add-Check 'PostgreSQL service' (Test-PostgresService) 'Necesario para Odoo local sin Docker.'
Add-Check 'Config nativa' (Test-Path (Join-Path $scriptRoot 'native-config.json')) 'Se crea desde native-config.example.json.'
$odooSourceOk = (Test-Path (Join-Path $odooSourcePath 'odoo-bin')) -or (Test-Path (Join-Path $alternateOdooSourcePath 'odoo-bin'))
$odooSourceDetail = if (Test-Path (Join-Path $odooSourcePath 'odoo-bin')) { $odooSourcePath } else { $alternateOdooSourcePath }
Add-Check 'Odoo source' $odooSourceOk $odooSourceDetail
Add-Check 'Odoo venv' (Test-Path $venvPython) $venvPython
Add-Check 'Odoo config' (Test-Path $odooConfigPath) $odooConfigPath
Add-Check 'Odoo runtime deps' (Test-OdooRuntime -SourcePath $resolvedOdooSourcePath) 'Importa Odoo y librerias criticas desde el source nativo.'

if (-not $StaticOnly) {
    try {
        $gateway = Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing -TimeoutSec 5
        Add-Check 'Gateway health' ($gateway.StatusCode -eq 200) 'http://localhost:3000/health'
    }
    catch {
        Add-Check 'Gateway health' $false $_.Exception.Message
    }

    try {
        $odoo = Invoke-WebRequest -Uri 'http://localhost:8069/web/login' -UseBasicParsing -TimeoutSec 5
        Add-Check 'Odoo login' ($odoo.StatusCode -ge 200 -and $odoo.StatusCode -lt 500) 'http://localhost:8069/web/login'
    }
    catch {
        Add-Check 'Odoo login' $false $_.Exception.Message
    }
}

$checks | Format-Table -AutoSize

if ($checks | Where-Object { -not $_.Ok }) {
    exit 1
}

exit 0