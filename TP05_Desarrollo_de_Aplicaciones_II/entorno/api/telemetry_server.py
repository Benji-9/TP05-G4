"""API HTTP y WebSocket de telemetria del TP05."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import API_CORS_ORIGINS, ROBOT_ACTIVO, ROBOTS, TELEMETRY_RATE_HZ, WEBSOCKET_RATE_HZ
from telemetry_adapter import adaptar_telemetria
from telemetry_reader import DemoReader


reader = DemoReader(ROBOT_ACTIVO)
modelo_activo = ROBOT_ACTIVO
modo_activo = "demo"
active_websockets: set[WebSocket] = set()
clientes_totales = 0

# Cliente de control manual (WASD), solo si arrancar_api.py lo conecto al
# simulador local. ESTO NO ES PARTE DEL CONTRATO DEL TP05 -- el enunciado pide
# un dashboard de solo lectura (ver API.md) -- es una extension para mover el
# robot en el simulador local, a pedido del alumno. Se queda en None (y las
# rutas de /control devuelven 503) contra el robot real o en modo --demo.
control = None


def configurar(lector, modelo: str, modo: str, control_cliente=None) -> None:
    """Inyecta el lector antes de que uvicorn comience a servir."""
    global reader, modelo_activo, modo_activo, control
    reader = lector
    modelo_activo = modelo
    modo_activo = modo
    control = control_cliente


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    reader.cerrar()


app = FastAPI(
    title="Unitree Telemetry API — Lab TP05",
    description="Telemetria en tiempo real de robots Unitree (solo lectura)",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=API_CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _telemetria(modelo: str | None = None) -> dict:
    solicitado = modelo or modelo_activo
    if solicitado not in ROBOTS:
        raise HTTPException(status_code=400, detail="Modelo valido: go2 o g1")
    if solicitado != modelo_activo:
        raise HTTPException(
            status_code=409,
            detail=f"El servidor esta conectado a {modelo_activo}, no a {solicitado}",
        )
    snapshot = reader.obtener_snapshot()
    if snapshot is None:
        raise HTTPException(status_code=503, detail="Aun no se recibio telemetria del robot")
    return adaptar_telemetria(snapshot, modelo_activo)


@app.get("/telemetria")
def telemetria(modelo: str | None = Query(default=None)):
    return _telemetria(modelo)


@app.get("/motores")
def motores():
    data = _telemetria()
    return {"modelo": modelo_activo, "n_motores": len(data["motores"]), "motores": data["motores"]}


@app.get("/imu")
def imu():
    return _telemetria()["imu"]


@app.get("/bms")
def bms():
    return _telemetria()["bms"]


@app.get("/fuerzas")
def fuerzas():
    return _telemetria()["fuerzas"]


@app.get("/info")
def info():
    cfg = ROBOTS[modelo_activo]
    return {
        "modelo": modelo_activo,
        "nombre": cfg["nombre"],
        "tipo": cfg["tipo"],
        "n_motores": cfg["n_motores"],
        "motores_nombres": cfg["motores_nombres"],
        "patas": cfg["patas"],
        "frecuencia_hz": TELEMETRY_RATE_HZ,
        "modo": modo_activo,
    }


@app.get("/modo")
def modo():
    return {"modo": modo_activo, "robot": modelo_activo}


# ---------------------------------------------------------------------------
# Control manual (WASD) -- FUERA del contrato del TP05.
#
# API.md es explicito: "no hay ningun endpoint que mueva el robot, este TP es
# de visualizacion". Estas rutas son una extension aparte para practicar con
# el simulador local; `control` solo esta seteado cuando arrancar_api.py se
# conecto al socket local del simulador (nunca contra el robot real ni en
# --demo), asi que no hay forma de que esto termine moviendo el robot fisico.
# ---------------------------------------------------------------------------

class ComandoMovimiento(BaseModel):
    vx: float = 0.0
    vy: float = 0.0
    vyaw: float = 0.0
    duracion: float = 0.4


def _requerir_control():
    if control is None:
        raise HTTPException(
            status_code=503,
            detail="Control manual no disponible (no es el simulador local, "
                   "o el backend arranco sin el).",
        )
    return control


@app.post("/control/mover")
def control_mover(cmd: ComandoMovimiento = Body(...)):
    cliente = _requerir_control()
    if cliente.Move(cmd.vx, cmd.vy, cmd.vyaw, cmd.duracion) != 0:
        raise HTTPException(status_code=502, detail="El simulador rechazo el movimiento")
    return {"ok": True}


@app.post("/control/detener")
def control_detener():
    cliente = _requerir_control()
    cliente.StopMove()
    return {"ok": True}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global clientes_totales
    await ws.accept()
    active_websockets.add(ws)
    clientes_totales += 1
    periodo = 1.0 / WEBSOCKET_RATE_HZ
    try:
        while True:
            snapshot = reader.obtener_snapshot()
            if snapshot is not None:
                await ws.send_json(adaptar_telemetria(snapshot, modelo_activo))
            try:
                evento = await asyncio.wait_for(ws.receive(), timeout=periodo)
                if evento["type"] == "websocket.disconnect":
                    break
            except TimeoutError:
                pass
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        active_websockets.discard(ws)


def estadisticas() -> dict:
    return {
        "snapshots": reader.mensajes_leidos,
        "clientes_totales": clientes_totales,
        "websockets_activos": len(active_websockets),
    }
