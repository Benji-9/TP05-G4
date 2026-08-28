#!/usr/bin/env bash
set -e

echo "Instalando dependencias de TP05-G4..."

PYTHON=python3
if ! command -v $PYTHON &> /dev/null; then
    echo "ERROR: no se encontró python3. Instalalo desde python.org o con tu gestor de paquetes."
    exit 1
fi

$PYTHON -m pip install --user -r requirements.txt \
    --trusted-host pypi.org \
    --trusted-host files.pythonhosted.org

echo ""
echo "Verificando instalación..."
$PYTHON -c "import mujoco; print('  [OK] mujoco', mujoco.__version__)"
$PYTHON -c "import fastapi; print('  [OK] fastapi', fastapi.__version__)"
$PYTHON -c "import uvicorn; print('  [OK] uvicorn', uvicorn.__version__)"

echo ""
echo "Listo. Ahora podés correr ./TP05_Desarrollo_de_Aplicaciones_II/INICIAR_TP05.sh"