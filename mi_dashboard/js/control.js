/**
 * Control manual WASD — EXTENSIÓN fuera del contrato del TP05.
 *
 * El TP05 pide un dashboard de solo lectura (ver API.md: "no hay ningún
 * endpoint que mueva el robot"). Este módulo habla con dos rutas extra que
 * NO forman parte de ese contrato — POST /control/mover y
 * POST /control/detener — que el backend solo expone cuando está conectado
 * al simulador local (nunca contra el robot real el día de la visita).
 *
 * Mientras se mantiene una tecla de movimiento apretada, reenvía el comando
 * cada SEND_PERIOD_MS con una duración un poco mayor (COMMAND_DURATION), así
 * el robot no se frena entre envíos aunque se pierda algún request. Al
 * soltar todas las teclas, manda /control/detener.
 *
 * @module control
 */

const KEYS = {
  forward: ['w', 'arrowup'],
  back: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
};

const ALL_KEYS = new Set(Object.values(KEYS).flat());

// Topes del perfil tp05 (ver entorno/sim/safety.py): el simulador recorta
// igual si se manda mas, pero no tiene sentido pedir de mas.
const VX = 0.20;
const VYAW = 0.50;

const SEND_PERIOD_MS = 150;
const COMMAND_DURATION = 0.4; // s — > SEND_PERIOD_MS/1000 para no cortar entre envíos

export class WasdControl {
  /** @param {() => string} getBaseUrl */
  constructor(getBaseUrl) {
    this.getBaseUrl = getBaseUrl;
    this.enabled = false;
    this.pressed = new Set();
    this._timer = null;
    this._warned = false;

    /** @type {(info: {active: boolean, keys: Set<string>, warning: string|null}) => void} */
    this.onUpdate = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) {
      document.addEventListener('keydown', this._onKeyDown);
      document.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('blur', this._onBlur);
    } else {
      document.removeEventListener('keydown', this._onKeyDown);
      document.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('blur', this._onBlur);
      this._releaseAll();
    }
    this._emit();
  }

  _isTypingTarget(el) {
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
  }

  _onKeyDown(e) {
    if (this._isTypingTarget(e.target)) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'spacebar') {
      e.preventDefault();
      this._releaseAll();
      return;
    }
    if (!ALL_KEYS.has(k)) return;
    e.preventDefault();
    if (!this.pressed.has(k)) {
      this.pressed.add(k);
      this._ensureLoop();
      this._emit();
    }
  }

  _onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (this.pressed.delete(k)) {
      if (this.pressed.size === 0) this._stopMoving();
      this._emit();
    }
  }

  _onBlur() {
    // Si la ventana pierde foco con una tecla apretada, el keyup nunca llega.
    this._releaseAll();
  }

  _releaseAll() {
    if (this.pressed.size === 0) return;
    this.pressed.clear();
    this._stopMoving();
    this._emit();
  }

  _vector() {
    let vx = 0;
    let vyaw = 0;
    for (const k of this.pressed) {
      if (KEYS.forward.includes(k)) vx += VX;
      if (KEYS.back.includes(k)) vx -= VX;
      if (KEYS.left.includes(k)) vyaw += VYAW;
      if (KEYS.right.includes(k)) vyaw -= VYAW;
    }
    return { vx, vyaw };
  }

  _ensureLoop() {
    if (this._timer) return;
    this._sendMove();
    this._timer = setInterval(() => this._sendMove(), SEND_PERIOD_MS);
  }

  _stopMoving() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._post('/control/detener', null);
  }

  _sendMove() {
    const { vx, vyaw } = this._vector();
    this._post('/control/mover', { vx, vy: 0, vyaw, duracion: COMMAND_DURATION });
  }

  async _post(path, body) {
    try {
      const res = await fetch(`${this.getBaseUrl()}${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        this._warnOnce(res.status === 503
          ? 'Control no disponible: conectate al simulador local (no funciona con --demo ni con el robot real).'
          : `El backend rechazó el comando (${res.status}).`);
      } else {
        this._warned = false;
      }
    } catch {
      this._warnOnce('No se pudo contactar al backend en esa URL.');
    }
  }

  _warnOnce(msg) {
    if (this._warned) return;
    this._warned = true;
    this._emit(msg);
  }

  _emit(warning = null) {
    if (this.onUpdate) {
      this.onUpdate({ active: this.enabled, keys: new Set(this.pressed), warning });
    }
  }
}
