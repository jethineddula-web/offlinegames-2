// Hidden backpacks on rooftops across the city.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from './utils.js';
import * as TX from './textures.js';

export const BACKPACK_COUNT = 30;

export class Collectibles {
  constructor(game, collected = []) {
    this.game = game;
    const rng = mulberry32(777);
    const roofs = game.city.roofs.filter((b) => b.y1 > 14 && b.x1 - b.x0 > 8 && b.z1 - b.z0 > 8);
    this.items = [];
    const used = new Set();
    const body = new RoundedBoxGeometry(0.7, 0.85, 0.4, 3, 0.12);
    const flap = new RoundedBoxGeometry(0.72, 0.3, 0.44, 2, 0.08);
    flap.translate(0, 0.32, 0.02);
    const strap = new THREE.BoxGeometry(0.08, 0.7, 0.05);
    const red = new THREE.MeshStandardMaterial({ color: 0xb3121b, roughness: 0.6, emissive: 0x400000, emissiveIntensity: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x151a2b, roughness: 0.7 });
    const glowMat = new THREE.SpriteMaterial({ map: TX.radial('rgba(255,210,120,1)', 'rgba(255,160,60,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 });
    let guard = 0;
    while (this.items.length < BACKPACK_COUNT && guard++ < 2000) {
      const b = roofs[Math.floor(rng() * roofs.length)];
      if (!b || used.has(b)) continue;
      used.add(b);
      const x = b.x0 + 2 + rng() * (b.x1 - b.x0 - 4);
      const z = b.z0 + 2 + rng() * (b.z1 - b.z0 - 4);
      const y = game.city.groundHeight(x, z, b.y1 + 0.2);
      const id = this.items.length;
      const g = new THREE.Group();
      const m1 = new THREE.Mesh(body, dark);
      const m2 = new THREE.Mesh(flap, red);
      const s1 = new THREE.Mesh(strap, red);
      s1.position.set(0.18, 0, -0.23);
      const s2 = s1.clone();
      s2.position.x = -0.18;
      g.add(m1, m2, s1, s2);
      g.traverse((o) => (o.castShadow = true));
      const glow = new THREE.Sprite(glowMat);
      glow.scale.setScalar(3.2);
      g.add(glow);
      g.position.set(x, y + 1.1, z);
      game.scene.add(g);
      const got = collected.includes(id);
      g.visible = !got;
      this.items.push({ id, mesh: g, pos: g.position.clone(), got, phase: rng() * 6 });
    }
  }

  get count() {
    return this.items.filter((i) => i.got).length;
  }

  update(dt, t) {
    const p = this.game.player.pos;
    for (const it of this.items) {
      if (it.got) continue;
      it.mesh.rotation.y = t * 1.5 + it.phase;
      it.mesh.position.y = it.pos.y + Math.sin(t * 2 + it.phase) * 0.15;
      const dx = p.x - it.pos.x;
      const dy = p.y + 1 - it.pos.y;
      const dz = p.z - it.pos.z;
      if (dx * dx + dy * dy + dz * dz < 5) {
        it.got = true;
        it.mesh.visible = false;
        this.game.onBackpack(it);
      }
    }
  }

  nearest(p, r = 220) {
    return this.items.filter((i) => !i.got && i.pos.distanceTo(p) < r);
  }
}
