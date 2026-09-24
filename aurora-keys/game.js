/* Aurora Keys — 3-lane rhythm. Keys: A S D or ← ↓ → */
(() => {
  const LANE_COUNT = 3;
  const KEY_LANES = {
    KeyA: 0, KeyS: 1, KeyD: 2,
    ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2,
  };
  const LANE_LABELS = ["A", "S", "D"];
  const LANE_ARROWS = ["←", "↓", "→"];
  const COUNTDOWN_BEATS = 3;
  const MAX_LIVES = 3;
  const METER_MAX = 100;
  const PARTICLE_CAP = 220;
  const SAVE_KEY = "aurora-keys-save";

  const TRACKS = [
    { id: "northern-drift", title: "Northern Drift", subtitle: "Easier — speeds up the longer you last", difficulty: "easy", bpm: 122, durationBeats: 80, theme: "drift", seed: 0x4a7c11, baseMidi: 60, scale: [0, 3, 5, 7, 10, 12, 15] },
    { id: "ember-veil", title: "Ember Veil", subtitle: "Medium — faster tiles, fewer gaps", difficulty: "medium", bpm: 138, durationBeats: 96, theme: "veil", seed: 0x91d02e, baseMidi: 57, scale: [0, 2, 3, 5, 7, 8, 10, 12] },
    { id: "ion-storm", title: "Ion Storm", subtitle: "Harder — dense and fast from the start", difficulty: "hard", bpm: 168, durationBeats: 112, theme: "storm", seed: 0xc3e45a, baseMidi: 64, scale: [0, 2, 3, 5, 7, 9, 10, 12] },
    { id: "endless-night", title: "Endless Night", subtitle: "Endless — keep going until you miss out", difficulty: "endless", bpm: 128, durationBeats: 1_000_000, theme: "void", seed: 0x77aa01, baseMidi: 62, scale: [0, 3, 5, 7, 10, 12, 14, 15] },
  ];

  const THEMES = {
    drift: { top: "#1a0a48", mid: "#2a1a78", bottom: "#0a3d6a", accent: "#7ee7ff", accent2: "#c4b5ff", tile: "#12121c", tileEdge: "#7ee7ff" },
    veil: { top: "#2a0848", mid: "#4a1480", bottom: "#0a3860", accent: "#ff7ae9", accent2: "#7ee7ff", tile: "#141018", tileEdge: "#ff9af0" },
    storm: { top: "#120428", mid: "#2a0a5c", bottom: "#061830", accent: "#b794ff", accent2: "#5ef0ff", tile: "#100e18", tileEdge: "#c4b5ff" },
    void: { top: "#08041a", mid: "#1a0a40", bottom: "#041828", accent: "#5ef0ff", accent2: "#ff4fd8", tile: "#0e0c16", tileEdge: "#7ee7ff" },
  };

  const DIFF_LABEL = { easy: "Easier", medium: "Medium", hard: "Harder", endless: "Endless" };
  const DEFAULT_SETTINGS = { master: 0.85, music: 0.55, sfx: 0.85, shake: true, haptics: true };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function generateChart(track, extraSeed = 0) {
    const rng = mulberry32(track.seed ^ extraSeed);
    const notes = [];
    const occ = Array.from({ length: LANE_COUNT }, () => 0);
    const diff = track.difficulty;
    const intro = 4;
    const outro = diff === "endless" ? 0 : 8;
    const end = track.durationBeats - outro;
    const grid = diff === "easy" ? 0.5 : 0.5;
    const gap = diff === "easy" ? 0.36 : diff === "medium" ? 0.28 : diff === "hard" ? 0.2 : 0.26;
    const restChance = diff === "easy" ? 0.12 : diff === "medium" ? 0.1 : diff === "hard" ? 0.06 : 0.12;
    const doubleChance = diff === "easy" ? 0.08 : diff === "medium" ? 0.14 : diff === "hard" ? 0.22 : 0.1;
    const holdChance = diff === "easy" ? 0.2 : diff === "medium" ? 0.22 : diff === "hard" ? 0.2 : 0.18;
    const novaChance = 0.06;
    const TAP_OCCUPY = 0.5;
    let lastLane = 1;
    let id = 1;
    let beat = intro;
    const snap = (b) => Math.round(b / grid) * grid;
    const occupyBeats = (type, holdBeats) => (type === "hold" ? holdBeats : TAP_OCCUPY);
    const canPlace = (lane, at, len) => occ[lane] <= at + 0.001 && at + len <= end + 0.01;
    const pickFree = (avoid) => {
      const free = [];
      for (let l = 0; l < LANE_COUNT; l++) {
        if (avoid != null && l === avoid) continue;
        if (occ[l] <= beat + 0.001) free.push(l);
      }
      if (!free.length) return null;
      if (diff === "easy") {
        const near = free.filter((l) => Math.abs(l - lastLane) <= 1);
        const pool = near.length ? near : free;
        return pool[Math.floor(rng() * pool.length)];
      }
      return free[Math.floor(rng() * free.length)];
    };
    const place = (lane, type, holdBeats) => {
      const degree = Math.floor(beat * 2 + lane) % track.scale.length;
      const octave = lane === 0 || lane === LANE_COUNT - 1 ? 12 : 0;
      notes.push({
        id: id++, beat, lane, type, holdBeats,
        freq: midiToFreq(track.baseMidi + track.scale[degree] + octave),
        judged: false, hit: false, holding: false, holdReleased: false, judgment: null,
      });
      occ[lane] = beat + occupyBeats(type, holdBeats) + gap + (type === "hold" ? 1.4 : 0);
      lastLane = lane;
    };
    while (beat < end) {
      beat = snap(beat);
      const cycle = Math.floor(Math.max(0, beat) / 32);
      const rest = diff === "endless" ? restChance * Math.max(0.35, 1 - cycle * 0.12) : restChance;
      if (rng() < rest) { beat += grid; continue; }
      const lane = pickFree();
      if (lane == null) { beat += grid; continue; }
      let type = "tap";
      let holdBeats = 0;
      if (rng() < holdChance && occ[lane] <= beat - 0.8) {
        const veryBig = rng() < 0.35;
        let hold = veryBig ? (rng() < 0.55 ? 3 : 4) : diff === "easy" ? 2 : rng() < 0.45 ? 1.5 : 2;
        hold = Math.max(grid * 2, snap(hold));
        if (canPlace(lane, beat, hold)) { type = "hold"; holdBeats = hold; }
      } else if (rng() < novaChance) type = "nova";
      const len = occupyBeats(type, holdBeats);
      if (!canPlace(lane, beat, len)) { beat += grid; continue; }
      place(lane, type, holdBeats);
      const denserDouble = diff === "endless" ? doubleChance + Math.min(0.12, cycle * 0.03) : doubleChance;
      if (rng() < denserDouble) {
        const other = pickFree(lane);
        if (other != null && canPlace(other, beat, TAP_OCCUPY) && type !== "hold") {
          place(other, rng() < novaChance ? "nova" : "tap", 0);
        }
      }
      beat += grid;
    }
    notes.sort((a, b) => a.beat - b.beat || a.lane - b.lane);
    return notes;
  }

  function approachFor(track, beat) {
    const t = Math.max(0, beat) / 20;
    if (track.difficulty === "easy") return Math.max(3.2, 5.5 - t * 0.16);
    if (track.difficulty === "medium") return Math.max(2.9, 4.9 - t * 0.19);
    if (track.difficulty === "hard") return Math.max(2.5, 4.1 - t * 0.24);
    return Math.max(2.7, 5.2 - t * 0.2);
  }
  function bpmFor(track, beat) {
    const t = Math.max(0, beat) / 20;
    if (track.difficulty === "easy") return Math.min(170, track.bpm + t * 5);
    if (track.difficulty === "medium") return Math.min(188, track.bpm + t * 6.5);
    if (track.difficulty === "hard") return Math.min(205, track.bpm + t * 8);
    return Math.min(196, track.bpm + t * 7);
  }
  const noteProgress = (note, beat, approach) => 1 - (note.beat - beat) / approach;
  const holdTailProgress = (note, beat, approach) => 1 - (note.beat + note.holdBeats - beat) / approach;
  const comboMult = (combo) => 1 + Math.min(3, Math.floor(combo / 10) * 0.15);

  function judgeProgress(p, approach) {
    // Windows are centered on the hit line (p=1) and deliberately NOT wide
    // enough to cover the whole fall — a note can only be scored once it's
    // genuinely near the line. Presses earlier than this are silently
    // ignored (see tapLane's `upcoming` check) rather than penalized, so
    // there's no reward for holding/mashing every lane the instant a tile
    // spawns.
    if (p >= 0.82 && p <= 1.14) return "perfect";
    if (p >= 0.45 && p <= 1.28) return "great";
    if (p >= 0.16 && p <= 1.45) return "good";
    return null;
  }

  function createSession(track, ctxTime, extraSeed = 0) {
    const notes = generateChart({ ...track, durationBeats: 80 }, extraSeed);
    return {
      track, notes, phase: "countdown", endReason: null, startCtxTime: ctxTime, pauseCtxTime: 0,
      beat: -COUNTDOWN_BEATS, bpm: track.bpm, approachBeats: approachFor(track, 0),
      score: 0, combo: 0, maxCombo: 0, lives: MAX_LIVES, meter: 0, burstReady: false, burstUntilBeat: -1,
      stats: { perfect: 0, great: 0, good: 0, miss: 0 }, totalNotes: notes.length, judgedCount: 0,
      floaters: [], particles: [], ripples: [], trauma: 0, flash: 0, burstFlash: 0,
      lastHitLane: null, lastHitAge: 1, floaterId: 1,
      heldLanes: [false, false, false], continueUsed: false,
      endlessChunkUntil: 64, extraSeed,
    };
  }

  function spawnParticles(s, x, y, color, n, spark = false) {
    const count = Math.min(n, PARTICLE_CAP - s.particles.length);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = spark ? 80 + Math.random() * 220 : 40 + Math.random() * 140;
      s.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, maxLife: 0.28 + Math.random() * 0.35, size: spark ? 2 + Math.random() * 2.5 : 1.5 + Math.random() * 3, color, spark });
    }
  }
  function addFloater(s, kind, lane, score) {
    s.floaters.push({ id: s.floaterId++, kind, lane, x: 0, y: 0, age: 0, score });
    if (s.floaters.length > 12) s.floaters.shift();
  }
  function applyHit(s, note, kind, x, y) {
    note.judged = true; note.hit = true; note.judgment = kind;
    s.judgedCount += 1; s.stats[kind] += 1; s.combo += 1;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    const base = kind === "perfect" ? 300 : kind === "great" ? 200 : 100;
    const nova = note.type === "nova" ? 2 : 1;
    const burst = s.beat < s.burstUntilBeat ? 2 : 1;
    const gained = Math.round(base * comboMult(s.combo) * nova * burst);
    s.score += gained;
    const meterGain = kind === "perfect" ? 6 : kind === "great" ? 4 : 2;
    s.meter = Math.min(METER_MAX, s.meter + meterGain * (note.type === "nova" ? 1.5 : 1));
    if (s.meter >= METER_MAX) s.burstReady = true;
    s.lastHitLane = note.lane; s.lastHitAge = 0;
    addFloater(s, kind, note.lane, gained);
    const color = note.type === "nova" ? "#ffe08a" : kind === "perfect" ? "#7ee7ff" : "#c4b5ff";
    spawnParticles(s, x, y, color, kind === "perfect" || note.type === "nova" ? 18 : 10, true);
    s.ripples.push({ x, y, age: 0, maxAge: 0.35, color });
    if (s.ripples.length > 10) s.ripples.shift();
    if (kind === "perfect") s.flash = Math.min(1, s.flash + 0.18);
  }
  function applyMiss(s, note, lane) {
    if (note) { note.judged = true; note.hit = false; note.judgment = "miss"; s.judgedCount += 1; }
    s.stats.miss += 1; s.combo = 0; s.meter = Math.max(0, s.meter - 18);
    s.burstReady = s.meter >= METER_MAX; s.lives -= 1;
    s.trauma = Math.min(1, s.trauma + 0.55); s.flash = 0.5;
    addFloater(s, "miss", lane, 0);
    if (s.lives <= 0) { s.phase = "ended"; s.endReason = "fail"; }
  }
  function tapLane(s, lane, down, hitX, hitY) {
    if (s.phase !== "playing") return { kind: "ignore", note: null };
    s.heldLanes[lane] = down;
    if (!down) {
      for (const n of s.notes) {
        if (n.lane !== lane || n.type !== "hold" || !n.holding || n.judged) continue;
        const held = s.beat - (n.holdStartBeat != null ? n.holdStartBeat : n.beat);
        const frac = Math.min(1, held / Math.max(0.35, n.holdBeats));
        n.holding = false; n.holdReleased = true;
        applyHit(s, n, frac >= 0.85 ? "perfect" : frac >= 0.45 ? "great" : "good", hitX, hitY);
        return { kind: n.judgment ?? "good", note: n };
      }
      return { kind: "ignore", note: null };
    }
    // Find the best candidate note in this lane: the closest one to its
    // judge point that has not yet been judged. Any not-yet-missed note
    // still approaching in this lane means the press should never be
    // punished as an "empty lane" tap — it just doesn't count yet.
    let best = null, bestDist = 99, upcoming = false;
    for (const n of s.notes) {
      if (n.lane !== lane || n.judged) continue;
      const p = noteProgress(n, s.beat, s.approachBeats);
      if (p < 1.5) upcoming = true;
      if (p < 0.16 || p > 1.45) continue;
      const dist = Math.abs(1 - p);
      if (dist < bestDist) { bestDist = dist; best = n; }
    }
    if (!best) {
      return { kind: "ignore", note: null };
    }
    const p = noteProgress(best, s.beat, s.approachBeats);
    const kind = judgeProgress(p, s.approachBeats);
    if (!kind) { applyMiss(s, best, lane); return { kind: "miss", note: best }; }
    if (best.type === "hold") {
      best.holding = true; best.holdStartBeat = s.beat;
      s.combo += 1; s.maxCombo = Math.max(s.maxCombo, s.combo);
      spawnParticles(s, hitX, hitY, "#7ee7ff", 8, true);
      return { kind, note: best };
    }
    applyHit(s, best, kind, hitX, hitY);
    return { kind, note: best };
  }
  function triggerBurst(s, layoutHitY, laneCenters) {
    if (!s.burstReady || s.phase !== "playing") return false;
    s.burstReady = false; s.meter = 0; s.burstUntilBeat = s.beat + 8; s.burstFlash = 1;
    s.trauma = Math.min(1, s.trauma + 0.25);
    for (const n of s.notes) {
      if (n.judged) continue;
      const p = noteProgress(n, s.beat, s.approachBeats);
      if (p >= 0.48 && p <= 1.2) applyHit(s, n, "perfect", laneCenters[n.lane] ?? 0, layoutHitY);
    }
    return true;
  }
  function ageVfx(s, dt) {
    for (const p of s.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; p.vx *= 0.98; }
    s.particles = s.particles.filter((p) => p.life < p.maxLife);
    for (const r of s.ripples) r.age += dt;
    s.ripples = s.ripples.filter((r) => r.age < r.maxAge);
    for (const f of s.floaters) f.age += dt;
    s.floaters = s.floaters.filter((f) => f.age < 0.7);
  }
  function updateSession(s, dt, ctxTime) {
    if (s.phase === "paused" || s.phase === "ended") {
      s.trauma = Math.max(0, s.trauma - dt * 2.4);
      s.flash = Math.max(0, s.flash - dt * 2.2);
      s.burstFlash = Math.max(0, s.burstFlash - dt * 1.6);
      ageVfx(s, dt);
      return;
    }
    s.bpm = bpmFor(s.track, Math.max(0, s.beat));
    s.beat = (ctxTime - s.startCtxTime) * (s.bpm / 60) - COUNTDOWN_BEATS;
    s.approachBeats = approachFor(s.track, s.beat);
    if (s.phase === "countdown" && s.beat >= 0) s.phase = "playing";
    if (s.phase === "playing") {
      for (const n of s.notes) {
        if (n.judged) continue;
        if (n.type === "hold" && n.holding) {
          const tailP = holdTailProgress(n, s.beat, s.approachBeats);
          if (tailP > 1.05) { n.holding = false; applyHit(s, n, "perfect", 0, 0); continue; }
        }
        const p = noteProgress(n, s.beat, s.approachBeats);
        if (p > 1.4 && !(n.type === "hold" && n.holding)) {
          applyMiss(s, n, n.lane);
          if (s.lives <= 0) break;
        }
      }
    }
    if (s.phase === "playing" && s.beat > s.endlessChunkUntil - 24) {
      const more = generateChart({ ...s.track, durationBeats: s.endlessChunkUntil + 80, seed: s.track.seed }, s.extraSeed + s.endlessChunkUntil)
        .filter((n) => n.beat >= s.endlessChunkUntil - 4);
      const id0 = s.notes.length + 1;
      more.forEach((n, i) => { n.id = id0 + i; });
      s.notes.push(...more);
      s.totalNotes = s.notes.length;
      s.endlessChunkUntil += 64;
    }
    /* Runs keep going until lives run out. Speed ramps in approachFor/bpmFor. */
    s.trauma = Math.max(0, s.trauma - dt * 2.2);
    s.flash = Math.max(0, s.flash - dt * 2.4);
    s.burstFlash = Math.max(0, s.burstFlash - dt * 1.5);
    s.lastHitAge += dt;
    ageVfx(s, dt);
  }
  function accuracyOf(s) {
    const total = s.stats.perfect + s.stats.great + s.stats.good + s.stats.miss;
    if (total === 0) return 1;
    return (s.stats.perfect + s.stats.great * 0.75 + s.stats.good * 0.4) / total;
  }
  function starsForAccuracy(acc, failed) {
    if (failed) return 0;
    if (acc >= 0.96) return 3;
    if (acc >= 0.85) return 2;
    if (acc >= 0.7) return 1;
    return 0;
  }

  /* ---------- audio ---------- */
  const audio = {
    ctx: null, master: null, music: null, sfx: null, noise: null,
    settings: { ...DEFAULT_SETTINGS }, playing: false, backingTimer: null, nextBeatTime: 0, beatIndex: 0, track: null,
    unlock() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx({ latencyHint: "interactive" });
        this.master = this.ctx.createGain();
        this.music = this.ctx.createGain();
        this.sfx = this.ctx.createGain();
        this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination);
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = buf;
        this.applySettings(this.settings);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    },
    now() { return this.ctx?.currentTime ?? 0; },
    applySettings(s) {
      this.settings = s;
      if (!this.master) return;
      const t = this.now();
      this.master.gain.setTargetAtTime(s.master * s.master, t, 0.03);
      this.music.gain.setTargetAtTime(s.music * s.music, t, 0.03);
      this.sfx.gain.setTargetAtTime(s.sfx * s.sfx, t, 0.03);
    },
    envGain(peak, attack, decay, when) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
      return g;
    },
    playHit(freq, kind) {
      if (!this.ctx || !this.sfx) return;
      const t = this.ctx.currentTime;
      const f = freq * (1 + (Math.random() * 2 - 1) * 0.012);
      const osc = this.ctx.createOscillator();
      osc.type = kind === "nova" ? "square" : "triangle";
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.18);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(kind === "perfect" || kind === "nova" ? 4200 : 2400, t);
      const peak = kind === "nova" ? 0.22 : kind === "perfect" ? 0.18 : kind === "great" ? 0.14 : 0.1;
      const g = this.envGain(peak, 0.005, kind === "nova" ? 0.35 : 0.22, t);
      osc.connect(filter); filter.connect(g); g.connect(this.sfx);
      osc.start(t); osc.stop(t + 0.4);
    },
    playMiss() {
      if (!this.ctx || !this.sfx || !this.noise) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.setValueAtTime(180, t); filter.Q.value = 0.6;
      const g = this.envGain(0.22, 0.002, 0.18, t);
      src.connect(filter); filter.connect(g); g.connect(this.sfx);
      src.start(t); src.stop(t + 0.22);
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth"; osc.frequency.setValueAtTime(90, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      const og = this.envGain(0.08, 0.002, 0.16, t);
      osc.connect(og); og.connect(this.sfx); osc.start(t); osc.stop(t + 0.2);
    },
    playBurst() {
      if (!this.ctx || !this.sfx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = "sine"; osc.frequency.setValueAtTime(220, t); osc.frequency.exponentialRampToValueAtTime(880, t + 0.28);
      const g = this.envGain(0.2, 0.01, 0.4, t);
      osc.connect(g); g.connect(this.sfx); osc.start(t); osc.stop(t + 0.45);
    },
    playUi(kind) {
      if (!this.ctx || !this.sfx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      const f = kind === "start" ? 392 : 520;
      osc.frequency.setValueAtTime(f, t);
      if (kind === "start") osc.frequency.exponentialRampToValueAtTime(784, t + 0.18);
      const g = this.envGain(kind === "tap" ? 0.06 : 0.12, 0.004, 0.14, t);
      osc.connect(g); g.connect(this.sfx); osc.start(t); osc.stop(t + 0.22);
    },
    startBacking(track) {
      this.stopBacking();
      if (!this.ctx) return;
      this.track = track; this.playing = true; this.beatIndex = 0; this.nextBeatTime = this.ctx.currentTime + 0.05;
      this.scheduler();
    },
    stopBacking() {
      this.playing = false;
      if (this.backingTimer != null) { clearTimeout(this.backingTimer); this.backingTimer = null; }
    },
    scheduler: null,
    // Full procedural backing "song": kick+snare backbeat, hats, a chord
    // progression that changes every measure, a walking bassline that
    // follows the chords, and a light arpeggiated lead melody on the
    // off-beats — instead of just a bass note + occasional stab.
    scheduleBeat(idx, when, beatDur) {
      const ctx = this.ctx, music = this.music;
      const eighth = idx, beat = Math.floor(eighth / 2), isDown = eighth % 2 === 0, bar = beat % 4;
      const track = this.track;
      const scaleLen = track.scale.length;

      // Simple I - V - vi - IV style progression using scale degree
      // indices, wrapped to whatever length this track's scale is.
      const progression = [0, 4 % scaleLen, 5 % scaleLen, 3 % scaleLen];
      const measure = Math.floor(beat / 4);
      const chordBase = progression[measure % progression.length];
      const rootDeg = track.scale[chordBase % scaleLen];
      const thirdDeg = track.scale[(chordBase + 2) % scaleLen];
      const fifthDeg = track.scale[(chordBase + 4) % scaleLen];

      // Kick: beats 1 & 3 of the bar
      if (isDown && (bar === 0 || bar === 2)) {
        const osc = ctx.createOscillator();
        osc.type = "sine"; osc.frequency.setValueAtTime(150, when); osc.frequency.exponentialRampToValueAtTime(42, when + 0.12);
        const g = this.envGain(0.28, 0.002, 0.16, when);
        osc.connect(g); g.connect(music); osc.start(when); osc.stop(when + 0.2);
      }
      // Snare backbeat: beats 2 & 4
      if (isDown && (bar === 1 || bar === 3)) {
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.setValueAtTime(1500, when); filter.Q.value = 0.9;
        const g = this.envGain(0.16, 0.001, 0.09, when);
        src.connect(filter); filter.connect(g); g.connect(music); src.start(when); src.stop(when + 0.12);
        const tone = ctx.createOscillator(); tone.type = "triangle"; tone.frequency.setValueAtTime(190, when);
        const tg = this.envGain(0.05, 0.001, 0.07, when);
        tone.connect(tg); tg.connect(music); tone.start(when); tone.stop(when + 0.09);
      }
      // Hats: every eighth note
      {
        const src = ctx.createBufferSource(); src.buffer = this.noise;
        const filter = ctx.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = 7000;
        const g = this.envGain(isDown ? 0.03 : 0.05, 0.001, 0.04, when);
        src.connect(filter); filter.connect(g); g.connect(music); src.start(when); src.stop(when + 0.06);
      }
      // Walking bassline: root on beat 1, alternates toward the fifth
      // through the bar, following the current chord.
      if (isDown) {
        const useFifth = bar === 2 || bar === 3;
        const deg = useFifth ? fifthDeg : rootDeg;
        const freq = midiToFreq(track.baseMidi - 24 + deg);
        const osc = ctx.createOscillator(); osc.type = "triangle"; osc.frequency.setValueAtTime(freq, when);
        const g = this.envGain(0.12, 0.01, beatDur * 0.7, when);
        const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.setValueAtTime(520, when);
        osc.connect(filter); filter.connect(g); g.connect(music); osc.start(when); osc.stop(when + beatDur);
      }
      // Chord pad: sustained triad, re-voiced once per measure to follow
      // the progression above.
      if (isDown && bar === 0) {
        for (const deg of [rootDeg, thirdDeg, fifthDeg]) {
          const freq = midiToFreq(track.baseMidi - 12 + deg);
          const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(freq, when);
          const g = this.envGain(0.045, 0.04, beatDur * 3.2, when);
          osc.connect(g); g.connect(music); osc.start(when); osc.stop(when + beatDur * 3.6);
        }
      }
      // Lead melody: a light arpeggio on the off-beats, one octave up,
      // so there's an actual tune riding on top of the rhythm section.
      if (!isDown) {
        const arp = [rootDeg, thirdDeg, fifthDeg, thirdDeg];
        const step = (eighth >> 1) % arp.length;
        const deg = arp[(step + (bar % 2)) % arp.length];
        const freq = midiToFreq(track.baseMidi + 12 + deg);
        const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(freq, when);
        const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.setValueAtTime(2600, when);
        const g = this.envGain(0.05, 0.006, beatDur * 0.55, when);
        osc.connect(filter); filter.connect(g); g.connect(music); osc.start(when); osc.stop(when + beatDur * 0.6);
      }
    },
  };
  audio.scheduler = function scheduler() {
    if (!audio.playing || !audio.ctx || !audio.track) return;
    const beatDur = 60 / audio.track.bpm;
    while (audio.nextBeatTime < audio.ctx.currentTime + 0.12) {
      audio.scheduleBeat(audio.beatIndex, audio.nextBeatTime, beatDur);
      audio.beatIndex += 1;
      audio.nextBeatTime += beatDur / 2;
    }
    audio.backingTimer = window.setTimeout(audio.scheduler, 40);
  };

  /* ---------- render ---------- */
  function computeLayout(w, h) {
    const botW = Math.min(w * 0.96, h * 0.72, 600);
    const topW = botW * 0.5;
    const topY = h * 0.08, hitY = h * 0.76, bottomY = h * 0.97, cx = w / 2;
    return { w, h, cx, topY, hitY, bottomY, topW, botW };
  }
  function widthAt(layout, y) {
    const t = (y - layout.topY) / (layout.bottomY - layout.topY);
    const k = Math.max(0, Math.min(1, t));
    const p = k * k * (3 - 2 * k);
    return layout.topW + (layout.botW - layout.topW) * p;
  }
  function laneBounds(layout, lane, y) {
    const width = widthAt(layout, y);
    const left = layout.cx - width / 2;
    const laneW = width / LANE_COUNT;
    const l = left + lane * laneW;
    const pad = laneW * 0.11;
    return { left: l + pad, right: l + laneW - pad, mid: l + laneW / 2 };
  }
  function progressToY(layout, p) {
    const k = Math.max(-0.2, Math.min(1.4, p));
    const eased = k < 0 ? k * 0.45 : Math.pow(k, 1.16);
    return layout.topY + (layout.hitY - layout.topY) * eased;
  }
  function visualLengthBeats(note, approach) {
    if (note.type === "hold") return Math.max(1.2, note.holdBeats);
    if (note.type === "nova") return Math.min(0.58, approach * 0.09);
    return Math.min(0.46, approach * 0.072);
  }
  function laneAtPoint(layout, x, y) {
    if (y < layout.topY || y > layout.bottomY) return null;
    const width = widthAt(layout, y);
    const left = layout.cx - width / 2;
    const t = (x - left) / width;
    if (t < 0 || t > 1) return null;
    return Math.min(LANE_COUNT - 1, Math.max(0, Math.floor(t * LANE_COUNT)));
  }
  function hexAlpha(hex, a) {
    const h = hex.replace("#", "");
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
  }
  function fillQuad(ctx, x0, y0, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath();
  }
  function renderFrame(ctx, s, layout, time, showKeys, reduced) {
    const theme = THEMES[s.track.theme];
    const intensity = Math.min(1, s.combo / 40) + s.burstFlash * 0.5;
    const { w, h, topY, bottomY, hitY } = layout;
    ctx.save();
    if (!reduced && s.trauma > 0) {
      const mag = 10 * s.trauma * s.trauma;
      ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, theme.top); g.addColorStop(0.45, theme.mid); g.addColorStop(1, theme.bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const phase = time * (0.12 + i * 0.03) + i * 1.7;
      ctx.beginPath();
      const yBase = h * (0.08 + i * 0.12);
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= w; x += 12) {
        ctx.lineTo(x, yBase + Math.sin(x * 0.008 + phase) * (28 + i * 10) * (0.6 + intensity) + Math.sin(x * 0.02 + phase * 1.4) * 10);
      }
      ctx.lineTo(w, yBase + 160); ctx.lineTo(0, yBase + 180); ctx.closePath();
      ctx.fillStyle = hexAlpha(i % 2 === 0 ? theme.accent : theme.accent2, 0.045 + intensity * 0.04);
      ctx.fill();
    }
    ctx.restore();
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const top = laneBounds(layout, lane, topY);
      const bot = laneBounds(layout, lane, bottomY);
      fillQuad(ctx, top.left, topY, top.right, topY, bot.right, bottomY, bot.left, bottomY);
      const lg = ctx.createLinearGradient(0, topY, 0, bottomY);
      lg.addColorStop(0, "rgba(255,255,255,0.02)");
      lg.addColorStop(0.7, s.heldLanes[lane] ? hexAlpha(theme.accent, 0.16) : "rgba(255,255,255,0.05)");
      lg.addColorStop(1, s.heldLanes[lane] ? hexAlpha(theme.accent, 0.22) : "rgba(0,0,0,0.18)");
      ctx.fillStyle = lg; ctx.fill();
      ctx.beginPath(); ctx.moveTo(top.left, topY); ctx.lineTo(bot.left, bottomY);
      ctx.strokeStyle = hexAlpha(theme.accent, 0.18); ctx.lineWidth = 1; ctx.stroke();
      if (lane === LANE_COUNT - 1) {
        ctx.beginPath(); ctx.moveTo(top.right, topY); ctx.lineTo(bot.right, bottomY); ctx.stroke();
      }
    }
    {
      const spawnL = laneBounds(layout, 0, topY);
      const spawnR = laneBounds(layout, LANE_COUNT - 1, topY);
      ctx.save();
      ctx.strokeStyle = hexAlpha(theme.accent, 0.55); ctx.lineWidth = 2;
      ctx.shadowColor = hexAlpha(theme.accent, 0.6); ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(spawnL.left - 6, topY); ctx.lineTo(spawnR.right + 6, topY); ctx.stroke();
      ctx.restore();
    }
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const a = laneBounds(layout, lane, hitY - 6);
      const b = laneBounds(layout, lane, hitY + 22);
      fillQuad(ctx, a.left, hitY - 6, a.right, hitY - 6, b.right, hitY + 22, b.left, hitY + 22);
      ctx.fillStyle = s.heldLanes[lane] ? hexAlpha(theme.accent, 0.35) : "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = hexAlpha(theme.accent, s.heldLanes[lane] ? 0.95 : 0.35);
      ctx.lineWidth = s.heldLanes[lane] ? 2.5 : 1.2; ctx.stroke();
    }
    const pulse = 0.55 + 0.45 * Math.sin(time * 6);
    const hl = laneBounds(layout, 0, hitY);
    const hr = laneBounds(layout, LANE_COUNT - 1, hitY);
    ctx.save();
    ctx.shadowColor = hexAlpha(theme.accent, 0.8); ctx.shadowBlur = 18 + pulse * 10;
    ctx.strokeStyle = hexAlpha("#ffffff", 0.55 + pulse * 0.25); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hl.left - 6, hitY); ctx.lineTo(hr.right + 6, hitY); ctx.stroke();
    ctx.restore();
    const visible = s.notes.filter((n) => {
      const pHead = noteProgress(n, s.beat, s.approachBeats);
      const pTail = pHead - visualLengthBeats(n, s.approachBeats) / s.approachBeats;
      return pHead > -0.04 && pTail < 1.3 && (!n.judged || n.holding);
    }).sort((a, b) => a.beat - b.beat);
    for (const note of visible) {
      const pHead = noteProgress(note, s.beat, s.approachBeats);
      const pTail = pHead - visualLengthBeats(note, s.approachBeats) / s.approachBeats;
      const yHead = progressToY(layout, pHead);
      const yTail = progressToY(layout, pTail);
      let yBot = Math.max(yHead, yTail);
      let yTop = Math.min(yHead, yTail);
      if (yBot < layout.topY + 0.5 || yTop > layout.bottomY) continue;
      yTop = Math.max(yTop, layout.topY);
      yBot = Math.min(yBot, layout.bottomY + 10);
      if (note.holding) {
        const eaten = Math.max(0, s.beat - (note.holdStartBeat != null ? note.holdStartBeat : note.beat));
        const remain = Math.max(0.08, note.holdBeats - eaten);
        const pRemain = pHead - remain / s.approachBeats;
        yTop = Math.max(yTop, progressToY(layout, pRemain));
        yBot = Math.min(yBot, layout.hitY + 2);
      }
      if (yBot - yTop < 3) continue;
      const top = laneBounds(layout, note.lane, yTop);
      const bot = laneBounds(layout, note.lane, yBot);
      const fill = note.type === "nova" ? "#1a1408" : theme.tile;
      const edge = note.type === "nova" ? "#ffe08a" : note.type === "hold" ? theme.accent2 : theme.tileEdge;
      const inZone = pHead > 0.55 && pHead < 1.12;
      ctx.save();
      ctx.shadowColor = hexAlpha(edge, inZone ? 0.9 : 0.4); ctx.shadowBlur = inZone ? 20 : 8;
      fillQuad(ctx, top.left, yTop, top.right, yTop, bot.right, yBot, bot.left, yBot);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = inZone ? 2.4 : 1.6; ctx.strokeStyle = hexAlpha(edge, 0.95); ctx.stroke();
      if (note.type === "hold") {
        const rungs = Math.max(2, Math.round(note.holdBeats * 2));
        ctx.strokeStyle = hexAlpha(edge, 0.32); ctx.lineWidth = 1;
        for (let i = 1; i < rungs; i++) {
          const y = yTop + (yBot - yTop) * (i / rungs);
          if (y <= layout.topY + 2 || y >= yBot - 4) continue;
          const b = laneBounds(layout, note.lane, y);
          const inset = (b.right - b.left) * 0.22;
          ctx.beginPath(); ctx.moveTo(b.left + inset, y); ctx.lineTo(b.right - inset, y); ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const p of s.particles) {
      const t = 1 - p.life / p.maxLife;
      ctx.globalAlpha = t; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    for (const r of s.ripples) {
      const t = r.age / r.maxAge;
      ctx.beginPath(); ctx.arc(r.x, r.y, 16 + t * 78, 0, Math.PI * 2);
      ctx.strokeStyle = hexAlpha(r.color, (1 - t) * 0.75); ctx.lineWidth = 3.5 * (1 - t); ctx.stroke();
    }
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const f of s.floaters) {
      const t = f.age / 0.7;
      const y = layout.hitY - 36 - t * 48;
      const b = laneBounds(layout, f.lane, layout.hitY);
      ctx.globalAlpha = 1 - t;
      ctx.font = `700 ${f.kind === "perfect" ? 18 : 15}px Outfit, sans-serif`;
      const label = f.kind === "perfect" ? "PERFECT" : f.kind === "great" ? "GREAT" : f.kind === "good" ? "GOOD" : "MISS";
      ctx.fillStyle = f.kind === "miss" ? "#ff5d7a" : f.kind === "perfect" ? "#7ee7ff" : f.kind === "great" ? "#c4b5ff" : "#f3f0ff";
      ctx.fillText(label, b.mid, y);
    }
    ctx.restore();
    if (showKeys) {
      ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let i = 0; i < LANE_COUNT; i++) {
        const b = laneBounds(layout, i, layout.bottomY - 18);
        const y = layout.hitY + Math.min(48, (layout.bottomY - layout.hitY) * 0.55);
        const kw = Math.max(36, (b.right - b.left) * 0.55);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(7,6,15,0.55)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(b.mid - kw / 2, y - 16, kw, 32, 6);
        else ctx.rect(b.mid - kw / 2, y - 16, kw, 32);
        ctx.fill();
        ctx.strokeStyle = hexAlpha(theme.accent, 0.35); ctx.lineWidth = 1; ctx.stroke();
        ctx.font = "700 13px Outfit, sans-serif"; ctx.fillStyle = "#f3f0ff"; ctx.fillText(LANE_LABELS[i], b.mid, y - 5);
        ctx.font = "600 10px Outfit, sans-serif"; ctx.fillStyle = "rgba(243,240,255,0.65)"; ctx.fillText(LANE_ARROWS[i], b.mid, y + 9);
      }
      ctx.restore();
    }
    if (s.flash > 0) {
      ctx.fillStyle = s.stats.miss > 0 && s.combo === 0 ? `rgba(255,80,110,${s.flash * 0.22})` : hexAlpha(theme.accent, s.flash * 0.12);
      ctx.fillRect(0, 0, w, h);
    }
    if (s.burstFlash > 0) { ctx.fillStyle = hexAlpha(theme.accent, s.burstFlash * 0.18); ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  }

  /* ---------- persist ---------- */
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { version: 1, best: {}, settings: { ...DEFAULT_SETTINGS } };
      const parsed = JSON.parse(raw);
      return { version: 1, best: parsed.best ?? {}, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) } };
    } catch { return { version: 1, best: {}, settings: { ...DEFAULT_SETTINGS } }; }
  }
  function writeSave(save) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
  }

  /* ---------- ads (Google AdSense / H5 Games Ad Placement API) ---------- */
  // Fill in AD_CLIENT (and AD_SLOT_BANNER, for the banner unit) once
  // AdSense approves the site. Until AD_CLIENT is set, every ad call below
  // just runs its "no ad" fallback immediately, so the game is fully
  // playable during review and for anyone with an ad blocker. Nothing
  // else needs to change when ads go live — just fill in the constants.
  var AD_CLIENT = "ca-pub-4203857211510947";
  var AD_SLOT_BANNER = "7417753724";
  let adsScriptState = "idle"; // idle | loading | ready | failed
  let adPendingCbs = [];
  const adsEnabled = () => !!AD_CLIENT;

  // Wraps a (name, onDone) ad-trigger function so onDone is guaranteed to
  // fire exactly once within `ms` — even if Google's adBreak machinery (or
  // a stalled script) never calls back. A stuck ad must never be able to
  // freeze the game.
  function guardedAdCall(fn, ms) {
    return (name, onDone) => {
      let done = false;
      const finish = () => { if (done) return; done = true; onDone?.(); };
      const timer = setTimeout(finish, ms);
      fn(name, () => { clearTimeout(timer); finish(); });
    };
  }

  function loadAdScript(cb) {
    if (!adsEnabled() || adsScriptState === "failed") return cb?.(false);
    if (adsScriptState === "ready") return cb?.(true);
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adBreak || ((o) => window.adsbygoogle.push(o));
    window.adConfig = window.adConfig || ((o) => window.adsbygoogle.push(o));
    if (adsScriptState === "loading") { adPendingCbs.push(cb); return; }
    adsScriptState = "loading";
    adPendingCbs.push(cb);
    const settle = (ok) => {
      if (adsScriptState !== "loading") return; // already settled (e.g. by the timeout)
      adsScriptState = ok ? "ready" : "failed";
      if (ok) { try { window.adConfig({ preloadAdBreaks: "on", sound: "off" }); } catch { /* ignore */ } }
      const cbs = adPendingCbs.splice(0);
      cbs.forEach((fn) => fn?.(ok));
    };
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
    s.onload = () => settle(true);
    s.onerror = () => settle(false);
    document.head.appendChild(s);
    // Ad blockers, restrictive networks, and sandboxed webviews can swallow
    // the request silently — no load event, no error event, ever. Never
    // let that leave the game unable to start: if it hasn't settled
    // quickly, treat it as failed and let the player continue without ads.
    setTimeout(() => settle(false), 1500);
  }

  // Full-screen interstitial (e.g. between tracks). onDone always fires —
  // whether an ad actually played, was skipped, ads aren't live yet, or
  // the ad call itself stalls — so callers can just chain the next action
  // off it.
  const showInterstitial = guardedAdCall((name, onDone) => {
    if (!adsEnabled()) return onDone();
    loadAdScript((ok) => {
      if (!ok || typeof window.adBreak !== "function") return onDone();
      window.adBreak({
        type: "next",
        name: name || "track-transition",
        afterAd: onDone,
        adBreakDone: onDone,
      });
    });
  }, 12000); // generous: protects against a genuine SDK hang without cutting off a real ad mid-play once ads go live

  // Rewarded ad (e.g. "watch an ad to continue"). onReward fires only if
  // the ad was actually watched; onSkipped fires if the player declined,
  // the ad failed, ads aren't live yet, or the call stalls.
  function showRewardedAd(name, onReward, onSkipped) {
    let done = false;
    const reward = () => { if (done) return; done = true; clearTimeout(timer); onReward?.(); };
    const skip = () => { if (done) return; done = true; clearTimeout(timer); onSkipped?.(); };
    const timer = setTimeout(skip, 30000); // rewarded videos legitimately run up to ~30s — don't cut a real one off mid-play
    if (!adsEnabled()) return skip();
    loadAdScript((ok) => {
      if (!ok || typeof window.adBreak !== "function") return skip();
      window.adBreak({
        type: "reward",
        name: name || "continue-run",
        beforeReward: (showAdFn) => showAdFn(),
        adViewed: reward,
        adDismissed: skip,
        adBreakDone: (info) => { if (info && info.breakStatus && info.breakStatus !== "viewed") skip(); },
      });
    });
  }

  // Banner/display ad. Renders an <ins class="adsbygoogle"> unit into the
  // given container once AdSense is live; leaves it empty until AD_CLIENT
  // and AD_SLOT_BANNER are filled in.
  function renderBannerAd(container) {
    if (!container) return;
    if (!adsEnabled() || !AD_SLOT_BANNER) { container.innerHTML = ""; return; }
    loadAdScript((ok) => {
      if (!ok) return;
      container.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${AD_CLIENT}" data-ad-slot="${AD_SLOT_BANNER}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ignore */ }
    });
  }

  /* ---------- app ---------- */
  const $ = (id) => document.getElementById(id);
  const screens = {
    menu: $("screen-menu"),
    help: $("screen-help"),
    settings: $("screen-settings"),
    play: $("screen-play"),
    result: $("screen-result"),
  };
  let save = loadSave();
  let screen = "menu";
  let track = null;
  let session = null;
  let layout = null;
  let paused = false;
  let runId = 0;
  let raf = 0;
  let last = 0;
  let ended = false;
  let awaitingContinue = false;
  let continuePauseTime = 0;
  let activeKeyLane = null; // keyboard: only one lane key may be "down" at a time
  let navBusy = false; // true while waiting on the track-transition ad call
  const pointers = new Map();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = $("game");
  const ctx = canvas.getContext("2d");

  function show(name) {
    screen = name;
    for (const [k, el] of Object.entries(screens)) el.classList.toggle("hidden", k !== name);
  }

  function renderMenu() {
    const list = $("track-list");
    list.innerHTML = "";
    for (const t of TRACKS) {
      const best = save.best[t.id];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track";
      const stars = best ? "✦".repeat(best.stars) + "✧".repeat(3 - best.stars) : "";
      btn.innerHTML = `<div class="track-top"><div><h2>${t.title}<span class="badge badge-${t.difficulty}">${DIFF_LABEL[t.difficulty]}</span></h2><p>${t.subtitle}</p></div><span class="play-ico">▶</span></div><div class="track-meta"><span>Play until you miss · speeds up</span><span>${best ? `<span class="stars">${stars}</span> ${best.score.toLocaleString()}` : "No run yet"}</span></div>`;
      btn.addEventListener("click", () => beginTrack(t));
      list.appendChild(btn);
    }
    renderBannerAd($("ad-slot-menu"));
  }

  function beginTrack(t) {
    if (navBusy) return;
    navBusy = true;
    setTrackButtonsLoading(true);
    showInterstitial("track-transition", () => {
      navBusy = false;
      setTrackButtonsLoading(false);
      startTrack(t);
    });
  }

  // Disable the track cards and show a loading state while we wait on the
  // interstitial ad call, so a slow (or previously-stuck) ad can't be
  // re-triggered by impatient repeat taps and reads as "loading" rather
  // than "broken".
  function setTrackButtonsLoading(on) {
    document.querySelectorAll("#track-list .track").forEach((btn) => {
      btn.disabled = on;
      btn.classList.toggle("loading", on);
    });
  }

  function syncSettingsUi() {
    $("s-master").value = save.settings.master; $("v-master").textContent = Math.round(save.settings.master * 100);
    $("s-music").value = save.settings.music; $("v-music").textContent = Math.round(save.settings.music * 100);
    $("s-sfx").value = save.settings.sfx; $("v-sfx").textContent = Math.round(save.settings.sfx * 100);
    $("t-shake").classList.toggle("on", save.settings.shake);
    $("t-haptics").classList.toggle("on", save.settings.haptics);
    audio.applySettings(save.settings);
  }

  function startTrack(t) {
    audio.unlock();
    audio.playUi("start");
    track = t;
    paused = false;
    ended = false;
    activeKeyLane = null;
    runId += 1;
    $("pause").classList.add("hidden");
    show("play");
    fit();
    session = createSession(t, audio.now(), runId * 997);
    audio.startBacking(t);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function fit() {
    const parent = canvas.parentElement;
    const w = parent?.clientWidth ?? window.innerWidth;
    const h = parent?.clientHeight ?? window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout = computeLayout(w, h);
  }

  function updateHud() {
    if (!session) return;
    $("hud-score").textContent = session.score.toLocaleString();
    $("hud-combo").textContent = session.combo > 1 ? `${session.combo} combo` : "\u00a0";
    $("hud-lives").innerHTML = [0, 1, 2].map((i) => `<span class="${i < session.lives ? "on" : "off"}">♥</span>`).join("");
    const progress = track.difficulty === "endless"
      ? Math.min(1, (session.beat % 32) / 32)
      : Math.max(0, Math.min(1, session.beat / track.durationBeats));
    $("hud-progress").style.width = `${progress * 100}%`;
    const burst = $("btn-burst");
    burst.disabled = !session.burstReady;
    burst.classList.toggle("ready", session.burstReady);
    burst.textContent = session.burstReady ? "Burst" : `${Math.round(session.meter)}%`;
    const cd = $("countdown");
    if (session.phase === "countdown") {
      cd.classList.remove("hidden");
      cd.textContent = String(Math.max(1, Math.ceil(-session.beat)));
    } else if (session.phase === "playing" && session.beat < 0.45) {
      cd.classList.remove("hidden");
      cd.textContent = "GO";
    } else cd.classList.add("hidden");
  }

  function endRun() {
    audio.stopBacking();
    const acc = accuracyOf(session);
    const failed = session.endReason === "fail";
    const stars = starsForAccuracy(acc, failed);
    const prev = save.best[track.id];
    const isNew = !prev || session.score > prev.score;
    if (isNew) {
      save.best[track.id] = { score: session.score, combo: session.maxCombo, accuracy: acc, stars };
      writeSave(save);
    }
    $("result-reason").textContent = failed ? "Lights out" : "Sky cleared";
    $("result-title").textContent = track.title;
    $("result-stars").innerHTML = "✦".repeat(stars) + "✧".repeat(3 - stars) + (isNew ? '<span class="newbest">New best</span>' : "");
    $("result-score").textContent = session.score.toLocaleString();
    $("r-acc").textContent = `${Math.round(acc * 100)}%`;
    $("r-combo").textContent = String(session.maxCombo);
    $("r-perf").textContent = String(session.stats.perfect);
    $("r-miss").textContent = String(session.stats.miss);
    setTimeout(() => { show("result"); renderMenu(); }, 650);
  }

  function continueRun() {
    if (!session) return;
    session.startCtxTime += audio.now() - continuePauseTime;
    session.lives = 1;
    session.endReason = null;
    session.continueUsed = true;
    session.trauma = 0;
    session.flash = 0;
    session.phase = session.beat < 0 ? "countdown" : "playing";
    awaitingContinue = false;
    $("continue").classList.add("hidden");
    audio.startBacking(track);
  }

  function skipContinue() {
    if (session) session.continueUsed = true;
    awaitingContinue = false;
    $("continue").classList.add("hidden");
    ended = true;
    endRun();
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (session && layout && screen === "play") {
      if (paused && session.phase !== "paused" && session.phase !== "ended") {
        session.phase = "paused";
        session.pauseCtxTime = audio.now();
        audio.stopBacking();
      }
      if (!paused && session.phase === "paused") {
        session.startCtxTime += audio.now() - session.pauseCtxTime;
        session.phase = session.beat < 0 ? "countdown" : "playing";
        audio.startBacking(track);
      }
      updateSession(session, dt, audio.now());
      const showKeys = window.matchMedia("(pointer: fine)").matches;
      renderFrame(ctx, session, layout, now / 1000, showKeys, reduced || !save.settings.shake);
      updateHud();
      if (session.phase === "ended" && !ended && !awaitingContinue) {
        if (session.endReason === "fail" && !session.continueUsed && adsEnabled()) {
          awaitingContinue = true;
          continuePauseTime = audio.now();
          audio.stopBacking();
          $("continue").classList.remove("hidden");
        } else {
          ended = true;
          endRun();
        }
      }
    }
    raf = requestAnimationFrame(loop);
  }

  function hit(lane, down, cx, cy) {
    if (!session || paused) return;
    const result = tapLane(session, lane, down, cx, cy);
    if (!down) return;
    if (result.kind === "ignore") return;
    if (result.kind === "empty" || result.kind === "miss") {
      audio.playMiss();
      if (save.settings.haptics) navigator.vibrate?.(18);
    } else if (result.note) {
      const k = result.kind === "perfect" || result.kind === "great" || result.kind === "good" ? result.kind : "good";
      audio.playHit(result.note.freq, result.note.type === "nova" ? "nova" : k);
      if (save.settings.haptics) navigator.vibrate?.(8);
    }
  }
  function fireBurst() {
    if (!session || !layout || paused) return;
    const centers = [0, 1, 2].map((l) => laneBounds(layout, l, layout.hitY).mid);
    if (triggerBurst(session, layout.hitY, centers)) audio.playBurst();
  }

  function tileUnderPoint(x, y) {
    if (!session || !layout) return null;
    const lane = laneAtPoint(layout, x, y);
    if (lane == null) return null;
    for (const n of session.notes) {
      if (n.lane !== lane || (n.judged && !n.holding)) continue;
      const pHead = noteProgress(n, session.beat, session.approachBeats);
      const pTail = pHead - visualLengthBeats(n, session.approachBeats) / session.approachBeats;
      const yHead = progressToY(layout, pHead);
      const yTail = progressToY(layout, pTail);
      const y0 = Math.min(yHead, yTail) - 16;
      const y1 = Math.max(yHead, yTail) + 16;
      if (y >= y0 && y <= y1) return { note: n, lane };
    }
    return null;
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (!layout) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hitTile = tileUnderPoint(x, y);
    if (!hitTile) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, hitTile.lane);
    const b = laneBounds(layout, hitTile.lane, layout.hitY);
    hit(hitTile.lane, true, b.mid, y);
  });
  const pointerUp = (e) => {
    const lane = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (lane == null || !layout) return;
    const b = laneBounds(layout, lane, layout.hitY);
    hit(lane, false, b.mid, b.mid);
  };
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (screen === "play" && (e.code === "Escape" || e.code === "KeyP")) {
      e.preventDefault();
      paused = !paused;
      $("pause").classList.toggle("hidden", !paused);
      return;
    }
    if (screen !== "play" || paused) return;
    if (e.code === "Space") { e.preventDefault(); fireBurst(); return; }
    const lane = KEY_LANES[e.code];
    if (lane == null) return;
    e.preventDefault();
    // Only one lane key registers at a time: if a different lane key is
    // already held down, this press is ignored until that one is released.
    // Prevents holding/mashing all three keys at once from sweeping every
    // lane's notes for free.
    if (activeKeyLane != null && activeKeyLane !== lane) return;
    activeKeyLane = lane;
    const b = layout ? laneBounds(layout, lane, layout.hitY) : { mid: 0 };
    hit(lane, true, b.mid, layout?.hitY ?? 0);
  });
  window.addEventListener("keyup", (e) => {
    const lane = KEY_LANES[e.code];
    if (lane == null || screen !== "play") return;
    if (activeKeyLane === lane) activeKeyLane = null;
    const b = layout ? laneBounds(layout, lane, layout.hitY) : { mid: 0 };
    hit(lane, false, b.mid, layout?.hitY ?? 0);
  });
  window.addEventListener("resize", () => { if (screen === "play") fit(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" && screen === "play") {
      paused = true; $("pause").classList.remove("hidden");
      activeKeyLane = null;
    } else if (audio.ctx && audio.ctx.state === "suspended") void audio.ctx.resume();
  });

  $("btn-help").addEventListener("click", () => show("help"));
  $("btn-settings").addEventListener("click", () => { syncSettingsUi(); show("settings"); });
  document.querySelectorAll("[data-back]").forEach((el) => el.addEventListener("click", () => { show(el.dataset.back); renderMenu(); }));
  $("btn-pause").addEventListener("click", () => { paused = true; $("pause").classList.remove("hidden"); });
  $("btn-resume").addEventListener("click", () => { paused = false; $("pause").classList.add("hidden"); });
  $("btn-retry").addEventListener("click", () => { if (track) startTrack(track); });
  $("btn-quit").addEventListener("click", () => { audio.stopBacking(); cancelAnimationFrame(raf); show("menu"); renderMenu(); });
  $("btn-continue-watch").addEventListener("click", () => { showRewardedAd("continue-run", continueRun, skipContinue); });
  $("btn-continue-skip").addEventListener("click", skipContinue);
  $("btn-burst").addEventListener("click", fireBurst);
  $("btn-again").addEventListener("click", () => { if (track) beginTrack(track); });
  ["master", "music", "sfx"].forEach((k) => {
    $(`s-${k}`).addEventListener("input", (e) => {
      save.settings[k] = Number(e.target.value);
      $(`v-${k}`).textContent = Math.round(save.settings[k] * 100);
      writeSave(save); audio.applySettings(save.settings);
    });
  });
  $("t-shake").addEventListener("click", () => { save.settings.shake = !save.settings.shake; writeSave(save); syncSettingsUi(); });
  $("t-haptics").addEventListener("click", () => { save.settings.haptics = !save.settings.haptics; writeSave(save); syncSettingsUi(); });

  renderMenu();
  syncSettingsUi();
  show("menu");
})();