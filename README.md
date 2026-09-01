# TP05-G4 — Dashboard Web de Telemetría Robótica

**Materia:** Desarrollo de Aplicaciones II — Comisión Lunes TM — UADE
**Equipo:** [Nombres de los integrantes]
**Robot:** [G1 / Go2]

Dashboard web que consume la telemetría de un robot Unitree (simulado o real)
y la visualiza en vivo: motores, IMU, batería (BMS) y fuerzas por pata.

---

## Cómo correrlo

### 1. Requisitos
Seguir `TP05_Desarrollo_de_Aplicaciones_II/INSTALACION.md` (Python 3.10+ y
`pip install mujoco`, `fastapi`, `uvicorn`).

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
mi_dashboard/ → nuestro código (HTML/CSS/JS)
docs/ → documento técnico, capturas, CSV de ejemplo
TP05_.../ → paquete provisto por la cátedra (sin modificar)

---

## Paneles implementados

- [ ] Motores (temperatura con semáforo, ángulo, velocidad, torque)
- [ ] IMU (roll, pitch, yaw + gráfico histórico)
- [ ] BMS (batería, corriente, voltajes de celda)
- [ ] Fuerzas por pata (FR, FL, RR, RL)
- [ ] Captura de muestras
- [ ] Exportación CSV
- [ ] WebSocket (conexión principal, con reconexión automática)

---

## Stack

- **Frontend:** HTML5 + CSS3 + JavaScript (vanilla)
- **Gráficos:** Chart.js (CDN)
- **Comunicación:** WebSocket (`/ws`, ~10 Hz) con fallback a polling REST (`/telemetria`)
- **Backend:** provisto por la cátedra, sin modificaciones

---

## Nota sobre los datos

No todos los valores son mediciones reales del robot — algunos están derivados
del movimiento simulado (torque, temperatura, roll/pitch, fuerzas, batería).
Detalle completo en `docs/docTecnico.md` y en
`TP05_.../API.md`.

---

## Documento técnico

Ver [`docs/docTecnico.md`](docs/docTecnico.md) (actualmente vacío — pendiente
de completar).

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