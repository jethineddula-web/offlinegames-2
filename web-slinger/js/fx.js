// Visual effects: web strands, particles (sparks/dust/web goo), speed streaks,
// bullet tracers, shockwave rings.
import * as THREE from 'three';
import * as TX from './textures.js';

const UP = new THREE.Vector3(0, 1, 0);

export class WebLines {
  constructor(scene) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    g.translate(0, 0.5, 0);
    this.mat = new THREE.MeshStandardMaterial({ color: 0xf2f5fa, emissive: 0xc8d4e6, emissiveIntensity: 0.35, roughness: 0.4, transparent: true });
    this.pool = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(g, this.mat.clone());
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.pool.push({ mesh: m, a: new THREE.Vector3(), b: new THREE.Vector3(), life: 0, fade: 0, extend: 1, vel: new THREE.Vector3(), attached: false });
    }
    this.q = new THREE.Quaternion();
    this.d = new THREE.Vector3();
  }
  // Returns a handle: caller updates a/b each frame while attached.
  spawn(a, b, attached = true, fade = 0.35) {
    const w = this.pool.find((p) => !p.mesh.visible) || this.pool[0];
    w.a.copy(a);
    w.b.copy(b);
    w.attached = attached;
    w.life = attached ? Infinity : fade;
    w.fade = fade;
    w.extend = 0;
    w.vel.set(0, 0, 0);
    w.mesh.visible = true;
    w.mesh.material.opacity = 1;
    return w;
  }
  release(w) {
    if (!w) return;
    w.attached = false;
    w.life = w.fade = 0.45;
    w.vel.set(0, -4, 0);
  }
  update(dt) {
    for (const w of this.pool) {
      if (!w.mesh.visible) continue;
      w.extend = Math.min(1, w.extend + dt / 0.07);
      if (!w.attached) {
        w.life -= dt;
        w.a.addScaledVector(w.vel, dt);
        w.vel.y -= 20 * dt;
        w.mesh.material.opacity = Math.max(0, w.life / w.fade);
        if (w.life <= 0) {
          w.mesh.visible = false;
          continue;
        }
      }
      this.d.subVectors(w.b, w.a);
      const len = this.d.length() * w.extend;
      if (len < 1e-3) continue;
      this.d.normalize();
      w.mesh.position.copy(w.a);
      w.mesh.quaternion.setFromUnitVectors(UP, this.d);
      w.mesh.scale.set(0.022, len, 0.022);
    }
  }
}

// CPU particles rendered as soft point sprites.
export class Particles {
  constructor(scene, max = 1200, additive = true) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: TX.radial() }, scale: { value: 600 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying float vA; varying vec3 vC;
        uniform float scale;
        void main(){
          vA = alpha; vC = color;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying float vA; varying vec3 vC;
        void main(){
          vec4 t = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vC * t.rgb, t.a * vA);
          if (gl_FragColor.a < 0.01) discard;
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(p, v, color, size, life, grav = 0, grow = 0, drag = 1) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x;
    this.vel[i * 3 + 1] = v.y;
    this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
    this.size[i] = size;
    this.life[i] = this.maxLife[i] = life;
    this.grav[i] = grav;
    this.grow[i] = grow;
    this.drag[i] = drag;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2);
    }
    for (const k of ['position', 'color', 'size', 'alpha']) this.geo.attributes[k].needsUpdate = true;
  }
  setScale(h) {
    this.mat.uniforms.scale.value = h * 0.9;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.webs = new WebLines(scene);
    this.glow = new Particles(scene, 1400, true);
    this.dust = new Particles(scene, 600, false);
    this.v = new THREE.Vector3();
    this.p = new THREE.Vector3();
    this.c = new THREE.Color();

    // speed streaks around the camera
    const n = 90;
    this.streakN = n;
    this.streakPos = new Float32Array(n * 6);
    this.streakSeed = [];
    for (let i = 0; i < n; i++) this.streakSeed.push(new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()));
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.streakPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.streakMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.streaks = new THREE.LineSegments(sg, this.streakMat);
    this.streaks.frustumCulled = false;
    scene.add(this.streaks);

    // tracers
    this.tracers = [];
    const tg = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
    tg.translate(0, 0.5, 0);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    // shockwave rings
    this.rings = [];
    const rg = new THREE.RingGeometry(0.8, 1, 48);
    rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, life: 0 });
    }
  }

  sparks(p, dir, n = 18, color = 0xffc070) {
    this.c.set(color).multiplyScalar(3);
    for (let i = 0; i < n; i++) {
      this.v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 10);
      if (dir) this.v.addScaledVector(dir, 6);
      this.glow.emit(p, this.v, this.c, 0.12 + Math.random() * 0.12, 0.25 + Math.random() * 0.3, 12, -0.2, 3);
    }
    this.c.set(0xffffff).multiplyScalar(2.5);
    this.glow.emit(p, this.v.set(0, 0, 0), this.c, 0.8, 0.1, 0, 4, 0);
  }

  impactDust(p, n = 20, spread = 5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.v.set(Math.cos(a) * spread * (0.5 + Math.random()), Math.random() * 1.5, Math.sin(a) * spread * (0.5 + Math.random()));
      this.c.setRGB(0.55, 0.52, 0.48);
      this.p.copy(p);
      this.p.y += 0.2;
      this.dust.emit(this.p, this.v, this.c, 0.8 + Math.random() * 0.6, 0.7 + Math.random() * 0.5, -0.3, 2.2, 2.5);
    }
  }

  webPuff(p, n = 10) {
    for (let i = 0; i < n; i++) {
      this.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4);
      this.c.setRGB(1.2, 1.25, 1.3);
      this.glow.emit(p, this.v, this.c, 0.25 + Math.random() * 0.2, 0.3 + Math.random() * 0.2, 6, 0.3, 4);
    }
  }

  heal(p) {
    for (let i = 0; i < 40; i++) {
      this.v.set((Math.random() - 0.5) * 3, 2 + Math.random() * 4, (Math.random() - 0.5) * 3);
      this.c.setRGB(0.4, 2.0, 0.8);
      this.p.set(p.x + (Math.random() - 0.5), p.y + Math.random() * 1.8, p.z + (Math.random() - 0.5));
      this.glow.emit(this.p, this.v, this.c, 0.2, 0.8, -1, 0, 1);
    }
  }

  splash(p) {
    for (let i = 0; i < 40; i++) {
      this.v.set((Math.random() - 0.5) * 6, 5 + Math.random() * 8, (Math.random() - 0.5) * 6);
      this.c.setRGB(0.7, 0.8, 0.9);
      this.dust.emit(p, this.v, this.c, 0.5, 1.0, 18, 1, 0.5);
    }
  }

  tracer(a, b) {
    const t = this.tracers.find((x) => x.life <= 0) || this.tracers[0];
    const d = this.v.subVectors(b, a);
    const len = d.length();
    t.mesh.position.copy(a);
    t.mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    t.mesh.scale.set(0.04, len, 0.04);
    t.mesh.visible = true;
    t.life = 0.12;
    this.c.set(0xffd080).multiplyScalar(3);
    this.glow.emit(a, this.v.set(0, 0, 0), this.c, 0.8, 0.08, 0, 0, 0);
  }

  ring(p, size = 8, color = 0xffffff) {
    const r = this.rings.find((x) => x.life <= 0) || this.rings[0];
    r.mesh.position.copy(p);
    r.mesh.position.y += 0.1;
    r.mesh.material.color.set(color);
    r.mesh.visible = true;
    r.life = 0.5;
    r.size = size;
  }

  update(dt, camera, vel, speed01) {
    this.webs.update(dt);
    this.glow.update(dt);
    this.dust.update(dt);
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / 0.12);
        if (t.life <= 0) t.mesh.visible = false;
      }
    }
    for (const r of this.rings) {
      if (r.life > 0) {
        r.life -= dt;
        const k = 1 - r.life / 0.5;
        r.mesh.scale.setScalar(0.5 + k * r.size);
        r.mesh.material.opacity = (1 - k) * 0.7;
        if (r.life <= 0) r.mesh.visible = false;
      }
    }
    // streaks: short lines placed in a cylinder around the camera, stretched along velocity
    this.streakMat.opacity = Math.max(0, speed01 - 0.25) * 0.55;
    this.streaks.visible = this.streakMat.opacity > 0.01;
    if (this.streaks.visible) {
      const fwd = this.v.copy(vel).normalize();
      const right = this.p.crossVectors(fwd, UP);
      if (right.lengthSq() < 1e-4) right.set(1, 0, 0);
      right.normalize();
      const up = new THREE.Vector3().crossVectors(right, fwd);
      const len = 1.5 + speed01 * 4;
      for (let i = 0; i < this.streakN; i++) {
        const s = this.streakSeed[i];
        s.z -= dt * (1.2 + speed01 * 2.5);
        if (s.z < 0) {
          s.z += 1;
          s.x = Math.random() * 2 - 1;
          s.y = Math.random() * 2 - 1;
        }
        const ang = Math.atan2(s.y, s.x);
        const rad = 2.5 + Math.abs(s.x * s.y) * 6;
        const along = s.z * 30 - 6;
        const ox = camera.position.x + right.x * Math.cos(ang) * rad + up.x * Math.sin(ang) * rad + fwd.x * along;
        const oy = camera.position.y + right.y * Math.cos(ang) * rad + up.y * Math.sin(ang) * rad + fwd.y * along;
        const oz = camera.position.z + right.z * Math.cos(ang) * rad + up.z * Math.sin(ang) * rad + fwd.z * along;
        const j = i * 6;
        this.streakPos[j] = ox;
        this.streakPos[j + 1] = oy;
        this.streakPos[j + 2] = oz;
        this.streakPos[j + 3] = ox - fwd.x * len;
        this.streakPos[j + 4] = oy - fwd.y * len;
        this.streakPos[j + 5] = oz - fwd.z * len;
      }
      this.streaks.geometry.attributes.position.needsUpdate = true;
    }
  }
}
