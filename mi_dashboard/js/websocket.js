/**
 * WebSocket connection manager with auto-reconnect.
 * Connects to the TP05 telemetry backend and emits parsed frames.
 *
 * @module websocket
 */

export class TelemetrySocket {
  /**
   * @param {string} url  WebSocket URL, e.g. "ws://127.0.0.1:8001/ws"
   * @param {string} [restUrl]  Respaldo: GET /telemetria. Si el WebSocket
   *   falla `failuresBeforePolling` veces seguidas se consulta por polling
   *   (la consigna admite polling ≤ 500 ms) mientras se sigue reintentando.
   */
  constructor(url, restUrl = null) {
    this.url = url;
    this.restUrl = restUrl;
    this.pollIntervalMs = 500;
    this.failuresBeforePolling = 3;
    this._failures = 0;          // intentos de WebSocket fallidos seguidos
    this._pollTimer = null;
    this._pollBusy = false;
    this._pollOk = null;         // último resultado del polling
    /** @type {WebSocket|null} */
    this._ws = null;
    this._shouldReconnect = true;
    this._retryDelay = 1000;       // current backoff (ms)
    this._retryDelayBase = 1000;   // initial
    this._retryDelayMax = 10000;   // cap
    this._retryTimer = null;
    this._messagesReceived = 0;

    // ── callbacks (override from outside) ──
    /** @type {(data: object) => void} */
    this.onTelemetry = null;

    /** @type {(status: 'connected'|'polling'|'connecting'|'disconnected'|'error', msg?: string) => void} */
    this.onStatus = null;
  }

  /** Total messages received since construction. */
  get messagesReceived() {
    return this._messagesReceived;
  }

  /** Current connection state as a string. */
  get state() {
    if (!this._ws) return 'disconnected';
    switch (this._ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN:       return 'connected';
      case WebSocket.CLOSING:    return 'disconnected';
      case WebSocket.CLOSED:     return 'disconnected';
      default:                   return 'disconnected';
    }
  }

  /** Open (or re-open) the WebSocket connection. */
  connect() {
    this._clearRetryTimer();
    this._shouldReconnect = true;
    if (!this._pollTimer) this._emitStatus('connecting');

    try {
      this._ws = new WebSocket(this.url);
    } catch (err) {
      this._noteFailure();
      if (!this._pollTimer) this._emitStatus('error', err.message);
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      this._retryDelay = this._retryDelayBase; // reset backoff
      this._failures = 0;
      this._stopPolling();                     // volvió el WebSocket
      this._emitStatus('connected');
    };

    this._ws.onmessage = (event) => {
      this._messagesReceived++;
      try {
        const data = JSON.parse(event.data);
        if (this.onTelemetry) this.onTelemetry(data);
      } catch { /* ignore malformed frames */ }
    };

    this._ws.onclose = () => {
      this._noteFailure();
      if (!this._pollTimer) this._emitStatus('disconnected');
      this._scheduleReconnect();
    };

    this._ws.onerror = () => {
      // onclose fires right after onerror, so reconnect happens there
      if (!this._pollTimer) this._emitStatus('error');
    };
  }

  /** Permanently close without reconnecting. */
  close() {
    this._shouldReconnect = false;
    this._clearRetryTimer();
    this._stopPolling();
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._emitStatus('disconnected');
  }

  /** Change URL and reconnect. */
  reconnect(newUrl) {
    if (newUrl) this.url = newUrl;
    this.close();
    this._shouldReconnect = true;
    this.connect();
  }

  // ── Private ──

  _noteFailure() {
    this._failures++;
    if (this.restUrl && this._failures >= this.failuresBeforePolling) {
      this._startPolling();
    }
  }

  _startPolling() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => this._poll(), this.pollIntervalMs);
    this._poll();
  }

  _stopPolling() {
    clearInterval(this._pollTimer);
    this._pollTimer = null;
    this._pollOk = null;
  }

  async _poll() {
    if (this._pollBusy) return;      // no apilar pedidos si el servidor tarda
    this._pollBusy = true;
    let data;
    try {
      const res = await fetch(this.restUrl);
      if (!res.ok) throw new Error(res.statusText);
      data = await res.json();
    } catch {
      if (this._pollTimer && this._pollOk !== false) {
        this._pollOk = false;
        this._emitStatus('disconnected');
      }
      return;
    } finally {
      this._pollBusy = false;
    }
    if (!this._pollTimer) return;    // se detuvo mientras esperaba
    if (this._pollOk !== true) {
      this._pollOk = true;
      this._emitStatus('polling');
    }
    this._messagesReceived++;
    if (this.onTelemetry) this.onTelemetry(data);
  }

  _emitStatus(status, msg) {
    if (this.onStatus) this.onStatus(status, msg);
  }

  _scheduleReconnect() {
    if (!this._shouldReconnect) return;
    this._clearRetryTimer();
    this._retryTimer = setTimeout(() => {
      this._retryDelay = Math.min(this._retryDelay * 2, this._retryDelayMax);
      this.connect();
    }, this._retryDelay);
  }

  _clearRetryTimer() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }
}
