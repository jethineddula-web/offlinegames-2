// Small shared helpers.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dampAngle(a, b, k, dt) {
  return a + angleDiff(a, b) * (1 - Math.exp(-k * dt));
}

// Deterministic PRNG so the city is the same every visit.
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

// localStorage can throw (private mode, blocked storage) — never let it break the game.
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('webslinger:' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('webslinger:' + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
