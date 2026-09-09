/* ============================================================
   shop.js  —  Save data, coin economy, hangar & upgrade shop
   ============================================================ */
'use strict';

const SAVE = (function () {

  const KEY = 'heliSim3D_save_v1';

  const DEFAULT = {
    coins: 300,
    heli: 'scout',
    owned: { scout: true },
    upgrades: { engine: 0, rotor: 0, aero: 0, tank: 0, armour: 0 },
    progress: {},              // levelId -> {stars, best}
    hints: 3,
    settings: { music: true, sfx: true, quality: 'auto', invertY: false, assist: true, keyHelp: true },
    unlockedMax: 1,
    totalStars: 0,
    lastPlayed: 1
  };

  let data = null;

  function load() {
    if (data) return data;
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? Object.assign({}, DEFAULT, JSON.parse(raw)) : JSON.parse(JSON.stringify(DEFAULT));
      data.settings = Object.assign({}, DEFAULT.settings, data.settings || {});
      data.upgrades = Object.assign({}, DEFAULT.upgrades, data.upgrades || {});
      data.owned = Object.assign({}, DEFAULT.owned, data.owned || {});
      data.progress = data.progress || {};
    } catch (e) {
      data = JSON.parse(JSON.stringify(DEFAULT));
    }
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { /* private mode */ }
  }

  function addCoins(n) { load().coins = Math.max(0, Math.round(load().coins + n)); save(); }
  function spend(n) {
    const d = load();
    if (d.coins < n) return false;
    d.coins -= n; save(); return true;
  }

  function recordLevel(id, stars, timeSec, coins) {
    const d = load();
    const p = d.progress[id] || { stars: 0, best: null };
    p.stars = Math.max(p.stars, stars);
    if (p.best === null || timeSec < p.best) p.best = Math.round(timeSec);
    d.progress[id] = p;
    d.unlockedMax = Math.max(d.unlockedMax, Math.min(100, id + 1));
    d.totalStars = Object.values(d.progress).reduce((a, b) => a + (b.stars || 0), 0);
    d.lastPlayed = id;
    if (coins) d.coins += coins;
    save();
    return p;
  }

  function isUnlocked(id) { return id <= load().unlockedMax; }
  function reset() { data = JSON.parse(JSON.stringify(DEFAULT)); save(); }

  return { load, save, addCoins, spend, recordLevel, isUnlocked, reset, get data() { return load(); } };
})();


const SHOP = (function () {

  const UPGRADES = [
    { key: 'engine', name: 'Turbine Power', icon: '⚙️', max: 5, base: 700, step: 1.65,
      desc: '+9% thrust and +5% top speed per level. Climb faster, carry more.' },
    { key: 'rotor', name: 'Rotor Head', icon: '🌀', max: 5, base: 620, step: 1.6,
      desc: '+7% control authority per level. Sharper cyclic and pedal response.' },
    { key: 'aero', name: 'Aerodynamics', icon: '💨', max: 5, base: 560, step: 1.6,
      desc: '-6% drag per level. Holds speed better through the canyons.' },
    { key: 'tank', name: 'Fuel Cells', icon: '⛽', max: 5, base: 480, step: 1.55,
      desc: '+18% fuel capacity per level. Longer missions, fewer restarts.' },
    { key: 'armour', name: 'Airframe Plating', icon: '🛡️', max: 5, base: 800, step: 1.7,
      desc: '+22% impact resistance per level. Survive the clumsy landings.' }
  ];

  const CONSUMABLES = [
    { key: 'hint3', name: '3 Hints', icon: '💡', price: 250,
      desc: 'Highlights the next marker with a guidance beam.', give: () => { SAVE.data.hints += 3; SAVE.save(); } },
    { key: 'hint10', name: '10 Hints', icon: '💡', price: 700,
      desc: 'Bulk pack. Best value.', give: () => { SAVE.data.hints += 10; SAVE.save(); } },
    { key: 'repair', name: 'Field Repair Kit', icon: '🔧', price: 300,
      desc: 'Instantly restores airframe integrity mid-mission (1 use).',
      give: () => { SAVE.data.repairKits = (SAVE.data.repairKits || 0) + 1; SAVE.save(); } },
    { key: 'fuelcan', name: 'Reserve Fuel', icon: '🛢️', price: 260,
      desc: 'Adds 40% fuel mid-mission (1 use).',
      give: () => { SAVE.data.fuelCans = (SAVE.data.fuelCans || 0) + 1; SAVE.save(); } }
  ];

  function upgradePrice(u) {
    const lv = SAVE.data.upgrades[u.key] || 0;
    return Math.round(u.base * Math.pow(u.step, lv));
  }

  function buyUpgrade(key) {
    const u = UPGRADES.find(x => x.key === key);
    if (!u) return { ok: false, msg: 'Unknown upgrade' };
    const lv = SAVE.data.upgrades[key] || 0;
    if (lv >= u.max) return { ok: false, msg: 'Already at maximum level' };
    const price = upgradePrice(u);
    if (!SAVE.spend(price)) return { ok: false, msg: 'Not enough coins' };
    SAVE.data.upgrades[key] = lv + 1;
    SAVE.save();
    return { ok: true, msg: u.name + ' → Lv ' + (lv + 1) };
  }

  function buyHeli(key) {
    const v = HELI.VARIANTS[key];
    if (!v) return { ok: false, msg: 'Unknown aircraft' };
    if (SAVE.data.owned[key]) return { ok: false, msg: 'Already in your hangar' };
    if (!SAVE.spend(v.price)) return { ok: false, msg: 'Not enough coins' };
    SAVE.data.owned[key] = true;
    SAVE.data.heli = key;
    SAVE.save();
    return { ok: true, msg: v.name + ' delivered to the hangar' };
  }

  function selectHeli(key) {
    if (!SAVE.data.owned[key]) return false;
    SAVE.data.heli = key; SAVE.save(); return true;
  }

  function buyConsumable(key) {
    const c = CONSUMABLES.find(x => x.key === key);
    if (!c) return { ok: false, msg: 'Unknown item' };
    if (!SAVE.spend(c.price)) return { ok: false, msg: 'Not enough coins' };
    c.give();
    return { ok: true, msg: c.name + ' added' };
  }

  return { UPGRADES, CONSUMABLES, upgradePrice, buyUpgrade, buyHeli, selectHeli, buyConsumable };
})();

if (typeof module !== 'undefined') module.exports = { SAVE, SHOP };
