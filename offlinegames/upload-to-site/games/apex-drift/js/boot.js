import { createAudio } from "./audio.js";
import { carById, mapById, nextMapId, upgradeCost } from "./data.js";
import { createInput } from "./input.js";
import { bindLayout, tryLockLandscape } from "./orientation.js";
import { FIXED_DT, makeRace, respawn, skipLights, stepCar, stepRace } from "./physics.js";
import { createRenderer } from "./render.js";
import { isUnlocked, loadSave, writeSave } from "./save.js";
import { createUi } from "./ui.js";
import { closestOnTrack, wrapAngle } from "./types.js";
export function mountGame(root) {
    root.innerHTML = "";
    const stage = document.createElement("div");
    stage.className = "apex-stage";
    const canvas = document.createElement("canvas");
    stage.appendChild(canvas);
    root.appendChild(stage);
    const rotateOverlay = document.createElement("div");
    rotateOverlay.className = "apex-rotate-overlay";
    rotateOverlay.innerHTML = `
      <svg class="apex-rotate-icon" viewBox="0 0 64 64" width="56" height="56" fill="none" aria-hidden="true">
        <rect x="18" y="6" width="28" height="46" rx="4" stroke="currentColor" stroke-width="3"/>
        <path d="M32 44h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <path d="M52 30c4 6 3 14-2 19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <path d="M46 44l4 6 6-3" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <p class="apex-rotate-title">Rotate your device</p>
      <p class="apex-rotate-sub">Apex Drift is played in landscape. Turn your phone sideways to keep going.</p>
    `;
    root.appendChild(rotateOverlay);
    let rotationBlocked = false;
    let save = loadSave();
    let layout = { rotated: false, w: 800, h: 450, screenW: 800, screenH: 450, offsetX: 0, offsetY: 0 };
    let mode = "menu";
    let race = null;
    let pendingMap = isUnlocked(save, save.lastMap) ? save.lastMap : "sunset-strip";
    let extrasUsed = 0;
    let running = true;
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    const input = createInput();
    const audio = createAudio();
    const renderer = createRenderer(canvas);
    const orient = bindLayout(stage, (l) => {
        layout = l;
        renderer.resize(l.w, l.h);
    }, (portrait) => {
        rotationBlocked = false;
        rotateOverlay.classList.remove("apex-visible");
        if (portrait) {
            input.clearKeys();
            audio.engine(0, 0, 0);
        }
        else {
            // Coming back from the rotate-prompt: don't let the frozen time
            // read as one giant elapsed frame.
            last = performance.now();
            acc = 0;
        }
    });
    const persist = () => writeSave(save);
    const ui = createUi(stage, {
        play: (id) => {
            if (id)
                startRace(id);
            else if (mode === "results" && race?.finished)
                startRace(nextMapId(race.map.id));
            else
                startRace(pendingMap);
        },
        resume: () => {
            if (mode === "pause" && race && !race.finished && !race.lost) {
                mode = "play";
                ui.hidePause();
                ui.showHud();
            }
            else if (mode === "results" && race?.finished) {
                startRace(nextMapId(race.map.id));
            }
        },
        pause: () => {
            if (mode === "play") {
                mode = "pause";
                ui.showPause();
            }
        },
        quit: () => {
            mode = "menu";
            race = null;
            ui.showTitle(save);
        },
        open: (id) => {
            mode = "menu";
            if (id === "title")
                ui.showTitle(save);
            if (id === "maps")
                ui.showMaps(save, (mapId) => startRace(mapId));
            if (id === "garage")
                ui.showGarage(save);
            if (id === "settings")
                ui.showSettings(save);
        },
        selectCar: (id) => {
            save.selectedCar = id;
            persist();
            ui.showGarage(save);
        },
        buyCar: (id) => {
            const def = carById(id);
            if (save.owned.some((o) => o.id === id)) {
                save.selectedCar = id;
            }
            else if (save.coins >= def.price) {
                save.coins -= def.price;
                save.owned.push({ id, engine: 0, tires: 0, chassis: 0, nitro: 0 });
                save.selectedCar = id;
            }
            persist();
            ui.showGarage(save);
        },
        upgrade: (stat) => {
            const owned = save.owned.find((o) => o.id === save.selectedCar);
            if (!owned || owned[stat] >= 5)
                return;
            const cost = upgradeCost(owned[stat]);
            if (save.coins < cost)
                return;
            save.coins -= cost;
            owned[stat] += 1;
            persist();
            ui.showGarage(save);
        },
        watchCoins: () => {
            ui.watchAd("coins", () => {
                save.coins += 200;
                persist();
                ui.showGarage(save);
                audio.ui();
            });
        },
        extraLife: () => {
            if (!race || race.finished)
                return;
            ui.watchAd("life", () => {
                extrasUsed += 1;
                race.lost = false;
                race.lives = 1;
                respawn(race);
                mode = "play";
                ui.showHud();
            });
        },
        retry: () => {
            if (race)
                startRace(race.map.id);
            else
                startRace(pendingMap);
        },
        cycleCam: () => {
            renderer.cycleCamera();
        },
        setSetting: (key, value) => {
            save.settings[key] = value;
            audio.setVolumes(save.settings.music, save.settings.sfx);
            persist();
        },
    });
    /* The steer pad's rotated position depends on measuring the pedal
       cluster's real on-screen rect, but bindLayout() ran (and did its
       first layout pass) before the UI - and its pad/pedal elements -
       existed. Re-run the layout now that they're mounted so the pad is
       positioned correctly on the very first frame, not just after the
       next resize/orientation event. */
    orient.refresh();
    ui.bindTouch({
        steer: (v) => input.setSteerTouch(v),
        gas: (v) => input.setGas(v),
        brake: (v) => input.setBrake(v),
        hb: (v) => input.setHandbrake(v),
        nitro: (v) => input.setNitro(v),
    });
    ui.showTitle(save);
    audio.setVolumes(save.settings.music, save.settings.sfx);
    function ownedCar() {
        return save.owned.find((o) => o.id === save.selectedCar) ?? save.owned[0];
    }
    function startRace(mapId) {
        if (!isUnlocked(save, mapId))
            mapId = pendingMap;
        if (!isUnlocked(save, mapId))
            mapId = "sunset-strip";
        const map = mapById(mapId);
        pendingMap = map.id;
        save.lastMap = map.id;
        persist();
        race = makeRace(map);
        extrasUsed = 0;
        acc = 0;
        last = performance.now();
        mode = "play";
        renderer.resetFx(map);
        renderer.bakeMap();
        ui.showHud();
        ui.updateLights(race);
        audio.unlock();
        audio.lightRed();
        void tryLockLandscape();
    }
    function finishWin() {
        if (!race)
            return;
        mode = "results";
        const bonus = Math.floor(race.driftScore / 40) + race.lives * 25;
        const reward = race.map.coins + bonus;
        save.coins += reward;
        const prev = save.bestTime[race.map.id];
        if (!prev || race.time < prev)
            save.bestTime[race.map.id] = race.time;
        save.bestDrift[race.map.id] = Math.max(save.bestDrift[race.map.id] ?? 0, race.driftScore);
        const nxt = nextMapId(race.map.id);
        if (!save.unlocked.includes(nxt))
            save.unlocked.push(nxt);
        persist();
        audio.win();
        ui.hideLights();
        ui.showResults(true, race, reward, false);
    }
    function finishLose() {
        if (!race)
            return;
        mode = "results";
        audio.lose();
        ui.hideLights();
        ui.showResults(false, race, 0, extrasUsed < 3);
    }
    const onFirst = () => {
        audio.unlock();
        void tryLockLandscape();
        try {
            void document.documentElement.requestFullscreen?.();
        }
        catch {
            /* ignore */
        }
    };
    stage.addEventListener("pointerdown", onFirst, { once: true });
    window.addEventListener("keydown", onFirst, { once: true });
    function killAudio() {
        try { audio.engine(0, 0, 0); } catch {}
        try { audio.silence(); } catch {}
        try { audio.destroy(); } catch {}
    }
    function onHide() {
        persist();
        input.clearKeys();
        try { audio.engine(0, 0, 0); } catch {}
        try { audio.silence(); } catch {}
        if (mode === "play") {
            mode = "pause";
            ui.showPause();
        }
    }
    function onShow() {
        if (document.hidden) return;
        last = performance.now();
        acc = 0;
        orient.refresh();
        void tryLockLandscape();
    }
    const vis = () => {
        if (document.hidden)
            onHide();
        else
            onShow();
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", killAudio);
    window.addEventListener("freeze", killAudio);
    window.addEventListener("beforeunload", killAudio);
    window.addEventListener("pageshow", onShow);
    window.APEX_STOP_AUDIO = killAudio;
    const qa = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("qa");
    window.__controlsTest = {
        getYaw: () => race?.car.yaw ?? 0,
        getSpeed: () => race?.car.speed ?? 0,
        getU: () => race?.car.u ?? 0,
        getPlace: () => race?.place ?? 0,
        getGear: () => race?.gear ?? "N",
        getPos: () => (race ? { x: race.car.x, y: race.car.y } : { x: 0, y: 0 }),
        getRivals: () => race?.rivals.map((r) => ({ x: r.x, y: r.y, u: r.u, lap: r.lap, tAlong: r.tAlong })) ?? [],
        isDrifting: () => !!race?.car.drifting,
        setSteer: (v) => input.setInjectedSteer(v),
        setKeys: (codes) => input.setInjectedKeys(codes),
        skipLights: () => {
            if (race)
                skipLights(race);
        },
        isRacing: () => !!race?.racing,
    };
    function loop(now) {
        if (!running)
            return;
        if (rotationBlocked) {
            raf = requestAnimationFrame(loop);
            return;
        }
        const raw = Math.min(0.1, (now - last) / 1000);
        last = now;
        acc += raw;
        const act = input.sample();
        if (act.pause && mode === "play") {
            mode = "pause";
            ui.showPause();
        }
        else if (act.pause && mode === "pause") {
            mode = "play";
            ui.hidePause();
            ui.showHud();
        }
        if (act.camera && (mode === "play" || mode === "pause" || mode === "menu")) {
            renderer.cycleCamera();
        }
        if (mode === "play" && race) {
            if (qa && !race.racing)
                skipLights(race);
            while (acc >= FIXED_DT) {
                const { event } = stepRace(race, ownedCar(), act, FIXED_DT, save.settings.steer);
                if (event === "crash") {
                    audio.crash();
                    renderer.punch(0.7);
                    renderer.addSpark(race.car.x, race.car.y);
                }
                else if (event === "clash") {
                    audio.clash();
                    renderer.punch(0.45);
                    renderer.addSpark(race.clashX, race.clashY);
                }
                else if (event === "wall") {
                    renderer.punch(0.28);
                    if (race.clashImpact > 8)
                        renderer.addSpark(race.car.x, race.car.y);
                }
                else if (event === "red") {
                    audio.lightRed();
                }
                else if (event === "green") {
                    audio.lightGreen();
                }
                acc -= FIXED_DT;
            }
            if (race.finished)
                finishWin();
            else if (race.lost)
                finishLose();
            else {
                renderer.render(race, save.selectedCar, act.steer, raw, save.settings.shake, true);
                ui.updateHud(race);
                ui.updateLights(race);
                audio.engine(race.car.speed, act.throttle, race.car.slip);
            }
        }
        else {
            acc = 0;
            const previewMap = mapById(pendingMap);
            if (!race) {
                race = makeRace(previewMap);
                race.car.u = 18;
                skipLights(race);
            }
            if (mode === "menu") {
                const hit = closestOnTrack({ x: race.car.x, y: race.car.y }, race.map.points);
                const a = race.map.points[hit.idx];
                const b = race.map.points[(hit.idx + 1) % race.map.points.length];
                const desired = Math.atan2(-(b.x - a.x), b.y - a.y);
                const err = wrapAngle(desired - race.car.yaw);
                const ai = {
                    throttle: 0.72,
                    brake: 0,
                    steer: Math.max(-1, Math.min(1, err * 2.4)),
                    handbrake: Math.abs(err) > 0.55,
                    nitro: false,
                    pause: false,
                    camera: false,
                };
                while (acc >= FIXED_DT) {
                    stepCar(race, ownedCar(), ai, FIXED_DT, 1);
                    acc -= FIXED_DT;
                }
                renderer.render(race, save.selectedCar, ai.steer, raw, 0, false);
            }
            else if (race) {
                renderer.render(race, save.selectedCar, 0, raw, 0, mode === "pause");
            }
            audio.engine(0, 0, 0);
        }
        raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => {
        running = false;
        cancelAnimationFrame(raf);
        input.destroy();
        killAudio();
        orient.destroy();
        renderer.dispose();
        document.removeEventListener("visibilitychange", vis);
        window.removeEventListener("pagehide", persist);
        window.removeEventListener("pageshow", onShow);
        delete window.__controlsTest;
    };
}
