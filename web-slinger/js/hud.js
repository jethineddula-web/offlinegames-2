// DOM heads-up display: health/focus/XP, combo counter, notifications,
// crime waypoint, point-launch marker, spider-sense, rotating minimap.
import * as THREE from 'three';
import { clamp } from './utils.js';

const $ = (id) => document.getElementById(id);
const v = new THREE.Vector3();

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.hp = $('hpFill');
    this.hpLag = $('hpLag');
    this.focusEls = [...document.querySelectorAll('.focus i')];
    this.lvl = $('lvl');
    this.xp = $('xpFill');
    this.bp = $('bpCount');
    this.comboEl = $('combo');
    this.comboN = this.comboEl.querySelector('b');
    this.notifyEl = $('notify');
    this.popups = $('popups');
    this.obj = $('objective');
    this.objName = this.obj.querySelector('.obj-name');
    this.objDist = this.obj.querySelector('.obj-dist');
    this.wp = $('waypoint');
    this.wpDist = this.wp.querySelector('.wp-dist');
    this.launch = $('launchMark');
    this.sense = $('sense');
    this.target = $('targetMark');
    this.fps = $('fps');
    this.tips = $('tips');
    this.mm = $('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.lagHp = 100;
    this.notifyQueue = [];
    this.notifyT = 0;
    this.comboT = 0;
    this.fpsAcc = 0;
    this.fpsN = 0;
    this.senseOn = false;
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
  }

  notify(title, sub = '') {
    this.notifyQueue.push([title, sub]);
  }

  popup(text) {
    const d = document.createElement('div');
    d.className = 'popup';
    d.textContent = text;
    this.popups.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }

  combo(n) {
    if (n < 2) return;
    this.comboN.textContent = n;
    this.comboEl.classList.remove('bump');
    void this.comboEl.offsetWidth;
    this.comboEl.classList.add('bump', 'on');
    this.comboT = 2.6;
  }

  hurt() {
    this.game.hurtFlash = 1;
  }

  defeated(on) {
    $('defeated').classList.toggle('on', on);
  }

  tip(text) {
    this.tips.textContent = text;
    this.tips.classList.toggle('on', !!text);
  }

  project(p, cam) {
    v.copy(p).project(cam);
    const behind = v.z > 1;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind };
  }

  update(dt, realDt) {
    const G = this.game;
    const P = G.player;
    const cam = G.camera;

    // bars
    const hpPct = clamp(P.health / P.maxHealth, 0, 1) * 100;
    this.hp.style.width = hpPct + '%';
    this.lagHp += (hpPct - this.lagHp) * Math.min(1, realDt * (this.lagHp > hpPct ? 1.5 : 10));
    this.hpLag.style.width = this.lagHp + '%';
    this.root.classList.toggle('low-hp', hpPct < 30);
    this.focusEls.forEach((el, i) => {
      const f = clamp(P.focus - i, 0, 1);
      el.style.setProperty('--f', f);
      el.classList.toggle('full', f >= 1);
    });
    const st = G.stats;
    this.lvl.textContent = 'LV ' + st.level;
    this.xp.style.width = clamp((st.xp / G.xpNeed(st.level)) * 100, 0, 100) + '%';
    this.bp.textContent = `${G.collectibles.count}/${G.collectibles.items.length}`;

    // combo
    if (this.comboT > 0) {
      this.comboT -= realDt;
      if (this.comboT <= 0 || P.combo < 2) this.comboEl.classList.remove('on');
    }

    // notifications
    this.notifyT -= realDt;
    if (this.notifyT <= 0) {
      this.notifyEl.classList.remove('on');
      if (this.notifyQueue.length && this.notifyT < -0.35) {
        const [t, s] = this.notifyQueue.shift();
        this.notifyEl.querySelector('.n-title').textContent = t;
        this.notifyEl.querySelector('.n-sub').textContent = s;
        this.notifyEl.classList.add('on');
        this.notifyT = 3.2;
      }
    }

    // objective + waypoint
    const crime = G.combat.crime;
    if (crime && !crime.done) {
      const d = P.pos.distanceTo(crime.pos);
      this.obj.classList.remove('hidden');
      this.objName.textContent = crime.def.name;
      const left = crime.enemies.filter((e) => e.alive).length;
      this.objDist.textContent = d > 45 ? `${Math.round(d)} m` : `${left} thug${left === 1 ? '' : 's'} left`;
      const s = this.project(v.copy(crime.pos).setY(crime.pos.y + 3), cam);
      let x = s.x;
      let y = s.y;
      if (s.behind) {
        x = innerWidth - x;
        y = innerHeight - 40;
      }
      const m = 50;
      const off = x < m || x > innerWidth - m || y < m || y > innerHeight - m || s.behind;
      x = clamp(x, m, innerWidth - m);
      y = clamp(y, m + 20, innerHeight - m);
      this.wp.style.transform = `translate(${x}px, ${y}px)`;
      this.wp.classList.toggle('edge', off);
      this.wp.classList.toggle('on', d > 18);
      this.wpDist.textContent = Math.round(d) + 'm';
    } else {
      this.obj.classList.add('hidden');
      this.wp.classList.remove('on');
    }

    // point-launch marker
    if (P.launchTarget && G.state === 'playing') {
      const s = this.project(P.launchTarget, cam);
      if (!s.behind) {
        this.launch.style.transform = `translate(${s.x}px, ${s.y}px)`;
        this.launch.classList.add('on');
      } else this.launch.classList.remove('on');
    } else this.launch.classList.remove('on');

    // spider-sense squiggle over the head
    const threat = G.combat.threatLevel(P.pos);
    const on = threat > 0.25;
    if (on && !this.senseOn) G.audio.sense();
    this.senseOn = on;
    if (on) {
      const s = this.project(v.copy(P.pos).setY(P.pos.y + 2.3), cam);
      this.sense.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }
    this.sense.classList.toggle('on', on);
    G.senseAmt = on ? threat : 0;

    // enemy lock-on marker
    const tgt = G.combat.findTarget(P.pos, G.camRig.fwdFlat, 14);
    if (tgt && G.state === 'playing') {
      const s = this.project(v.copy(tgt.pos).setY(tgt.pos.y + 2.1 * tgt.cfg.scale), cam);
      if (!s.behind) {
        this.target.style.transform = `translate(${s.x}px, ${s.y}px)`;
        this.target.classList.add('on');
      } else this.target.classList.remove('on');
    } else this.target.classList.remove('on');

    this.drawMinimap();

    if (G.settings.fps) {
      this.fpsAcc += realDt;
      this.fpsN++;
      if (this.fpsAcc > 0.5) {
        this.fps.textContent = Math.round(this.fpsN / this.fpsAcc) + ' FPS';
        this.fpsAcc = 0;
        this.fpsN = 0;
      }
    }
    this.fps.style.display = G.settings.fps ? 'block' : 'none';
  }

  drawMinimap() {
    const G = this.game;
    const ctx = this.mmCtx;
    const W = this.mm.width;
    const P = G.player.pos;
    const mm = G.city.minimap;
    const ppm = 0.8; // pixels per metre on the minimap
    const yaw = G.camRig.yaw;
    const th = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    const c = Math.cos(th);
    const s = Math.sin(th);
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0b2433';
    ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    ctx.rotate(th);
    const z = ppm / mm.scale;
    ctx.scale(z, z);
    ctx.drawImage(mm.canvas, -(P.x + mm.offset) * mm.scale, -(P.z + mm.offset) * mm.scale);
    ctx.restore();

    const toScreen = (x, zz, clampR) => {
      const dx = (x - P.x) * ppm;
      const dz = (zz - P.z) * ppm;
      let sx = dx * c - dz * s;
      let sy = dx * s + dz * c;
      const l = Math.hypot(sx, sy);
      const R = W / 2 - 12;
      let edge = false;
      if (clampR && l > R) {
        sx *= R / l;
        sy *= R / l;
        edge = true;
      }
      return [W / 2 + sx, W / 2 + sy, l <= R || edge];
    };
    // backpacks
    for (const it of G.collectibles.nearest(P, 160)) {
      const [x, y, vis] = toScreen(it.pos.x, it.pos.z, false);
      if (!vis) continue;
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
    // enemies
    for (const e of G.combat.enemies) {
      if (!e.alive) continue;
      const [x, y, vis] = toScreen(e.pos.x, e.pos.z, false);
      if (!vis) continue;
      ctx.fillStyle = e.state === 'windup' ? '#ffffff' : '#ff3344';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // crime
    const crime = G.combat.crime;
    if (crime && !crime.done) {
      const [x, y] = toScreen(crime.pos.x, crime.pos.z, true);
      const pulse = 7 + Math.sin(G.time * 6) * 2;
      ctx.fillStyle = 'rgba(255,40,60,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, pulse + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff2a3c';
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
    }
    // player arrow
    const py = G.player.yaw;
    const fx = Math.sin(py);
    const fz = Math.cos(py);
    const ax = fx * c - fz * s;
    const ay = fx * s + fz * c;
    const ang = Math.atan2(ay, ax);
    ctx.save();
    ctx.translate(W / 2, W / 2);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d0101c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // north marker
    const [nx, ny] = toScreen(P.x, P.z - 1000, true);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);
  }
}
