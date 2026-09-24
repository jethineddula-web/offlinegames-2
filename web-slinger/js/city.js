// Procedural Manhattan-style city: street grid, skyscrapers with setbacks,
// rooftop props, park, landmark tower, waterfront, collision + raycasts.
import * as THREE from 'three';
import { mulberry32, clamp, pick } from './utils.js';
import * as TX from './textures.js';

export const N = 12; // blocks per side
export const PITCH = 84; // block + street
export const STREET = 20;
export const BLOCK = PITCH - STREET; // 64
export const HALF = (N * PITCH) / 2; // 504
export const EDGE = HALF + STREET / 2; // seawall
export const CURB = 0.15;
export const PARK = { i0: 4, i1: 5, j0: 6, j1: 8 };
export const LANDMARK = { i: 7, j: 4 };

export const lineCoord = (k) => k * PITCH - HALF;
export const blockCenter = (i) => (i + 0.5) * PITCH - HALF;
export const isPark = (i, j) => i >= PARK.i0 && i <= PARK.i1 && j >= PARK.j0 && j <= PARK.j1;
export const PARK_RECT = {
  x0: lineCoord(PARK.i0) + STREET / 2,
  x1: lineCoord(PARK.i1 + 1) - STREET / 2,
  z0: lineCoord(PARK.j0) + STREET / 2,
  z1: lineCoord(PARK.j1 + 1) - STREET / 2,
};

const CELL = 42;
const GOFF = EDGE + 200;

// Collects quads/geometry for one material, flushed to a single BufferGeometry.
class GeoBuilder {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.idx = [];
    this.vc = 0;
  }
  quad(a, b, c, d, nx, ny, nz, uvs) {
    this.p.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) this.n.push(nx, ny, nz);
    this.uv.push(...uvs);
    const v = this.vc;
    this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    this.vc += 4;
  }
  // Four side walls with world-scaled UVs (tile metres), optional top.
  box(x0, y0, z0, x1, y1, z1, tw, th, uOff = 0, top = true, topTile = 0) {
    const v0 = y0 / th;
    const v1 = y1 / th;
    const wx = (x1 - x0) / tw;
    const wz = (z1 - z0) / tw;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, [uOff, v0, uOff + wx, v0, uOff + wx, v1, uOff, v1]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, [uOff + 0.37, v0, uOff + 0.37 + wx, v0, uOff + 0.37 + wx, v1, uOff + 0.37, v1]);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, [uOff + 0.61, v0, uOff + 0.61 + wz, v0, uOff + 0.61 + wz, v1, uOff + 0.61, v1]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, [uOff + 0.13, v0, uOff + 0.13 + wz, v0, uOff + 0.13 + wz, v1, uOff + 0.13, v1]);
    if (top) this.top(x0, z0, x1, z1, y1, topTile || tw);
  }
  top(x0, z0, x1, z1, y, t) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], 0, 1, 0, [x0 / t, -z1 / t, x1 / t, -z1 / t, x1 / t, -z0 / t, x0 / t, -z0 / t]);
  }
  geom(g, matrix) {
    const src = g.index ? g.toNonIndexed() : g;
    const pos = src.attributes.position;
    const nor = src.attributes.normal;
    const uv = src.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      this.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      this.n.push(v.x, v.y, v.z);
      this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      this.idx.push(this.vc++);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
  get empty() {
    return this.vc === 0;
  }
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(20240917);
    this.boxes = [];
    this.roofs = []; // top tiers, usable for spawns / collectibles
    this.grid = new Map();
    this.stamp = 0;
    this.windowMats = [];
    this.lampMats = [];
    this.beacons = [];
    this.footprints = [];
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  // ------------------------------------------------------------------ materials
  makeMaterials() {
    const m = {};
    let s = 1;
    for (const name of Object.keys(TX.FACADES)) {
      const t = TX.facade(name, s++);
      m[name] = new THREE.MeshStandardMaterial({
        map: t.map,
        emissiveMap: t.emissive,
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
        roughnessMap: t.orm,
        metalnessMap: t.orm,
        roughness: 1,
        metalness: 1,
      });
      this.windowMats.push(m[name]);
    }
    const st = TX.storefront(7);
    m.store = new THREE.MeshStandardMaterial({ map: st.map, emissiveMap: st.emissive, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.55, metalness: 0.2 });
    this.windowMats.push(m.store);
    m.roof = new THREE.MeshStandardMaterial({ map: TX.roof(), roughness: 0.95 });
    m.trim = new THREE.MeshStandardMaterial({ color: 0xc9c2b4, roughness: 0.8 });
    m.darkTrim = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.7, metalness: 0.3 });
    m.metal = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.4, metalness: 0.75 });
    m.wood = new THREE.MeshStandardMaterial({ color: 0x5e4029, roughness: 0.9 });
    m.sidewalk = new THREE.MeshStandardMaterial({ map: TX.sidewalk(), roughness: 0.92 });
    m.crown = new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffc070, emissiveIntensity: 1.4, roughness: 0.4 });
    this.lampMats.push(m.crown);
    m.beacon = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    this.mats = m;
  }

  // ------------------------------------------------------------------ build
  async build(onProgress = () => {}) {
    this.makeMaterials();
    onProgress(0.1, 'Pouring asphalt');
    this.buildGround();
    // chunked builders so frustum culling can skip whole districts
    this.chunks = new Map();
    const chunkOf = (i, j) => {
      const key = `${Math.floor(i / 3)},${Math.floor(j / 3)}`;
      let c = this.chunks.get(key);
      if (!c) {
        c = {};
        this.chunks.set(key, c);
      }
      return c;
    };
    this.builderFor = (chunk, mat) => chunk[mat] || (chunk[mat] = new GeoBuilder());

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const chunk = chunkOf(i, j);
        if (isPark(i, j)) continue;
        const cx = blockCenter(i);
        const cz = blockCenter(j);
        const h = BLOCK / 2;
        this.builderFor(chunk, 'sidewalk').box(cx - h, 0, cz - h, cx + h, CURB, cz + h, 4, 4, 0, true, 4);
        if (i === LANDMARK.i && j === LANDMARK.j) this.buildLandmark(chunk, cx, cz);
        else this.buildBlock(chunk, cx, cz);
      }
      onProgress(0.1 + (0.55 * (i + 1)) / N, 'Raising skyscrapers');
      await new Promise((r) => setTimeout(r, 0));
    }
    for (const chunk of this.chunks.values()) {
      for (const [mat, b] of Object.entries(chunk)) {
        if (b.empty) continue;
        const mesh = new THREE.Mesh(b.build(), this.mats[mat]);
        mesh.castShadow = mat !== 'sidewalk';
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    }
    onProgress(0.7, 'Planting Central Park');
    this.buildPark();
    this.buildStreetFurniture();
    this.buildSkyline();
    this.buildBeacons();
    onProgress(0.8, 'Drawing the map');
    this.buildMinimap();
  }

  addCollider(x0, y0, z0, x1, y1, z1, kind = 'building') {
    const b = { x0, y0, z0, x1, y1, z1, kind, _q: 0, _r: 0 };
    this.boxes.push(b);
    const gx0 = Math.floor((x0 + GOFF) / CELL);
    const gx1 = Math.floor((x1 + GOFF) / CELL);
    const gz0 = Math.floor((z0 + GOFF) / CELL);
    const gz1 = Math.floor((z1 + GOFF) / CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const k = gx * 4096 + gz;
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(b);
      }
    }
    return b;
  }

  // ------------------------------------------------------------------ blocks
  buildBlock(chunk, cx, cz) {
    const rng = this.rng;
    const L = BLOCK / 2 - 4; // lot half size (inside sidewalk)
    const lots = [];
    const split = (x0, z0, x1, z1, depth) => {
      const w = x1 - x0;
      const d = z1 - z0;
      if (depth > 0 && Math.max(w, d) > 22 && rng() < 0.78) {
        const t = 0.35 + rng() * 0.3;
        if (w >= d) {
          const xm = x0 + w * t;
          split(x0, z0, xm, z1, depth - 1);
          split(xm, z0, x1, z1, depth - 1);
        } else {
          const zm = z0 + d * t;
          split(x0, z0, x1, zm, depth - 1);
          split(x0, zm, x1, z1, depth - 1);
        }
      } else lots.push([x0, z0, x1, z1]);
    };
    split(cx - L, cz - L, cx + L, cz + L, 2 + (rng() < 0.4 ? 1 : 0));

    // height field: two dense cores (midtown + downtown) like the real skyline
    const core = (x, z, px, pz, r) => Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (r * r));
    const density = Math.max(core(cx, cz, 120, -150, 230), 0.85 * core(cx, cz, -230, 330, 190), 0.25);

    for (const [x0, z0, x1, z1] of lots) {
      const inset = rng() < 0.3 ? 0.8 + rng() * 1.5 : 0.2;
      let h = 14 + density * (40 + rng() * 150) + (rng() < 0.05 ? 80 : 0);
      if (Math.min(x1 - x0, z1 - z0) < 14) h = Math.min(h, 60);
      this.buildBuilding(chunk, x0 + inset, z0 + inset, x1 - inset, z1 - inset, Math.round(h / 4) * 4);
    }
  }

  pickStyle(h) {
    const rng = this.rng;
    if (h > 120) return pick(['glass', 'teal', 'glass', 'stone', 'modern', 'concrete'], rng);
    if (h > 60) return pick(['glass', 'stone', 'modern', 'concrete', 'brick', 'teal'], rng);
    return pick(['brick', 'brown', 'brick', 'concrete', 'stone', 'modern'], rng);
  }

  buildBuilding(chunk, x0, z0, x1, z1, h, forcedStyle) {
    const rng = this.rng;
    const style = forcedStyle || this.pickStyle(h);
    const B = (m) => this.builderFor(chunk, m);
    const uOff = Math.floor(rng() * 8) / 8;
    let y = 0;
    if (h > 16 && rng() < 0.85) {
      const e = 0.35;
      const ph = 5.2;
      B('store').box(x0 - e, 0, z0 - e, x1 + e, ph, z1 + e, 16, ph, rng() * 4, false);
      B('darkTrim').box(x0 - e - 0.25, ph, z0 - e - 0.25, x1 + e + 0.25, ph + 0.5, z1 + e + 0.25, 4, 4);
      this.addCollider(x0 - e, 0, z0 - e, x1 + e, ph + 0.5, z1 + e, 'base');
      y = ph + 0.5;
    }
    const tiers = h > 150 ? 3 : h > 70 && rng() < 0.7 ? 2 : 1;
    let a0 = x0;
    let b0 = z0;
    let a1 = x1;
    let b1 = z1;
    for (let t = 0; t < tiers; t++) {
      const last = t === tiers - 1;
      const top = last ? h : y + (h - y) * (0.5 + rng() * 0.2);
      B(style).box(a0, y, b0, a1, top, b1, TX.TILE_W, TX.TILE_H, uOff, false);
      B('roof').top(a0, b0, a1, b1, top, 6);
      this.parapet(B(style === 'brick' || style === 'brown' ? 'trim' : 'darkTrim'), a0, b0, a1, b1, top);
      const box = this.addCollider(a0, y, b0, a1, top, b1, 'building');
      this.footprints.push([a0, b0, a1, b1, top]);
      if (last) {
        this.roofs.push(box);
        this.roofProps(chunk, box, h);
      } else {
        const inset = Math.min(2 + rng() * 4, (a1 - a0) / 2 - 6, (b1 - b0) / 2 - 6);
        if (inset > 0) {
          a0 += inset;
          b0 += inset;
          a1 -= inset;
          b1 -= inset;
        }
      }
      y = top;
    }
  }

  parapet(b, x0, z0, x1, z1, y) {
    const t = 0.45;
    const h0 = y - 0.7;
    const h1 = y + 0.55;
    b.box(x0 - 0.3, h0, z0 - 0.3, x1 + 0.3, h1, z0 + t, 4, 4);
    b.box(x0 - 0.3, h0, z1 - t, x1 + 0.3, h1, z1 + 0.3, 4, 4);
    b.box(x0 - 0.3, h0, z0 + t, x0 + t, h1, z1 - t, 4, 4);
    b.box(x1 - t, h0, z0 + t, x1 + 0.3, h1, z1 - t, 4, 4);
  }

  roofProps(chunk, box, h) {
    const rng = this.rng;
    const B = (m) => this.builderFor(chunk, m);
    const w = box.x1 - box.x0;
    const d = box.z1 - box.z0;
    const y = box.y1;
    const M = new THREE.Matrix4();
    const place = (sx, sz) => [box.x0 + 3 + rng() * Math.max(0.1, w - 6 - sx), box.z0 + 3 + rng() * Math.max(0.1, d - 6 - sz)];
    // stair bulkhead
    if (w > 12 && d > 12) {
      const [px, pz] = place(4, 4);
      B('darkTrim').box(px, y, pz, px + 4, y + 3.2, pz + 3.5, 4, 4);
      this.addCollider(px, y, pz, px + 4, y + 3.2, pz + 3.5, 'prop');
    }
    // classic NYC wooden water tank
    if (h < 140 && w > 10 && d > 10 && rng() < 0.55) {
      const [px, pz] = place(5, 5);
      const r = 1.6 + rng() * 0.8;
      const cx = px + 2.5;
      const cz = pz + 2.5;
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        M.makeTranslation(cx + lx * r * 0.6, y + 1.2, cz + lz * r * 0.6);
        B('metal').geom(new THREE.BoxGeometry(0.2, 2.4, 0.2), M);
      }
      M.makeTranslation(cx, y + 2.4 + 1.8, cz);
      B('wood').geom(new THREE.CylinderGeometry(r, r, 3.6, 16, 1), M);
      M.makeTranslation(cx, y + 2.4 + 3.6 + 0.6, cz);
      B('darkTrim').geom(new THREE.ConeGeometry(r * 1.05, 1.2, 16), M);
      this.addCollider(cx - r, y, cz - r, cx + r, y + 6, cz + r, 'prop');
    }
    // AC units
    const nAc = Math.floor(rng() * 4);
    for (let i = 0; i < nAc; i++) {
      const [px, pz] = place(2.4, 1.8);
      B('metal').box(px, y, pz, px + 2.4, y + 1.3, pz + 1.8, 2, 2);
    }
    // antenna with blinking beacon on tall towers
    if (h > 110 && rng() < 0.8) {
      const ah = 8 + rng() * 22;
      const cx = (box.x0 + box.x1) / 2 + (rng() - 0.5) * w * 0.4;
      const cz = (box.z0 + box.z1) / 2 + (rng() - 0.5) * d * 0.4;
      M.makeTranslation(cx, y + ah / 2, cz);
      B('metal').geom(new THREE.CylinderGeometry(0.12, 0.25, ah, 6), M);
      this.beacons.push(new THREE.Vector3(cx, y + ah + 0.2, cz));
    }
  }

  buildLandmark(chunk, cx, cz) {
    // Art-deco supertall with stepped crown and spire.
    const B = (m) => this.builderFor(chunk, m);
    const tiers = [
      [27, 0, 62],
      [22, 62, 190],
      [17, 190, 262],
      [12, 262, 300],
      [8, 300, 318],
    ];
    B('store').box(cx - 27.4, 0, cz - 27.4, cx + 27.4, 5.2, cz + 27.4, 16, 5.2, 0, false);
    for (let t = 0; t < tiers.length; t++) {
      const [r, y0, y1] = tiers[t];
      B(t < 4 ? 'stone' : 'crown').box(cx - r, y0 < 5.2 ? 5.2 : y0, cz - r, cx + r, y1, cz + r, TX.TILE_W, TX.TILE_H, 0.25 * t, false);
      B('roof').top(cx - r, cz - r, cx + r, cz + r, y1, 6);
      this.parapet(B('trim'), cx - r, cz - r, cx + r, cz + r, y1);
      // glowing ring under each setback
      if (t > 0) B('crown').box(cx - r - 0.4, y0 - 1.2, cz - r - 0.4, cx + r + 0.4, y0 - 0.6, cz + r + 0.4, 4, 4, 0, false);
      const box = this.addCollider(cx - r, y0, cz - r, cx + r, y1, cz + r, 'building');
      this.footprints.push([cx - r, cz - r, cx + r, cz + r, y1]);
      this.roofs.push(box);
    }
    const M = new THREE.Matrix4();
    M.makeTranslation(cx, 318 + 22, cz);
    B('metal').geom(new THREE.CylinderGeometry(0.6, 4.5, 44, 8), M);
    M.makeTranslation(cx, 362 + 14, cz);
    B('metal').geom(new THREE.CylinderGeometry(0.15, 0.6, 28, 6), M);
    this.beacons.push(new THREE.Vector3(cx, 391, cz));
    this.landmark = new THREE.Vector3(cx, 318, cz);
  }

  // ------------------------------------------------------------------ ground
  buildGround() {
    const size = EDGE * 2;
    const asphaltTex = TX.asphalt();
    asphaltTex.repeat.set(size / 14, size / 14);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.88, metalness: 0.05 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // seawall
    const wall = new GeoBuilder();
    wall.box(-EDGE, -6, -EDGE, EDGE, 0, EDGE, 6, 6, 0, false);
    const wallMesh = new THREE.Mesh(wall.build(), new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.9 }));
    this.group.add(wallMesh);
    // railings along the waterfront
    const rail = new GeoBuilder();
    const r = EDGE - 0.4;
    rail.box(-r - 0.1, 0.95, -r - 0.1, r + 0.1, 1.05, -r + 0.1, 4, 4);
    rail.box(-r - 0.1, 0.95, r - 0.1, r + 0.1, 1.05, r + 0.1, 4, 4);
    rail.box(-r - 0.1, 0.95, -r, -r + 0.1, 1.05, r, 4, 4);
    rail.box(r - 0.1, 0.95, -r, r + 0.1, 1.05, r, 4, 4);
    this.group.add(new THREE.Mesh(rail.build(), this.mats.metal));

    // water
    const wn = TX.waterNormal();
    wn.repeat.set(60, 60);
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000),
      new THREE.MeshStandardMaterial({ color: 0x0e2a3c, roughness: 0.08, metalness: 0.9, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35) }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -2.2;
    this.group.add(this.water);

    // road markings (double yellow, dashed lanes, crosswalks) as one instanced mesh
    const marks = [];
    const addMark = (x, z, w, l, yellow) => marks.push([x, z, w, l, yellow]);
    for (let k = 0; k <= N; k++) {
      const c = lineCoord(k);
      for (let m = 0; m < N; m++) {
        const s0 = lineCoord(m) + STREET / 2;
        const s1 = lineCoord(m + 1) - STREET / 2;
        const mid = (s0 + s1) / 2;
        const len = s1 - s0;
        // along z (vertical street at x=c)
        if (!(isPark(k - 1, m) && isPark(k, m))) {
          addMark(c - 0.18, mid, 0.14, len, 1);
          addMark(c + 0.18, mid, 0.14, len, 1);
          for (let s = s0 + 3; s < s1 - 3; s += 9) {
            addMark(c - 4.1, s + 1.5, 0.15, 3, 0);
            addMark(c + 4.1, s + 1.5, 0.15, 3, 0);
          }
          for (let q = -8; q <= 8; q += 1.6) {
            addMark(c + q, s0 + 2, 0.7, 3, 0);
            addMark(c + q, s1 - 2, 0.7, 3, 0);
          }
        }
        // along x (horizontal street at z=c)
        if (!(isPark(m, k - 1) && isPark(m, k))) {
          addMark(mid, c - 0.18, len, 0.14, 1);
          addMark(mid, c + 0.18, len, 0.14, 1);
          for (let s = s0 + 3; s < s1 - 3; s += 9) {
            addMark(s + 1.5, c - 4.1, 3, 0.15, 0);
            addMark(s + 1.5, c + 4.1, 3, 0.15, 0);
          }
          for (let q = -8; q <= 8; q += 1.6) {
            addMark(s0 + 2, c + q, 3, 0.7, 0);
            addMark(s1 - 2, c + q, 3, 0.7, 0);
          }
        }
      }
    }
    const pg = new THREE.PlaneGeometry(1, 1);
    pg.rotateX(-Math.PI / 2);
    const mm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const im = new THREE.InstancedMesh(pg, mm, marks.length);
    const M = new THREE.Matrix4();
    const col = new THREE.Color();
    marks.forEach(([x, z, w, l, yellow], i) => {
      M.makeScale(w, 1, l).setPosition(x, 0.02, z);
      im.setMatrixAt(i, M);
      im.setColorAt(i, yellow ? col.set(0xe0b020) : col.set(0xd8d8d0));
    });
    im.receiveShadow = true;
    this.group.add(im);
  }

  buildPark() {
    const { x0, x1, z0, z1 } = PARK_RECT;
    const gt = TX.grass();
    const g = new GeoBuilder();
    g.box(x0, 0, z0, x1, 0.12, z1, 6, 6, 0, true, 6);
    const grassMat = new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 });
    const park = new THREE.Mesh(g.build(), grassMat);
    park.receiveShadow = true;
    this.group.add(park);
    // low stone wall
    const w = new GeoBuilder();
    w.box(x0 - 0.5, 0, z0 - 0.5, x1 + 0.5, 0.8, z0 + 0.2, 4, 4);
    w.box(x0 - 0.5, 0, z1 - 0.2, x1 + 0.5, 0.8, z1 + 0.5, 4, 4);
    w.box(x0 - 0.5, 0, z0, x0 + 0.2, 0.8, z1, 4, 4);
    w.box(x1 - 0.2, 0, z0, x1 + 0.5, 0.8, z1, 4, 4);
    // paths
    const p = new GeoBuilder();
    const cxm = (x0 + x1) / 2;
    const czm = (z0 + z1) / 2;
    p.top(cxm - 2.5, z0, cxm + 2.5, z1, 0.14, 4);
    p.top(x0, czm - 2.5, x1, czm + 2.5, 0.14, 4);
    p.top(x0, z0 + 40 - 2, x1, z0 + 40 + 2, 0.14, 4);
    p.top(x0, z1 - 40 - 2, x1, z1 - 40 + 2, 0.14, 4);
    this.group.add(new THREE.Mesh(w.build(), this.mats.trim));
    const pm = new THREE.Mesh(p.build(), new THREE.MeshStandardMaterial({ color: 0xb9a98a, roughness: 0.95 }));
    pm.receiveShadow = true;
    this.group.add(pm);
    // pond
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.water.material);
    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(34, 22, 1);
    pond.position.set(cxm + 26, 0.16, czm - 50);
    this.group.add(pond);

    // trees
    const rng = mulberry32(99);
    const trees = [];
    for (let i = 0; i < 360; i++) {
      const x = x0 + 4 + rng() * (x1 - x0 - 8);
      const z = z0 + 4 + rng() * (z1 - z0 - 8);
      if (Math.abs(x - cxm) < 5 || Math.abs(z - czm) < 5) continue;
      if (Math.abs(z - (z0 + 40)) < 4 || Math.abs(z - (z1 - 40)) < 4) continue;
      if (((x - (cxm + 26)) / 36) ** 2 + ((z - (czm - 50)) / 24) ** 2 < 1) continue;
      trees.push([x, z, 0.8 + rng() * 0.7, rng()]);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 4, 6), new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 }), trees.length);
    const crownGeo = new THREE.IcosahedronGeometry(3, 1);
    const crown = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), trees.length * 2);
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const S = new THREE.Vector3();
    const P = new THREE.Vector3();
    const col = new THREE.Color();
    trees.forEach(([x, z, s, c], i) => {
      M.makeScale(s, s, s).setPosition(x, 2 * s, z);
      trunk.setMatrixAt(i, M);
      for (let k = 0; k < 2; k++) {
        Q.setFromEuler(new THREE.Euler(rng(), rng() * 6, rng()));
        S.set(s * (1 + rng() * 0.3), s * (0.9 + rng() * 0.3), s * (1 + rng() * 0.3));
        P.set(x + (rng() - 0.5) * 1.5 * s, (4.6 + k * 1.4) * s, z + (rng() - 0.5) * 1.5 * s);
        M.compose(P, Q, S);
        crown.setMatrixAt(i * 2 + k, M);
        col.setHSL(0.22 + c * 0.08, 0.45 + rng() * 0.2, 0.2 + rng() * 0.1);
        crown.setColorAt(i * 2 + k, col);
      }
    });
    trunk.castShadow = crown.castShadow = true;
    crown.receiveShadow = true;
    this.group.add(trunk, crown);
  }

  buildStreetFurniture() {
    // Street lamps along every block, with fake light pools on the pavement.
    const lamps = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (isPark(i, j)) continue;
        const cx = blockCenter(i);
        const cz = blockCenter(j);
        const o = BLOCK / 2 - 0.8;
        for (const t of [-22, 0, 22]) {
          lamps.push([cx + t, cz + o, 0]);
          lamps.push([cx + t, cz - o, Math.PI]);
          lamps.push([cx + o, cz + t, Math.PI / 2]);
          lamps.push([cx - o, cz + t, -Math.PI / 2]);
        }
      }
    }
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 7, 6);
    poleGeo.translate(0, 3.5, 0);
    const armGeo = new THREE.BoxGeometry(0.12, 0.12, 1.8);
    armGeo.translate(0, 6.9, 0.8);
    const headGeo = new THREE.BoxGeometry(0.45, 0.14, 0.7);
    headGeo.translate(0, 6.8, 1.6);
    const poolGeo = new THREE.PlaneGeometry(9, 9);
    poolGeo.rotateX(-Math.PI / 2);
    poolGeo.translate(0, 0.05, 2.2);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd9a0, emissiveIntensity: 1.5 });
    this.lampMats.push(lampMat);
    this.poolMat = new THREE.MeshBasicMaterial({ map: TX.radial('rgba(255,200,140,1)', 'rgba(255,200,140,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 });
    const poles = new THREE.InstancedMesh(poleGeo, this.mats.darkTrim, lamps.length);
    const arms = new THREE.InstancedMesh(armGeo, this.mats.darkTrim, lamps.length);
    const heads = new THREE.InstancedMesh(headGeo, lampMat, lamps.length);
    const pools = new THREE.InstancedMesh(poolGeo, this.poolMat, lamps.length);
    const M = new THREE.Matrix4();
    lamps.forEach(([x, z, r], i) => {
      M.makeRotationY(r).setPosition(x, CURB, z);
      poles.setMatrixAt(i, M);
      arms.setMatrixAt(i, M);
      heads.setMatrixAt(i, M);
      pools.setMatrixAt(i, M);
    });
    poles.castShadow = true;
    this.group.add(poles, arms, heads, pools);
    this.lampPools = pools;
  }

  buildSkyline() {
    // Distant boroughs across the river: silhouettes only, no collision.
    const rng = mulberry32(555);
    const bs = { glass: new GeoBuilder(), concrete: new GeoBuilder(), brick: new GeoBuilder(), stone: new GeoBuilder() };
    for (let i = 0; i < 520; i++) {
      const a = rng() * Math.PI * 2;
      const r = 820 + rng() * 700;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const w = 20 + rng() * 45;
      const d = 20 + rng() * 45;
      const near = Math.abs(a - 4.1) < 0.6 ? 2.2 : 1; // a second downtown across the river
      const h = (15 + rng() * rng() * 160) * near;
      const k = pick(Object.keys(bs), rng);
      bs[k].box(x - w / 2, -2, z - d / 2, x + w / 2, h, z + d / 2, TX.TILE_W, TX.TILE_H, rng(), true, 6);
    }
    for (const [k, b] of Object.entries(bs)) this.group.add(new THREE.Mesh(b.build(), this.mats[k]));
    // land masses under them
    const land = new THREE.Mesh(new THREE.RingGeometry(780, 1700, 64), new THREE.MeshStandardMaterial({ color: 0x2c2d2e, roughness: 1 }));
    land.rotation.x = -Math.PI / 2;
    land.position.y = -1.9;
    this.group.add(land);
  }

  buildBeacons() {
    const g = new THREE.SphereGeometry(0.45, 8, 6);
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const im = new THREE.InstancedMesh(g, this.beaconMat, this.beacons.length);
    const M = new THREE.Matrix4();
    this.beacons.forEach((p, i) => im.setMatrixAt(i, M.makeTranslation(p.x, p.y, p.z)));
    this.group.add(im);
  }

  buildMinimap() {
    const S = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const k = S / (EDGE * 2 + 120);
    const tx = (x) => (x + EDGE + 60) * k;
    g.fillStyle = '#0b2433';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#20252c';
    g.fillRect(tx(-EDGE), tx(-EDGE), EDGE * 2 * k, EDGE * 2 * k);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const cx = blockCenter(i);
        const cz = blockCenter(j);
        g.fillStyle = isPark(i, j) ? '#2d5a33' : '#3a414b';
        g.fillRect(tx(cx - BLOCK / 2), tx(cz - BLOCK / 2), BLOCK * k, BLOCK * k);
      }
    }
    g.fillStyle = '#2d5a33';
    g.fillRect(tx(PARK_RECT.x0), tx(PARK_RECT.z0), (PARK_RECT.x1 - PARK_RECT.x0) * k, (PARK_RECT.z1 - PARK_RECT.z0) * k);
    const sorted = [...this.footprints].sort((a, b) => a[4] - b[4]);
    for (const [x0, z0, x1, z1, h] of sorted) {
      const l = Math.round(90 + clamp(h / 250, 0, 1) * 110);
      g.fillStyle = `rgb(${l},${l + 6},${l + 16})`;
      g.fillRect(tx(x0), tx(z0), (x1 - x0) * k, (z1 - z0) * k);
    }
    this.minimap = { canvas: c, scale: k, offset: EDGE + 60 };
  }

  // ------------------------------------------------------------------ queries
  cellBoxes(x, z) {
    return this.grid.get(Math.floor((x + GOFF) / CELL) * 4096 + Math.floor((z + GOFF) / CELL));
  }

  query(x, z, r, out = []) {
    out.length = 0;
    const q = ++this.stamp;
    const gx0 = Math.floor((x - r + GOFF) / CELL);
    const gx1 = Math.floor((x + r + GOFF) / CELL);
    const gz0 = Math.floor((z - r + GOFF) / CELL);
    const gz1 = Math.floor((z + r + GOFF) / CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const arr = this.grid.get(gx * 4096 + gz);
        if (!arr) continue;
        for (const b of arr) {
          if (b._q !== q) {
            b._q = q;
            out.push(b);
          }
        }
      }
    }
    return out;
  }

  baseHeight(x, z) {
    if (Math.abs(x) > EDGE || Math.abs(z) > EDGE) return -2.2; // river
    if (x > PARK_RECT.x0 && x < PARK_RECT.x1 && z > PARK_RECT.z0 && z < PARK_RECT.z1) return 0.12;
    const lx = (((x + HALF) % PITCH) + PITCH) % PITCH;
    const lz = (((z + HALF) % PITCH) + PITCH) % PITCH;
    if (lx > STREET / 2 && lx < PITCH - STREET / 2 && lz > STREET / 2 && lz < PITCH - STREET / 2 && Math.abs(x) < HALF && Math.abs(z) < HALF) return CURB;
    return 0;
  }

  // Highest walkable surface under (x,z) that is not above y + step.
  groundHeight(x, z, y, step = 0.6) {
    let h = this.baseHeight(x, z);
    const arr = this.cellBoxes(x, z);
    if (arr) {
      for (const b of arr) {
        if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= y + step && b.y1 > h) h = b.y1;
      }
    }
    return h;
  }

  // Push a vertical capsule (feet at pos, given radius/height) out of buildings.
  // Returns the wall contact (normal + box) if any.
  resolve(pos, radius, height, allowStep = true, out = { hit: false, nx: 0, nz: 0, box: null, stepped: false }) {
    out.hit = false;
    out.box = null;
    out.stepped = false;
    const list = this.query(pos.x, pos.z, radius + 1, this._qbuf || (this._qbuf = []));
    for (const b of list) {
      if (pos.y >= b.y1 - 0.02 || pos.y + height <= b.y0) continue;
      const cx = clamp(pos.x, b.x0, b.x1);
      const cz = clamp(pos.z, b.z0, b.z1);
      let dx = pos.x - cx;
      let dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (allowStep && b.y1 - pos.y <= 0.6) {
        pos.y = b.y1;
        out.stepped = true;
        continue;
      }
      let nx;
      let nz;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = dx / d;
        nz = dz / d;
        pos.x = cx + nx * radius;
        pos.z = cz + nz * radius;
      } else {
        // centre inside the footprint: exit through the nearest face
        const e = [pos.x - b.x0, b.x1 - pos.x, pos.z - b.z0, b.z1 - pos.z];
        let mi = 0;
        for (let i = 1; i < 4; i++) if (e[i] < e[mi]) mi = i;
        nx = mi === 0 ? -1 : mi === 1 ? 1 : 0;
        nz = mi === 2 ? -1 : mi === 3 ? 1 : 0;
        if (mi === 0) pos.x = b.x0 - radius;
        if (mi === 1) pos.x = b.x1 + radius;
        if (mi === 2) pos.z = b.z0 - radius;
        if (mi === 3) pos.z = b.z1 + radius;
      }
      out.hit = true;
      out.nx = nx;
      out.nz = nz;
      out.box = b;
    }
    return out;
  }

  // Ray vs building boxes (+ ground plane). dir must be normalised.
  raycast(o, dir, maxT, withGround = true) {
    const q = ++this.stamp;
    let best = maxT;
    let hit = null;
    const step = CELL * 0.5;
    const inv = [1 / dir.x, 1 / dir.y, 1 / dir.z];
    for (let t = 0; t <= Math.min(maxT, best) + step; t += step) {
      const x = o.x + dir.x * t;
      const z = o.z + dir.z * t;
      const arr = this.cellBoxes(x, z);
      if (!arr) continue;
      for (const b of arr) {
        if (b._r === q) continue;
        b._r = q;
        let tmin = -Infinity;
        let tmax = Infinity;
        let axis = -1;
        const lo = [b.x0, b.y0, b.z0];
        const hi = [b.x1, b.y1, b.z1];
        const oo = [o.x, o.y, o.z];
        let ok = true;
        for (let a = 0; a < 3; a++) {
          let t1 = (lo[a] - oo[a]) * inv[a];
          let t2 = (hi[a] - oo[a]) * inv[a];
          if (t1 > t2) [t1, t2] = [t2, t1];
          if (t1 > tmin) {
            tmin = t1;
            axis = a;
          }
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) {
            ok = false;
            break;
          }
        }
        if (!ok || tmax < 0 || tmin < 0 || tmin >= best) continue;
        best = tmin;
        const n = [0, 0, 0];
        n[axis] = -Math.sign([dir.x, dir.y, dir.z][axis]);
        hit = { t: tmin, box: b, nx: n[0], ny: n[1], nz: n[2] };
      }
    }
    if (withGround && dir.y < 0) {
      const tg = (0 - o.y) / dir.y;
      if (tg >= 0 && tg < best) {
        best = tg;
        hit = { t: tg, box: null, nx: 0, ny: 1, nz: 0 };
      }
    }
    if (hit) {
      hit.x = o.x + dir.x * hit.t;
      hit.y = o.y + dir.y * hit.t;
      hit.z = o.z + dir.z * hit.t;
    }
    return hit;
  }

  // ------------------------------------------------------------------ time of day
  setLighting(windows, lamps) {
    for (const m of this.windowMats) m.emissiveIntensity = windows * (m === this.mats.store ? 1.4 : 1);
    for (const m of this.lampMats) m.emissiveIntensity = lamps * 2;
    this.poolMat.opacity = Math.min(0.55, lamps * 0.35);
    this.lampPools.visible = lamps > 0.05;
  }

  update(t) {
    this.beaconMat.color.setScalar(0).setRGB(Math.sin(t * 3) > 0.2 ? 4 : 0.25, 0.05, 0.05);
    if (this.water.material.normalMap) {
      this.water.material.normalMap.offset.set(t * 0.004, t * 0.0025);
    }
  }
}
