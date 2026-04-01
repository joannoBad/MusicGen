param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"
$npmCmd = "C:\Program Files\nodejs\npm.cmd"

if (-not (Test-Path -LiteralPath $npmCmd)) {
    throw "npm was not found at $npmCmd"
}

Set-Location $frontendDir
$env:Path = "C:\Program Files\nodejs;$env:Path"
$env:PORT = $Port

& $npmCmd run dev
