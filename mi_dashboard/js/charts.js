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

const MAX_HISTORY = 200;

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
            borderColor: MONO.gray300,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [2, 2],            // dotted
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
   Temperature Bar Chart — monochrome bars
   ────────────────────────────────────────────────────────────── */

export class TempChart {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Temp °C',
          data: [],
          backgroundColor: [],
          borderRadius: 1,
          barThickness: 12,
        }],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            max: 80,
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
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 9 },
              padding: 4,
            },
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  /**
   * Update with monochrome intensity based on temperature.
   * @param {Array<{nombre: string, temperatura: number}>} motors
   */
  update(motors) {
    const labels = motors.map(m => m.nombre);
    const data = motors.map(m => m.temperatura);
    const colors = data.map(t =>
      t > 60 ? MONO.black :
      t > 40 ? MONO.gray500 :
               MONO.gray300
    );

    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = data;
    this.chart.data.datasets[0].backgroundColor = colors;
    this.chart.update('none');
  }

  destroy() {
    this.chart.destroy();
  }
}
