import { CARS, MAPS, THEMES, carById, upgradeCost } from "./data.js";
import { fillBanner, fillRewarded } from "./ads.js";
import { lightPhase } from "./physics.js";
export function createUi(stage, hooks) {
    const overlay = document.createElement("div");
    overlay.className = "apex-overlay";
    overlay.innerHTML = `
    <section class="apex-screen" data-screen="title">
      <div class="apex-topbar">
        <div class="apex-brand">
          <p class="apex-kicker">Circuit series</p>
          <h1 class="apex-title">Apex Drift</h1>
        </div>
        <div class="apex-coins" data-coins>0</div>
      </div>
      <div class="apex-hero">
        <p class="apex-lede">Third-person chase cam, real supercars, 29 circuits — each with its own world and gets tougher as you climb. Hold a slide through the corners to charge nitro. S reverses when you are slow. Hit the cones, barriers and barrels and they fly.</p>
        <div class="apex-actions">
          <button class="apex-btn apex-btn-primary" data-act="play">Drive</button>
          <button class="apex-btn" data-act="maps">Circuits</button>
          <button class="apex-btn" data-act="garage">Garage</button>
          <button class="apex-btn apex-btn-ghost" data-act="settings">Settings</button>
        </div>
        <p class="apex-meta">W gas · A/D steer · S brake / reverse · Space drift · Shift nitro · C camera</p>
      </div>
      <div class="apex-ad-slot" data-ad="title"></div>
    </section>
    <section class="apex-screen hidden" data-screen="maps">
      <div class="apex-head-row">
        <button class="apex-btn apex-btn-ghost" data-act="title">Back</button>
        <h2>Circuits</h2>
        <div class="apex-coins" data-coins>0</div>
      </div>
      <div class="apex-scroll"><div class="apex-grid" data-map-grid></div></div>
      <div class="apex-ad-slot" data-ad="maps"></div>
    </section>
    <section class="apex-screen hidden" data-screen="garage">
      <div class="apex-head-row">
        <button class="apex-btn apex-btn-ghost" data-act="title">Back</button>
        <h2>Garage</h2>
        <div class="apex-coins" data-coins>0</div>
      </div>
      <div class="apex-scroll">
        <div class="apex-grid" data-car-grid></div>
        <div data-upgrades></div>
        <div class="apex-actions" style="margin-top:16px">
          <button class="apex-btn" data-act="watch-coins">Watch ad for 200 coins</button>
        </div>
      </div>
      <div class="apex-ad-slot" data-ad="garage"></div>
    </section>
    <section class="apex-screen hidden" data-screen="settings">
      <div class="apex-head-row">
        <button class="apex-btn apex-btn-ghost" data-act="title">Back</button>
        <h2>Settings</h2>
      </div>
      <div class="apex-settings">
        <label>Music <input type="range" min="0" max="100" data-set="music" /></label>
        <label>Effects <input type="range" min="0" max="100" data-set="sfx" /></label>
        <label>Camera shake <input type="range" min="0" max="100" data-set="shake" /></label>
        <label>Steering <input type="range" min="50" max="140" data-set="steer" /></label>
      </div>
      <p class="apex-meta">Progress is stored on this device. Landscape is forced even if the phone is upright.</p>
    </section>
    <div class="apex-hud hidden" data-hud>
      <div class="apex-hud-left">
        <button class="apex-icon-btn apex-pause-btn" data-pause aria-label="Pause">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>
        </button>
        <button class="apex-icon-btn apex-cam-btn" data-cam aria-label="Camera">
          CAM
        </button>
        <button class="apex-icon-btn" data-act="retry" aria-label="Restart">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 1 0 2.2-5.5"/><path d="M4 4v5h5"/></svg>
        </button>
      </div>
      <div class="apex-hud-right">
        <div class="apex-stat"><span>LAP</span><b data-hud-lap>1/2</b></div>
        <div class="apex-stat apex-stat-pos"><span>POS</span><b data-hud-pos>3/5</b></div>
        <div class="apex-stat apex-stat-gear"><span>GEAR</span><b data-hud-gear>N</b></div>
      </div>
      <div class="apex-drift-pop" data-drift-pop></div>
      <div class="apex-clash-pop" data-clash-pop></div>
      <div class="apex-lights hidden" data-lights>
        <div class="apex-lights-tree">
          <span class="apex-light" data-light="0"></span>
          <span class="apex-light" data-light="1"></span>
          <span class="apex-light" data-light="2"></span>
        </div>
        <p class="apex-lights-count" data-lights-label></p>
      </div>
      <div class="apex-nitro" data-nitro-box><label>Nitro</label><div class="apex-bar"><span data-nitro></span></div></div>
      <div class="apex-speedo">
        <svg viewBox="0 0 120 90" class="apex-speedo-arc">
          <path d="M10 78 A 52 52 0 0 1 110 78" fill="none" stroke="rgba(244,244,245,0.18)" stroke-width="6" stroke-linecap="round"/>
          <path data-speed-arc d="M10 78 A 52 52 0 0 1 110 78" fill="none" stroke="#f4f4f5" stroke-width="6" stroke-linecap="round" stroke-dasharray="163" stroke-dashoffset="163"/>
        </svg>
        <b data-speed>0</b>
        <span>km/h</span>
        <em data-rpm>rpm</em>
      </div>
    </div>
    <div class="apex-touch hidden" data-touch>
      <div class="apex-steer-pad" data-steer-pad>
        <button class="apex-tri-btn apex-tri-left" data-pedal="turn-left" aria-label="Steer left">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M15 4 L15 20 L5 12 Z"/></svg>
        </button>
        <button class="apex-tri-btn apex-tri-right" data-pedal="turn-right" aria-label="Steer right">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M9 4 L9 20 L19 12 Z"/></svg>
        </button>
      </div>
      <div class="apex-pedals">
        <button class="apex-pedal" data-pedal="hb">DRIFT</button>
        <button class="apex-pedal" data-pedal="brake" data-brake-label>BRAKE</button>
        <button class="apex-pedal" data-pedal="nitro">N2O</button>
        <button class="apex-pedal gas" data-pedal="gas">GAS</button>
      </div>
    </div>
    <div class="apex-modal hidden" data-modal="pause">
      <div class="apex-panel">
        <h2>Paused</h2>
        <p>The circuit is waiting. Resume, change setup, or leave the run.</p>
        <div class="apex-actions">
          <button class="apex-btn apex-btn-primary" data-act="resume">Resume</button>
          <button class="apex-btn" data-act="retry">Restart</button>
          <button class="apex-btn apex-btn-ghost" data-act="quit">Quit</button>
        </div>
        <div class="apex-ad-slot" data-ad="pause"></div>
      </div>
    </div>
    <div class="apex-modal hidden" data-modal="results">
      <div class="apex-panel">
        <h2 data-result-title>Finish</h2>
        <p data-result-body></p>
        <div class="apex-actions">
          <button class="apex-btn apex-btn-primary" data-act="next">Next circuit</button>
          <button class="apex-btn" data-act="retry">Retry</button>
          <button class="apex-btn" data-act="extra-life" data-extra>Watch ad for extra life</button>
          <button class="apex-btn apex-btn-ghost" data-act="maps">Circuits</button>
        </div>
        <div class="apex-ad-slot" data-ad="results"></div>
      </div>
    </div>
    <div class="apex-toast hidden" data-toast></div>
    <div class="apex-modal hidden" data-modal="ad">
      <div class="apex-panel">
        <h2>Sponsored break</h2>
        <p data-ad-copy>Watch this short placement to claim the reward. Do not tap the ad itself.</p>
        <div class="apex-ad-watch" data-ad="reward"></div>
        <p class="apex-countdown" data-ad-count>5</p>
        <button class="apex-btn" data-act="ad-skip" disabled>Claim reward</button>
      </div>
    </div>
  `;
    stage.appendChild(overlay);
    const screens = {
        title: overlay.querySelector('[data-screen="title"]'),
        maps: overlay.querySelector('[data-screen="maps"]'),
        garage: overlay.querySelector('[data-screen="garage"]'),
        settings: overlay.querySelector('[data-screen="settings"]'),
    };
    const hud = overlay.querySelector("[data-hud]");
    const touch = overlay.querySelector("[data-touch]");
    const pauseM = overlay.querySelector('[data-modal="pause"]');
    const resultsM = overlay.querySelector('[data-modal="results"]');
    const adM = overlay.querySelector('[data-modal="ad"]');
    const extraBtn = overlay.querySelector("[data-extra]");
    const adSkip = overlay.querySelector('[data-act="ad-skip"]');
    const adCount = overlay.querySelector("[data-ad-count]");
    const adCopy = overlay.querySelector("[data-ad-copy]");
    let adTimer = 0;
    let adDone = null;
    overlay.addEventListener("click", (e) => {
        const t = e.target.closest("[data-act]");
        if (!t)
            return;
        const act = t.getAttribute("data-act");
        if (act === "play")
            hooks.play();
        if (act === "next")
            hooks.play();
        if (act === "maps")
            hooks.open("maps");
        if (act === "garage")
            hooks.open("garage");
        if (act === "settings")
            hooks.open("settings");
        if (act === "title")
            hooks.open("title");
        if (act === "resume")
            hooks.resume();
        if (act === "quit")
            hooks.quit();
        if (act === "retry")
            hooks.retry();
        if (act === "watch-coins")
            hooks.watchCoins();
        if (act === "extra-life")
            hooks.extraLife();
        if (act === "ad-skip" && adDone) {
            const fn = adDone;
            adDone = null;
            adM.classList.add("hidden");
            fn();
        }
    });
    hud.querySelector("[data-pause]")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hooks.pause();
    });
    hud.querySelector("[data-cam]")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        hooks.cycleCam();
    });
    overlay.querySelectorAll("[data-set]").forEach((el) => {
        el.addEventListener("input", () => {
            const key = el.dataset.set;
            const v = Number(el.value);
            hooks.setSetting(key, v / 100);
        });
    });
    function hideAll() {
        Object.values(screens).forEach((s) => s.classList.add("hidden"));
        hud.classList.add("hidden");
        touch.classList.add("hidden");
        pauseM.classList.add("hidden");
        resultsM.classList.add("hidden");
        if (!adDone)
            adM.classList.add("hidden");
    }
    function coins(n) {
        overlay.querySelectorAll("[data-coins]").forEach((el) => {
            el.textContent = `${Math.floor(n)} coins`;
        });
    }
    let toastTimer = 0;
    let toastHideTimer = 0;
    function showToast(msg) {
        const el = overlay.querySelector("[data-toast]");
        if (!el)
            return;
        el.textContent = msg;
        window.clearTimeout(toastTimer);
        window.clearTimeout(toastHideTimer);
        el.classList.remove("hidden");
        void el.offsetWidth;
        el.classList.add("show");
        toastTimer = window.setTimeout(() => {
            el.classList.remove("show");
            toastHideTimer = window.setTimeout(() => el.classList.add("hidden"), 220);
        }, 1700);
    }
    function showTitle(save) {
        hideAll();
        screens.title.classList.remove("hidden");
        coins(save.coins);
        fillBanner(overlay.querySelector('[data-ad="title"]'));
    }
    function showMaps(save, onPick) {
        hideAll();
        screens.maps.classList.remove("hidden");
        coins(save.coins);
        const grid = overlay.querySelector("[data-map-grid]");
        grid.innerHTML = "";
        for (const m of MAPS) {
            const locked = !save.unlocked.includes(m.id);
            const btn = document.createElement("button");
            btn.className = `apex-card${locked ? " locked" : ""}${save.lastMap === m.id ? " active" : ""}`;
            const best = save.bestTime[m.id];
            const theme = THEMES[m.theme];
            btn.innerHTML = `
        <span class="apex-card-swatch" style="background:${theme.sky2};box-shadow:inset 0 0 0 1px ${theme.sky}"></span>
        <p class="apex-stars">${"I".repeat(m.difficulty)}${"·".repeat(5 - m.difficulty)}</p>
        <h3>${m.name}</h3>
        <p class="apex-locale">${m.locale}</p>
        <p>${m.laps} laps · ${m.coins} coins</p>
        <p class="apex-meta">${locked ? "Locked — win the previous circuit" : best ? `Best ${best.toFixed(2)}s` : "No time yet"}</p>
      `;
            btn.disabled = locked;
            btn.addEventListener("click", () => onPick(m.id));
            grid.appendChild(btn);
        }
        fillBanner(overlay.querySelector('[data-ad="maps"]'));
    }
    function showGarage(save) {
        hideAll();
        screens.garage.classList.remove("hidden");
        coins(save.coins);
        const grid = overlay.querySelector("[data-car-grid]");
        grid.innerHTML = "";
        for (const c of CARS) {
            const owned = save.owned.find((o) => o.id === c.id);
            const afford = save.coins >= c.price;
            const btn = document.createElement("button");
            btn.className = `apex-card${save.selectedCar === c.id ? " active" : ""}${!owned && !afford ? " unaffordable" : ""}`;
            btn.innerHTML = `
        <p class="apex-meta">${c.className}</p>
        <h3>${c.name}</h3>
        <p class="apex-price">${owned ? "Owned" : `${c.price} coins`}</p>
        <div class="apex-stat-row">Power <div class="apex-bar"><span style="width:${clampPct(c.power / 25000)}%"></span></div></div>
        <div class="apex-stat-row">Slide <div class="apex-bar"><span style="width:${clampPct(1.2 - c.gripR)}%"></span></div></div>
      `;
            btn.addEventListener("click", () => {
                if (owned) {
                    hooks.selectCar(c.id);
                }
                else if (afford) {
                    hooks.buyCar(c.id);
                }
                else {
                    btn.classList.remove("insufficient");
                    void btn.offsetWidth;
                    btn.classList.add("insufficient");
                    showToast(`Not enough coins — need ${Math.ceil(c.price - save.coins)} more`);
                }
            });
            grid.appendChild(btn);
        }
        const owned = save.owned.find((o) => o.id === save.selectedCar);
        const box = overlay.querySelector("[data-upgrades]");
        if (!owned) {
            box.innerHTML = "";
            return;
        }
        box.innerHTML = `<h3 style="font-family:var(--font-display);margin:16px 0 8px">Upgrades · ${carById(owned.id).name}</h3>`;
        ["engine", "tires", "chassis", "nitro"].forEach((stat) => {
            const lvl = owned[stat];
            const row = document.createElement("div");
            row.className = "apex-upgrade-row";
            const cost = upgradeCost(lvl);
            const canAfford = save.coins >= cost;
            row.innerHTML = `<span>${label(stat)} · ${lvl}/5</span>`;
            const b = document.createElement("button");
            b.className = `apex-btn${lvl < 5 && !canAfford ? " unaffordable" : ""}`;
            b.textContent = lvl >= 5 ? "Max" : `${cost} coins`;
            b.disabled = lvl >= 5;
            b.addEventListener("click", () => {
                if (canAfford) {
                    hooks.upgrade(stat);
                }
                else {
                    b.classList.remove("insufficient");
                    void b.offsetWidth;
                    b.classList.add("insufficient");
                    showToast(`Not enough coins — need ${Math.ceil(cost - save.coins)} more`);
                }
            });
            row.appendChild(b);
            box.appendChild(row);
        });
        fillBanner(overlay.querySelector('[data-ad="garage"]'));
    }
    function showSettings(save) {
        hideAll();
        screens.settings.classList.remove("hidden");
        const s = save.settings;
        overlay.querySelector('[data-set="music"]').value = String(s.music * 100);
        overlay.querySelector('[data-set="sfx"]').value = String(s.sfx * 100);
        overlay.querySelector('[data-set="shake"]').value = String(s.shake * 100);
        overlay.querySelector('[data-set="steer"]').value = String(s.steer * 100);
    }
    function showHud() {
        Object.values(screens).forEach((s) => s.classList.add("hidden"));
        resultsM.classList.add("hidden");
        pauseM.classList.add("hidden");
        hud.classList.remove("hidden");
        touch.classList.remove("hidden");
    }
    function showPause() {
        pauseM.classList.remove("hidden");
        fillBanner(overlay.querySelector('[data-ad="pause"]'));
    }
    function hidePause() {
        pauseM.classList.add("hidden");
    }
    function ordinal(n) {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    function showResults(win, race, reward, canExtra) {
        resultsM.classList.remove("hidden");
        extraBtn.style.display = !win && canExtra ? "inline-flex" : "none";
        const nextBtn = overlay.querySelector('[data-act="next"]');
        nextBtn.style.display = win ? "inline-flex" : "none";
        const title = overlay.querySelector("[data-result-title]");
        const body = overlay.querySelector("[data-result-body]");
        const place = race.place;
        const field = 1 + race.rivals.length;
        const placeLabel = ordinal(place);
        title.textContent = win ? `Finished ${placeLabel} · Circuit complete` : "Out of Lives";
        body.textContent = win
            ? `${placeLabel} of ${field} · ${race.time.toFixed(2)}s · drift ${Math.floor(race.driftScore)} · +${reward} coins · next circuit unlocked`
            : `You crashed out running ${placeLabel} of ${field} when the lives ran out. Watch a placement for one more, or retry this circuit. The next circuit stays locked until you finish.`;
        fillBanner(overlay.querySelector('[data-ad="results"]'));
    }
    function watchAd(kind, onDone) {
        adDone = onDone;
        adM.classList.remove("hidden");
        adCopy.textContent =
            kind === "coins"
                ? "Watch this short placement to add 200 coins. Do not tap the ad."
                : "Watch this short placement for an extra life. Do not tap the ad.";
        fillRewarded(overlay.querySelector('[data-ad="reward"]'));
        adSkip.disabled = true;
        adSkip.textContent = "Claim reward";
        let n = 5;
        adCount.textContent = String(n);
        window.clearInterval(adTimer);
        adTimer = window.setInterval(() => {
            n -= 1;
            adCount.textContent = String(Math.max(0, n));
            if (n <= 0) {
                window.clearInterval(adTimer);
                adSkip.disabled = false;
            }
        }, 1000);
    }
    function updateHud(race) {
        hud.querySelector("[data-hud-lap]").textContent = `${race.lap}/${race.map.laps}`;
        const posEl = hud.querySelector("[data-hud-pos]");
        posEl.textContent = `${race.place}/${1 + race.rivals.length}`;
        posEl.dataset.place = String(race.place);
        const gearEl = hud.querySelector("[data-hud-gear]");
        if (gearEl) {
            const shown = race.gear === "D" ? String(race.gearNum || 1) : race.gear;
            gearEl.textContent = shown;
            gearEl.dataset.gear = shown;
        }
        const kmh = Math.round(race.car.speed * 3.6);
        hud.querySelector("[data-speed]").textContent = String(kmh);
        const arc = hud.querySelector("[data-speed-arc]");
        if (arc) {
            const max = 163;
            const t = Math.min(1, kmh / 280);
            arc.style.strokeDashoffset = String(max * (1 - t));
        }
        hud.querySelector("[data-nitro]").style.width = `${Math.round(race.car.nitro * 100)}%`;
        const nitroBox = hud.querySelector("[data-nitro-box]");
        if (nitroBox)
            nitroBox.classList.toggle("active", !!race.car.drifting && race.car.nitro < 0.98);
        nitroBox?.classList.toggle("boosting", !!race.usingNitro);
        const pop = hud.querySelector("[data-drift-pop]");
        if (race.car.drifting) {
            pop.innerHTML = `<b>${Math.floor(race.driftScore)}</b><span>x${race.combo.toFixed(1)} slide</span>`;
        }
        else
            pop.innerHTML = "";
        const clash = hud.querySelector("[data-clash-pop]");
        if (clash)
            clash.textContent = race.clashT > 0.04 ? "CLASH" : "";
        const brakeLbl = overlay.querySelector("[data-brake-label]");
        if (brakeLbl)
            brakeLbl.textContent = race.car.u < 2.5 ? "REV" : "BRAKE";
    }
    function updateLights(race) {
        const el = overlay.querySelector("[data-lights]");
        const label = overlay.querySelector("[data-lights-label]");
        if (!el || !label)
            return;
        if (race.racing && race.goT <= 0) {
            el.classList.add("hidden");
            return;
        }
        el.classList.remove("hidden");
        const phase = lightPhase(race.lightT);
        const reds = race.racing ? 0 : phase.reds;
        el.querySelectorAll("[data-light]").forEach((node, i) => {
            node.classList.toggle("red", !race.racing && i < reds);
            node.classList.toggle("green", race.racing);
        });
        if (race.racing) {
            label.textContent = "GO";
            label.classList.add("go");
        }
        else {
            label.textContent = String(phase.count);
            label.classList.remove("go");
        }
    }
    function hideLights() {
        overlay.querySelector("[data-lights]")?.classList.add("hidden");
    }
    function bindTouch(on) {
        const bindPedal = (name, fn) => {
            const el = overlay.querySelector(`[data-pedal="${name}"]`);
            el.style.webkitUserSelect = "none";
            el.style.userSelect = "none";
            el.style.webkitTouchCallout = "none";
            const down = (e) => {
                e.preventDefault();
                el.classList.add("held");
                fn(true);
            };
            const up = () => {
                el.classList.remove("held");
                fn(false);
            };
            const blockMenu = (e) => e.preventDefault();
            el.addEventListener("pointerdown", down);
            el.addEventListener("pointerup", up);
            el.addEventListener("pointercancel", up);
            el.addEventListener("pointerleave", up);
            el.addEventListener("lostpointercapture", up);
            el.addEventListener("contextmenu", blockMenu);
            el.addEventListener("selectstart", blockMenu);
        };
        // Two discrete press-and-hold buttons instead of an analog joystick.
        // This sidesteps the touch-coordinate math entirely, so it can't be
        // mirrored when the page is CSS-rotated for forced-landscape play on
        // a portrait phone (which is what caused the old joystick to steer
        // backwards in that mode).
        let leftHeld = false;
        let rightHeld = false;
        const applyTurn = () => {
            on.steer((leftHeld ? 1 : 0) + (rightHeld ? -1 : 0));
        };
        bindPedal("turn-left", (v) => {
            leftHeld = v;
            applyTurn();
        });
        bindPedal("turn-right", (v) => {
            rightHeld = v;
            applyTurn();
        });
        bindPedal("gas", on.gas);
        bindPedal("brake", on.brake);
        bindPedal("hb", on.hb);
        bindPedal("nitro", on.nitro);
    }
    return {
        showTitle,
        showMaps,
        showGarage,
        showSettings,
        showHud,
        showPause,
        hidePause,
        showResults,
        watchAd,
        showToast,
        updateHud,
        updateLights,
        hideLights,
        bindTouch,
        coins,
        overlay,
    };
}
function clampPct(v) {
    return Math.max(8, Math.min(100, v * 100));
}
function label(stat) {
    if (stat === "engine")
        return "Engine";
    if (stat === "tires")
        return "Tires";
    if (stat === "chassis")
        return "Chassis";
    return "Nitro";
}
