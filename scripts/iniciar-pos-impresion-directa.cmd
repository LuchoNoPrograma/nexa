@echo off
setlocal

set "NEXA_URL=%~1"
if not defined NEXA_URL set "NEXA_URL=http://localhost:3000/pos"

set "DEFAULT_PRINTER="
for /f "usebackq delims=" %%P in (`powershell.exe -NoProfile -Command "$p = @(Get-CimInstance Win32_Printer -Filter 'Default=True')[0]; if ($null -ne $p) { $p.Name }"`) do set "DEFAULT_PRINTER=%%P"

set "PRINT_MODE="
if defined DEFAULT_PRINTER set "PRINT_MODE=--kiosk-printing"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto launch

set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto launch

set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto launch

echo No se encontro Google Chrome en este equipo.
exit /b 1

:launch
if defined DEFAULT_PRINTER (
  echo Impresion directa: %DEFAULT_PRINTER%
) else (
  echo No hay impresora predeterminada. Chrome mostrara el dialogo de impresion.
)

start "" "%CHROME%" --user-data-dir="%LocalAppData%\NEXA\ChromePrintProfile" %PRINT_MODE% --app="%NEXA_URL%"
