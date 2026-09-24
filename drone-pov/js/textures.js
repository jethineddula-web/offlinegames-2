/**
 * Procedural PBR-ish texture library — painted into offscreen canvases at boot,
 * so the game gets realistic asphalt / brick / glass / bark / rock surfaces with
 * zero downloads (fully offline).
 */
import * as THREE from "three";

const S = 256;

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
function mk() {
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  return c;
}
function speckle(g, r, count, colors, size, alpha = 1) {
  for (let i = 0; i < count; i++) {
    const c = colors[(r() * colors.length) | 0];
    g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha * (0.25 + r() * 0.75)})`;
    const s = size * (0.4 + r() * 1.6);
    g.fillRect(r() * S, r() * S, s, s);
  }
}
function blobs(g, r, count, colors, min, max, alpha = 0.7) {
  for (let i = 0; i < count; i++) {
    const c = colors[(r() * colors.length) | 0];
    g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha * (0.4 + r() * 0.6)})`;
    g.beginPath();
    g.arc(r() * S, r() * S, min + r() * (max - min), 0, Math.PI * 2);
    g.fill();
  }
}

function makeAsphalt(seed = 7) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(60, 61, 63); g.fillRect(0, 0, S, S);
  blobs(g, r, 26, [[72, 73, 76], [52, 53, 55], [80, 79, 76]], 14, 46, 0.35);
  speckle(g, r, 14000, [[90, 90, 92], [44, 44, 46], [110, 108, 104], [70, 68, 66]], 1.6, 0.75);
  g.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = `rgba(28,28,30,${0.25 + r() * 0.4})`;
    g.beginPath();
    let x = r() * S, y = r() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}
function makeRoad() {
  const c = makeAsphalt(11); const g = c.getContext("2d");
  g.fillStyle = "rgba(216,214,202,0.94)";
  g.fillRect(6, 0, 5, S); g.fillRect(S - 11, 0, 5, S);
  g.fillRect(S / 2 - 3.5, 0, 7, 96);
  return c;
}
function makeConcrete(seed = 3) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(178, 177, 170); g.fillRect(0, 0, S, S);
  blobs(g, r, 30, [[192, 191, 184], [158, 156, 149], [170, 168, 158]], 18, 52, 0.4);
  speckle(g, r, 9000, [[200, 199, 192], [140, 139, 132]], 1.4, 0.6);
  g.strokeStyle = "rgba(120,118,112,0.75)"; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(S, i * 64); g.stroke(); }
  g.beginPath(); g.moveTo(128, 0); g.lineTo(128, S); g.stroke();
  for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(130,128,120,${0.08 + r() * 0.12})`; g.fillRect(r() * S, 0, 3 + r() * 5, S); }
  return c;
}
function makeBrick(seed = 5) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(196, 188, 176); g.fillRect(0, 0, S, S);
  const bh = 16, bw = 32;
  for (let row = 0; row < S / bh; row++) {
    const off = (row % 2) * (bw / 2);
    for (let col = -1; col < S / bw + 1; col++) {
      const v = r();
      const base = v > 0.82 ? [122, 70, 52] : v > 0.45 ? [146, 78, 58] : [128, 66, 50];
      g.fillStyle = rgb(base[0] * (0.86 + r() * 0.3), base[1] * (0.86 + r() * 0.3), base[2] * (0.86 + r() * 0.3));
      g.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  speckle(g, r, 5000, [[90, 50, 40], [170, 120, 100]], 1.4, 0.35);
  return c;
}
function makeGlass(seed, night) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  const cols = 10, rows = 12;
  g.fillStyle = night ? rgb(24, 27, 34) : rgb(112, 124, 138); g.fillRect(0, 0, S, S);
  const cw = S / cols, ch = S / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = r(); let col;
    if (night) {
      col = v > 0.72 ? `rgb(${230 + r() * 25},${186 + r() * 40},${120 + r() * 50})`
        : v > 0.58 ? `rgb(${170 + r() * 40},${200 + r() * 30},225)`
        : `rgb(${12 + r() * 12},${14 + r() * 14},${20 + r() * 16})`;
    } else {
      col = v > 0.78 ? `rgb(${196 + r() * 40},${216 + r() * 30},232)`
        : v > 0.4 ? `rgb(${92 + r() * 30},${108 + r() * 30},${126 + r() * 30})`
        : `rgb(${58 + r() * 20},${66 + r() * 22},${80 + r() * 22})`;
    }
    g.fillStyle = col; g.fillRect(x * cw + 2, y * ch + 2, cw - 4, ch - 4);
  }
  g.strokeStyle = night ? "rgba(18,20,26,0.95)" : "rgba(74,78,86,0.9)"; g.lineWidth = 2.5;
  for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y * ch); g.lineTo(S, y * ch); g.stroke(); }
  for (let x = 0; x <= cols; x++) { g.beginPath(); g.moveTo(x * cw, 0); g.lineTo(x * cw, S); g.stroke(); }
  g.fillStyle = night ? "rgba(30,34,42,0.85)" : "rgba(150,152,158,0.7)";
  for (let y = 0; y <= rows; y += 4) g.fillRect(0, y * ch - 1, S, 3);
  return c;
}
function makeMetal(seed = 9) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(146, 150, 156); g.fillRect(0, 0, S, S);
  g.fillStyle = "rgba(108,112,118,0.7)"; for (let x = 0; x < S; x += 10) g.fillRect(x, 0, 3, S);
  g.fillStyle = "rgba(196,200,206,0.5)"; for (let x = 5; x < S; x += 10) g.fillRect(x, 0, 2, S);
  speckle(g, r, 4000, [[120, 120, 122], [180, 180, 182]], 1.2, 0.3);
  return c;
}
function makeCorrugated(seed = 13) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(226, 226, 224); g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 8) {
    g.fillStyle = "rgba(150,150,148,0.42)"; g.fillRect(x, 0, 3, S);
    g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x + 4, 0, 2, S);
  }
  blobs(g, r, 14, [[180, 160, 140], [140, 140, 138]], 10, 40, 0.18);
  return c;
}
function makeBark(seed = 17) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(84, 62, 44); g.fillRect(0, 0, S, S);
  for (let i = 0; i < 130; i++) {
    const x = r() * S, w = 2 + r() * 6, v = r();
    g.fillStyle = v > 0.5 ? `rgba(58,40,28,${0.35 + r() * 0.4})` : `rgba(120,94,68,${0.3 + r() * 0.4})`;
    g.fillRect(x, r() * 30, w, S * (0.35 + r() * 0.7));
  }
  speckle(g, r, 6000, [[48, 34, 24], [110, 86, 62]], 2, 0.4);
  return c;
}
function makeFoliage(seed, dark) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = dark ? rgb(28, 52, 32) : rgb(52, 92, 46); g.fillRect(0, 0, S, S);
  const palette = dark
    ? [[26, 50, 30], [34, 64, 38], [20, 40, 26], [46, 78, 44]]
    : [[58, 104, 50], [44, 84, 40], [76, 126, 62], [34, 66, 34], [96, 142, 70]];
  for (let i = 0; i < 1400; i++) {
    const p = palette[(r() * palette.length) | 0];
    g.fillStyle = `rgba(${p[0]},${p[1]},${p[2]},${0.35 + r() * 0.5})`;
    const s = 5 + r() * 16;
    g.beginPath(); g.ellipse(r() * S, r() * S, s, s * (0.6 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  speckle(g, r, 3000, [[18, 34, 20], [120, 160, 90]], 2, 0.4);
  return c;
}
function makeGrass(seed = 23) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(74, 106, 56); g.fillRect(0, 0, S, S);
  blobs(g, r, 60, [[86, 118, 62], [62, 92, 48], [104, 128, 70], [56, 82, 44]], 16, 54, 0.5);
  for (let i = 0; i < 2600; i++) {
    const x = r() * S, y = r() * S, h = 3 + r() * 7;
    g.strokeStyle = r() > 0.5 ? "rgba(122,150,80,0.55)" : "rgba(58,84,42,0.55)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - h); g.stroke();
  }
  return c;
}
function makeDirt(seed = 29) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(112, 92, 68); g.fillRect(0, 0, S, S);
  blobs(g, r, 50, [[128, 106, 78], [92, 74, 54], [142, 122, 92]], 14, 48, 0.5);
  speckle(g, r, 12000, [[86, 68, 50], [150, 130, 100], [70, 56, 42]], 1.8, 0.6);
  return c;
}
function makeStrata(seed = 31) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  const bands = [[170, 106, 68], [146, 84, 54], [186, 124, 82], [126, 72, 48], [160, 100, 66], [196, 138, 92]];
  let y = 0, i = 0;
  while (y < S) { const h = 10 + r() * 30; const b = bands[i++ % bands.length]; g.fillStyle = rgb(b[0], b[1], b[2]); g.fillRect(0, y, S, h + 2); y += h; }
  for (let k = 0; k < 2400; k++) {
    g.fillStyle = `rgba(${60 + r() * 120},${40 + r() * 90},${30 + r() * 60},${0.15 + r() * 0.25})`;
    g.fillRect(r() * S, r() * S, 2 + r() * 6, 1 + r() * 2);
  }
  return c;
}
function makeRock(seed = 37) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(126, 122, 116); g.fillRect(0, 0, S, S);
  blobs(g, r, 70, [[146, 142, 134], [104, 100, 96], [116, 116, 112], [154, 148, 138]], 12, 44, 0.55);
  speckle(g, r, 9000, [[90, 88, 84], [166, 162, 152]], 2, 0.5);
  g.strokeStyle = "rgba(70,68,64,0.5)"; g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}
function makeSand(seed = 41) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(206, 178, 126); g.fillRect(0, 0, S, S);
  blobs(g, r, 40, [[222, 198, 148], [188, 160, 110], [214, 190, 140]], 20, 60, 0.35);
  speckle(g, r, 16000, [[176, 148, 100], [232, 212, 168]], 1.2, 0.5);
  g.strokeStyle = "rgba(178,150,104,0.35)";
  for (let i = 0; i < 40; i++) { g.beginPath(); const y = r() * S; g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 16, S * 0.7, y + (r() - 0.5) * 16, S, y); g.stroke(); }
  return c;
}
function makeSnow(seed = 43) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(240, 246, 252); g.fillRect(0, 0, S, S);
  blobs(g, r, 60, [[214, 226, 240], [252, 254, 255], [226, 236, 248]], 18, 60, 0.4);
  speckle(g, r, 3000, [[200, 216, 234], [255, 255, 255]], 1.6, 0.35);
  return c;
}
function makeIce(seed = 47) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(186, 220, 238); g.fillRect(0, 0, S, S);
  blobs(g, r, 40, [[206, 234, 246], [160, 198, 222], [222, 242, 250]], 20, 64, 0.45);
  g.strokeStyle = "rgba(255,255,255,0.75)";
  for (let i = 0; i < 26; i++) {
    g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}
function makeWater(seed = 53) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(38, 88, 124); g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(${120 + r() * 90},${170 + r() * 70},${200 + r() * 55},${0.12 + r() * 0.28})`; g.lineWidth = 1 + r() * 3;
    const y = r() * S; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S * 0.25, y + (r() - 0.5) * 10, S * 0.75, y + (r() - 0.5) * 10, S, y + (r() - 0.5) * 6); g.stroke();
  }
  return c;
}
function makePlank(seed = 59) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(150, 116, 76); g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 32) {
    const v = 0.85 + r() * 0.3;
    g.fillStyle = rgb(150 * v, 116 * v, 76 * v); g.fillRect(x, 0, 30, S);
    g.strokeStyle = "rgba(74,54,34,0.8)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 31, 0); g.lineTo(x + 31, S); g.stroke();
    for (let k = 0; k < 26; k++) {
      g.strokeStyle = `rgba(112,84,54,${0.15 + r() * 0.3})`; g.lineWidth = 1; const gy = r() * S;
      g.beginPath(); g.moveTo(x + 2, gy); g.bezierCurveTo(x + 10, gy + (r() - 0.5) * 8, x + 20, gy + (r() - 0.5) * 8, x + 29, gy); g.stroke();
    }
    if (r() > 0.6) { g.fillStyle = "rgba(90,66,42,0.5)"; g.beginPath(); g.arc(x + 8 + r() * 16, r() * S, 2 + r() * 3, 0, Math.PI * 2); g.fill(); }
  }
  return c;
}
function makeGateStripe() {
  const c = mk(); const g = c.getContext("2d");
  g.fillStyle = rgb(244, 244, 240); g.fillRect(0, 0, S, S);
  g.fillStyle = rgb(255, 118, 26);
  for (let x = -S; x < S * 2; x += 64) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 - S * 0.5, S); g.lineTo(x - S * 0.5, S); g.closePath(); g.fill();
  }
  speckle(g, prng(3), 2000, [[200, 200, 195], [215, 210, 205]], 1.4, 0.25);
  return c;
}
function makePanel(seed = 61) {
  const c = mk(); const g = c.getContext("2d"); const r = prng(seed);
  g.fillStyle = rgb(232, 232, 228); g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 14) {
    g.fillStyle = "rgba(160,160,156,0.45)"; g.fillRect(x, 0, 5, S);
    g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x + 8, 0, 3, S);
  }
  blobs(g, r, 12, [[150, 140, 130], [190, 190, 186]], 12, 40, 0.16);
  speckle(g, r, 2500, [[150, 130, 110], [200, 200, 196]], 2, 0.2);
  return c;
}

const MAKERS = {
  asphalt: () => makeAsphalt(), road: () => makeRoad(), concrete: () => makeConcrete(), brick: () => makeBrick(),
  glass: () => makeGlass(71, false), glassNight: () => makeGlass(73, true), metal: () => makeMetal(),
  corrugated: () => makeCorrugated(), bark: () => makeBark(), foliage: () => makeFoliage(79, false),
  pine: () => makeFoliage(83, true), grass: () => makeGrass(), dirt: () => makeDirt(), strata: () => makeStrata(),
  rock: () => makeRock(), sand: () => makeSand(), snow: () => makeSnow(), ice: () => makeIce(), water: () => makeWater(),
  plank: () => makePlank(), gate: () => makeGateStripe(), panel: () => makePanel(),
};

const cache = new Map();
let aniso = 4;

export function setAnisotropy(a) {
  aniso = Math.max(1, Math.min(16, Math.round(a)));
  cache.forEach((t) => { t.anisotropy = aniso; t.needsUpdate = true; });
}

/** Cached, repeat-wrapped SRGB texture. */
export function getTexture(name) {
  let t = cache.get(name);
  if (t) return t;
  const maker = MAKERS[name] || MAKERS.concrete;
  t = new THREE.CanvasTexture(maker());
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  cache.set(name, t);
  return t;
}

/** A texture instance with its own repeat. */
export function tiled(name, rx, ry) {
  const base = getTexture(name);
  const t = base.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  t.anisotropy = aniso;
  return t;
}
