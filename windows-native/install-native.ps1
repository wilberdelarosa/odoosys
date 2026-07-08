param(
    [string]$ConfigPath = '.\native-config.json',
    [switch]$InstallPrerequisites,
    [switch]$InstallPython,
    [switch]$InstallPostgres,
    [switch]$SkipPythonDeps,
    [switch]$SkipNpmInstall,
    [switch]$SkipOdooClone,
    [switch]$InitializeDatabase,
    [switch]$ResetDatabase,
    [switch]$InstallOdooModules
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$rootPath = Split-Path -Parent $scriptRoot
$runtimePath = Join-Path $scriptRoot 'runtime'
$odooSourcePath = Join-Path $runtimePath 'odoo-17'
$venvPath = Join-Path $runtimePath 'odoo-venv'
$odooConfigPath = Join-Path $runtimePath 'odoo-native.conf'
$odooDataPath = Join-Path $runtimePath 'odoo-data'
$gatewayPath = Join-Path $rootPath 'ecf-endpoints-service'
$customAddonsPath = Join-Path $rootPath 'odoo-dgii-stack\addons\custom'
$dominicanaAddonsPath = Join-Path $rootPath 'odoo-dgii-stack\addons\l10n-dominicana'
$resolvedConfigPath = Join-Path $scriptRoot $ConfigPath

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message"
}

function Get-ConfigValue {
    param([object]$Config, [string]$Name, $DefaultValue)
    $property = $Config.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value -or $property.Value -eq '') {
        return $DefaultValue
    }
    return $property.Value
}

function Invoke-Checked {
    param([string]$Message, [scriptblock]$Action)
    Write-Step $Message
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "El paso fallo con codigo ${LASTEXITCODE}: $Message"
    }
}

function Invoke-Python {
    param([string]$PythonCommand, [string[]]$Arguments)
    if (Test-Path $PythonCommand) {
        & $PythonCommand @Arguments
        return
    }

    $parts = $PythonCommand -split ' '
    $exe = $parts[0]
    $baseArgs = @()
    if ($parts.Length -gt 1) {
        $baseArgs = $parts[1..($parts.Length - 1)]
    }
    & $exe @baseArgs @Arguments
}

function Test-PythonRuntime {
    param([string]$Command)
    try {
        Invoke-Python -PythonCommand $Command -Arguments @('--version') *> $null
        return ($LASTEXITCODE -eq 0)
    }
    catch {
        return $false
    }
}

function Resolve-PythonCommand {
    if (Test-PythonRuntime -Command $pythonCommand) {
        return $pythonCommand
    }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
        (Join-Path $env:ProgramFiles 'Python311\python.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Python311\python.exe')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    return $pythonCommand
}

if (-not (Test-Path $resolvedConfigPath)) {
    Copy-Item -Path (Join-Path $scriptRoot 'native-config.example.json') -Destination $resolvedConfigPath
    Write-Host "Se creo configuracion inicial: $resolvedConfigPath"
}

$config = Get-Content -Path $resolvedConfigPath -Raw | ConvertFrom-Json
$databaseName = Get-ConfigValue $config 'databaseName' 'dgii_demo'
$databaseUser = Get-ConfigValue $config 'databaseUser' 'odoo'
$databasePassword = Get-ConfigValue $config 'databasePassword' 'odoo'
$databaseHost = Get-ConfigValue $config 'databaseHost' 'localhost'
$databasePort = Get-ConfigValue $config 'databasePort' 5432
$odooPort = Get-ConfigValue $config 'odooPort' 8069
$gatewayPort = Get-ConfigValue $config 'gatewayPort' 3000
$adminLogin = Get-ConfigValue $config 'adminLogin' 'admin@dgii-demo.local'
$adminPassword = Get-ConfigValue $config 'adminPassword' 'admin'
$companyName = Get-ConfigValue $config 'companyName' 'Empresa Demo SRL'
$companyVat = Get-ConfigValue $config 'companyVat' '101010101'
$companyStreet = Get-ConfigValue $config 'companyStreet' 'Calle Principal #1'
$companyCity = Get-ConfigValue $config 'companyCity' 'Santo Domingo'
$gatewayPublicBaseUrl = Get-ConfigValue $config 'gatewayPublicBaseUrl' "http://localhost:$gatewayPort"
$gatewaySoftwareName = Get-ConfigValue $config 'gatewaySoftwareName' 'Mi ECF Service'
$gatewaySoftwareVersion = Get-ConfigValue $config 'gatewaySoftwareVersion' '1.0.0'
$gatewayBuyerRnc = Get-ConfigValue $config 'gatewayBuyerRnc' '101010101'
$gatewayCertPath = Get-ConfigValue $config 'gatewayCertPath' ''
$gatewayCertPassword = Get-ConfigValue $config 'gatewayCertPassword' ''
$gatewayGenerateDemoCert = [bool](Get-ConfigValue $config 'gatewayGenerateDemoCert' $true)
$gatewayDemoCertPath = Get-ConfigValue $config 'gatewayDemoCertPath' './storage/demo-certificate.p12'
$gatewayDemoCertPassword = Get-ConfigValue $config 'gatewayDemoCertPassword' 'demo123'
$odooRepositoryUrl = Get-ConfigValue $config 'odooRepositoryUrl' 'https://github.com/odoo/odoo.git'
$odooBranch = Get-ConfigValue $config 'odooBranch' '17.0'
$odooZipUrl = Get-ConfigValue $config 'odooZipUrl' 'https://github.com/odoo/odoo/archive/refs/heads/17.0.zip'
$pythonCommand = Get-ConfigValue $config 'pythonCommand' 'py -3.11'
$pythonInstallerUrl = Get-ConfigValue $config 'pythonInstallerUrl' 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe'
$postgresInstallerUrl = Get-ConfigValue $config 'postgresInstallerUrl' 'https://get.enterprisedb.com/postgresql/postgresql-15.8-1-windows-x64.exe'
$postgresServiceName = Get-ConfigValue $config 'postgresServiceName' 'postgresql-x64-15'
$postgresSuperPassword = Get-ConfigValue $config 'postgresSuperPassword' 'postgres'
$postgresDataPath = Get-ConfigValue $config 'postgresDataPath' (Join-Path $runtimePath 'postgres-data')
$postgresInstallPath = Get-ConfigValue $config 'postgresInstallPath' (Join-Path $runtimePath 'postgresql-15')
$installersPath = Join-Path $runtimePath 'installers'

New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
New-Item -ItemType Directory -Force -Path $odooDataPath | Out-Null
New-Item -ItemType Directory -Force -Path $installersPath | Out-Null

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Save-Installer {
    param([string]$Url, [string]$FileName, [int64]$MinBytes = 1)
    $targetPath = Join-Path $installersPath $FileName
    $tempPath = "$targetPath.download"
    $needsDownload = $true
    if (Test-Path $targetPath) {
        $file = Get-Item $targetPath
        $needsDownload = ($file.Length -lt $MinBytes)
    }

    if ($needsDownload) {
        Remove-Item -Path $targetPath -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $tempPath -Force -ErrorAction SilentlyContinue
        Write-Step "Descargando $FileName"
        if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
            & curl.exe -L --fail --retry 5 --retry-delay 3 --output $tempPath $Url
            if ($LASTEXITCODE -ne 0) {
                throw "No se pudo descargar $Url"
            }
        }
        else {
            Invoke-WebRequest -Uri $Url -OutFile $tempPath -UseBasicParsing
        }
        Move-Item -Path $tempPath -Destination $targetPath -Force
    }

    $downloadedFile = Get-Item $targetPath
    if ($downloadedFile.Length -lt $MinBytes) {
        throw "Descarga incompleta para $FileName. Tamano: $($downloadedFile.Length) bytes."
    }

    return $targetPath
}

function Test-Python311 {
    return (Test-PythonRuntime -Command (Resolve-PythonCommand))
}

function Install-Python311 {
    if (Test-Python311) {
        Write-Step 'Python 3.11 ya esta disponible'
        return
    }

    $installerPath = Save-Installer -Url $pythonInstallerUrl -FileName 'python-3.11.9-amd64.exe' -MinBytes 20000000
    Invoke-Checked 'Instalando Python 3.11 para el usuario actual' {
        & $installerPath /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_launcher=1
    }
    $script:pythonCommand = Resolve-PythonCommand
}

function Resolve-PostgresBinPath {
    $psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCommand -and (Test-PostgresBinPathComplete -BinPath (Split-Path -Parent $psqlCommand.Source))) {
        return (Split-Path -Parent $psqlCommand.Source)
    }

    $preferredBinPath = Join-Path $postgresInstallPath 'bin'
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

function Refresh-PostgresCommandPath {
    $binPath = Resolve-PostgresBinPath
    if ($binPath) {
        $pathEntries = $env:Path -split ';'
        if ($pathEntries -notcontains $binPath) {
            $env:Path = "$binPath;$env:Path"
        }
    }
    return $binPath
}

function Get-PostgresService {
    $namedService = Get-Service -Name $postgresServiceName -ErrorAction SilentlyContinue
    if ($namedService) {
        return $namedService
    }

    return Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Test-PostgresClient {
    return [bool](Refresh-PostgresCommandPath)
}

function Test-PostgresService {
    return [bool](Get-PostgresService)
}

function Ensure-PostgresServiceFromClient {
    param([string]$PostgresBinPath)

    if (Get-PostgresService) {
        return
    }

    if (-not (Test-Admin)) {
        throw 'Existen binarios de PostgreSQL, pero falta registrar el servicio. Ejecuta PowerShell como administrador.'
    }

    $initdbCommand = Join-Path $PostgresBinPath 'initdb.exe'
    $pgCtlCommand = Join-Path $PostgresBinPath 'pg_ctl.exe'

    if (-not (Test-Path $initdbCommand) -or -not (Test-Path $pgCtlCommand)) {
        throw "No se encontraron initdb.exe/pg_ctl.exe en $PostgresBinPath."
    }

    if (-not (Test-Path (Join-Path $postgresDataPath 'PG_VERSION'))) {
        Remove-Item -Path $postgresDataPath -Recurse -Force -ErrorAction SilentlyContinue
        New-Item -ItemType Directory -Force -Path $postgresDataPath | Out-Null
        $passwordFile = Join-Path $runtimePath 'postgres-superuser.pw'
        Set-Content -Path $passwordFile -Value $postgresSuperPassword -Encoding ASCII
        try {
            Invoke-Checked 'Inicializando data directory PostgreSQL local' {
                & $initdbCommand -D $postgresDataPath -U postgres -A scram-sha-256 --pwfile $passwordFile --encoding UTF8 --locale C
            }
        }
        finally {
            Remove-Item -Path $passwordFile -Force -ErrorAction SilentlyContinue
        }
    }

    Invoke-Checked 'Ajustando permisos del data directory PostgreSQL' {
        & icacls.exe $postgresDataPath /grant 'NT AUTHORITY\NETWORK SERVICE:(OI)(CI)F' /T
    }

    Invoke-Checked 'Registrando servicio Windows PostgreSQL' {
        & $pgCtlCommand register -N $postgresServiceName -D $postgresDataPath -S auto -o "-p $databasePort" -U 'NT AUTHORITY\NetworkService'
    }
}

function Install-PostgreSql15 {
    $hasClient = Test-PostgresClient
    $postgresService = Get-PostgresService

    if ($hasClient -and -not $postgresService) {
        Ensure-PostgresServiceFromClient -PostgresBinPath (Refresh-PostgresCommandPath)
        $postgresService = Get-PostgresService
    }

    if ($hasClient -and $postgresService) {
        if ($postgresService.Status -ne 'Running') {
            if (-not (Test-Admin)) {
                throw 'El servicio PostgreSQL existe pero no esta iniciado. Ejecuta PowerShell como administrador para iniciarlo.'
            }

            Invoke-Checked 'Iniciando servicio PostgreSQL existente' {
                Start-Service -Name $postgresService.Name
            }
        }

        Write-Step 'PostgreSQL/psql y servicio ya estan disponibles'
        return
    }

    if (-not (Test-Admin)) {
        throw 'PostgreSQL requiere ejecutar PowerShell como administrador para instalar el servicio Windows.'
    }

    $installerPath = Save-Installer -Url $postgresInstallerUrl -FileName 'postgresql-15.8-1-windows-x64.exe' -MinBytes 200000000
    New-Item -ItemType Directory -Force -Path $postgresInstallPath | Out-Null
    Invoke-Checked 'Instalando PostgreSQL 15 como servicio Windows' {
        & $installerPath --mode unattended --unattendedmodeui none --superpassword $postgresSuperPassword --servicename $postgresServiceName --serverport $databasePort --prefix $postgresInstallPath --datadir $postgresDataPath --disable-components stackbuilder
    }

    if (-not (Refresh-PostgresCommandPath)) {
        throw 'PostgreSQL se instalo, pero no se encontro psql.exe en las rutas esperadas.'
    }

    Ensure-PostgresServiceFromClient -PostgresBinPath (Refresh-PostgresCommandPath)

    $postgresService = Get-PostgresService
    if (-not $postgresService) {
        throw 'PostgreSQL se instalo, pero no se encontro el servicio Windows esperado.'
    }

    if ($postgresService.Status -ne 'Running') {
        Invoke-Checked 'Iniciando servicio PostgreSQL instalado' {
            Start-Service -Name $postgresService.Name
        }
    }
}

function Clear-DirectoryIfPossible {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $true
    }

    Remove-Item -Path $Path -Recurse -Force -ErrorAction SilentlyContinue
    return -not (Test-Path $Path)
}

function Expand-ZipFile {
    param([string]$ArchivePath, [string]$DestinationPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ArchivePath, $DestinationPath)
}

function Install-OdooSourceFromZip {
    $archivePath = Save-Installer -Url $odooZipUrl -FileName 'odoo-17.0.zip' -MinBytes 50000000
    $extractPath = Join-Path $runtimePath 'odoo-zip-extract'

    if (-not (Clear-DirectoryIfPossible -Path $extractPath)) {
        $extractPath = Join-Path $runtimePath ("odoo-zip-extract-{0}" -f ([guid]::NewGuid().ToString('N')))
    }

    if (-not (Clear-DirectoryIfPossible -Path $odooSourcePath)) {
        throw "No se pudo preparar $odooSourcePath para extraer Odoo."
    }

    Write-Step 'Extrayendo Odoo 17 oficial'
    Expand-ZipFile -ArchivePath $archivePath -DestinationPath $extractPath

    $sourceRoot = Get-ChildItem -Path $extractPath -Directory | Where-Object {
        Test-Path (Join-Path $_.FullName 'odoo-bin')
    } | Select-Object -First 1

    if (-not $sourceRoot) {
        throw 'No se encontro odoo-bin dentro del ZIP de Odoo.'
    }

    Move-Item -Path $sourceRoot.FullName -Destination $odooSourcePath
    Remove-Item -Path $extractPath -Recurse -Force -ErrorAction SilentlyContinue
}

function Remove-OdooSourcePath {
    if (Clear-DirectoryIfPossible -Path $odooSourcePath) {
        return
    }

    $alternatePath = Join-Path $runtimePath 'odoo-17-native'
    Write-Step "No se pudo limpiar $odooSourcePath; usando $alternatePath"
    $script:odooSourcePath = $alternatePath

    if ((Test-Path $odooSourcePath) -and -not (Test-Path (Join-Path $odooSourcePath 'odoo-bin'))) {
        if (-not (Clear-DirectoryIfPossible -Path $odooSourcePath)) {
            throw "No se pudo limpiar $odooSourcePath. Cierra procesos que lo esten usando y reintenta."
        }
    }
}

function Use-ExistingOdooFallbackSource {
    $alternatePath = Join-Path $runtimePath 'odoo-17-native'
    if ((-not (Test-Path (Join-Path $odooSourcePath 'odoo-bin'))) -and (Test-Path (Join-Path $alternatePath 'odoo-bin'))) {
        Write-Step "Usando Odoo source existente en $alternatePath"
        $script:odooSourcePath = $alternatePath
    }
}

if ($InstallPrerequisites) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Invoke-Checked 'Instalando Git, Node.js, Python 3.11 y PostgreSQL 15 con winget' {
            winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
            winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
            winget install --id Python.Python.3.11 -e --accept-package-agreements --accept-source-agreements
            winget install --id PostgreSQL.PostgreSQL.15 -e --accept-package-agreements --accept-source-agreements
        }
    }
    else {
        Write-Step 'winget no esta disponible; usando instaladores directos'
        Install-Python311
        Install-PostgreSql15
    }
}

if ($InstallPython) {
    Install-Python311
}

if ($InstallPostgres) {
    Install-PostgreSql15
    if (-not ($InitializeDatabase -or $InstallOdooModules)) {
        return
    }
}

foreach ($requiredCommand in @('git', 'npm.cmd')) {
    if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
        throw "Falta el comando requerido: $requiredCommand"
    }
}

Invoke-Checked 'Habilitando rutas largas de Git para Odoo' {
    git config --global core.longpaths true
}

$pythonCommand = Resolve-PythonCommand

Invoke-Checked 'Verificando Python configurado' {
    Invoke-Python -PythonCommand $pythonCommand -Arguments @('--version')
}

Use-ExistingOdooFallbackSource

if (-not $SkipOdooClone) {
    if ((Test-Path $odooSourcePath) -and -not (Test-Path (Join-Path $odooSourcePath 'odoo-bin'))) {
        Write-Step 'Limpiando descarga incompleta de Odoo'
        Remove-OdooSourcePath
    }

    if (-not (Test-Path $odooSourcePath)) {
        Install-OdooSourceFromZip
    }
    else {
        Write-Step 'Odoo source ya existe, se omite clone'
    }
}

if (-not (Test-Path (Join-Path $odooSourcePath 'odoo-bin'))) {
    throw "No existe odoo-bin en $odooSourcePath. Ejecuta sin -SkipOdooClone o copia Odoo 17 ahi."
}

if (-not (Test-Path (Join-Path $venvPath 'Scripts\python.exe'))) {
    Invoke-Checked 'Creando entorno virtual Python para Odoo' {
        Invoke-Python -PythonCommand $pythonCommand -Arguments @('-m', 'venv', $venvPath)
    }
}

$venvPython = Join-Path $venvPath 'Scripts\python.exe'

if (-not $SkipPythonDeps) {
    Invoke-Checked 'Instalando dependencias Python de Odoo' {
        & $venvPython -m pip install --upgrade pip setuptools wheel
        & $venvPython -m pip install psycopg2-binary
        & $venvPython -m pip install -r (Join-Path $odooSourcePath 'requirements.txt')
    }
}

if (-not $SkipNpmInstall) {
    Invoke-Checked 'Instalando dependencias del gateway Node' {
        Push-Location $gatewayPath
        npm install
        Pop-Location
    }
}

$gatewayEnvContent = @"
PORT=$gatewayPort
PUBLIC_BASE_URL=$gatewayPublicBaseUrl
SOFTWARE_NAME=$gatewaySoftwareName
SOFTWARE_VERSION=$gatewaySoftwareVersion
BUYER_RNC=$gatewayBuyerRnc
CERT_PATH=$gatewayCertPath
CERT_PASSWORD=$gatewayCertPassword
GENERATE_DEMO_CERT=$($gatewayGenerateDemoCert.ToString().ToLowerInvariant())
DEMO_CERT_PATH=$gatewayDemoCertPath
DEMO_CERT_PASSWORD=$gatewayDemoCertPassword
"@
Set-Content -Path (Join-Path $gatewayPath '.env') -Value $gatewayEnvContent -Encoding ASCII

$addonsPath = @(
    (Join-Path $odooSourcePath 'addons'),
    $dominicanaAddonsPath,
    $customAddonsPath
) -join ','

$odooConfigContent = @"
[options]
admin_passwd = admin
db_host = $databaseHost
db_port = $databasePort
db_user = $databaseUser
db_password = $databasePassword
addons_path = $addonsPath
data_dir = $odooDataPath
http_port = $odooPort
proxy_mode = False
workers = 0
log_level = info
without_demo = all
"@
Set-Content -Path $odooConfigPath -Value $odooConfigContent -Encoding ASCII

if ($InitializeDatabase) {
    $postgresBinPath = Refresh-PostgresCommandPath
    if (-not $postgresBinPath) {
        throw 'Falta el comando requerido: psql'
    }

    $psqlCommand = Join-Path $postgresBinPath 'psql.exe'
    $createdbCommand = Join-Path $postgresBinPath 'createdb.exe'

    Invoke-Checked 'Creando usuario/base PostgreSQL si no existen' {
        $previousPgPassword = $env:PGPASSWORD
        $env:PGPASSWORD = $postgresSuperPassword
        try {
            $createUserSql = "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$databaseUser') THEN CREATE ROLE $databaseUser LOGIN CREATEDB PASSWORD '$databasePassword'; END IF; END `$`$;"
            & $psqlCommand -U postgres -h $databaseHost -p $databasePort -d postgres -c $createUserSql
            if ($ResetDatabase) {
                & $psqlCommand -U postgres -h $databaseHost -p $databasePort -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$databaseName' AND pid <> pg_backend_pid();"
                & $psqlCommand -U postgres -h $databaseHost -p $databasePort -d postgres -c "DROP DATABASE IF EXISTS `"$databaseName`";"
                if ($LASTEXITCODE -ne 0) {
                    throw "No se pudo resetear la base PostgreSQL $databaseName."
                }
            }

            $databaseExists = & $psqlCommand -U postgres -h $databaseHost -p $databasePort -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$databaseName'"
            if ($LASTEXITCODE -ne 0) {
                throw 'No se pudo verificar la existencia de la base PostgreSQL.'
            }

            if (($databaseExists | Out-String).Trim() -ne '1') {
                & $createdbCommand -U postgres -h $databaseHost -p $databasePort -O $databaseUser $databaseName
            }
        }
        finally {
            $env:PGPASSWORD = $previousPgPassword
        }
    }
}

if ($InstallOdooModules) {
    $baseModules = 'base,stock,sale_management,purchase,account,point_of_sale,delivery,website_sale'
    $operationsModules = 'web_ui_refresh_do,stock_scan_do,operations_ui_do'
    $fiscalModules = 'l10n_do_accounting,l10n_do_ecf_gateway'
    $testModules = 'ecf_test_lab_do'

    Invoke-Checked 'Instalando modulos base en Odoo nativo' {
        & $venvPython (Join-Path $odooSourcePath 'odoo-bin') -c $odooConfigPath -d $databaseName -i $baseModules --stop-after-init
    }
    Invoke-Checked 'Instalando modulos operativos custom' {
        & $venvPython (Join-Path $odooSourcePath 'odoo-bin') -c $odooConfigPath -d $databaseName -i $operationsModules --stop-after-init
    }

    $setupScript = @"
company = env.company
admin = env.ref('base.user_admin')
country_do = env.ref('base.do')
admin.write({'login': '$adminLogin', 'password': '$adminPassword'})
admin.partner_id.write({'name': '$companyName', 'email': '$adminLogin'})
company.write({
    'name': '$companyName',
    'vat': '$companyVat',
    'street': '$companyStreet',
    'city': '$companyCity',
    'country_id': country_do.id,
})
env['ir.config_parameter'].sudo().set_param('l10n_do_ecf_gateway.url', 'http://localhost:$gatewayPort')
env.cr.commit()
print('database', '$databaseName')
print('admin_login', '$adminLogin')
"@
    $setupPath = Join-Path $runtimePath 'post-install-setup.py'
    Set-Content -Path $setupPath -Value $setupScript -Encoding ASCII
    Invoke-Checked 'Configurando empresa, usuario y URL del gateway' {
        Get-Content -Path $setupPath | & $venvPython (Join-Path $odooSourcePath 'odoo-bin') shell -c $odooConfigPath -d $databaseName
    }

    Invoke-Checked 'Instalando modulos fiscales y laboratorio e-CF' {
        & $venvPython (Join-Path $odooSourcePath 'odoo-bin') -c $odooConfigPath -d $databaseName -i $fiscalModules,$testModules --stop-after-init
    }
}

Write-Host "`nInstalacion nativa preparada."
Write-Host "Config Odoo: $odooConfigPath"
Write-Host "Odoo source: $odooSourcePath"
Write-Host "Venv: $venvPath"
Write-Host "Gateway: http://localhost:$gatewayPort"
Write-Host "Odoo: http://localhost:$odooPort"