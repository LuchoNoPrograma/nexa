#!/usr/bin/env bash
set -euo pipefail

url="${1:-http://localhost:3000/pos}"

if ! command -v firefox >/dev/null 2>&1; then
  printf 'No se encontro Mozilla Firefox en este equipo.\n' >&2
  exit 1
fi

profile="${XDG_CONFIG_HOME:-$HOME/.config}/nexa-pos-firefox"
mkdir -p "$profile"
silent=false
default_printer=""

if command -v lpstat >/dev/null 2>&1 && default_line="$(lpstat -d 2>/dev/null)"; then
  default_printer="${default_line##* }"
  silent=true
fi

{
  printf 'user_pref("print.always_print_silent", %s);\n' "$silent"
  if [[ -n "$default_printer" ]]; then
    printf 'user_pref("print_printer", "%s");\n' "$default_printer"
  fi
} > "$profile/user.js"

if [[ -n "$default_printer" ]]; then
  printf 'Impresion directa: %s\n' "$default_printer"
else
  printf 'No hay impresora predeterminada. Firefox mostrara el dialogo de impresion.\n'
fi

exec firefox -no-remote -profile "$profile" --kiosk "$url"
