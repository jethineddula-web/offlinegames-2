/** Shop catalogue + save/progression state (localStorage backed). */

export const DRONES = [
  { id: "scout", name: "TRAINER 5″", desc: "Ducted 5-inch trainer quad. Balanced, forgiving, cheap to repair.", price: 0, color: 0xd7dde2, speed: 1.0, agility: 1.0, boost: 1.0, armor: 1.0, frame: "x" },
  { id: "vortex", name: "FREESTYLE 3″", desc: "Light 3-inch freestyle frame. Loose gimbals and razor yaw.", price: 900, color: 0x8cc63f, speed: 1.05, agility: 1.22, boost: 1.05, armor: 0.92, frame: "h" },
  { id: "raptor", name: "RACER 6S", desc: "6S X-class race frame. Straight-line monster, wide and heavy in corners.", price: 1800, color: 0xe8590c, speed: 1.2, agility: 0.92, boost: 1.25, armor: 1.0, frame: "delta" },
  { id: "phantom", name: "LONG RANGE 7″", desc: "7-inch long-range cruiser. Efficient props, low drag, thin shell.", price: 3200, color: 0x4a5560, speed: 1.26, agility: 1.16, boost: 1.15, armor: 0.8, frame: "ring" },
  { id: "titan", name: "CINE LIFTER", desc: "Heavy-lift cinema rig. Slow to turn, but it shrugs off impacts.", price: 4600, color: 0xd9a441, speed: 1.08, agility: 0.88, boost: 1.1, armor: 1.75, frame: "heavy" },
  { id: "singularity", name: "PROTOTYPE 8S", desc: "Works team prototype on 8S. Best of everything — if you can hold it.", price: 9000, color: 0x00b3a4, speed: 1.34, agility: 1.3, boost: 1.35, armor: 1.2, frame: "orb" },
];

export const UPGRADES = [
  { id: "speed", name: "Motor & Prop Set", desc: "+6% top speed per level", icon: "🚀", basePrice: 220, step: 1.65, max: 5 },
  { id: "handling", name: "Rate Profile Tune", desc: "+8% rotation rate per level", icon: "🎯", basePrice: 200, step: 1.6, max: 5 },
  { id: "boost", name: "Battery Pack (6S→8S)", desc: "+20% boost capacity per level", icon: "⚡", basePrice: 260, step: 1.7, max: 5 },
  { id: "shield", name: "Frame & Prop Guards", desc: "+1 hull segment per level", icon: "🛡️", basePrice: 300, step: 1.8, max: 5 },
];

export const ABILITIES = [
  { id: "surge", name: "Turbo Kick", desc: "Two seconds of over-revved motors — ignores drag.", icon: "💨", price: 750, cooldown: 9 },
  { id: "emp", name: "Shock Burst", desc: "Directional EMP that drops nearby drones and security turrets.", icon: "🌐", price: 1400, cooldown: 14 },
  { id: "cloak", name: "Signal Mask", desc: "Three seconds untrackable — nothing can lock onto you.", icon: "👻", price: 2400, cooldown: 20 },
  { id: "repair", name: "Repair Drone", desc: "Launches a repair drone that patches one hull segment.", icon: "🩹", price: 1900, cooldown: 25 },
];

/** Prop / strobe lighting packages. */
export const TRAILS = [
  { id: "ion", name: "Strobe White", price: 0, color: 0xf2f6ff, color2: 0xffffff },
  { id: "plasma", name: "Beacon Red", price: 400, color: 0xe23b2f, color2: 0xffd9b0 },
  { id: "ember", name: "Amber Marker", price: 650, color: 0xffab2e, color2: 0xffe6b0 },
  { id: "toxic", name: "Signal Green", price: 900, color: 0x53d769, color2: 0xe8ffd9 },
  { id: "void", name: "Smoke Trail", price: 1400, color: 0x9aa3ad, color2: 0xdfe5ea },
  { id: "prism", name: "Race Livery", price: 2600, color: 0xffc247, color2: 0xe23b2f },
];

const KEY = "dronepov.save.v1";

export const defaultSave = () => ({
  gems: 0,
  drone: "scout",
  trail: "ion",
  ownedDrones: ["scout"],
  ownedTrails: ["ion"],
  ownedAbilities: [],
  equippedAbility: null,
  upgrades: { speed: 0, handling: 0, boost: 0, shield: 0 },
  best: {},
  unlocked: 0,
  totalRuns: 0,
  settings: { volume: 0.8, music: 0.55, quality: "high", invertY: false, sensitivity: 1, tilt: false, shake: 1 },
});

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) },
      settings: { ...base.settings, ...(parsed.settings || {}) },
      best: parsed.best || {},
    };
  } catch {
    return defaultSave();
  }
}

export function persist(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

export function upgradePrice(u, level) {
  return Math.round(u.basePrice * Math.pow(u.step, level));
}

/** Combines drone spec + purchased upgrades into final flight stats. */
export function computeStats(save) {
  const d = DRONES.find((x) => x.id === save.drone) || DRONES[0];
  const u = save.upgrades;
  return {
    drone: d,
    speed: d.speed * (1 + u.speed * 0.06),
    agility: d.agility * (1 + u.handling * 0.08),
    boostTank: 100 * d.boost * (1 + u.boost * 0.2),
    hull: Math.max(1, Math.round(3 * d.armor + u.shield)),
    ability: save.equippedAbility,
    trail: TRAILS.find((t) => t.id === save.trail) || TRAILS[0],
  };
}
