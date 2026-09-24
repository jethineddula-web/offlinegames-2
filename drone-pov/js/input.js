/**
 * Unified input: keyboard + mouse-look, gamepad, touch (dynamic virtual stick +
 * right-side look pad + action buttons) and device-orientation tilt.
 */
const clamp = (v, a = -1, b = 1) => (v < a ? a : v > b ? b : v);

export class InputManager {
  constructor() {
    this.axes = { pitch: 0, yaw: 0, roll: 0, throttle: 0, brake: 0, boost: false, fire: false, ability: false };
    this.stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookPad = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    this.keys = new Set();
    this.sensitivity = 1;
    this.invertY = false;
    this.tiltEnabled = false;
    this.isTouch = false;
    this.pointerLocked = false;
    this.btn = { boost: false, fire: false, ability: false, brake: false };
    this.el = null;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.stickId = -1;
    this.lookId = -1;
    this.tiltBase = null;
    this.tilt = { x: 0, y: 0 };
    this.bound = false;

    this.onBlur = () => this.reset();
    this.onKeyDown = (e) => {
      this.keys.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(e.code) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
      }
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.el;
    };
    this.onPointerDown = (e) => {
      if (e.pointerType === "touch") {
        this.isTouch = true;
        const half = window.innerWidth * 0.46;
        if (e.clientX < half && this.stickId === -1) {
          this.stickId = e.pointerId;
          this.stick = { active: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
        } else if (this.lookId === -1) {
          this.lookId = e.pointerId;
          this.lookPad = { active: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
        }
      } else if (e.pointerType === "mouse") {
        if (e.button === 0) this.btn.fire = true;
        if (!this.pointerLocked) this.requestPointerLock();
      }
    };
    this.onPointerMove = (e) => {
      if (e.pointerType === "touch") {
        const R = Math.min(90, window.innerHeight * 0.2);
        if (e.pointerId === this.stickId) {
          const dx = e.clientX - this.stick.ox;
          const dy = e.clientY - this.stick.oy;
          const d = Math.hypot(dx, dy);
          const k = d > R ? R / d : 1;
          this.stick.x = (dx * k) / R;
          this.stick.y = (dy * k) / R;
        } else if (e.pointerId === this.lookId) {
          const dx = e.clientX - this.lookPad.ox;
          const dy = e.clientY - this.lookPad.oy;
          const d = Math.hypot(dx, dy);
          const k = d > R ? R / d : 1;
          this.lookPad.x = (dx * k) / R;
          this.lookPad.y = (dy * k) / R;
        }
      } else if (this.pointerLocked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    };
    this.onPointerUp = (e) => {
      if (e.pointerId === this.stickId) {
        this.stickId = -1;
        this.stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
      } else if (e.pointerId === this.lookId) {
        this.lookId = -1;
        this.lookPad = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
      }
      if (e.pointerType === "mouse" && e.button === 0) this.btn.fire = false;
    };
    this.onTilt = (e) => {
      if (!this.tiltEnabled || e.beta === null || e.gamma === null) return;
      if (!this.tiltBase) this.tiltBase = { beta: e.beta, gamma: e.gamma };
      const db = e.beta - this.tiltBase.beta;
      const dg = e.gamma - this.tiltBase.gamma;
      this.tilt.x = clamp(db / 28);
      this.tilt.y = clamp(dg / 28);
    };
  }

  attach(el) {
    this.el = el;
    if (this.bound) return;
    this.bound = true;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    el.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove, { passive: false });
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    document.addEventListener("pointerlockchange", this.onLockChange);
    window.addEventListener("deviceorientation", this.onTilt);
  }

  reset() {
    this.keys.clear();
    this.mouseDX = this.mouseDY = 0;
    this.stick.active = false;
    this.lookPad.active = false;
    this.stickId = this.lookId = -1;
    this.btn = { boost: false, fire: false, ability: false, brake: false };
    this.tiltBase = null;
  }
  recentreTilt() {
    this.tiltBase = null;
  }
  requestPointerLock() {
    if (this.isTouch || !this.el) return;
    try {
      this.el.requestPointerLock();
    } catch {
      /* ignore */
    }
  }
  exitPointerLock() {
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {
      /* ignore */
    }
  }

  /** Fold every source into this.axes. Call once per frame. */
  update(dt) {
    const k = this.keys;
    const down = (...codes) => codes.some((c) => k.has(c));
    let pitch = 0, yaw = 0, roll = 0, throttle = 0, brake = 0;

    // keyboard: A/D steers yaw with automatic banking, Q/E pure roll
    if (down("KeyW", "ArrowUp")) pitch -= 1;
    if (down("KeyS", "ArrowDown")) pitch += 1;
    if (down("KeyA", "ArrowLeft")) { yaw -= 1; roll -= 0.65; }
    if (down("KeyD", "ArrowRight")) { yaw += 1; roll += 0.65; }
    if (down("KeyQ")) roll -= 1;
    if (down("KeyE")) roll += 1;
    if (down("ShiftLeft", "ShiftRight", "Space")) throttle += 1;
    if (down("ControlLeft", "KeyC")) brake += 1;
    let boost = down("Space", "ShiftLeft", "ShiftRight");
    let fire = down("KeyF") || this.btn.fire;
    let ability = down("KeyR", "KeyG") || this.btn.ability;

    // mouse look (relative, smooth, coordinated banking)
    if (this.pointerLocked) {
      yaw += clamp(this.mouseDX * 0.0042 * this.sensitivity, -1.6, 1.6);
      roll += clamp(this.mouseDX * 0.0028 * this.sensitivity, -1.0, 1.0);
      pitch += clamp(this.mouseDY * 0.0042 * this.sensitivity * (this.invertY ? -1 : 1), -1.6, 1.6);
      const decay = Math.pow(0.0001, dt);
      this.mouseDX *= decay;
      this.mouseDY *= decay;
      if (Math.abs(this.mouseDX) < 0.01) this.mouseDX = 0;
      if (Math.abs(this.mouseDY) < 0.01) this.mouseDY = 0;
    }

    // touch
    if (this.stick.active) {
      yaw += this.stick.x * 1.0;
      roll += this.stick.x * 0.7;
      pitch += this.stick.y * (this.invertY ? -1 : 1);
    }
    if (this.lookPad.active) {
      yaw += this.lookPad.x * 1.2;
      pitch += this.lookPad.y * 0.9 * (this.invertY ? -1 : 1);
    }
    if (this.btn.boost) { throttle += 1; boost = true; }
    if (this.btn.brake) brake += 1;

    // tilt
    if (this.tiltEnabled) {
      pitch += this.tilt.x * 0.9 * (this.invertY ? -1 : 1);
      roll += this.tilt.y * 0.9;
    }

    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const dz = (v) => (Math.abs(v) < 0.14 ? 0 : v);
      yaw += dz(p.axes[0] || 0);
      pitch += dz(p.axes[1] || 0) * (this.invertY ? -1 : 1);
      roll += dz(p.axes[2] || 0);
      const rt = (p.buttons[7] && p.buttons[7].value) || 0;
      const lt = (p.buttons[6] && p.buttons[6].value) || 0;
      throttle += rt;
      brake += lt;
      if (rt > 0.55) boost = true;
      if (p.buttons[0] && p.buttons[0].pressed) fire = true;
      if ((p.buttons[1] && p.buttons[1].pressed) || (p.buttons[5] && p.buttons[5].pressed)) ability = true;
      break;
    }

    const s = this.sensitivity;
    this.axes.pitch = clamp(pitch * s);
    this.axes.yaw = clamp(yaw * s);
    this.axes.roll = clamp(roll * s);
    this.axes.throttle = clamp(throttle, 0, 1);
    this.axes.brake = clamp(brake, 0, 1);
    this.axes.boost = boost;
    this.axes.fire = fire;
    this.axes.ability = ability;
  }
}

export const input = new InputManager();
