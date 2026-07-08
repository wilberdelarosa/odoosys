param(
    [int]$Port = 3069,
    [string]$HostName = '127.0.0.1',
    [string]$DataRoot = ''
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSCommandPath
$testDataRoot = if ($DataRoot) {
    $DataRoot
} else {
    Join-Path (Split-Path -Parent $scriptRoot) '.desktop-node-test'
}

& (Join-Path $scriptRoot 'start-dgii-node-desktop.ps1') -Port $Port -HostName $HostName -DataRoot $testDataRoot -NoBrowser

try {
    $runtime = Invoke-WebRequest -Uri "http://$HostName`:$Port/api/runtime/status" -UseBasicParsing -TimeoutSec 10 |
        Select-Object -ExpandProperty Content |
        ConvertFrom-Json

    if ($runtime.mode.dockerRequired -or $runtime.mode.odooRequired -or $runtime.mode.postgresRequired) {
        throw 'El launcher inicio un modo con dependencias externas no permitidas.'
    }

    [pscustomobject]@{
        Ok = $true
        Url = "http://$HostName`:$Port/"
        Node = $runtime.runtime.node
        RssMb = $runtime.memory.rssMb
        DockerRequired = $runtime.mode.dockerRequired
        OdooRequired = $runtime.mode.odooRequired
        PostgresRequired = $runtime.mode.postgresRequired
        StorageRoot = $runtime.mode.storageRoot
    } | Format-List
}
finally {
    & (Join-Path $scriptRoot 'stop-dgii-node-desktop.ps1') -DataRoot $testDataRoot
}
