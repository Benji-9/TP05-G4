/**
 * Sample capture and CSV export module.
 * Stores telemetry snapshots in memory and exports them as CSV.
 *
 * @module csv-export
 */

export class SampleCapture {
  constructor() {
    /** @type {object[]} */
    this.samples = [];
  }

  /** Number of captured samples. */
  get count() {
    return this.samples.length;
  }

  /**
   * Capture a deep copy of the telemetry frame.
   * @param {object} telemetryData  Parsed JSON from the backend.
   * @returns {number} New sample count.
   */
  capture(telemetryData) {
    this.samples.push(structuredClone(telemetryData));
    return this.samples.length;
  }

  /** Remove all captured samples. */
  clear() {
    this.samples = [];
  }

  /**
   * Generate a CSV string from all captured samples.
   * Columns adapt dynamically to the number of motors.
   * @returns {string}
   */
  toCSV() {
    if (this.samples.length === 0) return '';

    // Build headers from the first sample
    const first = this.samples[0];
    const headers = ['ts', 'modelo'];

    // IMU
    headers.push('roll', 'pitch', 'yaw', 'ax', 'ay', 'az');

    // BMS
    headers.push('soc', 'corriente', 'bms_temp');

    // Motors (dynamic)
    const nMotors = first.motores ? first.motores.length : 0;
    for (let i = 0; i < nMotors; i++) {
      const name = first.motores[i].nombre || `motor_${i}`;
      headers.push(`${name}_angulo`, `${name}_vel`, `${name}_torque`, `${name}_temp`);
    }

    // Forces (dynamic keys)
    const forceKeys = first.fuerzas ? Object.keys(first.fuerzas) : [];
    for (const key of forceKeys) {
      headers.push(`fuerza_${key}`);
    }

    // Build rows
    const rows = [headers.join(',')];

    for (const s of this.samples) {
      const row = [];

      row.push(s.ts ?? '');
      row.push(s.modelo ?? '');

      // IMU
      const imu = s.imu || {};
      row.push(imu.roll ?? '', imu.pitch ?? '', imu.yaw ?? '');
      row.push(imu.ax ?? '', imu.ay ?? '', imu.az ?? '');

      // BMS
      const bms = s.bms || {};
      row.push(bms.soc ?? '', bms.corriente ?? '', bms.temperatura ?? '');

      // Motors
      for (let i = 0; i < nMotors; i++) {
        const m = (s.motores && s.motores[i]) || {};
        row.push(m.angulo ?? '', m.velocidad ?? '', m.torque ?? '', m.temperatura ?? '');
      }

      // Forces
      for (const key of forceKeys) {
        row.push(s.fuerzas ? (s.fuerzas[key] ?? '') : '');
      }

      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Trigger a CSV file download in the browser.
   */
  download() {
    const csv = this.toCSV();
    if (!csv) return;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `telemetria_${stamp}.csv`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
