// Street crimes, thugs (brawlers, gunners, brutes), enemy AI, hit reactions,
// web projectiles and the crime marker beacon.
import * as THREE from 'three';
import { buildHumanoid, thugMaterials, Animator, Pose, newPose } from './hero.js';
import { clamp, dampAngle, pick } from './utils.js';
import { HALF, PITCH, lineCoord, PARK_RECT, CURB } from './city.js';

const TYPES = {
  thug: { hp: 4, speed: 5.4, dmg: 9, range: 1.9, scale: 1.0, bulk: 1.05, windup: 0.6 },
  gunner: { hp: 3, speed: 4.6, dmg: 7, range: 30, scale: 1.0, bulk: 1.0, windup: 0.85 },
  brute: { hp: 9, speed: 3.9, dmg: 16, range: 2.4, scale: 1.18, bulk: 1.45, windup: 0.95 },
};

const CRIMES = [
  { name: 'Armed Robbery', where: 'street', mix: ['thug', 'thug', 'gunner', 'gunner', 'thug'] },
  { name: 'Street Mugging', where: 'street', mix: ['thug', 'thug', 'thug'] },
  { name: 'Rooftop Gang Meeting', where: 'roof', mix: ['thug', 'gunner', 'brute', 'thug'] },
  { name: 'Car Jacking', where: 'street', mix: ['thug', 'brute', 'thug', 'gunner'] },
  { name: 'Demon Gang Ambush', where: 'roof', mix: ['thug', 'thug', 'gunner', 'thug', 'brute'] },
];

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();

class Enemy {
  constructor(game, type, pos) {
    this.game = game;
    this.type = type;
    this.cfg = TYPES[type];
    this.mats = thugMaterials(type);
    this.rig = buildHumanoid(this.mats, { bulk: this.cfg.bulk, scale: this.cfg.scale });
    this.model = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.95 * this.cfg.scale;
    this.rig.root.position.y = -0.95 * this.cfg.scale;
    this.pivot.add(this.rig.root);
    this.model.add(this.pivot);
    game.scene.add(this.model);
    this.anim = new Animator(this.rig);
    this.pose = newPose();
    if (type === 'gunner') {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.7, roughness: 0.4 }));
      gun.position.set(0, -0.09, 0.1);
      this.rig.J.wrR.add(gun);
      this.gun = gun;
    }
    // web cocoon shown once they're taken down
    this.cocoon = new THREE.Mesh(new THREE.CapsuleGeometry(0.34 * this.cfg.bulk, 1.3 * this.cfg.scale, 4, 10), game.combat.cocoonMat);
    this.cocoon.visible = false;
    game.scene.add(this.cocoon);

    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.hp = this.cfg.hp;
    this.state = 'idle';
    this.stun = 0;
    this.attackCD = 1 + Math.random() * 2;
    this.windT = 0;
    this.juggle = 0;
    this.webbed = 0;
    this.flash = 0;
    this.t = Math.random() * 10;
    this.lie = 0;
    this.hasToken = false;
    this.contact = { hit: false };
    this.fade = 1;
    this.model.position.copy(this.pos);
  }

  get alive() {
    return this.state !== 'ko' && this.state !== 'down' && this.state !== 'gone';
  }
  get chest() {
    return v2.copy(this.pos).setY(this.pos.y + 1.3 * this.cfg.scale);
  }

  releaseToken() {
    if (this.hasToken) {
      this.hasToken = false;
      this.game.combat.tokens++;
    }
  }

  update(dt, player) {
    const G = this.game;
    const city = G.city;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.juggle = Math.max(0, this.juggle - dt);
    this.attackCD -= dt;

    // ---- physics
    const g = city.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.5);
    const airborne = this.pos.y > g + 0.05 || this.vel.y > 0;
    if (airborne) this.vel.y -= (this.juggle > 0 ? 7 : 26) * dt;
    this.pos.addScaledVector(this.vel, dt);
    const g2 = city.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.6);
    if (this.pos.y <= g2) {
      const impact = -this.vel.y;
      this.pos.y = g2;
      this.vel.y = 0;
      if (this.state === 'air') {
        if (this.hp <= 0) this.knockOut();
        else {
          this.state = 'hurt';
          this.stun = 0.9;
          this.lie = 1;
        }
        if (impact > 8) G.fx.impactDust(this.pos, 8, 2.5);
      }
    }
    if (!airborne) {
      const k = Math.exp(-7 * dt);
      this.vel.x *= k;
      this.vel.z *= k;
    }
    city.resolve(this.pos, 0.45, 1.8, true, this.contact);
    if (this.pos.y < -1.5) {
      // fell into the river
      this.hp = 0;
      this.state = 'gone';
      this.model.visible = false;
      this.cocoon.visible = false;
      this.releaseToken();
      return;
    }

    // ---- AI
    const to = v1.subVectors(player.pos, this.pos);
    const dy = to.y;
    to.y = 0;
    const dist = to.length();
    const faceP = () => (this.yaw = dampAngle(this.yaw, Math.atan2(to.x, to.z), 10, dt));
    const cfg = this.cfg;
    const slow = this.webbed > 0 ? 0.45 : 1;
    let moving = false;

    switch (this.state) {
      case 'idle':
        if (dist < 36 || this.crime.engaged) {
          this.state = 'chase';
          this.crime.engaged = true;
        }
        break;
      case 'chase': {
        if (player.dead || dist > 110) {
          this.state = 'idle';
          break;
        }
        faceP();
        let want = 0;
        if (this.type === 'gunner') {
          if (dist < 9) want = -1;
          else if (dist > 20) want = 1;
        } else if (dist > cfg.range * 0.85 && Math.abs(dy) < 4) want = 1;
        else if (Math.abs(dy) >= 4 && dist > 3) want = 0.4; // player is above: mill around below
        if (want !== 0) {
          const sp = cfg.speed * slow * want;
          this.vel.x = (to.x / (dist || 1)) * sp;
          this.vel.z = (to.z / (dist || 1)) * sp;
          moving = true;
        }
        const canAttack = this.type === 'gunner' ? dist < 34 && !player.dead : dist < cfg.range + 0.8 && Math.abs(dy) < 1.8;
        if (canAttack && this.attackCD <= 0 && G.combat.tokens > 0) {
          G.combat.tokens--;
          this.hasToken = true;
          this.state = 'windup';
          this.windT = cfg.windup;
          this.vel.x = this.vel.z = 0;
        }
        break;
      }
      case 'windup':
        faceP();
        this.windT -= dt;
        if (this.windT <= 0) this.strike(player, dist, dy);
        break;
      case 'recover':
        this.stun -= dt;
        if (this.stun <= 0) this.state = 'chase';
        break;
      case 'hurt':
        this.stun -= dt;
        if (this.stun <= 0) {
          this.state = 'chase';
          this.lie = 0;
        }
        break;
      case 'ko':
        this.koT += dt;
        if (this.koT > 1.1) {
          this.state = 'down';
          this.cocoon.visible = true;
          G.fx.webPuff(this.chest, 14);
        }
        break;
    }

    // separation from other thugs
    for (const o of G.combat.enemies) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x;
      const dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.3 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.pos.x += (dx / d) * (1.14 - d) * 0.5;
        this.pos.z += (dz / d) * (1.14 - d) * 0.5;
      }
    }

    this.animate(dt, moving);
  }

  strike(player, dist, dy) {
    const G = this.game;
    this.state = 'recover';
    this.stun = 0.5;
    this.attackCD = this.type === 'gunner' ? 2.2 + Math.random() * 1.6 : 1.4 + Math.random() * 1.8;
    this.releaseToken();
    if (this.type === 'gunner') {
      this.rig.root.updateMatrixWorld(true);
      const muzzle = this.gun.getWorldPosition(new THREE.Vector3());
      const tgt = player.pos.clone();
      tgt.y += 1.2;
      const hit = player.damage(this.cfg.dmg, this.pos);
      if (!hit) tgt.add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4));
      G.fx.tracer(muzzle, tgt);
      G.audio.gunshot();
    } else if (dist < this.cfg.range + 0.7 && Math.abs(dy) < 1.8) {
      if (player.damage(this.cfg.dmg, this.pos)) G.fx.sparks(player.pos.clone().setY(player.pos.y + 1.2), null, 8, 0xff6040);
    }
  }

  hit(kind, dir) {
    if (!this.alive) return false;
    const brute = this.type === 'brute';
    const dmg = kind === 'finisher' ? 99 : kind === 'heavy' ? 2 : kind === 'launch' ? 1.5 : 1;
    this.hp -= dmg;
    this.flash = 0.14;
    if (this.state === 'windup') this.releaseToken();
    if (this.hp <= 0) {
      this.state = 'air';
      this.vel.set(dir.x * (kind === 'finisher' ? 16 : 9), kind === 'launch' ? 12 : 6, dir.z * (kind === 'finisher' ? 16 : 9));
      this.juggle = 0;
      this.releaseToken();
      return true;
    }
    if (kind === 'launch' && !brute) {
      this.vel.set(dir.x * 1.2, 13, dir.z * 1.2);
      this.state = 'air';
      this.juggle = 1.0;
    } else if (this.state === 'air') {
      this.vel.y = Math.max(this.vel.y, 3.5);
      this.vel.x = dir.x * 1.5;
      this.vel.z = dir.z * 1.5;
      this.juggle = 0.7;
    } else {
      const kb = brute ? (kind === 'heavy' ? 4 : 1) : kind === 'heavy' ? 9 : 4.5;
      this.vel.x = dir.x * kb;
      this.vel.z = dir.z * kb;
      this.state = 'hurt';
      this.stun = brute && kind === 'light' ? 0.2 : 0.5;
    }
    this.yaw = Math.atan2(-dir.x, -dir.z);
    return true;
  }

  webHit(dir) {
    if (!this.alive) return;
    this.webbed++;
    this.flash = 0.1;
    if (this.state === 'windup') this.releaseToken();
    if (this.webbed >= (this.type === 'brute' ? 5 : 3)) {
      this.hp = 0;
      this.state = 'air';
      this.vel.set(dir.x * 6, 3, dir.z * 6);
      this.releaseToken();
      this.game.addXP(30, 'WEBBED');
    } else if (this.state !== 'air') {
      this.state = 'hurt';
      this.stun = 0.9;
      this.vel.x = dir.x * 2;
      this.vel.z = dir.z * 2;
    }
  }

  knockOut() {
    this.state = 'ko';
    this.koT = 0;
    this.lie = 1;
    this.releaseToken();
    this.game.combat.onKO(this);
  }

  animate(dt, moving) {
    const p = this.pose;
    let k = 12;
    switch (this.state) {
      case 'idle':
        Pose.idle(p, this.t);
        if (this.type === 'gunner') Pose.aim(p, this.t);
        break;
      case 'chase':
        if (moving) {
          this.runPhase = (this.runPhase || 0) + dt * this.cfg.speed * 1.4;
          Pose.run(p, this.runPhase, 0.15);
        } else if (this.type === 'gunner') Pose.aim(p, this.t);
        else Pose.idle(p, this.t * 2);
        if (this.type !== 'gunner' && !moving) {
          // fists up
          p.shL[0] = -1.1;
          p.elL[0] = -1.9;
          p.shR[0] = -1.1;
          p.elR[0] = -1.9;
        }
        break;
      case 'windup':
        if (this.type === 'gunner') Pose.aim(p, this.t);
        else Pose.windup(p, this.t);
        k = 16;
        break;
      case 'recover':
        if (this.type === 'gunner') Pose.aim(p, this.t);
        else Pose.punch(p, 0, 0.5);
        k = 22;
        break;
      case 'hurt':
      case 'air':
        if (this.lie > 0 && this.state === 'hurt') Pose.down(p);
        else Pose.hurt(p, this.t);
        k = 18;
        break;
      case 'ko':
      case 'down':
        if (this.cocoon.visible) Pose.webbed(p);
        else Pose.down(p);
        k = 10;
        break;
    }
    this.anim.apply(p, k, dt);
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    // lying down: tip the pivot back
    const lying = this.state === 'ko' || this.state === 'down' || (this.state === 'hurt' && this.lie > 0);
    const tx = lying ? -1.5 : this.state === 'air' ? -0.6 : 0;
    this.pivot.rotation.x += (tx - this.pivot.rotation.x) * Math.min(1, dt * 10);
    const ty = (lying ? 0.28 : 0.95) * this.cfg.scale;
    this.pivot.position.y += (ty - this.pivot.position.y) * Math.min(1, dt * 10);
    // hit flash
    const f = this.flash > 0 ? 1 : 0;
    this.mats.jacket.emissive.setRGB(f * 0.9, f * 0.9, f * 0.9);
    if (this.cocoon.visible) {
      this.cocoon.position.copy(this.pos);
      this.cocoon.position.y += 0.3;
      this.cocoon.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, this.yaw, 0, 'YXZ'));
      this.cocoon.scale.setScalar(this.fade);
    }
    this.model.scale.setScalar(this.fade);
  }

  dispose() {
    this.game.scene.remove(this.model);
    this.game.scene.remove(this.cocoon);
  }
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.crime = null;
    this.timer = 8;
    this.tokens = 2;
    this.webs = [];
    this.stopped = 0;
    this.cocoonMat = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.6, emissive: 0x9aa4b0, emissiveIntensity: 0.15 });
    const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 700, 20, 1, true);
    beamGeo.translate(0, 350, 0);
    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    this.beam.visible = false;
    game.scene.add(this.beam);
    const ringGeo = new THREE.RingGeometry(2.2, 2.5, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ring.visible = false;
    game.scene.add(this.ring);
    this.webGeo = new THREE.SphereGeometry(0.16, 10, 8);
    this.webMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.police = this.buildPolice();
  }

  buildPolice() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 4.6), new THREE.MeshStandardMaterial({ color: 0x0c0f18, roughness: 0.35, metalness: 0.5 }));
    body.position.y = 0.75;
    const doors = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.5, 2.2), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 }));
    doors.position.y = 0.8;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.3), new THREE.MeshStandardMaterial({ color: 0x151a22, roughness: 0.1, metalness: 0.8 }));
    cab.position.set(0, 1.45, -0.2);
    this.redMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.blueMat = new THREE.MeshBasicMaterial({ color: 0x0040ff });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), this.redMat);
    red.position.set(0.35, 1.85, -0.2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), this.blueMat);
    blue.position.set(-0.35, 1.85, -0.2);
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const wm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    for (const [x, z] of [[0.9, 1.5], [-0.9, 1.5], [0.9, -1.5], [-0.9, -1.5]]) {
      const w = new THREE.Mesh(wheelGeo, wm);
      w.position.set(x, 0.36, z);
      g.add(w);
    }
    g.add(body, doors, cab, red, blue);
    g.traverse((o) => (o.castShadow = true));
    g.visible = false;
    this.game.scene.add(g);
    return g;
  }

  // ------------------------------------------------------------------ crimes
  findLocation(where) {
    const G = this.game;
    const p = G.player.pos;
    for (let tries = 0; tries < 60; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = (tries < 30 ? 110 : 70) + Math.random() * 170;
      let x = p.x + Math.cos(a) * r;
      let z = p.z + Math.sin(a) * r;
      if (Math.abs(x) > HALF - 20 || Math.abs(z) > HALF - 20) continue;
      if (where === 'roof') {
        const list = G.city.query(x, z, 60, []);
        const roofs = list.filter((b) => G.city.roofs.includes(b) && b.x1 - b.x0 > 16 && b.z1 - b.z0 > 16 && b.y1 < 140 && b.y1 > 18);
        if (!roofs.length) continue;
        const b = pick(roofs);
        const cx = (b.x0 + b.x1) / 2;
        const cz = (b.z0 + b.z1) / 2;
        return { pos: new THREE.Vector3(cx, G.city.groundHeight(cx, cz, b.y1 + 0.2), cz), where, box: b };
      }
      // snap to the nearest street centreline
      if (Math.random() < 0.5) x = lineCoord(Math.round((x + HALF) / PITCH)) + (Math.random() < 0.5 ? -6 : 6);
      else z = lineCoord(Math.round((z + HALF) / PITCH)) + (Math.random() < 0.5 ? -6 : 6);
      if (x > PARK_RECT.x0 - 12 && x < PARK_RECT.x1 + 12 && z > PARK_RECT.z0 - 12 && z < PARK_RECT.z1 + 12) continue;
      if (G.city.groundHeight(x, z, 2) > CURB + 0.01) continue;
      return { pos: new THREE.Vector3(x, G.city.groundHeight(x, z, 1), z), where };
    }
    return null;
  }

  spawnCrime(first = false) {
    const G = this.game;
    const def = first ? CRIMES[1] : pick(CRIMES);
    const loc = this.findLocation(def.where) || this.findLocation('street');
    if (!loc) return;
    const crime = { def, pos: loc.pos, where: loc.where, engaged: false, enemies: [], done: false };
    const n = def.mix.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const r = 2.5 + Math.random() * 3;
      const ep = loc.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      if (loc.box) {
        ep.x = clamp(ep.x, loc.box.x0 + 1.5, loc.box.x1 - 1.5);
        ep.z = clamp(ep.z, loc.box.z0 + 1.5, loc.box.z1 - 1.5);
      }
      ep.y = G.city.groundHeight(ep.x, ep.z, loc.pos.y + 1);
      const e = new Enemy(G, def.mix[i], ep);
      e.crime = crime;
      e.yaw = Math.atan2(loc.pos.x - ep.x, loc.pos.z - ep.z);
      crime.enemies.push(e);
      this.enemies.push(e);
    }
    this.crime = crime;
    this.beam.visible = this.ring.visible = true;
    this.beam.position.copy(loc.pos);
    this.ring.position.copy(loc.pos).setY(loc.pos.y + 0.08);
    if (loc.where === 'street') {
      this.police.visible = true;
      this.police.position.copy(loc.pos).add(new THREE.Vector3(7, 0, 3));
      this.police.position.y = loc.pos.y;
      this.police.rotation.y = Math.random() * Math.PI * 2;
    } else this.police.visible = false;
    G.hud.notify('CRIME IN PROGRESS', def.name.toUpperCase());
    G.audio.alert();
  }

  onKO(e) {
    const G = this.game;
    G.addXP(40, 'TAKEDOWN');
    const c = e.crime;
    if (c && !c.done && c.enemies.every((x) => !x.alive)) {
      c.done = true;
      this.stopped++;
      G.addXP(300);
      G.hud.notify('CRIME STOPPED', `${c.def.name}  ·  +300 XP`);
      G.audio.success();
      G.stats.crimes = (G.stats.crimes || 0) + 1;
      G.saveStats();
      this.beam.visible = this.ring.visible = false;
      this.cleanupT = 14;
      this.timer = 16 + Math.random() * 10;
    }
  }

  resetAggro() {
    for (const e of this.enemies) {
      if (e.alive) {
        e.state = 'idle';
        e.releaseToken();
      }
    }
    if (this.crime) this.crime.engaged = false;
    this.tokens = 2;
  }

  // ------------------------------------------------------------------ queries
  findTarget(pos, dir, range, ranged = false) {
    let best = null;
    let bs = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x;
      const dy = e.pos.y - pos.y;
      const dz = e.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range || Math.abs(dy) > (ranged ? 25 : 8)) continue;
      const cos = d > 0.1 ? (dx * dir.x + dz * dir.z) / d : 1;
      if (cos < -0.2 && d > 3) continue;
      const s = d + (1 - cos) * 6 + Math.abs(dy) * 0.5;
      if (s < bs) {
        bs = s;
        best = e;
      }
    }
    return best;
  }

  inArc(pos, dir, r) {
    return this.enemies.filter((e) => {
      if (!e.alive) return false;
      const dx = e.pos.x - pos.x;
      const dz = e.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      return d < r && Math.abs(e.pos.y - pos.y) < 2 && (d < 0.6 || (dx * dir.x + dz * dir.z) / d > 0.2);
    });
  }

  // >0 while some enemy is winding up an attack on the player (spider-sense)
  threatLevel(pos) {
    let t = 0;
    for (const e of this.enemies) {
      if (e.state === 'windup' && e.pos.distanceTo(pos) < 40) t = Math.max(t, 1 - e.windT / e.cfg.windup);
    }
    return t;
  }

  hitEnemy(e, kind, dir) {
    const G = this.game;
    const ok = e.hit(kind, dir);
    if (ok) G.fx.sparks(e.chest.clone(), dir, kind === 'light' ? 14 : 26, kind === 'finisher' ? 0x80c0ff : 0xffc070);
    return ok;
  }

  shootWeb(from, target, aimDir) {
    const m = new THREE.Mesh(this.webGeo, this.webMat);
    m.position.copy(from);
    this.game.scene.add(m);
    const vel = target ? target.chest.clone().sub(from).normalize().multiplyScalar(70) : aimDir.clone().multiplyScalar(70);
    this.webs.push({ mesh: m, vel, target, life: 1.2, trail: this.game.fx.webs.spawn(from, from, false, 0.25) });
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    const G = this.game;
    const player = G.player;
    for (const e of this.enemies) e.update(dt, player);

    // web projectiles
    for (let i = this.webs.length - 1; i >= 0; i--) {
      const w = this.webs[i];
      w.life -= dt;
      if (w.target && w.target.alive) {
        const want = v1.copy(w.target.chest).sub(w.mesh.position);
        const d = want.length();
        if (d < 0.9) {
          w.target.webHit(w.vel.clone().setY(0).normalize());
          G.fx.webPuff(w.mesh.position, 14);
          G.audio.punch(false);
          player.onHit(w.target, 'web');
          w.life = 0;
        } else w.vel.lerp(want.normalize().multiplyScalar(70), Math.min(1, dt * 10));
      }
      w.mesh.position.addScaledVector(w.vel, dt);
      w.trail.b.copy(w.mesh.position);
      w.trail.life = 0.2;
      if (w.life <= 0) {
        G.scene.remove(w.mesh);
        this.webs.splice(i, 1);
      }
    }

    // crime lifecycle
    if (this.crime) {
      const t = G.time;
      const near = clamp((player.pos.distanceTo(this.crime.pos) - 15) / 60, 0.15, 1);
      this.beam.material.opacity = (0.18 + Math.sin(t * 4) * 0.06) * near;
      this.ring.scale.setScalar(1 + ((t * 0.8) % 1) * 1.2);
      this.ring.material.opacity = 0.5 * (1 - ((t * 0.8) % 1));
      if (this.police.visible) {
        const on = Math.sin(t * 16) > 0;
        this.redMat.color.setRGB(on ? 2.6 : 0.15, 0, 0);
        this.blueMat.color.setRGB(0, on ? 0.05 : 0.5, on ? 0.15 : 2.6);
      }
      if (this.crime.done) {
        this.cleanupT -= dt;
        if (this.cleanupT < 2) for (const e of this.crime.enemies) e.fade = Math.max(0.001, this.cleanupT / 2);
        if (this.cleanupT <= 0) {
          for (const e of this.crime.enemies) e.dispose();
          this.enemies = this.enemies.filter((e) => !this.crime.enemies.includes(e));
          this.crime = null;
          this.police.visible = false;
        }
      } else if (player.pos.distanceTo(this.crime.pos) > 700) {
        // wandered off: let this one go and roll a new crime nearer by
        for (const e of this.crime.enemies) e.dispose();
        this.enemies = [];
        this.crime = null;
        this.beam.visible = this.ring.visible = this.police.visible = false;
        this.tokens = 2;
        this.timer = 3;
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) this.spawnCrime(this.stopped === 0);
    }

    // brutes & gunners count double for pressure; keep at most 2 attackers
    this.tokens = clamp(this.tokens, 0, 2);
  }
}
