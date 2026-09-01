@echo off
REM ============================================================
REM   TP05-G4 — Arranca TODO con un solo doble clic:
REM   dependencias (si faltan), simulador, backend y dashboard.
REM ============================================================
cd /d "%~dp0"

echo ============================================================
echo    TP05-G4 — Dashboard de Telemetria Robotica
echo ============================================================
echo.

REM ── Python ──
set PYTHON=
py -3 --version >nul 2>&1 && set PYTHON=py -3
if not defined PYTHON python --version >nul 2>&1 && set PYTHON=python
if not defined PYTHON (
  echo    ERROR: no encuentro Python. Instalalo desde https://python.org
  echo    y tildar "Add python.exe to PATH" durante la instalacion.
  pause
  exit /b 1
)

REM ── Dependencias (mujoco, fastapi, uvicorn) ──
%PYTHON% -c "import mujoco, fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
  echo    Faltan dependencias, instalando por primera vez...
  echo.
  call "%~dp0instalar_dependencias.bat"
  %PYTHON% -c "import mujoco, fastapi, uvicorn" >nul 2>&1
  if errorlevel 1 (
    echo.
    echo    ERROR: no se pudieron instalar las dependencias.
    echo    Revisa los mensajes de arriba.
    pause
    exit /b 1
  )
)

REM ── Robot ──
echo.
echo    Que robot queres usar?
echo.
echo      1)  G1   - robot humanoide (camina en dos patas)
echo      2)  Go2  - robot perro     (camina en cuatro patas)
echo.
set OPCION=1
set /p OPCION="   Elegi 1 o 2 [1]: "
set ROBOT=g1
if "%OPCION%"=="2" set ROBOT=go2
echo.

REM ── Dashboard: servido por HTTP (dashboard.js usa modulos ES, que los
REM    navegadores bloquean si se abre el HTML directo con doble clic). ──
echo    Abriendo el dashboard...
start "TP05 - Dashboard" /D "%~dp0mi_dashboard" cmd /k %PYTHON% -m http.server 5500
ping -n 2 127.0.0.1 >nul
start "" "http://localhost:5500/dashboard.html"

REM ── Simulador: ventana propia con /k, para que si tira un error se vea
REM    y la ventana no se cierre sola. ──
echo    Abriendo el simulador...
start "TP05 - Simulador (%ROBOT%)" /D "%~dp0TP05_Desarrollo_de_Aplicaciones_II\entorno" cmd /k %PYTHON% -m sim --robot %ROBOT% --materia tp05

REM ── Backend: reintenta en vez de esperar un tiempo fijo. El G1 (mas
REM    pesado que el Go2) puede tardar mas de 8s en cargar la primera vez,
REM    y un solo intento corto lo daba por perdido. ──
cd /d "%~dp0TP05_Desarrollo_de_Aplicaciones_II"
set INTENTOS=0
:reintentar_backend
set /a INTENTOS+=1
echo    Conectando el backend al simulador (intento %INTENTOS% de 4)...
%PYTHON% entorno\arrancar_api.py --robot %ROBOT%
if errorlevel 1 (
  if %INTENTOS% LSS 4 (
    echo    Todavia no respondio el simulador, reintentando...
    ping -n 4 127.0.0.1 >nul
    goto reintentar_backend
  ) else (
    echo.
    echo    ERROR: no se pudo conectar al simulador despues de varios intentos.
    echo    Revisa la ventana "TP05 - Simulador ..." por si quedo un error ahi.
    echo.
  )
)

echo.
pause
