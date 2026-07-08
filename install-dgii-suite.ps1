param(
    [string]$ConfigPath = ".\install-config.json",
    [switch]$ForceDatabaseRecreate,
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"

function Get-ConfigValue {
    param(
        [object]$Config,
        [string]$Name,
        $DefaultValue
    )

    $property = $Config.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value -or $property.Value -eq "") {
        return $DefaultValue
    }

    return $property.Value
}

function Invoke-TerminalStep {
    param(
        [string]$Message,
        [scriptblock]$Action
    )

    Write-Host "`n==> $Message"
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "El paso fallo con codigo de salida ${LASTEXITCODE}: $Message"
    }
}

$rootPath = Split-Path -Parent $PSCommandPath
$odooStackPath = Join-Path $rootPath "odoo-dgii-stack"
$gatewayPath = Join-Path $rootPath "ecf-endpoints-service"
$resolvedConfigPath = Join-Path $rootPath $ConfigPath

if (-not (Test-Path $resolvedConfigPath)) {
    throw "No existe el archivo de configuracion: $resolvedConfigPath"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker no esta disponible en PATH."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js no esta disponible en PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm no esta disponible en PATH."
}

$config = Get-Content $resolvedConfigPath -Raw | ConvertFrom-Json

$databaseName = Get-ConfigValue $config "databaseName" "dgii_cliente"
$adminLogin = Get-ConfigValue $config "adminLogin" "admin@cliente.local"
$adminPassword = Get-ConfigValue $config "adminPassword" "admin123"
$companyName = Get-ConfigValue $config "companyName" "Mi Empresa SRL"
$companyVat = Get-ConfigValue $config "companyVat" "101010101"
$companyStreet = Get-ConfigValue $config "companyStreet" "Calle Principal #1"
$companyCity = Get-ConfigValue $config "companyCity" "Santo Domingo"
$gatewayPort = Get-ConfigValue $config "gatewayPort" 3000
$gatewayPublicBaseUrl = Get-ConfigValue $config "gatewayPublicBaseUrl" "http://localhost:3000"
$gatewaySoftwareName = Get-ConfigValue $config "gatewaySoftwareName" "Mi ECF Service"
$gatewaySoftwareVersion = Get-ConfigValue $config "gatewaySoftwareVersion" "1.0.0"
$gatewayBuyerRnc = Get-ConfigValue $config "gatewayBuyerRnc" "101010101"
$gatewayCertPath = Get-ConfigValue $config "gatewayCertPath" ""
$gatewayCertPassword = Get-ConfigValue $config "gatewayCertPassword" ""
$gatewayGenerateDemoCert = [bool](Get-ConfigValue $config "gatewayGenerateDemoCert" $true)
$gatewayDemoCertPath = Get-ConfigValue $config "gatewayDemoCertPath" "./storage/demo-certificate.p12"
$gatewayDemoCertPassword = Get-ConfigValue $config "gatewayDemoCertPassword" "demo123"
$odooGatewayUrl = Get-ConfigValue $config "odooGatewayUrl" "http://host.docker.internal:3000"

$gatewayEnvPath = Join-Path $gatewayPath ".env"
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
Set-Content -Path $gatewayEnvPath -Value $gatewayEnvContent -Encoding ASCII

if (-not $SkipNpmInstall) {
    Invoke-TerminalStep "Instalando dependencias del gateway" {
        Set-Location $gatewayPath
        npm install
    }
}

Invoke-TerminalStep "Levantando PostgreSQL y Odoo" {
    Set-Location $odooStackPath
    docker compose up -d
}

if ($ForceDatabaseRecreate) {
    Invoke-TerminalStep "Recreando base de datos $databaseName" {
        Set-Location $odooStackPath
        docker compose exec -T db psql -U odoo -d postgres -c "DROP DATABASE IF EXISTS $databaseName WITH (FORCE);"
        docker compose exec -T db psql -U odoo -d postgres -c "CREATE DATABASE $databaseName OWNER odoo;"
    }
}
else {
    $dbExists = & {
        Set-Location $odooStackPath
        docker compose exec -T db psql -U odoo -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$databaseName';"
    }

    if (-not ($dbExists | Out-String).Trim()) {
        Invoke-TerminalStep "Creando base de datos $databaseName" {
            Set-Location $odooStackPath
            docker compose exec -T db psql -U odoo -d postgres -c "CREATE DATABASE $databaseName OWNER odoo;"
        }
    }
}

$baseModuleList = "base,stock,sale_management,purchase,account,point_of_sale,delivery,website_sale"
$operationsModuleList = "web_ui_refresh_do,stock_scan_do,operations_ui_do"
$fiscalModuleList = "l10n_do_accounting,l10n_do_ecf_gateway"
$ecfTestModuleList = "ecf_test_lab_do"

Invoke-TerminalStep "Instalando modulos base en Odoo" {
    Set-Location $odooStackPath
    docker compose run --rm -T odoo odoo -c /etc/odoo/odoo.conf -d $databaseName -i $baseModuleList --without-demo=all --stop-after-init
}

Invoke-TerminalStep "Instalando modulos operativos y de interfaz" {
    Set-Location $odooStackPath
    docker compose run --rm -T odoo odoo -c /etc/odoo/odoo.conf -d $databaseName -i $operationsModuleList --without-demo=all --stop-after-init
}

$initialConfigScript = @"
company = env.company
admin = env.ref('base.user_admin')
country_do = env.ref('base.do')
admin.write({
    'login': '$adminLogin',
    'password': '$adminPassword',
})
admin.partner_id.write({
    'name': '$companyName',
    'email': '$adminLogin',
})
company.write({
    'name': '$companyName',
    'vat': '$companyVat',
    'street': '$companyStreet',
    'city': '$companyCity',
    'country_id': country_do.id,
})
env.cr.commit()
print('database', '$databaseName')
print('admin_login', '$adminLogin')
"@

Invoke-TerminalStep "Configurando empresa, usuario administrador y plan contable dominicano" {
    Set-Location $odooStackPath
    $initialConfigScript | docker compose run --rm -T odoo odoo shell -c /etc/odoo/odoo.conf -d $databaseName
}

Invoke-TerminalStep "Instalando modulos fiscales dominicanos" {
    Set-Location $odooStackPath
    docker compose run --rm -T odoo odoo -c /etc/odoo/odoo.conf -d $databaseName -i $fiscalModuleList --without-demo=all --stop-after-init
}

Invoke-TerminalStep "Instalando laboratorio de pruebas e-CF" {
    Set-Location $odooStackPath
    docker compose run --rm -T odoo odoo -c /etc/odoo/odoo.conf -d $databaseName -i $ecfTestModuleList --without-demo=all --stop-after-init
}

$postFiscalConfigScript = @"
company = env.company
if not company.chart_template:
    env['account.chart.template'].try_loading('do', company, install_demo=False)
journals = env['account.journal'].search([
    ('type', 'in', ('sale', 'purchase')),
    ('company_id', '=', company.id),
])
journals.write({'l10n_latam_use_documents': True})
env['ir.config_parameter'].sudo().set_param('l10n_do_ecf_gateway.url', '$odooGatewayUrl')
env.cr.commit()
print('database', '$databaseName')
print('gateway_url', '$odooGatewayUrl')
"@

Invoke-TerminalStep "Aplicando configuracion fiscal final y URL del gateway" {
    Set-Location $odooStackPath
    $postFiscalConfigScript | docker compose run --rm -T odoo odoo shell -c /etc/odoo/odoo.conf -d $databaseName
}

Write-Host "`nInstalacion completada."
Write-Host "Base de datos: $databaseName"
Write-Host "Usuario admin: $adminLogin"
Write-Host "Clave admin: $adminPassword"
Write-Host "Odoo: http://localhost:8069"
Write-Host "Gateway: $gatewayPublicBaseUrl"
Write-Host "`nPara iniciar el gateway localmente:"
Write-Host "Set-Location '$gatewayPath'; npm start"