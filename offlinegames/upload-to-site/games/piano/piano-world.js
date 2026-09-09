/* Piano World - readable, framework-free JavaScript. See CONFIG to customize. */
(function () {
  "use strict";

  const CONFIG = {
    adClient: "ca-pub-4203857211510947",
    bannerSlot: "7417753724",
    bannerEnabled: true,
    h5AdsEnabled: false, // Enable only after Google approves H5 game ads for your site.
    rhythmHearts: 3,
    speedMultiplier: 2.36, // twice the previous 1.18 pace
    wrongKeyCostsHeart: true,
    chartLookaheadMs: 5000,
    safeIntroMs: 10000,
    hitRatio: 0.81,
    lateWindowMs: 265,
    // Put these MP3 files directly beside piano-world.js and the HTML file.
    // No audio/ subfolder, video player, or synthetic replacement is needed.
    // Only tile speed increases; recordings always play at their normal speed.
    audioSources: {
      ordinary: "ordinary.mp3",
      midnight: "midnight.mp3",
      tokyo: "tokyo.mp3",
      "phonk-gym": "phonk-gym.mp3",
      villain: "villain.mp3",
      showtime: "showtime.mp3"
    }
  };

  const SONGS = [
    { id: "ordinary", title: "Ordinary", artist: "Alex Warren", world: "Sunny Meadows", difficulty: 1, label: "Easy", bpm: [92, 112], rampMs: 62000, image: "piano-world-home.jpg", accent: "#ffd75f", seed: 1103, pattern: [0,1,2,3,2,1,0,2], locked: false },
    { id: "midnight", title: "Late Night Drive", artist: "The Weeknd Mix", world: "Midnight City", difficulty: 2, label: "Normal", bpm: [100,128], rampMs: 68000, image: "piano-world-play.jpg", accent: "#7fdcff", seed: 2207, pattern: [0,1,3,2,1,0,2,3], locked: false },
    { id: "tokyo", title: "Tokyo Drift x Temperature", artist: "DJ Kantik Remix", world: "Neon Tokyo", difficulty: 3, label: "Medium", bpm: [112,142], rampMs: 72000, image: "world-tokyo.jpg", accent: "#ff7ad9", seed: 3311, pattern: [0,2,3,1,0,3,2,1], locked: false },
    { id: "phonk-gym", title: "Brazilian Phonk Training", artist: "Wildcore Audio", world: "Inferno Gym", difficulty: 4, label: "Hard", bpm: [120,155], rampMs: 75000, image: "world-gym.jpg", accent: "#ff8a5c", seed: 4417, pattern: [0,1,2,3,2,1,0,3], locked: true },
    { id: "villain", title: "AURA Villain Phonk", artist: "Noctis Eminence", world: "Villain Castle", difficulty: 5, label: "Hard+", bpm: [128,168], rampMs: 78000, image: "world-villain.jpg", accent: "#b48cff", seed: 5521, pattern: [0,3,1,2,3,0,2,1], locked: true },
    { id: "showtime", title: "Touch It (Deep Remix)", artist: "Busta Rhymes", world: "Showtime Streets", difficulty: 5, label: "Expert", bpm: [135,178], rampMs: 80000, image: "world-showtime.jpg", accent: "#8dffb0", seed: 6637, pattern: [1,2,1,2,0,3,2,1], locked: true }
  ];
  const KEYS = ["D", "F", "K", "L"];
  const CODE_LANE = { KeyD: 0, KeyF: 1, KeyK: 2, KeyL: 3 };
  const STORE_KEY = "piano-world-vanilla-v1";
  const BASE = new URL("./", document.currentScript && document.currentScript.src || document.baseURI);
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const timeLabel = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  const asset = name => new URL(`images/${name}`, BASE).href;
  const isMobile = () => window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isLocal = () => location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const stamp = value => {
    const now = performance.now();
    const normalized = value > 1e12 ? value - performance.timeOrigin : value;
    return Number.isFinite(normalized) && Math.abs(normalized - now) < 1000 ? normalized : now;
  };

  const ICONS = {
    play: '<path d="m8 5 11 7-11 7Z" fill="currentColor"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    heart: '<path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" fill="currentColor" stroke="none"/>',
    gem: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M2 9h20M8 3l4 19 4-19"/>',
    sound: '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    mute: '<path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6"/>',
    settings: '<path d="m9 3-.6 2.5L6 7 3.5 7.2l-1 2 1.6 2.2V14l-1 2 1.5 2 2.5-.1 2 1.2L10 22h3l1-2.9 2-1.2 2.5.1 1.5-2-1-2v-2.6l1.6-2.2-1-2L17 7l-2.4-1.5L14 3Z"/><circle cx="11.5" cy="12.5" r="3.4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    ad: '<rect x="2" y="5" width="20" height="15" rx="3"/><path d="m9 2 3 3 3-3m-6 8 6 3-6 3Z"/>',
    music: '<path d="M10 17V4l11-2v13M10 8l11-2"/><ellipse cx="6" cy="18" rx="4" ry="3"/><ellipse cx="17" cy="16" rx="4" ry="3"/>',
    crown: '<path d="m2 6 5 5 5-8 5 8 5-5-3 13H5ZM6 22h12"/>',
    star: '<path d="m12 2 3.1 6.6 7.2 1-5.2 5.1 1.2 7.2-6.3-3.4-6.3 3.4 1.2-7.2L1.7 9.6l7.2-1Z" fill="currentColor" stroke-width="1.5"/>',
    home: '<path d="m2 11 10-9 10 9M5 9v13h14V9m-10 13v-8h6v8"/>',
    replay: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
    next: '<path d="m5 5 11 7-11 7ZM19 5v14"/>',
    hand: '<path d="M8 13V4a2 2 0 0 1 4 0v7-2a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v6c0 4-2 6-6 6h-2c-2 0-3-1-4-3L3 13a2 2 0 0 1 3-2Z"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    timer: '<circle cx="12" cy="14" r="8"/><path d="M9 2h6m-3 0v4m0 8 3-3"/>',
    shield: '<path d="M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6ZM8 12l3 3 5-6"/>',
    rotate: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M3 6 1 9l2 3m18 0 2 3-2 3M11 18h2"/>',
    sparkle: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5ZM20 2v4m-2-2h4"/>',
    upload: '<path d="M12 16V2m-5 5 5-5 5 5M4 15v7h16v-7"/>',
    gift: '<path d="M3 11h18v11H3ZM2 7h20v4H2Zm10 0v15"/><path d="M12 7C2 7 5-2 10 2l2 5c10 0 7-9 2-5Z"/>'
  };
  function icon(name, extra = "") {
    return `<svg class="pw-icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.music}</svg>`;
  }
  function logo(compact = false) {
    return `<h1 class="game-logo${compact ? " compact" : ""}" aria-label="Piano World"><span>PIANO</span><strong>WORLD</strong><i aria-hidden="true">&#9834;</i></h1>`;
  }
  function round(action, label, name, extra = "") {
    return `<button type="button" class="round-button ${extra}" data-action="${action}" title="${label}" aria-label="${label}">${icon(name)}</button>`;
  }

  class Resources {
    constructor() { this.cleanups = []; this.timers = new Set(); }
    listen(target, event, handler, options) {
      target.addEventListener(event, handler, options);
      this.cleanups.push(() => target.removeEventListener(event, handler, options));
    }
    later(handler, ms) {
      const id = setTimeout(() => { this.timers.delete(id); handler(); }, ms);
      this.timers.add(id);
      return id;
    }
    clear(id) { clearTimeout(id); this.timers.delete(id); }
    dispose() {
      this.cleanups.forEach(fn => fn());
      this.timers.forEach(id => clearTimeout(id));
      this.cleanups = []; this.timers.clear();
    }
  }

  function readStorage(key, fallback) {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : fallback; }
    catch (_) { return fallback; }
  }
  function initialState() {
    const saved = readStorage(STORE_KEY, null);
    const legacy = key => readStorage("piano-world-v2:" + key, undefined);
    const get = (key, fallback) => saved && saved[key] !== undefined ? saved[key] : legacy(key) ?? fallback;
    const selected = get("selected", SONGS[0].id);
    const unlocked = get("unlocked", {});
    const best = get("best", {});
    const stars = get("stars", {});
    return {
      selected: SONGS.some(song => song.id === selected) ? selected : SONGS[0].id,
      unlocked: Object.fromEntries(SONGS.map(song => [song.id, !song.locked || unlocked && unlocked[song.id] === true])),
      best: Object.fromEntries(SONGS.map(song => [song.id, Math.max(0, Math.floor(number(best && best[song.id])))])),
      stars: Object.fromEntries(SONGS.map(song => [song.id, clamp(Math.floor(number(stars && stars[song.id])), 0, 3)])),
      gems: Math.max(0, Math.floor(number(get("gems", 0)))),
      rounds: Math.max(0, Math.floor(number(get("rounds", 0)))),
      holdSeen: get("holdSeen", false) === true,
      muted: get("muted", false) === true,
      vibration: get("vibration", true) !== false,
      volume: clamp(number(get("volume", .75), .75), 0, 1),
      timingOffset: clamp(number(get("timingOffset", 0)), -120, 120)
    };
  }
  function randomSeed(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function paceAt(song, time) {
    const progress = clamp(time / song.rampMs, 0, 1);
    const extraMinutes = Math.max(0, time - song.rampMs) / 60000;
    const multiplier = CONFIG.speedMultiplier * (1 + Math.min(.2, extraMinutes * .04));
    const worldFactor = 1 - (song.difficulty - 1) * .045;
    const travel = Math.max(370, Math.round(mix(2450, 1170, Math.pow(progress, .85)) * worldFactor / multiplier));
    return { progress, travel, beat: 60000 / (mix(song.bpm[0], song.bpm[1], progress) * multiplier), speed: 2450 * worldFactor / travel };
  }

  // A streaming chart reserves two visibility slots across the entire run.
  // The generator never ends; the renderer only retains a few seconds of notes.
  function createEndlessChart(song) {
    const rng = randomSeed(song.seed);
    const slots = [0, 0];
    const laneEnd = [0, 0, 0, 0];
    let cursor = 380;
    let index = 0;
    return {
      next() {
        const slot = slots[0] <= slots[1] ? 0 : 1;
        const spawn = Math.round(Math.max(cursor, slots[slot] + 80));
        const { progress, travel, beat } = paceAt(song, spawn);
        const time = spawn + travel;
        let lane = song.pattern[index % song.pattern.length];
        if (song.difficulty >= 3 && rng() < .2) lane = (lane + 2) % 4;
        if (laneEnd[lane] > spawn) {
          lane = [1, 3, 2].map(step => (lane + step) % 4).find(value => laneEnd[value] <= spawn);
        }
        const hold = index === 5 || index > 5 && index % Math.max(6, 12 - song.difficulty) === 5;
        const duration = hold ? Math.round(mix(880, 490, progress) * (.95 + rng() * .2)) : 0;
        const end = time + duration + CONFIG.lateWindowMs + 180;
        const note = { id: index, lane, spawn, time, travel, duration, end };
        slots[slot] = end; laneEnd[lane] = end;
        cursor = spawn + Math.max(170, beat * (song.difficulty >= 3 && rng() < .35 ? .5 : 1));
        index += 1;
        return note;
      }
    };
  }
  function buildChart(song, throughMs = song.rampMs) {
    const generator = createEndlessChart(song);
    const notes = [];
    const horizon = Math.max(0, number(throughMs, song.rampMs));
    for (let note = generator.next(); note.spawn <= horizon; note = generator.next()) notes.push(note);
    return notes;
  }
  function canHit(note, time) {
    return note.state === "pending" && time >= note.spawn && time <= note.time + CONFIG.lateWindowMs;
  }
  function gradeHit(note, time, offset = 0) {
    const error = Math.abs(time - offset - note.time);
    return error <= 85 ? "perfect" : error <= 160 ? "great" : "good";
  }

  /* ---------- Offline background music: one local audio file per world. ---------- */
  const audioFileName = id => (CONFIG.audioSources[id] || `${id}.mp3`).split("/").pop();

  class Music {
    constructor(app, song, getTime, onStatus) {
      this.app = app; this.song = song; this.getTime = getTime; this.onStatus = onStatus;
      this.audio = null;
      this.ready = false; this.playing = false; this.initialized = false; this.disposed = false;
      this.wantPlay = false; this.silent = false; this.generation = 0;
      this.kind = "loading"; this.detail = "Loading this world's song.";
      this.mode = "custom";
      Promise.resolve().then(() => { if (!this.disposed) this.initialize(); });
    }
    status(kind, detail = "") {
      if (this.disposed) return;
      this.kind = kind; this.detail = detail;
      this.onStatus(kind, detail);
    }
    initialize() {
      if (this.disposed) return;
      const generation = ++this.generation;
      this.destroyBackend();
      this.initialized = true; this.ready = false; this.playing = false;
      const upload = this.app.audioFiles.get(this.song.id);
      const file = CONFIG.audioSources[this.song.id];
      const source = upload || (file ? new URL(file, BASE).href : "");
      if (this.app.state.muted || this.silent) { this.initialized = false; this.status("muted", "Music is off."); return; }
      const alive = () => !this.disposed && this.generation === generation;
      if (!source) { this.fail(`Add ${audioFileName(this.song.id)} beside piano-world.js, or choose a file in Settings.`); return; }
      this.status("loading", upload ? "Loading your chosen audio file." : "Loading this world's song.");
      const audio = new Audio(); this.audio = audio;
      audio.preload = "auto"; audio.loop = true; audio.playbackRate = 1;
      audio.onloadedmetadata = () => { if (alive()) this.seekAudio(); };
      audio.oncanplay = () => {
        if (!alive()) return;
        clearTimeout(this.loadTimer);
        this.ready = true;
        if (this.wantPlay && audio.paused) this.play();
        else if (!this.playing) this.status("ready", "Song ready.");
      };
      audio.onplaying = () => { if (alive()) this.confirmPlaying(); };
      audio.onwaiting = () => {
        if (alive() && this.wantPlay) {
          this.playing = false; this.status("buffering", "Song is buffering. The game is waiting.");
          this.watchPlayback();
        }
      };
      audio.onerror = () => {
        if (!alive()) return;
        this.fail(upload
          ? "Your chosen audio file could not play. Pick a different file in Settings."
          : `Song file missing: put ${audioFileName(this.song.id)} in the same folder as piano-world.js and the HTML file.`);
      };
      audio.src = source;
      audio.load();
      this.updateVolume();
      this.loadTimer = setTimeout(() => {
        if (alive() && !this.ready && !this.playing) this.fail(`Song is taking too long to load. Check ${audioFileName(this.song.id)} beside the game code.`);
      }, 20000);
    }
    confirmPlaying() {
      if (this.disposed) return;
      if (!this.wantPlay || this.app.state.muted || this.silent || document.hidden || this.app.isLandscape()) {
        this.stopBackend(); return;
      }
      clearTimeout(this.playTimer); clearTimeout(this.loadTimer); this.ready = true; this.playing = true;
      this.status("playing", "Now playing.");
    }
    seekAudio() {
      if (!this.audio || this.audio.readyState < 1) return;
      const seconds = Math.max(0, this.getTime() / 1000);
      const duration = Number.isFinite(this.audio.duration) && this.audio.duration > 0 ? this.audio.duration : 0;
      const target = duration ? seconds % duration : seconds;
      if (Math.abs(this.audio.currentTime - target) > .35) {
        try { this.audio.currentTime = target; } catch (_) { /* Metadata may still be loading. */ }
      }
    }
    watchPlayback() {
      const generation = this.generation;
      clearTimeout(this.playTimer);
      this.playTimer = setTimeout(() => {
        if (!this.disposed && generation === this.generation && this.wantPlay && !this.playing) {
          this.status("blocked", "The song hasn't started. Tap Play song, or continue without music.");
        }
      }, 12000);
    }
    play() {
      if (this.disposed) return;
      this.wantPlay = true;
      if (this.app.state.muted || this.silent) { this.status("muted", "Playing without music by your choice."); return; }
      if (!this.initialized) { this.initialize(); return; }
      if (!this.ready || this.kind === "error") return;
      this.updateVolume();
      if (this.playing) return;
      const generation = this.generation;
      const current = () => !this.disposed && generation === this.generation && this.wantPlay;
      this.watchPlayback();
      try {
        if (!this.audio) return;
        this.seekAudio();
        this.audio.play().catch(error => {
          if (!current() || error.name === "AbortError") return;
          clearTimeout(this.playTimer);
          if (error.name === "NotAllowedError") this.status("blocked", "Tap Play song to allow sound.");
          else this.fail(`Song could not play. Check ${audioFileName(this.song.id)} beside the game code.`);
        });
      } catch (_) { this.fail("The song could not start. Try again."); }
    }
    retry() {
      if (this.disposed) return;
      this.silent = false; this.wantPlay = true; this.initialize();
    }
    stopBackend() {
      if (this.audio) this.audio.pause();
    }
    pause() {
      this.wantPlay = false; this.playing = false; clearTimeout(this.playTimer); this.stopBackend();
      if (this.kind !== "error") this.status("paused", "Music paused with the game.");
    }
    fail(message) {
      if (this.disposed) return;
      this.wantPlay = false; this.playing = false;
      clearTimeout(this.loadTimer); clearTimeout(this.playTimer);
      this.stopBackend(); this.status("error", message);
    }
    updateVolume() {
      const volume = this.app.state.muted || this.silent ? 0 : this.app.state.volume;
      if (this.audio) this.audio.volume = volume;
    }
    destroyBackend() {
      clearTimeout(this.loadTimer); clearTimeout(this.playTimer);
      if (this.audio) {
        this.audio.onloadedmetadata = this.audio.oncanplay = this.audio.onplaying = this.audio.onwaiting = this.audio.onended = this.audio.onerror = null;
        this.audio.pause(); this.audio.removeAttribute("src"); this.audio.load(); this.audio = null;
      }
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true; this.wantPlay = false; this.playing = false; this.generation += 1;
      this.destroyBackend();
    }
  }

  class Game {
    constructor(app, song) {
      this.app = app; this.song = song; this.resources = new Resources();
      this.phase = "countdown"; this.elapsed = 0; this.anchor = performance.now();
      this.countdownStart = this.anchor; this.countdownLabel = ""; this.hp = CONFIG.rhythmHearts;
      this.score = 0; this.combo = 0; this.maxCombo = 0;
      this.stats = { perfect: 0, great: 0, good: 0, missed: 0, weighted: 0 };
      this.sources = Array.from({ length: 4 }, () => new Set());
      this.holds = new Map(); this.tutorialNote = null; this.tutorialReady = 0;
      this.immuneUntil = CONFIG.safeIntroMs; this.speedPhase = 0; this.lastHUD = 0;
      this.finished = false; this.disposed = false; this.raf = 0;
      this.lastFrameAt = 0; this.lastRenderedTime = 0;
      this.chart = createEndlessChart(song); this.nextNote = this.chart.next();
      this.notes = []; this.firstHoldId = null;
      this.element = document.createElement("section");
      this.element.className = "scene play-scene";
      this.element.style.setProperty("--scene-art", `url("${asset(song.image)}")`);
      this.element.innerHTML = `
        <header class="game-hud">
          ${round("pause", "Pause game", "pause")}
          <div class="hud-center">
            <div class="track-title">${icon("music")}<span>${esc(song.title)}</span><span class="track-eq" aria-hidden="true"><i></i><i></i><i></i></span></div>
            <div class="run-meta"><span>ENDLESS</span><strong class="run-time" aria-label="Time survived">0:00</strong><span class="run-speed">${CONFIG.speedMultiplier.toFixed(2)}x</span></div>
            <div class="hud-details"><span class="rhythm-hearts" aria-label="${CONFIG.rhythmHearts} rhythm hearts">${Array.from({ length: CONFIG.rhythmHearts }, () => icon("heart")).join("")}</span><span class="safe-time">SAFE 10s</span><button type="button" class="music-line" data-action="enable-music" hidden></button></div>
          </div>
          <div class="score-display"><small>SCORE</small><strong>0</strong></div>
        </header>
        <div class="board" aria-label="Piano tile playing field">
          <div class="lanes">${KEYS.map((key, lane) => `<button type="button" class="lane" data-lane="${lane}" aria-label="Lane ${key}" tabindex="-1"></button>`).join("")}</div>
          <div class="tile-layer"></div>
          <div class="hit-line"></div>
          <div class="key-targets">${KEYS.map(key => `<div class="key-target"><kbd>${key}</kbd></div>`).join("")}</div>
          <div class="effects"></div>
          <div class="combo-display" hidden><strong>0</strong><small>COMBO</small></div>
          <div class="feedback" hidden></div><div class="speed-toast" hidden></div>
          <div class="countdown">3</div><div class="in-game-overlay" hidden></div>
        </div>
        <div class="game-floor">TAP ANYWHERE IN A LANE &#183; HOLD GREEN TILES</div>`;
      app.sceneHost.replaceChildren(this.element);
      this.board = this.element.querySelector(".board");
      this.tilesLayer = this.element.querySelector(".tile-layer");
      this.effects = this.element.querySelector(".effects");
      this.lanes = [...this.element.querySelectorAll(".lane")];
      this.targets = [...this.element.querySelectorAll(".key-target")];
      this.overlay = this.element.querySelector(".in-game-overlay");
      this.countdown = this.element.querySelector(".countdown");
      this.feedback = this.element.querySelector(".feedback");
      this.comboDisplay = this.element.querySelector(".combo-display");
      this.scoreDisplay = this.element.querySelector(".score-display strong");
      this.safeLabel = this.element.querySelector(".safe-time");
      this.runTime = this.element.querySelector(".run-time");
      this.runSpeed = this.element.querySelector(".run-speed");
      this.line = this.element.querySelector(".hit-line");
      this.musicLine = this.element.querySelector(".music-line");
      this.musicEqualizer = this.element.querySelector(".track-eq");
      this.measure();
      this.fillAhead(0);
      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => this.measure());
        this.resizeObserver.observe(this.board);
      } else this.resources.listen(window, "resize", () => this.measure());
      this.installInput();
      this.music = new Music(app, song, () => this.clock(), (kind, detail) => this.setMusicStatus(kind, detail));
      this.setMusicStatus("loading", "Loading this world's song.");
      this.tick = this.tick.bind(this);
      this.raf = requestAnimationFrame(this.tick);
    }
    measure() {
      this.height = Math.max(100, this.board.clientHeight);
      this.hitY = this.height * CONFIG.hitRatio;
      this.notes.forEach(note => this.sizeNote(note));
      this.paint(this.clock());
    }
    sizeNote(note) {
      note.height = note.duration ? clamp(note.duration * this.hitY / note.travel + 40, 100, Math.max(100, this.height * .62)) : Math.min(58, this.height * .2);
      note.el.style.height = `${note.height}px`;
      if (note.state === "holding") note.holdY = clamp(note.holdY, 4, Math.max(4, this.hitY - note.height));
    }
    fillAhead(time) {
      this.notes = this.notes.filter(note => {
        if (note.state === "hit" || note.state === "missed" && time >= note.retire) {
          note.el.remove(); return false;
        }
        return true;
      });
      while (this.nextNote.spawn <= time + CONFIG.chartLookaheadMs) {
        const data = this.nextNote;
        const el = document.createElement("div");
        el.className = `tile${data.duration ? " long" : ""}`;
        el.style.setProperty("--lane", data.lane); el.hidden = true;
        el.innerHTML = `<div class="tile-body">${data.duration ? '<i class="hold-track"></i><i class="hold-fill"></i><i class="hold-runner"></i>' : '<i class="tap-dot"></i>'}</div>`;
        const note = { ...data, state: "pending", el, runner: el.querySelector(".hold-runner"), fill: el.querySelector(".hold-fill") };
        this.sizeNote(note); this.tilesLayer.appendChild(el); this.notes.push(note);
        if (this.firstHoldId === null && note.duration) this.firstHoldId = note.id;
        this.nextNote = this.chart.next();
      }
    }
    clock(now = performance.now()) {
      return this.phase === "playing" ? this.elapsed + Math.max(0, now - this.anchor) : this.elapsed;
    }
    begin() {
      if (this.disposed || this.finished) return;
      if (this.phase === "playing") this.elapsed = this.clock();
      this.countdown.hidden = true;
      if (this.app.state.muted || this.music.silent) {
        this.music.pause(); this.music.updateVolume();
        this.phase = "playing"; this.anchor = performance.now(); this.lastFrameAt = this.anchor; this.overlay.hidden = true;
        this.setMusicStatus("muted", "Playing without music by your choice.");
        return;
      }
      this.waitForMusic();
      this.music.play();
      if (this.music.playing) this.startWithMusic();
    }
    waitForMusic() {
      if (this.phase === "playing") this.elapsed = this.clock();
      this.phase = "music-wait";
      this.countdown.hidden = true;
      this.renderMusicWait();
    }
    renderMusicWait() {
      if (this.phase !== "music-wait") return;
      const kind = this.music.kind;
      const loading = kind === "loading" || kind === "buffering";
      this.showOverlay("music-wait-overlay", `<span class="medallion">${icon("music")}</span>
        <h2>${kind === "error" ? "Song not found" : loading ? "Loading your song" : "Tap to start the song"}</h2>
        <p class="original-track-name">${esc(this.song.title)} &#183; ${esc(this.song.world)}</p>
        <p>${esc(this.music.detail || "Start the song to continue. Your game clock is paused.")}</p>
        <button class="primary-button" data-action="${kind === "error" ? "music-retry" : "enable-music"}" ${loading ? "disabled" : ""}>${icon("play")} ${loading ? "Loading..." : kind === "error" ? "Retry" : "Play song"}</button>
        <div class="button-row"><button class="secondary-button" data-action="music-silent">Play without music</button><button class="secondary-button" data-action="home">Worlds</button></div>`);
    }
    startWithMusic() {
      if (this.phase !== "music-wait" || !this.music.playing) return;
      if (document.hidden || this.app.isLandscape() || this.app.modal) { this.pause("Resume when you are ready."); return; }
      if ([...this.holds.keys()].some(lane => !this.sources[lane].size)) {
        this.phase = "rehold"; this.music.pause();
        this.holds.forEach(note => this.lanes[note.lane].classList.add("is-target"));
        this.showOverlay("tutorial", `<span class="medallion green">${icon("hand")}</span><h2>Pick up your hold</h2><p>Hold the highlighted green lane to continue the song.</p>`);
        return;
      }
      this.phase = "playing"; this.anchor = performance.now(); this.lastFrameAt = this.anchor; this.overlay.hidden = true;
      this.musicEqualizer.classList.toggle("is-playing", this.app.state.volume > 0);
    }
    enableMusic(retry = false) {
      if (this.disposed || this.finished || this.app.modal || this.app.isLandscape()) return;
      this.app.state.muted = false;
      if (this.app.state.volume === 0) this.app.state.volume = .75;
      this.app.save(); this.music.silent = false; this.music.updateVolume();
      if (this.phase === "paused") { this.resume(); return; }
      if (!["music-wait", "playing"].includes(this.phase)) return;
      this.waitForMusic();
      if (retry || this.music.kind === "error") this.music.retry();
      else this.music.play();
    }
    continueSilently() {
      if (this.phase !== "music-wait") return;
      this.music.silent = true; this.music.pause(); this.music.updateVolume();
      if ([...this.holds.keys()].some(lane => !this.sources[lane].size)) {
        this.phase = "paused"; this.resume();
      } else this.begin();
    }
    applyMusicSettings() {
      this.music.updateVolume();
      if (this.app.state.muted) {
        this.music.pause();
        if (this.phase === "music-wait") this.begin();
        this.setMusicStatus("muted", "Music is off.");
      } else if (this.phase === "playing" && !this.music.silent) {
        this.begin();
      }
    }
    freeze(phase = "paused") {
      if (this.phase === "playing") this.elapsed = this.clock();
      this.phase = phase;
      this.music.pause();
    }
    clearInputs() {
      this.sources.forEach(set => set.clear());
      this.lanes.forEach(lane => lane.classList.remove("is-held"));
      this.targets.forEach(target => target.classList.remove("is-held"));
    }
    pause(reason = "Take a breath. Your progress is safe.") {
      if (!["playing", "countdown", "tutorial", "rehold", "music-wait"].includes(this.phase)) return;
      if (this.phase === "countdown") this.wasCountingDown = true;
      this.freeze("paused"); this.clearInputs();
      this.showOverlay("", `<span class="medallion">${icon("pause")}</span><h2>Music paused</h2><p>${esc(reason)}</p>
        <button class="primary-button" data-action="resume">${icon("play")} Resume</button>
        <div class="button-row"><button class="secondary-button" data-action="restart">${icon("replay")} Restart</button><button class="secondary-button" data-action="home">${icon("back")} Worlds</button></div>`);
    }
    resume() {
      if (this.phase !== "paused" || this.app.modal || this.app.isLandscape()) return;
      if (this.wasCountingDown) {
        this.wasCountingDown = false; this.phase = "countdown";
        this.countdownStart = performance.now(); this.countdown.hidden = false; this.overlay.hidden = true;
        return;
      }
      if (this.tutorialNote && !this.app.state.holdSeen) { this.enterTutorial(this.tutorialNote); return; }
      if (this.holds.size) {
        this.phase = "rehold";
        this.holds.forEach(note => this.lanes[note.lane].classList.add("is-target"));
        this.showOverlay("tutorial", `<span class="medallion green">${icon("hand")}</span><h2>Pick up your hold</h2><p>Hold the highlighted green lane${this.holds.size > 1 ? "s" : ""} to continue. No progress is lost.</p>`);
        return;
      }
      this.begin();
    }
    showOverlay(kind, html) {
      this.overlay.className = `in-game-overlay ${kind}`;
      this.overlay.innerHTML = `<div class="overlay-copy">${html}</div>`;
      this.overlay.hidden = false;
    }
    enterTutorial(note) {
      this.freeze("tutorial"); this.tutorialNote = note;
      this.tutorialReady = performance.now() + 900;
      this.lanes[note.lane].classList.add("is-target");
      this.showOverlay("tutorial", `<span class="medallion green">${icon("hand")}</span><h2>Hold the green tile</h2><p>Press <strong>${KEYS[note.lane]}</strong> or hold anywhere in its lane. Keep holding as the circle rises to the top.</p><small class="small-print">The game resumes when you hold this lane.</small>`);
    }
    installInput() {
      this.lanes.forEach((lane, index) => {
        this.resources.listen(lane, "pointerdown", event => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault();
          try { lane.setPointerCapture(event.pointerId); } catch (_) { /* Capture may already be released. */ }
          this.press(index, `pointer:${event.pointerId}`, stamp(event.timeStamp));
        }, { passive: false });
        const up = event => this.release(index, `pointer:${event.pointerId}`, stamp(event.timeStamp));
        this.resources.listen(lane, "pointerup", up);
        this.resources.listen(lane, "pointercancel", up);
        this.resources.listen(lane, "lostpointercapture", up);
        this.resources.listen(lane, "contextmenu", event => event.preventDefault());
      });
      this.resources.listen(document, "keydown", event => {
        if (this.app.modal || this.app.isLandscape() || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === "Escape" && !event.repeat) {
          event.preventDefault(); this.phase === "paused" ? this.resume() : this.pause(); return;
        }
        const lane = CODE_LANE[event.code] ?? KEYS.indexOf(event.key.toUpperCase());
        if (lane < 0 || lane > 3 || event.repeat) return;
        event.preventDefault(); this.press(lane, `key:${lane}`, stamp(event.timeStamp));
      });
      this.resources.listen(document, "keyup", event => {
        const lane = CODE_LANE[event.code] ?? KEYS.indexOf(event.key.toUpperCase());
        if (lane < 0 || lane > 3) return;
        this.release(lane, `key:${lane}`, stamp(event.timeStamp));
      });
    }
    press(lane, source, eventAt) {
      if (this.disposed || this.app.modal || !["playing", "tutorial", "rehold"].includes(this.phase)) return;
      const held = this.sources[lane];
      if (held.has(source)) return;
      const alreadyHeld = held.size > 0;
      held.add(source);
      this.lanes[lane].classList.add("is-held"); this.targets[lane].classList.add("is-held");
      if (this.phase === "tutorial") return;
      if (this.phase === "rehold") {
        if ([...this.holds.keys()].every(index => this.sources[index].size > 0)) {
          this.lanes.forEach(el => el.classList.remove("is-target")); this.begin();
        }
        return;
      }
      if (alreadyHeld || this.holds.has(lane)) return;
      const time = this.clock(eventAt);
      const note = this.notes.find(item => item.lane === lane && canHit(item, time));
      if (!note) { this.wrongKey(lane, time); return; }
      if (note.duration && !this.app.state.holdSeen) { this.enterTutorial(note); return; }
      this.accept(note, time);
    }
    accept(note, time) {
      if (note.state !== "pending") return;
      note.grade = gradeHit(note, time, this.app.state.timingOffset);
      if (note.duration) {
        note.state = "holding"; note.holdStart = time; note.holdEnd = time + note.duration;
        note.holdY = clamp(this.hitY - (note.time - time) * this.hitY / note.travel - note.height, 5, Math.max(5, this.hitY - note.height));
        note.el.hidden = false; note.el.classList.add("holding");
        this.holds.set(note.lane, note); this.say("hold", "HOLD");
      } else {
        note.state = "hit"; note.el.hidden = true; this.award(note, false);
      }
      this.flash(note.lane, note.duration ? "hold" : note.grade);
      if (this.app.state.vibration && typeof navigator.vibrate === "function") {
        try { navigator.vibrate(8); } catch (_) { /* Haptics are optional. */ }
      }
      this.paint(time);
    }
    release(lane, source, eventAt) {
      const held = this.sources[lane];
      if (!held.delete(source) || held.size > 0) return;
      this.lanes[lane].classList.remove("is-held"); this.targets[lane].classList.remove("is-held");
      if (this.phase !== "playing") return;
      const note = this.holds.get(lane);
      if (!note) return;
      const time = this.clock(eventAt);
      if (time >= note.holdEnd - Math.min(80, note.duration * .15)) this.completeHold(note);
      else this.miss(note, time, true);
    }
    completeHold(note) {
      if (note.state !== "holding") return;
      note.state = "hit"; note.el.hidden = true; this.holds.delete(note.lane);
      this.award(note, true); this.flash(note.lane, "hold");
    }
    award(note, hold) {
      const weights = { perfect: 1, great: .75, good: .5 };
      this.stats[note.grade] += 1; this.stats.weighted += weights[note.grade];
      this.combo += 1; this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += Math.round(weights[note.grade] * 100 * (1 + Math.min(this.combo, 60) / 100)) + (hold ? 150 : 0);
      this.scoreDisplay.textContent = this.score.toLocaleString();
      this.comboDisplay.hidden = this.combo < 3;
      this.comboDisplay.querySelector("strong").textContent = this.combo;
      this.say(note.grade, note.grade.toUpperCase());
    }
    wrongKey(lane, time) {
      this.flash(lane, "wrong");
      if (!CONFIG.wrongKeyCostsHeart) return;
      this.combo = 0; this.comboDisplay.hidden = true;
      this.say("miss", "WRONG KEY");
      if (time < this.immuneUntil) return;
      this.hp = Math.max(0, this.hp - 1); this.updateHearts();
      if (this.hp === 0) this.fail();
    }
    miss(note, time, early = false) {
      if (!["pending", "holding"].includes(note.state)) return;
      this.holds.delete(note.lane); note.state = "missed"; note.retire = time + 150;
      note.el.classList.remove("holding"); note.el.classList.add("missed");
      this.stats.missed += 1; this.combo = 0; this.comboDisplay.hidden = true;
      this.say(early ? "early" : "miss", early ? "EARLY" : "MISS");
      if (early) this.flash(note.lane, "wrong");
      if (time < this.immuneUntil) return;
      this.hp = Math.max(0, this.hp - 1); this.updateHearts();
      if (this.hp === 0) this.fail();
    }
    updateHearts() {
      const hearts = this.element.querySelector(".rhythm-hearts");
      [...hearts.children].forEach((heart, index) => heart.classList.toggle("lost", index >= this.hp));
      hearts.setAttribute("aria-label", `${this.hp} rhythm hearts`);
    }
    setMusicStatus(kind, detail = "") {
      if (!this.musicLine || this.disposed) return;
      const line = this.musicLine;
      if (this.app.state.muted || this.music && this.music.silent) {
        line.hidden = false; line.disabled = false; line.textContent = "MUSIC OFF";
        line.title = "You chose to play without music. Click to play the song file.";
        line.dataset.action = "enable-music";
        line.classList.remove("needs-tap", "has-error");
        this.musicEqualizer.classList.remove("is-playing");
        return;
      }
      const labels = {
        loading: "LOADING", ready: "SONG READY", buffering: "BUFFERING",
        blocked: "PLAY SONG", error: "ADD SONG FILE", paused: "MUSIC PAUSED",
        playing: "NOW PLAYING",
        muted: "MUSIC OFF"
      };
      line.hidden = false;
      line.textContent = labels[kind] || "BACKGROUND MUSIC";
      line.title = detail;
      line.disabled = ["loading", "ready", "buffering", "playing", "paused"].includes(kind);
      line.dataset.action = kind === "error" ? "music-retry" : "enable-music";
      line.classList.toggle("needs-tap", kind === "blocked");
      line.classList.toggle("has-error", kind === "error");
      this.musicEqualizer.classList.toggle("is-playing", kind === "playing" && this.phase === "playing" && this.app.state.volume > 0);
      if (kind === "playing") { this.startWithMusic(); return; }
      if (["buffering", "blocked", "error"].includes(kind) && this.phase === "playing" && !this.app.state.muted && !this.music.silent) {
        this.waitForMusic();
      } else if (this.phase === "music-wait") this.renderMusicWait();
    }
    say(kind, text) {
      this.resources.clear(this.feedbackTimer);
      this.feedback.dataset.kind = kind; this.feedback.textContent = text; this.feedback.hidden = false;
      this.animate(this.feedback, [{ opacity: .3, transform: "translateY(9px) scale(.86)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], 140);
      this.feedbackTimer = this.resources.later(() => { this.feedback.hidden = true; }, 500);
    }
    animate(el, frames, ms) {
      if (el.animate && !reducedMotion()) el.animate(frames, { duration: ms, easing: "ease-out" });
    }
    flash(lane, kind) {
      const burst = document.createElement("div"); burst.className = `burst ${kind}`; burst.style.setProperty("--lane", lane);
      this.effects.appendChild(burst);
      this.resources.later(() => burst.remove(), 500);
      if (kind === "wrong") {
        this.lanes[lane].classList.add("is-wrong"); this.targets[lane].classList.add("is-wrong");
        this.resources.clear(this[`wrongTimer${lane}`]);
        this[`wrongTimer${lane}`] = this.resources.later(() => {
          this.lanes[lane].classList.remove("is-wrong"); this.targets[lane].classList.remove("is-wrong");
        }, 250);
      } else {
        this.animate(this.line, [{ filter: "brightness(2.2)", transform: "scaleY(2.5)" }, { filter: "brightness(1)", transform: "scaleY(1)" }], 220);
      }
    }
    paint(time) {
      if (!this.notes || !this.hitY) return;
      for (const note of this.notes) {
        if (note.state === "hit" || note.state === "missed" && time >= note.retire || time < note.spawn) {
          note.el.hidden = true; continue;
        }
        note.el.hidden = false;
        const top = note.state === "holding" ? note.holdY : this.hitY - (note.time - time) * this.hitY / note.travel - note.height;
        note.el.style.transform = `translate3d(0,${top.toFixed(2)}px,0)`;
        if (note.state === "holding") {
          const progress = clamp((time - note.holdStart) / note.duration, 0, 1);
          const distance = progress * Math.max(0, note.height - 54);
          note.runner.style.transform = `translateY(${-distance}px)`;
          note.fill.style.height = `${distance}px`;
        }
      }
    }
    tick(now) {
      if (this.disposed || this.finished) return;
      if (this.phase === "playing" && this.lastFrameAt && now - this.lastFrameAt > 1800) {
        this.elapsed = this.lastRenderedTime; this.anchor = now;
        this.pause("The game paused to protect your hearts after a long interruption.");
      }
      this.lastFrameAt = now;
      if (this.phase === "countdown") {
        const since = now - this.countdownStart;
        const label = since < 700 ? "3" : since < 1400 ? "2" : since < 2100 ? "1" : "GO";
        if (label !== this.countdownLabel) {
          this.countdownLabel = label; this.countdown.textContent = label;
          this.animate(this.countdown, [{ transform: "scale(1.35)", opacity: .4 }, { transform: "scale(1)", opacity: 1 }], 210);
        }
        if (since >= 2450) this.begin();
      } else if (this.phase === "tutorial") {
        const note = this.tutorialNote;
        if (now >= this.tutorialReady && this.sources[note.lane].size > 0) {
          this.app.state.holdSeen = true; this.app.save();
          this.lanes[note.lane].classList.remove("is-target"); this.tutorialNote = null;
          this.begin(); this.accept(note, this.elapsed);
        }
      } else if (this.phase === "playing") {
        const time = this.clock(now);
        this.fillAhead(time);
        for (const note of this.notes) {
          if (note.id === this.firstHoldId && !this.app.state.holdSeen && note.state === "pending" && time >= note.spawn + 60) {
            this.enterTutorial(note); break;
          }
          if (note.state === "pending" && time > note.time + CONFIG.lateWindowMs) this.miss(note, time);
          if (note.state === "holding" && time >= note.holdEnd) this.completeHold(note);
          if (this.phase !== "playing") break;
        }
        if (this.phase === "playing") {
          if (now - this.lastHUD > 60) {
            this.runTime.textContent = timeLabel(time);
            this.runSpeed.textContent = `${paceAt(this.song, time).speed.toFixed(2)}x`;
            this.safeLabel.textContent = time < this.immuneUntil ? `SAFE ${Math.ceil((this.immuneUntil - time) / 1000)}s` : "";
            this.lastHUD = now;
          }
          const phase = time >= this.song.rampMs + 300000 ? 4 : time >= this.song.rampMs ? 3 : time >= this.song.rampMs * .66 ? 2 : time >= this.song.rampMs * .33 ? 1 : 0;
          if (phase > this.speedPhase) {
            this.speedPhase = phase;
            const toast = this.element.querySelector(".speed-toast");
            toast.hidden = false; toast.textContent = ["", "SPEED UP!", "KEEP THE RHYTHM!", "KEEP GOING!", "TOP SPEED!"][phase];
            this.resources.later(() => { toast.hidden = true; }, 1250);
          }
        }
      }
      this.lastRenderedTime = this.clock(now);
      this.paint(this.lastRenderedTime);
      this.raf = requestAnimationFrame(this.tick);
    }
    fail() {
      if (this.phase !== "playing") return;
      this.freeze("failed"); this.clearInputs();
      this.showOverlay("", `<span class="medallion pink">${icon("heart")}</span><h2>Out of hearts</h2><p>You survived ${timeLabel(this.elapsed)}.<br>Score: ${this.score.toLocaleString()}</p>
        <button class="primary-button" data-action="revive">${icon("ad")} Continue with an ad</button>
        <div class="button-row"><button class="secondary-button" data-action="give-up">See results</button><button class="secondary-button" data-action="restart">Play again free</button></div>`);
    }
    revive() {
      if (this.phase !== "failed") return;
      this.hp = CONFIG.rhythmHearts; this.updateHearts(); this.immuneUntil = this.elapsed + 2300;
      this.holds.forEach(note => { note.state = "missed"; note.retire = this.elapsed; this.stats.missed += 1; });
      this.holds.clear(); this.clearInputs(); this.begin();
    }
    finish() {
      if (this.finished || this.hp > 0) return;
      this.finished = true; this.phase = "ended"; this.music.pause();
      const judged = this.stats.perfect + this.stats.great + this.stats.good + this.stats.missed;
      const accuracy = judged ? Math.round(this.stats.weighted / judged * 100) : 0;
      const stars = this.score > 0 ? accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 45 ? 1 : 0 : 0;
      this.app.finishRound({ songId: this.song.id, score: this.score, maxCombo: this.maxCombo, accuracy, stars, survivedMs: this.elapsed, ...this.stats });
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true; cancelAnimationFrame(this.raf); this.resources.dispose();
      this.clearInputs(); this.music.dispose();
      if (this.resizeObserver) this.resizeObserver.disconnect();
    }
  }
  class App {
    constructor(root, options = {}) {
      this.root = root; this.state = initialState(); this.resources = new Resources();
      this.preview = options.preview === true || isLocal() || new URLSearchParams(location.search).get("preview") === "1";
      this.audioFiles = new Map(); this.screen = "home"; this.game = null; this.modal = null;
      this.lastResult = null; this.disposed = false; this.busy = false;
      this.root.classList.add("pw-root");
      this.root.innerHTML = `<div class="ambient" aria-hidden="true"></div>
        <div class="game-frame">
          <div class="scene-host"></div>
          <footer class="ad-dock" aria-label="Advertisement"><div class="banner-ad"><span class="sponsored">SPONSORED</span><ins class="adsbygoogle"></ins></div></footer>
        </div>
        <div class="rotate-cover" hidden>${icon("rotate")}<h2>Turn to the music</h2><p>Rotate your phone to portrait. Your game is paused safely while you turn.</p></div>`;
      this.frame = root.querySelector(".game-frame"); this.sceneHost = root.querySelector(".scene-host");
      this.ads = new Ads(this);
      this.resources.listen(root, "click", event => {
        const button = event.target.closest("[data-action]");
        if (!button || button.disabled) return;
        this.action(button.dataset.action, button).catch(error => this.toast(error.message || "Please try again."));
      });
      this.resources.listen(root, "input", event => this.onInput(event));
      this.resources.listen(root, "change", event => this.onChange(event));
      this.resources.listen(document, "keydown", event => this.handleModalKeys(event));
      this.resources.listen(document, "visibilitychange", () => {
        if (document.hidden && this.game) this.game.pause("Your game paused when you left the tab.");
      });
      this.resources.listen(window, "blur", () => { if (this.game) this.game.pause("Press Resume when you are ready."); });
      this.resources.listen(window, "resize", () => this.checkOrientation());
      this.resources.listen(window, "orientationchange", () => this.checkOrientation());
      this.resources.listen(document, "fullscreenchange", () => this.checkOrientation());
      this.showHome(); this.checkOrientation();
      this.bannerTimer = this.resources.later(() => this.ads.mountBanner(), 300);
    }
    save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch (_) { /* Private browsing may disable storage. */ } }
    get selectedSong() { return SONGS.find(song => song.id === this.state.selected) || SONGS[0]; }
    theme(song) {
      this.root.style.setProperty("--accent", song.accent);
      this.root.style.setProperty("--accent-soft", song.accent + "44");
      this.root.style.setProperty("--background-art", `url("${asset(song.image)}")`);
    }
    showHome() {
      if (this.game) { this.game.dispose(); this.game = null; }
      this.screen = "home"; this.theme(this.selectedSong);
      const song = this.selectedSong;
      this.sceneHost.innerHTML = `<section class="scene home-scene">
        <header class="home-top">
          <div class="wallet"><span class="counter hearts" title="Three rhythm hearts per run. Unlimited new games." aria-label="${CONFIG.rhythmHearts} rhythm hearts per run">${icon("heart")}<strong>${CONFIG.rhythmHearts}</strong></span><span class="counter gems">${icon("gem")}<strong data-wallet="gems">${this.state.gems.toLocaleString()}</strong></span></div>
          <nav class="toolbar" aria-label="Game options">${round("mute", this.state.muted ? "Enable sound" : "Mute sound", this.state.muted ? "mute" : "sound")}${round("help", "How to play", "info")}${round("settings", "Settings", "settings")}</nav>
        </header>
        <div class="brand-stage">${logo()}</div>
        <section class="worlds" aria-label="Choose a world">
          <div class="section-label">ENDLESS MODE &#183; UNLIMITED PLAYS</div>
          <div class="song-list">${SONGS.map((item, i) => this.songCard(item, i)).join("")}</div>
          <div class="home-actions"><button class="primary-button shine" data-action="play">${icon(this.state.unlocked[song.id] ? "play" : "lock")}<span>PLAY ${esc(song.world.toUpperCase())}</span></button><p class="home-hint">D F K L &#183; TAP ANYWHERE IN A LANE</p></div>
        </section>
      </section>`;
    }
    songCard(song, index) {
      const locked = !this.state.unlocked[song.id]; const selected = this.state.selected === song.id;
      return `<button type="button" class="song-card${selected ? " selected" : ""}" style="--song-accent:${song.accent}" data-action="select" data-song="${song.id}" aria-label="${esc(song.title)}${locked ? ", locked" : ""}" aria-pressed="${selected}">
        <span class="index">${String(index + 1).padStart(2,"0")}</span>
        <span class="cover"><img src="${asset(song.image)}" alt="" loading="lazy">${locked ? `<span class="cover-lock">${icon("lock")}</span>` : selected ? '<span class="equalizer"><i></i><i></i><i></i></span>' : ""}</span>
        <span class="song-copy"><span class="world-tag">${song.world}</span><strong>${esc(song.title)}</strong><small>${esc(song.artist)}</small><span class="song-meta"><span class="difficulty" aria-label="${song.label}">${[1,2,3,4,5].map(n => `<i class="${n <= song.difficulty ? "on" : ""}"></i>`).join("")}</span><span>Endless</span>${this.state.best[song.id] ? `<span class="personal-best">${this.state.best[song.id].toLocaleString()}</span>` : ""}</span></span>
        ${locked ? `<span class="unlock-chip">${icon("ad")}UNLOCK</span>` : `<span class="song-arrow">${icon("arrow")}</span>`}
      </button>`;
    }
    async selectSong(id) {
      const song = SONGS.find(item => item.id === id); if (!song || this.busy) return;
      this.state.selected = id; this.save();
      const scroll = this.root.querySelector(".song-list").scrollTop;
      this.showHome(); this.root.querySelector(".song-list").scrollTop = scroll;
      if (!this.state.unlocked[id]) await this.unlockSong(song);
    }
    async unlockSong(song) {
      if (this.busy || this.state.unlocked[song.id]) return;
      this.busy = true;
      try {
        const granted = await this.ads.reward("unlock-" + song.id, `Unlock ${song.world}`, `Watch one rewarded ad to unlock ${song.title}.`);
        if (granted && !this.disposed) {
          this.state.unlocked[song.id] = true; this.state.selected = song.id; this.save(); this.showHome(); this.toast(`${song.world} unlocked.`);
        }
      } finally { this.busy = false; }
    }
    async startRound(song = this.selectedSong) {
      if (this.busy || this.disposed) return;
      if (!this.state.unlocked[song.id]) { await this.unlockSong(song); return; }
      this.busy = true;
      try {
        this.closeModal(true);
        if (this.game) this.game.dispose();
        this.state.selected = song.id; this.save(); this.theme(song);
        this.screen = "game"; this.lastResult = null;
        this.game = new Game(this, song);
        this.tryPortrait();
        if (this.isLandscape() || document.hidden) this.game.pause("Return to portrait to continue.");
      } finally { this.busy = false; }
    }
    async tryPortrait() {
      if (!isMobile()) return;
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("portrait");
      } catch (_) { /* A portrait pause screen covers unsupported browsers. */ }
    }
    isLandscape() { return isMobile() && innerWidth > innerHeight + 40; }
    checkOrientation() {
      const blocked = this.isLandscape();
      this.root.querySelector(".rotate-cover").hidden = !blocked;
      if (blocked && this.game) this.game.pause("Rotate back to portrait, then press Resume.");
    }
    finishRound(result) {
      if (this.disposed) return;
      const song = SONGS.find(item => item.id === result.songId);
      result.newBest = result.score > this.state.best[song.id];
      if (result.newBest) this.state.best[song.id] = result.score;
      this.state.stars[song.id] = Math.max(result.stars, this.state.stars[song.id]);
      result.gems = result.score > 0 ? Math.floor(result.score / 500) + result.stars * 4 : 0;
      result.doubled = false; this.state.gems += result.gems; this.state.rounds += 1;
      result.interstitialPending = this.state.rounds % 2 === 0;
      this.lastResult = result; this.save();
      this.game.dispose(); this.game = null; this.showResult();
    }
    showResult() {
      const result = this.lastResult; if (!result) { this.showHome(); return; }
      const song = SONGS.find(item => item.id === result.songId);
      this.screen = "result"; this.theme(song);
      this.sceneHost.innerHTML = `<section class="scene result-scene">
        <header>${logo(true)}</header>
        <div class="result-content"><div class="result-eyebrow">${result.newBest ? "A NEW PERSONAL BEST" : "ENDLESS RUN COMPLETE"}</div>
          <div class="result-stars" aria-label="${result.stars} stars">${[1,2,3].map(n => icon("star", n <= result.stars ? "earned" : "")).join("")}</div>
          <p class="result-song">${esc(song.title)} &#183; ${song.world}</p>
          <p class="result-time">SURVIVED ${timeLabel(result.survivedMs)} &#183; PLAY AGAIN FOR FREE</p>
          <strong class="final-score">${result.score.toLocaleString()}</strong><span class="score-label">FINAL SCORE</span>
          ${result.newBest ? `<div class="new-best">${icon("crown")} NEW PERSONAL BEST</div>` : ""}
          <div class="gem-reward"><span class="gem-earned">${icon("gem")} +${result.gems * (result.doubled ? 2 : 1)} gems</span>${result.doubled ? '<span class="small-print">Doubled!</span>' : `<button class="double-button" data-action="double" ${result.gems ? "" : "disabled"}>${icon("ad")} 2x gems</button>`}</div>
          <div class="result-stats"><div><small>Accuracy</small><strong>${result.accuracy}%</strong></div><div><small>Best combo</small><strong>${result.maxCombo}</strong></div><div><small>Perfect</small><strong>${result.perfect}</strong></div></div>
          <div class="result-actions">${round("home", "Back to worlds", "home")}<button class="primary-button" data-action="replay">${icon("replay")} PLAY AGAIN</button>${round("next", "Next unlocked world", "next")}</div>
        </div></section>`;
    }
    async afterResult(action) {
      if (this.busy) return;
      this.busy = true;
      try {
        if (this.lastResult && this.lastResult.interstitialPending) {
          this.lastResult.interstitialPending = false;
          await this.ads.interstitial();
        }
      } finally { this.busy = false; }
      if (!this.disposed) action();
    }
    async action(action, button) {
      if (this.disposed) return;
      switch (action) {
        case "select": await this.selectSong(button.dataset.song); break;
        case "play": await this.startRound(); break;
        case "home": if (this.screen === "result") await this.afterResult(() => this.showHome()); else this.showHome(); break;
        case "replay": await this.afterResult(() => this.startRound()); break;
        case "next": {
          const index = SONGS.findIndex(song => song.id === this.state.selected);
          const song = [...SONGS.slice(index + 1), ...SONGS.slice(0,index + 1)].find(item => this.state.unlocked[item.id]);
          await this.afterResult(() => this.startRound(song)); break;
        }
        case "pause": if (this.game) this.game.pause(); break;
        case "resume": if (this.game) this.game.resume(); break;
        case "restart": {
          if (!this.game || this.busy) return;
          const song = this.game.song;
          if (this.game.phase === "failed") {
            this.game.finish();
            await this.afterResult(() => this.startRound(song));
          } else {
            this.game.dispose(); this.game = new Game(this, song);
          }
          break;
        }
        case "give-up": if (this.game) this.game.finish(); break;
        case "revive": {
          if (this.busy || !this.game || this.game.phase !== "failed") return;
          this.busy = true; const game = this.game;
          try { if (await this.ads.reward("extra-rhythm-hearts", "One more chance", "Watch a rewarded ad to continue with three rhythm hearts.") && this.game === game) game.revive(); }
          finally { this.busy = false; }
          break;
        }
        case "double": {
          if (this.busy || !this.lastResult || this.lastResult.doubled || !this.lastResult.gems) return;
          this.busy = true; const result = this.lastResult;
          try { if (await this.ads.reward("double-gems", "Double your gems", `Watch a rewarded ad for ${result.gems} additional gems.`) && result === this.lastResult && !result.doubled) { this.state.gems += result.gems; result.doubled = true; this.save(); this.showResult(); } }
          finally { this.busy = false; }
          break;
        }
        case "mute":
          this.state.muted = !this.state.muted; this.save();
          if (this.game) this.game.applyMusicSettings();
          if (this.screen === "home") this.showHome();
          break;
        case "enable-music":
          if (this.game) this.game.enableMusic();
          break;
        case "music-retry": if (this.game) this.game.enableMusic(true); break;
        case "music-silent": if (this.game) this.game.continueSilently(); break;
        case "settings": this.showSettings(); break;
        case "help": this.showHelp(); break;
        case "close": this.closeModal(); break;
        case "sound-toggle":
          this.state.muted = !this.state.muted; this.save();
          if (this.game) this.game.applyMusicSettings();
          if (this.screen === "home") this.showHome();
          this.showSettings();
          break;
        case "haptics-toggle": this.state.vibration = !this.state.vibration; this.save(); this.showSettings(); break;
        case "timing-reset": this.state.timingOffset = 0; this.save(); this.showSettings(); break;
        case "tutorial-reset": this.state.holdSeen = false; this.save(); this.toast("The next green tile will show the lesson."); break;
        case "upload": this.root.querySelector(".audio-input").click(); break;
        case "audio-reset": { const id = this.root.querySelector(".audio-select").value; const url = this.audioFiles.get(id); if (url) URL.revokeObjectURL(url); this.audioFiles.delete(id); this.toast(`Using ${audioFileName(id)} beside the game code.`); break; }
        case "reset": this.showReset(); break;
        case "reset-confirm": this.resetProgress(); break;
      }
    }
    onInput(event) {
      if (event.target.name === "volume") {
        this.state.volume = clamp(number(event.target.value),0,1); this.save();
        if (this.game) this.game.music.updateVolume();
        const label = this.root.querySelector("[data-volume-value]"); if (label) label.textContent = `${Math.round(this.state.volume * 100)}%`;
      } else if (event.target.name === "timing") {
        this.state.timingOffset = clamp(number(event.target.value),-120,120); this.save();
        const label = this.root.querySelector("[data-timing-value]"); if (label) label.textContent = `${this.state.timingOffset > 0 ? "+" : ""}${this.state.timingOffset} ms`;
      }
    }
    onChange(event) {
      if (!event.target.matches(".audio-input")) return;
      const file = event.target.files && event.target.files[0]; if (!file) return;
      if (file.size > 80 * 1024 * 1024) { this.toast("Please use an audio file under 80 MB."); return; }
      const id = this.root.querySelector(".audio-select").value;
      const old = this.audioFiles.get(id); if (old) URL.revokeObjectURL(old);
      this.audioFiles.set(id, URL.createObjectURL(file)); event.target.value = "";
      this.toast(`Audio added for ${SONGS.find(song => song.id === id).world}.`);
    }
    showModal(title, eyebrow, body, onDismiss) {
      this.closeModal(true); this.lastFocus = document.activeElement;
      const layer = document.createElement("div"); layer.className = "modal-layer";
      layer.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="piano-dialog-title"><header><div><span class="eyebrow">${esc(eyebrow)}</span><h2 id="piano-dialog-title">${esc(title)}</h2></div>${round("close", "Close dialog", "close")}</header>${body}</section>`;
      this.frame.appendChild(layer); this.modal = layer; this.modalDismiss = onDismiss || null;
      this.modalLocked = false;
      this.resources.listen(layer, "pointerdown", event => { if (event.target === layer) this.closeModal(); });
      layer.querySelector("button").focus({ preventScroll: true });
      return layer;
    }
    closeModal(silent = false) {
      if (!this.modal || this.modalLocked && !silent) return;
      const dismiss = this.modalDismiss; const focus = this.lastFocus;
      this.modal.remove(); this.modal = null; this.modalDismiss = null; this.modalLocked = false;
      if (!silent && dismiss) dismiss();
      if (focus && focus.isConnected && focus.focus) focus.focus({ preventScroll: true });
    }
    handleModalKeys(event) {
      if (!this.modal) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); this.closeModal(); }
      if (event.key === "Tab") {
        const focusable = [...this.modal.querySelectorAll("button:not(:disabled),a[href],input:not([type=hidden]),select")].filter(el => !el.hidden && el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    showSettings() {
      this.showModal("Settings", "MAKE IT YOURS", `
        <div class="setting-row"><span class="setting-icon">${icon("sound")}</span><span class="setting-copy"><strong>Background music</strong><small>Your MP3 repeats at normal speed for the entire run. No video.</small></span><button class="switch" role="switch" aria-label="Background music" aria-checked="${!this.state.muted}" data-action="sound-toggle"></button></div>
        <label class="slider-row"><input type="range" min="0" max="1" step=".05" name="volume" value="${this.state.volume}" aria-label="Music volume"><span data-volume-value>${Math.round(this.state.volume * 100)}%</span></label>
        <div class="setting-row"><span class="setting-icon">${icon("timer")}</span><span class="setting-copy"><strong>Timing calibration</strong><small>Adjust grading, not lane-wide tapping.</small></span><button class="text-button" data-action="timing-reset">Reset</button></div>
        <label class="slider-row"><input type="range" min="-120" max="120" step="5" name="timing" value="${this.state.timingOffset}" aria-label="Grading offset in milliseconds"><span data-timing-value>${this.state.timingOffset} ms</span></label>
        <div class="setting-row"><span class="setting-icon">${icon("sparkle")}</span><span class="setting-copy"><strong>Haptics</strong><small>Subtle feedback on supported phones.</small></span><button class="switch" role="switch" aria-label="Haptics" aria-checked="${this.state.vibration}" data-action="haptics-toggle"></button></div>
        <div class="setting-row"><span class="setting-icon">${icon("hand")}</span><span class="setting-copy"><strong>Hold-tile lesson</strong><small>Learn how to hold the green tiles.</small></span><button class="text-button" data-action="tutorial-reset">Replay</button></div>
        <section class="settings-section"><h3>Song filenames</h3><p>Place these files in the <strong>same folder</strong> as <code>piano-world.js</code> and your HTML file. No audio subfolder is needed.</p><dl class="song-filenames">${SONGS.map(song => `<div><dt>${song.world}</dt><dd>${audioFileName(song.id)}</dd></div>`).join("")}</dl><p>Or select an audio file from this device for the current session.</p><select class="audio-select" aria-label="World for your audio">${SONGS.map(song => `<option value="${song.id}" ${song.id === this.state.selected ? "selected" : ""}>${song.world} / ${esc(song.title)}${this.audioFiles.has(song.id) ? " (your file)" : ""}</option>`).join("")}</select><input class="audio-input" type="file" accept="audio/*" hidden><div class="button-row"><button class="secondary-button" data-action="upload">${icon("upload")} Choose audio</button><button class="secondary-button" data-action="audio-reset">Use folder file</button></div></section>
        <div class="button-row"><button class="text-button danger" data-action="reset">Reset saved progress</button></div>`);
    }
    showHelp() {
      this.showModal("Find your rhythm", "HOW TO PLAY", `<ul class="help-list">
        <li>${icon("play")}<span><strong>Tap anywhere in a lane.</strong> Press D, F, K, or L, or touch any part of the lane, as soon as a tile appears. You don't need to wait for the line.</span></li>
        <li>${icon("hand")}<span><strong>Hold the green tiles.</strong> Keep the key or finger down as the circle rises. Release when the hold finishes.</span></li>
        <li>${icon("shield")}<span><strong>Three hearts. No time limit.</strong> Your first 10 seconds are safe. After that, each missed tile <em>and each tap on a lane with no tile</em> costs a rhythm heart. The run continues until all three are gone. Start a new run for free as often as you like.</span></li>
        <li>${icon("timer")}<span><strong>Fast and endless.</strong> Tiles fall at double speed and keep speeding up. New patterns keep arriving without a song-length cutoff. At most two tiles are active at once.</span></li>
        <li>${icon("ad")}<span><strong>Optional rewards.</strong> Rewarded ads can unlock three worlds, revive your current run, and double earned gems. Starting a fresh run never costs a life.</span></li>
        <li>${icon("music")}<span><strong>Your music keeps playing.</strong> Place the MP3s beside the game code using the filenames in Settings. The chosen song repeats at its normal tempo, with no video or added piano sounds. Hosted offline playback requires the files to be cached first.</span></li>
      </ul>`);
    }
    showReset() {
      this.showModal("Start fresh?", "RESET PROGRESS", `<section class="reward-content"><p>This clears your scores, gems, unlocked worlds, and tutorial history on this browser.</p><div class="button-row"><button class="secondary-button" data-action="settings">Keep progress</button><button class="secondary-button danger" data-action="reset-confirm">Reset everything</button></div></section>`);
    }
    resetProgress() {
      this.state.best = Object.fromEntries(SONGS.map(song => [song.id,0]));
      this.state.stars = Object.fromEntries(SONGS.map(song => [song.id,0]));
      this.state.unlocked = Object.fromEntries(SONGS.map(song => [song.id,!song.locked]));
      this.state.selected = SONGS[0].id; this.state.gems = 0; this.state.rounds = 0; this.state.holdSeen = false;
      this.lastResult = null;
      this.save(); this.closeModal(); this.showHome(); this.toast("Your progress has been reset.");
    }
    toast(message) {
      const old = this.frame.querySelector(".toast"); if (old) old.remove();
      const el = document.createElement("div"); el.className = "toast"; el.setAttribute("role","status"); el.textContent = message;
      this.frame.appendChild(el); this.resources.later(() => el.remove(), 3100);
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true; this.closeModal(); if (this.game) this.game.dispose();
      this.resources.dispose();
      this.audioFiles.forEach(url => URL.revokeObjectURL(url)); this.audioFiles.clear(); this.root.replaceChildren();
    }
  }
  let adScriptPromise;
  function loadAdScript() {
    if (adScriptPromise) return adScriptPromise;
    window.adsbygoogle = window.adsbygoogle || [];
    if (CONFIG.h5AdsEnabled) {
      window.adBreak = window.adBreak || (options => window.adsbygoogle.push(options));
      window.adConfig = window.adConfig || (options => window.adsbygoogle.push(options));
    }
    adScriptPromise = new Promise(resolve => {
      const existing = document.querySelector('script[src*="pagead/js/adsbygoogle.js"]');
      if (existing) { resolve(true); return; }
      const script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CONFIG.adClient}`;
      const timeout = setTimeout(() => resolve(false), 8000);
      script.onload = () => { clearTimeout(timeout); resolve(true); };
      script.onerror = () => { clearTimeout(timeout); resolve(false); };
      document.head.appendChild(script);
    });
    return adScriptPromise;
  }

  class Ads {
    constructor(app) { this.app = app; this.busy = false; }
    async mountBanner() {
      if (this.app.preview || !CONFIG.bannerEnabled || location.protocol === "file:") return;
      if (!await loadAdScript() || this.app.disposed) return;
      const ins = this.app.root.querySelector("ins.adsbygoogle");
      if (!ins || ins.dataset.requested || ins.clientWidth === 0) return;
      ins.dataset.requested = "true";
      ins.setAttribute("data-ad-client", CONFIG.adClient);
      ins.setAttribute("data-ad-slot", CONFIG.bannerSlot);
      ins.setAttribute("data-ad-format", "horizontal");
      ins.setAttribute("data-full-width-responsive", "true");
      try { window.adsbygoogle.push({}); } catch (_) { /* The sponsored placeholder remains if no ad is available. */ }
    }
    reward(name, title, description) {
      if (this.busy || this.app.disposed) return Promise.resolve(false);
      this.busy = true;
      return new Promise(resolve => {
        let settled = false; let viewed = false; let timeout;
        const finish = granted => {
          if (settled) return;
          settled = true; clearTimeout(timeout); this.busy = false;
          this.app.closeModal(true);
          resolve(!!granted && !this.app.disposed);
        };
        const layer = this.app.showModal(title, this.app.preview ? "DEVELOPER PREVIEW" : "REWARDED AD", `
          <div class="reward-content"><span class="medallion">${icon("gift")}</span><h3>${esc(title)}</h3><p>${esc(description)}</p>
          ${this.app.preview ? '<span class="preview-label">TEST MODE - NO AD IS SERVED</span><p class="small-print">This tests the reward flow. It does not display a paid ad or generate revenue.</p>' : ""}
          <div class="reward-status" role="status">${this.app.preview ? "Ready to test your reward." : "Checking ad availability..."}</div>
          <button class="primary-button reward-watch" ${this.app.preview ? "" : "disabled"}>${icon("ad")} ${this.app.preview ? "Test reward" : "Loading..."}</button>
          <button class="text-button" data-action="close">Not now</button></div>`, () => finish(false));
        const button = layer.querySelector(".reward-watch");
        const status = layer.querySelector(".reward-status");
        if (this.app.preview) {
          button.addEventListener("click", () => finish(true), { once: true });
          return;
        }
        const unavailable = () => {
          if (settled) return;
          status.textContent = "No rewarded ad is available. No reward has been applied.";
          button.disabled = true; button.textContent = "Unavailable right now";
        };
        if (!CONFIG.h5AdsEnabled) { unavailable(); return; }
        loadAdScript().then(ready => {
          if (settled) return;
          if (!ready || typeof window.adBreak !== "function") { unavailable(); return; }
          timeout = setTimeout(unavailable, 10000);
          window.adBreak({
            type: "reward", name,
            beforeReward: showAd => {
              if (settled) return;
              clearTimeout(timeout); status.textContent = "An ad is ready. Watch it to earn your reward.";
              button.disabled = false; button.innerHTML = `${icon("ad")} Watch ad`;
              button.onclick = () => { if (!settled) { button.disabled = true; showAd(); } };
            },
            beforeAd: () => {
              if (settled) return;
              this.app.modalLocked = true; layer.style.visibility = "hidden";
              if (this.app.game) this.app.game.music.pause();
            },
            afterAd: () => { if (!settled) { this.app.modalLocked = false; layer.style.visibility = ""; } },
            adViewed: () => { if (!settled) viewed = true; },
            adDismissed: () => { viewed = false; },
            // Rewards are granted only after the provider confirms completion.
            adBreakDone: () => {
              if (settled) return;
              if (viewed) finish(true);
              else { this.app.modalLocked = false; layer.style.visibility = ""; unavailable(); }
            }
          });
        }).catch(unavailable);
      });
    }
    interstitial() {
      if (this.busy || this.app.disposed || !CONFIG.h5AdsEnabled && !this.app.preview) return Promise.resolve();
      if (this.app.preview) {
        return new Promise(resolve => {
          const layer = this.app.showModal("A quick intermission", "AFTER EVERY TWO ROUNDS", `<div class="reward-content"><span class="medallion">${icon("ad")}</span><h3>Ad break preview</h3><p>This is where your approved provider can show an interstitial. No paid ad is shown in this preview.</p><button class="primary-button interstitial-continue">Continue</button></div>`, resolve);
          layer.querySelector(".interstitial-continue").onclick = () => { this.app.closeModal(true); resolve(); };
        });
      }
      this.busy = true;
      return new Promise(resolve => {
        let settled = false;
        const finish = () => { if (settled) return; settled = true; clearTimeout(timeout); this.busy = false; resolve(); };
        const timeout = setTimeout(finish, 8000);
        loadAdScript().then(ready => {
          if (settled) return;
          if (!ready || typeof window.adBreak !== "function") { finish(); return; }
          window.adBreak({ type: "next", name: "piano-two-round-break", beforeAd: () => { clearTimeout(timeout); }, adBreakDone: finish });
        }).catch(finish);
      });
    }
  }

  let currentApp = null;
  window.PianoWorld = {
    config: CONFIG,
    songs: SONGS,
    buildChart,
    createEndlessChart,
    paceAt,
    mount(root, options) {
      if (currentApp) currentApp.dispose();
      currentApp = new App(root, options);
      const app = currentApp;
      return () => { app.dispose(); if (currentApp === app) currentApp = null; };
    }
  };
  function bootstrap() {
    const root = document.querySelector("[data-piano-autostart]");
    if (root) window.PianoWorld.mount(root);
    // Offline support: cache the game and its song files after the first visit.
    if ("serviceWorker" in navigator && location.protocol.startsWith("http") && root) {
      navigator.serviceWorker.register(new URL("sw.js", BASE).href, { updateViaCache: "none" }).catch(() => { /* Offline cache is optional. */ });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  else bootstrap();
})();
