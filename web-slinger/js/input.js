// Keyboard + mouse (pointer lock) + touch controls, mapped to game actions.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false };
    this.locked = false;
    this.touch = { active: false, mx: 0, my: 0, lookId: null, lx: 0, ly: 0, stickId: null, sx: 0, sy: 0, held: new Set() };
    this.sensitivity = 1;
    this.invertY = false;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.left = this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) {
        this.mouse.left = true;
        this.pressed.add('Mouse0');
      }
      if (e.button === 2) {
        this.mouse.right = true;
        this.pressed.add('Mouse2');
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    this.initTouch();
  }

  requestLock() {
    if (this.isTouch) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => this.canvas.requestPointerLock());
    } catch {
      this.canvas.requestPointerLock();
    }
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  initTouch() {
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const root = document.getElementById('touch');
    if (!root) return;
    if (!this.isTouch) {
      root.remove();
      return;
    }
    root.classList.add('on');
    document.body.classList.add('touch');
    const stick = root.querySelector('.stick');
    const knob = root.querySelector('.knob');
    const T = this.touch;
    root.querySelectorAll('[data-act]').forEach((b) => {
      const act = b.dataset.act;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        T.held.add(act);
        this.pressed.add('T:' + act);
        b.classList.add('down');
      }, { passive: false });
      const up = (e) => {
        e.preventDefault();
        T.held.delete(act);
        b.classList.remove('down');
      };
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
    });
    const onStart = (e) => {
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('[data-act]')) continue;
        if (t.clientX < innerWidth * 0.42 && T.stickId === null) {
          T.stickId = t.identifier;
          T.sx = t.clientX;
          T.sy = t.clientY;
          stick.style.left = t.clientX + 'px';
          stick.style.top = t.clientY + 'px';
          stick.classList.add('on');
        } else if (T.lookId === null) {
          T.lookId = t.identifier;
          T.lx = t.clientX;
          T.ly = t.clientY;
        }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === T.stickId) {
          let dx = t.clientX - T.sx;
          let dy = t.clientY - T.sy;
          const l = Math.hypot(dx, dy);
          const R = 56;
          if (l > R) {
            dx *= R / l;
            dy *= R / l;
          }
          T.mx = dx / R;
          T.my = -dy / R;
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
        } else if (t.identifier === T.lookId) {
          this.mouse.dx += (t.clientX - T.lx) * 2.2;
          this.mouse.dy += (t.clientY - T.ly) * 2.2;
          T.lx = t.clientX;
          T.ly = t.clientY;
        }
      }
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === T.stickId) {
          T.stickId = null;
          T.mx = T.my = 0;
          knob.style.transform = '';
          stick.classList.remove('on');
        } else if (t.identifier === T.lookId) T.lookId = null;
      }
    };
    root.addEventListener('touchstart', onStart, { passive: true });
    addEventListener('touchmove', onMove, { passive: true });
    addEventListener('touchend', onEnd);
    addEventListener('touchcancel', onEnd);
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }
  hit(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  // ------------------------------------------------------------ action map
  get move() {
    let x = 0;
    let y = 0;
    if (this.down('KeyW', 'ArrowUp')) y += 1;
    if (this.down('KeyS', 'ArrowDown')) y -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    x += this.touch.mx;
    y += this.touch.my;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y, mag: Math.min(1, l) };
  }
  get swing() {
    return this.down('ShiftLeft', 'ShiftRight') || this.mouse.right || this.touch.held.has('swing');
  }
  get jumpHeld() {
    return this.down('Space') || this.touch.held.has('jump');
  }
  get jump() {
    return this.hit('Space', 'T:jump');
  }
  get attack() {
    return this.hit('Mouse0', 'KeyJ', 'T:attack');
  }
  get web() {
    return this.hit('KeyF', 'KeyK', 'T:web');
  }
  get dodge() {
    return this.hit('KeyQ', 'KeyL', 'T:dodge');
  }
  get launch() {
    return this.hit('KeyE', 'T:launch');
  }
  get dive() {
    return this.down('KeyC', 'ControlLeft') || this.touch.held.has('dive');
  }
  get trick() {
    return this.hit('KeyR', 'T:trick');
  }
  get heal() {
    return this.hit('KeyH', 'T:heal');
  }
  get finisher() {
    return this.hit('KeyV', 'T:finisher');
  }
  get pause() {
    return this.hit('Escape', 'KeyP', 'T:pause');
  }
  get map() {
    return this.hit('KeyM');
  }

  consumeLook() {
    const s = 0.0023 * this.sensitivity;
    const dx = this.mouse.dx * s;
    const dy = this.mouse.dy * s * (this.invertY ? -1 : 1);
    this.mouse.dx = this.mouse.dy = 0;
    return { dx, dy };
  }

  endFrame() {
    this.pressed.clear();
  }
}
