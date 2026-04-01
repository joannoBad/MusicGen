param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$backendScript = Join-Path $scriptDir "start_backend.ps1"
$frontendScript = Join-Path $scriptDir "start_frontend.ps1"

if (-not (Test-Path -LiteralPath $backendScript)) {
    throw "Backend start script was not found at $backendScript"
}

if (-not (Test-Path -LiteralPath $frontendScript)) {
    throw "Frontend start script was not found at $frontendScript"
}

Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$backendScript`" -Port $BackendPort"
Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$frontendScript`" -Port $FrontendPort"
