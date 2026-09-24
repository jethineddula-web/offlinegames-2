/**
 * Procedural world generation — real-world edition.
 *  • buildTrack — racing line (Catmull-Rom) + arc-length samples + race gates
 *  • buildWorld — per-location terrain, buildings, trees, roads, water,
 *                 moving machinery, colliders, hazards and target boards.
 */
import * as THREE from "three";
import { makeRng } from "./rng.js";
import { tiled } from "./textures.js";

const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
export const WATER_Y = -14;

/* ------------------------------------------------------------------ track */
export function buildTrack(level) {
  const rng = makeRng(level.seed);
  const pts = [];
  let heading = 0;
  let pos = new THREE.Vector3(0, level.baseAltitude, 0);
  pts.push(pos.clone());
  let turnBias = rng.sym() * 0.2;
  for (let i = 0; i < level.segments; i++) {
    let turn = rng.sym() * level.curviness * 0.62 + turnBias;
    turn = THREE.MathUtils.clamp(turn, -0.85, 0.85);
    turnBias = THREE.MathUtils.clamp(turnBias + rng.sym() * 0.08, -0.28, 0.28);
    heading += turn;
    const dy = Math.sin(i * 0.55) * level.verticality * 16 + rng.sym() * level.verticality * 14;
    const next = new THREE.Vector3(pos.x + Math.sin(heading) * level.segLength, Math.max(12, pos.y + dy), pos.z + Math.cos(heading) * level.segLength);
    for (let j = 0; j < pts.length - 3; j++) {
      if (next.distanceTo(pts[j]) < level.segLength * 0.95) {
        heading -= turn * 2.1;
        next.set(pos.x + Math.sin(heading) * level.segLength, next.y, pos.z + Math.cos(heading) * level.segLength);
        turnBias = -turnBias;
        break;
      }
    }
    pts.push(next);
    pos = next;
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
  const length = curve.getLength();
  const n = Math.max(32, Math.floor(length / 5));
  const samples = curve.getSpacedPoints(n);
  const tangents = [];
  for (let i = 0; i <= n; i++) tangents.push(curve.getTangentAt(Math.min(1, i / n)).normalize());
  const gateCount = Math.max(6, level.segments - 2);
  const gates = [];
  for (let i = 0; i < gateCount; i++) {
    const u = 0.045 + (i / (gateCount - 1)) * 0.94;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u).normalize();
    gates.push({ p, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t), n: t, r: level.gateRadius });
  }
  return { curve, samples, tangents, spacing: length / n, length, gates };
}

/* -------------------------------------------------------- build utilities */
class Builder {
  constructor() {
    this.buckets = new Map();
    this.colliders = [];
    this.group = new THREE.Group();
    this.disposables = [];
    this.spinners = [];
  }
  add(key, geo, mat, m, color) {
    let b = this.buckets.get(key);
    if (!b) {
      b = { geo, mat, m: [], c: color ? [] : null };
      this.buckets.set(key, b);
      this.disposables.push(geo, mat);
    }
    b.m.push(m);
    if (color && b.c) b.c.push(color);
  }
  box(p, h, q, bounce = 0.32) {
    this.colliders.push({ p: p.clone(), h: h.clone(), q: (q || new THREE.Quaternion()).clone(), br: h.length(), bounce });
  }
  obj(o) {
    this.group.add(o);
    return o;
  }
  finish() {
    this.buckets.forEach((b) => {
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.m.length);
      for (let i = 0; i < b.m.length; i++) {
        im.setMatrixAt(i, b.m[i]);
        if (b.c) im.setColorAt(i, b.c[i]);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.group.add(im);
    });
    return this.group;
  }
}

const mat4 = (pos, scale, quat) => new THREE.Matrix4().compose(pos, quat || new THREE.Quaternion(), scale);
function tmat(name, rx, ry, opts = {}) {
  return new THREE.MeshStandardMaterial({ map: tiled(name, rx, ry), roughness: 0.9, metalness: 0.05, ...opts });
}
function plain(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...opts });
}
function lamp(color) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}
function pointOn(track, u, lateral, vertical, out = new THREE.Vector3()) {
  const p = track.curve.getPointAt(THREE.MathUtils.clamp(u, 0, 1));
  const t = track.curve.getTangentAt(THREE.MathUtils.clamp(u, 0, 1)).normalize();
  const right = tmpV.copy(t).cross(UP).normalize();
  if (right.lengthSq() < 0.01) right.set(1, 0, 0);
  out.copy(p).addScaledVector(right, lateral).addScaledVector(UP, vertical);
  return out;
}

function ambientParticles(level, count, spread, color, size) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.68, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.userData.spread = spread;
  const drift = {
    alpine: [3, -11, 1], glacier: [3, -9, 1], farmland: [6, -26, 3], coast: [5, -2, 2], harbor: [4, -1, 2],
    desert: [9, -1.5, 4], canyon: [6, -2, 3], volcano: [2, 6, 1], forest: [2.5, -2, 1.5], downtown: [2, -2, 1], nightcity: [1.5, -1.5, 1],
  };
  const d = drift[level.biome] || [0, -2, 0];
  pts.userData.drift = new THREE.Vector3(d[0], d[1], d[2]);
  return pts;
}

/* ============================================================ main world */
export function buildWorld(level, track, quality) {
  const rng = makeRng(level.seed + 7717);
  const b = new Builder();
  const lights = [], zones = [], movers = [], turretSpots = [], enemySpots = [], targetSpots = [], gemSpots = [];
  const qMul = quality === "low" ? 0.45 : quality === "medium" ? 0.75 : 1;
  const N = (n) => Math.max(4, Math.round(n * qMul));
  const natural = ["canyon", "alpine", "forest", "desert", "farmland", "glacier", "volcano"].includes(level.biome);

  const bb = new THREE.Box3().setFromPoints(track.samples);
  const centre = bb.getCenter(new THREE.Vector3());
  const span = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);

  const at = (u, lat, vert = 0) => pointOn(track, u, lat, vert).clone();
  const quatAlong = (u) => {
    const t = track.curve.getTangentAt(THREE.MathUtils.clamp(u, 0, 1)).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t);
  };
  const quatY = (angle) => new THREE.Quaternion().setFromAxisAngle(UP, angle);

  const gBox = new THREE.BoxGeometry(1, 1, 1);
  const gCyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const gCone = new THREE.ConeGeometry(1, 1, 10);
  const gPyr = new THREE.ConeGeometry(1, 1, 4);
  const gIco = new THREE.IcosahedronGeometry(1, 0);
  const gQuad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  const M = {
    ground: tmat(level.groundTex, 40, 40, { roughness: natural ? 0.98 : 0.92 }),
    road: tmat("road", 1, 1, { roughness: 0.82 }),
    asphalt: tmat("asphalt", 6, 6, { roughness: 0.88 }),
    curb: tmat("concrete", 6, 1, { roughness: 0.95 }),
    concrete: tmat("concrete", 3, 5, { roughness: 0.95 }),
    concreteBig: tmat("concrete", 6, 3, { roughness: 0.94 }),
    brick: tmat("brick", 5, 7, { roughness: 0.96 }),
    towerLow: tmat("glass", 3, 3, { roughness: 0.42, metalness: 0.3 }),
    towerMid: tmat("glass", 5, 8, { roughness: 0.42, metalness: 0.3 }),
    towerTall: tmat("glass", 6, 14, { roughness: 0.42, metalness: 0.3 }),
    towerLowN: tmat("glassNight", 3, 3, { roughness: 0.35, metalness: 0.2, emissive: 0xffffff, emissiveMap: tiled("glassNight", 3, 3), emissiveIntensity: 0.55 }),
    towerMidN: tmat("glassNight", 5, 8, { roughness: 0.35, metalness: 0.2, emissive: 0xffffff, emissiveMap: tiled("glassNight", 5, 8), emissiveIntensity: 0.55 }),
    towerTallN: tmat("glassNight", 6, 14, { roughness: 0.35, metalness: 0.2, emissive: 0xffffff, emissiveMap: tiled("glassNight", 6, 14), emissiveIntensity: 0.55 }),
    roof: tmat("asphalt", 3, 3, { roughness: 0.95 }),
    metal: tmat("metal", 4, 4, { roughness: 0.55, metalness: 0.7 }),
    corrugated: tmat("corrugated", 5, 3, { roughness: 0.6, metalness: 0.5 }),
    rust: tmat("metal", 3, 3, { color: 0x8a6a52, roughness: 0.8, metalness: 0.5 }),
    panel: tmat("panel", 2, 1, { roughness: 0.62, metalness: 0.28 }),
    plank: tmat("plank", 4, 2, { roughness: 0.9 }),
    bark: tmat("bark", 2, 4, { roughness: 0.98 }),
    foliage: tmat("foliage", 2, 2, { roughness: 0.98 }),
    pine: tmat("pine", 2, 2, { roughness: 0.98 }),
    scrub: tmat("foliage", 1, 1, { color: 0x6d7a44, roughness: 0.98 }),
    rock: tmat("rock", 4, 4, { roughness: 0.98 }),
    dirt: tmat("dirt", 8, 8, { roughness: 0.98 }),
    strata: tmat("strata", 5, 3, { roughness: 0.98 }),
    sand: tmat("sand", 10, 10, { roughness: 0.98 }),
    snow: tmat("snow", 6, 6, { roughness: 0.7 }),
    ice: tmat("ice", 4, 4, { roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.94 }),
    water: tmat("water", 26, 26, { roughness: 0.28, metalness: 0, emissive: 0x2c5c80, emissiveIntensity: 0.6 }),
    top: tmat("grass", 4, 4, { roughness: 0.96 }),
    roofA: plain(0x8d4a3a, { roughness: 0.9 }),
    roofB: plain(0x4d5158, { roughness: 0.9 }),
    roofC: plain(0x6b6152, { roughness: 0.9 }),
    hay: plain(0xc9a34f, { roughness: 0.95 }),
    chimney: plain(0x9c5a48, { roughness: 0.95 }),
    trim: plain(0x333a42, { roughness: 0.5, metalness: 0.2 }),
    red: plain(0xb0281f),
    white: plain(0xecece6),
    dark: plain(0x2b2f33),
    siteOrange: plain(0xf07a12),
    container: tmat("panel", 3, 1, { roughness: 0.7, metalness: 0.2 }),
    lampWarm: lamp(0xffd9a0),
    lampWhite: lamp(0xeaf2ff),
    lava: lamp(0xff5a18),
  };

  /* ================= TERRAIN ================= */
  const amps = { alpine: 34, glacier: 26, canyon: 18, forest: 16, volcano: 30, desert: 14, farmland: 8, coast: 10 };
  const amp = amps[level.biome] || 0;
  const terrainY = (x, z) => {
    if (!amp) return -18;
    const d = Math.hypot(x - centre.x, z - centre.z);
    const fade = THREE.MathUtils.clamp((d - level.corridor * 2.2) / 320, 0, 1);
    return -18 + fade * (Math.sin(x * 0.0042) * Math.cos(z * 0.0036) * amp + Math.sin(x * 0.0123 + z * 0.0091) * amp * 0.34);
  };
  {
    const size = Math.max(2600, span + 1800);
    const seg = quality === "low" ? 24 : 56;
    const gg = new THREE.PlaneGeometry(size, size, seg, seg);
    gg.rotateX(-Math.PI / 2);
    if (amp > 0) {
      const attr = gg.attributes.position;
      for (let i = 0; i < attr.count; i++) attr.setY(i, terrainY(attr.getX(i) + centre.x, attr.getZ(i) + centre.z) + 18);
      gg.computeVertexNormals();
    }
    const gm = new THREE.Mesh(gg, M.ground);
    gm.position.set(centre.x, -18, centre.z);
    b.obj(gm);
    b.disposables.push(gg);
    if (level.water) {
      const wg = new THREE.PlaneGeometry(size + 900, size + 900, 1, 1);
      wg.rotateX(-Math.PI / 2);
      const wm = new THREE.Mesh(wg, M.water);
      wm.position.set(centre.x, WATER_Y, centre.z);
      wm.renderOrder = 1;
      b.obj(wm);
      b.disposables.push(wg);
    }
  }

  /* ================= ROADS ================= */
  const buildRoad = (opts) => {
    const width = opts.width ?? 18;
    const stride = 0.012;
    const surface = opts.surface || M.road;
    for (let u = opts.u0; u < opts.u1; u += stride) {
      const u2 = Math.min(opts.u1, u + stride * 1.06);
      const p0 = at(u, opts.lat);
      const p1 = at(u2, opts.lat);
      if (opts.onGround) {
        p0.y = terrainY(p0.x, p0.z) + 0.4;
        p1.y = terrainY(p1.x, p1.z) + 0.4;
      } else if (opts.flatY !== undefined) {
        p0.y = opts.flatY;
        p1.y = opts.flatY;
      }
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const len = p0.distanceTo(p1) * 1.06;
      const dir = p1.clone().sub(p0).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      b.add("road", gQuad, surface, mat4(mid, new THREE.Vector3(width, 1, len), q));
      const right = new THREE.Vector3().copy(dir).cross(UP).normalize();
      if (opts.kerb) {
        for (const s of [-1, 1]) {
          const kp = mid.clone().addScaledVector(right, (s * width) / 2);
          b.add("kerb", gBox, M.curb, mat4(kp, new THREE.Vector3(1.2, 0.7, len), q));
        }
      }
      if (opts.rails) {
        for (const s of [-1, 1]) {
          const rp = mid.clone().addScaledVector(right, (s * width) / 2 + s * 1.4);
          rp.y += 1.3;
          b.add("rail", gBox, M.metal, mat4(rp, new THREE.Vector3(0.35, 0.9, len), q));
        }
      }
      if (opts.lamps && Math.round((u - opts.u0) / stride) % 2 === 0) {
        const s = rng.chance(0.5) ? 1 : -1;
        const lp = mid.clone().addScaledVector(right, (s * width) / 2 + s * 2.6);
        b.add("pole", gCyl, M.metal, mat4(lp.clone().setY(lp.y + 7), new THREE.Vector3(0.35, 14, 0.35)));
        b.add("polearm", gBox, M.metal, mat4(lp.clone().setY(lp.y + 13.6), new THREE.Vector3(3.6, 0.3, 0.3), q));
        b.add(opts.night ? "lampN" : "lampD", gBox, opts.night ? M.lampWarm : M.lampWhite, mat4(lp.clone().setY(lp.y + 13.4), new THREE.Vector3(1.4, 0.5, 0.8), q));
      }
    }
  };

  /* ================= PROP BUILDERS ================= */
  const addTree = (x, _y, z, kind, h) => {
    const y = terrainY(x, z);
    const trunkR = Math.max(0.5, h * 0.035);
    b.add("trunk", gCyl, M.bark, mat4(new THREE.Vector3(x, y + h * 0.3, z), new THREE.Vector3(trunkR, h * 0.62, trunkR)));
    if (kind === "pine") {
      for (let i = 0; i < 3; i++) {
        const f = i / 3;
        const cy = y + h * (0.34 + f * 0.48);
        const r = h * (0.34 - f * 0.09);
        b.add("pine", gCone, M.pine, mat4(new THREE.Vector3(x, cy, z), new THREE.Vector3(r, h * 0.42, r)));
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + h;
        const r = h * (0.4 + (i % 2) * 0.08);
        b.add("leafy", gIco, M.foliage, mat4(new THREE.Vector3(x + Math.cos(a) * h * 0.14, y + h * (0.62 + i * 0.06), z + Math.sin(a) * h * 0.14), new THREE.Vector3(r, r * 0.86, r)));
      }
    }
    b.box(new THREE.Vector3(x, y + h * 0.3, z), new THREE.Vector3(trunkR * 1.2, h * 0.3, trunkR * 1.2), undefined, 0.45);
  };

  const addTower = (x, z, hMax, night) => {
    let y = terrainY(x, z);
    const h = rng.range(38, hMax);
    const tiers = h > 110 ? 3 : h > 70 ? 2 : 1;
    let w = rng.range(20, 34);
    for (let t = 0; t < tiers; t++) {
      const th = h / tiers;
      const mat = h > 130 ? (night ? M.towerTallN : M.towerTall) : h > 70 ? (night ? M.towerMidN : M.towerMid) : night ? M.towerLowN : M.towerLow;
      const key = h > 130 ? "towerT" : h > 70 ? "towerM" : "towerL";
      b.add(key + (night ? "N" : ""), gBox, mat, mat4(new THREE.Vector3(x, y + th / 2, z), new THREE.Vector3(w, th, w * rng.range(0.78, 1.18))));
      b.box(new THREE.Vector3(x, y + th / 2, z), new THREE.Vector3(w / 2, th / 2, w / 2));
      y += th;
      w *= rng.range(0.72, 0.9);
    }
    b.add("roofdeco", gBox, M.roof, mat4(new THREE.Vector3(x, y + 1.6, z), new THREE.Vector3(w * 0.9, 3.2, w * 0.9)));
    b.add("ac", gBox, M.metal, mat4(new THREE.Vector3(x + w * 0.2, y + 4.2, z - w * 0.16), new THREE.Vector3(w * 0.3, 3, w * 0.3)));
    if (rng.chance(0.5)) {
      b.add("mast", gCyl, M.metal, mat4(new THREE.Vector3(x - w * 0.25, y + 11, z + w * 0.2), new THREE.Vector3(0.28, 20, 0.28)));
      if (night) b.add("beacon", gBox, M.red, mat4(new THREE.Vector3(x - w * 0.25, y + 21, z + w * 0.2), new THREE.Vector3(1.1, 1.1, 1.1)));
    }
  };

  const addBlock = (q, x, z, w, d, h, night) => {
    const y = terrainY(x, z);
    b.add("block", gBox, M.brick, mat4(new THREE.Vector3(x, y + h / 2, z), new THREE.Vector3(w, h, d), q));
    b.add("blockband", gBox, M.concrete, mat4(new THREE.Vector3(x, y - 1.2, z), new THREE.Vector3(w * 1.02, 1.6, d * 1.02), q));
    b.add("blockroof", gBox, M.roof, mat4(new THREE.Vector3(x, y + h + 0.6, z), new THREE.Vector3(w, 1.2, d), q));
    if (night) b.add("shopN", gBox, M.lampWarm, mat4(new THREE.Vector3(x, y + 4.2, z), new THREE.Vector3(w * 0.94, 4.4, d * 1.02), q));
    else b.add("shop", gBox, M.metal, mat4(new THREE.Vector3(x, y + 4.2, z), new THREE.Vector3(w * 0.94, 4.4, d * 1.03), q));
    b.box(new THREE.Vector3(x, y + h / 2, z), new THREE.Vector3(w / 2, h / 2, d / 2), q);
  };

  const ROOFS = [["roofA", M.roofA], ["roofB", M.roofB], ["roofC", M.roofC]];
  const addHouse = (x, z, rot, w, wallMat, wallKey) => {
    const y = terrainY(x, z);
    const q = quatY(rot);
    const h = rng.range(4.5, 7);
    const [rk, rm] = ROOFS[rng.int(0, ROOFS.length - 1)];
    b.add(wallKey, gBox, wallMat, mat4(new THREE.Vector3(x, y + h / 2, z), new THREE.Vector3(w, h, w * rng.range(0.7, 1)), q));
    b.add(rk, gPyr, rm, mat4(new THREE.Vector3(x, y + h + w * 0.19, z), new THREE.Vector3(w * 0.78, w * 0.42, w * 0.78), quatY(rot + Math.PI / 4)));
    if (rng.chance(0.55)) b.add("chimney", gBox, M.chimney, mat4(new THREE.Vector3(x + w * 0.24, y + h + w * 0.32, z), new THREE.Vector3(1.3, w * 0.5, 1.3), q));
    b.add("housetrim", gBox, M.trim, mat4(new THREE.Vector3(x, y + h * 0.62, z), new THREE.Vector3(w * 1.02, h * 0.24, w * 1.03), q));
    b.box(new THREE.Vector3(x, y + h / 2, z), new THREE.Vector3(w / 2, h / 2, w / 2), q);
  };

  const addCar = (p, rot, color, night) => {
    const gy = terrainY(p.x, p.z) + 0.1; // firmly on the ground
    const q = quatY(rot);
    const tint = new THREE.Color(color);
    b.add("carbody", gBox, M.panel, mat4(new THREE.Vector3(p.x, gy + 1.1, p.z), new THREE.Vector3(2.1, 1.5, 4.7), q), tint);
    b.add("carcabin", gBox, M.towerLow, mat4(new THREE.Vector3(p.x, gy + 2.35, p.z), new THREE.Vector3(1.9, 1.1, 2.6), q), tint);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.add("wheel", gCyl, M.dark, mat4(new THREE.Vector3(p.x + sx * 0.95, gy + 0.6, p.z + sz * 1.5), new THREE.Vector3(0.62, 0.5, 0.62), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)));
    }
    if (night) {
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      b.add("headlamp", gBox, M.lampWhite, mat4(new THREE.Vector3(p.x, gy + 1.2, p.z).addScaledVector(fwd, 2.4), new THREE.Vector3(2, 0.4, 0.2), q));
    }
  };

  const addContainerStack = (x, y, z, rot, night) => {
    const q = quatY(rot);
    const rows = rng.int(1, 3), cols = rng.int(1, 3);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const tint = new THREE.Color().setHSL(rng.range(0, 1), rng.range(0.35, 0.7), night ? rng.range(0.28, 0.42) : rng.range(0.4, 0.58));
      const p = new THREE.Vector3(x, y + 1.4 + r * 2.9, z).add(new THREE.Vector3((c - cols / 2) * 2.55, 0, (r + 1) * 12.5).applyQuaternion(q));
      b.add("cont", gBox, M.container, mat4(p, new THREE.Vector3(2.45, 2.8, 12.2), q), tint);
      b.box(p, new THREE.Vector3(1.25, 1.4, 6.1), q, 0.4);
    }
  };

  const addCrane = (p, rot, spanY) => {
    const g = new THREE.Group();
    const legGeo = new THREE.BoxGeometry(1.4, 26, 1.4);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, M.metal);
      leg.position.set(sx * spanY * 0.5, 13, sz * 9);
      g.add(leg);
    }
    const girder = new THREE.Mesh(new THREE.BoxGeometry(spanY + 8, 2.4, 3), M.metal);
    girder.position.set(0, 26.6, 0);
    g.add(girder);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(spanY * 0.9, 1.6, 2.2), M.metal);
    boom.position.set(0, 25.2, 12);
    boom.rotation.x = -0.28;
    g.add(boom);
    g.position.copy(p);
    g.rotation.y = rot;
    b.obj(g);
    b.disposables.push(legGeo, girder.geometry, boom.geometry);
    return g;
  };

  const gNacelle = new THREE.BoxGeometry(4, 3.4, 8);
  const gBlade = new THREE.BoxGeometry(1.1, 1, 0.4);
  b.disposables.push(gNacelle, gBlade);
  const addWindTurbine = (p, scale = 1) => {
    const g = new THREE.Group();
    const towerH = 78 * scale;
    b.add("ttower", gCyl, M.white, mat4(new THREE.Vector3(p.x, p.y + towerH / 2, p.z), new THREE.Vector3(2.1 * scale, towerH, 2.1 * scale)));
    const nacelle = new THREE.Mesh(gNacelle, M.white);
    nacelle.position.set(0, towerH + 1.4, 0);
    g.add(nacelle);
    const rotor = new THREE.Group();
    rotor.position.set(0, towerH + 1.4, 4.6);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(gBlade, M.white);
      blade.scale.set(1, 26 * scale, 1);
      blade.position.set(0, 13 * scale, 0);
      const holder = new THREE.Group();
      holder.rotation.z = (i / 3) * Math.PI * 2;
      holder.add(blade);
      rotor.add(holder);
    }
    g.add(rotor);
    g.position.copy(p);
    b.obj(g);
    b.spinners.push({ obj: rotor, axis: "z", speed: 0.35 + rng.next() * 0.5 });
    b.box(new THREE.Vector3(p.x, p.y + towerH / 2, p.z), new THREE.Vector3(2.4 * scale, towerH / 2, 2.4 * scale), undefined, 0.4);
  };

  const addPylon = (p, rot) => {
    const q = quatY(rot);
    b.add("pylonleg", gBox, M.metal, mat4(new THREE.Vector3(p.x - 5, p.y + 13, p.z), new THREE.Vector3(1.1, 26, 1.1), q));
    b.add("pylonleg", gBox, M.metal, mat4(new THREE.Vector3(p.x + 5, p.y + 13, p.z), new THREE.Vector3(1.1, 26, 1.1), q));
    for (let i = 0; i < 3; i++) b.add("pylonbar", gBox, M.metal, mat4(new THREE.Vector3(p.x, p.y + 12 + i * 6, p.z), new THREE.Vector3(20 - i * 3, 0.8, 0.8), q));
    b.box(new THREE.Vector3(p.x, p.y + 13, p.z), new THREE.Vector3(6, 13, 1.2), q, 0.4);
  };

  /* ================= PER-BIOME SCENERY ================= */
  const side = (i) => (i % 2 ? 1 : -1);
  const rside = () => (rng.chance(0.5) ? 1 : -1);
  const C = level.corridor;

  switch (level.biome) {
    case "nightcity":
    case "downtown": {
      const night = level.night;
      buildRoad({ u0: 0.03, u1: 0.98, lat: C * 1.5, width: 22, kerb: true, lamps: true, night, onGround: true });
      buildRoad({ u0: 0.2, u1: 0.5, lat: -C * 1.7, width: 16, kerb: true, lamps: true, night, onGround: true });
      buildRoad({ u0: 0.6, u1: 0.9, lat: -C * 1.6, width: 14, kerb: true, night, onGround: true });
      for (let i = 0; i < N(320); i++) {
        const u = rng.range(0.005, 0.995);
        const p = at(u, side(i) * rng.range(C * 1.05, C * 4.2));
        if (rng.chance(0.4)) addBlock(quatAlong(u), p.x, p.z, rng.range(16, 34), rng.range(14, 28), rng.range(12, 28), night);
        else addTower(p.x, p.z, 120 + level.id * 14, night);
      }
      for (let i = 0; i < N(80); i++) {
        const p = at(rng.range(0.02, 0.99), rside() * C * 1.5);
        addTree(p.x, -18, p.z, rng.chance(0.75) ? "broad" : "pine", rng.range(8, 14));
      }
      for (let i = 0; i < N(52); i++) {
        const p = at(rng.range(0.02, 0.99), -C * 1.5 + (rng.chance(0.5) ? -9 : 9));
        addCar(p, rng.range(0, 6.28), rng.chance(0.5) ? 0xd8d8dc : rng.chance(0.5) ? 0x35414f : 0x9c2c2c, night);
      }
      for (let i = 0; i < N(16); i++) {
        const p = at(rng.range(0.05, 0.95), rside() * rng.range(C * 1.2, C * 2.4), rng.range(10, 60));
        const w = rng.range(22, 40);
        const colH = Math.max(6, p.y + 18 - 1);
        const col = p.clone().setY(p.y - colH / 2 - 1);
        b.add("padcol", gBox, M.concrete, mat4(col, new THREE.Vector3(13, colH, 13)));
        b.box(col, new THREE.Vector3(6.5, colH / 2, 6.5));
        b.add("pad", gBox, M.concreteBig, mat4(p, new THREE.Vector3(w, 1.6, w)));
        b.add("padline", gBox, M.white, mat4(p.clone().setY(p.y + 1), new THREE.Vector3(w * 0.9, 0.2, 0.6)));
        b.box(p, new THREE.Vector3(w / 2, 1, w / 2));
      }
      break;
    }
    case "canyon": {
      for (let i = 0; i < N(150); i++) {
        const u = rng.range(0.005, 0.995);
        const p = at(u, side(i) * rng.range(C * 1.5, C * 3.4));
        const q = quatAlong(u);
        const h = rng.range(50, 170), w = rng.range(34, 78);
        b.add("cliff", gBox, M.strata, mat4(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w, h, w * 0.9), q));
        b.box(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w / 2, h / 2, w * 0.45), q);
        b.add("talus", gBox, M.strata, mat4(new THREE.Vector3(p.x, -16, p.z), new THREE.Vector3(w * 1.25, 7, w * 1.15), q));
      }
      for (let i = 0; i < N(30); i++) {
        const p = at(rng.range(0.05, 0.95), rng.sym() * C * 0.85);
        const h = rng.range(26, 64), w = rng.range(14, 26);
        b.add("butte", gBox, M.strata, mat4(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w, h, w * rng.range(0.8, 1.3))));
        b.add("buttecap", gBox, M.strata, mat4(new THREE.Vector3(p.x, -18 + h + 1.5, p.z), new THREE.Vector3(w * 1.1, 3, w * 1.1)));
        b.box(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w / 2, h / 2, w / 2));
      }
      buildRoad({ u0: 0.02, u1: 0.99, lat: C * 1.55, width: 16, rails: true, onGround: true });
      for (let i = 0; i < N(120); i++) {
        const p = at(rng.range(0.02, 0.99), rside() * rng.range(C * 1.9, C * 3));
        b.add("scrub", gIco, M.scrub, mat4(new THREE.Vector3(p.x, terrainY(p.x, p.z) + 0.6, p.z), new THREE.Vector3(rng.range(1.6, 3.6), rng.range(1.4, 2.6), rng.range(1.6, 3.6))));
        if (rng.chance(0.25)) addTree(p.x, 0, p.z, "broad", rng.range(5, 9));
      }
      break;
    }
    case "alpine": {
      for (let i = 0; i < N(170); i++) {
        const p = at(rng.range(0.005, 0.995), side(i) * rng.range(C * 0.95, C * 3.6));
        const h = rng.range(60, 210), r = rng.range(24, 70);
        b.add("peak", gCone, M.rock, mat4(new THREE.Vector3(p.x, -18 + h / 2 - 10, p.z), new THREE.Vector3(r, h, r)));
        b.add("snowcap", gCone, M.snow, mat4(new THREE.Vector3(p.x, -18 + h * 0.86 - 10, p.z), new THREE.Vector3(r * 0.34, h * 0.32, r * 0.34)));
        b.box(new THREE.Vector3(p.x, -18 + h / 2 - 10, p.z), new THREE.Vector3(r * 0.42, h / 2, r * 0.42));
      }
      for (let i = 0; i < N(240); i++) {
        const p = at(rng.range(0.02, 0.99), rside() * rng.range(C * 1.15, C * 3.6));
        addTree(p.x, -18, p.z, rng.chance(0.8) ? "pine" : "broad", rng.range(11, 20));
      }
      for (let i = 0; i < 14; i++) {
        const u = 0.05 + (i / 13) * 0.9;
        const p = at(u, C * 1.15, rng.range(6, 26));
        b.add("liftpylon", gBox, M.metal, mat4(new THREE.Vector3(p.x, p.y + 12, p.z), new THREE.Vector3(1.6, 26, 1.6)));
        b.add("liftarm", gBox, M.metal, mat4(new THREE.Vector3(p.x, p.y + 24, p.z), new THREE.Vector3(9, 1, 1)));
        if (i < 13) {
          const p2 = at(Math.min(0.99, u + 0.07), C * 1.15, 24 + rng.range(0, 4));
          const top = p.clone().setY(p.y + 24);
          const mid = top.clone().add(p2).multiplyScalar(0.5);
          const dir = p2.clone().sub(top);
          const len = dir.length();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
          b.add("cable", gBox, M.metal, mat4(mid, new THREE.Vector3(0.28, 0.28, len), q));
          b.add("chair", gBox, M.dark, mat4(mid.clone().setY(mid.y - 2.4), new THREE.Vector3(2.4, 2.6, 2.4), q));
        }
      }
      for (let i = 0; i < N(14); i++) {
        const p = at(rng.range(0.05, 0.95), rside() * C * 2.2);
        addHouse(p.x, p.z, rng.range(0, 6.28), rng.range(9, 15), M.plank, "chalet");
      }
      break;
    }
    case "forest": {
      buildRoad({ u0: 0.02, u1: 1, lat: C * 1.55, width: 30, surface: M.water, flatY: WATER_Y });
      buildRoad({ u0: 0.02, u1: 1, lat: C * 1.55, width: 44, surface: M.dirt, flatY: WATER_Y + 0.4 });
      buildRoad({ u0: 0.05, u1: 0.97, lat: C * 1.62, width: 40, kerb: true, onGround: true });
      for (let i = 0; i < N(300); i++) {
        const p = at(rng.range(0.005, 0.995), rside() * rng.range(C * 1.3, C * 4.4));
        addTree(p.x, -18, p.z, rng.chance(0.35) ? "pine" : "broad", rng.range(13, 26));
      }
      for (let i = 0; i < N(60); i++) {
        const p = at(rng.range(0.02, 0.99), rng.sym() * C * 1.2);
        b.add("bush", gIco, M.foliage, mat4(new THREE.Vector3(p.x, -16.6, p.z), new THREE.Vector3(rng.range(3, 7), rng.range(2, 4), rng.range(3, 7))));
      }
      for (let i = 0; i < N(26); i++) {
        const p = at(rng.range(0.05, 0.95), rng.sym() * C * 1.1);
        const q = quatY(rng.range(0, 6.28));
        b.add("log", gCyl, M.bark, mat4(new THREE.Vector3(p.x, -16.8, p.z), new THREE.Vector3(1.1, rng.range(12, 22), 1.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)).premultiply(q)));
        b.box(new THREE.Vector3(p.x, -16.6, p.z), new THREE.Vector3(3, 1.2, 3), undefined, 0.5);
      }
      for (let i = 0; i < N(6); i++) {
        const p = at(rng.range(0.1, 0.9), rside() * C * 2);
        addHouse(p.x, p.z, rng.range(0, 6.28), rng.range(10, 16), M.plank, "lodge");
      }
      break;
    }
    case "factory": {
      buildRoad({ u0: 0.02, u1: 0.99, lat: -C * 1.35, width: 18, kerb: true, lamps: true });
      for (let i = 0; i < N(130); i++) {
        const u = rng.range(0.01, 0.99);
        const p = at(u, side(i) * rng.range(C * 1.05, C * 3.2));
        const q = quatAlong(u);
        if (rng.chance(0.45)) {
          const w = rng.range(18, 34), h = rng.range(14, 30);
          b.add("mill", gBox, M.brick, mat4(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w, h, w * 0.8), q));
          b.add("millroof", gBox, M.roof, mat4(new THREE.Vector3(p.x, -18 + h + 1, p.z), new THREE.Vector3(w * 1.04, 2, w * 0.84), q));
          b.box(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w / 2, h / 2, w * 0.4), q);
          if (rng.chance(0.6)) {
            const ch = rng.range(34, 60);
            b.add("fchimney", gCyl, M.brick, mat4(new THREE.Vector3(p.x + w * 0.3, -18 + ch / 2, p.z), new THREE.Vector3(3.4, ch, 3.4)));
            b.add("chimneytop", gCyl, M.dark, mat4(new THREE.Vector3(p.x + w * 0.3, -18 + ch + 0.8, p.z), new THREE.Vector3(3.7, 1.6, 3.7)));
          }
        } else {
          const w = rng.range(20, 40), h = rng.range(9, 15);
          b.add("shed", gBox, M.corrugated, mat4(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w, h, w * rng.range(0.6, 1.1)), q));
          b.add("shedroof", gBox, M.metal, mat4(new THREE.Vector3(p.x, -18 + h + 1.2, p.z), new THREE.Vector3(w * 1.06, 2.4, w * 0.7), q));
          b.box(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w / 2, h / 2, w * 0.5), q);
        }
      }
      for (let i = 0; i < N(48); i++) {
        const p = at(rng.range(0.03, 0.97), rng.sym() * 16, rng.range(16, 54));
        const q = quatY(rng.range(0, 3.14));
        const pq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)).premultiply(q);
        b.add("pipe", gCyl, M.rust, mat4(p, new THREE.Vector3(rng.range(1.1, 3.2), rng.range(60, 150), rng.range(1.1, 3.2)), pq));
      }
      for (let i = 0; i < N(24); i++) {
        const p = at(rng.range(0.05, 0.95), rside() * rng.range(C * 1.2, C * 1.8));
        const q = quatAlong(rng.range(0, 1));
        b.add("tank", gCyl, M.metal, mat4(new THREE.Vector3(p.x, -16.2, p.z), new THREE.Vector3(2.6, 14, 2.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)).premultiply(q)));
        b.add("railtrack", gBox, M.dark, mat4(new THREE.Vector3(p.x, -17.6, p.z), new THREE.Vector3(3, 0.5, 90), q));
      }
      for (let i = 0; i < N(20); i++) addCar(at(rng.range(0.05, 0.95), rside() * C * 1.5), rng.range(0, 6.28), 0x2f4f6d, false);
      break;
    }
    case "harbor": {
      buildRoad({ u0: 0.02, u1: 0.99, lat: C * 1.4, width: 26, kerb: true, lamps: true, onGround: true });
      b.add("quay", gBox, M.concreteBig, mat4(new THREE.Vector3(centre.x, -15.4, centre.z), new THREE.Vector3(span + 1400, 5, 46)));
      for (let i = 0; i < N(120); i++) {
        const p = at(rng.range(0.01, 0.99), rng.range(C * 1.0, C * 2.7) * (i % 3 === 0 ? -1 : 1));
        addContainerStack(p.x, -18, p.z, rng.range(0, 1.6), false);
      }
      for (let i = 0; i < 5; i++) {
        const u = 0.12 + i * 0.19;
        const p = at(u, C * 1.35);
        const tg = track.curve.getTangentAt(u);
        const rot = Math.atan2(tg.x, tg.z) + Math.PI / 2;
        addCrane(p, rot, 34);
        b.box(p, new THREE.Vector3(17, 13, 11), quatY(rot), 0.4);
      }
      for (let i = 0; i < 3; i++) {
        const u = 0.3 + i * 0.24;
        const p = at(u, C * 3.1);
        const tg = track.curve.getTangentAt(u);
        const rot = Math.atan2(tg.x, tg.z) - Math.PI / 2;
        const q = quatY(rot);
        const hull = new THREE.Mesh(new THREE.BoxGeometry(15, 12, 120), M.metal);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(13, 3, 116), M.rust);
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 16), M.white);
        hull.position.set(0, -6, 0); deck.position.set(0, 1.5, 0); bridge.position.set(0, 7, -44);
        const ship = new THREE.Group();
        ship.add(hull, deck, bridge);
        ship.position.set(p.x, WATER_Y + 4, p.z);
        ship.rotation.y = rot;
        b.obj(ship);
        b.disposables.push(hull.geometry, deck.geometry, bridge.geometry);
        b.box(p.clone().setY(WATER_Y + 4), new THREE.Vector3(8, 8, 60), q, 0.45);
        for (let k = 0; k < 6; k++) {
          const cp = new THREE.Vector3(p.x, WATER_Y + 8, p.z).add(new THREE.Vector3(0, 0, -30 + k * 11).applyQuaternion(q));
          b.add("cont", gBox, M.container, mat4(cp, new THREE.Vector3(11, 3, 10), q), new THREE.Color().setHSL(rng.next(), 0.5, 0.45));
        }
      }
      for (let i = 0; i < N(28); i++) {
        const p = at(rng.range(0.03, 0.97), rside() * C * rng.range(1.6, 3.2));
        const q = quatAlong(rng.next());
        const w = rng.range(28, 54);
        const gy = terrainY(p.x, p.z);
        if (rng.chance(0.4)) addBlock(q, p.x, p.z, w * 0.7, w * 0.6, rng.range(14, 26), false);
        else {
          b.add("warehouse", gBox, M.corrugated, mat4(new THREE.Vector3(p.x, gy + 7, p.z), new THREE.Vector3(w, 14, w * 0.6), q));
          b.add("warehouseroof", gBox, M.metal, mat4(new THREE.Vector3(p.x, gy + 15, p.z), new THREE.Vector3(w * 1.04, 2, w * 0.64), q));
          b.box(new THREE.Vector3(p.x, gy + 7, p.z), new THREE.Vector3(w / 2, 7, w * 0.3), q);
        }
      }
      break;
    }
    case "coast": {
      for (let i = 0; i < N(80); i++) {
        const u = rng.range(0.01, 0.99);
        const p = at(u, side(i) * rng.range(C * 1.3, C * 3));
        const h = rng.range(24, 70), w = rng.range(30, 70);
        const q = quatAlong(u);
        b.add("cliff", gBox, M.rock, mat4(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w, h, w * 0.8), q));
        b.add("clifftop", gBox, M.ground, mat4(new THREE.Vector3(p.x, -18 + h + 0.6, p.z), new THREE.Vector3(w * 1.02, 1.4, w * 0.82), q));
        b.box(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w / 2, h / 2, w * 0.4), q);
      }
      for (let i = 0; i < N(24); i++) {
        const p = at(rng.range(0.05, 0.95), C * 2.4);
        const w = rng.range(30, 70);
        b.add("beach", gQuad, M.sand, mat4(new THREE.Vector3(p.x, WATER_Y + 0.6, p.z), new THREE.Vector3(w, 1, w), quatY(rng.range(0, 3))));
      }
      {
        const p = at(0.35, C * 2.1);
        const base = new THREE.Vector3(p.x, -18, p.z);
        b.add("lhb", gCyl, M.white, mat4(base.clone().setY(base.y + 9), new THREE.Vector3(4.4, 54, 4.4)));
        for (let i = 0; i < 3; i++) b.add("lhband", gCyl, M.red, mat4(base.clone().setY(base.y + 4 + i * 8), new THREE.Vector3(4.6, 2.6, 4.6)));
        b.add("lhroom", gCyl, M.white, mat4(base.clone().setY(base.y + 38), new THREE.Vector3(3.2, 6, 3.2)));
        b.add("lhglass", gCyl, M.lampWarm, mat4(base.clone().setY(base.y + 38), new THREE.Vector3(3.35, 4.2, 3.35)));
        b.add("lhood", gCone, M.red, mat4(base.clone().setY(base.y + 43), new THREE.Vector3(3.6, 3, 3.6)));
        b.box(base.clone().setY(base.y + 20), new THREE.Vector3(4, 26, 4));
      }
      for (let i = 0; i < N(32); i++) {
        const p = at(rng.range(0.03, 0.97), rside() * C * rng.range(1.6, 2.9));
        addHouse(p.x, p.z, rng.range(0, 6.28), rng.range(8, 14), M.white, "cottage");
      }
      for (let i = 0; i < N(70); i++) {
        const p = at(rng.range(0.02, 0.99), rside() * rng.range(C * 1.25, C * 2.2));
        addTree(p.x, -18, p.z, rng.chance(0.4) ? "pine" : "broad", rng.range(8, 15));
      }
      break;
    }
    case "desert": {
      buildRoad({ u0: 0.02, u1: 0.99, lat: C * 1.5, width: 20, rails: true, lamps: true, onGround: true });
      buildRoad({ u0: 0.3, u1: 0.7, lat: -C * 1.6, width: 14, rails: true, onGround: true });
      for (let i = 0; i < N(60); i++) {
        const p = at(rng.range(0.01, 0.99), side(i) * rng.range(C * 1.8, C * 4));
        const h = rng.range(30, 90), w = rng.range(40, 100);
        b.add("mesa", gBox, M.strata, mat4(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w, h, w * 0.85), quatY(rng.range(0, 3))));
        b.add("mesacap", gBox, M.strata, mat4(new THREE.Vector3(p.x, -18 + h + 1.4, p.z), new THREE.Vector3(w * 1.06, 3, w * 0.9)));
        b.box(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w / 2, h / 2, w * 0.42));
      }
      for (let i = 0; i < N(120); i++) {
        const p = at(rng.range(0.02, 0.99), rside() * rng.range(C * 1.9, C * 3.6));
        const h = rng.range(5, 11);
        const gy = terrainY(p.x, p.z);
        b.add("cactus", gCyl, M.scrub, mat4(new THREE.Vector3(p.x, gy + h / 2, p.z), new THREE.Vector3(1.5, h, 1.5)));
        b.add("cactusarm", gCyl, M.scrub, mat4(new THREE.Vector3(p.x + 1.6, gy + h * 0.72, p.z), new THREE.Vector3(0.9, 3.2, 0.9)));
        b.add("cactusarm", gCyl, M.scrub, mat4(new THREE.Vector3(p.x - 1.5, gy + h * 0.62, p.z), new THREE.Vector3(0.85, 2.6, 0.85)));
      }
      for (let i = 0; i < 16; i++) addPylon(at(0.06 + (i / 15) * 0.88, C * 2.1), 0);
      {
        const p = at(0.55, C * 2.2);
        b.add("forecourt", gQuad, M.asphalt, mat4(new THREE.Vector3(p.x, -17.7, p.z), new THREE.Vector3(90, 1, 70)));
        for (const sx of [-1, 1]) b.add("canopycol", gBox, M.metal, mat4(new THREE.Vector3(p.x + sx * 14, -8, p.z), new THREE.Vector3(2, 20, 2)));
        b.add("canopy", gBox, M.corrugated, mat4(new THREE.Vector3(p.x, 2, p.z), new THREE.Vector3(46, 2.4, 30)));
        b.add("canopylight", gBox, M.lampWhite, mat4(new THREE.Vector3(p.x, 0.4, p.z), new THREE.Vector3(40, 0.6, 22)));
        for (let k = 0; k < 4; k++) b.add("dispenser", gBox, M.red, mat4(new THREE.Vector3(p.x - 18 + k * 12, -15.4, p.z + 8), new THREE.Vector3(2.4, 4, 1.4)));
        b.add("hotel", gBox, M.concrete, mat4(new THREE.Vector3(p.x + 46, -8, p.z - 8), new THREE.Vector3(26, 20, 34)));
        b.add("hotelsign", gBox, M.lampWhite, mat4(new THREE.Vector3(p.x + 46, 10, p.z - 8), new THREE.Vector3(24, 3, 34)));
        b.box(new THREE.Vector3(p.x + 46, -8, p.z - 8), new THREE.Vector3(13, 10, 17));
        for (let k = 0; k < 6; k++) addCar(at(rng.range(0.5, 0.6), C * rng.range(2.4, 3.2)), rng.range(0, 6.28), 0x30506e, false);
      }
      break;
    }
    case "farmland": {
      const fields = [["fieldCrop", M.scrub], ["fieldGrass", M.top], ["fieldDirt", M.dirt]];
      for (let i = 0; i < N(40); i++) {
        const p = at(rng.range(0.01, 0.99), side(i) * rng.range(C * 1.6, C * 4.4));
        const w = rng.range(80, 190);
        const [fk, fm] = fields[i % fields.length];
        b.add(fk, gQuad, fm, mat4(new THREE.Vector3(p.x, terrainY(p.x, p.z) + 0.5, p.z), new THREE.Vector3(w, 1, w * rng.range(0.5, 1.2)), quatY(rng.range(0, 1.57))));
      }
      buildRoad({ u0: 0.04, u1: 0.96, lat: C * 1.35, width: 12, kerb: true, onGround: true });
      for (let i = 0; i < N(45); i++) {
        const p = at(rng.range(0.03, 0.97), rside() * C * rng.range(1.4, 3.2));
        const rot = rng.range(0, 6.28);
        const q = quatY(rot);
        const w = rng.range(22, 34);
        const gy = terrainY(p.x, p.z);
        b.add("barn", gBox, M.red, mat4(new THREE.Vector3(p.x, gy + 8, p.z), new THREE.Vector3(w, 16, w * 1.6), q));
        b.add("barnroof", gPyr, M.roofB, mat4(new THREE.Vector3(p.x, gy + 23, p.z), new THREE.Vector3(w * 0.82, 10, w * 1.3), quatY(rot + Math.PI / 4)));
        b.add("barndoor", gBox, M.white, mat4(new THREE.Vector3(p.x, gy + 7, p.z + w * 0.8), new THREE.Vector3(w * 0.5, 8, 0.6), q));
        b.box(new THREE.Vector3(p.x, gy + 8, p.z), new THREE.Vector3(w / 2, 8, w * 0.8), q);
        b.add("silo", gCyl, M.metal, mat4(new THREE.Vector3(p.x + w * 0.9, gy + 13, p.z), new THREE.Vector3(4.4, 26, 4.4)));
        b.add("silocap", gCone, M.metal, mat4(new THREE.Vector3(p.x + w * 0.9, gy + 27.5, p.z), new THREE.Vector3(4.8, 5, 4.8)));
        for (let k = 0; k < 4; k++) b.add("hay", gCyl, M.hay, mat4(new THREE.Vector3(p.x - w, gy + 3, p.z - w * 0.8 + k * 6), new THREE.Vector3(3.4, 6, 3.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))));
      }
      for (let i = 0; i < 26; i++) {
        const p = at(rng.range(0.03, 0.97), rside() * rng.range(C * 1.3, C * 4.2));
        p.y = terrainY(p.x, p.z);
        addWindTurbine(p, rng.range(0.8, 1.5));
      }
      for (let i = 0; i < N(60); i++) {
        const p = at(rng.range(0.02, 0.99), rside() * rng.range(C * 1.6, C * 3.4));
        addTree(p.x, -18, p.z, rng.chance(0.6) ? "broad" : "pine", rng.range(9, 16));
      }
      break;
    }
    case "glacier": {
      buildRoad({ u0: 0.02, u1: 0.99, lat: C * 1.35, width: 14, surface: M.ice });
      for (let i = 0; i < N(150); i++) {
        const p = at(rng.range(0.01, 0.99), side(i) * rng.range(C * 1.05, C * 2.8));
        const h = rng.range(28, 120), w = rng.range(20, 52);
        const q = quatY(rng.range(0, 1.57));
        b.add("berg", gBox, M.ice, mat4(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w, h, w * rng.range(0.6, 1.3)), q));
        b.add("bergcap", gIco, M.ice, mat4(new THREE.Vector3(p.x, -18 + h + w * 0.18, p.z), new THREE.Vector3(w * 0.55, w * 0.4, w * 0.55), q));
        b.box(new THREE.Vector3(p.x, -18 + h / 2, p.z), new THREE.Vector3(w / 2, h / 2, w / 2), q, 0.4);
      }
      for (let i = 0; i < N(180); i++) {
        const p = at(rng.range(0.02, 0.99), rside() * rng.range(C * 1.4, C * 4));
        addTree(p.x, -18, p.z, "pine", rng.range(12, 22));
      }
      for (let i = 0; i < N(38); i++) {
        const p = at(rng.range(0.03, 0.97), rside() * C * rng.range(1.6, 3.2));
        addHouse(p.x, p.z, rng.range(0, 6.28), rng.range(9, 15), M.plank, "village");
      }
      for (let i = 0; i < 12; i++) {
        const u = 0.08 + i * 0.075;
        const p = at(u, C * 1.35);
        const q = quatAlong(u);
        b.add("jetty", gBox, M.plank, mat4(new THREE.Vector3(p.x, WATER_Y + 1.6, p.z), new THREE.Vector3(10, 1.2, 26), q));
        for (let k = -1; k <= 1; k++) {
          const post = p.clone().setY(WATER_Y - 2).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(q), k * 12);
          b.add("post", gCyl, M.bark, mat4(post, new THREE.Vector3(0.9, 12, 0.9)));
        }
        const bp = p.clone().setY(WATER_Y + 1);
        b.add("boatbody", gBox, M.white, mat4(bp, new THREE.Vector3(5, 3.4, 14), q));
        b.add("boatcabin", gBox, M.white, mat4(bp.clone().setY(bp.y + 3), new THREE.Vector3(4, 3, 5), q));
        b.box(bp, new THREE.Vector3(3, 2, 7), q, 0.5);
      }
      break;
    }
    case "volcano": {
      for (let i = 0; i < N(24); i++) {
        const p = at(rng.range(0.1, 0.9), side(i) * rng.range(C * 2.4, C * 5));
        const h = rng.range(80, 220), r = rng.range(60, 150);
        b.add("cone", gCone, M.rock, mat4(new THREE.Vector3(p.x, -18 + h / 2 - 20, p.z), new THREE.Vector3(r, h, r)));
        b.add("crater", gCyl, M.lava, mat4(new THREE.Vector3(p.x, -18 + h - 20, p.z), new THREE.Vector3(r * 0.18, 3, r * 0.18)));
        b.box(new THREE.Vector3(p.x, -18 + h / 2 - 20, p.z), new THREE.Vector3(r * 0.5, h / 2, r * 0.5));
      }
      for (let i = 0; i < N(70); i++) {
        const p = at(rng.range(0.02, 0.98), side(i) * rng.range(C * 1.15, C * 2.6));
        b.add("lavafield", gQuad, M.lava, mat4(new THREE.Vector3(p.x, -17.4, p.z), new THREE.Vector3(rng.range(10, 30), 1, rng.range(40, 160)), quatY(rng.range(0, 1.57))));
      }
      for (let i = 0; i < N(140); i++) {
        const p = at(rng.range(0.02, 0.99), rside() * rng.range(C * 1.2, C * 3.2));
        const s = rng.range(4, 16);
        const gy = terrainY(p.x, p.z) + 1.6;
        b.add("boulder", gIco, M.rock, mat4(new THREE.Vector3(p.x, gy, p.z), new THREE.Vector3(s, s * 0.7, s), quatY(rng.range(0, 3))));
        b.box(new THREE.Vector3(p.x, gy, p.z), new THREE.Vector3(s * 0.6, s * 0.4, s * 0.6), undefined, 0.5);
      }
      for (let i = 0; i < 10; i++) {
        const p = at(rng.range(0.06, 0.94), rside() * C * 1.6);
        b.add("mast", gCyl, M.metal, mat4(new THREE.Vector3(p.x, -4, p.z), new THREE.Vector3(0.8, 32, 0.8)));
        b.add("masthead", gBox, M.siteOrange, mat4(new THREE.Vector3(p.x, 12, p.z), new THREE.Vector3(3.4, 2.4, 3.4)));
      }
      for (let i = 0; i < N(10); i++) {
        const p = at(rng.range(0.1, 0.9), rside() * C * 2.1);
        addHouse(p.x, p.z, rng.range(0, 6.28), rng.range(9, 14), M.metal, "bunkhouse");
      }
      break;
    }
  }

  if (["downtown", "nightcity", "factory", "harbor"].includes(level.biome)) {
    for (let i = 0; i < N(40); i++) {
      const p = at(rng.range(0.02, 0.99), rside() * rng.range(C * 2.2, C * 3.4));
      addTree(p.x, -18, p.z, "broad", rng.range(7, 12));
    }
  }

  /* ================= OBSTACLES ON THE RACING LINE ================= */
  const obMat = tmat("panel", 2, 2, { roughness: 0.7, metalness: 0.2 });
  const obTrim = plain(0xf07a12, { roughness: 0.7 });
  for (let i = 0; i < N(level.obstacles); i++) {
    const u = rng.range(0.06, 0.97);
    const p = at(u, rng.sym() * C * 0.85, rng.sym() * C * 0.55);
    const q = quatAlong(u);
    const w = rng.range(5, 16), h = rng.range(5, 22);
    b.add("ob", gBox, obMat, mat4(p, new THREE.Vector3(w, h, rng.range(2.5, 6)), q));
    b.add("obe", gBox, obTrim, mat4(p.clone().setY(p.y + h / 2 - 0.4), new THREE.Vector3(w * 1.05, 0.7, 6.4), q));
    b.add("obe", gBox, obTrim, mat4(p.clone().setY(p.y - h / 2 + 0.4), new THREE.Vector3(w * 1.05, 0.7, 6.4), q));
    b.box(p, new THREE.Vector3(w / 2, h / 2, 3), q, 0.45);
  }

  /* ================= MOVING MACHINERY ================= */
  const moverGeo = new THREE.BoxGeometry(1, 1, 1);
  b.disposables.push(moverGeo);
  for (let i = 0; i < N(level.movers); i++) {
    const u = rng.range(0.07, 0.96);
    const pivot = at(u, rng.sym() * C * 0.3, rng.sym() * 6);
    const t = track.curve.getTangentAt(u).normalize();
    const kind = ["swing", "slide", "crane", "lift"][rng.int(0, 3)];
    const mesh = new THREE.Mesh(moverGeo, M.container.clone());
    let half;
    if (kind === "swing") { mesh.scale.set(9, 22, 9); half = new THREE.Vector3(4.5, 11, 4.5); }
    else if (kind === "slide") { mesh.scale.set(2.5, 2.9, 12.4); half = new THREE.Vector3(1.25, 1.45, 6.2); }
    else if (kind === "crane") { mesh.scale.set(C * 1.5, 1.6, 2.2); half = new THREE.Vector3(C * 0.75, 0.8, 1.1); }
    else { mesh.scale.set(10, 10, 10); half = new THREE.Vector3(5, 5, 5); }
    mesh.position.copy(pivot);
    b.obj(mesh);
    movers.push({
      mesh,
      col: { p: pivot.clone(), h: half, q: new THREE.Quaternion(), br: half.length(), bounce: 0.45 },
      kind, pivot, axis: t.clone(),
      radius: kind === "swing" ? 12 : kind === "slide" ? C * 0.6 : kind === "crane" ? Math.PI : C * 0.4,
      speed: rng.range(0.5, 1.5) * (1 + level.id * 0.03),
      phase: rng.range(0, Math.PI * 2),
      bound: C * 1.6 + 30,
    });
  }

  /* ================= HAZARDS ================= */
  for (let i = 0; i < level.windZones; i++) {
    const p = at(rng.range(0.08, 0.95), rng.sym() * 12, rng.sym() * 10);
    const dir = new THREE.Vector3(rng.sym(), rng.range(-0.3, 0.8), rng.sym()).normalize();
    zones.push({ p, r: C * 1.25, kind: "wind", dir, strength: rng.range(14, 30) });
  }
  for (let i = 0; i < level.empZones; i++) {
    zones.push({ p: at(rng.range(0.1, 0.94), rng.sym() * 14, rng.sym() * 10), r: C * 0.95, kind: "power", dir: new THREE.Vector3(), strength: 1 });
  }
  if (zones.length) {
    const zg = new THREE.IcosahedronGeometry(1, 2);
    const windM = new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.09, wireframe: true, depthWrite: false });
    const powerM = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.14, wireframe: true, depthWrite: false });
    b.disposables.push(zg, windM, powerM);
    zones.forEach((z) => {
      const m = new THREE.Mesh(zg, z.kind === "wind" ? windM : powerM);
      m.position.copy(z.p);
      m.scale.setScalar(z.r);
      z.mesh = m;
      b.obj(m);
    });
  }

  /* ================= SPAWN POINTS ================= */
  for (let i = 0; i < level.turrets; i++) {
    const u = rng.range(0.08, 0.96);
    turretSpots.push({ p: at(u, rside() * rng.range(C * 0.55, C * 0.95), rng.range(-14, 20)), n: track.curve.getTangentAt(u).clone() });
  }
  for (let i = 0; i < level.enemies; i++) enemySpots.push(at(rng.range(0.12, 0.95), rng.sym() * C * 0.5, rng.sym() * 12));

  /* ================= TARGETS TO HIT ================= */
  const targetCount = N(22 + level.id * 2);
  for (let i = 0; i < targetCount; i++) {
    const u = 0.04 + (i / targetCount) * 0.92;
    const p = at(u + rng.sym() * 0.004, side(i) * rng.range(C * 0.45, C * 0.95), rng.sym() * C * 0.4);
    const t = track.curve.getTangentAt(u).normalize();
    targetSpots.push({ p, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t.clone().negate()) });
  }

  /* ================= GEMS ================= */
  {
    let placed = 0, guard = 0;
    while (placed < level.gems && guard++ < level.gems * 6) {
      const u = rng.range(0.02, 0.985);
      if (rng.chance(0.42)) {
        const count = rng.int(4, 9);
        const lat = rng.sym() * level.gateRadius * 0.7, vert = rng.sym() * level.gateRadius * 0.55;
        for (let k = 0; k < count && placed < level.gems; k++) { gemSpots.push(at(Math.min(0.995, u + k * 0.0035), lat, vert)); placed++; }
      } else if (rng.chance(0.4)) {
        const count = rng.int(5, 8);
        const rad = rng.range(4, level.gateRadius * 0.8);
        for (let k = 0; k < count && placed < level.gems; k++) { const a = (k / count) * Math.PI * 2; gemSpots.push(at(u, Math.cos(a) * rad, Math.sin(a) * rad)); placed++; }
      } else {
        gemSpots.push(at(u, rng.sym() * level.gateRadius, rng.sym() * level.gateRadius * 0.8));
        placed++;
      }
    }
  }

  /* ================= WEATHER ================= */
  let ambient = null;
  const pCount = quality === "low" ? 200 : quality === "medium" ? 480 : 950;
  switch (level.biome) {
    case "alpine": case "glacier": ambient = ambientParticles(level, pCount, 360, 0xffffff, 1.5); break;
    case "volcano": ambient = ambientParticles(level, pCount, 340, 0x8c8378, 2.2); break;
    case "farmland": ambient = ambientParticles(level, pCount, 380, 0xd6e2ee, 1.2); break;
    case "coast": case "harbor": ambient = ambientParticles(level, Math.round(pCount * 0.7), 300, 0xdfeef7, 1.1); break;
    case "desert": case "canyon": ambient = ambientParticles(level, pCount, 360, 0xe0cba4, 1.6); break;
    case "forest": ambient = ambientParticles(level, Math.round(pCount * 0.6), 260, 0xdff0b8, 1.1); break;
    case "downtown": case "nightcity": ambient = ambientParticles(level, Math.round(pCount * 0.5), 300, 0xcdd9e6, 1); break;
    case "factory": ambient = ambientParticles(level, Math.round(pCount * 0.6), 280, 0xb9bcc0, 1.2); break;
  }

  /* ================= LIGHTS ================= */
  const lightCount = quality === "low" ? 0 : quality === "medium" ? 4 : 7;
  for (let i = 0; i < lightCount; i++) {
    const pl = new THREE.PointLight(level.night ? level.accent : 0xfff0d8, level.night ? 1.6 : 0.7, C * 7, 1.9);
    pl.position.copy(track.curve.getPointAt((i + 0.5) / lightCount));
    lights.push(pl);
  }

  const group = b.finish();
  if (ambient) group.add(ambient);
  lights.forEach((l) => group.add(l));

  /* ================= BROAD PHASE ================= */
  const cell = 64;
  const grid = new Map();
  b.colliders.forEach((c, idx) => {
    const r = c.br;
    const x0 = Math.floor((c.p.x - r) / cell), x1 = Math.floor((c.p.x + r) / cell);
    const z0 = Math.floor((c.p.z - r) / cell), z1 = Math.floor((c.p.z + r) / cell);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = cx * 73856093 + cz * 19349663;
      let arr = grid.get(k);
      if (!arr) grid.set(k, (arr = []));
      arr.push(idx);
    }
  });

  const dispose = () => {
    b.disposables.forEach((d) => d.dispose());
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mm = o.material;
      if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
      else if (mm) mm.dispose();
    });
  };

  return { group, colliders: b.colliders, grid, cell, movers, spinners: b.spinners, zones, turretSpots, enemySpots, targetSpots, gemSpots, ambient, lights, dispose };
}

/** Resolve a sphere vs OBB overlap. Returns penetration depth or 0. */
export function sphereVsBox(center, radius, c, outNormal) {
  const d = tmpV.copy(center).sub(c.p);
  const rr = radius + c.br;
  if (d.lengthSq() > rr * rr) return 0;
  const inv = tmpQ.copy(c.q).invert();
  const local = d.clone().applyQuaternion(inv);
  const cx = THREE.MathUtils.clamp(local.x, -c.h.x, c.h.x);
  const cy = THREE.MathUtils.clamp(local.y, -c.h.y, c.h.y);
  const cz = THREE.MathUtils.clamp(local.z, -c.h.z, c.h.z);
  const dx = local.x - cx, dy = local.y - cy, dz = local.z - cz;
  const l2 = dx * dx + dy * dy + dz * dz;
  if (l2 > radius * radius) return 0;
  if (l2 > 1e-8) {
    const l = Math.sqrt(l2);
    outNormal.set(dx / l, dy / l, dz / l).applyQuaternion(c.q);
    return radius - l;
  }
  const px = c.h.x - Math.abs(local.x), py = c.h.y - Math.abs(local.y), pz = c.h.z - Math.abs(local.z);
  if (px < py && px < pz) { outNormal.set(Math.sign(local.x) || 1, 0, 0).applyQuaternion(c.q); return px + radius; }
  if (py < pz) { outNormal.set(0, Math.sign(local.y) || 1, 0).applyQuaternion(c.q); return py + radius; }
  outNormal.set(0, 0, Math.sign(local.z) || 1).applyQuaternion(c.q);
  return pz + radius;
}
