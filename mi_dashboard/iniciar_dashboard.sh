#!/usr/bin/env bash
# ============================================================
#   Sirve mi_dashboard/ por HTTP y abre el dashboard.
#   Necesario porque dashboard.js usa "import" (ES modules),
#   y los navegadores bloquean los modulos si el HTML se abre
#   directo con doble clic (protocolo file://).
# ============================================================
set -e
cd "$(dirname "$0")"

PYTHON=python3
command -v $PYTHON &> /dev/null || PYTHON=python

URL="http://localhost:5500/dashboard.html"
( sleep 1
  if command -v xdg-open &> /dev/null; then xdg-open "$URL"
  elif command -v open &> /dev/null; then open "$URL"
  fi
) &

$PYTHON -m http.server 5500
