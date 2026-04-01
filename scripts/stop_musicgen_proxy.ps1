$ErrorActionPreference = "SilentlyContinue"
Get-Process caddy | Stop-Process -Force
