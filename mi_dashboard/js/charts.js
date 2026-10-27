/**
 * Chart.js wrapper — Minimalist Monochrome theme.
 * Uses only black, grays, and white. Lines distinguished by
 * weight and dash pattern instead of color.
 *
 * @module charts
 */

/* ── Monochrome Tokens ── */
const MONO = {
  black:    '#0a0a0a',
  gray700:  '#404040',
  gray500:  '#737373',
  gray300:  '#d4d4d4',
  gray200:  '#e5e5e5',
  gray100:  '#f5f5f5',
  white:    '#ffffff',
  text:     '#737373',
};

const MAX_HISTORY = 300;   // 30 s a 10 Hz — igual al historial de electroSim

/* ── Semáforo de temperatura (igual a electroSim) ── */
export const TEMP_COLORS = {
  ok:     '#4CAF50',   // verde    < 40 °C
  warn:   '#FFC107',   // amarillo 40–60 °C
  danger: '#F44336',   // rojo     > 60 °C
};

/** Nivel del semáforo: 'ok' | 'warn' | 'danger'. Única fuente de umbrales. */
export function tempLevel(t) {
  if (t < 40) return 'ok';
  if (t <= 60) return 'warn';
  return 'danger';
}

/**
 * Apply global Chart.js defaults for monochrome theme.
 */
export function applyChartDefaults() {
  Chart.defaults.color = MONO.text;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 10;
  Chart.defaults.font.weight = 400;
  Chart.defaults.animation = false;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.boxHeight = 1;
  Chart.defaults.plugins.legend.labels.padding = 16;
  Chart.defaults.plugins.legend.labels.font = { size: 10, weight: 400 };
}

/* ──────────────────────────────────────────────────────────────
   IMU Historical Chart — distinguished by dash pattern
   ────────────────────────────────────────────────────────────── */

export class ImuChart {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._labels = [];
    this._rollData = [];
    this._pitchData = [];
    this._yawData = [];

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: this._labels,
        datasets: [
          {
            label: 'Roll',
            data: this._rollData,
            borderColor: MONO.black,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [],               // solid
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Pitch',
            data: this._pitchData,
            borderColor: MONO.gray500,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [6, 3],            // dashed
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Yaw',
            data: this._yawData,
            borderColor: MONO.gray700,     // gray300 casi no se veía sobre blanco
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [2, 3],            // dotted
            pointRadius: 0,
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        scales: {
          x: {
            display: false,
          },
          y: {
            grid: {
              color: MONO.gray100,
              drawTicks: false,
            },
            border: {
              color: MONO.gray200,
            },
            ticks: {
              maxTicksLimit: 5,
              padding: 8,
            },
          },
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'start',
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      },
    });
  }

  /**
   * Push a new IMU data point.
   */
  push(ts, roll, pitch, yaw) {
    this._labels.push(ts.toFixed(1));
    this._rollData.push(roll);
    this._pitchData.push(pitch);
    this._yawData.push(yaw);

    if (this._labels.length > MAX_HISTORY) {
      this._labels.shift();
      this._rollData.shift();
      this._pitchData.shift();
      this._yawData.shift();
    }

    this.chart.update('none');
  }

  destroy() {
    this.chart.destroy();
  }
}

/* ──────────────────────────────────────────────────────────────
   Temperature History — una línea por motor del grupo activo
   ────────────────────────────────────────────────────────────── */

export class TempHistoryChart {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._labels = [];
    /** @type {Map<string, number[]>} nombre de motor → búfer circular */
    this._hist = new Map();

    this.chart = new Chart(canvas, {
      type: 'line',
      data: { labels: this._labels, datasets: [] },
      options: {
        elements: { point: { radius: 0 }, line: { borderWidth: 1.5, tension: 0.3 } },
        scales: {
          x: { display: false },
          y: {
            // Eje ajustado a los datos; 40 y 60 °C marcados con el semáforo
            grace: '10%',
            grid: {
              color: (ctx) => ctx.tick?.value === 60 ? TEMP_COLORS.danger
                : ctx.tick?.value === 40 ? TEMP_COLORS.warn
                : MONO.gray100,
              drawTicks: false,
            },
            border: { color: MONO.gray200 },
            ticks: { stepSize: 5, padding: 8 },
          },
        },
        plugins: { legend: { position: 'top', align: 'start' } },
        interaction: { intersect: false, mode: 'index' },
      },
    });
  }

  /**
   * Agrega una muestra de TODOS los motores (así el historial no se corta
   * al cambiar de pestaña). Búfer circular de MAX_HISTORY.
   */
  push(ts, allMotors) {
    this._labels.push(ts.toFixed(1));
    if (this._labels.length > MAX_HISTORY) this._labels.shift();

    for (const m of allMotors) {
      let buf = this._hist.get(m.nombre);
      if (!buf) this._hist.set(m.nombre, buf = []);
      buf.push(m.temperatura);
      if (buf.length > MAX_HISTORY) buf.shift();
    }
  }

  /** Muestra las curvas de los motores dados, sin recrear el chart. */
  show(activeMotors) {
    const names = activeMotors.map(m => m.nombre);
    const ds = this.chart.data.datasets;
    if (ds.length !== names.length || ds.some((d, i) => d.label !== names[i])) {
      ds.length = 0;
      names.forEach((name, i) => ds.push({
        label: name,
        data: this._hist.get(name) || [],
        borderColor: `hsl(${(i * 47) % 360} 55% 42%)`,
        backgroundColor: 'transparent',
        fill: false,
      }));
    }
    this.chart.update('none');
  }

  destroy() {
    this.chart.destroy();
  }
}
