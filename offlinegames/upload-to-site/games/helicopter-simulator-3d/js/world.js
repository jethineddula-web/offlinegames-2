/* ============================================================
   world.js  —  Procedural city: skyscrapers, roads, traffic,
   parks, helipads + spatial-hash collision.
   ============================================================ */
'use strict';

const WORLD = (function () {

  const BLOCK = 62;          // building block size (m)
  const ROAD = 18;           // road width (m)
  const PITCH = BLOCK + ROAD;

  let meshes = {}, textures = {}, batches = {}, batchList = [];
  let buildings = [];        // {x0,x1,z0,z1,top}
  let hash = new Map();
  const CELL = 40;
  let cars = [], lamps = [], helipads = [], trees = [];
  let cfg = null;
  let ready = false;

  /* ------------------------------------------------------------------ */
  function key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

  function hashInsert(b) {
    const x0 = Math.floor(b.x0 / CELL), x1 = Math.floor(b.x1 / CELL);
    const z0 = Math.floor(b.z0 / CELL), z1 = Math.floor(b.z1 / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = key(cx, cz);
        let a = hash.get(k);
        if (!a) { a = []; hash.set(k, a); }
        a.push(b);
      }
    }
  }

  function nearby(x, z, r) {
    const out = [];
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const a = hash.get(key(cx, cz));
        if (a) for (const b of a) if (out.indexOf(b) < 0) out.push(b);
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /*  RESOURCE CREATION (once)                                           */
  /* ------------------------------------------------------------------ */

  function createResources() {
    if (ready) return;

    meshes.unitBox = R.makeMesh(G.box(1, 1, 1, 1));
    meshes.unitPlane = R.makeMesh(G.plane(1, 1, 1, 1));
    meshes.cyl = R.makeMesh(G.cylinder(0.5, 0.5, 1, 14));
    meshes.sphere = R.makeMesh(G.sphere(0.5, 14, 10));
    meshes.star = R.makeMesh(G.star(1, 0.42, 0.34, 5));
    meshes.ring = R.makeMesh(G.torus(1, 0.075, 40, 8));
    meshes.cone = R.makeMesh(G.cylinder(0.02, 0.5, 1, 12));

    meshes.tree = R.makeMesh(G.merge([
      { geom: G.cylinder(0.16, 0.24, 3.4, 8), t: [0, 1.7, 0] },
      { geom: G.sphere(1.5, 12, 9), t: [0, 4.2, 0], s: [1, 1.15, 1] },
      { geom: G.sphere(1.1, 10, 8), t: [0.9, 3.5, 0.4] },
      { geom: G.sphere(1.0, 10, 8), t: [-0.8, 3.7, -0.5] }
    ]));

    meshes.lamp = R.makeMesh(G.merge([
      { geom: G.cylinder(0.10, 0.16, 8.0, 8), t: [0, 4, 0] },
      { geom: G.cylinder(0.09, 0.09, 2.2, 8), t: [1.0, 8.0, 0], r: [0, 0, Math.PI / 2] },
      { geom: G.box(0.7, 0.18, 0.36), t: [2.0, 7.9, 0] }
    ]));

    meshes.car = R.makeMesh(G.merge([
      { geom: G.box(1.85, 0.72, 4.3), t: [0, 0.62, 0] },
      { geom: G.box(1.62, 0.62, 2.2), t: [0, 1.28, -0.15] },
      { geom: G.cylinder(0.33, 0.33, 0.22, 10), t: [0.92, 0.34, 1.42], r: [0, 0, Math.PI / 2] },
      { geom: G.cylinder(0.33, 0.33, 0.22, 10), t: [-0.92, 0.34, 1.42], r: [0, 0, Math.PI / 2] },
      { geom: G.cylinder(0.33, 0.33, 0.22, 10), t: [0.92, 0.34, -1.42], r: [0, 0, Math.PI / 2] },
      { geom: G.cylinder(0.33, 0.33, 0.22, 10), t: [-0.92, 0.34, -1.42], r: [0, 0, Math.PI / 2] }
    ]));

    meshes.acUnit = R.makeMesh(G.merge([
      { geom: G.box(1, 1, 1), t: [0, 0.5, 0] },
      { geom: G.cylinder(0.34, 0.34, 0.18, 12), t: [0, 1.05, 0] }
    ]));

    /* textures */
    const mk = (imgData, opts) => R.createTexture(imgData, opts);
    textures.facade = {
      glass: mk(TEX.facade('glass', 11)),
      office: mk(TEX.facade('office', 22)),
      brick: mk(TEX.facade('brick', 33)),
      modern: mk(TEX.facade('modern', 44)),
      steel: mk(TEX.facade('steel', 55))
    };
    textures.roof = mk(TEX.roof());
    textures.road = mk(TEX.road());
    textures.pavement = mk(TEX.pavement());
    textures.grass = mk(TEX.grass());
    textures.helipad = mk(TEX.helipad(), { clamp: true });
    textures.metal = mk(TEX.metal());
    textures.water = mk(TEX.water());
    textures.rotorDisc = mk(TEX.rotorDisc(), { clamp: true });
    textures.glow = mk(TEX.glow(), { clamp: true });
    ready = true;
  }

  /* ------------------------------------------------------------------ */
  /*  BUILD CITY                                                         */
  /* ------------------------------------------------------------------ */

  function build(options) {
    createResources();
    cfg = Object.assign({
      seed: 1,
      radius: 9,            // blocks from centre  (grid is (2r+1)^2)
      downtown: 4,          // radius of tall-building core
      maxHeight: 190,
      minHeight: 18,
      parkChance: 0.07,
      waterSide: false,
      helipadCount: 6
    }, options || {});

    const rnd = M.makeRng(cfg.seed * 2654435761 >>> 0);

    buildings = []; hash = new Map(); cars = []; lamps = []; helipads = []; trees = [];
    batches = {}; batchList = [];

    const B = (name, mesh, tex, opts) => {
      const b = R.makeBatch(mesh, tex, opts);
      batches[name] = b; batchList.push(b);
      return b;
    };

    const styles = ['glass', 'office', 'brick', 'modern', 'steel'];
    const bBuild = {};
    for (const s of styles) {
      bBuild[s] = B('bld_' + s, meshes.unitBox, textures.facade[s],
        { capacity: 256, worldUV: true, castShadow: true });
    }
    const bRoof = B('roof', meshes.unitPlane, textures.roof, { capacity: 400, castShadow: false });
    const bRoofDet = B('roofdet', meshes.acUnit, textures.metal, { capacity: 900 });
    const bAnt = B('antenna', meshes.cyl, null, { capacity: 200 });
    const bRoad = B('road', meshes.unitPlane, textures.road, { capacity: 400, castShadow: false });
    const bGround = B('ground', meshes.unitPlane, textures.pavement, { capacity: 8, castShadow: false, worldUV: true });
    const bPark = B('park', meshes.unitPlane, textures.grass, { capacity: 120, castShadow: false, worldUV: true });
    const bTree = B('tree', meshes.tree, null, { capacity: 500 });
    const bLamp = B('lamp', meshes.lamp, textures.metal, { capacity: 500 });
    const bLampGlow = B('lampglow', meshes.sphere, null, { capacity: 500, castShadow: false, blend: true, order: 1 });
    const bCar = B('car', meshes.car, null, { capacity: 220 });
    const bPad = B('helipad', meshes.unitPlane, textures.helipad, { capacity: 40, castShadow: false });

    const mat = new Float32Array(16);
    const q = M.quat.create();
    const pos = M.v3.create();
    const scl = M.v3.create();
    const put = (batch, x, y, z, sx, sy, sz, ry, color, params) => {
      M.quat.setAxisAngle(q, 0, 1, 0, ry || 0);
      M.v3.set(pos, x, y, z); M.v3.set(scl, sx, sy, sz);
      M.m4.fromRotationTranslationScale(mat, q, pos, scl);
      batch.push(mat, color, params);
    };

    const half = cfg.radius;
    const extent = (half + 0.5) * PITCH;

    /* ---- ground plane ---- */
    put(bGround, 0, -0.02, 0, extent * 2.6, 1, extent * 2.6, 0, [0.82, 0.82, 0.79, 1], [1 / 9, 1 / 9, 0, 0.03]);

    /* ---- roads along both axes ---- */
    for (let i = -half; i <= half + 1; i++) {
      const c = (i - 0.5) * PITCH;
      const len = (2 * half + 2) * PITCH;
      put(bRoad, c, 0.02, 0, ROAD, 1, len, 0, [1, 1, 1, 1], [1, len / ROAD, 0, 0.04]);
      put(bRoad, 0, 0.021, c, len, 1, ROAD, Math.PI / 2, [1, 1, 1, 1], [1, len / ROAD, 0, 0.04]);
    }

    /* ---- blocks ---- */
    const buildingColors = [
      [0.95, 0.95, 0.97], [0.86, 0.88, 0.92], [1.0, 0.97, 0.92],
      [0.80, 0.84, 0.88], [0.92, 0.90, 0.86], [0.74, 0.80, 0.86],
      [0.99, 0.93, 0.88], [0.70, 0.76, 0.82]
    ];

    for (let bx = -half; bx <= half; bx++) {
      for (let bz = -half; bz <= half; bz++) {
        const cxw = bx * PITCH, czw = bz * PITCH;
        const distC = Math.hypot(bx, bz);

        /* the centre block is the home airfield — keep it clear */
        if (distC < 0.9) {
          put(bPark, cxw, 0.03, czw, BLOCK, 1, BLOCK, 0, [0.95, 0.95, 0.95, 1], [1 / 8, 1 / 8, 0, 0.02]);
          continue;
        }

        /* park block */
        if (rnd() < cfg.parkChance && distC > 1.4) {
          put(bPark, cxw, 0.03, czw, BLOCK, 1, BLOCK, 0, [1, 1, 1, 1], [1 / 8, 1 / 8, 0, 0.02]);
          const n = 5 + ((rnd() * 7) | 0);
          for (let i = 0; i < n; i++) {
            const tx = cxw + (rnd() - 0.5) * (BLOCK - 8);
            const tz = czw + (rnd() - 0.5) * (BLOCK - 8);
            const s = 0.8 + rnd() * 0.7;
            const gr = 0.30 + rnd() * 0.22;
            put(bTree, tx, 0, tz, s, s, s, rnd() * 6.28,
              [0.22 + rnd() * 0.1, gr + 0.22, 0.18, 1], [1, 1, 0, 0.05]);
            trees.push({ x: tx, z: tz, r: 2.2 * s });
          }
          continue;
        }

        /* how many buildings in this block */
        const sub = distC < cfg.downtown ? (rnd() < 0.62 ? 1 : 2) : (rnd() < 0.35 ? 2 : 4);
        const cellsX = sub <= 2 ? sub : 2;
        const cellsZ = sub <= 1 ? 1 : (sub === 2 ? 1 : 2);
        const cw = BLOCK / cellsX, cd = BLOCK / cellsZ;

        for (let ix = 0; ix < cellsX; ix++) {
          for (let iz = 0; iz < cellsZ; iz++) {
            if (rnd() < 0.06) continue;   // vacant lot
            const gap = 2.5;
            const w = cw - gap * 2 - rnd() * 4;
            const d = cd - gap * 2 - rnd() * 4;
            const px = cxw - BLOCK / 2 + cw * (ix + 0.5);
            const pz = czw - BLOCK / 2 + cd * (iz + 0.5);

            /* height: tall downtown, tapering out, with occasional landmark */
            const t = Math.max(0, 1 - distC / (half * 0.95));
            let h = cfg.minHeight + Math.pow(rnd(), 1.7) * (cfg.maxHeight - cfg.minHeight) * (0.22 + t * 0.95);
            if (distC < cfg.downtown && rnd() < 0.22) h *= 1.45;
            if (rnd() < 0.012) h = cfg.maxHeight * (1.05 + rnd() * 0.25);   // landmark tower
            h = Math.max(12, Math.min(h, cfg.maxHeight * 1.35));

            const style = h > 90 ? (rnd() < 0.62 ? 'glass' : 'steel')
                        : h > 45 ? (rnd() < 0.5 ? 'office' : 'modern')
                        : (rnd() < 0.55 ? 'brick' : 'office');
            const col = buildingColors[(rnd() * buildingColors.length) | 0];
            const tint = [col[0], col[1], col[2], 1];
            const spec = style === 'glass' || style === 'steel' ? 0.55 : 0.10;

            put(bBuild[style], px, h / 2, pz, w, h, d, 0, tint, [1 / 14, 1 / 14, 0, spec]);

            /* setback / crown for tall towers */
            let topY = h;
            if (h > 70 && rnd() < 0.55) {
              const h2 = h * (0.10 + rnd() * 0.16);
              const w2 = w * 0.68, d2 = d * 0.68;
              put(bBuild[style], px, h + h2 / 2, pz, w2, h2, d2, 0, tint, [1 / 14, 1 / 14, 0, spec]);
              topY = h + h2;
              buildings.push({ x0: px - w2 / 2, x1: px + w2 / 2, z0: pz - d2 / 2, z1: pz + d2 / 2, top: topY, base: h });
            }

            /* roof deck */
            put(bRoof, px, topY + 0.05, pz, w * 0.999, 1, d * 0.999, 0, [0.85, 0.85, 0.84, 1], [w / 9, d / 9, 0, 0.03]);

            /* rooftop clutter */
            const nAc = 1 + ((rnd() * 4) | 0);
            for (let a = 0; a < nAc; a++) {
              const s = 1.2 + rnd() * 2.4;
              put(bRoofDet,
                px + (rnd() - 0.5) * (w - s * 2), topY + 0.06, pz + (rnd() - 0.5) * (d - s * 2),
                s, s * (0.5 + rnd() * 0.5), s, rnd() * 6.28,
                [0.62, 0.63, 0.65, 1], [1, 1, 0, 0.35]);
            }
            if (h > 60 && rnd() < 0.5) {
              const ah = 6 + rnd() * 20;
              put(bAnt, px + (rnd() - 0.5) * w * 0.3, topY + ah / 2, pz + (rnd() - 0.5) * d * 0.3,
                0.28, ah, 0.28, 0, [0.30, 0.31, 0.33, 1], [1, 1, 0.0, 0.3]);
              /* red obstruction beacon on the mast */
              put(bLampGlow, px, topY + ah + 0.5, pz, 1.1, 1.1, 1.1, 0,
                [1.0, 0.22, 0.16, 0.55], [1, 1, 2.2, 0]);
            }

            const bb = { x0: px - w / 2, x1: px + w / 2, z0: pz - d / 2, z1: pz + d / 2, top: h, base: 0 };
            buildings.push(bb);
            hashInsert(bb);
            if (topY > h) hashInsert(buildings[buildings.length - 2]);
          }
        }
      }
    }

    /* re-hash setback blocks that were pushed before their parent */
    hash = new Map();
    for (const b of buildings) hashInsert(b);

    /* ---- helipads on selected rooftops ---- */
    const tall = buildings.filter(b => b.top > 55 && (b.x1 - b.x0) > 20 && (b.z1 - b.z0) > 20);
    tall.sort(() => rnd() - 0.5);
    for (let i = 0; i < Math.min(cfg.helipadCount, tall.length); i++) {
      const b = tall[i];
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const s = Math.min(b.x1 - b.x0, b.z1 - b.z0) * 0.82;
      put(bPad, cx, b.top + 0.14, cz, s, 1, s, 0, [1, 1, 1, 1], [1, 1, 0, 0.05]);
      helipads.push({ x: cx, y: b.top + 0.16, z: cz, r: s * 0.44 });
    }
    /* one ground-level pad at the origin (home base) */
    put(bPad, 0, 0.06, 0, 26, 1, 26, 0, [1, 1, 1, 1], [1, 1, 0, 0.05]);
    helipads.push({ x: 0, y: 0.08, z: 0, r: 11, home: true });

    /* ---- street lamps ---- */
    for (let i = -half; i <= half + 1; i++) {
      for (let j = -half * 1; j <= half; j++) {
        const rx = (i - 0.5) * PITCH;
        for (const side of [-1, 1]) {
          const lx = rx + side * (ROAD / 2 - 1.4);
          const lz = j * PITCH + (rnd() - 0.5) * 10;
          if (Math.abs(lx) > extent || Math.abs(lz) > extent) continue;
          if (rnd() < 0.55) continue;
          put(bLamp, lx, 0, lz, 1, 1, 1, side > 0 ? Math.PI : 0, [0.34, 0.35, 0.37, 1], [1, 1, 0, 0.25]);
          lamps.push({ x: lx + (side > 0 ? -2 : 2), y: 7.9, z: lz });
        }
      }
    }
    for (const l of lamps) {
      put(bLampGlow, l.x, l.y, l.z, 1.5, 1.5, 1.5, 0, [1.0, 0.86, 0.55, 0.0], [1, 1, 1.6, 0]);
    }

    /* ---- traffic ---- */
    const carColors = [[0.85, 0.12, 0.12], [0.12, 0.2, 0.7], [0.9, 0.9, 0.9], [0.1, 0.1, 0.12],
                       [0.85, 0.7, 0.1], [0.2, 0.6, 0.35], [0.6, 0.6, 0.65], [0.9, 0.45, 0.1]];
    const nCars = Math.min(180, 40 + half * 12);
    for (let i = 0; i < nCars; i++) {
      const axis = rnd() < 0.5 ? 0 : 1;
      const line = (Math.round(rnd() * 2 * half) - half - 0.5) * PITCH;
      const dir = rnd() < 0.5 ? 1 : -1;
      const lane = dir > 0 ? 4.2 : -4.2;
      cars.push({
        axis, line: line + lane, dir,
        p: (rnd() - 0.5) * extent * 2,
        speed: 9 + rnd() * 14,
        color: carColors[(rnd() * carColors.length) | 0],
        idx: -1
      });
    }
    for (const c of cars) {
      const x = c.axis === 0 ? c.line : c.p;
      const z = c.axis === 0 ? c.p : c.line;
      c.idx = put(bCar, x, 0, z, 1, 1, 1, 0, [c.color[0], c.color[1], c.color[2], 1], [1, 1, 0, 0.5]);
    }

    return {
      batches: batchList,
      extent,
      helipads,
      buildings
    };
  }

  /* ------------------------------------------------------------------ */
  /*  RUNTIME UPDATE                                                     */
  /* ------------------------------------------------------------------ */

  const _m = new Float32Array(16);
  const _q = M.quat.create();
  const _p = M.v3.create();
  const _s = M.v3.create([1, 1, 1]);

  function update(dt, extent) {
    const b = batches.car;
    if (!b) return;
    for (const c of cars) {
      c.p += c.speed * c.dir * dt;
      if (c.p > extent) c.p = -extent;
      if (c.p < -extent) c.p = extent;
      const x = c.axis === 0 ? c.line : c.p;
      const z = c.axis === 0 ? c.p : c.line;
      const ry = c.axis === 0 ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      M.quat.setAxisAngle(_q, 0, 1, 0, ry);
      M.v3.set(_p, x, 0, z);
      M.v3.set(_s, 1, 1, 1);
      M.m4.fromRotationTranslationScale(_m, _q, _p, _s);
      b.data.set(_m, c.idx * 24);
    }
    b.dirty = true;
  }

  function setNight(isNight) {
    const g = batches.lampglow;
    if (!g) return;
    for (let i = 0; i < g.count; i++) {
      g.data[i * 24 + 19] = isNight ? 0.55 : 0.0;    // alpha
    }
    g.dirty = true;
  }

  /* ------------------------------------------------------------------ */
  /*  COLLISION                                                          */
  /* ------------------------------------------------------------------ */

  /** Sphere vs city. Returns null or {nx,ny,nz,depth,top} */
  function collide(x, y, z, r) {
    const list = nearby(x, z, r + 2);
    let best = null;
    for (const b of list) {
      if (y - r > b.top) continue;
      const cx = Math.max(b.x0, Math.min(x, b.x1));
      const cz = Math.max(b.z0, Math.min(z, b.z1));
      const cy = Math.max(b.base, Math.min(y, b.top));
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.0001;
        const depth = r - d;
        if (!best || depth > best.depth) {
          best = { nx: dx / d, ny: dy / d, nz: dz / d, depth, top: b.top, building: b };
        }
      }
    }
    return best;
  }

  /** highest solid surface directly under (x,z) */
  function supportHeight(x, z) {
    const list = nearby(x, z, 1);
    let h = 0;
    for (const b of list) {
      if (x >= b.x0 - 0.4 && x <= b.x1 + 0.4 && z >= b.z0 - 0.4 && z <= b.z1 + 0.4) {
        if (b.top > h) h = b.top;
      }
    }
    return h;
  }

  /** true if a sphere of radius r at (x,y,z) is clear of all buildings */
  function isClear(x, y, z, r) {
    return collide(x, y, z, r) === null;
  }

  function getTextures() { return textures; }
  function getMeshes() { return meshes; }
  function getBatches() { return batches; }
  function getBuildings() { return buildings; }
  function constants() { return { BLOCK, ROAD, PITCH }; }

  return {
    build, update, collide, supportHeight, isClear, setNight,
    getTextures, getMeshes, getBatches, getBuildings, constants,
    createResources
  };
})();

if (typeof module !== 'undefined') module.exports = WORLD;
