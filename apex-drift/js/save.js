import { MAPS } from "./data.js";
import { SAVE_KEY, SAVE_VERSION } from "./types.js";
const FIRST_MAP = "sunset-strip";
const defaults = () => ({
    version: SAVE_VERSION,
    coins: 280,
    owned: [{ id: "hatch", engine: 0, tires: 0, chassis: 0, nitro: 0 }],
    selectedCar: "hatch",
    unlocked: [FIRST_MAP],
    bestTime: {},
    bestDrift: {},
    lastMap: FIRST_MAP,
    settings: { music: 0.55, sfx: 0.8, shake: 0.7, steer: 1 },
});
function sequentialUnlocks(bestTime) {
    const unlocked = new Set([FIRST_MAP]);
    for (let i = 0; i < MAPS.length - 1; i++) {
        const id = MAPS[i].id;
        if (bestTime[id]) {
            unlocked.add(id);
            unlocked.add(MAPS[i + 1].id);
        }
    }
    return [...unlocked];
}
function migrate(raw) {
    const base = defaults();
    const s = { ...base, ...raw };
    s.settings = { ...base.settings, ...raw.settings };
    s.owned = Array.isArray(raw.owned) && raw.owned.length ? raw.owned : base.owned;
    s.bestTime = raw.bestTime ?? {};
    s.bestDrift = raw.bestDrift ?? {};
    s.version = SAVE_VERSION;
    if (!s.lastMap)
        s.lastMap = FIRST_MAP;
    if ((raw.version ?? 0) < 3) {
        s.unlocked = sequentialUnlocks(s.bestTime);
    }
    else {
        s.unlocked = Array.isArray(raw.unlocked) && raw.unlocked.length ? raw.unlocked : base.unlocked;
    }
    if (!s.unlocked.includes(FIRST_MAP))
        s.unlocked.unshift(FIRST_MAP);
    if (!s.unlocked.includes(s.lastMap))
        s.lastMap = FIRST_MAP;
    return s;
}
export function isUnlocked(save, mapId) {
    return save.unlocked.includes(mapId);
}
export function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw)
            return defaults();
        const parsed = JSON.parse(raw);
        return migrate(parsed);
    }
    catch {
        return defaults();
    }
}
export function writeSave(data) {
    try {
        const blob = JSON.stringify({ ...data, version: SAVE_VERSION });
        localStorage.setItem(SAVE_KEY + ":bak", localStorage.getItem(SAVE_KEY) ?? "");
        localStorage.setItem(SAVE_KEY, blob);
    }
    catch {
        /* private mode / quota */
    }
}
