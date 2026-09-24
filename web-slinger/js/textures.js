// Procedural canvas textures: facades, streets, suit fabric, water normals.
import * as THREE from 'three';
import { mulberry32, pick } from './utils.js';

let ANISO = 8;
export function setAniso(a) {
  ANISO = a;
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = ANISO;
  return t;
}

function grain(ctx, w, h, amt, rng) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amt;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Building facades. One texture tile = 8 columns x 8 floors
// (TILE_W x TILE_H metres in world space).
export const TILE_W = 25.6;
export const TILE_H = 32;

export const FACADES = {
  glass: { wall: '#1a2430', mull: '#8e9ba8', ww: 0.94, wh: 0.84, tints: ['#3d5f80', '#2f4d6b', '#4a6f93', '#35546f'], lit: 0.16, metal: 0.75, spandrel: '#1f2b39' },
  teal: { wall: '#10222a', mull: '#5f7f8a', ww: 0.94, wh: 0.88, tints: ['#1e5a66', '#256b77', '#1a4c57'], lit: 0.14, metal: 0.85, spandrel: '#132a33' },
  brick: { wall: '#7a3a2a', frame: '#d6cdbd', ww: 0.44, wh: 0.55, tints: ['#2a3139', '#232830', '#333b45'], lit: 0.34, metal: 0.35, brick: true },
  brown: { wall: '#5b4232', frame: '#c9bfae', ww: 0.5, wh: 0.55, tints: ['#262b31', '#2e343c'], lit: 0.3, metal: 0.35, brick: true },
  concrete: { wall: '#a09c94', ww: 0.97, wh: 0.4, tints: ['#28313a', '#303a45', '#222a33'], lit: 0.24, metal: 0.55, strip: true },
  stone: { wall: '#c2b08d', frame: '#8d7c5f', ww: 0.4, wh: 0.62, tints: ['#2a3037', '#323941'], lit: 0.3, metal: 0.4, piers: true },
  modern: { wall: '#e0dfd9', ww: 0.7, wh: 0.64, tints: ['#2c3844', '#34424f', '#26313c'], lit: 0.2, metal: 0.6 },
};

const LIT_COLORS = ['#ffd49a', '#ffe2b8', '#fff1d6', '#ffc27a', '#d8e6ff', '#fff7e8'];

export function facade(name, seed = 1) {
  const st = FACADES[name];
  const rng = mulberry32(seed * 977 + name.length * 131);
  const S = 512;
  const cols = 8;
  const floors = 8;
  const cw = S / cols;
  const fh = S / floors;

  const cMap = mk(S, S);
  const cEm = mk(S, S);
  const cOrm = mk(S, S);
  const m = cMap.getContext('2d');
  const e = cEm.getContext('2d');
  const o = cOrm.getContext('2d');

  // base wall
  m.fillStyle = st.wall;
  m.fillRect(0, 0, S, S);
  e.fillStyle = '#000';
  e.fillRect(0, 0, S, S);
  o.fillStyle = 'rgb(0,235,0)'; // G = roughness, B = metalness
  o.fillRect(0, 0, S, S);

  if (st.brick) {
    m.globalAlpha = 0.22;
    m.fillStyle = '#2b1a14';
    for (let y = 0; y < S; y += 5) {
      m.fillRect(0, y, S, 1);
      const off = (y / 5) % 2 ? 0 : 6;
      for (let x = off; x < S; x += 12) m.fillRect(x, y, 1, 5);
    }
    m.globalAlpha = 1;
  }
  if (st.piers) {
    m.globalAlpha = 0.25;
    m.fillStyle = '#6d5f47';
    for (let y = 0; y < S; y += 16) m.fillRect(0, y, S, 1);
    m.globalAlpha = 1;
  }
  if (st.spandrel) {
    for (let f = 0; f < floors; f++) {
      m.fillStyle = st.spandrel;
      m.fillRect(0, f * fh, S, fh * (1 - st.wh));
    }
  }

  for (let f = 0; f < floors; f++) {
    // strip windows share one long pane per floor
    const wy0 = f * fh + fh * (1 - st.wh) * 0.5 + (st.spandrel ? fh * (1 - st.wh) * 0.5 : 0);
    const wh = fh * st.wh;
    for (let c = 0; c < cols; c++) {
      const wx0 = c * cw + (cw * (1 - st.ww)) / 2;
      const ww = cw * st.ww;
      const tint = pick(st.tints, rng);
      // glass: reflect a bit of sky at top
      const g = m.createLinearGradient(0, wy0, 0, wy0 + wh);
      g.addColorStop(0, shade(tint, 1.45));
      g.addColorStop(0.45, tint);
      g.addColorStop(1, shade(tint, 0.7));
      m.fillStyle = g;
      m.fillRect(wx0, wy0, ww, wh);
      // faint diagonal reflection streak
      m.globalAlpha = 0.08 + rng() * 0.08;
      m.fillStyle = '#ffffff';
      m.beginPath();
      m.moveTo(wx0 + ww * 0.2, wy0);
      m.lineTo(wx0 + ww * 0.45, wy0);
      m.lineTo(wx0 + ww * 0.15, wy0 + wh);
      m.lineTo(wx0 - ww * 0.1, wy0 + wh);
      m.closePath();
      m.fill();
      m.globalAlpha = 1;

      o.fillStyle = `rgb(0,${18 + Math.floor(rng() * 20)},${Math.floor(st.metal * 255)})`;
      o.fillRect(wx0, wy0, ww, wh);

      if (st.frame) {
        m.fillStyle = st.frame;
        m.fillRect(wx0 - 2, wy0 + wh, ww + 4, 3); // sill
        m.fillRect(wx0 - 1, wy0 - 3, ww + 2, 2); // lintel
        m.fillRect(wx0 + ww / 2 - 1, wy0, 2, wh); // mullion
      }

      if (rng() < st.lit) {
        const col = pick(LIT_COLORS, rng);
        const b = 0.45 + rng() * 0.55;
        e.globalAlpha = b;
        const blinds = rng() < 0.3 ? 0.35 + rng() * 0.4 : 0;
        const eg = e.createLinearGradient(0, wy0, 0, wy0 + wh);
        eg.addColorStop(0, col);
        eg.addColorStop(1, shade(col, 0.6));
        e.fillStyle = eg;
        e.fillRect(wx0, wy0 + wh * blinds, ww, wh * (1 - blinds));
        e.globalAlpha = 1;
        m.globalAlpha = 0.35 * b;
        m.fillStyle = col;
        m.fillRect(wx0, wy0 + wh * blinds, ww, wh * (1 - blinds));
        m.globalAlpha = 1;
      }
    }
  }

  if (st.mull) {
    m.fillStyle = st.mull;
    for (let c = 0; c <= cols; c++) m.fillRect(c * cw - 1.5, 0, 3, S);
    for (let f = 0; f <= floors; f++) m.fillRect(0, f * fh - 1.5, S, 3);
    o.fillStyle = `rgb(0,90,${Math.floor(st.metal * 200)})`;
    for (let c = 0; c <= cols; c++) o.fillRect(c * cw - 1.5, 0, 3, S);
  }
  if (st.piers) {
    // vertical stone piers between window columns
    const g = m.createLinearGradient(0, 0, cw, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    for (let c = 0; c < cols; c++) {
      m.fillStyle = g;
      m.save();
      m.translate(c * cw, 0);
      m.fillRect(0, 0, cw * 0.18, S);
      m.restore();
    }
  }
  grain(m, S, S, 14, rng);

  const map = toTex(cMap);
  const emissive = toTex(cEm);
  const orm = toTex(cOrm, false);
  return { map, emissive, orm };
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * k);
  c.g = Math.min(1, c.g * k);
  c.b = Math.min(1, c.b * k);
  return '#' + c.getHexString();
}

// Ground-floor shops: 4 shopfronts per 16 m tile, 5.2 m tall.
export function storefront(seed = 3) {
  const rng = mulberry32(seed);
  const W = 512;
  const H = 160;
  const cMap = mk(W, H);
  const cEm = mk(W, H);
  const m = cMap.getContext('2d');
  const e = cEm.getContext('2d');
  m.fillStyle = '#2a2724';
  m.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  const awnings = ['#8e1b1b', '#1b4d8e', '#1f6b3a', '#6b1f5c', '#b36b12', '#222'];
  const signs = ['#ff3b3b', '#3bd1ff', '#ffd23b', '#ff6bd6', '#6bff8e', '#ffffff'];
  for (let i = 0; i < 4; i++) {
    const x = i * 128;
    // sign band
    m.fillStyle = '#16181b';
    m.fillRect(x + 4, 8, 120, 26);
    const sc = pick(signs, rng);
    m.fillStyle = sc;
    m.fillRect(x + 14, 14, 60 + rng() * 40, 14);
    e.fillStyle = sc;
    e.globalAlpha = 0.9;
    e.fillRect(x + 14, 14, 60 + rng() * 40, 14);
    e.globalAlpha = 1;
    // awning
    m.fillStyle = pick(awnings, rng);
    m.fillRect(x + 2, 36, 124, 14);
    m.fillStyle = 'rgba(255,255,255,0.15)';
    for (let s = 0; s < 124; s += 12) m.fillRect(x + 2 + s, 36, 6, 14);
    // shop glass with warm interior
    const g = m.createLinearGradient(0, 52, 0, H - 6);
    g.addColorStop(0, '#3a3228');
    g.addColorStop(1, '#16130f');
    m.fillStyle = g;
    m.fillRect(x + 8, 52, 112, H - 60);
    const lg = e.createLinearGradient(0, 52, 0, H);
    const warm = rng() < 0.5 ? '#ffcf8a' : '#e9f2ff';
    lg.addColorStop(0, warm);
    lg.addColorStop(1, '#2b2016');
    e.fillStyle = lg;
    e.globalAlpha = 0.55 + rng() * 0.4;
    e.fillRect(x + 8, 52, 112, H - 60);
    e.globalAlpha = 1;
    // interior shelves silhouettes
    m.fillStyle = 'rgba(0,0,0,0.35)';
    e.fillStyle = 'rgba(0,0,0,0.6)';
    for (let s = 0; s < 3; s++) {
      m.fillRect(x + 12, 80 + s * 22, 104, 4);
      e.fillRect(x + 12, 80 + s * 22, 104, 4);
    }
    // frame + door
    m.fillStyle = '#0d0d0d';
    m.fillRect(x + 6, 50, 3, H - 56);
    m.fillRect(x + 119, 50, 3, H - 56);
    m.fillRect(x + 56, 50, 3, H - 56);
    m.fillStyle = '#4a4a4a';
    m.fillRect(x, 0, 4, H);
  }
  grain(m, W, H, 10, rng);
  return { map: toTex(cMap), emissive: toTex(cEm) };
}

export function roof(seed = 5) {
  const rng = mulberry32(seed);
  const S = 256;
  const c = mk(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#5d5d5b';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + rng() * 0.05})`;
    g.beginPath();
    g.arc(rng() * S, rng() * S, 6 + rng() * 30, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(0, i * 64);
    g.lineTo(S, i * 64);
    g.stroke();
  }
  grain(g, S, S, 40, rng);
  return toTex(c);
}

export function asphalt(seed = 9) {
  const rng = mulberry32(seed);
  const S = 512;
  const c = mk(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#2d2f33';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(${rng() < 0.6 ? '0,0,0' : '120,120,120'},${0.04 + rng() * 0.06})`;
    g.beginPath();
    g.ellipse(rng() * S, rng() * S, 10 + rng() * 60, 6 + rng() * 30, rng() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(10,10,10,0.5)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    let x = rng() * S;
    let y = rng() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (rng() - 0.5) * 30;
      y += (rng() - 0.5) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  grain(g, S, S, 36, rng);
  return toTex(c);
}

export function sidewalk(seed = 11) {
  const rng = mulberry32(seed);
  const S = 256;
  const c = mk(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#9a9791';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const v = Math.floor((rng() - 0.5) * 16);
      g.fillStyle = `rgb(${150 + v},${148 + v},${142 + v})`;
      g.fillRect(x * 64 + 1, y * 64 + 1, 62, 62);
    }
  }
  g.fillStyle = 'rgba(60,58,55,0.8)';
  for (let i = 0; i <= 4; i++) {
    g.fillRect(i * 64 - 1, 0, 2, S);
    g.fillRect(0, i * 64 - 1, S, 2);
  }
  // gum spots
  for (let i = 0; i < 30; i++) {
    g.fillStyle = 'rgba(40,40,40,0.35)';
    g.beginPath();
    g.arc(rng() * S, rng() * S, 1 + rng() * 2, 0, 7);
    g.fill();
  }
  grain(g, S, S, 22, rng);
  return toTex(c);
}

export function grass(seed = 13) {
  const rng = mulberry32(seed);
  const S = 256;
  const c = mk(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#3f6b2c';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(${40 + rng() * 60},${80 + rng() * 70},${20 + rng() * 30},0.35)`;
    g.fillRect(rng() * S, rng() * S, 2 + rng() * 5, 2 + rng() * 5);
  }
  grain(g, S, S, 30, rng);
  return toTex(c);
}

export function waterNormal(seed = 17) {
  const rng = mulberry32(seed);
  const S = 256;
  const h = new Float32Array(S * S);
  const waves = [];
  for (let i = 0; i < 18; i++) {
    const kx = Math.round((rng() - 0.5) * 16);
    const ky = Math.round((rng() - 0.5) * 16);
    waves.push([kx, ky, rng() * 6.28, 1 / (1 + Math.hypot(kx, ky))]);
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0;
      for (const [kx, ky, p, a] of waves) v += Math.sin(((kx * x + ky * y) / S) * Math.PI * 2 + p) * a;
      h[y * S + x] = v;
    }
  }
  const c = mk(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)];
      const dy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x];
      const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize();
      const i = (y * S + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTex(c, false);
}

// ---------------------------------------------------------------------------
// Suit fabric. Capsule UVs run around (u) and along (v) each limb, so a grid of
// dark lines reads as the classic web pattern.
export function suitRed() {
  const S = 512;
  const c = mk(S, S);
  const b = mk(S, S);
  const g = c.getContext('2d');
  const bg = b.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#c8141f');
  grad.addColorStop(0.5, '#b0101a');
  grad.addColorStop(1, '#c8141f');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  bg.fillStyle = '#000';
  bg.fillRect(0, 0, S, S);
  // subtle hex micro-texture
  g.globalAlpha = 0.07;
  g.fillStyle = '#000';
  for (let y = 0; y < S; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < S; x += 6) g.fillRect(x, y, 3, 3);
  g.globalAlpha = 1;

  const lines = (ctx, color, width, off) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (let i = 0; i <= 16; i++) {
      const x = (i / 16) * S + off;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, S);
      ctx.stroke();
    }
    for (let j = 0; j <= 12; j++) {
      const y0 = (j / 12) * S + off;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const x = (i / 16) * S;
        const y = y0 + Math.abs(Math.sin((i / 16) * Math.PI * 16)) * -7; // sagging web strands
        if (i === 0) ctx.moveTo(x, y);
        else ctx.quadraticCurveTo(x - S / 32, y + 7, x, y);
      }
      ctx.stroke();
    }
  };
  lines(g, 'rgba(255,90,90,0.35)', 1.2, 1.2);
  lines(g, '#1c0204', 2.4, 0);
  lines(bg, '#fff', 3, 0);
  const map = toTex(c);
  const bump = toTex(b, false);
  map.repeat.set(1, 1);
  return { map, bump };
}

export function suitBlue() {
  const S = 256;
  const c = mk(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#1c2f7c';
  g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.12;
  g.fillStyle = '#000';
  for (let y = 0; y < S; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < S; x += 4) g.fillRect(x, y, 2, 2);
  g.globalAlpha = 1;
  grain(g, S, S, 10, mulberry32(3));
  return toTex(c);
}

// Soft radial sprite used for particles, glows and light pools.
export function radial(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128;
  const c = mk(S, S);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.45)'));
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
