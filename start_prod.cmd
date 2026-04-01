@echo off
setlocal
cd /d D:\projects\MusicGen
start "MusicGen Backend" powershell.exe -ExecutionPolicy Bypass -File "D:\projects\MusicGen\scripts\start_backend_prod.ps1"
start "MusicGen Frontend" powershell.exe -ExecutionPolicy Bypass -File "D:\projects\MusicGen\scripts\start_frontend_prod.ps1"
echo MusicGen production services are starting.
echo Frontend: http://127.0.0.1:3000
echo Backend:  http://127.0.0.1:8000/api/health
endlocal
