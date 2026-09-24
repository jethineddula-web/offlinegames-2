// Living streets: instanced cars (with head/tail lights) and pedestrians.
import * as THREE from 'three';
import { N, HALF, EDGE, BLOCK, PARK, lineCoord, blockCenter, isPark, CURB } from './city.js';
import { mulberry32 } from './utils.js';

const UPV = new THREE.Vector3(0, 1, 0);
const COLORS = [0xf2c300, 0xf2c300, 0xf2c300, 0x14181f, 0xe8e8e8, 0x8a1212, 0x1c3f7a, 0x5a5f66, 0x2d4a2d, 0xb0b4ba, 0x6b2a5a, 0xd46a1a];

function carGeometries() {
  // side profile of a sedan, extruded across its width
  const s = new THREE.Shape();
  s.moveTo(-2.25, 0.32);
  s.lineTo(2.25, 0.32);
  s.lineTo(2.32, 0.72);
  s.quadraticCurveTo(2.25, 0.95, 1.9, 0.98);
  s.lineTo(1.0, 1.02);
  s.lineTo(-1.8, 1.05);
  s.quadraticCurveTo(-2.25, 1.0, -2.3, 0.75);
  s.lineTo(-2.25, 0.32);
  const body = new THREE.ExtrudeGeometry(s, { depth: 1.84, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 6 });
  body.rotateY(-Math.PI / 2);
  body.translate(0.92, 0, 0);
  const c = new THREE.Shape();
  c.moveTo(1.0, 1.0);
  c.lineTo(0.35, 1.52);
  c.lineTo(-1.0, 1.55);
  c.lineTo(-1.75, 1.03);
  c.lineTo(1.0, 1.0);
  const cab = new THREE.ExtrudeGeometry(c, { depth: 1.66, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  cab.rotateY(-Math.PI / 2);
  cab.translate(0.83, 0, 0);
  const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheel.rotateZ(Math.PI / 2);
  const head = new THREE.BoxGeometry(0.42, 0.14, 0.06);
  const tail = new THREE.BoxGeometry(0.4, 0.12, 0.06);
  return { body, cab, wheel, head, tail };
}

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    const rng = mulberry32(4242);
    this.rng = rng;
    const G = carGeometries();
    // lanes: each street line, both directions, two lanes each way
    const lanes = [];
    for (let k = 0; k <= N; k++) {
      const throughPark = k > PARK.i0 && k <= PARK.i1;
      const throughParkZ = k > PARK.j0 && k <= PARK.j1;
      for (const dir of [1, -1]) {
        for (const off of [2.3, 5.9]) {
          if (!throughPark) lanes.push({ axis: 'z', c: lineCoord(k) - off * dir, dir, speed: 9 + rng() * 7 });
          if (!throughParkZ) lanes.push({ axis: 'x', c: lineCoord(k) + off * dir, dir, speed: 9 + rng() * 7 });
        }
      }
    }
    const L = EDGE * 2;
    this.cars = [];
    for (const lane of lanes) {
      if (rng() < 0.35) continue;
      const count = 1 + Math.floor(rng() * 3);
      const start = rng() * L;
      for (let i = 0; i < count; i++) {
        this.cars.push({ lane, s: (start + (i * L) / count) % L, color: COLORS[Math.floor(rng() * COLORS.length)] });
      }
    }
    const n = this.cars.length;
    this.n = n;
    const paint = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.08 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 0.05, metalness: 0.9 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 });
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dd, emissiveIntensity: 2 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a10, emissiveIntensity: 2 });
    this.body = new THREE.InstancedMesh(G.body, paint, n);
    this.cab = new THREE.InstancedMesh(G.cab, glass, n);
    this.wheels = new THREE.InstancedMesh(G.wheel, tire, n * 4);
    this.heads = new THREE.InstancedMesh(G.head, this.headMat, n * 2);
    this.tails = new THREE.InstancedMesh(G.tail, this.tailMat, n * 2);
    const col = new THREE.Color();
    this.cars.forEach((c, i) => this.body.setColorAt(i, col.set(c.color)));
    for (const m of [this.body, this.cab, this.wheels]) {
      m.castShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.body.receiveShadow = true;
    for (const m of [this.body, this.cab, this.wheels, this.heads, this.tails]) {
      m.frustumCulled = false;
      scene.add(m);
    }
    // local part offsets
    this.wheelOff = [[0.9, 0.36, 1.45], [-0.9, 0.36, 1.45], [0.9, 0.36, -1.5], [-0.9, 0.36, -1.5]];
    this.headOff = [[0.62, 0.72, 2.3], [-0.62, 0.72, 2.3]];
    this.tailOff = [[0.65, 0.8, -2.33], [-0.65, 0.8, -2.33]];

    this.buildPeds(rng);

    this.M = new THREE.Matrix4();
    this.P = new THREE.Matrix4();
    this.Q = new THREE.Quaternion();
    this.V = new THREE.Vector3();
    this.S = new THREE.Vector3(1, 1, 1);
    this.update(0);
  }

  buildPeds(rng) {
    const peds = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (isPark(i, j)) continue;
        const k = 2 + Math.floor(rng() * 3);
        for (let q = 0; q < k; q++) {
          peds.push({
            cx: blockCenter(i),
            cz: blockCenter(j),
            r: BLOCK / 2 - 1.2 - rng() * 1.8,
            s: rng() * 4,
            speed: (0.9 + rng() * 0.6) * (rng() < 0.5 ? 1 : -1),
            phase: rng() * 10,
          });
        }
      }
    }
    this.peds = peds;
    const n = peds.length;
    const torso = new THREE.CapsuleGeometry(0.2, 0.5, 4, 8);
    const head = new THREE.SphereGeometry(0.12, 10, 8);
    const leg = new THREE.BoxGeometry(0.14, 0.82, 0.16);
    leg.translate(0, -0.41, 0);
    this.pTorso = new THREE.InstancedMesh(torso, new THREE.MeshStandardMaterial({ roughness: 0.85 }), n);
    this.pHead = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
    this.pLeg = new THREE.InstancedMesh(leg, new THREE.MeshStandardMaterial({ roughness: 0.9 }), n * 2);
    const col = new THREE.Color();
    const shirts = [0x1d2a44, 0x7a1f1f, 0x333333, 0xc9b28a, 0x2f5a3a, 0x6a6a6a, 0xdedede, 0x3a2a1a, 0xa04a1a];
    const skins = [0xc89272, 0x8d5a3b, 0xe3b590, 0x6b4430, 0xb07a58];
    const pants = [0x1a2233, 0x222222, 0x3b3b3b, 0x4a3b2a];
    peds.forEach((p, i) => {
      this.pTorso.setColorAt(i, col.set(shirts[Math.floor(rng() * shirts.length)]));
      this.pHead.setColorAt(i, col.set(skins[Math.floor(rng() * skins.length)]));
      const pc = pants[Math.floor(rng() * pants.length)];
      this.pLeg.setColorAt(i * 2, col.set(pc));
      this.pLeg.setColorAt(i * 2 + 1, col.set(pc));
    });
    for (const m of [this.pTorso, this.pHead, this.pLeg]) {
      m.castShadow = true;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(m);
    }
  }

  setNight(k) {
    this.headMat.emissiveIntensity = 1 + k * 3;
    this.tailMat.emissiveIntensity = 1 + k * 2.5;
  }

  update(dt, focus) {
    const L = EDGE * 2;
    const { M, P, Q, V, S } = this;
    // cars
    for (let i = 0; i < this.n; i++) {
      const c = this.cars[i];
      c.s = (c.s + c.lane.speed * dt) % L;
      const t = c.s - EDGE;
      const along = c.lane.dir > 0 ? t : -t;
      let x;
      let z;
      let yaw;
      if (c.lane.axis === 'z') {
        x = c.lane.c;
        z = along;
        yaw = c.lane.dir > 0 ? 0 : Math.PI;
      } else {
        x = along;
        z = c.lane.c;
        yaw = c.lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      Q.setFromAxisAngle(UPV, yaw);
      M.compose(V.set(x, 0, z), Q, S);
      this.body.setMatrixAt(i, M);
      this.cab.setMatrixAt(i, M);
      for (let w = 0; w < 4; w++) {
        const o = this.wheelOff[w];
        P.makeRotationX((c.s / 0.36) % (Math.PI * 2)).setPosition(o[0], o[1], o[2]);
        this.wheels.setMatrixAt(i * 4 + w, P.premultiply(M));
      }
      for (let w = 0; w < 2; w++) {
        const o = this.headOff[w];
        P.makeTranslation(o[0], o[1], o[2]).premultiply(M);
        this.heads.setMatrixAt(i * 2 + w, P);
        const tt = this.tailOff[w];
        P.makeTranslation(tt[0], tt[1], tt[2]).premultiply(M);
        this.tails.setMatrixAt(i * 2 + w, P);
      }
    }
    for (const m of [this.body, this.cab, this.wheels, this.heads, this.tails]) m.instanceMatrix.needsUpdate = true;

    // pedestrians walk the sidewalk loop of their block
    const E = new THREE.Euler();
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      p.s = (p.s + (p.speed * dt) / (p.r * 2) + 4) % 4;
      p.phase += Math.abs(p.speed) * dt * 5.5;
      const side = Math.floor(p.s);
      const f = p.s - side;
      const r = p.r;
      let x;
      let z;
      let yaw;
      const d = p.speed > 0 ? 1 : -1;
      if (side === 0) {
        x = -r + 2 * r * f;
        z = -r;
        yaw = d > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else if (side === 1) {
        x = r;
        z = -r + 2 * r * f;
        yaw = d > 0 ? 0 : Math.PI;
      } else if (side === 2) {
        x = r - 2 * r * f;
        z = r;
        yaw = d > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        x = -r;
        z = r - 2 * r * f;
        yaw = d > 0 ? Math.PI : 0;
      }
      x += p.cx;
      z += p.cz;
      const bob = Math.abs(Math.sin(p.phase)) * 0.04;
      Q.setFromAxisAngle(UPV, yaw);
      M.compose(V.set(x, CURB + 1.18 + bob, z), Q, S);
      this.pTorso.setMatrixAt(i, M);
      M.compose(V.set(x, CURB + 1.63 + bob, z), Q, S);
      this.pHead.setMatrixAt(i, M);
      for (let l = 0; l < 2; l++) {
        const sw = Math.sin(p.phase + l * Math.PI) * 0.5;
        E.set(sw, yaw, 0, 'YXZ');
        Q.setFromEuler(E);
        const ox = (l ? -0.1 : 0.1) * Math.cos(yaw);
        const oz = (l ? 0.1 : -0.1) * Math.sin(yaw);
        M.compose(V.set(x + ox, CURB + 0.86 + bob, z + oz), Q, S);
        this.pLeg.setMatrixAt(i * 2 + l, M);
      }
    }
    for (const m of [this.pTorso, this.pHead, this.pLeg]) m.instanceMatrix.needsUpdate = true;
  }
}
