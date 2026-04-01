param()

$ErrorActionPreference = "Stop"

$caddyExe = 'C:\Users\irina\AppData\Local\Microsoft\WinGet\Packages\CaddyServer.Caddy_Microsoft.Winget.Source_8wekyb3d8bbwe\caddy.exe'
$config = 'd:\projects\MusicGen\deploy\Caddyfile.windows-local'

if (-not (Test-Path -LiteralPath $caddyExe)) {
    throw "Caddy executable was not found at $caddyExe"
}

if (-not (Test-Path -LiteralPath $config)) {
    throw "Caddy config was not found at $config"
}

Start-Process -WindowStyle Hidden -FilePath $caddyExe -ArgumentList @('run', '--config', $config)
