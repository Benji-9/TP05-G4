# Documento técnico — Dashboard web de telemetría robótica (TP05-G4)

Desarrollo de Aplicaciones II — UADE. Robot: Unitree G1 y Go2 (el dashboard se adapta a ambos).

## 1. Arquitectura

Aplicación cliente-servidor con separación estricta: el **backend** (FastAPI, provisto por la cátedra, solo lectura) expone la telemetría; el **frontend** (`mi_dashboard/`, HTML/CSS/JS sin framework) la consume y la visualiza. Se comunican únicamente por la API; el frontend no sabe si del otro lado hay el simulador, el modo `--demo` o el robot real.

```
Simulador / robot ──► backend FastAPI (:8001) ──► navegador (dashboard)
                      /info  (REST, 1 vez)         dashboard.js (orquesta)
                      /ws    (WebSocket, ~10 Hz)   ├ websocket.js  (conexión)
                                                   ├ charts.js     (Chart.js)
                                                   └ csv-export.js (captura/CSV)
```

**Endpoints que consume el dashboard:** `GET /info` (modelo, tipo, nombres de motores y patas; se pide al iniciar y de nuevo si falla o si el `modelo` de los frames cambia) y `WS /ws` (el mismo JSON que `/telemetria`, ~10 veces por segundo). `GET /telemetria` se usa solo como **respaldo por polling** (cada 500 ms) cuando el WebSocket no logra conectar. El resto (`/motores`, `/imu`, `/bms`, `/fuerzas`, `/modo`) está disponible pero no se usa.

**Estructura del frontend**

| Archivo | Responsabilidad |
|---|---|
| `dashboard.js` | Orquestador: pide `/info`, arma la UI según el robot, recibe cada frame y actualiza un panel con una función por panel (`updateMotorTable`, `updateIMU`, `updateBMS`, `updateForces`). |
| `websocket.js` | `TelemetrySocket`: conexión WebSocket con reconexión automática (backoff 1 s → 10 s) y callbacks `onTelemetry` / `onStatus`. |
| `charts.js` | Gráficos con Chart.js: `ImuChart`, `TempHistoryChart`, `TempChart` (barras), y `tempLevel()` / `TEMP_COLORS`, la única definición del semáforo. |
| `csv-export.js` | `SampleCapture`: guarda copias de los frames y genera el CSV en el navegador. |
| `vendor/chart.umd.min.js` | Chart.js 4.4.7 (MIT), copia local para funcionar sin internet. |

## 2. Patrones de integración aplicados

- **Adapter** — el backend (`telemetry_adapter.py`) normaliza el LowState del Go2 (12 motores) y del G1 (29) en un mismo JSON (`motores`, `imu`, `bms`, `fuerzas`). El frontend solo se adapta con lo que dice `/info` (por ejemplo, pestañas de motores distintas por modelo).
- **Observer** — el dashboard se suscribe al flujo del servidor: `TelemetrySocket` notifica a sus suscriptores (`onTelemetry`, `onStatus`) cada vez que llega un frame.
- **Facade** — `/telemetria` (y el mensaje de `/ws`) es una interfaz única sobre todos los subsistemas del robot (motores, IMU, BMS, patas).

## 3. Decisiones de diseño por panel

- **Motores.** Tabla por grupo (G1: piernas/torso/brazos; Go2: una pata por pestaña) para que 29 motores sean legibles. Semáforo de temperatura como en electroSim: verde `< 40 °C`, amarillo `40–60 °C`, rojo `> 60 °C`, calculado por una sola función (`tempLevel`) que usan la tabla y el gráfico de barras. Además, un gráfico de líneas con la temperatura de cada motor del grupo activo. Se guarda el historial de *todos* los motores, para no perder datos al cambiar de pestaña.
- **IMU.** Roll, pitch y yaw numéricos más aceleraciones, y un gráfico de línea histórico.
- **BMS.** Carga (%) en un indicador circular, corriente en mA, temperatura y voltajes de celda (se muestran solo si el backend los envía).
- **Fuerzas.** Un diagrama por tipo de robot: cuatro patas (FR, FL, RR, RL) para el Go2 y dos pies para el G1; cada indicador marca apoyado / en el aire.
- **Gráficos históricos.** Búfer circular de 300 muestras (30 s a 10 Hz, igual al historial de electroSim): al llenarse se descarta la más antigua. Los gráficos se actualizan con `update('none')` sobre los mismos arreglos, sin recrear el componente.
- **Captura y CSV.** "Capturar" guarda una copia del frame actual; "Descargar CSV" arma el archivo en el navegador con `Blob` y `URL.createObjectURL`, sin pasar por el servidor. Columnas: `ts`, `modelo`, IMU (`roll…az`), BMS (`soc`, `corriente_mA`, `bms_temp`), por motor `_angulo`, `_vel`, `_torque`, `_temp`, y `fuerza_*`. Las columnas se adaptan al número de motores. El CSV **no** incluye los voltajes individuales de celda.
- **Pérdida de conexión.** Al caerse el WebSocket aparece un banner y los paneles se atenúan; se reintenta con backoff y todo vuelve a la normalidad al reconectar. Si `/info` falla no se inventa un modelo: se descartan los frames y se reintenta.
- **Seguridad.** Los nombres que llegan del backend se escapan antes de insertarse con `innerHTML`.

## 4. Polling vs WebSocket para este caso

| Criterio | REST polling (`/telemetria` cada 500 ms) | WebSocket (`/ws`, push a 10 Hz) |
|---|---|---|
| Latencia | Hasta 500 ms de espera + ida y vuelta; los datos pueden llegar ya "viejos". | El servidor envía apenas tiene el dato; la latencia es solo la de la red. |
| Carga del servidor | Una petición HTTP completa (cabeceras, conexión) por muestra y por cliente. | Una conexión persistente; cada muestra es un mensaje liviano. |
| Frecuencia de datos | Limitada por el intervalo (2 Hz con 500 ms). | 10 Hz, igual a la frecuencia interna de electroSim. |
| Complejidad | Muy simple: `fetch` + `setInterval`. | Mayor: hay que manejar estados de conexión y reconexión (resuelto en `TelemetrySocket`). |
| Caída del servidor | Cada fallo es una petición aislada. | Hay que detectar el cierre y reconectar. |

Elegimos **WebSocket** como canal principal porque los gráficos en vivo necesitan una frecuencia mayor que la del polling de 500 ms y porque evita una petición HTTP por muestra. El costo es la lógica de reconexión, que se concentró en una clase. Como **respaldo**, tras 3 intentos fallidos de WebSocket seguidos `TelemetrySocket` pasa a polling de `/telemetria` cada 500 ms (la consigna admite polling de hasta 500 ms), sigue reintentando el WebSocket y vuelve a él apenas conecta. Esto nos importó en la práctica: con `uvicorn` sin la librería `websockets`, `/ws` responde 404 y, sin respaldo, el dashboard quedaba sin datos; con el respaldo muestra "Conectado (polling)" a 2 Hz. No hicimos mediciones de latencia ni de carga: la comparación es cualitativa.

## 5. Datos reales y derivados

El simulador es cinemático (ver `API.md`). Ángulo y velocidad de motor y yaw son reales; torque, temperatura, roll/pitch y fuerzas de pata son **derivados** del movimiento, y la batería es **inventada**. Los umbrales del semáforo se aplican entonces sobre valores simulados; con el robot físico los números serían otros.

## 6. Alcance y seguridad

La API es de solo lectura: el dashboard no envía comandos y no se agregaron endpoints de control. En el paquete de la cátedra (`TP05_Desarrollo_de_Aplicaciones_II/`) hay una **extensión local** fuera del dashboard: manejar el robot con las flechas del teclado desde la ventana del simulador (`sim/arrancar.py`, `mundo.py`, `paseo.py`, `local.py`). No agrega endpoints a la API ni pasa por el dashboard. CORS abierto (`*`) solo es aceptable en una red de laboratorio cerrada.
