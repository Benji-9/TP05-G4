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

### 2. Levantar el simulador + backend

```bash
cd TP05_Desarrollo_de_Aplicaciones_II
./INICIAR_TP05.sh      # Windows: INICIAR_TP05.bat
```

Va a preguntar qué robot usar (1 = G1, 2 = Go2) y mostrar la dirección del backend, por ejemplo:
TU DASHBOARD tiene que pegarle a:
http://10.0.0.5:8001

**Dejar esa ventana abierta.**

### 3. Abrir el dashboard

Abrir `mi_dashboard/dashboard.html` en el navegador. Pegar la dirección que
mostró la consola en el campo de configuración del dashboard.

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
Detalle completo en `docs/documento-tecnico.md` y en
`TP05_.../API.md`.

---

## Documento técnico

Ver [`docs/documento-tecnico.md`](docs/documento-tecnico.md).

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