#!/usr/bin/env bash
set -euo pipefail

url="${1:-http://localhost:3000/pos}"
browser=""

for candidate in google-chrome-stable google-chrome chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    browser="$candidate"
    break
  fi
done

if [[ -z "$browser" ]]; then
  printf 'No se encontro Google Chrome ni Chromium en este equipo.\n' >&2
  exit 1
fi

profile="${XDG_CONFIG_HOME:-$HOME/.config}/nexa-pos-print"
print_mode=()

if command -v lpstat >/dev/null 2>&1 && lpstat -d >/dev/null 2>&1; then
  print_mode+=(--kiosk-printing)
  printf 'Impresion directa habilitada para la impresora predeterminada.\n'
else
  printf 'No hay impresora predeterminada. El navegador mostrara el dialogo de impresion.\n'
fi

exec "$browser" --user-data-dir="$profile" "${print_mode[@]}" --app="$url"
