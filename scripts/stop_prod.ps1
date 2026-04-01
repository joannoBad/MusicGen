$ErrorActionPreference = "SilentlyContinue"

$ports = @(3000, 8000)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Write-Output "Stopped listeners on ports 3000 and 8000 if they were running."
