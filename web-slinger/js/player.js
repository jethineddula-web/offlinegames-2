// The hero: movement state machine (run, parkour, web-swing, web-zip,
// point-launch, wall-crawl/run), combat actions and procedural animation.
import * as THREE from 'three';
import { buildHumanoid, heroMaterials, Animator, Pose, newPose } from './hero.js';
import { clamp, dampAngle, angleDiff } from './utils.js';
import { EDGE } from './city.js';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const R = 0.38;
const H = 1.8;
const GRAV = 28;
const RUN = 8.5;
const SPRINT = 17;

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const m1 = new THREE.Matrix4();

export class Player {
  constructor(game) {
    this.game = game;
    this.city = game.city;
    this.rig = buildHumanoid(heroMaterials(), { hero: true });
    this.model = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.95;
    this.rig.root.position.y = -0.95;
    this.pivot.add(this.rig.root);
    this.model.add(this.pivot);
    game.scene.add(this.model);
    this.anim = new Animator(this.rig);
    this.pose = newPose();

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.state = 'ground';
    this.yaw = 0;
    this.rope = null;
    this.zip = null;
    this.wall = { nx: 0, nz: 1, box: null };
    this.contact = { hit: false, nx: 0, nz: 0, box: null, stepped: false };
    this.wish = new THREE.Vector3();
    this.wishMag = 0;
    this.forceVel = null;
    this.side = 1;
    this.t = 0;

    this.health = 100;
    this.maxHealth = 100;
    this.focus = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboStep = 0;
    this.lastAttack = -10;
    this.lastHurt = -10;
    this.invuln = 0;
    this.action = null;
    this.buffered = false;

    this.zipCD = 0;
    this.swingCD = 0;
    this.webZipT = 0;
    this.landT = 0;
    this.perchT = 0;
    this.trick = null;
    this.runPhase = 0;
    this.wallPhase = 0;
    this.sprinting = false;
    this.launchTarget = null;
    this.launchScan = 0;
    this.lastSafe = new THREE.Vector3();
    this.safeTimer = 0;
    this.dead = false;
    this.targetQ = new THREE.Quaternion();
    this.prevYaw = 0;
    this.lean = 0;
    this.airTime = 0;
  }

  spawn(p, yaw = 0) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.state = 'ground';
    this.rope = null;
    this.zip = null;
    this.action = null;
    this.lastSafe.copy(p);
    this.model.position.copy(p);
    this.model.quaternion.setFromAxisAngle(UP, yaw);
    this.perchT = 1e9;
  }

  get speed() {
    return this.vel.length();
  }
  get hSpeed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }
  get busy() {
    return this.dead;
  }

  // ======================================================================
  update(dt, input, cam) {
    const G = this.game;
    this.t += dt;
    for (const k of ['zipCD', 'swingCD', 'webZipT', 'landT', 'invuln']) this[k] = Math.max(0, this[k] - dt);
    if (this.perchT < 1e8) this.perchT = Math.max(0, this.perchT - dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;

    if (this.dead) {
      this.deadT -= dt;
      this.vel.set(0, 0, 0);
      if (this.deadT <= 0) this.respawn();
      this.updateModel(dt);
      return;
    }

    // camera-relative wish direction
    const mv = input.move;
    this.wish.set(0, 0, 0).addScaledVector(cam.fwdFlat, mv.y).addScaledVector(cam.rightFlat, mv.x);
    this.wishMag = mv.mag;
    if (this.wish.lengthSq() > 1e-4) this.wish.normalize();
    this.mv = mv;
    if (this.wishMag > 0.1 || this.hSpeed > 1) this.perchT = Math.min(this.perchT, 0);

    // ---------------------------------------------------------- discrete inputs
    if (input.jump) this.onJump(input, cam);
    if (input.launch && this.launchTarget && this.state !== 'zip') this.startZip(this.launchTarget);
    if (input.trick && (this.state === 'air') && !this.trick) this.doTrick();
    if (input.attack) this.attack(cam);
    if (input.web) this.shootWeb(cam);
    if (input.dodge) this.dodge(cam);
    if (input.heal) this.useHeal();
    if (input.finisher) this.useFinisher(cam);

    // hold-to-swing
    if (this.state === 'air' && input.swing && this.swingCD <= 0 && !this.action) {
      const gy = this.city.groundHeight(this.pos.x, this.pos.z, this.pos.y);
      if (this.pos.y - gy > 3.2) this.attachSwing(cam);
    }

    this.updateAction(dt, cam);

    // ---------------------------------------------------------- physics
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      switch (this.state) {
        case 'ground': this.stepGround(h, input); break;
        case 'air': this.stepAir(h, input); break;
        case 'swing': this.stepSwing(h, input); break;
        case 'wall': this.stepWall(h, input, cam); break;
        case 'zip': this.stepZip(h, input); break;
      }
    }
    if (this.state !== 'ground') this.airTime += dt;
    else this.airTime = 0;

    // water / out of bounds
    if ((Math.abs(this.pos.x) > EDGE || Math.abs(this.pos.z) > EDGE) && this.pos.y < -1.4) {
      G.fx.splash(this.pos);
      G.audio.splash();
      G.hud.notify('BACK TO THE CITY', 'Spider-sense says: no swimming');
      this.spawn(this.lastSafe, this.yaw);
      this.perchT = 0;
    }
    if (this.state === 'ground' && Math.abs(this.pos.x) < EDGE - 2 && Math.abs(this.pos.z) < EDGE - 2) {
      this.safeTimer += dt;
      if (this.safeTimer > 0.6) this.lastSafe.copy(this.pos);
    } else this.safeTimer = 0;

    // regen
    if (this.t - this.lastHurt > 5 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + 7 * dt);

    // point-launch target scan
    this.launchScan -= dt;
    if (this.launchScan <= 0) {
      this.launchScan = 0.08;
      this.scanLaunch(cam);
    }

    this.updateModel(dt);
  }

  // ======================================================================
  onJump(input, cam) {
    const G = this.game;
    switch (this.state) {
      case 'ground': {
        const sprint = input.swing;
        this.vel.y = sprint ? 14.5 : 11.5;
        if (sprint && this.hSpeed > 10) {
          // parkour vault-jump keeps momentum
          const k = 1.08;
          this.vel.x *= k;
          this.vel.z *= k;
        }
        this.state = 'air';
        this.perchT = 0;
        this.pos.y += 0.05;
        G.audio.whoosh(0.5);
        if (this.landT > 0) {
          // perfectly-timed jump out of a landing = bigger jump
          this.vel.y += 4;
        }
        break;
      }
      case 'air':
        if (this.zipCD <= 0 && !this.action) this.webZip(cam);
        break;
      case 'swing':
        this.releaseSwing(true, 1.4);
        this.swingCD = 0.3;
        break;
      case 'wall': {
        const n = v1.set(this.wall.nx, 0, this.wall.nz);
        this.vel.set(n.x * 9, 12, n.z * 9).addScaledVector(cam.fwdFlat, 4);
        this.state = 'air';
        this.swingCD = 0.15;
        this.yaw = Math.atan2(this.vel.x, this.vel.z);
        this.doTrick('flip');
        G.audio.whoosh(0.8);
        break;
      }
      case 'zip':
        this.zip.launch = true;
        break;
    }
  }

  webZip(cam) {
    const G = this.game;
    const dir = v1.copy(this.wishMag > 0.1 ? this.wish : cam.fwdFlat).normalize();
    const hs = this.hSpeed;
    const sp = Math.max(hs * 1.05, 26);
    this.vel.x = dir.x * sp;
    this.vel.z = dir.z * sp;
    this.vel.y = Math.max(this.vel.y, 0) * 0.3 + 8;
    this.zipCD = 0.75;
    this.webZipT = 0.35;
    this.yaw = Math.atan2(dir.x, dir.z);
    // two strands to a point ahead
    const tgt = v2.copy(this.pos).addScaledVector(dir, 22).add(v3.set(0, 12, 0));
    this.rig.root.updateMatrixWorld(true);
    G.fx.webs.spawn(this.rig.J.handL.getWorldPosition(v3), tgt, false, 0.25);
    G.fx.webs.spawn(this.rig.J.handR.getWorldPosition(v3), tgt, false, 0.25);
    G.audio.zip();
    G.camRig.kick(0.25);
  }

  // ======================================================================
  stepGround(h, input) {
    const sprint = input.swing && !this.action;
    this.sprinting = sprint && this.wishMag > 0.1;
    if (this.forceVel) {
      this.vel.x = this.forceVel.x;
      this.vel.z = this.forceVel.z;
    } else {
      const slow = this.action ? 0.15 : 1;
      const tgt = this.wishMag * (sprint ? SPRINT : RUN) * slow;
      const tx = this.wish.x * tgt;
      const tz = this.wish.z * tgt;
      const acc = (this.wishMag > 0.05 ? (sprint ? 42 : 60) : 45) * h;
      let dx = tx - this.vel.x;
      let dz = tz - this.vel.z;
      const l = Math.hypot(dx, dz);
      if (l > acc) {
        dx *= acc / l;
        dz *= acc / l;
      }
      this.vel.x += dx;
      this.vel.z += dz;
    }
    this.vel.y = 0;
    this.pos.x += this.vel.x * h;
    this.pos.z += this.vel.z * h;
    const c = this.city.resolve(this.pos, R, H, true, this.contact);
    if (c.hit) {
      const vn = this.vel.x * c.nx + this.vel.z * c.nz;
      if (vn < 0) {
        this.vel.x -= vn * c.nx;
        this.vel.z -= vn * c.nz;
      }
      if (sprint && this.wishMag > 0.3 && -(this.wish.x * c.nx + this.wish.z * c.nz) > 0.5) {
        this.enterWall(c, 9);
        return;
      }
    }
    const g = this.city.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.1);
    if (this.pos.y - g > 0.4) {
      this.state = 'air';
      return;
    }
    this.pos.y = g;
    if (this.hSpeed > 0.6 && !this.action) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 14, h);
  }

  stepAir(h, input) {
    const prevY = this.pos.y;
    const diving = input.dive && !this.action;
    if (this.forceVel) {
      this.vel.x = this.forceVel.x;
      this.vel.z = this.forceVel.z;
      this.vel.y = this.forceVel.y;
    } else {
      this.vel.y -= (diving ? 48 : GRAV) * h;
      if (this.action && this.action.type === 'attack') this.vel.y = Math.max(this.vel.y, -3); // air-combo hang time
      if (this.wishMag > 0.05) {
        const hs = this.hSpeed;
        const want = Math.max(hs, 9);
        let dx = this.wish.x * want * this.wishMag - this.vel.x;
        let dz = this.wish.z * want * this.wishMag - this.vel.z;
        const acc = (hs > 20 ? 14 : 22) * h;
        const l = Math.hypot(dx, dz);
        if (l > acc) {
          dx *= acc / l;
          dz *= acc / l;
        }
        this.vel.x += dx;
        this.vel.z += dz;
      }
      if (diving) {
        // dive converts height into forward speed
        const hs = this.hSpeed;
        if (hs > 1 && hs < 50) {
          const k = 1 + 0.5 * h;
          this.vel.x *= k;
          this.vel.z *= k;
        }
      }
    }
    this.vel.y = Math.max(this.vel.y, -75);
    this.pos.addScaledVector(this.vel, h);

    const c = this.city.resolve(this.pos, R, H, false, this.contact);
    if (c.hit) {
      const box = c.box;
      if (box.y1 - this.pos.y < 1.3) {
        // grab the ledge and pull up
        this.pos.y = box.y1;
        this.land(box.y1, true);
        return;
      }
      const vn = this.vel.x * c.nx + this.vel.z * c.nz;
      if (!this.action) {
        this.enterWall(c, Math.max(0, -vn));
        return;
      }
      if (vn < 0) {
        this.vel.x -= vn * c.nx;
        this.vel.z -= vn * c.nz;
      }
    }
    const g = this.city.groundHeight(this.pos.x, this.pos.z, prevY);
    if (this.pos.y <= g && this.vel.y <= 0) this.land(g);
    if (this.hSpeed > 1 && !this.action) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 5, h);
  }

  land(g, soft = false) {
    const G = this.game;
    const impact = -this.vel.y;
    this.pos.y = g;
    this.vel.y = 0;
    this.state = 'ground';
    this.trick = null;
    this.pivot.rotation.set(0, 0, 0);
    if (!soft && impact > 30) {
      this.landT = 0.32;
      const hs = this.hSpeed;
      const k = Math.min(1, 17 / Math.max(hs, 1)) * 0.6;
      this.vel.x *= k;
      this.vel.z *= k;
      G.fx.impactDust(this.pos, 30, 7);
      G.fx.ring(this.pos, 10, 0xffffff);
      G.audio.land(true);
      G.camRig.shake(0.5);
    } else if (impact > 14) {
      this.landT = 0.15;
      G.fx.impactDust(this.pos, 10, 3);
      G.audio.land(false);
    }
    const hs = this.hSpeed;
    if (hs > SPRINT) {
      this.vel.x *= SPRINT / hs;
      this.vel.z *= SPRINT / hs;
    }
  }

  // ======================================================================
  attachSwing(cam) {
    const G = this.game;
    const city = this.city;
    const hs = this.hSpeed;
    const dir = v1;
    if (this.wishMag > 0.1) dir.copy(this.wish);
    else if (hs > 3) dir.set(this.vel.x, 0, this.vel.z).normalize();
    else dir.copy(cam.fwdFlat);
    const right = v2.set(-dir.z, 0, dir.x);
    const ahead = Math.min(42, 15 + hs * 0.5);
    const lift = 20 + Math.min(10, Math.max(0, -this.vel.y) * 0.2);
    const desired = v3.copy(this.pos).addScaledVector(dir, ahead).addScaledVector(right, this.side * 7);
    desired.y += lift;

    let best = null;
    let bestScore = Infinity;
    const list = city.query(desired.x, desired.z, 45, []);
    for (const b of list) {
      if (b.y1 < this.pos.y + 6) continue;
      const ay = clamp(desired.y, this.pos.y + 6, b.y1);
      let qx = clamp(desired.x, b.x0, b.x1);
      let qz = clamp(desired.z, b.z0, b.z1);
      if (qx === desired.x && qz === desired.z) {
        // desired point is inside the building: use the face that looks at us
        const cx = (b.x0 + b.x1) / 2;
        const cz = (b.z0 + b.z1) / 2;
        const px = this.pos.x - cx;
        const pz = this.pos.z - cz;
        if (Math.abs(px) / (b.x1 - b.x0) > Math.abs(pz) / (b.z1 - b.z0)) qx = px > 0 ? b.x1 : b.x0;
        else qz = pz > 0 ? b.z1 : b.z0;
      }
      const dx = qx - this.pos.x;
      const dy = ay - this.pos.y;
      const dz = qz - this.pos.z;
      const dp = Math.hypot(dx, dy, dz);
      if (dp < 9 || dp > 80) continue;
      const hl = Math.hypot(dx, dz) || 1;
      const fwd = (dx * dir.x + dz * dir.z) / hl;
      if (fwd < 0.15) continue;
      const score = Math.hypot(qx - desired.x, ay - desired.y, qz - desired.z) - fwd * 10;
      if (score < bestScore) {
        bestScore = score;
        best = [qx, ay, qz];
      }
    }
    const anchor = new THREE.Vector3();
    if (best) anchor.fromArray(best);
    else {
      // open sky (park / river): cheat a little so swinging never dead-ends
      anchor.copy(desired);
      anchor.y = Math.max(desired.y, this.pos.y + 18);
    }
    const floor = city.baseHeight(this.pos.x, this.pos.z);
    const dist = anchor.distanceTo(this.pos);
    const maxLen = anchor.y - floor - 2.5;
    if (maxLen < 6) return;
    const hand = this.side > 0 ? 'R' : 'L';
    this.side = -this.side;
    this.rig.root.updateMatrixWorld(true);
    const web = G.fx.webs.spawn(this.rig.J['hand' + hand].getWorldPosition(v2), anchor, true);
    this.rope = { anchor, len: dist, target: Math.min(dist * 0.97, maxLen), hand, web, t: 0 };
    this.state = 'swing';
    this.trick = null;
    this.pivot.rotation.set(0, 0, 0);
    G.audio.thwip();
    G.fx.webPuff(anchor, 6);
  }

  releaseSwing(boost, mult = 1) {
    const G = this.game;
    if (!this.rope) return;
    G.fx.webs.release(this.rope.web);
    this.rope = null;
    this.state = 'air';
    if (boost && this.vel.y > -6) {
      this.vel.y = Math.max(this.vel.y, 0) + 6.5 * mult;
      const hs = this.hSpeed;
      if (hs > 1) {
        const k = Math.min(1.07 * mult, 52 / hs);
        this.vel.x *= Math.max(k, 1);
        this.vel.z *= Math.max(k, 1);
      }
      G.audio.whoosh(0.6);
    }
  }

  stepSwing(h, input) {
    const rp = this.rope;
    const A = rp.anchor;
    const prevY = this.pos.y;
    rp.t += h;
    this.vel.y -= 30 * h;

    const d = v1.subVectors(this.pos, A);
    let L = d.length();
    const dn = d.divideScalar(L || 1);
    // pump along the tangent plane in the steering direction
    const pd = v2;
    if (this.wishMag > 0.1) pd.copy(this.wish);
    else pd.set(this.vel.x, 0, this.vel.z).normalize();
    const along = pd.dot(dn);
    pd.addScaledVector(dn, -along);
    this.vel.addScaledVector(pd, (this.wishMag > 0.1 ? 15 : 7) * h);
    // steer horizontal velocity toward the wish direction
    if (this.wishMag > 0.1) {
      const hs = this.hSpeed;
      const k = Math.min(1, 1.6 * h);
      this.vel.x += (this.wish.x * hs - this.vel.x) * k;
      this.vel.z += (this.wish.z * hs - this.vel.z) * k;
    }
    if (rp.len > rp.target) rp.len = Math.max(rp.target, rp.len - 24 * h);
    const gy = this.city.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y - gy < 2.6 && this.vel.y < 0) rp.len = Math.max(4, rp.len - 30 * h);

    this.pos.addScaledVector(this.vel, h);
    d.subVectors(this.pos, A);
    L = d.length();
    if (L > rp.len) {
      d.multiplyScalar(1 / L);
      this.pos.copy(A).addScaledVector(d, rp.len);
      const vr = this.vel.dot(d);
      if (vr > 0) this.vel.addScaledVector(d, -vr);
    }
    const sp = this.vel.length();
    if (sp > 56) this.vel.multiplyScalar(56 / sp);

    const c = this.city.resolve(this.pos, R, H, false, this.contact);
    if (c.hit) {
      if (c.box.y1 - this.pos.y < 1.3) {
        this.releaseSwing(false);
        this.pos.y = c.box.y1;
        this.land(c.box.y1, true);
        return;
      }
      const vn = -(this.vel.x * c.nx + this.vel.z * c.nz);
      this.releaseSwing(false);
      this.enterWall(c, Math.max(0, vn));
      return;
    }
    const g = this.city.groundHeight(this.pos.x, this.pos.z, prevY);
    if (this.pos.y <= g) {
      this.releaseSwing(false);
      this.land(g);
      return;
    }
    if (this.hSpeed > 1) this.yaw = Math.atan2(this.vel.x, this.vel.z);

    // chaining: release near the top of the forward arc while still holding
    const hx = this.pos.x - A.x;
    const hz = this.pos.z - A.z;
    const ahead = hx * this.vel.x + hz * this.vel.z > 0;
    const ang = Math.atan2(Math.hypot(hx, hz), A.y - this.pos.y);
    if (!input.swing) this.releaseSwing(true);
    else if (ahead && ang > 1.0 && this.vel.y > 0) {
      this.releaseSwing(true);
      this.swingCD = 0.1;
    } else if (this.pos.y > A.y - 1.5) {
      this.releaseSwing(true);
      this.swingCD = 0.25;
    } else if (rp.t > 3.5) {
      this.releaseSwing(false);
      this.swingCD = 0.1;
    }
  }

  // ======================================================================
  enterWall(c, momentum = 0) {
    this.state = 'wall';
    this.wall.nx = c.nx;
    this.wall.nz = c.nz;
    this.wall.box = c.box;
    this.vel.set(0, clamp(momentum * 0.55 + Math.max(0, this.vel.y) * 0.5, 0, 20), 0);
    this.yaw = Math.atan2(-c.nx, -c.nz);
    this.trick = null;
    this.pivot.rotation.set(0, 0, 0);
    this.game.audio.land(false);
  }

  wallTop() {
    return this.stackTop(this.pos.x - this.wall.nx * (R + 1.0), this.pos.z - this.wall.nz * (R + 1.0), this.pos.y);
  }

  stackTop(px, pz, y) {
    let h = y;
    for (let it = 0; it < 8; it++) {
      let found = false;
      const arr = this.city.cellBoxes(px, pz);
      if (!arr) break;
      for (const b of arr) {
        if (px >= b.x0 && px <= b.x1 && pz >= b.z0 && pz <= b.z1 && b.y0 <= h + 0.3 && b.y1 > h + 0.01) {
          h = b.y1;
          found = true;
        }
      }
      if (!found) break;
    }
    return h;
  }

  stepWall(h, input, cam) {
    const nx = this.wall.nx;
    const nz = this.wall.nz;
    const rx = nz;
    const rz = -nx;
    const sideSign = cam.rightFlat.x * rx + cam.rightFlat.z * rz >= 0 ? 1 : -1;
    const run = input.swing;
    const my = this.mv.y;
    const mx = this.mv.x * sideSign;
    const upT = my * (run ? 15 : 6.5);
    const k = Math.min(1, (upT > this.vel.y ? 10 : 6) * h);
    this.vel.y += (upT - this.vel.y) * k;
    const sv = mx * (run ? 10 : 5);
    this.vel.x = rx * sv;
    this.vel.z = rz * sv;
    this.pos.addScaledVector(this.vel, h);
    this.pos.x -= nx * 3 * h;
    this.pos.z -= nz * 3 * h;
    const c = this.city.resolve(this.pos, R, H, false, this.contact);
    const top = this.wallTop();
    if (c.hit) {
      this.wall.nx = c.nx;
      this.wall.nz = c.nz;
      this.wall.box = c.box;
      this.yaw = Math.atan2(-c.nx, -c.nz);
    } else if (this.pos.y < top - 1.1) {
      // slid around a corner or off the side
      this.state = 'air';
      this.vel.x += nx * 2;
      this.vel.z += nz * 2;
      return;
    }
    if (this.pos.y + 1.1 >= top) {
      if (my > 0.2 || run || !c.hit) {
        // vault over the ledge
        this.pos.y = top + 0.02;
        this.pos.x -= nx * 1.1;
        this.pos.z -= nz * 1.1;
        this.vel.set(-nx * 5, 6.5, -nz * 5);
        this.state = 'air';
        this.yaw = Math.atan2(-nx, -nz);
        this.doTrick('flip', 0.45);
        this.game.audio.whoosh(0.6);
        return;
      }
      this.pos.y = Math.min(this.pos.y, top - 1.1);
      this.vel.y = Math.min(this.vel.y, 0);
    }
    const g = this.city.groundHeight(this.pos.x + nx * 0.5, this.pos.z + nz * 0.5, this.pos.y);
    if (this.pos.y <= g + 0.01 && this.vel.y <= 0) {
      this.pos.y = g;
      this.state = 'ground';
      this.pos.x += nx * 0.1;
      this.pos.z += nz * 0.1;
    }
  }

  // ======================================================================
  scanLaunch(cam) {
    this.launchTarget = null;
    if (this.state === 'zip') return;
    const o = cam.camera.position;
    const dir = cam.dir;
    const hit = this.city.raycast(o, dir, 95, false);
    if (!hit || !hit.box) return;
    let tx;
    let tz;
    let top;
    if (hit.ny > 0.5) {
      tx = hit.x;
      tz = hit.z;
      top = this.city.groundHeight(tx, tz, hit.y + 0.1);
    } else {
      // climb the stack of boxes at this spot (shop plinth -> tower -> setbacks)
      const px = hit.x - hit.nx * 1.2;
      const pz = hit.z - hit.nz * 1.2;
      top = this.stackTop(px, pz, hit.y);
      if (top - hit.y > 45) return;
      tx = hit.x - hit.nx * 0.8;
      tz = hit.z - hit.nz * 0.8;
      top = this.city.groundHeight(tx, tz, top + 0.1);
    }
    const t = new THREE.Vector3(tx, top, tz);
    const d = t.distanceTo(this.pos);
    if (d < 7 || d > 90 || t.y < this.pos.y - 3) return;
    this.launchTarget = t;
  }

  startZip(target) {
    const G = this.game;
    if (this.rope) this.releaseSwing(false);
    this.state = 'zip';
    this.action = null;
    this.forceVel = null;
    this.rig.root.updateMatrixWorld(true);
    const w1 = G.fx.webs.spawn(this.rig.J.handL.getWorldPosition(v1), target, true);
    const w2 = G.fx.webs.spawn(this.rig.J.handR.getWorldPosition(v1), target, true);
    this.zip = { target: target.clone(), t: 0, webs: [w1, w2], launch: false };
    this.perchT = 0;
    G.audio.zip();
    G.camRig.kick(0.3);
  }

  stepZip(h, input) {
    const z = this.zip;
    z.t += h;
    const d = v1.subVectors(z.target, this.pos);
    const dist = d.length();
    if (dist < 0.8 || z.t > 2.5) {
      const G = this.game;
      for (const w of z.webs) G.fx.webs.release(w);
      this.pos.copy(z.target);
      const dir = v2.set(d.x, 0, d.z);
      if (dir.lengthSq() < 1e-4) dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      dir.normalize();
      this.zip = null;
      if (z.launch || input.jumpHeld) {
        // point launch
        this.vel.set(dir.x * 14, 17, dir.z * 14);
        this.state = 'air';
        this.doTrick('flip', 0.55);
        G.audio.whoosh(1);
        G.camRig.kick(0.4);
      } else {
        this.vel.set(0, 0, 0);
        this.state = 'ground';
        this.perchT = 1.4;
        this.yaw = Math.atan2(dir.x, dir.z);
      }
      return;
    }
    const sp = Math.min(48, 22 + z.t * 90);
    this.vel.copy(d).multiplyScalar(sp / dist);
    this.pos.addScaledVector(this.vel, h);
    this.yaw = Math.atan2(d.x, d.z);
  }

  doTrick(type, dur = 0.6) {
    const types = ['flip', 'spin', 'twist', 'backflip'];
    this.trick = { type: type || types[Math.floor(Math.random() * types.length)], t: 0, dur };
    if (!type) {
      this.game.addXP(15, 'TRICK');
      this.game.audio.whoosh(0.8);
    }
  }

  // ======================================================================
  // Combat
  attack(cam) {
    const G = this.game;
    if (this.state === 'zip' || this.state === 'wall') return;
    if (this.action && this.action.type === 'attack' && this.action.t < this.action.dur * 0.6) {
      this.buffered = true;
      return;
    }
    if (this.action && this.action.type !== 'attack') return;
    const hint = this.wishMag > 0.1 ? this.wish : cam.fwdFlat;
    const target = G.combat.findTarget(this.pos, hint, 16);
    this.comboStep = this.t - this.lastAttack < 0.9 ? (this.comboStep + 1) % 4 : 0;
    if (target && target.state === 'air') this.comboStep = this.comboStep === 3 ? 0 : this.comboStep; // keep juggling
    this.lastAttack = this.t;
    if (this.state === 'swing') this.releaseSwing(false);
    this.action = { type: 'attack', t: 0, dur: this.comboStep === 2 ? 0.42 : 0.34, step: this.comboStep, target, hit: false };
    if (target) this.yaw = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    G.audio.whoosh(0.35);
  }

  shootWeb(cam) {
    const G = this.game;
    if (this.state === 'zip' || (this.action && this.action.type !== 'attack')) return;
    const target = G.combat.findTarget(this.pos, cam.fwdFlat, 30, true);
    this.rig.root.updateMatrixWorld(true);
    const from = this.rig.J.handR.getWorldPosition(new THREE.Vector3());
    if (target) this.yaw = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    G.combat.shootWeb(from, target, cam.dir);
    this.action = { type: 'web', t: 0, dur: 0.22 };
    G.audio.thwip();
  }

  dodge(cam) {
    const G = this.game;
    if (this.state === 'zip' || this.state === 'wall' || this.state === 'swing') return;
    if (this.action && this.action.type === 'dodge') return;
    const dir = new THREE.Vector3();
    if (this.wishMag > 0.1) dir.copy(this.wish);
    else dir.copy(cam.rightFlat).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    const perfect = G.combat.threatLevel(this.pos) > 0;
    this.action = { type: 'dodge', t: 0, dur: 0.42, dir, perfect };
    this.invuln = 0.45;
    if (perfect) {
      this.focus = Math.min(3, this.focus + 0.35);
      G.slowmo(0.35);
      G.hud.popup('PERFECT DODGE');
      G.addXP(20);
    }
    G.audio.whoosh(0.9);
  }

  useHeal() {
    const G = this.game;
    if (this.focus < 1 || this.health >= this.maxHealth) return;
    this.focus -= 1;
    this.health = Math.min(this.maxHealth, this.health + 45);
    G.fx.heal(this.pos);
    G.audio.heal();
  }

  useFinisher(cam) {
    const G = this.game;
    if (this.focus < 2) return;
    const target = G.combat.findTarget(this.pos, cam.fwdFlat, 14);
    if (!target) return;
    this.focus -= 2;
    this.yaw = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    this.action = { type: 'attack', t: 0, dur: 0.5, step: 3, target, hit: false, finisher: true };
    G.slowmo(0.9);
    G.camRig.shake(0.3);
  }

  updateAction(dt, cam) {
    const G = this.game;
    const a = this.action;
    this.forceVel = null;
    if (!a) return;
    a.t += dt;
    if (a.type === 'attack') {
      const tg = a.target;
      if (tg && tg.alive && !a.hit) {
        const to = v1.subVectors(tg.pos, this.pos);
        const dy = to.y;
        to.y = 0;
        const dist = to.length();
        this.yaw = Math.atan2(to.x, to.z);
        a.lunge = (a.lunge || 0) + dt;
        if (dist > 1.35 && a.lunge < 0.7) {
          const sp = Math.min(32, dist / 0.08);
          this.forceVel = new THREE.Vector3(to.x / dist * sp, clamp(dy * 6, -15, 20), to.z / dist * sp);
          if (Math.abs(dy) > 1.5 && this.state === 'ground') {
            this.state = 'air';
          }
          a.t = Math.min(a.t, 0.06); // hold the wind-up until we arrive
        } else if (dist > 2.6) {
          a.hit = true; // couldn't reach (blocked) — whiff
        } else if (a.t >= 0.08) {
          a.hit = true;
          const dir = to.normalize();
          const kind = a.finisher ? 'finisher' : a.step === 3 ? 'launch' : a.step === 2 ? 'heavy' : 'light';
          if (G.combat.hitEnemy(tg, kind, dir)) this.onHit(tg, kind);
          if (kind === 'launch' && this.state === 'ground') {
            // follow the launcher into the air
            this.vel.y = 11;
            this.state = 'air';
          }
        }
      } else if (!a.hit && a.t >= 0.1) {
        a.hit = true;
        const fwd = v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        for (const e of G.combat.inArc(this.pos, fwd, 2.3)) {
          if (G.combat.hitEnemy(e, a.step === 2 ? 'heavy' : 'light', fwd)) this.onHit(e, 'light');
        }
      }
      if (a.t >= a.dur) {
        this.action = null;
        if (this.buffered) {
          this.buffered = false;
          this.attack(cam);
        }
      }
    } else if (a.type === 'dodge') {
      if (a.t < 0.28) this.forceVel = new THREE.Vector3(a.dir.x * 15, this.state === 'air' ? this.vel.y : 0, a.dir.z * 15);
      if (a.t >= a.dur) this.action = null;
    } else if (a.t >= a.dur) this.action = null;
  }

  onHit(e, kind) {
    const G = this.game;
    this.combo++;
    this.comboTimer = 2.6;
    this.focus = Math.min(3, this.focus + (kind === 'finisher' ? 0 : 0.11));
    G.hitstop(kind === 'heavy' || kind === 'launch' || kind === 'finisher' ? 0.09 : 0.05);
    G.camRig.shake(kind === 'light' ? 0.18 : 0.35);
    G.audio.punch(kind !== 'light');
    G.addXP(10 + this.combo * 2);
    G.hud.combo(this.combo);
  }

  damage(amount, from) {
    const G = this.game;
    if (this.invuln > 0 || this.dead) return false;
    this.health -= amount;
    this.lastHurt = this.t;
    this.invuln = 0.6;
    this.combo = 0;
    this.comboTimer = 0;
    if (this.rope) this.releaseSwing(false);
    if (this.state === 'wall' || this.state === 'zip') this.state = 'air';
    this.action = { type: 'hurt', t: 0, dur: 0.35 };
    if (from) {
      const d = v1.subVectors(this.pos, from).setY(0).normalize();
      this.vel.x = d.x * 6;
      this.vel.z = d.z * 6;
    }
    G.audio.hurt();
    G.camRig.shake(0.45);
    G.hud.hurt();
    if (this.health <= 0) this.die();
    return true;
  }

  die() {
    const G = this.game;
    this.health = 0;
    this.dead = true;
    this.deadT = 3.2;
    this.action = null;
    if (this.rope) this.releaseSwing(false);
    G.hud.defeated(true);
  }

  respawn() {
    this.dead = false;
    this.health = this.maxHealth;
    this.game.hud.defeated(false);
    this.game.combat.resetAggro();
    this.spawn(this.lastSafe, this.yaw);
    this.perchT = 0;
  }

  // ======================================================================
  // Animation + orientation
  updateModel(dt) {
    const p = this.pose;
    const t = this.t;
    let k = 12;
    const a = this.action;
    const hs = this.hSpeed;

    if (this.dead) {
      Pose.hurt(p, t);
      p.hy = -0.6;
      k = 6;
    } else if (a && a.type === 'attack') {
      Pose.punch(p, a.step, a.t / a.dur);
      k = 28;
    } else if (a && a.type === 'web') {
      Pose.webShot(p, 'R');
      k = 30;
    } else if (a && a.type === 'dodge') {
      Pose.tuck(p);
      k = 25;
    } else if (a && a.type === 'hurt') {
      Pose.hurt(p, t);
      k = 22;
    } else {
      switch (this.state) {
        case 'ground':
          if (this.landT > 0) {
            Pose.land(p);
            k = 30;
          } else if (this.perchT > 0) {
            Pose.perch(p, t);
            k = 8;
          } else if (hs > 0.6) {
            const sprint01 = clamp((hs - RUN) / (SPRINT - RUN), 0, 1);
            this.runPhase += dt * hs * (1.0 - sprint01 * 0.3);
            Pose.run(p, this.runPhase, sprint01);
            k = 16;
          } else Pose.idle(p, t);
          break;
        case 'air':
          if (this.webZipT > 0) Pose.zip(p, t);
          else if (this.trick) Pose.tuck(p);
          else if (this.mvDive) Pose.dive(p, t);
          else Pose.air(p, this.vel.y, t);
          k = 9;
          break;
        case 'swing': {
          const rp = this.rope;
          const hx = this.pos.x - rp.anchor.x;
          const hz = this.pos.z - rp.anchor.z;
          const vl = hs || 1;
          const ph = clamp(((hx * this.vel.x + hz * this.vel.z) / vl) / Math.max(4, rp.len * 0.7), -1, 1);
          Pose.swing(p, ph, rp.hand);
          k = 10;
          break;
        }
        case 'wall': {
          const moving = Math.abs(this.vel.y) + Math.hypot(this.vel.x, this.vel.z) > 0.5;
          this.wallPhase += dt * (Math.abs(this.vel.y) + Math.hypot(this.vel.x, this.vel.z)) * 1.6;
          if (this.vel.y > 9) Pose.wallRun(p, this.wallPhase);
          else Pose.wall(p, this.wallPhase, moving);
          k = 14;
          break;
        }
        case 'zip':
          Pose.zip(p, t);
          k = 16;
          break;
      }
    }
    this.mvDive = this.game.input.dive && this.state === 'air';
    this.anim.apply(p, k, dt);

    // ---- body orientation
    this.turnRate = angleDiff(this.prevYaw, this.yaw) / Math.max(dt, 1e-3);
    const tq = this.targetQ;
    let rk = 12;
    if (this.state === 'swing' && this.rope) {
      const toA = v1.subVectors(this.rope.anchor, this.pos).normalize();
      const up = v2.copy(UP).lerp(toA, 0.85).normalize();
      const fwd = v3.copy(this.vel);
      fwd.addScaledVector(up, -fwd.dot(up));
      if (fwd.lengthSq() < 1e-4) fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      fwd.normalize();
      const x = new THREE.Vector3().crossVectors(up, fwd).normalize();
      fwd.crossVectors(x, up);
      m1.makeBasis(x, up, fwd);
      tq.setFromRotationMatrix(m1);
      rk = 10;
    } else if (this.state === 'zip' && this.zip) {
      const d = v1.subVectors(this.zip.target, this.pos).normalize();
      const pitch = Math.asin(clamp(d.y, -1, 1));
      tq.setFromEuler(new THREE.Euler(-pitch * 0.9 + Math.PI / 2 * 0.9, this.yaw, 0, 'YXZ'));
      rk = 14;
    } else if (this.state === 'air' && (this.webZipT > 0 || this.mvDive)) {
      const pitch = this.mvDive ? clamp(-this.vel.y / 40, 0, 1.3) : 1.1;
      tq.setFromEuler(new THREE.Euler(pitch, this.yaw, 0, 'YXZ'));
      rk = 10;
    } else {
      // lean into turns while running
      const targetLean = this.state === 'ground' ? clamp(-this.turnRate * hs * 0.006, -0.4, 0.4) : 0;
      this.lean += (targetLean - this.lean) * Math.min(1, dt * 8);
      tq.setFromEuler(new THREE.Euler(0, this.yaw, this.lean, 'YXZ'));
      if (this.state === 'air') rk = 8;
    }
    this.prevYaw = this.yaw;
    this.model.quaternion.slerp(tq, 1 - Math.exp(-rk * dt));

    // tricks / dodge roll spin the pivot
    if (this.trick) {
      this.trick.t += dt;
      const f = clamp(this.trick.t / this.trick.dur, 0, 1);
      const e = f < 1 ? 1 - Math.pow(1 - f, 2) : 1;
      const ang = e * Math.PI * 2;
      this.pivot.rotation.set(0, 0, 0);
      if (this.trick.type === 'flip') this.pivot.rotation.x = ang;
      else if (this.trick.type === 'backflip') this.pivot.rotation.x = -ang;
      else if (this.trick.type === 'spin') this.pivot.rotation.y = ang;
      else this.pivot.rotation.z = ang;
      if (f >= 1) {
        this.trick = null;
        this.pivot.rotation.set(0, 0, 0);
      }
    } else if (a && a.type === 'dodge') {
      const f = clamp(a.t / 0.38, 0, 1);
      const fwd = Math.sin(this.yaw) * a.dir.x + Math.cos(this.yaw) * a.dir.z;
      const side = Math.cos(this.yaw) * a.dir.x - Math.sin(this.yaw) * a.dir.z;
      this.pivot.rotation.set(0, 0, 0);
      if (Math.abs(fwd) > Math.abs(side)) this.pivot.rotation.x = Math.PI * 2 * f * Math.sign(fwd);
      else this.pivot.rotation.z = -Math.PI * 2 * f * Math.sign(side);
    } else {
      this.pivot.rotation.x *= 0.7;
      this.pivot.rotation.y *= 0.7;
      this.pivot.rotation.z *= 0.7;
    }

    this.model.position.copy(this.pos);
    if (this.state === 'wall') {
      this.model.position.x -= this.wall.nx * 0.12;
      this.model.position.z -= this.wall.nz * 0.12;
    }
    if (this.dead) this.pivot.position.y = 0.4;
    else this.pivot.position.y += (0.95 - this.pivot.position.y) * Math.min(1, dt * 6);

    // ---- IK: web-slinging arm(s) reach for the anchor
    if (this.state === 'swing' && this.rope) {
      this.aimArm(this.rope.hand, this.rope.anchor, dt);
      this.rig.root.updateMatrixWorld(true);
      this.rig.J['hand' + this.rope.hand].getWorldPosition(this.rope.web.a);
    } else if (this.state === 'zip' && this.zip) {
      this.aimArm('L', this.zip.target, dt);
      this.aimArm('R', this.zip.target, dt);
      this.rig.root.updateMatrixWorld(true);
      this.rig.J.handL.getWorldPosition(this.zip.webs[0].a);
      this.rig.J.handR.getWorldPosition(this.zip.webs[1].a);
    }
  }

  aimArm(hand, target, dt) {
    const sh = this.rig.J['sh' + hand];
    const el = this.rig.J['el' + hand];
    this.model.updateMatrixWorld(true);
    const sp = sh.getWorldPosition(v1);
    const dir = v2.subVectors(target, sp).normalize();
    sh.parent.getWorldQuaternion(q1);
    dir.applyQuaternion(q1.invert());
    q2.setFromUnitVectors(DOWN, dir);
    sh.quaternion.slerp(q2, 1 - Math.exp(-30 * dt));
    el.quaternion.slerp(q1.identity(), 1 - Math.exp(-20 * dt));
  }
}
