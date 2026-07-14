@echo off
setlocal

set "NEXA_URL=%~1"
if not defined NEXA_URL set "NEXA_URL=http://localhost:3000/pos"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-pos-firefox.ps1" "%NEXA_URL%"
