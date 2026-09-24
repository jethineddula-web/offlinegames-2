// Web Slinger — bootstrap, game state, main loop, menus and settings.
import * as THREE from 'three';
import { City, LANDMARK, blockCenter } from './city.js';
import { Sky } from './sky.js';
import { Traffic } from './traffic.js';
import { FX } from './fx.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Collectibles } from './collectibles.js';
import { HUD } from './hud.js';
import { Post } from './post.js';
import * as TX from './textures.js';
import { clamp, store, nextFrame } from './utils.js';

const QUALITY = {
  low: { label: 'Low', pr: 0.75, shadows: 0, bloom: false, msaa: 0 },
  medium: { label: 'Medium', pr: 1.0, shadows: 1024, bloom: true, msaa: 0 },
  high: { label: 'High', pr: 1.5, shadows: 2048, bloom: true, msaa: 4 },
  ultra: { label: 'Ultra', pr: 2.0, shadows: 4096, bloom: true, msaa: 4 },
};

const TIPS = [
  'Hold SHIFT to sprint · SPACE to jump · hold SHIFT in the air to web-swing',
  'Keep holding SHIFT to chain swings — release at the top of the arc for a boost',
  'SPACE in the air: Web Zip · C: dive to build speed · R: air trick',
  'E: Point Launch to the marked ledge — hold SPACE to launch off it',
  'Sprint into a wall to wall-run · WASD to crawl · SPACE to jump off',
  'LMB / J: combo attack · F: web shooter · Q: dodge (on spider-sense = perfect dodge)',
  'H: heal with a focus bar · V: finisher (2 focus bars)',
];

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.state = 'loading';
    this.time = 0;
    this.hitstopT = 0;
    this.slowT = 0;
    this.hurtFlash = 0;
    this.senseAmt = 0;
    this.settings = Object.assign(
      {
        quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
        time: 'sunset',
        sens: 1,
        invertY: false,
        music: 0.5,
        sfx: 0.8,
        fps: false,
        autoCam: true,
      },
      store.get('settings', {}),
    );
    this.stats = Object.assign({ xp: 0, level: 1, backpacks: [], crimes: 0 }, store.get('stats', {}));
    this.dynScale = 1;
    this.perfAcc = 0;
    this.perfN = 0;
  }

  xpNeed(level) {
    return 400 + level * 250;
  }

  async init() {
    const setProgress = (p, label) => {
      $('loadFill').style.width = Math.round(p * 100) + '%';
      $('loadLabel').textContent = label;
    };
    setProgress(0.02, 'Suiting up');
    await nextFrame();

    const canvas = $('game');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    } catch (e) {
      $('loadLabel').textContent = 'WebGL is not available on this device/browser.';
      throw e;
    }
    this.renderer = renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    TX.setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    const scene = (this.scene = new THREE.Scene());
    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 4200);
    this.sky = new Sky(scene, renderer);
    this.city = new City(scene);
    await this.city.build(setProgress);
    setProgress(0.85, 'Filling the streets');
    await nextFrame();
    this.traffic = new Traffic(scene);
    this.fx = new FX(scene);
    this.audio = new AudioEngine();
    this.input = new Input(canvas);
    this.camRig = new CameraRig(this.camera, this.city);
    this.player = new Player(this);
    this.combat = new Combat(this);
    this.collectibles = new Collectibles(this, this.stats.backpacks);
    this.hud = new HUD(this);
    this.post = new Post(renderer, scene, this.camera, QUALITY[this.settings.quality] || QUALITY.high);

    this.spawnPlayer();
    this.applySettings(true);
    setProgress(0.95, 'Compiling shaders');
    await nextFrame();
    try {
      renderer.compile(scene, this.camera);
    } catch {
      /* optional warm-up */
    }
    this.resize();
    addEventListener('resize', () => this.resize());
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing' && !this.input.isTouch) this.pause(true);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause(true);
    });
    this.bindUI();
    setProgress(1, 'Ready');
    await nextFrame();
    $('loading').classList.add('done');
    this.state = 'title';
    $('title').classList.add('on');
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  spawnPlayer() {
    // perch on a tall-ish roof edge facing the landmark tower
    const lm = new THREE.Vector3(blockCenter(LANDMARK.i), 0, blockCenter(LANDMARK.j));
    const edgePoint = (b) => {
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const dir = new THREE.Vector3(lm.x - cx, 0, lm.z - cz).normalize();
      const hx = (b.x1 - b.x0) / 2 - 1.3;
      const hz = (b.z1 - b.z0) / 2 - 1.3;
      const k = Math.min(hx / Math.max(1e-3, Math.abs(dir.x)), hz / Math.max(1e-3, Math.abs(dir.z)));
      const x = cx + dir.x * k;
      const z = cz + dir.z * k;
      return { p: new THREE.Vector3(x, this.city.groundHeight(x, z, b.y1 + 0.2), z), dir };
    };
    const cands = [];
    for (const b of this.city.roofs) {
      if (b.y1 < 70 || b.y1 > 160 || b.x1 - b.x0 < 14 || b.z1 - b.z0 < 14) continue;
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const d = Math.hypot(cx - lm.x, cz - lm.z);
      if (d < 120) continue;
      cands.push([d, b]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    // prefer a ledge with a clear view of the skyline
    let pick = null;
    for (const [, b] of cands) {
      const e = edgePoint(b);
      const eye = e.p.clone().setY(e.p.y + 1.6);
      const hit = this.city.raycast(eye, e.dir, 150, false);
      if (!hit) {
        pick = e;
        break;
      }
    }
    if (!pick) pick = edgePoint(cands.length ? cands[0][1] : this.city.roofs[0]);
    this.spawnPoint = pick.p;
    this.player.spawn(this.spawnPoint, Math.atan2(pick.dir.x, pick.dir.z));
    this.camRig.snapBehind(this.player);
  }

  // ------------------------------------------------------------------ settings
  applySettings(first = false) {
    const s = this.settings;
    const q = QUALITY[s.quality] || QUALITY.high;
    const hadShadows = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = q.shadows > 0;
    this.sky.setShadowSize(q.shadows);
    if (!first && hadShadows !== this.renderer.shadowMap.enabled) {
      this.scene.traverse((o) => {
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
      });
    }
    this.quality = q;
    this.dynScale = 1;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
    if (!first) this.post.build(q);
    this.resize();
    const p = this.sky.apply(s.time);
    this.city.setLighting(p.windows, p.lamps);
    this.traffic.setNight(p.lamps);
    this.input.sensitivity = s.sens;
    this.input.invertY = s.invertY;
    this.camRig.autoFollow = s.autoCam;
    this.audio.setVolumes(s.music, s.sfx);
    store.set('settings', s);
    this.syncSettingsUI();
  }

  syncSettingsUI() {
    const s = this.settings;
    document.querySelectorAll('[data-setting]').forEach((el) => {
      const k = el.dataset.setting;
      if (el.type === 'checkbox') el.checked = !!s[k];
      else el.value = s[k];
    });
  }

  bindUI() {
    document.querySelectorAll('[data-setting]').forEach((el) => {
      el.addEventListener('input', () => {
        const k = el.dataset.setting;
        const val = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value;
        this.settings[k] = val;
        if (k === 'music' || k === 'sfx' || k === 'sens' || k === 'invertY' || k === 'fps' || k === 'autoCam') {
          this.input.sensitivity = this.settings.sens;
          this.input.invertY = this.settings.invertY;
          this.camRig.autoFollow = this.settings.autoCam;
          this.audio.setVolumes(this.settings.music, this.settings.sfx);
          store.set('settings', this.settings);
        } else this.applySettings();
      });
    });
    $('playBtn').addEventListener('click', () => this.start());
    $('resumeBtn').addEventListener('click', () => this.pause(false));
    $('respawnBtn').addEventListener('click', () => {
      this.player.spawn(this.spawnPoint, this.player.yaw);
      this.player.perchT = 0;
      this.pause(false);
    });
    $('titleBtn').addEventListener('click', () => {
      $('pause').classList.remove('on');
      this.toTitle();
    });
    document.querySelectorAll('[data-open]').forEach((b) =>
      b.addEventListener('click', () => {
        const panel = $(b.dataset.open);
        panel.classList.toggle('on');
      }),
    );
    addEventListener('keydown', (e) => {
      if (this.state === 'title' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        e.preventDefault();
        this.start();
      } else if (this.state === 'paused' && e.code === 'Escape' && !e.repeat) {
        // Esc toggles pause back off only via the Resume button (browser eats the first Esc for pointer lock)
      }
    });
    $('game').addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.locked) this.input.requestLock();
    });
  }

  start() {
    if (this.state !== 'title') return;
    this.audio.init();
    this.audio.setVolumes(this.settings.music, this.settings.sfx);
    this.input.requestLock();
    $('title').classList.remove('on');
    this.hud.show(true);
    this.state = 'playing';
    document.body.classList.add('playing');
    this.player.perchT = 1e9;
    this.camRig.snapBehind(this.player);
    this.combat.timer = 5;
    this.tipIdx = 0;
    this.tipT = 0;
    this.hud.notify('WEB SLINGER', this.input.isTouch ? 'Protect the city. Hold SWING in the air.' : 'Protect the city. Hold SHIFT in the air to swing.');
  }

  toTitle() {
    this.state = 'title';
    document.body.classList.remove('playing');
    this.hud.show(false);
    this.input.exitLock();
    $('title').classList.add('on');
    this.spawnPlayer();
  }

  pause(on) {
    if (on && this.state === 'playing') {
      this.state = 'paused';
      document.body.classList.remove('playing');
      $('pause').classList.add('on');
      this.input.exitLock();
      this.audio.suspend(true);
    } else if (!on && this.state === 'paused') {
      this.state = 'playing';
      document.body.classList.add('playing');
      $('pause').classList.remove('on');
      document.querySelectorAll('.subpanel').forEach((p) => p.classList.remove('on'));
      this.input.requestLock();
      this.audio.suspend(false);
      this.last = performance.now();
    }
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality ? this.quality.pr : 1) * this.dynScale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.post) this.post.setSize(w, h);
    if (this.fx) {
      const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
      this.fx.glow.setScale(s);
      this.fx.dust.setScale(s);
    }
  }

  // ------------------------------------------------------------------ events
  hitstop(t) {
    this.hitstopT = Math.max(this.hitstopT, t);
  }
  slowmo(t) {
    this.slowT = Math.max(this.slowT, t);
  }
  addXP(n, label) {
    const st = this.stats;
    st.xp += n;
    while (st.xp >= this.xpNeed(st.level)) {
      st.xp -= this.xpNeed(st.level);
      st.level++;
      this.hud.notify('LEVEL UP', `You reached level ${st.level}`);
      this.player.maxHealth = 100 + (st.level - 1) * 5;
      this.audio.success();
    }
    if (label) this.hud.popup(`+${n} ${label}`);
    this.saveSoon = true;
  }
  onBackpack(it) {
    this.stats.backpacks.push(it.id);
    this.hud.notify('BACKPACK FOUND', `${this.collectibles.count} / ${this.collectibles.items.length}`);
    this.audio.collect();
    this.fx.webPuff(it.pos, 20);
    this.addXP(100);
    this.saveStats();
  }
  saveStats() {
    store.set('stats', this.stats);
    this.saveSoon = false;
  }

  // ------------------------------------------------------------------ loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const raw = Math.min(0.05, Math.max(0.0001, (now - this.last) / 1000));
    this.last = now;
    if (this.manual) return; // stepped externally (automated tests)
    this.tick(raw);
    this.adaptPerf(raw);
  }

  tick(raw, render = true) {
    if (this.state === 'paused' || this.state === 'loading') return;

    let scale = 1;
    if (this.hitstopT > 0) {
      this.hitstopT -= raw;
      scale = 0.04;
    } else if (this.slowT > 0) {
      this.slowT -= raw;
      scale = 0.3;
    }
    const dt = raw * scale;
    this.time += dt;
    const P = this.player;

    if (this.state === 'playing') {
      if (this.input.pause) this.pause(true);
      P.update(dt, this.input, this.camRig);
      this.combat.update(dt);
      this.collectibles.update(dt, this.time);
      this.camRig.update(raw, this.input, P);
      // tips for the first few minutes
      this.tipT -= raw;
      if (this.tipT <= 0 && this.tipIdx < TIPS.length * 2) {
        this.hud.tip(this.tipIdx % 2 === 0 ? TIPS[(this.tipIdx / 2) | 0] : '');
        this.tipT = this.tipIdx % 2 === 0 ? 7 : 5;
        this.tipIdx++;
      }
      // adaptive score + wind
      const engaged = this.combat.crime && this.combat.crime.engaged && !this.combat.crime.done;
      const sp = P.speed;
      this.audio.targetIntensity = engaged ? 1 : clamp((sp - 8) / 30, 0.2, 0.7);
      this.audio.setWind(P.state === 'ground' ? 0 : sp);
      if (this.saveSoon && Math.random() < 0.01) this.saveStats();
    } else if (this.state === 'title') {
      P.t += raw;
      P.updateModel(raw);
      this.camRig.titleShot(P, performance.now() / 1000);
      this.input.consumeLook();
    }

    this.traffic.update(dt);
    this.city.update(this.time);
    const speed01 = clamp((P.speed - 18) / 32, 0, 1) * (this.state === 'playing' ? 1 : 0);
    this.fx.update(dt, this.camera, P.vel, speed01);
    this.sky.update(dt, this.camera.position, P.pos);
    if (this.state !== 'title') this.hud.update(dt, raw);
    this.hurtFlash = Math.max(0, this.hurtFlash - raw * 1.8);
    if (!render) {
      this.input.endFrame();
      return;
    }
    const lowHp = P.health / P.maxHealth < 0.3 ? 0.35 + Math.sin(this.time * 5) * 0.1 : 0;
    this.post.render(raw, {
      speed: speed01,
      hurt: Math.max(this.hurtFlash, lowHp, P.dead ? 0.8 : 0),
      slow: this.slowT > 0 ? 1 : 0,
      sense: this.senseAmt,
    });
    this.input.endFrame();
  }

  // Dynamic resolution keeps the frame rate up on weaker GPUs.
  adaptPerf(raw) {
    this.perfAcc += raw;
    this.perfN++;
    if (this.perfAcc < 2) return;
    const avg = this.perfAcc / this.perfN;
    this.perfAcc = 0;
    this.perfN = 0;
    let s = this.dynScale;
    if (avg > 1 / 42 && s > 0.55) s = Math.max(0.55, s - 0.1);
    else if (avg < 1 / 57 && s < 1) s = Math.min(1, s + 0.05);
    if (s !== this.dynScale) {
      this.dynScale = s;
      this.resize();
    }
  }
}

const game = new Game();
window.__game = game;
game.init().catch((e) => {
  console.error(e);
  const l = document.getElementById('loadLabel');
  if (l) l.textContent = 'Failed to start: ' + e.message;
});
