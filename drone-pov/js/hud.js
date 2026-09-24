/**
 * In-flight HUD — writes straight to the DOM from one rAF loop.
 */
import * as THREE from "three";
import { input } from "./input.js";
import { ABILITIES } from "./shop.js";

const fmt = (t) => {
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
};

export class Hud {
  constructor(root) {
    this.root = root;
    this.raf = 0;
    this.gameRef = null;
    this.touch = false;
    this.abilityId = null;
    this.onPause = () => {};
  }

  mount(game, level, touch, abilityId) {
    this.gameRef = game;
    this.touch = touch;
    this.abilityId = abilityId;
    const ab = ABILITIES.find((a) => a.id === abilityId);
    this.root.innerHTML = `
      <div class="vignette"></div>
      <div id="fx-boost"></div><div id="fx-emp"></div><div id="fx-dmg"></div>
      <div class="crosshair"><i class="l"></i><i class="r"></i><i class="t"></i><i class="b"></i><i class="c"></i></div>
      <div id="gate-arrow">➤</div>
      <div class="hud-top">
        <div class="glass hud-box">
          <div class="row"><span style="font-size:18px">💎</span><span id="h-gems" class="hud-text hud-gems">0</span><span id="h-combo" class="hud-text hud-combo"></span></div>
          <div class="tiny" style="margin-top:4px">Crystals</div>
        </div>
        <div class="glass hud-box hud-center">
          <div id="h-timer" class="hud-text hud-timer">0:00.00</div>
          <div class="tiny" style="margin-top:4px">GATE <b id="h-gate" style="color:var(--amber-2)">0/0</b></div>
          <div class="prog"><i id="h-prog"></i></div>
        </div>
        <div class="row" style="align-items:flex-start">
          <div class="glass" style="padding:6px;position:relative"><canvas id="radar" width="116" height="116"></canvas></div>
          <button id="pause-btn" class="glass hover" aria-label="Pause">❚❚</button>
        </div>
      </div>
      <div id="hud-warn" class="hud-text"></div>
      <div id="hud-cd" class="hud-text"></div>
      <div class="hud-bl">
        <div class="glass hud-box">
          <div class="row" style="align-items:baseline;gap:6px"><div id="h-speed" class="hud-text hud-speed">0</div><div class="tiny">km/h</div></div>
          <div class="speedbar"><i id="h-speedbar"></i></div>
          <div class="hud-sub"><span>ALT <b id="h-alt">0</b>m</span><span>🎯 <b id="h-tgt">0/0</b></span><span><b id="h-fps">60</b>fps</span></div>
        </div>
        <div id="hull-box" class="glass hud-box">
          <div class="tiny">Hull</div>
          <div id="hull">${"<i></i>".repeat(10)}</div>
          <div class="tiny" style="margin-top:4px">${level.name}</div>
        </div>
      </div>
      <div class="hud-br">
        <div class="glass boost-tank"><div class="well"><i id="h-boost"></i></div><small>BST</small></div>
        ${
          touch
            ? `<div class="touch-btns">
                <div class="rowb">
                  ${ab ? `<button id="btn-ability" class="glass tbtn"><div id="h-abfill" class="fill"></div><span id="h-abicon">${ab.icon}</span></button>` : ""}
                  <button id="btn-fire" class="glass tbtn"><span>🔫</span></button>
                </div>
                <button id="btn-boost" class="btn primary">BOOST</button>
              </div>`
            : `<div class="glass keys">
                <div><b>MOUSE</b> look/steer · <b>A/D</b> steer &amp; bank</div>
                <div><b>W/S</b> pitch · <b>SPACE</b> boost · <b>Q/E</b> roll</div>
                <div><b>F</b> fire · <b>R</b> ability · <b>ESC</b> pause</div>
                ${ab ? `<div class="row" style="margin-top:4px"><span>${ab.icon} ${ab.name}</span><span style="display:block;width:56px;height:6px;border-radius:99px;background:rgba(221,138,28,.2);overflow:hidden"><i id="h-abfill-w" style="display:block;height:100%;width:100%;transform-origin:left;background:#ff9a3d"></i></span></div>` : ""}
              </div>`
        }
      </div>
      ${touch ? `<div id="stick"><i></i></div>` : ""}
    `;

    const $ = (id) => this.root.querySelector("#" + id);
    this.el = {
      gems: $("h-gems"), combo: $("h-combo"), timer: $("h-timer"), gate: $("h-gate"), prog: $("h-prog"),
      speed: $("h-speed"), speedbar: $("h-speedbar"), alt: $("h-alt"), tgt: $("h-tgt"), fps: $("h-fps"),
      hull: $("hull"), boost: $("h-boost"), warn: $("hud-warn"), cd: $("hud-cd"), arrow: $("gate-arrow"),
      fxBoost: $("fx-boost"), fxEmp: $("fx-emp"), fxDmg: $("fx-dmg"), abfill: $("h-abfill"), abfillW: $("h-abfill-w"),
      abicon: $("h-abicon"), stick: $("stick"), radar: $("radar"),
    };
    game.setRadarCanvas(this.el.radar);

    $("pause-btn").addEventListener("pointerdown", (e) => { e.stopPropagation(); this.onPause(); });
    const hold = (id, key) => {
      const b = $(id);
      if (!b) return;
      const on = (e) => { e.stopPropagation(); e.preventDefault(); input.btn[key] = true; };
      const off = (e) => { if (e) e.stopPropagation(); input.btn[key] = false; };
      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointerleave", () => off());
      b.addEventListener("pointercancel", () => off());
    };
    hold("btn-boost", "boost");
    hold("btn-fire", "fire");
    hold("btn-ability", "ability");

    this.smoothSpeed = 0;
    this.lastHull = -1;
    this.flash = 0;
    this.v = new THREE.Vector3();
    cancelAnimationFrame(this.raf);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.update();
    };
    this.raf = requestAnimationFrame(loop);
  }

  update() {
    const g = this.gameRef;
    if (!g || !this.el) return;
    const h = g.hud;
    const E = this.el;
    E.speed.textContent = String(h.speed);
    this.smoothSpeed += (Math.min(1, h.speedRatio) - this.smoothSpeed) * 0.18;
    E.speedbar.style.transform = `scaleX(${this.smoothSpeed})`;
    E.alt.textContent = h.altitude;
    E.tgt.textContent = `${h.targets}/${h.targetsTotal}`;
    E.gems.textContent = h.gems;
    E.combo.textContent = h.combo > 1.05 ? `×${h.combo.toFixed(1)}` : "";
    const left = Math.max(0, h.timeLimit - h.time);
    E.timer.textContent = fmt(h.time);
    E.timer.style.color = left < 20 ? "#ff5d7a" : left < 45 ? "#ffd166" : "#f4ecdf";
    E.gate.textContent = `${h.gate}/${h.gates}`;
    E.prog.style.width = `${(h.progress * 100).toFixed(1)}%`;
    E.boost.style.height = `${Math.max(0, Math.min(100, h.boost * 100))}%`;
    E.fps.textContent = h.fps;

    if (this.lastHull !== h.hull) {
      this.lastHull = h.hull;
      const kids = E.hull.children;
      for (let i = 0; i < kids.length; i++) {
        kids[i].style.opacity = i < h.hull ? "1" : "0.16";
        kids[i].style.background = i < h.hull ? "#ffc266" : "#2c3238";
      }
      this.flash = 0.5;
    }
    this.flash = Math.max(0, this.flash - 0.016);
    E.fxDmg.style.opacity = this.flash * 1.2;
    E.fxEmp.style.opacity = h.emp * 0.5;
    E.fxBoost.style.opacity = Math.min(0.9, h.boosting * 0.55 + Math.max(0, h.speedRatio - 0.6) * 1.1);

    E.warn.textContent = h.warning || "";
    E.warn.style.opacity = h.warning ? "1" : "0";
    if (g.state === "countdown") {
      const n = Math.ceil(g.countdown - 0.2);
      E.cd.textContent = n > 0 ? String(n) : "GO!";
      E.cd.style.opacity = "1";
    } else E.cd.style.opacity = "0";

    if (E.abfill) E.abfill.style.height = `${Math.min(100, h.abilityReady * 100)}%`;
    if (E.abfillW) E.abfillW.style.transform = `scaleX(${Math.min(1, Math.max(0, h.abilityReady))})`;
    if (E.abicon) E.abicon.style.filter = h.abilityReady >= 1 ? "none" : "grayscale(0.7)";

    // off-screen gate arrow
    if (g.track) {
      const target = g.track.gates[Math.min(g.nextGate, g.track.gates.length - 1)];
      this.v.copy(target.p);
      g.camera.updateMatrixWorld();
      const local = g.camera.worldToLocal(this.v.clone());
      const ndc = this.v.clone().project(g.camera);
      const behind = local.z > 0;
      const off = behind || Math.abs(ndc.x) > 0.82 || Math.abs(ndc.y) > 0.82;
      if (off) {
        const a = Math.atan2(behind ? -local.y : ndc.y, behind ? -local.x : ndc.x);
        E.arrow.style.opacity = "0.95";
        E.arrow.style.transform = `translate(-50%,-50%) rotate(${-a}rad) translateX(min(28vw,190px))`;
      } else E.arrow.style.opacity = "0";
    }

    if (E.stick) {
      const s = input.stick;
      if (s.active) {
        const R = Math.min(90, window.innerHeight * 0.2);
        E.stick.style.opacity = "1";
        E.stick.style.left = `${s.ox}px`;
        E.stick.style.top = `${s.oy}px`;
        E.stick.firstElementChild.style.transform = `translate(calc(-50% + ${s.x * R * 0.6}px), calc(-50% + ${s.y * R * 0.6}px))`;
      } else E.stick.style.opacity = "0";
    }
  }

  unmount() {
    cancelAnimationFrame(this.raf);
    this.root.innerHTML = "";
    this.el = null;
    this.gameRef = null;
  }
}
