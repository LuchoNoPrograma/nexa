param(
  [string]$Url = "http://localhost:3000/pos"
)

$firefoxCandidates = @(
  "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
  "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe",
  "$env:LocalAppData\Mozilla Firefox\firefox.exe"
)
$firefox = $firefoxCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $firefox) {
  Write-Error "No se encontro Mozilla Firefox en este equipo."
  exit 1
}

$defaultPrinter = Get-CimInstance Win32_Printer -Filter "Default=True" | Select-Object -First 1
$profile = Join-Path $env:LocalAppData "NEXA\FirefoxPrintProfile"
New-Item -ItemType Directory -Force -Path $profile | Out-Null

$silent = if ($defaultPrinter) { "true" } else { "false" }
$preferences = @(
  "user_pref(`"print.always_print_silent`", $silent);"
)

if ($defaultPrinter) {
  $printerName = $defaultPrinter.Name.Replace("\", "\\").Replace('"', '\"')
  $preferences += "user_pref(`"print_printer`", `"$printerName`");"
  Write-Host "Impresion directa: $($defaultPrinter.Name)"
} else {
  Write-Host "No hay impresora predeterminada. Firefox mostrara el dialogo de impresion."
}

Set-Content -Path (Join-Path $profile "user.js") -Value $preferences -Encoding ASCII
Start-Process -FilePath $firefox -ArgumentList @("-no-remote", "-profile", $profile, "--kiosk", $Url)
