/**
 * Dashboard orchestrator — main entry point.
 * Fetches robot info, builds dynamic DOM, connects via WebSocket,
 * and updates all panels at ~10 Hz.
 *
 * @module dashboard
 */

import { TelemetrySocket } from './websocket.js';
import { applyChartDefaults, ImuChart, TempChart } from './charts.js';
import { SampleCapture } from './csv-export.js';

/* ══════════════════════════════════════════════════════════════
   Constants & State
   ══════════════════════════════════════════════════════════════ */

const DEFAULT_BASE = 'http://127.0.0.1:8001';
const STORAGE_KEY = 'tp05_dashboard_base_url';

/** Motor groups by robot type */
const MOTOR_GROUPS = {
  g1: [
    { id: 'legs',  label: 'Piernas', range: [0, 12] },
    { id: 'torso', label: 'Torso',   range: [12, 15] },
    { id: 'arms',  label: 'Brazos',  range: [15, 29] },
  ],
  go2: [
    { id: 'fr', label: 'FR', range: [0, 3] },
    { id: 'fl', label: 'FL', range: [3, 6] },
    { id: 'rr', label: 'RR', range: [6, 9] },
    { id: 'rl', label: 'RL', range: [9, 12] },
  ],
};

let state = {
  baseUrl: localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE,
  robotInfo: null,
  activeTab: null,
  lastData: null,
  frameCount: 0,
  fpsTimer: null,
  fps: 0,
};

/** @type {TelemetrySocket} */
let socket = null;
/** @type {ImuChart} */
let imuChart = null;
/** @type {TempChart} */
let tempChart = null;
/** @type {SampleCapture} */
let sampler = null;

/* ══════════════════════════════════════════════════════════════
   DOM References (populated in init)
   ══════════════════════════════════════════════════════════════ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ══════════════════════════════════════════════════════════════
   Initialization
   ══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // URL input
  const urlField = $('#url-field');
  const urlBtn = $('#url-connect');
  urlField.value = state.baseUrl;

  urlBtn.addEventListener('click', () => {
    const val = urlField.value.trim().replace(/\/+$/, '');
    if (val) {
      state.baseUrl = val;
      localStorage.setItem(STORAGE_KEY, val);
      connectSocket();
    }
  });

  urlField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') urlBtn.click();
  });

  // Samples
  sampler = new SampleCapture();
  $('#btn-capture').addEventListener('click', onCapture);
  $('#btn-csv').addEventListener('click', () => sampler.download());
  $('#btn-clear').addEventListener('click', onClearSamples);

  // Chart.js defaults
  applyChartDefaults();

  // FPS counter
  state.fpsTimer = setInterval(() => {
    state.fps = state.frameCount;
    state.frameCount = 0;
    const el = $('#stat-freq');
    if (el) el.textContent = `${state.fps} Hz`;
  }, 1000);

  // Fetch robot info then connect
  await fetchRobotInfo();
  connectSocket();
}

/* ══════════════════════════════════════════════════════════════
   Fetch Robot Info
   ══════════════════════════════════════════════════════════════ */

async function fetchRobotInfo() {
  try {
    const res = await fetch(`${state.baseUrl}/info`);
    if (!res.ok) throw new Error(res.statusText);
    state.robotInfo = await res.json();
  } catch (err) {
    console.warn('[Dashboard] Could not fetch /info, using defaults:', err.message);
    state.robotInfo = {
      modelo: 'g1',
      nombre: 'Unitree G1',
      tipo: 'humanoide',
      n_motores: 29,
      motores_nombres: [],
      patas: ['R_foot', 'L_foot'],
      modo: 'desconocido',
    };
  }

  buildUI(state.robotInfo);
}

/* ══════════════════════════════════════════════════════════════
   Build Dynamic UI
   ══════════════════════════════════════════════════════════════ */

function buildUI(info) {
  // Header
  $('#robot-name').textContent = `${info.nombre || info.modelo}`;
  $('#robot-mode').textContent = info.modo || '';

  // Motor tabs
  const groups = MOTOR_GROUPS[info.modelo] || MOTOR_GROUPS.g1;
  const tabsContainer = $('#motor-tabs');
  tabsContainer.innerHTML = '';

  groups.forEach((g, i) => {
    const btn = document.createElement('button');
    btn.className = 'tabs__btn' + (i === 0 ? ' tabs__btn--active' : '');
    btn.dataset.groupId = g.id;
    btn.textContent = g.label;
    btn.addEventListener('click', () => switchMotorTab(g.id));
    tabsContainer.appendChild(btn);
  });

  state.activeTab = groups[0].id;

  // Motor table header
  $('#motor-count').textContent = `${info.n_motores} motores`;

  // Initialize charts
  const imuCanvas = $('#imu-chart');
  if (imuChart) imuChart.destroy();
  imuChart = new ImuChart(imuCanvas);

  const tempCanvas = $('#temp-chart');
  if (tempChart) tempChart.destroy();
  tempChart = new TempChart(tempCanvas);

  // Forces diagram
  buildForcesDiagram(info);

  // Footer
  $('#stat-robot').textContent = info.modelo?.toUpperCase() || '';
  $('#stat-mode').textContent = info.modo || '';
}

/* ── Motor Tab Switching ── */

function switchMotorTab(groupId) {
  state.activeTab = groupId;

  $$('#motor-tabs .tabs__btn').forEach(btn => {
    btn.classList.toggle('tabs__btn--active', btn.dataset.groupId === groupId);
  });

  // Re-render with last data if available
  if (state.lastData) {
    updateMotorTable(state.lastData.motores);
    updateTempChart(state.lastData.motores);
  }
}

/* ── Forces Diagram ── */

function buildForcesDiagram(info) {
  const container = $('#forces-diagram');
  container.innerHTML = '';

  const isHumanoid = info.tipo === 'humanoide';
  const patas = info.patas || [];

  if (isHumanoid) {
    container.className = 'forces-diagram forces-diagram--humanoid';
    container.innerHTML = `
      <div class="forces-head"></div>
      <div class="forces-body"></div>
      <div class="forces-feet">
        ${patas.map(p => `
          <div class="forces-foot">
            <div class="forces-foot__indicator" id="force-${p}"></div>
            <span class="forces-foot__label">${p.replace('_', ' ')}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    container.className = 'forces-diagram forces-diagram--quadruped';
    container.innerHTML = patas.map(p => `
      <div class="forces-paw" id="force-${p}">
        <div class="forces-paw__dot"></div>
        <span class="forces-paw__label">${p}</span>
      </div>
    `).join('');
  }
}

/* ══════════════════════════════════════════════════════════════
   WebSocket Connection
   ══════════════════════════════════════════════════════════════ */

function connectSocket() {
  if (socket) socket.close();

  const wsUrl = state.baseUrl.replace(/^http/, 'ws') + '/ws';
  socket = new TelemetrySocket(wsUrl);

  socket.onStatus = (status) => {
    const dot = $('#connection-dot');
    const label = $('#connection-label');

    dot.className = 'connection__dot';
    switch (status) {
      case 'connected':
        dot.classList.add('connection__dot--connected');
        label.textContent = 'Conectado';
        break;
      case 'connecting':
        dot.classList.add('connection__dot--connecting');
        label.textContent = 'Conectando...';
        break;
      case 'error':
        label.textContent = 'Error';
        break;
      default:
        label.textContent = 'Desconectado';
    }
  };

  socket.onTelemetry = onTelemetryFrame;
  socket.connect();
}

/* ══════════════════════════════════════════════════════════════
   Telemetry Frame Handler (runs ~10 Hz)
   ══════════════════════════════════════════════════════════════ */

function onTelemetryFrame(data) {
  state.lastData = data;
  state.frameCount++;

  updateMotorTable(data.motores);
  updateTempChart(data.motores);
  updateIMU(data.imu, data.ts);
  updateBMS(data.bms);
  updateForces(data.fuerzas);
  updateFooter(data.ts);
}

/* ══════════════════════════════════════════════════════════════
   Panel Updaters
   ══════════════════════════════════════════════════════════════ */

/* ── Motors ── */

function getActiveMotors(allMotors) {
  if (!allMotors) return [];
  const modelo = state.robotInfo?.modelo || 'g1';
  const groups = MOTOR_GROUPS[modelo] || MOTOR_GROUPS.g1;
  const group = groups.find(g => g.id === state.activeTab) || groups[0];
  return allMotors.slice(group.range[0], group.range[1]);
}

function updateMotorTable(allMotors) {
  const motors = getActiveMotors(allMotors);
  const tbody = $('#motor-tbody');
  if (!tbody) return;

  // Rebuild on tab switch or when motor count changed
  if (tbody.dataset.groupId !== state.activeTab || tbody.children.length !== motors.length) {
    tbody.dataset.groupId = state.activeTab;
    tbody.innerHTML = motors.map(m => `
      <tr id="motor-row-${m.id}">
        <td class="motor-name">${m.nombre}</td>
        <td class="motor-value" data-field="angulo">${m.angulo.toFixed(1)}°</td>
        <td class="motor-value" data-field="velocidad">${m.velocidad.toFixed(2)}</td>
        <td class="motor-value" data-field="torque">${m.torque.toFixed(2)}</td>
        <td>
          <div class="temp-cell">
            <span class="temp-dot ${tempClass(m.temperatura)}"></span>
            <span class="motor-value" data-field="temp">${m.temperatura.toFixed(1)}°</span>
          </div>
        </td>
      </tr>
    `).join('');
    return;
  }

  // Fast in-place update
  motors.forEach((m, idx) => {
    const row = tbody.children[idx];
    if (!row) return;
    const cells = row.querySelectorAll('.motor-value');
    cells[0].textContent = `${m.angulo.toFixed(1)}°`;
    cells[1].textContent = m.velocidad.toFixed(2);
    cells[2].textContent = m.torque.toFixed(2);
    cells[3].textContent = `${m.temperatura.toFixed(1)}°`;

    const dot = row.querySelector('.temp-dot');
    dot.className = `temp-dot ${tempClass(m.temperatura)}`;
  });
}

function tempClass(t) {
  if (t > 60) return 'temp-dot--danger';
  if (t > 40) return 'temp-dot--warn';
  return 'temp-dot--ok';
}

function updateTempChart(allMotors) {
  if (!tempChart) return;
  const motors = getActiveMotors(allMotors);
  tempChart.update(motors);
}

/* ── IMU ── */

function updateIMU(imu, ts) {
  if (!imu) return;

  $('#imu-roll').textContent = imu.roll.toFixed(1);
  $('#imu-pitch').textContent = imu.pitch.toFixed(1);
  $('#imu-yaw').textContent = imu.yaw.toFixed(1);

  $('#imu-ax').textContent = imu.ax.toFixed(3);
  $('#imu-ay').textContent = imu.ay.toFixed(3);
  $('#imu-az').textContent = imu.az.toFixed(3);

  if (imuChart) {
    imuChart.push(ts, imu.roll, imu.pitch, imu.yaw);
  }
}

/* ── BMS (Battery) ── */

function updateBMS(bms) {
  if (!bms) return;

  const soc = bms.soc;
  $('#bms-soc').textContent = `${soc}%`;

  // Gauge arc — monochrome, always black
  const circle = $('#bms-gauge-fill');
  if (circle) {
    const r = 54;
    const circumference = 2 * Math.PI * r;
    const offset = circumference * (1 - soc / 100);
    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${offset}`;
  }

  $('#bms-current').textContent = `${bms.corriente} A`;
  $('#bms-temp').textContent = `${bms.temperatura.toFixed(1)} °C`;

  // Cell voltages
  const cellsGrid = $('#bms-cells-grid');
  if (cellsGrid && bms.celdas && bms.celdas.length > 0) {
    $('#bms-cells-section').classList.remove('hidden');
    if (cellsGrid.children.length !== bms.celdas.length) {
      cellsGrid.innerHTML = bms.celdas.map((v, i) =>
        `<span class="bms-cell" id="bms-cell-${i}">${v.toFixed(3)}V</span>`
      ).join('');
    } else {
      bms.celdas.forEach((v, i) => {
        const el = cellsGrid.children[i];
        if (el) el.textContent = `${v.toFixed(3)}V`;
      });
    }
  } else {
    $('#bms-cells-section')?.classList.add('hidden');
  }
}

/* ── Forces ── */

function updateForces(fuerzas) {
  if (!fuerzas) return;
  const isHumanoid = state.robotInfo?.tipo === 'humanoide';

  for (const [key, val] of Object.entries(fuerzas)) {
    const el = document.getElementById(`force-${key}`);
    if (!el) continue;

    if (isHumanoid) {
      // It's the indicator div inside forces-foot
      el.classList.toggle('forces-foot__indicator--active', val === 1);
    } else {
      // It's the paw container
      el.classList.toggle('forces-paw--active', val === 1);
    }
  }
}

/* ── Footer ── */

function updateFooter(ts) {
  const el = $('#stat-ts');
  if (el) el.textContent = `${ts.toFixed(1)}s`;

  const msgEl = $('#stat-msgs');
  if (msgEl && socket) msgEl.textContent = socket.messagesReceived;
}

/* ══════════════════════════════════════════════════════════════
   Sample Capture Handlers
   ══════════════════════════════════════════════════════════════ */

function onCapture() {
  if (!state.lastData) return;
  const count = sampler.capture(state.lastData);
  $('#sample-count').textContent = count;
  $('#btn-csv').disabled = false;
  $('#btn-clear').disabled = false;

  // Subtle feedback
  const btn = $('#btn-capture');
  btn.style.opacity = '0.6';
  setTimeout(() => { btn.style.opacity = ''; }, 150);
}

function onClearSamples() {
  sampler.clear();
  $('#sample-count').textContent = '0';
  $('#btn-csv').disabled = true;
  $('#btn-clear').disabled = true;
}
