/**
 * WebSocket connection manager with auto-reconnect.
 * Connects to the TP05 telemetry backend and emits parsed frames.
 *
 * @module websocket
 */

export class TelemetrySocket {
  /**
   * @param {string} url  WebSocket URL, e.g. "ws://127.0.0.1:8001/ws"
   */
  constructor(url) {
    this.url = url;
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

    /** @type {(status: 'connected'|'connecting'|'disconnected'|'error', msg?: string) => void} */
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
    this._emitStatus('connecting');

    try {
      this._ws = new WebSocket(this.url);
    } catch (err) {
      this._emitStatus('error', err.message);
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      this._retryDelay = this._retryDelayBase; // reset backoff
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
      this._emitStatus('disconnected');
      this._scheduleReconnect();
    };

    this._ws.onerror = () => {
      // onclose fires right after onerror, so reconnect happens there
      this._emitStatus('error');
    };
  }

  /** Permanently close without reconnecting. */
  close() {
    this._shouldReconnect = false;
    this._clearRetryTimer();
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
