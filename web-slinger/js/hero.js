// Procedural humanoid rig (hero + thugs), materials and a pose library
// animated by slerping joint rotations toward target poses.
import * as THREE from 'three';
import * as TX from './textures.js';

export const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR'];

const GEO = new Map();
const geo = (key, make) => {
  let g = GEO.get(key);
  if (!g) GEO.set(key, (g = make()));
  return g;
};
const cap = (r, l) => geo(`c${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 8, 16));
const sph = (r) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 28, 18));

let heroMats = null;
export function heroMaterials() {
  if (heroMats) return heroMats;
  const red = TX.suitRed();
  const blueTex = TX.suitBlue();
  const redMat = new THREE.MeshPhysicalMaterial({
    map: red.map,
    bumpMap: red.bump,
    bumpScale: 2.2,
    roughness: 0.48,
    metalness: 0.05,
    sheen: 0.7,
    sheenColor: new THREE.Color(0xff6060),
    sheenRoughness: 0.45,
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
  });
  const redHead = redMat.clone();
  redHead.map = red.map.clone();
  redHead.map.repeat.set(2, 1);
  redHead.map.needsUpdate = true;
  const blueMat = new THREE.MeshPhysicalMaterial({
    map: blueTex,
    roughness: 0.55,
    metalness: 0.05,
    sheen: 0.5,
    sheenColor: new THREE.Color(0x7090ff),
    sheenRoughness: 0.5,
  });
  const eye = new THREE.MeshPhysicalMaterial({ color: 0xf4f7fb, roughness: 0.12, metalness: 0.1, clearcoat: 1, emissive: 0xaab8cc, emissiveIntensity: 0.15 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.35 });
  const emblem = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, side: THREE.DoubleSide });
  heroMats = {
    pelvis: blueMat, abdomen: redMat, chest: redMat, shoulder: redMat, neck: redMat, head: redHead,
    upperArm: redMat, forearm: redMat, hand: redMat, thigh: blueMat, shin: redMat, foot: redMat,
    side: blueMat, eye, black, emblem, red: redMat, blue: blueMat,
  };
  return heroMats;
}

export function thugMaterials(kind, rng = Math.random) {
  const jackets = [0x2b2b2e, 0x3b4a36, 0x4a1e1e, 0x2a3140, 0x553d22, 0x1d1d1d];
  const skins = [0xc89272, 0x8d5a3b, 0xe3b590, 0x6b4430, 0xb07a58];
  const jacket = new THREE.MeshStandardMaterial({ color: kind === 'brute' ? 0x2a2a2a : jackets[Math.floor(rng() * jackets.length)], roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: rng() < 0.5 ? 0x2b3552 : 0x2a2a2a, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: skins[Math.floor(rng() * skins.length)], roughness: 0.7 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: kind === 'gunner' ? 0x7a1010 : 0x111111, roughness: 0.6 });
  return {
    pelvis: pants, abdomen: jacket, chest: jacket, shoulder: jacket, neck: skin, head: skin,
    upperArm: jacket, forearm: jacket, hand: skin, thigh: pants, shin: pants, foot: shoes,
    hat: accent, jacket, skin,
  };
}

// Builds the joint hierarchy. Model faces +Z, left side is +X.
export function buildHumanoid(mats, { hero = false, bulk = 1, scale = 1 } = {}) {
  const root = new THREE.Group();
  const J = {};
  const meshes = [];
  const joint = (name, parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    J[name] = g;
    return g;
  };
  const mesh = (parent, g, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };
  const B = bulk;
  const hips = joint('hips', root, 0, 0.96, 0);
  mesh(hips, sph(0.15), mats.pelvis, 0, 0, 0, 1.12 * B, 0.78, 0.85);
  const spine = joint('spine', hips, 0, 0.08, 0);
  mesh(spine, cap(0.125, 0.14), mats.abdomen, 0, 0.1, 0, 1.02 * B, 1, 0.78);
  const chest = joint('chest', spine, 0, 0.2, 0);
  mesh(chest, sph(0.2), mats.chest, 0, 0.08, 0, 1.0 * B, 0.95, 0.66);
  mesh(chest, sph(0.09), mats.shoulder, 0.19 * B, 0.17, 0, 1.05, 0.9, 1);
  mesh(chest, sph(0.09), mats.shoulder, -0.19 * B, 0.17, 0, 1.05, 0.9, 1);
  const neck = joint('neck', chest, 0, 0.26, 0);
  mesh(neck, cap(0.055, 0.06), mats.neck, 0, 0.03, 0);
  const head = joint('head', neck, 0, 0.09, 0.01);
  mesh(head, sph(0.115), mats.head, 0, 0.1, 0, 0.9, 1.12, 1.0);

  for (const side of [1, -1]) {
    const n = side > 0 ? 'L' : 'R';
    const sh = joint('sh' + n, chest, 0.215 * side * B, 0.15, 0);
    mesh(sh, cap(0.058 * Math.sqrt(B), 0.2), mats.upperArm, 0, -0.15, 0);
    const el = joint('el' + n, sh, 0, -0.3, 0);
    mesh(el, cap(0.048 * Math.sqrt(B), 0.19), mats.forearm, 0, -0.13, 0);
    const wr = joint('wr' + n, el, 0, -0.27, 0);
    mesh(wr, sph(0.05), mats.hand, 0, -0.05, 0.005, 0.85, 1.25, 0.62);
    const hand = new THREE.Object3D();
    hand.position.set(0, -0.08, 0.02);
    wr.add(hand);
    J['hand' + n] = hand;

    const hp = joint('hip' + n, hips, 0.095 * side * B, -0.04, 0);
    mesh(hp, cap(0.078 * Math.sqrt(B), 0.28), mats.thigh, 0, -0.21, 0);
    const kn = joint('kn' + n, hp, 0, -0.44, 0);
    mesh(kn, cap(0.058 * Math.sqrt(B), 0.3), mats.shin, 0, -0.2, 0);
    const an = joint('an' + n, kn, 0, -0.43, 0);
    mesh(an, sph(0.06), mats.foot, 0, -0.035, 0.05, 0.85, 0.6, 1.9);
  }

  if (hero) {
    // side panels
    mesh(spine, cap(0.05, 0.2), mats.side, 0.105, 0.12, 0, 0.8, 1, 1.2);
    mesh(spine, cap(0.05, 0.2), mats.side, -0.105, 0.12, 0, 0.8, 1, 1.2);
    // goggle lenses with black rims, bulging out of the mask
    for (const side of [1, -1]) {
      const rim = mesh(head, sph(0.035), mats.black, 0.046 * side, 0.118, 0.094, 1.5, 1.02, 0.42);
      rim.rotation.set(-0.12, 0.5 * side, 0.5 * side);
      rim.castShadow = false;
      const lens = mesh(head, sph(0.035), mats.eye, 0.047 * side, 0.118, 0.099, 1.22, 0.78, 0.38);
      lens.rotation.set(-0.12, 0.5 * side, 0.5 * side);
      lens.castShadow = false;
    }
    const emblem = new THREE.Mesh(spiderEmblem(), mats.emblem);
    emblem.position.set(0, 0.1, 0.133);
    emblem.rotation.x = -0.12;
    chest.add(emblem);
    const back = new THREE.Mesh(spiderEmblem(1.5), mats.emblem);
    back.position.set(0, 0.08, -0.134);
    back.rotation.y = Math.PI;
    chest.add(back);
  } else {
    // beanie
    const hat = mesh(head, sph(0.12), mats.hat, 0, 0.15, -0.005, 0.95, 0.72, 1.02);
    hat.castShadow = false;
  }

  root.scale.setScalar(scale);
  return { root, J, meshes, hipsY: 0.96 };
}

function spiderEmblem(s = 1) {
  return geo('emblem' + s, () => {
    const shapes = [];
    const body = new THREE.Shape();
    body.absellipse(0, 0.012, 0.012, 0.02, 0, Math.PI * 2);
    shapes.push(body);
    const headS = new THREE.Shape();
    headS.absellipse(0, 0.04, 0.008, 0.009, 0, Math.PI * 2);
    shapes.push(headS);
    const abd = new THREE.Shape();
    abd.absellipse(0, -0.022, 0.011, 0.018, 0, Math.PI * 2);
    shapes.push(abd);
    const leg = (pts) => {
      const w = 0.0026;
      const sh = new THREE.Shape();
      sh.moveTo(pts[0][0], pts[0][1] + w);
      for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1] + w);
      for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(pts[i][0] + (i ? 0.002 : 0), pts[i][1] - w);
      return sh;
    };
    for (const sx of [1, -1]) {
      shapes.push(leg([[0, 0.02], [0.04 * sx, 0.05], [0.05 * sx, 0.085]]));
      shapes.push(leg([[0, 0.014], [0.05 * sx, 0.03], [0.07 * sx, 0.055]]));
      shapes.push(leg([[0, 0.006], [0.05 * sx, -0.012], [0.068 * sx, -0.045]]));
      shapes.push(leg([[0, 0.0], [0.035 * sx, -0.035], [0.042 * sx, -0.08]]));
    }
    const g = new THREE.ShapeGeometry(shapes);
    g.scale(s, s, s);
    return g;
  });
}

// ---------------------------------------------------------------------------
// Poses. Each writes Euler angles (radians) per joint into `o`.
export function newPose() {
  const p = { hy: 0 };
  for (const n of JOINTS) p[n] = [0, 0, 0];
  return p;
}
function reset(o) {
  for (const n of JOINTS) {
    const a = o[n];
    a[0] = a[1] = a[2] = 0;
  }
  o.hy = 0;
  return o;
}
const set = (o, n, x, y = 0, z = 0) => {
  const a = o[n];
  a[0] = x;
  a[1] = y;
  a[2] = z;
};

export const Pose = {
  idle(o, t) {
    reset(o);
    const b = Math.sin(t * 2.1) * 0.03;
    set(o, 'spine', 0.04 + b);
    set(o, 'chest', b * 0.6);
    set(o, 'head', -0.05);
    set(o, 'shL', 0.05, 0, 0.16);
    set(o, 'shR', 0.05, 0, -0.16);
    set(o, 'elL', -0.3);
    set(o, 'elR', -0.3);
    set(o, 'hipL', -0.05, 0, 0.07);
    set(o, 'hipR', 0.05, 0, -0.07);
    set(o, 'knL', 0.1);
    set(o, 'knR', 0.1);
    o.hy = -0.012 + b * 0.1;
  },
  // Heroic crouch (the famous perch)
  perch(o, t) {
    reset(o);
    const b = Math.sin(t * 1.8) * 0.02;
    set(o, 'spine', 0.55 + b);
    set(o, 'chest', 0.25);
    set(o, 'head', -0.55);
    set(o, 'hipL', -1.9, 0, 0.35);
    set(o, 'knL', 2.45);
    set(o, 'anL', -0.4);
    set(o, 'hipR', -1.05, 0, -0.45);
    set(o, 'knR', 2.3);
    set(o, 'anR', 0.2);
    set(o, 'shR', -0.35, 0, -0.35);
    set(o, 'elR', -0.2);
    set(o, 'shL', -0.9, 0, 0.55);
    set(o, 'elL', -1.2);
    o.hy = -0.5;
  },
  run(o, p, s) {
    reset(o);
    const a = 0.6 + 0.5 * s;
    const sp = Math.sin(p);
    const cp = Math.cos(p);
    set(o, 'hipL', -sp * 0.95 * a, 0, 0.04);
    set(o, 'hipR', sp * 0.95 * a, 0, -0.04);
    set(o, 'knL', 0.2 + Math.max(0, cp) * 1.7 * a);
    set(o, 'knR', 0.2 + Math.max(0, -cp) * 1.7 * a);
    set(o, 'anL', -0.2 * sp);
    set(o, 'anR', 0.2 * sp);
    set(o, 'shL', sp * 0.85 * a + s * 0.5, 0, 0.12 + s * 0.2);
    set(o, 'shR', -sp * 0.85 * a + s * 0.5, 0, -0.12 - s * 0.2);
    set(o, 'elL', -1.25 + s * 0.6);
    set(o, 'elR', -1.25 + s * 0.6);
    set(o, 'spine', 0.14 + 0.38 * s);
    set(o, 'chest', 0.05, sp * 0.22 * a);
    set(o, 'head', -0.12 - 0.3 * s);
    o.hy = -0.06 * a + Math.abs(cp) * 0.05 * a;
  },
  air(o, vy, t) {
    reset(o);
    const up = THREE.MathUtils.clamp(vy / 10, -1, 1);
    const f = Math.sin(t * 9) * 0.12;
    if (up > 0) {
      set(o, 'hipL', -1.1 * up - 0.2, 0, 0.1);
      set(o, 'knL', 1.7 * up + 0.3);
      set(o, 'hipR', -0.5 * up, 0, -0.1);
      set(o, 'knR', 1.0 * up + 0.3);
      set(o, 'shL', -2.3 * up, 0, 0.35);
      set(o, 'shR', -0.6 * up, 0, -0.7);
      set(o, 'elL', -0.3);
      set(o, 'elR', -0.8);
      set(o, 'spine', 0.2 * up);
    } else {
      const d = -up;
      set(o, 'shL', -0.9 * d + f, 0, 1.25 * d + 0.2);
      set(o, 'shR', -0.9 * d - f, 0, -1.25 * d - 0.2);
      set(o, 'elL', -0.5);
      set(o, 'elR', -0.5);
      set(o, 'hipL', -0.5 * d + f, 0, 0.25 * d);
      set(o, 'knL', 0.9 * d + 0.2);
      set(o, 'hipR', 0.25 * d - f, 0, -0.25 * d);
      set(o, 'knR', 1.4 * d + 0.2);
      set(o, 'spine', -0.25 * d);
      set(o, 'head', -0.4 * d);
    }
  },
  // swing phase a: -1 (behind, rising back) .. +1 (ahead, rising forward)
  swing(o, a, hand) {
    reset(o);
    const L = hand === 'R';
    const free = L ? 'shL' : 'shR';
    const fs = L ? 1 : -1;
    set(o, free, -0.4 - a * 0.3, 0, 1.0 * fs);
    set(o, L ? 'elL' : 'elR', -0.9);
    set(o, 'hipL', -0.35 - a * 0.7, 0, 0.06);
    set(o, 'hipR', -0.15 - a * 0.7, 0, -0.06);
    set(o, 'knL', 0.5 + Math.max(0, a) * 0.9);
    set(o, 'knR', 0.3 + Math.max(0, a) * 0.6 + Math.max(0, -a) * 0.8);
    set(o, 'spine', -0.1 - a * 0.25);
    set(o, 'head', -0.25);
  },
  zip(o, t) {
    reset(o);
    set(o, 'shL', -2.95, 0, 0.22);
    set(o, 'shR', -2.95, 0, -0.22);
    set(o, 'hipL', 0.25, 0, 0.1);
    set(o, 'knL', 0.7);
    set(o, 'hipR', 0.05, 0, -0.1);
    set(o, 'knR', 0.35);
    set(o, 'spine', -0.15);
    set(o, 'head', -0.3);
    o.hy = Math.sin(t * 20) * 0.01;
  },
  dive(o, t) {
    reset(o);
    const f = Math.sin(t * 14) * 0.08;
    set(o, 'shL', -2.8 + f, 0, 0.3);
    set(o, 'shR', -2.8 - f, 0, -0.3);
    set(o, 'hipL', 0.1 + f, 0, 0.12);
    set(o, 'hipR', 0.1 - f, 0, -0.12);
    set(o, 'knL', 0.3);
    set(o, 'knR', 0.3);
    set(o, 'spine', -0.1);
    set(o, 'head', -0.6);
  },
  wall(o, p, moving) {
    reset(o);
    const s = moving ? Math.sin(p) : 0;
    set(o, 'shL', -2.5 + s * 0.55, 0, 0.75);
    set(o, 'elL', -0.9 - Math.max(0, s) * 0.6);
    set(o, 'shR', -2.5 - s * 0.55, 0, -0.75);
    set(o, 'elR', -0.9 - Math.max(0, -s) * 0.6);
    set(o, 'hipL', -1.1 - s * 0.45, 0, 0.7);
    set(o, 'knL', 1.7 + s * 0.3);
    set(o, 'hipR', -1.1 + s * 0.45, 0, -0.7);
    set(o, 'knR', 1.7 - s * 0.3);
    set(o, 'spine', 0.25);
    set(o, 'head', -0.7);
    o.hy = -0.18;
  },
  wallRun(o, p) {
    Pose.run(o, p, 1);
    o.head[0] = -0.9;
    o.spine[0] = 0.5;
  },
  land(o) {
    reset(o);
    set(o, 'spine', 0.6);
    set(o, 'head', -0.5);
    set(o, 'hipL', -1.6, 0, 0.4);
    set(o, 'knL', 2.3);
    set(o, 'hipR', -0.7, 0, -0.5);
    set(o, 'knR', 2.0);
    set(o, 'shR', -0.4, 0, -0.3);
    set(o, 'elR', -0.1);
    set(o, 'shL', 0.4, 0, 0.9);
    set(o, 'elL', -0.5);
    o.hy = -0.5;
  },
  punch(o, step, k) {
    reset(o);
    // k: 0..1 progress; strike peaks around 0.35
    const e = Math.min(1, k / 0.35);
    const guard = () => {
      set(o, 'hipL', -0.45, 0, 0.12);
      set(o, 'knL', 0.45);
      set(o, 'hipR', 0.35, 0, -0.12);
      set(o, 'knR', 0.35);
      o.hy = -0.08;
    };
    switch (step) {
      case 0: // right straight
        guard();
        set(o, 'shR', -1.55 * e, 0.1, -0.1);
        set(o, 'elR', -1.4 * (1 - e) - 0.05);
        set(o, 'shL', -1.0, 0, 0.25);
        set(o, 'elL', -1.9);
        set(o, 'chest', 0.05, -0.55 * e);
        set(o, 'spine', 0.15);
        break;
      case 1: // left hook
        guard();
        set(o, 'shL', -1.45, 0, 0.3 + 0.9 * e);
        set(o, 'elL', -1.3);
        set(o, 'shR', -1.0, 0, -0.25);
        set(o, 'elR', -1.9);
        set(o, 'chest', 0.05, 0.6 * e);
        set(o, 'spine', 0.1, 0.2 * e);
        break;
      case 2: // spinning kick
        set(o, 'hipR', -1.7 * e, 0, -0.6 * e);
        set(o, 'knR', 1.2 * (1 - e) + 0.1);
        set(o, 'hipL', 0.1, 0, 0.1);
        set(o, 'knL', 0.3);
        set(o, 'spine', -0.35 * e, 0, 0.35 * e);
        set(o, 'shL', -0.5, 0, 1.3);
        set(o, 'shR', -0.3, 0, -1.3);
        break;
      default: // launcher uppercut
        set(o, 'shR', -2.9 * e, 0, -0.1);
        set(o, 'elR', -0.5);
        set(o, 'shL', 0.4, 0, 0.6);
        set(o, 'hipL', -1.2 * e, 0, 0.1);
        set(o, 'knL', 1.6 * e);
        set(o, 'hipR', 0.3, 0, -0.1);
        set(o, 'knR', 0.2);
        set(o, 'spine', -0.35 * e);
        set(o, 'head', -0.4 * e);
    }
  },
  webShot(o, hand = 'R') {
    reset(o);
    const s = hand === 'R' ? 'shR' : 'shL';
    set(o, s, -1.55, 0, 0);
    set(o, hand === 'R' ? 'elR' : 'elL', 0);
    set(o, hand === 'R' ? 'wrR' : 'wrL', -0.8);
    set(o, 'hipL', -0.4, 0, 0.12);
    set(o, 'knL', 0.4);
    set(o, 'hipR', 0.3, 0, -0.12);
    set(o, 'knR', 0.3);
    set(o, 'chest', 0, hand === 'R' ? -0.35 : 0.35);
    o.hy = -0.06;
  },
  tuck(o) {
    reset(o);
    set(o, 'hipL', -2.1, 0, 0.1);
    set(o, 'knL', 2.5);
    set(o, 'hipR', -2.1, 0, -0.1);
    set(o, 'knR', 2.5);
    set(o, 'spine', 0.8);
    set(o, 'head', 0.4);
    set(o, 'shL', -1.4, 0, 0.2);
    set(o, 'shR', -1.4, 0, -0.2);
    set(o, 'elL', -2.0);
    set(o, 'elR', -2.0);
  },
  hurt(o, t) {
    reset(o);
    set(o, 'spine', -0.45);
    set(o, 'head', -0.45);
    set(o, 'shL', -0.9, 0, 0.6);
    set(o, 'shR', -0.9, 0, -0.6);
    set(o, 'elL', -0.4);
    set(o, 'elR', -0.4);
    set(o, 'hipL', -0.3);
    set(o, 'knL', 0.5);
    set(o, 'knR', 0.3);
  },
  down(o) {
    reset(o);
    set(o, 'shL', -0.3, 0, 1.2);
    set(o, 'shR', 0.2, 0, -1.4);
    set(o, 'elL', -0.8);
    set(o, 'hipL', -0.2, 0, 0.2);
    set(o, 'hipR', 0, 0, -0.3);
    set(o, 'knR', 0.6);
    set(o, 'head', 0, 0.5);
  },
  webbed(o) {
    reset(o);
    set(o, 'shL', 0, 0, 0.04);
    set(o, 'shR', 0, 0, -0.04);
    set(o, 'hipL', 0, 0, -0.03);
    set(o, 'hipR', 0, 0, 0.03);
  },
  aim(o, t) {
    reset(o);
    set(o, 'shR', -1.5, 0.05, 0);
    set(o, 'elR', -0.05);
    set(o, 'shL', -1.35, 0, -0.55);
    set(o, 'elL', -0.45);
    set(o, 'chest', 0, 0.25);
    set(o, 'hipL', -0.25, 0, 0.1);
    set(o, 'hipR', 0.2, 0, -0.1);
    set(o, 'knL', 0.25);
    o.hy = -0.03;
  },
  windup(o, t) {
    reset(o);
    set(o, 'shR', 0.6, 0, -0.9);
    set(o, 'elR', -1.8);
    set(o, 'shL', -1.1, 0, 0.3);
    set(o, 'elL', -1.4);
    set(o, 'chest', 0, 0.55);
    set(o, 'spine', -0.1);
    set(o, 'hipL', -0.5, 0, 0.1);
    set(o, 'knL', 0.5);
    set(o, 'hipR', 0.3);
    o.hy = -0.05;
  },
};

export class Animator {
  constructor(rig) {
    this.rig = rig;
    this.e = new THREE.Euler();
    this.q = new THREE.Quaternion();
    this.hy = 0;
  }
  apply(pose, k, dt) {
    const f = 1 - Math.exp(-k * dt);
    const J = this.rig.J;
    for (const n of JOINTS) {
      const a = pose[n];
      this.e.set(a[0], a[1], a[2]);
      this.q.setFromEuler(this.e);
      J[n].quaternion.slerp(this.q, f);
    }
    this.hy += (pose.hy - this.hy) * f;
    J.hips.position.y = this.rig.hipsY + this.hy;
  }
}
