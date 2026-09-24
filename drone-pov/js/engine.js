/**
 * DroneGame — the 3D engine (plain JavaScript).
 * First-person only: the camera *is* the drone. Arcade 6DOF flight model with
 * swept collision, checkpoint racing, energy cells, target boards, combat,
 * hazards, particles, bloom + speed-blur post FX and a live radar.
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { buildTrack, buildWorld, sphereVsBox } from "./world.js";
import { input } from "./input.js";
import { audio } from "./audio.js";
import { getTexture, setAnisotropy } from "./textures.js";

const MAXDT = 1 / 20;
const DRONE_R = 1.7;
const V0 = new THREE.Vector3();
const FWD = new THREE.Vector3(0, 0, -1);

export class DroneGame {
  constructor(canvas, radarCanvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
    this.renderer.setClearColor(0x04070f, 1);
    this.scene = new THREE.Scene();
    this.baseFov = 80;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.25, 4200);
    this.composer = null;
    this.bloom = null;
    this.after = null;

    // flight state
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();
    this.boostFuel = 100;
    this.boosting = false;
    this.boostLock = false;
    this.boostAmt = 0;
    this.lastBoostSfx = -9;
    this.afterAmt = 0;
    this.surge = 0;
    this.cloak = 0;
    this.abilityCd = 0;
    this.hull = 3;
    this.hullMax = 3;
    this.invuln = 0;
    this.empSlow = 0;
    this.shakeAmt = 0;
    this.shakeVec = new THREE.Vector3();
    this.fireCd = 0;
    this.targetsHit = 0;

    // progress
    this.sampleIdx = 0;
    this.nextGate = 0;
    this.gateSampleIdx = [];
    this.gemsCollected = 0;
    this.kills = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.elapsed = 0;
    this.offTrackTimer = 0;
    this.state = "loading";
    this.countdown = 3.2;

    this.hud = {
      speed: 0, speedRatio: 0, altitude: 0, gems: 0, gemsTotal: 0, boost: 1, hull: 3, hullMax: 3, time: 0, timeLimit: 120,
      gate: 0, gates: 0, progress: 0, abilityReady: 1, combo: 1, kills: 0, warning: null, fps: 60, shield: 0, emp: 0,
      boosting: 0, targets: 0, targetsTotal: 0,
    };
    this.onFinish = () => {};
    this.onEvent = () => {};

    this.gemAlive = [];
    this.gemPos = [];
    this.gemGrid = new Map();
    this.gateMeshes = [];
    this.enemies = [];
    this.targets = [];
    this.turrets = [];
    this.bullets = [];
    this.rotors = [];
    this.lightning = 0;
    this.radar = null;
    this.radarCanvasEl = null;
    this.raf = 0;
    this.last = 0;
    this.fpsAcc = 0;
    this.fpsN = 0;
    this.running = false;
    this.disposed = false;
    this.groundY = -18;
    this.ceilY = 600;
    this.tmpN = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();

    this.setRadarCanvas(radarCanvas);
    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    window.addEventListener("resize", this.resize);
  }

  setRadarCanvas(c) {
    this.radarCanvasEl = c;
    this.radar = c ? c.getContext("2d") : null;
  }

  /* ------------------------------------------------------------- loading */
  load(level, stats, settings) {
    this.level = level;
    this.stats = stats;
    this.settings = settings;
    const q = settings.quality;
    const dpr = Math.min(window.devicePixelRatio || 1, q === "low" ? 1 : q === "medium" ? 1.4 : 2);
    this.renderer.setPixelRatio(dpr);
    setAnisotropy(Math.min(this.renderer.capabilities.getMaxAnisotropy(), q === "low" ? 2 : q === "medium" ? 8 : 16));

    this.scene.clear();
    this.scene.fog = new THREE.FogExp2(level.fog, level.fogDensity * 0.78);
    this.scene.background = new THREE.Color(level.fog);

    // sky dome with sun disc + halo
    const sun = new THREE.Vector3(0.5, 1, 0.3).normalize();
    const skyGeo = new THREE.SphereGeometry(3000, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(level.skyTop) },
        horizon: { value: new THREE.Color(level.skyBottom) },
        haze: { value: new THREE.Color(level.fog) },
        sunDir: { value: sun },
        sunColor: { value: new THREE.Color(level.sun) },
        sunSize: { value: level.night ? 1800 : 4200 },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 haze; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize;
        varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          float h = clamp(d.y, -1.0, 1.0);
          float t = pow(clamp(h * 1.15, 0.0, 1.0), 0.62);
          vec3 sky = mix(horizon, top, t);
          sky = mix(sky, haze, clamp(-h * 2.2, 0.0, 1.0) * 0.85);
          float cd = max(dot(d, normalize(sunDir)), 0.0);
          float disc = smoothstep(1.0 - 6.0/sunSize, 1.0 - 3.0/sunSize, cd);
          float halo = pow(cd, 7.0) * 0.42 + pow(cd, 1.6) * 0.07;
          sky += sunColor * (disc * 1.6 + halo);
          gl_FragColor = vec4(sky, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(level.skyTop, level.fog, level.ambientIntensity);
    this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight(level.ambient, level.ambientIntensity * 0.6));
    this.dirLight = new THREE.DirectionalLight(level.sun, level.sunIntensity);
    this.dirLight.position.set(0.5, 1, 0.3).multiplyScalar(300);
    this.scene.add(this.dirLight);

    this.track = buildTrack(level);
    this.world = buildWorld(level, this.track, q);
    this.scene.add(this.world.group);
    this.groundY = -18;
    const bb = new THREE.Box3().setFromPoints(this.track.samples);
    this.ceilY = bb.max.y + (level.ceiling ? 72 : 620);

    this.buildGates();
    this.buildGems();
    this.buildCombat();
    this.buildFX();
    this.buildCockpit();
    this.setupComposer(q);

    this.resetToGate(0, true);
    this.hull = this.hullMax = stats.hull;
    this.boostFuel = stats.boostTank;
    this.gemsCollected = 0;
    this.kills = 0;
    this.targetsHit = 0;
    this.elapsed = 0;
    this.nextGate = 0;
    this.combo = 1;
    this.countdown = 3.2;
    this.state = "countdown";
    this.hud.gemsTotal = this.gemPos.length;
    this.hud.gates = this.track.gates.length;
    this.hud.timeLimit = level.timeLimit;
    this.hud.hullMax = this.hullMax;
    this.resize();
  }

  setupComposer(q) {
    if (this.composer) { this.composer.dispose(); this.composer = null; }
    this.bloom = null;
    this.after = null;
    if (q === "low") return;
    const c = new EffectComposer(this.renderer);
    c.addPass(new RenderPass(this.scene, this.camera));
    const bl = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), q === "high" ? 0.4 : 0.28, 0.62, q === "high" ? 0.86 : 0.92);
    c.addPass(bl);
    this.bloom = bl;
    if (q === "high") {
      const ai = new AfterimagePass(0.82);
      ai.enabled = false;
      c.addPass(ai);
      this.after = ai;
    }
    this.composer = c;
  }

  /* --------------------------------------------------------------- build */
  buildGates() {
    this.gateMeshes = [];
    const g = new THREE.TorusGeometry(1, 0.095, 8, 36);
    const gateTex = getTexture("gate");
    const N = this.track.samples.length - 1;
    this.gateSampleIdx = [];
    this.track.gates.forEach((gate, i) => {
      const mat = new THREE.MeshBasicMaterial({ map: gateTex, color: i === 0 ? 0xffffff : 0xa9a9a2, transparent: true, opacity: 0.96, side: THREE.DoubleSide, toneMapped: false });
      const m = new THREE.Mesh(g, mat);
      m.position.copy(gate.p);
      m.quaternion.copy(gate.q);
      m.scale.set(gate.r, gate.r, gate.r);
      this.scene.add(m);
      this.gateMeshes.push(m);
      let best = 0, bd = Infinity;
      for (let s = 0; s <= N; s++) {
        const d = this.track.samples[s].distanceToSquared(gate.p);
        if (d < bd) { bd = d; best = s; }
      }
      this.gateSampleIdx.push(best);
    });
  }

  buildGems() {
    const spots = this.world.gemSpots;
    this.gemPos = spots;
    this.gemAlive = spots.map(() => true);
    const geo = new THREE.OctahedronGeometry(1.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: this.level.gem, emissive: this.level.gem, emissiveIntensity: 0.42, metalness: 0.95, roughness: 0.22, flatShading: true });
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
    im.frustumCulled = false;
    const m0 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s0 = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < spots.length; i++) im.setMatrixAt(i, m0.compose(spots[i], q0, s0));
    im.instanceMatrix.needsUpdate = true;
    this.gemMesh = im;
    this.scene.add(im);
    this.gemGrid.clear();
    const CELL = 36;
    spots.forEach((p, i) => {
      const k = Math.floor(p.x / CELL) * 73856093 + Math.floor(p.z / CELL) * 19349663;
      let a = this.gemGrid.get(k);
      if (!a) this.gemGrid.set(k, (a = []));
      a.push(i);
    });
  }

  buildCombat() {
    this.enemies = [];
    this.turrets = [];
    this.targets = [];
    this.bullets = [];

    const eBody = new THREE.OctahedronGeometry(2.2, 0);
    const eMat = new THREE.MeshStandardMaterial({ color: 0x24303f, emissive: this.level.accent, emissiveIntensity: 0.45, metalness: 0.8, roughness: 0.3, flatShading: true });
    const eRing = new THREE.TorusGeometry(3.4, 0.28, 6, 14);
    const eRingMat = new THREE.MeshBasicMaterial({ color: 0xd8342a });
    this.world.enemySpots.forEach((p, i) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(eRing, eRingMat);
      ring.rotation.x = Math.PI / 2;
      g.add(new THREE.Mesh(eBody, eMat), ring);
      g.position.copy(p);
      this.scene.add(g);
      this.enemies.push({ mesh: g, home: p.clone(), phase: i * 1.7, hp: 2 + Math.floor(this.level.id / 4), alive: true, cd: 1.5 + i * 0.4, radius: 16 + (i % 3) * 8, speed: 0.5 + this.level.id * 0.03 });
    });

    const tBase = new THREE.CylinderGeometry(3.2, 4.4, 3.4, 8);
    const tHead = new THREE.BoxGeometry(2.2, 2.2, 5.2);
    const tMat = new THREE.MeshStandardMaterial({ color: 0x2c2f38, metalness: 0.85, roughness: 0.35, emissive: 0xff2222, emissiveIntensity: 0.35, flatShading: true });
    this.world.turretSpots.forEach((s) => {
      const g = new THREE.Group();
      const head = new THREE.Mesh(tHead, tMat);
      head.position.y = 2.6;
      g.add(new THREE.Mesh(tBase, tMat), head);
      g.position.copy(s.p);
      this.scene.add(g);
      this.turrets.push({ mesh: g, head, hp: 3, alive: true, cd: Math.random() * 2, pos: s.p.clone() });
    });

    // target boards: hovering range drones with a bullseye face
    const tDisc = new THREE.CylinderGeometry(1, 1, 0.08, 20).rotateX(Math.PI / 2);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.8 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7, emissive: 0xc0392b, emissiveIntensity: 0.3 });
    const bullMat = new THREE.MeshStandardMaterial({ color: 0xf0a41c, roughness: 0.6, emissive: 0xf0a41c, emissiveIntensity: 0.4 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x2b3037, metalness: 0.75, roughness: 0.4 });
    const armGeo = new THREE.BoxGeometry(5.6, 0.28, 0.5);
    const hubGeo = new THREE.BoxGeometry(1.1, 0.8, 0.6);
    this.world.targetSpots.forEach((s, i) => {
      const g = new THREE.Group();
      const face = new THREE.Mesh(tDisc, faceMat); face.scale.setScalar(2.7);
      const ring = new THREE.Mesh(tDisc, ringMat); ring.scale.setScalar(1.75); ring.position.z = 0.07;
      const bull = new THREE.Mesh(tDisc, bullMat); bull.scale.setScalar(0.85); bull.position.z = 0.13;
      const hub = new THREE.Mesh(hubGeo, hubMat); hub.position.z = -0.6;
      const arms = new THREE.Mesh(armGeo, hubMat); arms.position.z = -0.5;
      g.add(face, ring, bull, hub, arms);
      g.position.copy(s.p);
      g.quaternion.copy(s.q);
      this.scene.add(g);
      this.targets.push({ mesh: g, pos: s.p.clone(), home: s.p.clone(), alive: true, respawn: 0, phase: i * 1.31, radius: 3.1, value: 5 + Math.floor(this.level.id / 3) });
    });

    this.bulletMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 6, 5), new THREE.MeshBasicMaterial({ color: 0x9ffcff }), 48);
    this.ebulletMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff5a4a }), 64);
    this.bulletMesh.frustumCulled = false;
    this.ebulletMesh.frustumCulled = false;
    this.scene.add(this.bulletMesh, this.ebulletMesh);
  }

  buildFX() {
    const MAX = this.settings.quality === "low" ? 220 : 520;
    this.sparks = [];
    const pos = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    for (let i = 0; i < MAX; i++) {
      this.sparks.push({ p: new THREE.Vector3(0, -99999, 0), v: new THREE.Vector3(), life: 0, max: 1, c: new THREE.Color() });
      pos[i * 3 + 1] = -99999;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.sparkGeo = g;
    this.sparkPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    this.sparkPts.frustumCulled = false;
    this.scene.add(this.sparkPts);

    const LN = this.settings.quality === "low" ? 60 : 140;
    const lg = new THREE.BufferGeometry();
    const lp = new Float32Array(LN * 6);
    for (let i = 0; i < LN; i++) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 26;
      const x = Math.cos(a) * r, y = Math.sin(a) * r, z = -Math.random() * 90;
      lp[i * 6] = x; lp[i * 6 + 1] = y; lp[i * 6 + 2] = z; lp[i * 6 + 3] = x; lp[i * 6 + 4] = y; lp[i * 6 + 5] = z - 6;
    }
    lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
    this.speedLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: this.stats.trail.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.speedLines.frustumCulled = false;
    this.camera.add(this.speedLines);
    this.scene.add(this.camera);
  }

  buildCockpit() {
    const g = new THREE.Group();
    const c = this.stats.drone.color;
    const body = new THREE.MeshStandardMaterial({ color: 0x1b1f28, metalness: 0.9, roughness: 0.32, emissive: c, emissiveIntensity: 0.22, flatShading: true });
    const glow = new THREE.MeshBasicMaterial({ color: c });
    const frame = this.stats.drone.frame;
    const armLen = frame === "heavy" ? 0.95 : frame === "delta" ? 0.86 : 0.8;
    const positions = [[-armLen, -0.44, -0.88], [armLen, -0.44, -0.88], [-armLen * 0.8, -0.34, -0.42], [armLen * 0.8, -0.34, -0.42]];
    const armGeo = new THREE.BoxGeometry(0.1, 0.07, 1);
    const ringGeo = new THREE.TorusGeometry(0.42, 0.035, 5, 16);
    const rotorGeo = new THREE.BoxGeometry(0.78, 0.012, 0.07);
    this.rotors = [];
    positions.forEach((p, i) => {
      const arm = new THREE.Mesh(armGeo, body);
      arm.position.set(p[0] * 0.5, p[1] + 0.02, p[2] * 0.5);
      arm.lookAt(p[0], p[1], p[2]);
      arm.scale.z = Math.hypot(p[0], p[2]) * 0.9;
      g.add(arm);
      const ring = new THREE.Mesh(ringGeo, frame === "orb" ? glow : body);
      ring.position.set(p[0], p[1], p[2]);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const rotor = new THREE.Mesh(rotorGeo, glow);
      rotor.position.set(p[0], p[1] + 0.03, p[2]);
      rotor.userData.dir = i % 2 === 0 ? 1 : -1;
      g.add(rotor);
      this.rotors.push(rotor);
    });
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.55), body);
    strut.position.set(0, -0.36, -0.7);
    g.add(strut);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.12), glow);
    nose.position.set(0, -0.33, -0.96);
    g.add(nose);
    g.position.set(0, 0, 0.1);
    this.cockpit = g;
    this.camera.add(g);
  }

  /* ------------------------------------------------------------- helpers */
  resetToGate(i, initial = false) {
    const gates = this.track.gates;
    const g = gates[Math.max(0, Math.min(gates.length - 1, i))];
    this.pos.copy(g.p).addScaledVector(g.n, -(initial ? 34 : 14));
    this.pos.y = Math.max(this.pos.y, this.groundY + 12);
    const look = new THREE.Matrix4().lookAt(this.pos, V0.copy(this.pos).add(g.n), new THREE.Vector3(0, 1, 0));
    this.quat.setFromRotationMatrix(look);
    this.vel.copy(g.n).multiplyScalar(initial ? 0 : 16);
    this.angVel.set(0, 0, 0);
    this.invuln = 2;
    this.offTrackTimer = 0;
    let best = 0, bd = Infinity;
    for (let s = 0; s < this.track.samples.length; s++) {
      const d = this.track.samples[s].distanceToSquared(this.pos);
      if (d < bd) { bd = d; best = s; }
    }
    this.sampleIdx = best;
  }

  spawnSparks(p, count, color, speed, life = 0.8) {
    const c = new THREE.Color(color);
    let placed = 0;
    for (let i = 0; i < this.sparks.length && placed < count; i++) {
      const s = this.sparks[i];
      if (s.life > 0) continue;
      s.p.copy(p);
      s.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      s.life = s.max = life * (0.6 + Math.random() * 0.8);
      s.c.copy(c);
      placed++;
    }
  }

  shake(a) {
    this.shakeAmt = Math.min(2.4, this.shakeAmt + a);
  }

  topSpeed() {
    return 64 * this.level.speedScale * this.stats.speed;
  }

  /* -------------------------------------------------------------- update */
  stepFlight(dt) {
    const ax = input.axes, lv = this.level, st = this.stats;
    const empActive = this.empSlow > 0;

    // angular control — arcade smooth, self-stabilising
    const agility = st.agility * (empActive ? 0.6 : 1);
    let tp = -ax.pitch * 2.4 * agility;
    let ty = -ax.yaw * 2.0 * agility;
    let tr = -ax.roll * 2.8 * agility;
    if (empActive) { const n = Math.sin(this.elapsed * 21) * 0.4; tp += n; tr -= n; }
    const k = 1 - Math.pow(0.00005, dt);
    this.angVel.x += (tp - this.angVel.x) * k;
    this.angVel.y += (ty - this.angVel.y) * k;
    this.angVel.z += (tr - this.angVel.z) * k;
    this.quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(this.angVel.x * dt, this.angVel.y * dt, this.angVel.z * dt, "XYZ"))).normalize();

    // auto-level when hands are off the sticks
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quat);
    const fwdVec = FWD.clone().applyQuaternion(this.quat);
    if (Math.abs(ax.roll) < 0.12 && Math.abs(ax.yaw) < 0.12) this.angVel.z -= right.y * 4.5 * dt * 8;
    if (Math.abs(ax.pitch) < 0.12) this.angVel.x -= fwdVec.y * 1.8 * dt * 8;

    // boost with hysteresis (no flicker when held)
    const tank = st.boostTank;
    if (this.boostFuel <= 0.5) this.boostLock = true;
    else if (this.boostFuel >= tank * 0.3) this.boostLock = false;
    const wantBoost = !!ax.boost && !this.boostLock && !empActive;
    if (wantBoost && !this.boosting && this.elapsed - this.lastBoostSfx > 0.35) {
      this.lastBoostSfx = this.elapsed;
      audio.boostStart();
    }
    this.boosting = wantBoost;
    if (this.boosting) this.boostFuel = Math.max(0, this.boostFuel - 24 * dt);
    else this.boostFuel = Math.min(tank, this.boostFuel + 14 * dt);
    if (this.surge > 0) this.surge -= dt;
    this.boostAmt += ((this.boosting ? 1 : 0) - this.boostAmt) * Math.min(1, dt * 7);
    const surgeAmt = this.surge > 0 ? 1 : 0;

    // linear
    const maxSpeed = this.topSpeed() * (empActive ? 0.62 : 1);
    const boostMul = 1 + this.boostAmt * 0.55 + surgeAmt * 0.75;
    const target = maxSpeed * (0.6 + 0.4 * ax.throttle) * boostMul * (1 - ax.brake * 0.75);
    const fwd = FWD.clone().applyQuaternion(this.quat);
    const local = this.vel.clone().applyQuaternion(this.quat.clone().invert());
    const fwdSpeed = -local.z;
    local.z -= (target - fwdSpeed) * (fwdSpeed < target ? 4.2 : 5.0) * dt;
    const latDamp = Math.pow(0.0008, dt);
    local.x *= latDamp;
    local.y *= latDamp;
    local.z *= Math.pow(0.985, dt * 10);
    this.vel.copy(local).applyQuaternion(this.quat);

    if (lv.gravity !== 0) {
      const upward = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat).y;
      const lift = lv.gravity * (0.96 * Math.max(0.3, upward));
      this.vel.y += (-lv.gravity + lift) * dt;
    }

    // hazard zones
    this.empSlow = Math.max(0, this.empSlow - dt);
    let inEmp = false;
    for (const z of this.world.zones) {
      const d2 = this.pos.distanceToSquared(z.p);
      if (d2 > z.r * z.r) continue;
      const f = 1 - Math.sqrt(d2) / z.r;
      if (z.kind === "wind") { this.vel.addScaledVector(z.dir, z.strength * f * dt * 3); this.shake(f * dt * 1.4); }
      else if (this.cloak <= 0) inEmp = true;
    }
    if (inEmp) { this.empSlow = 0.65; this.hud.emp = 1; }
    else this.hud.emp = Math.max(0, this.hud.emp - dt * 2);

    const sp = this.vel.length();
    const cap = maxSpeed * 2.1;
    if (sp > cap) this.vel.multiplyScalar(cap / sp);

    // swept integration (no tunnelling)
    const steps = Math.max(1, Math.min(8, Math.ceil((sp * dt) / 1.6)));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.pos.addScaledVector(this.vel, sdt);
      this.collide();
    }

    if (this.boostAmt > 0.05 && Math.random() < this.boostAmt * 0.9) {
      this.spawnSparks(this.pos.clone().addScaledVector(fwd, -2.6), 2, Math.random() < 0.5 ? st.trail.color : st.trail.color2, 6, 0.5);
    }
  }

  collide() {
    const w = this.world;
    const cell = w.cell;
    const cx = Math.floor(this.pos.x / cell), cz = Math.floor(this.pos.z / cell);
    const n = this.tmpN;
    let hitStrength = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const arr = w.grid.get((cx + i) * 73856093 + (cz + j) * 19349663);
      if (!arr) continue;
      for (let a = 0; a < arr.length; a++) {
        const depth = sphereVsBox(this.pos, DRONE_R, w.colliders[arr[a]], n);
        if (depth > 0) hitStrength = Math.max(hitStrength, this.resolve(n, depth, w.colliders[arr[a]].bounce));
      }
    }
    for (const mv of w.movers) {
      if (this.pos.distanceToSquared(mv.pivot) > (mv.bound + 40) * (mv.bound + 40)) continue;
      const depth = sphereVsBox(this.pos, DRONE_R, mv.col, n);
      if (depth > 0) hitStrength = Math.max(hitStrength, this.resolve(n, depth, mv.col.bounce));
    }
    const floor = this.groundY + 2.4;
    if (this.pos.y < floor) {
      this.pos.y = floor;
      if (this.vel.y < 0) { hitStrength = Math.max(hitStrength, Math.abs(this.vel.y)); this.vel.y *= -0.24; }
      this.vel.x *= 0.88;
      this.vel.z *= 0.88;
    }
    if (this.pos.y > this.ceilY) {
      this.pos.y = this.ceilY;
      if (this.vel.y > 0) this.vel.y *= -0.3;
    }
    if (hitStrength > 8) this.registerImpact(hitStrength);
  }

  resolve(n, depth, bounce) {
    this.pos.addScaledVector(n, depth + 0.02);
    const vn = this.vel.dot(n);
    if (vn < 0) {
      this.vel.addScaledVector(n, -(1 + bounce) * vn);
      this.vel.multiplyScalar(0.82);
      return -vn;
    }
    return 0;
  }

  registerImpact(strength) {
    if (this.invuln > 0 || this.cloak > 0) { this.shake(0.3); return; }
    this.hull -= strength > 34 ? 2 : 1;
    this.invuln = 1.1;
    this.combo = 1;
    this.shake(0.9 + Math.min(1.2, strength / 40));
    audio.hit();
    this.spawnSparks(this.pos, 18, 0xffaa44, 14, 0.7);
    this.onEvent("hit");
    if (this.hull <= 0) this.endRun("destroyed");
  }

  updateProgress(dt) {
    const s = this.track.samples;
    const N = s.length - 1;
    let best = this.sampleIdx;
    let bd = s[best].distanceToSquared(this.pos);
    for (let i = Math.max(0, this.sampleIdx - 10); i <= Math.min(N, this.sampleIdx + 70); i++) {
      const d = s[i].distanceToSquared(this.pos);
      if (d < bd) { bd = d; best = i; }
    }
    this.sampleIdx = best;
    const dev = Math.sqrt(bd);
    this.hud.progress = best / N;

    const soft = this.level.corridor * 1.45;
    if (dev > soft) {
      const pull = this.tmpV2.copy(s[best]).sub(this.pos).normalize();
      this.vel.addScaledVector(pull, 42 * Math.min(1, (dev - soft) / 40) * dt);
      this.offTrackTimer += dt;
      this.hud.warning = `RETURN TO COURSE  ${(4 - this.offTrackTimer).toFixed(1)}s`;
      if (this.offTrackTimer > 4) {
        this.resetToGate(this.nextGate - 1 < 0 ? 0 : this.nextGate - 1);
        this.hud.warning = null;
        audio.fail();
        this.onEvent("respawn");
      }
    } else {
      this.offTrackTimer = Math.max(0, this.offTrackTimer - dt * 2);
      if (this.hud.warning) this.hud.warning = null;
    }

    const gates = this.track.gates;
    if (this.nextGate < gates.length) {
      const g = gates[this.nextGate];
      const rel = this.tmpV2.copy(this.pos).sub(g.p);
      const along = rel.dot(g.n);
      const radial = Math.sqrt(Math.max(0, rel.lengthSq() - along * along));
      if (along > 0 && radial < g.r * 1.5) this.passGate(true);
      else if (best > this.gateSampleIdx[this.nextGate] + 6) this.passGate(false);
    }
  }

  passGate(clean) {
    const m = this.gateMeshes[this.nextGate];
    if (m) {
      m.material.color.set(clean ? 0xffffff : 0xff3322);
      m.material.opacity = clean ? 0.22 : 0.5;
    }
    if (clean) {
      audio.checkpoint();
      this.spawnSparks(this.track.gates[this.nextGate].p, 14, this.level.accent, 10, 0.6);
      this.gemsCollected += 2;
    }
    this.nextGate++;
    this.hud.gate = this.nextGate;
    if (this.nextGate < this.gateMeshes.length) {
      this.gateMeshes[this.nextGate].material.color.set(0xffffff);
      this.gateMeshes[this.nextGate].material.opacity = 1;
    }
    if (this.nextGate >= this.track.gates.length) this.endRun("finish");
  }

  updateGems(dt) {
    const CELL = 36;
    const cx = Math.floor(this.pos.x / CELL), cz = Math.floor(this.pos.z / CELL);
    const R = 4.2 + this.boostAmt * 2.2;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const arr = this.gemGrid.get((cx + i) * 73856093 + (cz + j) * 19349663);
      if (!arr) continue;
      for (const idx of arr) {
        if (!this.gemAlive[idx]) continue;
        if (this.gemPos[idx].distanceToSquared(this.pos) < R * R) {
          this.gemAlive[idx] = false;
          this.gemsCollected += Math.round(this.combo);
          this.combo = Math.min(5, this.combo + 0.25);
          this.comboTimer = 2.4;
          audio.gem(Math.floor(this.combo * 2));
          this.spawnSparks(this.gemPos[idx], 8, this.level.gem, 9, 0.5);
        }
      }
    }
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = Math.max(1, this.combo - dt * 0.8);

    const t = this.elapsed;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const axis = new THREE.Vector3(0.3, 1, 0.1).normalize();
    for (let i = 0; i < this.gemPos.length; i++) {
      if (!this.gemAlive[i]) { sc.set(0, 0, 0); mtx.compose(this.gemPos[i], q, sc); }
      else {
        if (this.gemPos[i].distanceToSquared(this.pos) > 90000) continue;
        q.setFromAxisAngle(axis, t * 2 + i);
        const s = 1 + Math.sin(t * 4 + i) * 0.12;
        sc.set(s, s, s);
        mtx.compose(this.gemPos[i], q, sc);
      }
      this.gemMesh.setMatrixAt(i, mtx);
    }
    this.gemMesh.instanceMatrix.needsUpdate = true;
  }

  updateMovers() {
    const t = this.elapsed;
    const up = new THREE.Vector3(0, 1, 0);
    for (const m of this.world.movers) {
      if (this.pos.distanceToSquared(m.pivot) > 420 * 420) continue;
      const ph = t * m.speed + m.phase;
      if (m.kind === "crane") {
        m.mesh.position.copy(m.pivot);
        m.mesh.quaternion.setFromAxisAngle(up, Math.sin(ph) * 1.15);
        m.col.p.copy(m.pivot);
        m.col.q.copy(m.mesh.quaternion);
      } else if (m.kind === "slide") {
        const right = V0.copy(m.axis).cross(up).normalize();
        m.mesh.position.copy(m.pivot).addScaledVector(right, Math.sin(ph) * m.radius);
        m.col.p.copy(m.mesh.position);
      } else if (m.kind === "swing") {
        const right = V0.copy(m.axis).cross(up).normalize();
        const a = Math.sin(ph) * 1.1;
        m.mesh.position.copy(m.pivot).addScaledVector(right, Math.sin(a) * m.radius);
        m.mesh.position.y = m.pivot.y + (Math.cos(a) - 1) * m.radius * 0.7 - m.radius * 0.6;
        m.mesh.quaternion.setFromAxisAngle(m.axis, a);
        m.col.p.copy(m.mesh.position);
        m.col.q.copy(m.mesh.quaternion);
      } else {
        m.mesh.position.copy(m.pivot);
        m.mesh.position.y = m.pivot.y + Math.sin(ph * 1.4) * m.radius * 0.8;
        m.col.p.copy(m.mesh.position);
      }
    }
  }

  updateCombat(dt) {
    const st = this.stats;
    this.fireCd -= dt;
    if (input.axes.fire && this.fireCd <= 0 && this.state === "running") {
      this.fireCd = 0.16;
      const dir = FWD.clone().applyQuaternion(this.quat);
      this.bullets.push({ p: this.pos.clone().addScaledVector(dir, 3), v: dir.multiplyScalar(300).add(this.vel.clone().multiplyScalar(0.4)), life: 1.6, from: "player" });
      audio.shoot();
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d2 = e.mesh.position.distanceToSquared(this.pos);
      if (d2 > 520 * 520) continue;
      e.phase += dt * e.speed;
      e.mesh.position.set(e.home.x + Math.cos(e.phase) * e.radius, e.home.y + Math.sin(e.phase * 1.7) * 7, e.home.z + Math.sin(e.phase) * e.radius);
      e.mesh.lookAt(this.pos);
      e.mesh.rotateZ(this.elapsed * 3);
      e.cd -= dt;
      if (d2 < 190 * 190 && e.cd <= 0 && this.cloak <= 0) {
        e.cd = Math.max(0.6, 2.4 - this.level.id * 0.1);
        const dir = this.tmpV2.copy(this.pos).sub(e.mesh.position).normalize().addScaledVector(this.vel, 0.0022).normalize();
        this.bullets.push({ p: e.mesh.position.clone(), v: dir.clone().multiplyScalar(105), life: 3.4, from: "enemy" });
      }
    }

    for (const tr of this.turrets) {
      if (!tr.alive) continue;
      const d2 = tr.pos.distanceToSquared(this.pos);
      if (d2 > 300 * 300) continue;
      tr.head.lookAt(this.pos);
      tr.cd -= dt;
      if (d2 < 165 * 165 && tr.cd <= 0 && this.cloak <= 0) {
        tr.cd = Math.max(0.7, 2.6 - this.level.id * 0.09);
        const dir = this.tmpV2.copy(this.pos).sub(tr.pos).normalize().addScaledVector(this.vel, 0.0024).normalize();
        this.bullets.push({ p: tr.pos.clone().addScaledVector(dir, 4), v: dir.clone().multiplyScalar(118), life: 3.2, from: "enemy" });
      }
    }

    const mtx = new THREE.Matrix4(), zero = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), q = new THREE.Quaternion();
    let pi = 0, ei = 0;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.p.addScaledVector(b.v, dt);
      if (b.life <= 0) { this.bullets.splice(i, 1); continue; }
      if (b.from === "player") {
        let hit = false;
        for (const tg of this.targets) {
          if (tg.alive && tg.pos.distanceToSquared(b.p) < tg.radius * tg.radius * 1.35) { this.hitTarget(tg); hit = true; break; }
        }
        if (!hit) for (const e of this.enemies) {
          if (e.alive && e.mesh.position.distanceToSquared(b.p) < 20) {
            e.hp--; hit = true; this.spawnSparks(b.p, 6, 0xffffff, 8, 0.35);
            if (e.hp <= 0) this.killEnemy(e);
            break;
          }
        }
        if (!hit) for (const tr of this.turrets) {
          if (tr.alive && tr.pos.distanceToSquared(b.p) < 34) {
            tr.hp--; hit = true; this.spawnSparks(b.p, 6, 0xffffff, 8, 0.35);
            if (tr.hp <= 0) this.killTurret(tr);
            break;
          }
        }
        if (hit) { this.bullets.splice(i, 1); continue; }
      } else if (this.cloak <= 0 && this.invuln <= 0 && b.p.distanceToSquared(this.pos) < 9) {
        this.bullets.splice(i, 1);
        this.hull -= 1;
        this.invuln = 0.9;
        this.shake(1.1);
        audio.hit();
        this.spawnSparks(this.pos, 14, 0xff6644, 12, 0.6);
        this.onEvent("hit");
        if (this.hull <= 0) this.endRun("destroyed");
        continue;
      }
      if (b.from === "player" && pi < 48) { mtx.compose(b.p, q, one); this.bulletMesh.setMatrixAt(pi++, mtx); }
      else if (b.from === "enemy" && ei < 64) { mtx.compose(b.p, q, one); this.ebulletMesh.setMatrixAt(ei++, mtx); }
    }
    for (let i = pi; i < 48; i++) { mtx.compose(zero, q, zero); this.bulletMesh.setMatrixAt(i, mtx); }
    for (let i = ei; i < 64; i++) { mtx.compose(zero, q, zero); this.ebulletMesh.setMatrixAt(i, mtx); }
    this.bulletMesh.instanceMatrix.needsUpdate = true;
    this.ebulletMesh.instanceMatrix.needsUpdate = true;

    this.abilityCd = Math.max(0, this.abilityCd - dt);
    this.cloak = Math.max(0, this.cloak - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (input.axes.ability && this.abilityCd <= 0 && st.ability && this.state === "running") this.useAbility(st.ability);
  }

  useAbility(id) {
    audio.ability();
    this.onEvent("ability", id);
    switch (id) {
      case "surge": this.surge = 2; this.abilityCd = 9; this.shake(0.5); break;
      case "emp": {
        this.abilityCd = 14;
        this.spawnSparks(this.pos, 60, 0x9fe8ff, 30, 1.1);
        const R2 = 90 * 90;
        this.enemies.forEach((e) => { if (e.alive && e.mesh.position.distanceToSquared(this.pos) < R2) this.killEnemy(e); });
        this.turrets.forEach((t) => { if (t.alive && t.pos.distanceToSquared(this.pos) < R2) this.killTurret(t); });
        this.targets.forEach((tg) => { if (tg.alive && tg.pos.distanceToSquared(this.pos) < R2) this.hitTarget(tg); });
        this.bullets = this.bullets.filter((b) => b.from === "player" || b.p.distanceToSquared(this.pos) > R2);
        this.shake(0.8);
        break;
      }
      case "cloak": this.cloak = 3; this.invuln = 3; this.abilityCd = 20; break;
      case "repair": this.hull = Math.min(this.hullMax, this.hull + 1); this.abilityCd = 25; this.spawnSparks(this.pos, 20, 0x7cff9b, 8, 0.8); break;
    }
  }

  hitTarget(t) {
    if (!t.alive) return;
    t.alive = false;
    t.respawn = 8;
    t.mesh.visible = false;
    this.targetsHit++;
    this.gemsCollected += t.value;
    this.combo = Math.min(5, this.combo + 0.3);
    this.comboTimer = 2.4;
    audio.tone(920, 0.08, "square", 0.16);
    audio.tone(1380, 0.13, "sine", 0.1);
    this.spawnSparks(t.pos, 16, 0xffc247, 14, 0.7);
    this.onEvent("target");
  }

  updateTargets(dt) {
    for (const t of this.targets) {
      if (!t.alive) {
        t.respawn -= dt;
        if (t.respawn <= 0) { t.alive = true; t.mesh.visible = true; t.mesh.position.copy(t.home); }
        continue;
      }
      t.phase += dt;
      t.pos.copy(t.home);
      t.pos.y += Math.sin(t.phase * 1.3) * 0.45;
      t.mesh.position.copy(t.pos);
      t.mesh.rotation.z = Math.sin(t.phase * 0.9) * 0.1;
    }
  }

  killEnemy(e) {
    e.alive = false; e.mesh.visible = false; this.kills++; this.gemsCollected += 12;
    audio.explosion(); this.spawnSparks(e.mesh.position, 26, 0xffa347, 22, 1); this.onEvent("kill");
  }
  killTurret(t) {
    t.alive = false; t.mesh.visible = false; this.kills++; this.gemsCollected += 8;
    audio.explosion(); this.spawnSparks(t.pos, 22, 0xff7733, 20, 1); this.onEvent("kill");
  }

  updateSparks(dt) {
    const pos = this.sparkGeo.attributes.position, col = this.sparkGeo.attributes.color;
    const arr = pos.array, carr = col.array;
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i];
      if (s.life <= 0) { arr[i * 3 + 1] = -99999; continue; }
      s.life -= dt;
      s.v.multiplyScalar(Math.pow(0.22, dt));
      s.p.addScaledVector(s.v, dt);
      const f = Math.max(0, s.life / s.max);
      arr[i * 3] = s.p.x; arr[i * 3 + 1] = s.p.y; arr[i * 3 + 2] = s.p.z;
      carr[i * 3] = s.c.r * f; carr[i * 3 + 1] = s.c.g * f; carr[i * 3 + 2] = s.c.b * f;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  updateAmbient(dt) {
    const a = this.world.ambient;
    if (!a) return;
    a.position.copy(this.pos);
    const spread = a.userData.spread || 300;
    const drift = a.userData.drift;
    if (!drift || (drift.x === 0 && drift.y === 0 && drift.z === 0)) return;
    const attr = a.geometry.attributes.position;
    const arr = attr.array;
    const half = spread * 0.5, halfY = spread * 0.3;
    const dx = drift.x * dt, dy = drift.y * dt, dz = drift.z * dt;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += dx; arr[i + 1] += dy; arr[i + 2] += dz;
      if (arr[i] > half) arr[i] -= spread; else if (arr[i] < -half) arr[i] += spread;
      if (arr[i + 1] > halfY) arr[i + 1] -= halfY * 2; else if (arr[i + 1] < -halfY) arr[i + 1] += halfY * 2;
      if (arr[i + 2] > half) arr[i + 2] -= spread; else if (arr[i + 2] < -half) arr[i + 2] += spread;
    }
    attr.needsUpdate = true;
  }

  updateCamera(dt) {
    const speed = this.vel.length();
    const ratio = THREE.MathUtils.clamp(speed / (this.topSpeed() * 1.55), 0, 1.3);
    const targetFov = this.baseFov + ratio * 16 + this.boostAmt * 9 + (this.surge > 0 ? 8 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();

    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    const amp = (this.shakeAmt * 0.55 + ratio * 0.055 + (this.boosting ? 0.05 : 0)) * this.settings.shake;
    const t = this.elapsed;
    this.shakeVec.set(
      Math.sin(t * 47.3) * amp + Math.sin(t * 13.1) * amp * 0.4,
      Math.cos(t * 41.7) * amp + Math.cos(t * 17.7) * amp * 0.4,
      Math.sin(t * 31.9) * amp * 0.4
    );
    this.camera.position.copy(this.pos).add(this.shakeVec);
    this.camera.quaternion.copy(this.quat);
    this.camera.rotateZ(this.shakeVec.x * 0.12);
    this.camera.rotateX(this.shakeVec.y * 0.05);

    const lm = this.speedLines.material;
    const lineGoal = THREE.MathUtils.clamp((ratio - 0.35) * 1.5, 0, 0.85) * (1 + this.boostAmt * 0.8);
    lm.opacity += (lineGoal - lm.opacity) * Math.min(1, dt * 8);
    const lp = this.speedLines.geometry.attributes.position;
    const la = lp.array;
    const adv = speed * dt * 2.2;
    for (let i = 0; i < la.length / 6; i++) {
      la[i * 6 + 2] += adv; la[i * 6 + 5] += adv;
      if (la[i * 6 + 2] > 6) {
        const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 26;
        la[i * 6] = Math.cos(a) * r; la[i * 6 + 1] = Math.sin(a) * r;
        la[i * 6 + 3] = la[i * 6]; la[i * 6 + 4] = la[i * 6 + 1];
        la[i * 6 + 2] = -95; la[i * 6 + 5] = -100 - Math.random() * 10;
      }
    }
    lp.needsUpdate = true;

    const spin = 26 + ratio * 40 + this.boostAmt * 18;
    for (const r of this.rotors) r.rotation.y += spin * dt * r.userData.dir;
    this.cockpit.position.y = -0.02 + Math.sin(t * 8) * 0.004 - ratio * 0.02;
    this.cockpit.rotation.z = -this.angVel.z * 0.03;
    this.cockpit.rotation.x = this.angVel.x * 0.03;

    this.updateAmbient(dt);
    this.sky.position.copy(this.pos);

    if (this.after) {
      const blurGoal = Math.min(1, this.boostAmt + (this.surge > 0 ? 1 : 0) + Math.max(0, (ratio - 0.9) / 0.35));
      this.afterAmt += (blurGoal - this.afterAmt) * Math.min(1, dt * 4);
      this.after.enabled = true;
      this.after.uniforms.damp.value = 0.04 + this.afterAmt * (0.6 + ratio * 0.14);
    }
    if (this.bloom) {
      const bloomGoal = (this.settings.quality === "high" ? 0.38 : 0.26) + this.boostAmt * 0.14 + this.hud.emp * 0.22;
      this.bloom.strength += (bloomGoal - this.bloom.strength) * Math.min(1, dt * 5);
    }

    if (this.level.biome === "farmland") {
      this.lightning -= dt;
      if (this.lightning <= 0) { this.lightning = 3 + Math.random() * 7; this.dirLight.intensity = 5.5; }
      this.dirLight.intensity += (this.level.sunIntensity - this.dirLight.intensity) * Math.min(1, dt * 5.5);
    }
    if (this.level.biome === "volcano") this.hemi.intensity = this.level.ambientIntensity * (0.86 + Math.sin(t * 1.4) * 0.14);
    for (const s of this.world.spinners) {
      if (this.pos.distanceToSquared(s.obj.getWorldPosition(this.tmpV2)) > 700 * 700) continue;
      if (s.axis === "z") s.obj.rotation.z += s.speed * dt;
      else if (s.axis === "y") s.obj.rotation.y += s.speed * dt;
      else s.obj.rotation.x += s.speed * dt;
    }
  }

  drawRadar() {
    const ctx = this.radar;
    if (!ctx) return;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cxp = W / 2, cyp = H / 2, R = Math.min(W, H) / 2 - 2, RANGE = 260;
    ctx.save();
    ctx.beginPath(); ctx.arc(cxp, cyp, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "rgba(10,13,17,0.68)"; ctx.fillRect(0, 0, W, H);
    const f = FWD.clone().applyQuaternion(this.quat);
    const ang = Math.atan2(f.x, f.z);
    const cos = Math.cos(-ang), sin = Math.sin(-ang);
    const proj = (p) => {
      const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
      return [cxp + ((dx * cos - dz * sin) / RANGE) * R, cyp + ((dx * sin + dz * cos) / RANGE) * R];
    };
    ctx.strokeStyle = "rgba(255,196,110,0.62)"; ctx.lineWidth = 2; ctx.beginPath();
    const s = this.track.samples;
    const from = Math.max(0, this.sampleIdx - 20), to = Math.min(s.length - 1, this.sampleIdx + 90);
    for (let i = from; i <= to; i++) { const [x, y] = proj(s[i]); if (i === from) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = "#39ff88";
    for (let i = this.nextGate; i < Math.min(this.track.gates.length, this.nextGate + 3); i++) {
      const [x, y] = proj(this.track.gates[i].p);
      ctx.beginPath(); ctx.arc(x, y, i === this.nextGate ? 4 : 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#e2503c";
    this.enemies.forEach((e) => { if (!e.alive) return; const [x, y] = proj(e.mesh.position); ctx.fillRect(x - 2, y - 2, 4, 4); });
    this.turrets.forEach((t) => { if (!t.alive) return; const [x, y] = proj(t.pos); ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6); });
    ctx.fillStyle = "#ffc247";
    this.targets.forEach((tg) => { if (!tg.alive) return; const [x, y] = proj(tg.pos); ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
    ctx.strokeStyle = "rgba(255,196,110,0.5)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cxp, cyp, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(cxp, cyp - 6); ctx.lineTo(cxp - 4, cyp + 5); ctx.lineTo(cxp + 4, cyp + 5); ctx.closePath(); ctx.fill();
  }

  /* ---------------------------------------------------------------- loop */
  tick(now) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    if (!this.last) this.last = now;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > MAXDT) dt = MAXDT;
    if (dt <= 0) return;

    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.hud.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }

    if (this.state === "paused") { this.render(); return; }
    input.update(dt);

    if (this.state === "countdown") {
      this.countdown -= dt;
      this.updateMovers();
      this.updateCamera(dt);
      if (this.countdown <= 0) { this.state = "running"; this.onEvent("go"); }
      this.render(); this.drawRadar(); this.syncHud();
      return;
    }
    if (this.state === "running") {
      this.elapsed += dt;
      this.stepFlight(dt);
      this.updateProgress(dt);
      this.updateGems(dt);
      this.updateTargets(dt);
      this.updateMovers();
      this.updateCombat(dt);
      if (this.elapsed >= this.level.timeLimit) this.endRun("timeout");
    }
    this.updateSparks(dt);
    this.updateCamera(dt);
    audio.updateFlight(THREE.MathUtils.clamp(input.axes.throttle + 0.35, 0, 1), THREE.MathUtils.clamp(this.vel.length() / 110, 0, 1), this.boostAmt > 0.35);
    this.render();
    this.drawRadar();
    this.syncHud();
  }

  syncHud() {
    const h = this.hud;
    const speed = this.vel.length();
    h.speed = Math.round(speed * 2.65);
    h.speedRatio = THREE.MathUtils.clamp(speed / (this.topSpeed() * 1.55), 0, 1);
    h.altitude = Math.round(this.pos.y + 18);
    h.gems = this.gemsCollected;
    h.boost = this.boostFuel / this.stats.boostTank;
    h.hull = Math.max(0, this.hull);
    h.time = this.elapsed;
    h.gate = this.nextGate;
    h.abilityReady = this.stats.ability ? 1 - this.abilityCd / this.abilityCdMax() : 0;
    h.combo = this.combo;
    h.kills = this.kills;
    h.shield = this.cloak > 0 ? this.cloak / 3 : this.invuln > 0 ? this.invuln : 0;
    h.boosting = this.boostAmt;
    h.targets = this.targetsHit;
    h.targetsTotal = this.targets.length;
  }

  abilityCdMax() {
    return { surge: 9, emp: 14, cloak: 20, repair: 25 }[this.stats.ability] || 1;
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /* ------------------------------------------------------------- control */
  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    audio.startFlight();
    audio.startMusic(this.level);
    this.raf = requestAnimationFrame(this.tick);
  }
  pause() {
    if (this.state === "running" || this.state === "countdown") {
      this.pausedFrom = this.state;
      this.state = "paused";
      audio.stopFlight();
      input.reset();
      input.exitPointerLock();
    }
  }
  resume() {
    if (this.state === "paused") {
      // Pausing during the 3-2-1 used to resume straight into "running" and
      // skip the rest of the countdown.
      this.state = this.nextGate >= this.track.gates.length ? "over" : this.pausedFrom === "countdown" ? "countdown" : "running";
      if (this.state !== "over") audio.resumeFlight();
      this.last = 0;
    }
  }

  endRun(reason) {
    if (this.state === "over") return;
    this.state = "over";
    audio.stopFlight();
    audio.stopMusic();
    const finished = reason === "finish";
    if (finished) audio.victory();
    else { audio.explosion(); this.spawnSparks(this.pos, 60, 0xffaa44, 26, 1.4); this.shake(2); }
    const time = this.elapsed;
    let stars = 0;
    if (finished) { stars = 1; if (time <= this.level.parTime * 1.25) stars = 2; if (time <= this.level.parTime) stars = 3; }
    const timeBonus = finished ? Math.max(0, Math.round((this.level.timeLimit - time) * 2.2)) : 0;
    const payout = finished ? Math.round(this.level.reward + this.gemsCollected + timeBonus + this.kills * 15) : Math.round(this.gemsCollected * 0.4);
    this.onFinish({
      levelId: this.level.id, finished, reason, time, gems: this.gemsCollected, gemsTotal: this.gemPos.length, kills: this.kills,
      targets: this.targetsHit, targetsTotal: this.targets.length, gates: this.nextGate, gatesTotal: this.track.gates.length, stars, payout,
    });
  }

  quit() {
    if (this.state !== "over") this.endRun("quit");
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.resolution.set(w, h);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    audio.stopFlight();
    audio.stopMusic();
    try {
      if (this.world) this.world.dispose();
      if (this.composer) this.composer.dispose();
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mm = o.material;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else if (mm) mm.dispose();
      });
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    } catch {
      /* ignore */
    }
  }
}
