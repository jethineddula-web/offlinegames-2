/* ============================================================
   levels.js  —  100 missions
   Levels 1-10 are hand-designed tutorials/set-pieces,
   11-100 are seeded-procedural with a tuned difficulty curve.
   ============================================================ */
'use strict';

const LEVELS = (function () {

  const ENVS = {
    day: {
      name: 'Clear Day',
      sunDir: [0.42, 0.78, 0.46], sunColor: [1.32, 1.20, 1.02],
      skyTop: [0.20, 0.42, 0.86], skyHorizon: [0.72, 0.83, 0.95],
      ambTop: [0.40, 0.46, 0.58], ambBot: [0.20, 0.20, 0.19],
      fogColor: [0.71, 0.80, 0.90], fogDensity: 0.0016,
      night: 0.0, clouds: 0.45, exposure: 1.0
    },
    morning: {
      name: 'Golden Morning',
      sunDir: [-0.62, 0.30, 0.60], sunColor: [1.55, 1.10, 0.72],
      skyTop: [0.26, 0.42, 0.75], skyHorizon: [0.98, 0.76, 0.52],
      ambTop: [0.42, 0.40, 0.46], ambBot: [0.22, 0.18, 0.16],
      fogColor: [0.88, 0.74, 0.60], fogDensity: 0.0026,
      night: 0.15, clouds: 0.5, exposure: 1.0
    },
    dusk: {
      name: 'Sunset Run',
      sunDir: [0.86, 0.14, -0.42], sunColor: [1.70, 0.82, 0.44],
      skyTop: [0.14, 0.20, 0.46], skyHorizon: [0.98, 0.52, 0.30],
      ambTop: [0.30, 0.28, 0.40], ambBot: [0.14, 0.12, 0.14],
      fogColor: [0.72, 0.46, 0.38], fogDensity: 0.0032,
      night: 0.55, clouds: 0.55, exposure: 1.05
    },
    night: {
      name: 'City Lights',
      sunDir: [-0.30, 0.62, 0.42], sunColor: [0.20, 0.24, 0.42],
      skyTop: [0.015, 0.022, 0.055], skyHorizon: [0.10, 0.11, 0.19],
      ambTop: [0.10, 0.12, 0.22], ambBot: [0.05, 0.05, 0.07],
      fogColor: [0.06, 0.07, 0.12], fogDensity: 0.0038,
      night: 1.0, clouds: 0.18, exposure: 1.25
    },
    overcast: {
      name: 'Overcast',
      sunDir: [0.30, 0.86, 0.22], sunColor: [0.72, 0.74, 0.78],
      skyTop: [0.52, 0.56, 0.62], skyHorizon: [0.72, 0.74, 0.77],
      ambTop: [0.50, 0.52, 0.56], ambBot: [0.26, 0.26, 0.27],
      fogColor: [0.70, 0.72, 0.75], fogDensity: 0.0042,
      night: 0.10, clouds: 0.95, exposure: 1.0
    },
    fog: {
      name: 'Heavy Fog',
      sunDir: [0.35, 0.72, 0.40], sunColor: [0.80, 0.80, 0.82],
      skyTop: [0.60, 0.62, 0.65], skyHorizon: [0.78, 0.79, 0.80],
      ambTop: [0.54, 0.55, 0.58], ambBot: [0.30, 0.30, 0.31],
      fogColor: [0.76, 0.77, 0.79], fogDensity: 0.0092,
      night: 0.18, clouds: 1.0, exposure: 1.0
    },
    storm: {
      name: 'Storm Front',
      sunDir: [-0.40, 0.55, -0.50], sunColor: [0.55, 0.56, 0.66],
      skyTop: [0.10, 0.12, 0.18], skyHorizon: [0.34, 0.35, 0.40],
      ambTop: [0.26, 0.28, 0.36], ambBot: [0.13, 0.13, 0.16],
      fogColor: [0.34, 0.36, 0.42], fogDensity: 0.0060,
      night: 0.62, clouds: 1.0, exposure: 1.12
    }
  };

  /* ------------------------------------------------------------------ */
  /*  PLACEMENT HELPERS  (run after the city exists)                     */
  /* ------------------------------------------------------------------ */

  function clearPoint(rng, opts) {
    const { PITCH } = WORLD.constants();
    const tries = opts.tries || 260;
    for (let i = 0; i < tries; i++) {
      let x, z, y;
      const mode = opts.mode;
      const span = opts.span;

      if (mode === 'street') {
        /* along a road corridor, low down between the buildings */
        const along = (rng() - 0.5) * span * 2;
        const idx = Math.round((rng() - 0.5) * (span / PITCH) * 2);
        const line = (idx - 0.5) * PITCH + (rng() - 0.5) * 6;
        if (rng() < 0.5) { x = line; z = along; } else { x = along; z = line; }
        y = 9 + rng() * 22;
      } else if (mode === 'canyon') {
        x = (rng() - 0.5) * span * 2;
        z = (rng() - 0.5) * span * 2;
        y = 25 + rng() * 55;
      } else if (mode === 'roof') {
        x = (rng() - 0.5) * span * 2;
        z = (rng() - 0.5) * span * 2;
        const h = WORLD.supportHeight(x, z);
        if (h < 12) continue;
        y = h + 6 + rng() * 12;
      } else if (mode === 'high') {
        x = (rng() - 0.5) * span * 2;
        z = (rng() - 0.5) * span * 2;
        y = 95 + rng() * 90;
      } else { /* mixed */
        x = (rng() - 0.5) * span * 2;
        z = (rng() - 0.5) * span * 2;
        y = 12 + rng() * 110;
      }

      if (opts.minR) {
        const d = Math.hypot(x, z);
        if (d < opts.minR) continue;
      }
      if (y < 6) continue;
      if (WORLD.isClear(x, y, z, opts.clearance || 9)) {
        return { x, y, z };
      }
    }
    /* fallback: straight up over the home pad */
    return { x: (rng() - 0.5) * 40, y: 120 + rng() * 40, z: (rng() - 0.5) * 40 };
  }

  function spreadPoints(rng, n, opts) {
    const pts = [];
    let guard = 0;
    while (pts.length < n && guard++ < n * 40) {
      const p = clearPoint(rng, opts);
      let ok = true;
      for (const q of pts) {
        if (Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < (opts.minSep || 42)) { ok = false; break; }
      }
      if (ok) pts.push(p);
    }
    while (pts.length < n) pts.push(clearPoint(rng, opts));
    return pts;
  }

  /* a chain of gates that snakes down a street corridor */
  function gateRoute(rng, n, span, alt) {
    const { PITCH } = WORLD.constants();
    const gates = [];
    const horizontal = rng() < 0.5;
    const idx = Math.round((rng() - 0.5) * 6);
    const line = (idx - 0.5) * PITCH;
    const start = -span, step = (span * 2) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      const along = start + step * i + (rng() - 0.5) * 8;
      const x = horizontal ? line + (rng() - 0.5) * 5 : along;
      const z = horizontal ? along : line + (rng() - 0.5) * 5;
      let y = alt + Math.sin(i * 0.9) * (alt * 0.28) + (rng() - 0.5) * 6;
      y = Math.max(11, y);
      /* lift the gate if a building is in the way */
      let guard = 0;
      while (!WORLD.isClear(x, y, z, 11) && guard++ < 30) y += 7;
      gates.push({ x, y, z, ry: horizontal ? Math.PI / 2 : 0, r: 9.5 });
    }
    return gates;
  }

  function pickLanding(rng, pads, preferRoof) {
    const list = pads.filter(p => preferRoof ? !p.home : true);
    if (!list.length) return pads[pads.length - 1];
    return list[(rng() * list.length) | 0];
  }

  /* ------------------------------------------------------------------ */
  /*  HAND-DESIGNED LEVELS 1 - 10                                        */
  /* ------------------------------------------------------------------ */

  const HAND = [
    {
      id: 1, name: 'First Lift-Off',
      brief: 'Press START ENGINE, raise the collective and collect the 3 markers hovering over the pad.',
      env: 'day', city: { seed: 101, radius: 6, downtown: 2, maxHeight: 95, helipadCount: 3 },
      timeLimit: 0, windMax: 0, fuelBurn: 0.6, reward: 120, tutorial: 'basic',
      plan(rng, city) {
        return {
          stars: [
            { x: 0, y: 22, z: -26 },
            { x: 24, y: 30, z: 0 },
            { x: 0, y: 38, z: 26 }
          ],
          gates: [], landing: null
        };
      }
    },
    {
      id: 2, name: 'Touch And Go',
      brief: 'Collect the markers, then set down gently on the home helipad. Keep your descent under 5 m/s.',
      env: 'day', city: { seed: 102, radius: 6, downtown: 2, maxHeight: 95, helipadCount: 3 },
      timeLimit: 0, windMax: 0, fuelBurn: 0.7, reward: 160, tutorial: 'landing',
      plan(rng, city) {
        return {
          stars: [
            { x: -40, y: 26, z: -40 }, { x: 44, y: 34, z: -18 }, { x: 10, y: 44, z: 48 }
          ],
          gates: [],
          landing: city.helipads.find(p => p.home)
        };
      }
    },
    {
      id: 3, name: 'Down The Avenue',
      brief: 'Stay low. Thread the whole avenue between the buildings and grab every marker.',
      env: 'day', city: { seed: 103, radius: 7, downtown: 3, maxHeight: 120, helipadCount: 4 },
      timeLimit: 150, windMax: 0, fuelBurn: 0.8, reward: 200,
      plan(rng, city) {
        const { PITCH } = WORLD.constants();
        const line = -0.5 * PITCH;
        const stars = [];
        for (let i = -3; i <= 3; i++) {
          let y = 15;
          const z = i * PITCH * 0.75;
          while (!WORLD.isClear(line, y, z, 9) && y < 90) y += 6;
          stars.push({ x: line, y, z });
        }
        return { stars, gates: [], landing: null };
      }
    },
    {
      id: 4, name: 'Rooftop Delivery',
      brief: 'Pick up the cargo markers, then land on the marked rooftop helipad.',
      env: 'morning', city: { seed: 104, radius: 7, downtown: 3, maxHeight: 130, helipadCount: 5 },
      timeLimit: 200, windMax: 0.4, fuelBurn: 0.9, reward: 240,
      plan(rng, city) {
        return {
          stars: spreadPoints(rng, 5, { mode: 'roof', span: 220, minSep: 55 }),
          gates: [],
          landing: pickLanding(rng, city.helipads, true)
        };
      }
    },
    {
      id: 5, name: 'Through The Rings',
      brief: 'Fly through all the rings in order, then collect the finish marker.',
      env: 'day', city: { seed: 105, radius: 7, downtown: 3, maxHeight: 130, helipadCount: 4 },
      timeLimit: 190, windMax: 0.4, fuelBurn: 0.9, reward: 280,
      plan(rng, city) {
        const gates = gateRoute(rng, 6, 240, 26);
        return { stars: spreadPoints(rng, 2, { mode: 'canyon', span: 200 }), gates, landing: null };
      }
    },
    {
      id: 6, name: 'Night Shift',
      brief: 'The city is lit up. Collect every marker before your fuel runs dry.',
      env: 'night', city: { seed: 106, radius: 8, downtown: 4, maxHeight: 160, helipadCount: 6 },
      timeLimit: 210, windMax: 0.5, fuelBurn: 1.15, reward: 320,
      plan(rng, city) {
        return { stars: spreadPoints(rng, 7, { mode: 'mixed', span: 260, minSep: 60 }), gates: [], landing: null };
      }
    },
    {
      id: 7, name: 'Canyon Run',
      brief: 'Weave between the towers. The markers sit deep in the concrete canyons.',
      env: 'overcast', city: { seed: 107, radius: 8, downtown: 5, maxHeight: 175, helipadCount: 5 },
      timeLimit: 230, windMax: 0.8, fuelBurn: 1.0, reward: 360,
      plan(rng, city) {
        return {
          stars: spreadPoints(rng, 8, { mode: 'canyon', span: 250, minSep: 52, clearance: 8 }),
          gates: gateRoute(rng, 4, 200, 34), landing: null
        };
      }
    },
    {
      id: 8, name: 'Fog Bank',
      brief: 'Visibility is down to nothing. Trust the compass arrow and fly carefully.',
      env: 'fog', city: { seed: 108, radius: 8, downtown: 4, maxHeight: 165, helipadCount: 6 },
      timeLimit: 250, windMax: 0.6, fuelBurn: 1.1, reward: 420,
      plan(rng, city) {
        return {
          stars: spreadPoints(rng, 7, { mode: 'mixed', span: 240, minSep: 62 }),
          gates: [],
          landing: pickLanding(rng, city.helipads, true)
        };
      }
    },
    {
      id: 9, name: 'Sunset Sprint',
      brief: 'A timed dash across the skyline. Beat the clock for a big bonus.',
      env: 'dusk', city: { seed: 109, radius: 9, downtown: 5, maxHeight: 185, helipadCount: 6 },
      timeLimit: 165, windMax: 0.9, fuelBurn: 1.2, reward: 480,
      plan(rng, city) {
        return {
          stars: spreadPoints(rng, 6, { mode: 'high', span: 300, minSep: 90 }),
          gates: gateRoute(rng, 6, 280, 60), landing: null
        };
      }
    },
    {
      id: 10, name: 'Storm Rescue',
      brief: 'Gale-force gusts. Collect all survivors’ markers and land on the rescue pad.',
      env: 'storm', city: { seed: 110, radius: 9, downtown: 5, maxHeight: 195, helipadCount: 7 },
      timeLimit: 260, windMax: 2.6, fuelBurn: 1.3, reward: 650, boss: true,
      plan(rng, city) {
        return {
          stars: spreadPoints(rng, 9, { mode: 'mixed', span: 280, minSep: 58 }),
          gates: gateRoute(rng, 4, 240, 40),
          landing: pickLanding(rng, city.helipads, true)
        };
      }
    }
  ];

  /* ------------------------------------------------------------------ */
  /*  PROCEDURAL LEVELS 11 - 100                                         */
  /* ------------------------------------------------------------------ */

  const NAMES_A = ['Steel', 'Neon', 'Concrete', 'Iron', 'Glass', 'Midnight', 'Crimson', 'Silver',
    'Harbor', 'Skyline', 'Tempest', 'Vertigo', 'Phantom', 'Copper', 'Granite', 'Aurora',
    'Cobalt', 'Vector', 'Zenith', 'Titan', 'Echo', 'Falcon', 'Onyx', 'Summit'];
  const NAMES_B = ['Descent', 'Corridor', 'Gauntlet', 'Circuit', 'Approach', 'Crosswind', 'Sweep',
    'Patrol', 'Extraction', 'Relay', 'Spiral', 'Passage', 'Drift', 'Ascent', 'Vigil',
    'Traverse', 'Cascade', 'Rush', 'Ledger', 'Beacon'];

  const MODES = ['mixed', 'canyon', 'street', 'roof', 'high'];

  function makeProcedural(id) {
    const rng = M.makeRng(id * 7919 + 13);
    const t = (id - 11) / 89;                 // 0 .. 1 difficulty ramp
    const tier = Math.floor((id - 1) / 10);   // 1..9

    const envPool = t < 0.15 ? ['day', 'morning', 'overcast']
      : t < 0.35 ? ['day', 'morning', 'dusk', 'overcast']
      : t < 0.6 ? ['dusk', 'night', 'overcast', 'fog', 'day']
      : t < 0.85 ? ['night', 'fog', 'storm', 'dusk']
      : ['storm', 'night', 'fog'];
    const env = envPool[(rng() * envPool.length) | 0];

    const radius = Math.round(7 + t * 5);
    const maxHeight = Math.round(110 + t * 135);
    const downtown = Math.round(3 + t * 4);

    const starCount = Math.round(5 + t * 11 + (rng() * 3));
    const gateCount = rng() < (0.35 + t * 0.4) ? Math.round(3 + t * 7) : 0;
    const needsLanding = rng() < (0.28 + t * 0.42);
    const mode = MODES[(rng() * MODES.length) | 0];

    const span = 150 + t * 260;
    const baseTime = starCount * 15 + gateCount * 9 + (needsLanding ? 35 : 0);
    const timeLimit = Math.round(baseTime * (1.45 - t * 0.42));
    const windMax = +(t * 2.9 * (0.35 + rng() * 0.9)).toFixed(2);
    const fuelBurn = +(0.85 + t * 0.75).toFixed(2);
    const reward = Math.round(220 + t * 1400 + starCount * 22 + gateCount * 16);

    const name = NAMES_A[(rng() * NAMES_A.length) | 0] + ' ' + NAMES_B[(rng() * NAMES_B.length) | 0];

    return {
      id, name,
      brief: (gateCount ? 'Clear every ring and collect ' : 'Collect ')
        + starCount + ' markers'
        + (needsLanding ? ', then put it down on the landing pad.' : '.')
        + (windMax > 1.4 ? ' Expect severe gusts.' : windMax > 0.7 ? ' Moderate crosswind.' : ''),
      env,
      city: {
        seed: 1000 + id * 37,
        radius, downtown, maxHeight,
        parkChance: 0.05 + rng() * 0.06,
        helipadCount: 4 + ((rng() * 6) | 0)
      },
      timeLimit, windMax, fuelBurn, reward,
      tier,
      boss: id % 10 === 0,
      plan(r, city) {
        const rr = M.makeRng(id * 104729 + 7);
        return {
          stars: spreadPoints(rr, starCount, {
            mode, span, minSep: Math.max(34, 70 - t * 26), clearance: 9
          }),
          gates: gateCount ? gateRoute(rr, gateCount, span * 0.9, 24 + t * 70) : [],
          landing: needsLanding ? pickLanding(rr, city.helipads, rr() < 0.75) : null
        };
      }
    };
  }

  /* ------------------------------------------------------------------ */

  const ALL = [];
  for (const h of HAND) ALL.push(h);
  for (let i = 11; i <= 100; i++) ALL.push(makeProcedural(i));

  /* make every mission name unique — the generator can collide */
  (function dedupe() {
    const used = new Set();
    for (const L of ALL) {
      if (!used.has(L.name)) { used.add(L.name); continue; }
      for (let a = 0; a < NAMES_A.length && used.has(L.name); a++) {
        for (let b = 0; b < NAMES_B.length; b++) {
          const cand = NAMES_A[(a + L.id) % NAMES_A.length] + ' ' + NAMES_B[(b + L.id) % NAMES_B.length];
          if (!used.has(cand)) { L.name = cand; break; }
        }
      }
      used.add(L.name);
    }
  })();

  function get(id) { return ALL[M.clamp(id, 1, 100) - 1]; }
  function env(key) { return ENVS[key] || ENVS.day; }

  /* star rating thresholds */
  function rate(level, stats) {
    /* stats = {time, damage, collected, total} */
    let s = 1;
    const noDamage = stats.damage < 8;
    const fast = level.timeLimit ? stats.time < level.timeLimit * 0.6 : stats.time < 90;
    if (noDamage || fast) s = 2;
    if (noDamage && fast) s = 3;
    return s;
  }

  return { ALL, get, env, ENVS, count: 100, rate, spreadPoints, gateRoute, clearPoint };
})();

if (typeof module !== 'undefined') module.exports = LEVELS;
