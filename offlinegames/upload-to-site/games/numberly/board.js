(function (N) {
'use strict';

class GameBoard {
  constructor(element, visit) {
    this.element = element;
    this.visit = visit;
    this.active = false;
    this.pointer = null;
    this.previous = null;
    this.lastCell = null;
    this.level = null;
    this.frame = null;
    this.options = null;
    element.addEventListener('pointerdown', (event) => this.pointerDown(event));
    element.addEventListener('pointermove', (event) => this.pointerMove(event));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => element.addEventListener(name, (event) => this.release(event)));
    element.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  cancelPointer() {
    const id = this.pointer;
    this.pointer = null;
    this.previous = null;
    this.lastCell = null;
    if (id !== null && this.element.hasPointerCapture?.(id)) {
      try { this.element.releasePointerCapture(id); } catch { /* A cancelled pointer may already be released. */ }
    }
  }

  cellAt(x, y, rect) {
    if (!this.level || !rect.width || !rect.height) return -1;
    const size = this.level.size;
    const col = Math.floor((x - rect.left) / rect.width * size);
    const row = Math.floor((y - rect.top) / rect.height * size);
    return col >= 0 && col < size && row >= 0 && row < size ? row * size + col : -1;
  }

  visitPoint(x, y, rect) {
    const cell = this.cellAt(x, y, rect);
    if (!this.active || cell < 0 || cell === this.lastCell) return;
    this.lastCell = cell;
    this.visit(cell);
  }

  pointerDown(event) {
    if (!this.active || this.pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    this.element.focus({ preventScroll: true });
    this.pointer = event.pointerId;
    this.previous = { x: event.clientX, y: event.clientY };
    this.lastCell = null;
    try { this.element.setPointerCapture(event.pointerId); } catch { /* Pointer events still work over the board. */ }
    this.visitPoint(event.clientX, event.clientY, this.element.getBoundingClientRect());
  }

  pointerMove(event) {
    if (!this.active || this.pointer !== event.pointerId || !this.previous) return;
    const rect = this.element.getBoundingClientRect();
    const start = this.previous;
    const steps = Math.min(160, Math.max(1, Math.ceil(Math.hypot(event.clientX - start.x, event.clientY - start.y) / (rect.width / this.level.size / 4))));
    for (let i = 1; i <= steps && this.active; i++) {
      this.visitPoint(start.x + (event.clientX - start.x) * i / steps, start.y + (event.clientY - start.y) * i / steps, rect);
    }
    if (this.pointer !== null) this.previous = { x: event.clientX, y: event.clientY };
  }

  release(event) {
    if (event.pointerId === this.pointer) this.cancelPointer();
  }

  update(options) {
    if (this.level !== options.level || !options.active) this.cancelPointer();
    this.level = options.level;
    this.active = options.active;
    this.options = options;
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => { this.frame = null; this.draw(); });
  }

  draw() {
    const { level, path, active, preview, hint, pulse } = this.options;
    const { size, checkpoints } = level;
    const unit = 80;
    const dimension = size * unit;
    const visible = preview ? level.solution.slice(0, level.id === 1 ? 9 : 5) : path;
    const visited = new Set(visible);
    const latest = path.reduce((max, cell) => Math.max(max, checkpoints[cell] || 0), 0);
    const point = (cell) => `${cell % size * unit + 40},${Math.floor(cell / size) * unit + 40}`;
    this.element.setAttribute('viewBox', `0 0 ${dimension} ${dimension}`);
    this.element.setAttribute('tabindex', active ? '0' : '-1');
    this.element.setAttribute('aria-label', `Level ${level.id}, ${size} by ${size} number puzzle. Connect 1 through ${level.count} in order. Empty squares are allowed. Use arrows, drag, or tap adjacent squares.`);
    this.element.classList.toggle('is-active', active);
    let markup = `<defs><pattern id="board-grid" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#fcfdf9"/><path d="M80 0H0V80" fill="none" stroke="#e0e6d9" stroke-width="1.5"/></pattern></defs><rect width="${dimension}" height="${dimension}" fill="url(#board-grid)"/>`;
    markup += visible.map((cell) => `<rect x="${cell % size * unit + 1}" y="${Math.floor(cell / size) * unit + 1}" width="78" height="78" fill="${preview ? '#eaf0e2' : '#e4eddc'}"/>`).join('');
    if (hint !== null) markup += `<rect class="hint-cell" x="${hint % size * unit + 5}" y="${Math.floor(hint / size) * unit + 5}" width="70" height="70" rx="10" fill="#ede4a9" stroke="#c1a855" stroke-width="2" stroke-dasharray="5 4"/>`;
    if (visible.length > 1) markup += `<polyline class="${preview ? 'preview-line' : 'connection-line'}" points="${visible.map(point).join(' ')}" fill="none" stroke="${preview ? '#93ad7a' : '#789764'}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>`;
    markup += Object.entries(checkpoints).map(([key, number]) => {
      const cell = Number(key), x = cell % size * unit + 40, y = Math.floor(cell / size) * unit + 40;
      const connected = visited.has(cell);
      return `<g class="number-node" aria-label="Number ${number}, row ${Math.floor(cell / size) + 1}, column ${cell % size + 1}${connected ? ', connected' : ''}">${active && number === latest + 1 ? `<circle class="next-ring" cx="${x}" cy="${y}" r="27" fill="none" stroke="#a5b790" stroke-width="1.5"/>` : ''}${pulse === cell ? `<circle class="checkpoint-ring" cx="${x}" cy="${y}" r="23" fill="none" stroke="#779465" stroke-width="3"/>` : ''}<circle cx="${x}" cy="${y}" r="22" fill="${connected ? '#789764' : '#f8faf2'}" stroke="${connected ? '#789764' : '#d8e1cb'}" stroke-width="1.5"/><text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="central" fill="${connected ? '#fffef9' : '#476042'}" font-size="23" font-weight="650" font-family="DM Sans Variable, sans-serif">${number}</text>${pulse === cell ? Array.from({ length: 8 }, (_, i) => `<circle class="node-particle" cx="${x}" cy="${y}" r="${i % 2 ? 3 : 2}" fill="${i % 2 ? '#d7b576' : '#8da77c'}" style="--dx:${Math.cos(i * Math.PI / 4) * 42}px;--dy:${Math.sin(i * Math.PI / 4) * 42}px"/>`).join('') : ''}</g>`;
    }).join('');
    if (visible.length && !checkpoints[visible[visible.length - 1]]) {
      const head = visible[visible.length - 1];
      markup += `<circle cx="${head % size * unit + 40}" cy="${Math.floor(head / size) * unit + 40}" r="11" fill="#789764" stroke="#f9fcf4" stroke-width="3"/>`;
    }
    // The SVG element stays mounted so pointer capture is preserved while the path changes.
    this.element.innerHTML = markup;
  }
}

N.GameBoard = GameBoard;
})(globalThis.Numberly = globalThis.Numberly || {});