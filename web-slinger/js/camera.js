// Third-person follow camera: mouse orbit, speed-reactive FOV/distance,
// auto-follow while swinging, wall collision, shake and kicks.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from './utils.js';

export class CameraRig {
  constructor(camera, city) {
    this.camera = camera;
    this.city = city;
    this.yaw = 0;
    this.pitch = -0.18;
    this.dist = 4.6;
    this.fov = 68;
    this.trauma = 0;
    this.kickAmt = 0;
    this.idleLook = 10;
    this.target = new THREE.Vector3();
    this.fwdFlat = new THREE.Vector3(0, 0, 1);
    this.rightFlat = new THREE.Vector3(-1, 0, 0);
    this.dir = new THREE.Vector3(0, 0, 1);
    this.roll = 0;
    this.tmp = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.autoFollow = true;
    this.cine = null;
  }

  shake(a) {
    this.trauma = Math.min(1, this.trauma + a);
  }
  kick(a) {
    this.kickAmt = Math.min(1, this.kickAmt + a);
  }

  snapBehind(player) {
    this.yaw = player.yaw;
    this.pitch = -0.2;
    this.target.copy(player.pos).setY(player.pos.y + 1.5);
    this.updateVectors();
  }

  updateVectors() {
    const cp = Math.cos(this.pitch);
    this.dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    this.fwdFlat.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.rightFlat.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
  }

  update(dt, input, player) {
    const look = input.consumeLook();
    if (Math.abs(look.dx) + Math.abs(look.dy) > 0.0005) this.idleLook = 0;
    else this.idleLook += dt;
    this.yaw -= look.dx;
    this.pitch = clamp(this.pitch - look.dy, -1.35, 1.0);

    const speed = player.speed;
    const hs = player.hSpeed;
    const st = player.state;
    // gently swing the camera behind the direction of travel when moving fast
    if (this.autoFollow && this.idleLook > 0.9 && hs > 11 && (st === 'swing' || st === 'air')) {
      const vy = Math.atan2(player.vel.x, player.vel.z);
      this.yaw = dampAngle(this.yaw, vy, 1.4, dt);
      this.pitch = damp(this.pitch, clamp(-0.12 - player.vel.y * 0.006, -0.6, 0.25), 1.2, dt);
    }
    this.updateVectors();

    const s01 = clamp((speed - 8) / 40, 0, 1);
    let want = 4.4 + s01 * 3.2;
    if (st === 'swing') want += 1.4;
    if (st === 'wall') want += 1.2;
    if (player.action && player.action.type === 'attack') want += 0.8;
    this.dist = damp(this.dist, want, 3, dt);
    this.fov = damp(this.fov, 66 + s01 * 24 + this.kickAmt * 8, 4, dt);
    this.kickAmt = Math.max(0, this.kickAmt - dt * 2.5);

    const tgt = this.tmp.copy(player.pos);
    tgt.y += st === 'wall' ? 1.2 : 1.55;
    this.target.lerp(tgt, 1 - Math.exp(-(st === 'swing' ? 14 : 20) * dt));

    // over-the-shoulder offset
    const cam = this.camera;
    const offR = 0.45;
    const desired = new THREE.Vector3().copy(this.target).addScaledVector(this.dir, -this.dist).addScaledVector(this.rightFlat, offR);
    // collision: pull in if a building is between player and camera
    const toCam = new THREE.Vector3().subVectors(desired, this.target);
    const len = toCam.length();
    toCam.divideScalar(len);
    const hit = this.city.raycast(this.target, toCam, len + 0.4, true);
    if (hit) desired.copy(this.target).addScaledVector(toCam, Math.max(0.6, hit.t - 0.4));
    const floor = this.city.baseHeight(desired.x, desired.z) + 0.3;
    if (desired.y < floor) desired.y = floor;
    cam.position.copy(desired);

    // shake
    const sh = this.trauma * this.trauma;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const t = performance.now() * 0.001;
    const sx = (Math.sin(t * 53.1) + Math.sin(t * 31.7)) * 0.5 * sh * 0.35;
    const sy = (Math.sin(t * 47.3) + Math.sin(t * 27.1)) * 0.5 * sh * 0.35;
    cam.position.x += sx;
    cam.position.y += sy;

    this.lookAt.copy(this.target).addScaledVector(this.dir, 12).addScaledVector(this.rightFlat, offR);
    cam.lookAt(this.lookAt);
    // bank slightly while swinging
    const targetRoll = st === 'swing' ? clamp(-player.turnRate * 0.05, -0.12, 0.12) : 0;
    this.roll = damp(this.roll, targetRoll || 0, 3, dt);
    cam.rotateZ(this.roll + sh * Math.sin(t * 41) * 0.03);
    if (Math.abs(cam.fov - this.fov) > 0.05) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }

  // Cinematic over-the-shoulder shot of the hero perched above the skyline
  titleShot(player, t) {
    const P = player.pos;
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    const rx = -fz;
    const rz = fx;
    const sway = Math.sin(t * 0.12) * 0.9;
    this.camera.position.set(P.x - fx * 3.6 + rx * (1.9 + sway), P.y + 1.1 + Math.sin(t * 0.09) * 0.25, P.z - fz * 3.6 + rz * (1.9 + sway));
    this.camera.lookAt(P.x + fx * 40 - rx * 38, P.y - 1.5, P.z + fz * 40 - rz * 38);
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
  }
}
