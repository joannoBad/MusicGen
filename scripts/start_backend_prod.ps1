param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw "Python virtual environment was not found at $pythonExe"
}

Set-Location $backendDir

& $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port $Port
