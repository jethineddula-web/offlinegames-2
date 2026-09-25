// Procedural skinned body: every body part is a lofted tube of elliptical
// cross-sections (with muscle bulges) weighted to the skeleton, merged into
// a single SkinnedMesh so shoulders, elbows, hips and knees bend smoothly.
import * as THREE from 'three';

// Catmull-Rom on scalars, used to smooth the key rings
const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

export class SkinBuilder {
  constructor(boneIndex) {
    this.bi = boneIndex;
    this.pos = [];
    this.uv = [];
    this.si = [];
    this.sw = [];
    this.groups = new Map();
    this.seams = [];
    this.vc = 0;
  }

  vert(p, u, v, weights) {
    this.pos.push(p.x, p.y, p.z);
    this.uv.push(u, v);
    const ws = weights.slice(0, 4);
    let sum = 0;
    for (const [, w] of ws) sum += w;
    for (let i = 0; i < 4; i++) {
      this.si.push(ws[i] ? this.bi[ws[i][0]] : 0);
      this.sw.push(ws[i] ? ws[i][1] / sum : 0);
    }
    return this.vc++;
  }

  tri(key, a, b, c) {
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = []));
    g.push(a, b, c);
  }

  /**
   * Loft a tube through key rings.
   * ring: { c:[x,y,z], ru, rv, fb?, bb?, w:[[bone,weight],...] }
   * opts: { u:[x,y,z], v:[x,y,z] (ring frame, v = "front"), radial, sub, region(x,y,z)->material key,
   *         uRep, vLen, capStart, capEnd }
   */
  tube(keys, opts) {
    const radial = opts.radial || 20;
    const sub = opts.sub || 3;
    const U = new THREE.Vector3(...opts.u);
    const V = new THREE.Vector3(...opts.v);
    // expand key rings with Catmull-Rom interpolation
    const rings = [];
    const n = keys.length;
    const g = (i) => keys[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < n - 1; i++) {
      for (let s = 0; s < sub; s++) {
        const t = s / sub;
        const k0 = g(i - 1);
        const k1 = g(i);
        const k2 = g(i + 1);
        const k3 = g(i + 2);
        const f = (key, d = 0) => cr(k0[key] ?? d, k1[key] ?? d, k2[key] ?? d, k3[key] ?? d, t);
        const c = [0, 1, 2].map((a) => cr(k0.c[a], k1.c[a], k2.c[a], k3.c[a], t));
        // weights blend linearly between the two key rings
        const wm = new Map();
        for (const [b, w] of k1.w) wm.set(b, (wm.get(b) || 0) + w * (1 - t));
        for (const [b, w] of k2.w) wm.set(b, (wm.get(b) || 0) + w * t);
        rings.push({ c, ru: f('ru'), rv: f('rv'), fb: f('fb'), bb: f('bb'), w: [...wm.entries()].sort((a, b) => b[1] - a[1]) });
      }
    }
    const last = keys[n - 1];
    rings.push({ c: last.c, ru: last.ru, rv: last.rv, fb: last.fb || 0, bb: last.bb || 0, w: last.w });

    // arc length for the v texture coordinate
    let s = 0;
    const vLen = opts.vLen || 0.75;
    const uRep = opts.uRep || 1;
    const P = new THREE.Vector3();
    const idx = [];
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if (i > 0) {
        const p = rings[i - 1].c;
        s += Math.hypot(r.c[0] - p[0], r.c[1] - p[1], r.c[2] - p[2]);
      }
      const row = [];
      for (let j = 0; j <= radial; j++) {
        const th = (j / radial) * Math.PI * 2;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        const k = 1 + (r.fb || 0) * Math.max(0, cs) ** 2 + (r.bb || 0) * Math.max(0, -cs) ** 2;
        P.set(r.c[0], r.c[1], r.c[2]).addScaledVector(U, sn * r.ru * k).addScaledVector(V, cs * r.rv * k);
        row.push(this.vert(P, (j / radial) * uRep, s / vLen, r.w));
      }
      this.seams.push([row[0], row[radial]]);
      idx.push(row);
    }
    // winding: make normals face outward
    const along = new THREE.Vector3().fromArray(rings[1].c).sub(new THREE.Vector3().fromArray(rings[0].c));
    const flip = new THREE.Vector3().crossVectors(U, along).dot(V) < 0;
    const region = opts.region;
    const cen = (a, b, c) => {
      const p = this.pos;
      return [(p[a * 3] + p[b * 3] + p[c * 3]) / 3, (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3, (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3];
    };
    const T = (a, b, c) => {
      if (flip) [b, c] = [c, b];
      this.tri(region(...cen(a, b, c)), a, b, c);
    };
    for (let i = 0; i < idx.length - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = idx[i][j];
        const b = idx[i][j + 1];
        const c = idx[i + 1][j];
        const d = idx[i + 1][j + 1];
        T(a, b, c);
        T(b, d, c);
      }
    }
    // end caps
    const cap = (row, r, reverse) => {
      const c = this.vert(new THREE.Vector3(...r.c), 0.5 * uRep, s / vLen, r.w);
      for (let j = 0; j < radial; j++) {
        if (reverse) T(c, row[j], row[j + 1]);
        else T(c, row[j + 1], row[j]);
      }
    };
    if (opts.capStart !== false) cap(idx[0], rings[0], false);
    if (opts.capEnd !== false) cap(idx[idx.length - 1], rings[rings.length - 1], true);
  }

  build(materialKeys) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    const all = [];
    materialKeys.forEach((key, mi) => {
      const tris = this.groups.get(key);
      if (!tris) return;
      g.addGroup(all.length, tris.length, mi);
      for (const t of tris) all.push(t);
    });
    g.setIndex(all);
    g.computeVertexNormals();
    // weld normals across the UV seam so no line shows
    const nor = g.attributes.normal;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (const [i, j] of this.seams) {
      a.fromBufferAttribute(nor, i);
      b.fromBufferAttribute(nor, j);
      a.add(b).normalize();
      nor.setXYZ(i, a.x, a.y, a.z);
      nor.setXYZ(j, a.x, a.y, a.z);
    }
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Describe the body in rest pose (feet at y=0, facing +Z, left = +X).
 * B = bulk (width multiplier). region(part, x, y, z) picks a material key.
 */
export function buildBodyGeometry(boneIndex, joints, B, region, materialKeys) {
  const sb = new SkinBuilder(boneIndex);
  const X = [1, 0, 0];
  const Z = [0, 0, 1];
  const Y = [0, 1, 0];

  // ---- torso (pelvis to base of neck)
  const tor = (y, rx, rz, cz, fb, bb, w) => ({ c: [0, y, cz], ru: rx * B, rv: rz * Math.sqrt(B), fb, bb, w });
  sb.tube(
    [
      tor(0.8, 0.07, 0.06, 0, 0, 0, [['hips', 1]]),
      tor(0.86, 0.135, 0.1, 0, 0, 0.1, [['hips', 1]]),
      tor(0.93, 0.158, 0.104, 0, 0, 0.22, [['hips', 1]]),
      tor(1.0, 0.155, 0.1, 0.005, 0.02, 0.1, [['hips', 1]]),
      tor(1.07, 0.143, 0.094, 0.005, 0.03, 0, [['hips', 0.55], ['spine', 0.45]]),
      tor(1.14, 0.136, 0.09, 0.006, 0.05, 0, [['spine', 1]]),
      tor(1.21, 0.148, 0.095, 0.006, 0.06, 0.02, [['spine', 0.5], ['chest', 0.5]]),
      tor(1.28, 0.166, 0.104, 0.006, 0.1, 0.06, [['chest', 1]]),
      tor(1.35, 0.178, 0.108, 0.008, 0.14, 0.08, [['chest', 1]]),
      tor(1.405, 0.182, 0.104, 0.0, 0.09, 0.07, [['chest', 1]]),
      tor(1.44, 0.176, 0.098, -0.003, 0.03, 0.05, [['chest', 1]]),
      tor(1.47, 0.16, 0.09, -0.006, 0, 0.04, [['chest', 1]]),
      tor(1.495, 0.128, 0.08, -0.008, 0, 0.02, [['chest', 0.75], ['neck', 0.25]]),
      tor(1.515, 0.092, 0.07, -0.006, 0, 0, [['chest', 0.5], ['neck', 0.5]]),
      tor(1.535, 0.066, 0.063, -0.002, 0, 0, [['neck', 1]]),
    ],
    { u: X, v: Z, radial: 28, sub: 3, uRep: 1, vLen: 0.75, region: (x, y, z) => region('torso', x, y, z) },
  );

  // ---- neck + head (upward)
  const hd = (y, rx, rz, cz, w, fb = 0) => ({ c: [0, y, cz], ru: rx, rv: rz, fb, bb: 0, w });
  sb.tube(
    [
      hd(1.48, 0.066, 0.062, -0.004, [['neck', 1]]),
      hd(1.55, 0.06, 0.058, -0.002, [['neck', 1]]),
      hd(1.605, 0.063, 0.066, 0.006, [['neck', 0.3], ['head', 0.7]]),
      hd(1.64, 0.074, 0.082, 0.018, [['head', 1]]),
      hd(1.68, 0.087, 0.097, 0.012, [['head', 1]]),
      hd(1.72, 0.094, 0.104, 0.008, [['head', 1]]),
      hd(1.76, 0.095, 0.103, 0.0, [['head', 1]]),
      hd(1.8, 0.086, 0.092, -0.005, [['head', 1]]),
      hd(1.835, 0.064, 0.07, -0.008, [['head', 1]]),
      hd(1.858, 0.026, 0.03, -0.01, [['head', 1]]),
    ],
    { u: X, v: Z, radial: 26, sub: 3, uRep: 1, vLen: 0.5, region: (x, y, z) => region('head', x, y, z) },
  );

  for (const side of [1, -1]) {
    const n = side > 0 ? 'L' : 'R';
    const sh = joints['sh' + n];
    const el = 'el' + n;
    const wr = 'wr' + n;
    const shn = 'sh' + n;
    // ---- arm (hangs down in rest pose)
    const ax = sh[0];
    const ay = sh[1];
    const arm = (dy, ru, rv, dx, w, fb = 0, bb = 0) => ({ c: [ax + dx * side, ay + dy, 0], ru: ru * Math.sqrt(B), rv: rv * Math.sqrt(B), fb, bb, w });
    sb.tube(
      [
        arm(0.075, 0.025, 0.025, -0.03, [['chest', 1]]),
        arm(0.062, 0.052, 0.05, -0.016, [['chest', 0.65], [shn, 0.35]]),
        arm(0.035, 0.07, 0.066, -0.004, [['chest', 0.4], [shn, 0.6]]),
        arm(0.005, 0.079, 0.073, 0.004, [['chest', 0.15], [shn, 0.85]]),
        arm(-0.03, 0.079, 0.074, 0.006, [[shn, 1]]),
        arm(-0.1, 0.066, 0.066, 0.002, [[shn, 1]]),
        arm(-0.17, 0.06, 0.063, 0, [[shn, 1]], 0.12, 0.05),
        arm(-0.25, 0.051, 0.053, 0, [[shn, 0.8], [el, 0.2]]),
        arm(-0.3, 0.046, 0.048, 0, [[shn, 0.5], [el, 0.5]]),
        arm(-0.35, 0.052, 0.05, 0, [[el, 0.85], [shn, 0.15]]),
        arm(-0.4, 0.054, 0.048, 0, [[el, 1]]),
        arm(-0.48, 0.044, 0.038, 0, [[el, 1]]),
        arm(-0.55, 0.035, 0.028, 0, [[el, 0.6], [wr, 0.4]]),
        arm(-0.585, 0.034, 0.026, 0, [[wr, 1]]),
      ],
      { u: X, v: Z, radial: 18, sub: 3, uRep: 0.5, vLen: 0.6, region: (x, y, z) => region('arm', x, y, z) },
    );
    // ---- hand: palm + fingers as one mitten, plus a thumb
    const wy = ay - 0.57;
    const hand = (dy, ru, rv, dz = 0) => ({ c: [ax, wy + dy, dz], ru: ru * Math.sqrt(B), rv, fb: 0, bb: 0, w: [[wr, 1]] });
    sb.tube(
      [hand(0.02, 0.03, 0.024), hand(-0.02, 0.042, 0.022, 0.003), hand(-0.07, 0.047, 0.02, 0.006), hand(-0.11, 0.043, 0.017, 0.008), hand(-0.145, 0.032, 0.014, 0.006), hand(-0.16, 0.018, 0.01, 0.004)],
      { u: X, v: Z, radial: 14, sub: 2, uRep: 0.25, vLen: 0.4, region: (x, y, z) => region('hand', x, y, z) },
    );
    const tb = (t, r) => ({ c: [ax - 0.022 * side, wy - 0.02 - t * 0.055, 0.022 + t * 0.03], ru: r, rv: r * 0.85, fb: 0, bb: 0, w: [[wr, 1]] });
    sb.tube([tb(0, 0.016), tb(0.5, 0.014), tb(1, 0.011), tb(1.2, 0.006)], { u: X, v: Z, radial: 10, sub: 2, region: (x, y, z) => region('hand', x, y, z) });

    // ---- leg
    const hp = joints['hip' + n];
    const lx = hp[0];
    const ly = hp[1];
    const hipn = 'hip' + n;
    const kn = 'kn' + n;
    const an = 'an' + n;
    const leg = (dy, ru, rv, w, fb = 0, bb = 0, dx = 0, dz = 0) => ({ c: [lx + dx * side, ly + dy, dz], ru: ru * Math.sqrt(B), rv: rv * Math.sqrt(B), fb, bb, w });
    sb.tube(
      [
        leg(0.1, 0.085, 0.085, [['hips', 1]], 0, 0, -0.01),
        leg(0.03, 0.103, 0.1, [['hips', 0.55], [hipn, 0.45]], 0, 0.1),
        leg(-0.05, 0.1, 0.097, [[hipn, 1]], 0.03, 0.05, 0.003),
        leg(-0.15, 0.091, 0.089, [[hipn, 1]], 0.06, 0, 0.004, 0.004),
        leg(-0.27, 0.078, 0.078, [[hipn, 1]], 0.04),
        leg(-0.37, 0.064, 0.064, [[hipn, 0.75], [kn, 0.25]]),
        leg(-0.44, 0.057, 0.06, [[hipn, 0.5], [kn, 0.5]], 0.05),
        leg(-0.5, 0.058, 0.06, [[kn, 0.85], [hipn, 0.15]], 0, 0.08),
        leg(-0.58, 0.062, 0.064, [[kn, 1]], 0, 0.18, 0, -0.004),
        leg(-0.68, 0.053, 0.054, [[kn, 1]], 0, 0.08),
        leg(-0.78, 0.043, 0.043, [[kn, 1]]),
        leg(-0.85, 0.039, 0.04, [[kn, 0.55], [an, 0.45]]),
        leg(-0.9, 0.041, 0.048, [[an, 1]]),
      ],
      { u: X, v: Z, radial: 18, sub: 3, uRep: 0.5, vLen: 0.75, region: (x, y, z) => region('leg', x, y, z) },
    );
    // ---- foot (runs forward along +Z)
    const ft = (z, ru, rv, cy) => ({ c: [lx, cy, z], ru: ru * Math.sqrt(B), rv, fb: 0, bb: 0, w: [[an, 1]] });
    sb.tube(
      [ft(-0.075, 0.03, 0.03, 0.05), ft(-0.04, 0.043, 0.048, 0.054), ft(0.02, 0.045, 0.045, 0.047), ft(0.08, 0.047, 0.034, 0.036), ft(0.14, 0.042, 0.025, 0.028), ft(0.18, 0.024, 0.016, 0.022)],
      { u: X, v: Y, radial: 14, sub: 2, uRep: 1, vLen: 0.4, region: (x, y, z) => region('foot', x, y, z) },
    );
  }
  return sb.build(materialKeys);
}
