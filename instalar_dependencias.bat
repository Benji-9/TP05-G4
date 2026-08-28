@echo off
echo Instalando dependencias de TP05-G4...

py -3 --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: no se encontro Python. Instalalo desde python.org
    echo y tildar "Add python.exe to PATH" durante la instalacion.
    pause
    exit /b 1
)

py -3 -m pip install --user -r requirements.txt ^
    --trusted-host pypi.org ^
    --trusted-host files.pythonhosted.org

echo.
echo Verificando instalacion...
py -3 -c "import mujoco; print('  [OK] mujoco', mujoco.__version__)"
py -3 -c "import fastapi; print('  [OK] fastapi', fastapi.__version__)"
py -3 -c "import uvicorn; print('  [OK] uvicorn', uvicorn.__version__)"

echo.
echo Listo. Ahora podes correr TP05_Desarrollo_de_Aplicaciones_II\INICIAR_TP05.bat
pause