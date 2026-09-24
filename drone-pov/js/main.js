/**
 * Drone POV Flight — application shell (plain JavaScript, no framework).
 * Screens: boot → menu → maps / hangar / settings / manual → flight → results.
 */
import { DroneGame } from "./engine.js";
import { LEVELS, BIOME_ICON } from "./levels.js";
import { DRONES, UPGRADES, ABILITIES, TRAILS, loadSave, persist, computeStats, upgradePrice } from "./shop.js";
import { audio } from "./audio.js";
import { input } from "./input.js";
import { initAds, isMobile, mountBanner, showRewarded, showInterstitial, adHooks } from "./ads.js";
import { Hud } from "./hud.js";

/* ------------------------------------------------------------- helpers */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const fmtTime = (t) => {
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
};
const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;
const stars = (n, size = 14) =>
  `<span class="stars" style="font-size:${size}px">${[0, 1, 2].map((i) => `<span class="${i < n ? "on" : "off"}">★</span>`).join("")}</span>`;
const logo = (s) => {
  const rings = [[0, 0], [1, 0], [0, 1], [1, 1]]
    .map(([x, y]) => `<div class="ring" style="width:${s * 0.36}px;height:${s * 0.36}px;${x ? "right:0" : "left:0"};${y ? "bottom:0" : "top:0"}"><div class="blade" style="width:${s * 0.3}px"></div></div>`)
    .join("");
  return `<div class="logo" style="width:${s}px;height:${s * 0.62}px">${rings}<div class="body" style="width:${s * 0.3}px;height:${s * 0.2}px"></div></div>`;
};

async function lockLandscape() {
  try {
    const d = document.documentElement;
    if (!document.fullscreenElement) {
      if (d.requestFullscreen) await d.requestFullscreen({ navigationUI: "hide" });
      else if (d.webkitRequestFullscreen) await d.webkitRequestFullscreen();
    }
  } catch { /* needs gesture */ }
  try {
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape");
  } catch { /* iOS — CSS gate handles it */ }
}

/* --------------------------------------------------------------- state */
const state = {
  save: loadSave(),
  screen: "boot",
  levelId: 0,
  game: null,
  result: null,
  paused: false,
  doubled: false,
  adState: "idle",
  houseLeft: 5,
  rounds: 0,
  touch: isMobile(),
};
const ui = $("#ui");
const hudRoot = $("#hud");
const inputLayer = $("#input-layer");
const hud = new Hud(hudRoot);
let toastTimer = 0;

function update(fn) {
  state.save = fn(state.save);
  persist(state.save);
  applySettings();
}
function applySettings() {
  const s = state.save.settings;
  audio.setVolume(s.volume);
  audio.setMusicVolume(s.music);
  input.sensitivity = s.sensitivity;
  input.invertY = s.invertY;
  input.tiltEnabled = s.tilt;
}
function toast(msg, ok = true) {
  const old = $(".toast", ui);
  if (old) old.remove();
  const t = el(`<div class="toast ${ok ? "ok" : "bad"}">${msg}</div>`);
  ui.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 1700);
}
function bindBtn(root, sel, fn) {
  const b = typeof sel === "string" ? $(sel, root) : sel;
  if (!b) return;
  b.addEventListener("click", () => { audio.ui(); fn(); });
}
function banner(root) {
  const box = $(".ad-box", root);
  if (box) mountBanner(box);
}

/* ------------------------------------------------------------- screens */
function show(screen) {
  state.screen = screen;
  ui.innerHTML = "";
  inputLayer.classList.toggle("off", screen !== "playing");
  ({ boot: renderBoot, menu: renderMenu, levels: renderLevels, shop: renderShop, settings: renderSettings, help: renderHelp, playing: () => {} })[screen]();
}

function renderBoot() {
  const s = el(`
    <div id="boot-screen" class="screen">
      <div class="photo-bg" style="opacity:.4"></div><div class="grid-bg"></div>
      <div class="photo-fade" style="background:radial-gradient(ellipse at 50% 55%, rgba(255,150,40,.22), transparent 62%), linear-gradient(to top, #07090c, transparent 55%)"></div>
      <div class="rel center" style="display:flex;flex-direction:column;align-items:center">
        ${logo(140)}
        <h1 class="title-grad">DRONE POV</h1>
        <div class="eyebrow" style="letter-spacing:.55em">Real-World FPV Flight</div>
        <div class="bar"><i></i></div>
        <div id="boot-tap">TAP / CLICK TO ENTER</div>
      </div>
      <div class="footer-note" style="position:absolute;bottom:12px;left:0;right:0">OFFLINEGAMES.ART</div>
    </div>`);
  ui.appendChild(s);
  let ready = false;
  setTimeout(() => { ready = true; $("#boot-tap", s).classList.add("ready"); }, 1400);
  s.addEventListener("click", () => {
    if (!ready) return;
    audio.init();
    audio.ui();
    if (isMobile()) lockLandscape();
    show("menu");
  });
}

function renderMenu() {
  const sv = state.save;
  const total = Object.values(sv.best).reduce((a, b) => a + b.stars, 0);
  const s = el(`
    <div class="screen">
      <div class="photo-bg"></div><div class="photo-fade"></div><div class="grid-bg"></div>
      <div class="menu-body">
        <div class="menu-left">
          ${logo(74)}
          <h1 class="title-grad">DRONE POV</h1>
          <div class="eyebrow" style="letter-spacing:.42em">Real-World FPV Flight</div>
          <div class="stat-pills">
            <div class="glass"><b style="color:var(--amber-2)">💎 ${sv.gems.toLocaleString()}</b><span class="tiny">Crystals</span></div>
            <div class="glass"><b style="color:#fcd34d">★ ${total}/${LEVELS.length * 3}</b><span class="tiny">Rating</span></div>
            <div class="glass"><b style="color:var(--green)">${sv.unlocked + 1}/${LEVELS.length}</b><span class="tiny">Maps</span></div>
          </div>
        </div>
        <div class="menu-right">
          <button class="btn primary big" data-a="play">▶ FLY NOW</button>
          <div class="menu-grid">
            <button class="btn glass hover" data-a="levels">🗺 MAPS</button>
            <button class="btn glass hover" data-a="shop">🛒 HANGAR</button>
            <button class="btn glass hover" data-a="settings">⚙ SETTINGS</button>
            <button class="btn glass hover" data-a="help">? HOW TO</button>
          </div>
        </div>
      </div>
      <div class="ad-slot"><div class="ad-box"></div><div class="footer-note">DRONE POV FLIGHT · FREE HTML5 DRONE RACING · OFFLINEGAMES.ART</div></div>
    </div>`);
  ui.appendChild(s);
  bindBtn(s, '[data-a="play"]', () => beginGame(Math.min(sv.unlocked, LEVELS.length - 1)));
  bindBtn(s, '[data-a="levels"]', () => show("levels"));
  bindBtn(s, '[data-a="shop"]', () => show("shop"));
  bindBtn(s, '[data-a="settings"]', () => show("settings"));
  bindBtn(s, '[data-a="help"]', () => show("help"));
  banner(s);
}

function renderLevels() {
  const sv = state.save;
  const cards = LEVELS.map((l) => {
    const locked = l.id > sv.unlocked;
    const best = sv.best[l.id];
    const tags = [l.turrets > 0 && "SECURITY", l.enemies > 0 && "HOSTILE DRONES", l.windZones > 0 && "SHEAR", l.empZones > 0 && "LIVE CABLES", l.water && "WATERSIDE", l.night && "NIGHT"]
      .filter(Boolean).map((t) => `<span class="tag">${t}</span>`).join(" ");
    return `
      <button class="glass card level-card ${locked ? "locked" : "hover"}" data-id="${l.id}" ${locked ? "disabled" : ""}>
        <div class="tint" style="background:linear-gradient(135deg, ${hex(l.accent)}33, transparent 55%, ${hex(l.accent2)}22)"></div>
        <div class="row rel" style="align-items:flex-start;gap:10px">
          <div style="font-size:24px">${BIOME_ICON[l.biome]}</div>
          <div class="flex1" style="min-width:0">
            <div class="row between"><h3>${l.name}</h3><span class="tiny">#${String(l.id + 1).padStart(2, "0")}</span></div>
            <div class="tiny">${l.subtitle}</div>
          </div>
        </div>
        <p class="rel">${l.brief}</p>
        <div class="row between rel" style="margin-top:8px">${stars(best ? best.stars : 0)}<span class="tiny">${best ? "BEST " + fmtTime(best.time) : "PAR " + fmtTime(l.parTime)}</span></div>
        <div class="rel" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${tags}</div>
        ${locked ? `<div class="lock">🔒 FINISH MAP ${l.id}</div>` : ""}
      </button>`;
  }).join("");
  const s = el(`
    <div class="screen translucent">
      <div class="grid-bg"></div>
      <div class="topbar"><button class="btn glass hover small" data-a="back">← BACK</button><h2>SELECT MAP</h2><div class="glass" style="padding:6px 12px;font-weight:700">💎 ${sv.gems.toLocaleString()}</div></div>
      <div class="body scroll"><div class="cards c3 c4">${cards}</div></div>
      <div class="ad-slot"><div class="ad-box"></div></div>
    </div>`);
  ui.appendChild(s);
  bindBtn(s, '[data-a="back"]', () => show("menu"));
  s.querySelectorAll(".level-card").forEach((c) => c.addEventListener("click", () => { audio.ui(); beginGame(+c.dataset.id); }));
  banner(s);
}

function renderShop(tab = "drones") {
  const sv = state.save;
  const buy = (cost, apply, name) => {
    if (sv.gems < cost) { audio.ui(false); toast(`NEED ${cost - sv.gems} MORE CRYSTALS`, false); return; }
    audio.purchase();
    update((x) => ({ ...apply(x), gems: x.gems - cost }));
    toast(`${name} ACQUIRED`);
    renderShop(tab);
  };
  const statbar = (label, v, max = 1.6) => `<div class="statbar"><span>${label}</span><i><b style="width:${Math.min(100, (v / max) * 100)}%"></b></i></div>`;
  let body = "";
  if (tab === "drones") {
    body = `<div class="cards c3">${DRONES.map((d) => {
      const owned = sv.ownedDrones.includes(d.id), eq = sv.drone === d.id;
      return `<div class="glass card ${eq ? "active" : ""}">
        <div class="row" style="align-items:flex-start;gap:12px">
          <div class="icon-box" style="background:radial-gradient(circle, ${hex(d.color)}44, transparent 70%);border:1px solid ${hex(d.color)}55">🛸</div>
          <div class="flex1"><div class="row between"><h3 style="color:${hex(d.color)}">${d.name}</h3>${eq ? '<span class="tag">ACTIVE</span>' : ""}</div><p>${d.desc}</p></div>
        </div>
        <div style="margin-top:10px">${statbar("SPEED", d.speed)}${statbar("AGILITY", d.agility)}${statbar("BOOST", d.boost)}${statbar("ARMOR", d.armor, 2)}</div>
        <button class="btn wide ${owned ? "glass hover" : "gold"}" style="margin-top:12px" data-drone="${d.id}" ${eq ? "disabled" : ""}>${eq ? "EQUIPPED" : owned ? "EQUIP" : "💎 " + d.price.toLocaleString()}</button>
      </div>`;
    }).join("")}</div>`;
  } else if (tab === "upgrades") {
    body = `<div class="cards">${UPGRADES.map((u) => {
      const lvl = sv.upgrades[u.id], maxed = lvl >= u.max, price = upgradePrice(u, lvl);
      return `<div class="glass card">
        <div class="row" style="gap:12px"><div class="icon-box" style="background:rgba(255,194,102,.1)">${u.icon}</div><div class="flex1"><h3>${u.name}</h3><p>${u.desc}</p></div></div>
        <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("")}</div>
        <button class="btn wide ${maxed ? "glass" : "primary"}" style="margin-top:12px" data-up="${u.id}" ${maxed ? "disabled" : ""}>${maxed ? "MAX LEVEL" : "UPGRADE · 💎 " + price.toLocaleString()}</button>
      </div>`;
    }).join("")}</div>`;
  } else if (tab === "abilities") {
    body = `<div class="cards">${ABILITIES.map((a) => {
      const owned = sv.ownedAbilities.includes(a.id), eq = sv.equippedAbility === a.id;
      return `<div class="glass card ${eq ? "active" : ""}">
        <div class="row" style="gap:12px"><div class="icon-box" style="background:rgba(255,154,61,.1)">${a.icon}</div>
        <div class="flex1"><div class="row"><h3 style="color:#ffe9c9">${a.name}</h3>${eq ? '<span class="tag">SLOTTED</span>' : ""}</div><p>${a.desc}</p><div class="tiny" style="margin-top:2px">Cooldown ${a.cooldown}s</div></div></div>
        <button class="btn wide ${owned ? "glass hover" : "gold"}" style="margin-top:12px" data-ab="${a.id}">${eq ? "UNSLOT" : owned ? "SLOT" : "💎 " + a.price.toLocaleString()}</button>
      </div>`;
    }).join("")}</div>`;
  } else {
    body = `<div class="cards c3 c4">${TRAILS.map((t) => {
      const owned = sv.ownedTrails.includes(t.id), eq = sv.trail === t.id;
      return `<div class="glass card ${eq ? "active" : ""}">
        <div class="swatch" style="background:linear-gradient(90deg, ${hex(t.color)}, ${hex(t.color2)});box-shadow:0 0 26px ${hex(t.color)}66"></div>
        <h3 style="margin-top:8px;font-size:12px">${t.name}</h3>
        <button class="btn wide small ${owned ? "glass hover" : "gold"}" style="margin-top:8px" data-trail="${t.id}" ${eq ? "disabled" : ""}>${eq ? "ACTIVE" : owned ? "EQUIP" : "💎 " + t.price}</button>
      </div>`;
    }).join("")}</div>`;
  }
  const TABS = [["drones", "🛸 AIRFRAMES"], ["upgrades", "🔧 UPGRADES"], ["abilities", "✨ ABILITIES"], ["trails", "🌈 TRAILS"]];
  ui.innerHTML = "";
  const s = el(`
    <div class="screen translucent">
      <div class="grid-bg"></div>
      <div class="topbar"><button class="btn glass hover small" data-a="back">← BACK</button><h2>HANGAR</h2><div class="glass" style="padding:6px 12px;font-weight:700">💎 ${sv.gems.toLocaleString()}</div></div>
      <div class="tabs">${TABS.map(([id, l]) => `<button class="tab ${tab === id ? "on" : "glass hover"}" data-tab="${id}">${l}</button>`).join("")}</div>
      <div class="body scroll">${body}</div>
    </div>`);
  ui.appendChild(s);
  bindBtn(s, '[data-a="back"]', () => show("menu"));
  s.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { audio.ui(); renderShop(b.dataset.tab); }));
  s.querySelectorAll("[data-drone]").forEach((b) => b.addEventListener("click", () => {
    const d = DRONES.find((x) => x.id === b.dataset.drone);
    if (sv.ownedDrones.includes(d.id)) { audio.ui(); update((x) => ({ ...x, drone: d.id })); toast(`${d.name} EQUIPPED`); renderShop(tab); }
    else buy(d.price, (x) => ({ ...x, ownedDrones: [...x.ownedDrones, d.id], drone: d.id }), d.name);
  }));
  s.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => {
    const u = UPGRADES.find((x) => x.id === b.dataset.up);
    buy(upgradePrice(u, sv.upgrades[u.id]), (x) => ({ ...x, upgrades: { ...x.upgrades, [u.id]: x.upgrades[u.id] + 1 } }), u.name);
  }));
  s.querySelectorAll("[data-ab]").forEach((b) => b.addEventListener("click", () => {
    const a = ABILITIES.find((x) => x.id === b.dataset.ab);
    if (sv.ownedAbilities.includes(a.id)) {
      const eq = sv.equippedAbility === a.id;
      audio.ui(); update((x) => ({ ...x, equippedAbility: eq ? null : a.id })); toast(eq ? "SLOT CLEARED" : `${a.name} SLOTTED`); renderShop(tab);
    } else buy(a.price, (x) => ({ ...x, ownedAbilities: [...x.ownedAbilities, a.id], equippedAbility: a.id }), a.name);
  }));
  s.querySelectorAll("[data-trail]").forEach((b) => b.addEventListener("click", () => {
    const t = TRAILS.find((x) => x.id === b.dataset.trail);
    if (sv.ownedTrails.includes(t.id)) { audio.ui(); update((x) => ({ ...x, trail: t.id })); toast(`${t.name} EQUIPPED`); renderShop(tab); }
    else buy(t.price, (x) => ({ ...x, ownedTrails: [...x.ownedTrails, t.id], trail: t.id }), t.name);
  }));
}

function renderSettings() {
  const st = state.save.settings;
  const set = (patch) => { update((x) => ({ ...x, settings: { ...x.settings, ...patch } })); renderSettings(); };
  const slider = (label, key, min, max, step, fmt) =>
    `<div class="slider"><label><span>${label}</span><span style="color:var(--amber-2)">${fmt ? fmt(st[key]) : Math.round(st[key] * 100) + "%"}</span></label><input type="range" min="${min}" max="${max}" step="${step}" value="${st[key]}" data-k="${key}"></div>`;
  ui.innerHTML = "";
  const s = el(`
    <div class="screen translucent">
      <div class="grid-bg"></div>
      <div class="topbar"><button class="btn glass hover small" data-a="back">← BACK</button><h2>SETTINGS</h2><div class="spacer"></div></div>
      <div class="body scroll"><div class="cards" style="max-width:760px;margin:0 auto">
        <div class="glass panel"><h3>AUDIO</h3>${slider("MASTER VOLUME", "volume", 0, 1, 0.05)}${slider("MUSIC", "music", 0, 1, 0.05)}</div>
        <div class="glass panel"><h3>GRAPHICS</h3>
          <div class="seg">${["low", "medium", "high"].map((q) => `<button class="${st.quality === q ? "on" : "glass hover"}" data-q="${q}">${q.toUpperCase()}</button>`).join("")}</div>
          <p class="tiny" style="margin:0;line-height:1.6;text-transform:none;letter-spacing:.04em">LOW disables bloom &amp; motion blur and halves prop density — use it on older phones for a locked 60fps.</p>
          ${slider("CAMERA SHAKE", "shake", 0, 1.5, 0.05)}
        </div>
        <div class="glass panel"><h3>CONTROLS</h3>
          ${slider("SENSITIVITY", "sensitivity", 0.4, 2, 0.05, (v) => v.toFixed(2) + "×")}
          <button class="toggle ${st.invertY ? "on" : ""}" data-t="invertY"><span>INVERT Y AXIS</span><i></i></button>
          <button class="toggle ${st.tilt ? "on" : ""}" data-t="tilt"><span>GYRO / TILT STEERING</span><i></i></button>
          <p class="tiny" style="margin:0;line-height:1.6;text-transform:none;letter-spacing:.04em">Tilt uses your device gyroscope for roll &amp; pitch. Hold the phone level when enabling it.</p>
        </div>
        <div class="glass panel"><h3>DATA</h3>
          <p class="tiny" style="margin:0;line-height:1.6;text-transform:none;letter-spacing:.04em">Progress, crystals and unlocks are stored on this device only. The game is fully playable offline after the first load.</p>
          <button class="btn danger" data-a="reset">RESET PROGRESS</button>
        </div>
      </div></div>
      <div class="ad-slot"><div class="ad-box"></div></div>
    </div>`);
  ui.appendChild(s);
  bindBtn(s, '[data-a="back"]', () => show("menu"));
  s.querySelectorAll("input[type=range]").forEach((r) => r.addEventListener("input", () => {
    update((x) => ({ ...x, settings: { ...x.settings, [r.dataset.k]: parseFloat(r.value) } }));
    const lab = r.previousElementSibling.lastElementChild;
    const v = parseFloat(r.value);
    lab.textContent = r.dataset.k === "sensitivity" ? v.toFixed(2) + "×" : Math.round(v * 100) + "%";
  }));
  s.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => { audio.ui(); set({ quality: b.dataset.q }); }));
  s.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", async () => {
    audio.ui();
    const k = b.dataset.t;
    if (k === "tilt" && !st.tilt) {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === "function") {
        try { if ((await D.requestPermission()) !== "granted") return; } catch { return; }
      }
      input.recentreTilt();
    }
    set({ [k]: !st[k] });
  }));
  bindBtn(s, '[data-a="reset"]', () => {
    if (confirm("Reset all progress, crystals and unlocks?")) { localStorage.removeItem("dronepov.save.v1"); location.reload(); }
  });
  banner(s);
}

function renderHelp() {
  const touch = state.touch;
  const s = el(`
    <div class="screen translucent">
      <div class="grid-bg"></div>
      <div class="topbar"><button class="btn glass hover small" data-a="back">← BACK</button><h2>FLIGHT MANUAL</h2><div class="spacer"></div></div>
      <div class="body scroll"><div class="cards" style="max-width:900px;margin:0 auto">
        <div class="glass panel"><h3>${touch ? "TOUCH" : "KEYBOARD + MOUSE"}</h3>
          <ul class="help-list">${touch
            ? `<li><b>Left thumb</b> — steer &amp; bank left/right, pitch up/down</li><li><b>Right thumb drag</b> — fine yaw &amp; look</li><li><b>BOOST</b> — afterburner (drains the amber tank)</li><li><b>🔫</b> — pulse cannon · <b>✨</b> — equipped ability</li><li><b>Gyro</b> — enable tilt steering in Settings</li>`
            : `<li><b>Mouse</b> — yaw &amp; pitch (click to capture)</li><li><b>W / S</b> — pitch up / down</li><li><b>A / D</b> — steer (steer &amp; bank smoothly) · <b>Q / E</b> — roll</li><li><b>SPACE / SHIFT</b> — boost · <b>CTRL</b> — brake</li><li><b>F</b> — fire · <b>R</b> — ability · <b>ESC</b> — pause</li><li><b>Gamepad</b> — sticks steer, RT boosts, A fires</li>`}
          </ul></div>
        <div class="glass panel"><h3>OBJECTIVE</h3>
          <ul class="help-list">
            <li>🟢 Fly through every <b>air gate</b> before the clock runs out.</li>
            <li>💎 Collect energy cells — they are the shop currency. Chain them for a combo.</li>
            <li>🎯 Shoot the range boards beside the course for bonus crystals.</li>
            <li>🔫 Taking out security turrets and hostile drones pays bonus crystals.</li>
            <li>🛡 Every impact costs a hull segment. Lose them all and the run ends.</li>
            <li>⭐ Beat the par time for 3 stars.</li>
            <li>🌀 Look out for wind shear (pale) and live cabling (amber) — cables kill your boost.</li>
          </ul></div>
      </div></div>
      <div class="ad-slot"><div class="ad-box"></div></div>
    </div>`);
  ui.appendChild(s);
  bindBtn(s, '[data-a="back"]', () => show("menu"));
  banner(s);
}

/* ---------------------------------------------------------- gameplay */
const TIPS = [
  "Roll then pitch — banking through a turn is faster than yawing.",
  "Boost on the straights, brake before tight gates.",
  "Chain energy cells within 2.4s to build your multiplier.",
  "Missed gates cost you the clean-gate bonus.",
  "Tune your rates before buying motors — handling beats raw speed.",
  "Live cabling kills your boost. Fly through it fast and level.",
  "Gold dots on the radar are target boards — free crystals for good aim.",
];

function renderLoading(level) {
  return el(`
    <div id="loading-screen" class="screen">
      <div class="grid-bg"></div>
      <div class="scan" style="background:linear-gradient(180deg, transparent, ${hex(level.accent)}55, transparent)"></div>
      <div class="rel center" style="display:flex;flex-direction:column;align-items:center">
        ${logo(140)}
        <div style="font-size:30px;margin-top:24px">${BIOME_ICON[level.biome]}</div>
        <h2>${level.name.toUpperCase()}</h2>
        <div class="eyebrow">${level.subtitle}</div>
        <div id="load-bar"><i></i></div>
        <div id="load-pct" class="tiny" style="margin-top:8px">GENERATING TERRAIN · 0%</div>
        <div id="load-tip"><span class="eyebrow" style="color:rgba(255,194,102,.7)">TIP · </span>${TIPS[level.id % TIPS.length]}</div>
      </div>
    </div>`);
}

function beginGame(id) {
  audio.init();
  if (state.touch) lockLandscape();
  state.result = null;
  state.paused = false;
  state.levelId = id;
  show("playing");
  startRun();
}

function startRun() {
  const level = LEVELS[state.levelId];
  ui.innerHTML = "";
  hud.unmount();
  if (state.game) { state.game.dispose(); state.game = null; }

  // fresh canvas per run avoids GL context reuse issues
  const old = $("#gl");
  const canvas = document.createElement("canvas");
  canvas.id = "gl";
  old.replaceWith(canvas);

  const loading = renderLoading(level);
  ui.appendChild(loading);
  const setPct = (p) => {
    $("#load-bar i", loading).style.width = p + "%";
    $("#load-pct", loading).textContent = `GENERATING TERRAIN · ${p}%`;
  };
  setPct(8);

  const game = new DroneGame(canvas, null);
  state.game = game;
  game.onFinish = (r) => onFinish(r);
  input.attach(inputLayer);
  input.reset();

  const steps = [
    () => setPct(26),
    () => setPct(52),
    () => { game.load(level, computeStats(state.save), state.save.settings); setPct(88); },
    () => {
      game.start();
      setPct(100);
      setTimeout(() => {
        loading.remove();
        hud.mount(game, level, state.touch, state.save.equippedAbility);
        hud.onPause = doPause;
        if (!state.touch) input.requestPointerLock();
      }, 220);
    },
  ];
  let i = 0;
  const run = () => { if (state.game !== game || i >= steps.length) return; steps[i++](); setTimeout(run, 70); };
  setTimeout(run, 60);
}

function onFinish(r) {
  update((s) => {
    const prev = s.best[r.levelId];
    const better = r.finished && (!prev || r.time < prev.time);
    const best = { ...s.best };
    if (better) best[r.levelId] = { time: r.time, gems: r.gems, stars: Math.max(prev ? prev.stars : 0, r.stars) };
    else if (prev) best[r.levelId] = { ...prev, stars: Math.max(prev.stars, r.stars) };
    return {
      ...s,
      gems: s.gems + r.payout,
      totalRuns: s.totalRuns + 1,
      unlocked: r.finished ? Math.max(s.unlocked, Math.min(LEVELS.length - 1, r.levelId + 1)) : s.unlocked,
      best,
    };
  });
  state.doubled = false;
  state.adState = "idle";
  state.result = r;
  state.rounds++;
  input.exitPointerLock();
  inputLayer.classList.add("off");
  renderResults();
}

function doPause() {
  const g = state.game;
  // Only while actually flying — ESC or a tab switch on the loading screen
  // used to show the pause menu while the run started behind it.
  if (!g || (g.state !== "running" && g.state !== "countdown") || state.paused) return;
  g.pause();
  state.paused = true;
  inputLayer.classList.add("off");
  const level = LEVELS[state.levelId];
  const s = el(`
    <div class="overlay" id="pause-ov">
      <div class="glass anim-up center" style="width:min(420px,92vw);padding:24px">
        <h2 style="margin:0;font-size:24px;font-weight:900;letter-spacing:.35em;color:var(--amber-2)">PAUSED</h2>
        <div class="tiny" style="margin-top:4px">${level.name} · ${level.subtitle}</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:20px">
          <button class="btn primary" data-a="resume">RESUME FLIGHT</button>
          <div class="row"><button class="btn glass hover flex1" data-a="restart">RESTART</button><button class="btn danger flex1" data-a="quit">QUIT</button></div>
        </div>
      </div>
    </div>`);
  ui.appendChild(s);
  bindBtn(s, '[data-a="resume"]', doResume);
  bindBtn(s, '[data-a="restart"]', () => { state.paused = false; s.remove(); startRun(); });
  bindBtn(s, '[data-a="quit"]', leaveToMenu);
}

function doResume() {
  const g = state.game;
  if (!g) return;
  state.paused = false;
  const ov = $("#pause-ov");
  if (ov) ov.remove();
  inputLayer.classList.remove("off");
  g.resume();
  if (!state.touch) input.requestPointerLock();
}

function leaveToMenu() {
  hud.unmount();
  if (state.game) { state.game.dispose(); state.game = null; }
  state.result = null;
  state.paused = false;
  show("menu");
}

function grantDouble() {
  if (state.doubled || !state.result) return;
  state.doubled = true;
  update((s) => ({ ...s, gems: s.gems + state.result.payout }));
  audio.purchase();
}

async function watchAdForDouble(rerender) {
  if (state.doubled || state.adState !== "idle") return;
  state.adState = "loading";
  rerender();
  const res = await showRewarded();
  if (!state.result) return; // left the results screen while the ad ran
  if (res === "viewed") { grantDouble(); state.adState = "done"; rerender(); }
  else if (res === "dismissed") {
    // closed the ad early: no reward, but let them try again
    state.adState = "idle";
    rerender();
    toast("AD CLOSED EARLY — NO BONUS", false);
  } else {
    // no ad available (offline, blocked, not filled): short house message,
    // reward still granted so the button never does nothing
    state.houseLeft = 5;
    state.adState = "house";
    rerender();
    const tickH = () => {
      if (state.adState !== "house") return;
      state.houseLeft--;
      if (state.houseLeft <= 0) { grantDouble(); state.adState = "done"; rerender(); }
      else { rerender(); setTimeout(tickH, 1000); }
    };
    setTimeout(tickH, 1000);
  }
}

/* Between rounds, every second run, ask the Ad Placement API for an
   interstitial. Google decides whether one actually shows and handles the
   frequency cap; the game just waits for adBreakDone (or a timeout). This
   replaced a home-made "GAME INTERSTITIAL" overlay that put a display banner
   behind a forced countdown and asked players to "support the game" — both
   things AdSense policy does not allow. */
let breakBusy = false;
async function afterResult(next) {
  if (breakBusy) return;
  if (state.rounds > 0 && state.rounds % 2 === 0) {
    breakBusy = true;
    const ov = $("#results-ov");
    if (ov) ov.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try { await showInterstitial(); } finally { breakBusy = false; }
  }
  next();
}

function renderResults() {
  const r = state.result;
  const level = LEVELS[state.levelId];
  const win = r.finished;
  const hasNext = win && state.levelId < LEVELS.length - 1;
  const old = $("#results-ov");
  if (old) old.remove();
  const adBlock = state.doubled ? "" : state.adState === "house"
    ? `<div class="glass house-msg" style="margin:0 16px 12px"><div class="row" style="gap:12px"><span style="font-size:24px">🛸</span><div><div class="eyebrow" style="color:var(--amber-2)">No ad available right now</div><div class="tiny" style="text-transform:none;letter-spacing:.04em">Your 2× bonus unlocks in a moment</div></div></div><b>${state.houseLeft}s</b></div>`
    : `<div style="margin:0 16px 12px"><button class="btn gold wide big" data-a="ad" ${state.adState === "loading" ? "disabled" : ""}>${state.adState === "loading" ? "LOADING AD…" : "▶ WATCH AD → 2× CRYSTALS"}</button></div>`;
  const s = el(`
    <div class="overlay" id="results-ov" style="flex-direction:column">
      <div class="glass results anim-up">
        <div class="head ${win ? "win" : "lose"}">
          <h2>${win ? "COURSE COMPLETE" : r.reason === "timeout" ? "TIME EXPIRED" : "DRONE DESTROYED"}</h2>
          <div class="tiny" style="margin-top:2px">${level.name} · ${level.subtitle}</div>
          ${win ? `<div style="margin-top:6px">${stars(r.stars, 30)}</div>` : ""}
        </div>
        <div class="stats">
          <div class="glass stat"><span class="tiny">Time</span><b>${fmtTime(r.time)}</b><span class="tiny">PAR ${fmtTime(level.parTime)}</span></div>
          <div class="glass stat"><span class="tiny">Gates</span><b>${r.gates}/${r.gatesTotal}</b><span class="tiny">Checkpoints</span></div>
          <div class="glass stat"><span class="tiny">Crystals</span><b>${r.gems}</b><span class="tiny">of ${r.gemsTotal}</span></div>
          <div class="glass stat"><span class="tiny">Targets</span><b>${r.targets}/${r.targetsTotal}</b><span class="tiny">Boards hit</span></div>
          <div class="glass stat"><span class="tiny">Kills</span><b>${r.kills}</b><span class="tiny">Hostiles down</span></div>
        </div>
        <div class="payout"><span class="tiny" style="color:rgba(253,230,138,.7)">Crystals earned</span>
          <b class="${state.doubled ? "anim-pop" : ""}">💎 ${(r.payout * (state.doubled ? 2 : 1)).toLocaleString()}${state.doubled ? '<small>2× APPLIED</small>' : ""}</b></div>
        ${adBlock}
        <div class="actions">
          ${hasNext ? '<button class="btn primary" data-a="next">NEXT MAP →</button>' : ""}
          <button class="btn glass hover" data-a="retry">↻ RETRY</button>
          <button class="btn danger" data-a="menu">MENU</button>
        </div>
      </div>
    </div>`);
  // No display banner on this screen: it sat 8px under RETRY / MENU, which is
  // the accidental-click placement AdSense flags, and it pushed the buttons
  // off the bottom of landscape phones.
  ui.appendChild(s);
  bindBtn(s, '[data-a="ad"]', () => watchAdForDouble(renderResults));
  bindBtn(s, '[data-a="retry"]', () => afterResult(() => { state.result = null; startRun(); }));
  bindBtn(s, '[data-a="next"]', () => afterResult(() => { state.result = null; state.levelId = Math.min(LEVELS.length - 1, state.levelId + 1); startRun(); }));
  bindBtn(s, '[data-a="menu"]', () => afterResult(leaveToMenu));
}

/* ------------------------------------------------------------ global */
window.addEventListener("keydown", (e) => {
  if (state.screen !== "playing" || state.result) return;
  if (e.code === "Escape") { if (state.paused) doResume(); else doPause(); }
  if (e.code === "KeyP" && !state.paused) doPause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.screen === "playing" && !state.result) doPause();
  // Music runs on a timer, so it kept playing in a background tab.
  if (document.hidden) audio.suspend();
  else if (!adOnScreen) audio.resume();
});
// Ad Placement API: the game must be silent (and not running) while an ad shows.
let adOnScreen = false;
adHooks.beforeAd = () => { adOnScreen = true; audio.suspend(); };
adHooks.afterAd = () => { adOnScreen = false; if (!document.hidden) audio.resume(); };
// Turning the phone to portrait mid-flight covers the game with the rotate
// gate; without this the clock kept running underneath it.
const portraitGate = window.matchMedia("(orientation: portrait) and (max-width: 950px)");
const onGate = () => { if (portraitGate.matches && state.screen === "playing" && !state.result) doPause(); };
if (portraitGate.addEventListener) portraitGate.addEventListener("change", onGate);
else if (portraitGate.addListener) portraitGate.addListener(onGate);
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement && state.screen === "playing" && !state.result && !state.paused && !state.touch) {
    const g = state.game;
    if (g && g.state === "running") doPause();
  }
});
window.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") state.touch = true; }, { passive: true });
document.addEventListener("contextmenu", (e) => e.preventDefault());
$("#rotate-gate").addEventListener("click", () => lockLandscape());

initAds();
applySettings();
show("boot");
const bootEl = document.getElementById("boot");
if (bootEl) bootEl.remove();
