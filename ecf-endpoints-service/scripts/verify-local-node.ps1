param(
    [int]$Port = 3300,
    [string]$HostName = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$projectRoot = Split-Path -Parent $scriptRoot
$storageRoot = Join-Path $projectRoot '.local-node-storage'
$pidFile = Join-Path $projectRoot '.local-node-verify.pid'

function Invoke-Json {
    param(
        [string]$Method = 'GET',
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = ''
    )

    $params = @{
        Uri = "http://$HostName`:$Port$Path"
        Method = $Method
        UseBasicParsing = $true
        TimeoutSec = 10
    }

    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Depth 20)
    }

    if ($Token) {
        $params.Headers = @{ Authorization = "Bearer $Token" }
    }

    $response = Invoke-WebRequest @params
    return $response.Content | ConvertFrom-Json
}

function Stop-StartedProcess {
    if (Test-Path $pidFile) {
        $startedPid = Get-Content -Path $pidFile | Select-Object -First 1
        if ($startedPid) {
            Stop-Process -Id ([int]$startedPid) -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }
}

Push-Location $projectRoot
try {
    npm.cmd run build

    if (Test-Path $storageRoot) {
        Remove-Item -LiteralPath $storageRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $storageRoot | Out-Null

    $existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($existing) {
        throw "El puerto $Port ya esta ocupado. Usa -Port con otro valor."
    }

    $env:PORT = [string]$Port
    $env:HOST = $HostName
    $env:PUBLIC_BASE_URL = "http://$HostName`:$Port"
    $env:STORAGE_ROOT = $storageRoot
    $env:GENERATE_DEMO_CERT = 'true'

    $process = Start-Process -FilePath 'node' -ArgumentList @('dist/server.js') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII

    $deadline = (Get-Date).AddSeconds(25)
    do {
        try {
            $health = Invoke-Json -Path '/health'
            if ($health.ok) {
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    } while ((Get-Date) -lt $deadline)

    if (-not $health.ok) {
        throw 'El servicio Node local no respondio /health.'
    }

    $login = Invoke-Json -Method 'POST' -Path '/api/auth/login' -Body @{
        username = 'admin'
        password = 'admin123'
    }
    $token = $login.token
    if (-not $token) {
        throw 'No se pudo obtener token de sesion local.'
    }

    if ($login.user.mustChangePassword) {
        $changed = Invoke-Json -Method 'POST' -Path '/api/auth/change-password' -Token $token -Body @{
            currentPassword = 'admin123'
            newPassword = 'admin12345'
        }
        if ($changed.user.mustChangePassword) {
            throw 'La clave inicial no pudo actualizarse.'
        }
        $relogin = Invoke-Json -Method 'POST' -Path '/api/auth/login' -Body @{
            username = 'admin'
            password = 'admin12345'
        }
        $token = $relogin.token
    }

    $dashboard = Invoke-Json -Path '/api/dashboard' -Token $token
    if (-not $dashboard.customers -or -not $dashboard.products) {
        throw 'Dashboard sin cliente/producto demo.'
    }

    $sequence = Invoke-Json -Method 'POST' -Path '/api/fiscal-sequences' -Token $token -Body @{
        documentType = 'E32'
        prefix = 'E32'
        nextNumber = 1
        endNumber = 25
        expirationDate = '2026-12-31'
        description = 'Factura de consumo electronica verificacion local'
    }
    if ($sequence.documentType -ne 'E32') {
        throw 'No se pudo crear la secuencia fiscal E32 en Node.'
    }

    $invoice = Invoke-Json -Method 'POST' -Path '/api/invoices' -Token $token -Body @{
        customerId = $dashboard.customers[0].id
        documentType = 'E32'
        items = @(@{ productId = $dashboard.products[0].id; cantidad = 1 })
    }

    $issued = Invoke-Json -Method 'POST' -Path "/api/invoices/$($invoice.id)/issue-ecf" -Token $token -Body @{}
    if (-not ($issued.invoice.encf -like 'E32*')) {
        throw 'La factura emitida no genero e-NCF E32 desde la secuencia Node.'
    }
    if (-not ($issued.xml.ecf -like '*<Signature*')) {
        throw 'El XML e-CF no fue firmado.'
    }

    $payment = Invoke-Json -Method 'POST' -Path "/api/invoices/$($invoice.id)/payments" -Token $token -Body @{
        amount = $issued.invoice.balanceDue
        method = 'transferencia'
        reference = 'verify-local-node'
    }
    if ($payment.invoice.paymentStatus -ne 'pagada' -or $payment.invoice.balanceDue -ne 0) {
        throw 'El cobro local no actualizo el saldo de la factura.'
    }

    $accounting = Invoke-Json -Path '/api/accounting/summary' -Token $token
    if (-not $accounting.accounting.balanced -or $accounting.accounting.entries.Count -lt 2) {
        throw 'La contabilidad local no quedo balanceada despues de emitir y cobrar.'
    }

    $tests = Invoke-Json -Method 'POST' -Path '/api/precertification/run' -Token $token -Body @{}
    $failed = @($tests.results | Where-Object { -not $_.ok -and $_.name -ne 'URLs HTTPS para DGII' })
    if ($failed.Count -gt 0) {
        throw ('Pruebas de precertificacion fallaron: ' + (($failed | ForEach-Object { $_.name }) -join ', '))
    }

    $runtime = Invoke-Json -Path '/api/runtime/status' -Token $token
    $processInfo = Get-Process -Id $process.Id

    [pscustomobject]@{
        Ok = $true
        Url = "http://$HostName`:$Port"
        Pid = $process.Id
        Node = $runtime.runtime.node
        RssMb = $runtime.memory.rssMb
        HeapUsedMb = $runtime.memory.heapUsedMb
        WorkingSetMb = [math]::Round($processInfo.WorkingSet64 / 1MB, 2)
        PrivateMb = [math]::Round($processInfo.PrivateMemorySize64 / 1MB, 2)
        DockerRequired = $runtime.mode.dockerRequired
        OdooRequired = $runtime.mode.odooRequired
        PostgresRequired = $runtime.mode.postgresRequired
        StorageRoot = $runtime.mode.storageRoot
        Invoice = $issued.invoice.encf
        FiscalSequence = $sequence.documentType
        PaymentStatus = $payment.invoice.paymentStatus
        BalanceDue = $payment.invoice.balanceDue
        AccountingBalanced = $accounting.accounting.balanced
        JournalEntries = $accounting.accounting.entries.Count
        PrecertificationChecks = $tests.results.Count
    } | Format-List
}
finally {
    Stop-StartedProcess
    Pop-Location
}
