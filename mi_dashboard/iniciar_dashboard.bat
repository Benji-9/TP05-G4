@echo off
REM ============================================================
REM   Sirve mi_dashboard/ por HTTP y abre el dashboard.
REM   Necesario porque dashboard.js usa "import" (ES modules),
REM   y los navegadores bloquean los modulos si el HTML se abre
REM   directo con doble clic (protocolo file://).
REM ============================================================
cd /d "%~dp0"

set PYTHON=
py -3 --version >nul 2>&1 && set PYTHON=py -3
if not defined PYTHON python --version >nul 2>&1 && set PYTHON=python
if not defined PYTHON (
  echo ERROR: no encuentro Python. Instalalo desde https://python.org
  pause
  exit /b 1
)

start "" http://localhost:5500/dashboard.html
%PYTHON% -m http.server 5500
