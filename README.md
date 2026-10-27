# TP05-G4 — Dashboard Web de Telemetría Robótica

**Materia:** Desarrollo de Aplicaciones II — Comisión Lunes TM — UADE
**Equipo:** ver [Integrantes](#integrantes)
**Robot:** G1 (29 motores) y Go2 (12 motores): el dashboard se arma según lo que informa `/info`

Dashboard web que consume la telemetría de un robot Unitree (simulado o real)
y la visualiza en vivo: motores, IMU, batería (BMS) y fuerzas por pata.

---

## Cómo correrlo

### 1. Requisitos
Seguir `TP05_Desarrollo_de_Aplicaciones_II/INSTALACION.md` (Python 3.10+ y
`pip install mujoco fastapi "uvicorn[standard]"`). **Importante:** si instalás
`uvicorn` a secas, falta la librería `websockets` y el dashboard queda sin datos
(`/ws` responde 404); `pip install -r requirements.txt` ya lo resuelve.

### 2. Levantar todo (Windows, un solo paso)

Doble clic en `iniciar_all.bat` (en la raíz del repo). Instala dependencias
si faltan, pregunta qué robot usar, y abre el simulador, el backend y el
dashboard en sus propias ventanas — no hace falta nada más.

Si preferís hacerlo a mano (o estás en macOS/Linux), seguí los pasos 2b y 3.

### 2b. Levantar el simulador + backend (manual)

**Opción 1:** doble clic en `TP05_Desarrollo_de_Aplicaciones_II/INICIAR_TP05.bat`
(elige robot interactivamente). **Dejar esa ventana abierta.**

**Opción 2:** manual, en dos terminales:

```bash
# Terminal 1 - Simulador
cd TP05_Desarrollo_de_Aplicaciones_II/entorno
python -m sim --robot g1 --materia tp05

# Terminal 2 - Backend API
cd TP05_Desarrollo_de_Aplicaciones_II
python entorno/arrancar_api.py --robot g1
```

### 3. Abrir el dashboard (manual — `iniciar_all.bat` ya hace esto solo)

`dashboard.js` usa módulos ES (`import`/`export`), y los navegadores
(Chrome/Edge) bloquean los módulos si abrís el HTML directo con doble clic
(`file://`). Por eso hay que servirlo por HTTP:

```bash
cd mi_dashboard
python -m http.server 5500
```

O doble clic en `mi_dashboard/iniciar_dashboard.bat` (Windows) /
`./mi_dashboard/iniciar_dashboard.sh` (macOS/Linux), que hacen lo mismo y
abren el navegador solos.

Abrir `http://localhost:5500/dashboard.html` y pegar la dirección que mostró
la consola del backend en el campo de configuración del dashboard.

Para probar rápido que el backend responde:
`http://<IP>:8001/telemetria`

---

## Estructura del repo
mi_dashboard/ → nuestro código (HTML/CSS/JS; `vendor/` trae Chart.js en local)
docs/ → documento técnico, capturas, CSV de ejemplo
TP05_.../ → paquete provisto por la cátedra. La API (`entorno/api/`) no se
            modificó; en el simulador (`entorno/sim/`) agregamos el manejo con
            las flechas del teclado en la ventana de MuJoCo (no toca la API)

---

## Paneles implementados

Implementados en el código (la verificación visual en navegador con G1 y Go2
es lo que falta tildar al entregar):

- [x] Motores (semáforo verde/amarillo/rojo, ángulo, velocidad, torque, gráficos de temperatura)
- [x] IMU (roll, pitch, yaw + gráfico histórico de 300 muestras)
- [x] BMS (batería, corriente en mA, temperatura, voltajes de celda si el backend los envía)
- [x] Fuerzas por pata (FR, FL, RR, RL en Go2; pies en G1)
- [x] Captura de muestras
- [x] Exportación CSV (en el navegador, sin pasar por el servidor)
- [x] WebSocket con reconexión automática y aviso visual de pérdida de conexión
- [ ] Capturas de pantalla y CSV de ejemplo en `docs/` (pendiente, ver #17)

---

## Stack

- **Frontend:** HTML5 + CSS3 + JavaScript (vanilla)
- **Gráficos:** Chart.js 4.4.7 (copia local en `mi_dashboard/vendor/`)
- **Comunicación:** WebSocket (`/ws`, ~10 Hz) para la telemetría y `GET /info` para
  conocer el robot. No hay respaldo por polling.
- **Backend:** API provista por la cátedra, sin modificaciones

---

## Nota sobre los datos

No todos los valores son mediciones reales del robot — algunos están derivados
del movimiento simulado (torque, temperatura, roll/pitch, fuerzas, batería).
Detalle completo en `docs/docTecnico.md` y en
`TP05_.../API.md`.

---

## Documento técnico

Ver [`docs/docTecnico.md`](docs/docTecnico.md).

---

## Integrantes

| Nombre |
|---|
| Castro, Bautista |
| Iriarte, Facundo |
| Llousas, Nicolas |
| Martinez, Benjamin | 
| Peralta, Santiago | 
| Quintieri, Miqueas | 