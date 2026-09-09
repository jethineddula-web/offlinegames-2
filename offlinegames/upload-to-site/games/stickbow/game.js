(function (global) {
  "use strict";

  var AD_CLIENT = "ca-pub-4203857211510947";
  var AD_SLOT_BANNER = "7417753724";
  var SAVE_KEY = "stickbow-save-v1";
  var SAVE_VERSION = 2;
  var STEP = 1 / 60;
  var MAX_LEVEL = 100;

  var ICO_MUTE =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="sp-body" d="M4.5 9.5v5h3.2L13 19.2V4.8L7.7 9.5H4.5z"/><path d="M16.2 9.2a4.2 4.2 0 0 1 0 5.6"/><path d="M18.6 7a7.2 7.2 0 0 1 0 10"/></svg>';
  var ICO_UNMUTE =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="sp-body" d="M4.5 9.5v5h3.2L13 19.2V4.8L7.7 9.5H4.5z"/><path d="M16.2 9.2l5.2 5.6"/><path d="M21.4 9.2l-5.2 5.6"/></svg>';
  var ICO_PAUSE =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14"/><path d="M17 5v14"/></svg>';

  var LEVEL_NAMES = [
    "First Toss", "Easy Rise", "Soft Arc", "The Leaf", "Close Hand", "High Throw", "Two Up", "Side Spin", "Quick Pop", "Fairground",
    "Long Walk", "Far Hand", "The Gap", "Reach", "Midfield", "Crosscourt", "Away Post", "Deep Toss", "The Lane", "County Line",
    "Crossbreeze", "Soft Wind", "Left Drift", "Right Drift", "The Flag", "Gust", "Shear", "Weather", "Pennant", "Windy Day",
    "Snap", "The Whip", "Fastball", "No Hang", "Flick", "Short Fuse", "Rapid", "Staccato", "Rush", "Quickfire",
    "High Arc", "Moon Toss", "Hang Time", "Rainbow", "The Loft", "Cloud", "Ceiling", "Sky Toss", "Apex", "County Fair",
    "Twin Loft", "Double Hand", "Pair", "Split Toss", "Two Beat", "Echo", "Juggle", "Overlap", "Together", "Midseason",
    "Tiny Ten", "Pip", "Pippin", "Needle", "Small Core", "Bead", "Pipkin", "The Pip", "Speck", "Regional",
    "Dust Devil", "Gale", "Storm", "Hard Left", "Hard Right", "Cyclone", "Front", "The Blow", "Tempest", "National",
    "Burst", "Three at Once", "The Dance", "Gauntlet", "Irregular", "Offbeat", "Stumble", "Syncopation", "Flurry", "Trueflight",
    "Golden", "Championship", "Last Quiver", "The Core", "Master Loft", "Far Needle", "Final Gust", "No Mercy", "Stickmark", "Century",
  ];

  var TOSS_STYLES = ["lob", "snap", "float", "cross", "pop", "drift", "arc", "burst", "shear", "gauntlet"];

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function styleKit(style, t, n) {
    switch (style) {
      case "lob":
        return { tossVy: -(580 + t * 140), gravity: 620 + t * 90, waitMin: 1.05, waitMax: 2.55, spread: 22 + t * 36, vxBias: 0.14, simultaneous: 1, tossDur: 0.52, bounce: 0, sway: 0 };
      case "snap":
        return { tossVy: -(880 + t * 400), gravity: 1060 + t * 160, waitMin: 0.18, waitMax: 0.72, spread: 86 + t * 110, vxBias: 0.48, simultaneous: n < 28 ? 1 : 2, tossDur: 0.26, bounce: 0, sway: 0 };
      case "float":
        return { tossVy: -(400 + t * 150), gravity: 500 + t * 70, waitMin: 1.05, waitMax: 2.7, spread: 16, vxBias: 0.08, simultaneous: 1, tossDur: 0.58, bounce: 0, sway: 22 + t * 40 };
      case "cross":
        return { tossVy: -(640 + t * 280), gravity: 820 + t * 110, waitMin: 0.5, waitMax: 1.55, spread: 48 + t * 90, vxBias: 0.78, simultaneous: 1, tossDur: 0.4, bounce: 0, sway: 0 };
      case "pop":
        return { tossVy: -(1020 + t * 200), gravity: 1220 + t * 70, waitMin: 0.32, waitMax: 1.05, spread: 28, vxBias: 0.04, simultaneous: 1, tossDur: 0.28, bounce: 0, sway: 0 };
      case "drift":
        return { tossVy: -(560 + t * 210), gravity: 740 + t * 70, waitMin: 0.65, waitMax: 1.95, spread: 120 + t * 90, vxBias: 0.2, simultaneous: n < 32 ? 1 : 2, tossDur: 0.46, bounce: 0, sway: 60 + t * 95 };
      case "arc":
        return { tossVy: -(740 + t * 240), gravity: 760 + t * 50, waitMin: 0.55, waitMax: 1.7, spread: 38, vxBias: 0.34, simultaneous: 1, tossDur: 0.48, bounce: n >= 16 ? 0.48 + t * 0.14 : 0, sway: 0 };
      case "burst":
        return { tossVy: -(720 + t * 300), gravity: 900 + t * 110, waitMin: 1.1, waitMax: 2.35, spread: 95 + t * 80, vxBias: 0.32, simultaneous: n < 18 ? 1 : n > 50 ? 3 : 2, tossDur: 0.3, bounce: 0, sway: 0, burst: n > 12 };
      case "shear":
        return { tossVy: -(620 + t * 230), gravity: 840 + t * 90, waitMin: 0.42, waitMax: 1.35, spread: 64, vxBias: 0.26, simultaneous: 1, tossDur: 0.38, bounce: 0, sway: 24 };
      default:
        return { tossVy: -(780 + t * 340), gravity: 940 + t * 150, waitMin: 0.28, waitMax: 1.15, spread: 110 + t * 90, vxBias: 0.42, simultaneous: n < 20 ? 1 : n < 40 ? 2 : 3, tossDur: 0.28, bounce: n > 72 ? 0.4 : 0, sway: 28 + t * 46, burst: n > 20 };
    }
  }

  function buildLevels() {
    var list = [];
    for (var i = 0; i < MAX_LEVEL; i++) {
      var n = i + 1;
      var t = i / (MAX_LEVEL - 1);
      var slot = i % 10;
      var style = TOSS_STYLES[slot];
      var kit = styleKit(style, t, n);
      var arrows, tosses, need;
      if (n <= 2) {
        arrows = 6; tosses = 3; need = 1;
      } else if (n <= 5) {
        arrows = 5; tosses = 4; need = 1;
      } else if (n <= 10) {
        arrows = 5; tosses = 4; need = 2;
      } else if (n <= 18) {
        arrows = 5; tosses = 5; need = 2;
      } else if (n <= 28) {
        arrows = 4; tosses = 5; need = 3;
      } else if (n <= 42) {
        arrows = 4; tosses = 6; need = 3;
      } else if (n <= 58) {
        arrows = 4; tosses = 6; need = 4;
      } else if (n <= 72) {
        arrows = 3; tosses = 7; need = 4;
      } else if (n <= 88) {
        arrows = 3; tosses = 7; need = 5;
      } else {
        arrows = 3; tosses = 8; need = 6;
      }
      if (n > 22 && n % 17 === 0) need = Math.min(tosses, need + 1);
      if (kit.burst) tosses = Math.max(tosses, need + 1);
      need = Math.min(need, tosses);

      var range;
      if (style === "cross") range = 0.58 + t * 0.4;
      else if (style === "lob" || style === "float") range = 0.1 + t * 0.32;
      else if (style === "pop") range = 0.18 + t * 0.28;
      else if (style === "gauntlet") range = 0.48 + t * 0.48;
      else range = 0.2 + t * 0.55 + (hash(n * 4.1) - 0.5) * 0.2;
      range = clamp(range, 0.08, 0.98);

      var appleR = lerp(11.4, 6.1, t);
      if (style === "pop" || (n >= 61 && n <= 70)) appleR *= 0.78;
      if (n >= 90) appleR *= 0.86;
      appleR = Math.max(5.5, appleR);

      var wind = 0;
      var gust = 0;
      var windFlip = false;
      var windFreq = 1.55;
      if (n >= 8) {
        var mag = 16 + t * 155;
        if (style === "shear") mag *= 1.5;
        if (style === "float" || style === "lob") mag *= 0.5;
        wind = ((n + slot) % 2 === 0 ? 1 : -1) * mag * (0.5 + hash(n * 8.8) * 0.75);
        if (n >= 16) gust = 10 + t * 80;
        if (style === "shear" || (n >= 38 && slot === 3)) {
          windFlip = true;
          windFreq = 0.5 + t * 0.55;
        }
      }

      var predict = n < 8 ? 1 : n < 22 ? 0.86 : n < 42 ? 0.7 : n < 65 ? 0.54 : n < 85 ? 0.4 : 0.28;
      var delay = 0.18 + hash(n * 2.2) * 0.45;
      if (style === "float") delay += 0.35;
      if (slot === 2) delay += 0.5;

      list.push({
        n: n,
        name: LEVEL_NAMES[i],
        style: style,
        arrows: arrows,
        need: need,
        tosses: tosses,
        appleR: appleR,
        waitMin: kit.waitMin * lerp(1.05, 0.72, t),
        waitMax: kit.waitMax * lerp(1.12, 0.8, t),
        simultaneous: kit.simultaneous,
        tossVy: kit.tossVy,
        tossSpread: kit.spread,
        vxBias: kit.vxBias,
        gravity: kit.gravity,
        tossDur: kit.tossDur,
        wind: wind,
        gust: gust,
        windFlip: windFlip,
        windFreq: windFreq,
        bounce: kit.bounce,
        sway: kit.sway,
        burst: !!kit.burst,
        pierce: n >= 28 && (slot === 4 || slot === 9),
        golden: n >= 14 && n % 11 === 0,
        predict: predict,
        range: range,
        delay: delay,
      });
    }
    return list;
  }

  var LEVELS = buildLevels();

  function adsAllowed() {
    try {
      if (location.protocol === "file:") return false;
      var h = location.hostname;
      if (h === "127.0.0.1" || h === "localhost" || h === "0.0.0.0") return false;
    } catch (e) {
      return false;
    }
    return true;
  }

  function guardAdErrors() {
    if (global.__stickbowAdGuard) return;
    global.__stickbowAdGuard = true;
    global.addEventListener("error", function (e) {
      var name = e && e.error && e.error.name;
      var msg = (e && e.message) || "";
      if (name === "TagError" || /adsbygoogle|TagError|googlesyndication/i.test(String(msg))) {
        e.preventDefault();
      }
    });
    global.addEventListener("unhandledrejection", function (e) {
      var r = e.reason;
      var name = r && r.name;
      var msg = r && (r.message || String(r));
      if (name === "TagError" || /adsbygoogle|TagError|googlesyndication/i.test(String(msg || ""))) {
        e.preventDefault();
      }
    });
  }

  function loadAdsense() {
    guardAdErrors();
    if (!adsAllowed()) return;
    if (typeof document === "undefined") return;
    if (document.querySelector("script[data-stickbow-ads]")) return;
    var s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.dataset.stickbowAds = "1";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + AD_CLIENT;
    s.onerror = function () {};
    document.head.appendChild(s);
  }

  function defaultSave() {
    return {
      version: SAVE_VERSION,
      unlocked: 1,
      current: 1,
      best: 0,
      muted: false,
      volume: 0.9,
      scores: [],
    };
  }

  function loadSave() {
    try {
      var raw = global.localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      var data = JSON.parse(raw);
      var base = defaultSave();
      if (!data || typeof data !== "object") return base;
      return {
        version: SAVE_VERSION,
        unlocked: clamp(data.unlocked | 0, 1, MAX_LEVEL),
        current: clamp(data.current | 0, 1, MAX_LEVEL),
        best: data.best | 0,
        muted: !!data.muted,
        volume: typeof data.volume === "number" && isFinite(data.volume) ? clamp(data.volume, 0, 1) : 0.9,
        scores: Array.isArray(data.scores) ? data.scores : [],
      };
    } catch (e) {
      return defaultSave();
    }
  }

  function persist(save) {
    try {
      global.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {}
  }

  var mounted = null;

  function mount(el) {
    if (mounted) unmount();
    mounted = new Game(el);
    mounted.start();
  }

  function unmount() {
    if (!mounted) return;
    mounted.destroy();
    mounted = null;
  }

  function Game(root) {
    this.root = root;
    this.save = loadSave();
    this.levels = LEVELS;
    this.raf = 0;
    this.last = 0;
    this.acc = 0;
    this.alive = true;
    this.dpr = 1;
    this.W = 1280;
    this.H = 720;
    this.unit = 1;
    this.ground = 600;
    this.mode = "start";
    this.levelIndex = Math.max(0, this.save.current - 1);
    this.level = this.levels[this.levelIndex];
    this.arrowsLeft = this.level.arrows;
    this.tossesLeft = this.level.tosses;
    this.burstLeft = 0;
    this.hits = 0;
    this.shots = [];
    this.apples = [];
    this.arrow = null;
    this.particles = [];
    this.slashes = [];
    this.floaters = [];
    this.trauma = 0;
    this.hitstop = 0;
    this.time = 0;
    this.aiming = false;
    this.power = 0;
    this.aim = -0.55;
    this.pointerId = null;
    this.windNow = 0;
    this.spawnT = 0;
    this.adsUsed = 0;
    this.adTimer = 0;
    this.combo = 0;
    this.comboT = 0;
    this.lockedOrient = null;
    this.npc = { toss: 0, tossing: false, holdApple: true };
    this.player = { draw: 0 };
    this.motes = [];
    this.reduced = false;
    try {
      this.reduced = global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    this.audio = new AudioBus();
    this.audio.setLevel(this.save.volume, this.save.muted);
    this.build();
    this.bind();
    this.applyMuteUI();
    this.resize();
    this.syncLevel(this.levelIndex, true);
    this.show("start");
    loadAdsense();
    this.refreshAds();
    this.seedMotes();
  }

  Game.prototype.seedMotes = function () {
    this.motes = [];
    for (var i = 0; i < 28; i++) {
      this.motes.push({
        x: hash(i * 3.1),
        y: hash(i * 7.7),
        r: 0.8 + hash(i * 2.2) * 1.8,
        s: 4 + hash(i * 5.5) * 10,
        a: 0.06 + hash(i * 1.4) * 0.12,
      });
    }
  };

  Game.prototype.build = function () {
    this.root.innerHTML =
      '<div id="game-stage">' +
      '<canvas id="bx-canvas"></canvas>' +
      '<div class="hud" id="bx-hud" hidden>' +
      '<div class="hud-top">' +
      '<div class="chip"><span class="chip-label">Loft</span><span class="chip-value" id="bx-lane">01</span></div>' +
      '<div class="chip"><span class="chip-label">Hits</span><span class="chip-value" id="bx-goal">0 / 0</span></div>' +
      '<div class="chip"><span class="chip-label">Quiver</span><div class="quiver" id="bx-quiver"></div></div>' +
      '<div class="chip wind-chip"><span class="chip-label">Wind</span><span class="chip-value" id="bx-wind">Calm</span><div class="wind-bar"><span id="bx-windbar"></span></div></div>' +
      '<div class="hud-actions">' +
      '<button class="icon-btn" id="bx-extra" type="button" title="Extra arrows" hidden>+2</button>' +
      '<div class="sound-ctrl" id="bx-sound">' +
      '<button class="icon-btn" id="bx-mute" type="button" title="Volume" aria-expanded="false" aria-controls="bx-sound-bar"></button>' +
      '<div class="sound-bar" id="bx-sound-bar" role="group" aria-label="Volume">' +
      '<input id="bx-vol" type="range" min="0" max="100" step="1" value="90" aria-label="Volume" />' +
      '<span class="sound-pct" id="bx-vol-label">90%</span>' +
      "</div></div>" +
      '<button class="icon-btn" id="bx-pause" type="button" title="Pause">' +
      ICO_PAUSE +
      "</button>" +
      "</div></div>" +
      '<div class="hint" id="bx-hint">Drag to draw. Release to loose.</div>' +
      "</div>" +
      '<section class="overlay" id="ov-start">' +
      '<div class="panel"><div class="panel-inner">' +
      '<p class="kicker">Stick Archery</p><h1>Stickbow</h1>' +
      '<p class="lede">An NPC tosses a limited number of apples. Draw the bow, follow the dotted line, and hit them in the air. A hundred lofts — each one a different throw.</p>' +
      '<div class="stats"><div class="stat"><b id="st-lane">1</b><span>Loft</span></div>' +
      '<div class="stat"><b id="st-best">0</b><span>Hits</span></div>' +
      '<div class="stat"><b id="st-cleared">0</b><span>Cleared</span></div></div>' +
      '<div class="stack">' +
      '<button class="btn btn-primary" id="btn-play" type="button">Play</button>' +
      '<button class="btn btn-secondary" id="btn-continue" type="button">Continue</button>' +
      '<button class="btn btn-secondary" id="btn-lanes" type="button">Select loft</button>' +
      '<button class="btn btn-ghost" id="btn-how" type="button">How to shoot</button>' +
      "</div></div>" +
      '<div class="banner-slot" data-ad="start"></div>' +
      "</div></section>" +
      '<section class="overlay" id="ov-lanes" hidden>' +
      '<div class="panel"><div class="panel-inner">' +
      "<h2>Lofts</h2><p class=\"lede\">Unlocked lofts are ready. Distance, timing, and throw style change every loft.</p>" +
      '<div class="level-grid" id="bx-grid"></div>' +
      '<button class="btn btn-secondary" id="btn-lanes-back" type="button">Back</button>' +
      "</div></div></section>" +
      '<section class="overlay" id="ov-how" hidden>' +
      '<div class="panel"><div class="panel-inner">' +
      "<h2>How to shoot</h2>" +
      '<ul class="how-list">' +
      "<li><b>1</b><span>Press and drag. Pull length is power. Move up or down to aim.</span></li>" +
      "<li><b>2</b><span>A dotted line traces the flight. A ring on an apple means the shot will hit it.</span></li>" +
      "<li><b>3</b><span>The NPC only tosses a set number of apples. Hit the mark before the last one falls — they will not keep throwing.</span></li>" +
      "<li><b>4</b><span>Each loft changes the range, hang, wind, and timing. Later cores are smaller and less forgiving.</span></li>" +
      "<li><b>5</b><span>Out of arrows? Watch a short ad for two extra shots — twice per loft.</span></li>" +
      "</ul>" +
      '<button class="btn btn-primary" id="btn-how-ok" type="button">Got it</button>' +
      "</div></div></section>" +
      '<section class="overlay" id="ov-pause" hidden>' +
      '<div class="panel"><div class="panel-inner">' +
      "<h2>Paused</h2><p class=\"lede\" id=\"pause-copy\">The loft waits.</p>" +
      '<div class="stack">' +
      '<button class="btn btn-primary" id="btn-resume" type="button">Resume</button>' +
      '<button class="btn btn-secondary" id="btn-retry" type="button">Restart loft</button>' +
      '<button class="btn btn-ghost" id="btn-quit" type="button">Range desk</button>' +
      "</div></div>" +
      '<div class="banner-slot" data-ad="pause"></div>' +
      "</div></section>" +
      '<section class="overlay" id="ov-result" hidden>' +
      '<div class="panel"><div class="panel-inner">' +
      '<p class="kicker" id="rs-kicker">Loft 01</p>' +
      '<h2 id="rs-title">Clear</h2>' +
      '<p class="lede" id="rs-lede">Mark reached.</p>' +
      '<div class="shots" id="rs-shots"></div>' +
      '<div class="stats"><div class="stat"><b id="rs-score">0</b><span>Hits</span></div>' +
      '<div class="stat"><b id="rs-need">0</b><span>Mark</span></div>' +
      '<div class="stat"><b id="rs-left">0</b><span>Arrows</span></div></div>' +
      '<div class="stack" id="rs-actions"></div>' +
      "</div>" +
      '<div class="banner-slot" data-ad="result"></div>' +
      "</div></section>" +
      '<section class="overlay" id="ov-ad" hidden>' +
      '<div class="panel"><div class="panel-inner">' +
      "<h2>Extra arrows</h2>" +
      '<p class="lede">Watch a short ad for two more shots this loft.</p>' +
      '<div class="banner-slot" data-ad="reward" style="min-height:90px"></div>' +
      '<p class="ad-countdown" id="ad-count">Preparing ad…</p>' +
      '<div class="stack" style="margin-top:12px">' +
      '<button class="btn btn-primary" id="btn-ad-claim" type="button" disabled>Claim 2 arrows</button>' +
      '<button class="btn btn-ghost" id="btn-ad-skip" type="button">No thanks</button>' +
      "</div></div></div></section>" +
      '<section class="overlay" id="ov-win" hidden>' +
      '<div class="panel"><div class="panel-inner">' +
      '<p class="kicker">Range Master</p><h2>Stickmark</h2>' +
      '<p class="lede">All hundred lofts are clear. The apples remember every nock.</p>' +
      '<p class="complete-mark" id="win-best">Best 0</p>' +
      '<button class="btn btn-primary" id="btn-win" type="button">Back to desk</button>' +
      "</div>" +
      '<div class="banner-slot" data-ad="win"></div>' +
      "</div></section>" +
      "</div>";

    this.stage = this.root.querySelector("#game-stage");
    this.canvas = this.root.querySelector("#bx-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.hud = this.root.querySelector("#bx-hud");
    this.overlays = {
      start: this.root.querySelector("#ov-start"),
      lanes: this.root.querySelector("#ov-lanes"),
      how: this.root.querySelector("#ov-how"),
      pause: this.root.querySelector("#ov-pause"),
      result: this.root.querySelector("#ov-result"),
      ad: this.root.querySelector("#ov-ad"),
      win: this.root.querySelector("#ov-win"),
    };
  };

  Game.prototype.bind = function () {
    var self = this;
    this.onResize = function () {
      self.resize();
    };
    this.onVis = function () {
      self.audio.resume();
      if (document.hidden) self.persistNow();
    };
    this.onKey = function (e) {
      self.onKeyDown(e);
    };
    this.onDown = function (e) {
      self.pointerDown(e);
    };
    this.onMove = function (e) {
      self.pointerMove(e);
    };
    this.onUp = function (e) {
      self.pointerUp(e);
    };
    this.onCancel = function (e) {
      self.pointerUp(e, true);
    };

    global.addEventListener("resize", this.onResize);
    global.addEventListener("orientationchange", this.onResize);
    document.addEventListener("visibilitychange", this.onVis);
    global.addEventListener("keydown", this.onKey);
    this.stage.addEventListener("pointerdown", this.onDown);
    this.stage.addEventListener("pointermove", this.onMove);
    this.stage.addEventListener("pointerup", this.onUp);
    this.stage.addEventListener("pointercancel", this.onCancel);
    this.stage.addEventListener(
      "touchmove",
      function (e) {
        e.preventDefault();
      },
      { passive: false },
    );

    this.root.querySelector("#btn-play").onclick = function () {
      self.audio.unlock();
      self.lockOrientation();
      self.beginLevel(0, true);
    };
    this.root.querySelector("#btn-continue").onclick = function () {
      self.audio.unlock();
      self.lockOrientation();
      self.beginLevel(Math.max(0, self.save.current - 1), true);
    };
    this.root.querySelector("#btn-lanes").onclick = function () {
      self.audio.unlock();
      self.audio.click();
      self.buildGrid();
      self.show("lanes");
    };
    this.root.querySelector("#btn-lanes-back").onclick = function () {
      self.audio.click();
      self.show("start");
      self.refreshAds();
    };
    this.root.querySelector("#btn-how").onclick = function () {
      self.audio.unlock();
      self.audio.click();
      self.show("how");
    };
    this.root.querySelector("#btn-how-ok").onclick = function () {
      self.audio.click();
      self.show("start");
      self.refreshAds();
    };
    this.root.querySelector("#btn-resume").onclick = function () {
      self.audio.click();
      self.show(null);
      self.mode = "play";
    };
    this.root.querySelector("#btn-retry").onclick = function () {
      self.audio.click();
      self.beginLevel(self.levelIndex, true);
    };
    this.root.querySelector("#btn-quit").onclick = function () {
      self.audio.click();
      self.mode = "start";
      self.show("start");
      self.refreshHud();
      self.refreshAds();
    };
    this.root.querySelector("#bx-pause").onclick = function (e) {
      e.stopPropagation();
      self.togglePause();
    };
    this.root.querySelector("#bx-mute").onclick = function (e) {
      e.stopPropagation();
      self.audio.unlock();
      var ctrl = self.root.querySelector("#bx-sound");
      if (!ctrl.classList.contains("open")) {
        ctrl.classList.add("open");
        self.applyMuteUI();
        var slider = self.root.querySelector("#bx-vol");
        try {
          slider.focus({ preventScroll: true });
        } catch (err) {
          slider.focus();
        }
        return;
      }
      self.toggleMute();
    };
    this.root.querySelector("#bx-vol").onpointerdown = function (e) {
      e.stopPropagation();
      self.audio.unlock();
    };
    this.root.querySelector("#bx-vol").oninput = function (e) {
      e.stopPropagation();
      var v = clamp((e.target.value | 0) / 100, 0, 1);
      self.save.volume = v;
      self.save.muted = v < 0.005;
      self.audio.setLevel(self.save.volume, self.save.muted);
      self.applyMuteUI();
      persist(self.save);
    };
    this.root.querySelector("#bx-vol").onchange = function () {
      persist(self.save);
    };
    this.root.querySelector("#bx-sound").onpointerdown = function (e) {
      e.stopPropagation();
    };
    this.onDocPointer = function (e) {
      var ctrl = self.root.querySelector("#bx-sound");
      if (!ctrl || !ctrl.classList.contains("open")) return;
      if (ctrl.contains(e.target)) return;
      ctrl.classList.remove("open");
      self.applyMuteUI();
    };
    document.addEventListener("pointerdown", this.onDocPointer);
    this.root.querySelector("#bx-extra").onclick = function (e) {
      e.stopPropagation();
      self.offerAd();
    };
    this.root.querySelector("#btn-ad-claim").onclick = function () {
      self.claimAd();
    };
    this.root.querySelector("#btn-ad-skip").onclick = function () {
      self.audio.click();
      self.closeAd(false);
    };
    this.root.querySelector("#btn-win").onclick = function () {
      self.audio.click();
      self.mode = "start";
      self.show("start");
      self.refreshAds();
    };

    this.updateStartStats();
    global.__gameReady = true;
    global.__stickbow = this;
  };

  Game.prototype.lockOrientation = function () {
    var o = global.screen && global.screen.orientation;
    var type = null;
    try {
      type = o && o.type;
    } catch (e) {}
    if (!this.lockedOrient) {
      this.lockedOrient = type || (this.H > this.W ? "portrait" : "landscape");
    }
    var lockTo = this.lockedOrient.indexOf("portrait") === 0 ? "portrait" : "landscape";
    if (o && typeof o.lock === "function") {
      o.lock(lockTo).catch(function () {});
    }
    try {
      if (global.screen.lockOrientation) global.screen.lockOrientation(lockTo);
      if (global.screen.mozLockOrientation) global.screen.mozLockOrientation(lockTo);
      if (global.screen.msLockOrientation) global.screen.msLockOrientation(lockTo);
    } catch (e) {}
  };

  Game.prototype.destroy = function () {
    this.alive = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    global.removeEventListener("resize", this.onResize);
    global.removeEventListener("orientationchange", this.onResize);
    document.removeEventListener("visibilitychange", this.onVis);
    global.removeEventListener("keydown", this.onKey);
    if (this.onDocPointer) document.removeEventListener("pointerdown", this.onDocPointer);
    this.audio.close();
    this.root.innerHTML = "";
    if (global.__stickbow === this) global.__stickbow = null;
  };

  Game.prototype.start = function () {
    var self = this;
    this.last = 0;
    this.raf = requestAnimationFrame(function tick(ts) {
      if (!self.alive) return;
      self.raf = requestAnimationFrame(tick);
      if (!self.last) self.last = ts;
      var dt = (ts - self.last) / 1000;
      self.last = ts;
      if (dt > 0.1) dt = 0.1;
      self.acc += dt;
      while (self.acc >= STEP) {
        if (self.hitstop > 0) self.hitstop -= STEP;
        else self.update(STEP);
        self.acc -= STEP;
      }
      self.render();
    });
  };

  Game.prototype.resize = function () {
    var r = this.stage.getBoundingClientRect();
    var w = Math.max(1, r.width);
    var h = Math.max(1, r.height);
    this.dpr = Math.min(2, global.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.W = w;
    this.H = h;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.unit = clamp(Math.min(w, h) / 520, 0.62, 1.38);
    this.ground = h * (h > w * 1.05 ? 0.8 : 0.84);
    this.layoutRange();
    this.resizeApples();
    this.lockOrientation();
  };

  Game.prototype.layoutRange = function () {
    var w = this.W;
    var h = this.H;
    var portrait = h > w * 1.05;
    var rng = this.level && this.level.range != null ? this.level.range : 0.4;
    if (portrait) {
      this.playerX = w * lerp(0.2, 0.11, rng);
      this.npcX = w * lerp(0.72, 0.9, rng);
    } else {
      this.playerX = w * lerp(0.15, 0.07, rng);
      this.npcX = w * lerp(0.78, 0.94, rng);
    }
  };

  Game.prototype.appleRadius = function (gold) {
    var base = this.level ? this.level.appleR : 10;
    var minDim = Math.min(this.W, this.H);
    var scale = this.unit;
    if (minDim < 640) scale = clamp(this.unit * 1.18, 0.86, 1.05);
    var r = base * scale;
    if (gold) r *= 0.92;
    return clamp(r, minDim < 640 ? 8 : 6.2, 16);
  };

  Game.prototype.hitPad = function () {
    return Math.min(this.W, this.H) < 640 ? 14 : 10;
  };

  Game.prototype.resizeApples = function () {
    for (var i = 0; i < this.apples.length; i++) {
      this.apples[i].r = this.appleRadius(this.apples[i].gold);
    }
  };

  Game.prototype.bowPos = function () {
    var s = this.unit;
    return { x: this.playerX + 8 * s, y: this.ground - 76 * s };
  };

  Game.prototype.syncLevel = function (index, reset) {
    this.levelIndex = index;
    this.level = this.levels[index];
    this.windNow = this.level.wind;
    this.spawnT = this.level.delay || 0.28;
    this.burstLeft = 0;
    if (reset) {
      this.arrowsLeft = this.level.arrows;
      this.tossesLeft = this.level.tosses;
      this.hits = 0;
      this.shots = [];
      this.apples = [];
      this.arrow = null;
      this.adsUsed = 0;
      this.aiming = false;
      this.power = 0;
      this.combo = 0;
      this.npc.toss = 0;
      this.npc.tossing = false;
      this.npc.holdApple = true;
      this.player.draw = 0;
    }
    this.layoutRange();
    this.refreshHud();
  };

  Game.prototype.beginLevel = function (index, reset) {
    this.syncLevel(index, reset);
    this.save.current = index + 1;
    persist(this.save);
    this.mode = "play";
    this.show(null);
    this.refreshHud();
    this.audio.unlock();
    this.lockOrientation();
  };

  Game.prototype.show = function (name) {
    var keys = Object.keys(this.overlays);
    for (var i = 0; i < keys.length; i++) {
      var ov = this.overlays[keys[i]];
      if (name === keys[i]) ov.hidden = false;
      else ov.hidden = true;
    }
    this.hud.hidden = !!(name && name !== "pause");
    if (name === null) this.hud.hidden = false;
    if (name === "start") {
      this.hud.hidden = true;
      this.updateStartStats();
    }
    var sound = this.root.querySelector("#bx-sound");
    if (sound && name && name !== "pause") sound.classList.remove("open");
  };

  Game.prototype.updateStartStats = function () {
    this.root.querySelector("#st-lane").textContent = String(this.save.current);
    this.root.querySelector("#st-best").textContent = String(this.save.best);
    this.root.querySelector("#st-cleared").textContent = String(Math.max(0, this.save.unlocked - 1));
    this.root.querySelector("#btn-continue").hidden = this.save.unlocked <= 1 && this.save.current <= 1;
  };

  Game.prototype.buildGrid = function () {
    var grid = this.root.querySelector("#bx-grid");
    grid.innerHTML = "";
    var self = this;
    for (var i = 0; i < MAX_LEVEL; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "lvl";
      b.textContent = String(i + 1);
      if (i + 1 > this.save.unlocked) {
        b.classList.add("locked");
        b.disabled = true;
      } else {
        b.classList.add("unlocked");
        if (i + 1 === this.save.current) b.classList.add("current");
        (function (idx) {
          b.onclick = function () {
            self.audio.unlock();
            self.audio.click();
            self.lockOrientation();
            self.beginLevel(idx, true);
          };
        })(i);
      }
      grid.appendChild(b);
    }
  };

  Game.prototype.toggleMute = function () {
    if (this.save.muted) {
      this.save.muted = false;
      if (this.save.volume < 0.05) this.save.volume = 0.9;
    } else {
      this.save.muted = true;
    }
    this.audio.setLevel(this.save.volume, this.save.muted);
    this.applyMuteUI();
    persist(this.save);
    if (!this.save.muted) this.audio.click();
  };

  Game.prototype.applyMuteUI = function () {
    var muted = this.save.muted || this.save.volume < 0.005;
    var btn = this.root.querySelector("#bx-mute");
    btn.innerHTML = muted ? ICO_UNMUTE : ICO_MUTE;
    btn.title = muted ? "Unmute" : "Volume";
    var ctrl = this.root.querySelector("#bx-sound");
    var open = !!(ctrl && ctrl.classList.contains("open"));
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-pressed", muted ? "true" : "false");
    var slider = this.root.querySelector("#bx-vol");
    var shown = Math.round(this.save.volume * 100);
    slider.value = String(shown);
    slider.style.setProperty("--fill", shown + "%");
    this.root.querySelector("#bx-vol-label").textContent = String(shown) + "%";
    slider.setAttribute("aria-valuenow", String(shown));
    slider.setAttribute("aria-valuetext", muted && shown > 0 ? shown + "% muted" : shown + "%");
    if (ctrl) ctrl.classList.toggle("is-muted", muted);
  };

  Game.prototype.refreshHud = function () {
    var lv = this.level;
    this.root.querySelector("#bx-lane").textContent = (lv.n < 10 ? "0" : "") + lv.n;
    this.root.querySelector("#bx-goal").textContent = this.hits + " / " + lv.need;
    var q = this.root.querySelector("#bx-quiver");
    q.innerHTML = "";
    var total = Math.max(lv.arrows, this.arrowsLeft);
    for (var i = 0; i < total; i++) {
      var pip = document.createElement("i");
      if (i >= this.arrowsLeft) pip.className = "empty";
      q.appendChild(pip);
    }
    var w = this.windNow;
    var label = Math.abs(w) < 8 ? "Calm" : (w > 0 ? "Right " : "Left ") + Math.abs(w / 20).toFixed(1);
    this.root.querySelector("#bx-wind").textContent = label;
    var bar = this.root.querySelector("#bx-windbar");
    var p = clamp(w / 140, -1, 1);
    bar.style.left = 50 + p * 42 + "%";
    bar.style.marginLeft = "-5px";
    var extra = this.root.querySelector("#bx-extra");
    extra.hidden = !(this.mode === "play" && this.adsUsed < 2 && this.arrowsLeft <= 1 && this.tossesLeft > 0);
    this.root.querySelector("#bx-hint").textContent = this.aiming
      ? "Release to loose"
      : this.tossesLeft <= 0
        ? "Last apples — no more tosses."
        : this.tossesLeft === 1
          ? "Last toss."
          : lv.n === 1
            ? "Drag to draw. Hit the apple before it falls."
            : lv.name;
  };

  Game.prototype.togglePause = function () {
    if (this.mode === "play" || this.mode === "shot") {
      this.audio.click();
      this.mode = "pause";
      this.root.querySelector("#pause-copy").textContent = "Loft " + this.level.n + " · " + this.level.name;
      this.show("pause");
      this.refreshAds();
    } else if (this.mode === "pause") {
      this.audio.click();
      this.show(null);
      this.mode = "play";
    }
  };

  Game.prototype.onKeyDown = function (e) {
    var code = e.code;
    if (code === "KeyM") {
      this.toggleMute();
    }
    if (code === "Escape" || code === "KeyP" || code === "Space") {
      if (this.mode === "play" || this.mode === "pause" || this.mode === "shot") {
        e.preventDefault();
        this.togglePause();
      }
    }
  };

  Game.prototype.clientToLocal = function (e) {
    var r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  Game.prototype.pointerDown = function (e) {
    if (e.target.closest && e.target.closest("button, a, .panel, .sound-ctrl, input")) return;
    if (this.mode !== "play") return;
    if (this.arrow) return;
    if (this.arrowsLeft <= 0) return;
    this.audio.unlock();
    this.pointerId = e.pointerId;
    try {
      this.stage.setPointerCapture(e.pointerId);
    } catch (err) {}
    this.aiming = true;
    this.power = 0;
    this.updateAim(this.clientToLocal(e));
    this.audio.drawStart();
    e.preventDefault();
  };

  Game.prototype.pointerMove = function (e) {
    if (!this.aiming || e.pointerId !== this.pointerId) return;
    this.updateAim(this.clientToLocal(e));
    this.audio.drawUpdate(this.power);
    this.refreshHud();
  };

  Game.prototype.updateAim = function (p) {
    var bow = this.bowPos();
    var dx = p.x - bow.x;
    var dy = p.y - bow.y;
    var dist = Math.hypot(dx, dy);
    var maxd = Math.min(this.W, this.H) * 0.42;
    this.power = clamp((dist - 18) / maxd, 0, 1);
    var ang = Math.atan2(dy, dx);
    this.aim = clamp(ang, -1.38, 0.42);
    this.player.draw = this.power;
  };

  Game.prototype.pointerUp = function (e, cancel) {
    if (!this.aiming) return;
    if (e && this.pointerId !== null && e.pointerId !== this.pointerId) return;
    this.audio.drawStop();
    var power = this.power;
    this.aiming = false;
    this.pointerId = null;
    if (cancel || power < 0.08) {
      this.power = 0;
      this.player.draw = 0;
      this.refreshHud();
      return;
    }
    this.loose(power, this.aim);
  };

  Game.prototype.arrowSpeed = function (power) {
    return 420 + Math.pow(power, 0.85) * 980;
  };

  Game.prototype.loose = function (power, aim) {
    var bow = this.bowPos();
    var spd = this.arrowSpeed(power);
    this.arrow = {
      x: bow.x + Math.cos(aim) * 36 * this.unit,
      y: bow.y + Math.sin(aim) * 36 * this.unit,
      vx: Math.cos(aim) * spd,
      vy: Math.sin(aim) * spd,
      ang: aim,
      life: 0,
      pierced: 0,
    };
    this.mode = "shot";
    this.arrowsLeft = Math.max(0, this.arrowsLeft - 1);
    this.power = 0;
    this.player.draw = 0;
    this.audio.release(power);
    try {
      if (navigator.vibrate) navigator.vibrate(16);
    } catch (e) {}
    this.refreshHud();
  };

  Game.prototype.update = function (dt) {
    this.time += dt;
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - dt * 2.6);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    this.windNow = this.level.windFlip
      ? this.level.wind * Math.sin(this.time * (this.level.windFreq || 0.7))
      : this.level.wind + Math.sin(this.time * 1.6 + this.level.n) * this.level.gust;

    if (this.mode === "ad" && this.adTimer > 0) {
      this.adTimer -= dt;
      var left = Math.max(0, Math.ceil(this.adTimer));
      this.root.querySelector("#ad-count").textContent =
        left > 0 ? "Ad playing… " + left + "s" : "Reward ready";
      if (this.adTimer <= 0) this.root.querySelector("#btn-ad-claim").disabled = false;
    }

    this.stepNpc(dt);
    this.stepApples(dt);
    if (this.arrow) this.stepArrow(dt);
    this.stepFx(dt);

    if (this.mode === "start" || this.mode === "lanes" || this.mode === "how") {
      this.attractToss(dt);
    }

    if (this.mode === "play" || this.mode === "shot") this.refreshHud();
    if (this.aiming) this.player.draw = this.power;
    else this.player.draw += (0 - this.player.draw) * (1 - Math.exp(-14 * dt));
  };

  Game.prototype.attractToss = function (dt) {
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.apples.length < 2 && !this.npc.tossing) {
      this.startToss(true);
      this.spawnT = rand(1.2, 2.2);
    }
  };

  Game.prototype.stepNpc = function (dt) {
    var dur = this.npc.attract ? 0.42 : this.level.tossDur || 0.42;
    if (this.npc.tossing) {
      this.npc.toss += dt / dur;
      if (this.npc.toss >= 0.52 && this.npc.holdApple) {
        this.releaseApple();
      }
      if (this.npc.toss >= 1) {
        this.npc.tossing = false;
        this.npc.toss = 0;
        this.npc.holdApple = true;
      }
    } else if (this.mode === "play" || this.mode === "shot") {
      if (this.hits >= this.level.need) return;
      if (this.tossesLeft <= 0) {
        this.checkLaneEnd();
        return;
      }
      var air = this.liveApples();
      if (air < this.level.simultaneous) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.startToss(false);
          this.spawnT = this.nextWait();
        }
      }
    }
  };

  Game.prototype.liveApples = function () {
    var n = 0;
    for (var i = 0; i < this.apples.length; i++) if (!this.apples[i].dead) n++;
    return n;
  };

  Game.prototype.nextWait = function () {
    var lv = this.level;
    if (lv.burst) {
      if (this.burstLeft > 0) {
        this.burstLeft -= 1;
        return rand(0.12, 0.3);
      }
      if (this.tossesLeft >= 2 && Math.random() < 0.55) {
        this.burstLeft = 1 + (this.tossesLeft > 3 && Math.random() < 0.4 ? 1 : 0);
        return rand(0.14, 0.28);
      }
      return rand(lv.waitMin, lv.waitMax);
    }
    var u = Math.random();
    if (u < 0.2) return rand(0.12, 0.38);
    if (u < 0.34) return rand(lv.waitMax, lv.waitMax * 1.7);
    return rand(lv.waitMin, lv.waitMax);
  };

  Game.prototype.startToss = function (attract) {
    if (!attract) {
      if (this.tossesLeft <= 0) return;
      this.tossesLeft -= 1;
    }
    this.npc.tossing = true;
    this.npc.toss = 0;
    this.npc.holdApple = true;
    this.npc.attract = !!attract;
    this.audio.toss();
  };

  Game.prototype.releaseApple = function () {
    this.npc.holdApple = false;
    var lv = this.level;
    var hand = this.npcHand();
    var toward = this.playerX - this.npcX;
    var spread = (Math.random() * 2 - 1) * (this.npc.attract ? 70 : lv.tossSpread);
    var gold = !this.npc.attract && lv.golden && Math.random() < 0.34;
    var bias = this.npc.attract ? 0.35 : lv.vxBias;
    this.apples.push({
      x: hand.x,
      y: hand.y,
      vx: toward * bias + spread * 0.35,
      vy: this.npc.attract ? -640 : lv.tossVy * rand(0.88, 1.12),
      r: this.appleRadius(gold) * (this.npc.attract ? 1.05 : 1),
      rot: rand(0, Math.PI * 2),
      spin: rand(-3.4, 3.4),
      gold: gold,
      dead: false,
      bounce: this.npc.attract ? 0 : lv.bounce,
      bounced: false,
      sway: this.npc.attract ? 0 : lv.sway || 0,
      swayT: rand(0, Math.PI * 2),
    });
  };

  Game.prototype.npcHand = function () {
    var s = this.unit;
    var toss = this.npc.toss;
    var arm = lerp(0.9, -1.35, easeOut(clamp(toss, 0, 1)));
    var feetY = this.ground - 14 * s;
    var shX = 2 * s;
    var shY = -74 * s;
    var hx = shX + Math.cos(arm) * 40 * s;
    var hy = shY + Math.sin(arm) * 40 * s;
    return { x: this.npcX - hx, y: feetY + hy };
  };

  Game.prototype.stepApples = function (dt) {
    var g = this.level.gravity;
    var wind = this.windNow;
    for (var i = this.apples.length - 1; i >= 0; i--) {
      var a = this.apples[i];
      if (a.dead) {
        a.deadT += dt;
        if (a.deadT > 0.35) this.apples.splice(i, 1);
        continue;
      }
      a.vy += g * dt;
      a.vx += wind * dt * 0.35;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.sway) {
        a.swayT += dt;
        a.x += Math.sin(a.swayT * 3.1) * a.sway * dt;
      }
      a.rot += a.spin * dt;
      if (a.y + a.r >= this.ground - 4) {
        if (a.bounce && !a.bounced && a.vy > 80) {
          a.vy *= -a.bounce;
          a.y = this.ground - 4 - a.r;
          a.bounced = true;
          a.vx *= 0.72;
        } else {
          this.splatApple(a, false);
          this.apples.splice(i, 1);
          this.checkLaneEnd();
        }
      } else if (a.x < -60 || a.x > this.W + 60) {
        this.apples.splice(i, 1);
        this.checkLaneEnd();
      }
    }
  };

  Game.prototype.stepArrow = function (dt) {
    var a = this.arrow;
    a.life += dt;
    var ox = a.x;
    var oy = a.y;
    a.vy += 520 * dt;
    a.vx += this.windNow * dt * 0.42;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.ang = Math.atan2(a.vy, a.vx);

    var hit = this.hitAppleOnSegment(ox, oy, a.x, a.y);
    if (hit) {
      this.strikeApple(hit);
      if (this.mode !== "shot" && this.mode !== "play") {
        this.arrow = null;
        return;
      }
      if (this.level.pierce && a.pierced < 2) {
        a.pierced += 1;
        a.vx *= 0.78;
        a.vy *= 0.78;
      } else {
        this.arrow = null;
        this.finishShot(true);
        return;
      }
    }
    if (a.y >= this.ground - 2 || a.x > this.W + 80 || a.x < -80 || a.y < -120 || a.life > 3.2) {
      if (a.y >= this.ground - 2) this.stickDust(a.x, this.ground);
      this.arrow = null;
      this.finishShot(false);
    }
  };

  Game.prototype.hitAppleOnSegment = function (x0, y0, x1, y1) {
    for (var i = 0; i < this.apples.length; i++) {
      var ap = this.apples[i];
      if (ap.dead) continue;
      var d = distToSeg(ap.x, ap.y, x0, y0, x1, y1);
      if (d <= ap.r + this.hitPad()) return ap;
    }
    return null;
  };

  function distToSeg(px, py, x0, y0, x1, y1) {
    var dx = x1 - x0;
    var dy = y1 - y0;
    var l2 = dx * dx + dy * dy;
    if (l2 < 0.001) return Math.hypot(px - x0, py - y0);
    var t = clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1);
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
  }

  Game.prototype.strikeApple = function (ap) {
    var worth = ap.gold ? 2 : 1;
    ap.dead = true;
    ap.deadT = 0;
    this.hits += worth;
    this.combo += 1;
    this.comboT = 1.25;
    this.shots.push(ap.gold ? "gold" : "hit");
    this.audio.hit(ap.gold);
    this.burstApple(ap);
    this.addSlash(ap.x, ap.y);
    this.floaters.push({
      x: ap.x,
      y: ap.y,
      text: ap.gold ? "+2" : this.combo > 1 ? "x" + this.combo : "+1",
      color: ap.gold ? "#e8b02a" : "#f4f4f2",
      t: 0,
    });
    this.trauma = this.reduced ? 0.1 : ap.gold ? 0.62 : 0.38;
    this.hitstop = this.reduced ? 0 : 0.055;
    try {
      if (navigator.vibrate) navigator.vibrate(ap.gold ? 28 : 14);
    } catch (e) {}
    if (this.hits >= this.level.need && (this.mode === "play" || this.mode === "shot")) {
      this.arrow = null;
      this.finishLane(true);
    }
  };

  Game.prototype.finishShot = function (hit) {
    if (this.mode !== "play" && this.mode !== "shot") return;
    if (!hit) this.shots.push("miss");
    this.mode = "play";
    this.player.draw = 0;
    this.refreshHud();
    this.checkLaneEnd();
  };

  Game.prototype.checkLaneEnd = function () {
    if (this.mode !== "play" && this.mode !== "shot") return;
    if (this.hits >= this.level.need) {
      this.finishLane(true);
      return;
    }
    if (this.arrowsLeft <= 0 && !this.arrow) {
      if (this.adsUsed < 2 && this.tossesLeft > 0) this.offerAd(true);
      else this.finishLane(false, this.tossesLeft <= 0 ? "tosses" : "arrows");
      return;
    }
    if (this.tossesLeft <= 0 && !this.npc.tossing && this.liveApples() === 0 && !this.arrow) {
      this.finishLane(false, "tosses");
    }
  };

  Game.prototype.splatApple = function (ap) {
    this.burstApple(ap);
    this.audio.miss();
  };

  Game.prototype.burstApple = function (ap) {
    var n = 12;
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      var s = rand(80, 220);
      this.particles.push({
        x: ap.x,
        y: ap.y,
        vx: Math.cos(ang) * s,
        vy: Math.sin(ang) * s - 40,
        life: rand(0.25, 0.55),
        max: 0.5,
        r: rand(2, 5),
        color: ap.gold ? "#e8b02a" : i % 3 === 0 ? "#7aaf3a" : "#e23c32",
      });
    }
  };

  Game.prototype.addSlash = function (x, y) {
    for (var i = 0; i < 4; i++) {
      this.slashes.push({
        x: x + rand(-8, 8),
        y: y + rand(-16, 8),
        h: rand(28, 54),
        a: rand(-0.2, 0.2),
        t: 0,
        w: rand(2, 4),
      });
    }
  };

  Game.prototype.stickDust = function (x, y) {
    for (var i = 0; i < 6; i++) {
      this.particles.push({
        x: x,
        y: y - 2,
        vx: rand(-40, 40),
        vy: rand(-80, -20),
        life: 0.3,
        max: 0.3,
        r: 2,
        color: "#6a6a6c",
      });
    }
    this.audio.miss();
  };

  Game.prototype.stepFx = function (dt) {
    var i;
    for (i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].t += dt;
      if (this.slashes[i].t > 0.28) this.slashes.splice(i, 1);
    }
    for (i = this.floaters.length - 1; i >= 0; i--) {
      this.floaters[i].t += dt;
      if (this.floaters[i].t > 0.9) this.floaters.splice(i, 1);
    }
  };

  Game.prototype.finishLane = function (won, reason) {
    if (this.mode === "result" || this.mode === "win") return;
    var lv = this.level;
    this.mode = "result";
    this.aiming = false;
    this.arrow = null;
    if (won) {
      this.audio.win();
      if (this.save.unlocked < lv.n + 1) this.save.unlocked = Math.min(MAX_LEVEL, lv.n + 1);
      this.save.current = Math.min(MAX_LEVEL, lv.n + 1);
      var prev = this.save.scores[lv.n - 1] | 0;
      if (this.hits > prev) this.save.scores[lv.n - 1] = this.hits;
      this.save.best = this.save.scores.reduce(function (a, b) {
        return a + (b | 0);
      }, 0);
      persist(this.save);
    }
    this.root.querySelector("#rs-kicker").textContent =
      "Loft " + (lv.n < 10 ? "0" : "") + lv.n + " · " + lv.name;
    this.root.querySelector("#rs-title").textContent = won ? "Clear" : "Short of the mark";
    this.root.querySelector("#rs-lede").textContent = won
      ? "The apples drop. Next loft throws a different way."
      : reason === "tosses"
        ? "No more tosses. Hit more of them next time."
        : "Not enough hits. Extra arrows are available, or try the loft again.";
    this.root.querySelector("#rs-score").textContent = String(this.hits);
    this.root.querySelector("#rs-need").textContent = String(lv.need);
    this.root.querySelector("#rs-left").textContent = String(this.arrowsLeft);
    var wrap = this.root.querySelector("#rs-shots");
    wrap.innerHTML = "";
    for (var i = 0; i < this.shots.length; i++) {
      var pip = document.createElement("div");
      var kind = this.shots[i];
      pip.className = "shot-pip" + (kind === "miss" ? " miss" : " hit");
      pip.textContent = kind === "miss" ? "—" : kind === "gold" ? "2" : "1";
      if (kind === "gold") pip.style.background = "#e8b02a";
      wrap.appendChild(pip);
    }
    var actions = this.root.querySelector("#rs-actions");
    actions.innerHTML = "";
    var self = this;
    if (won && lv.n >= MAX_LEVEL) {
      var done = document.createElement("button");
      done.className = "btn btn-primary";
      done.type = "button";
      done.textContent = "Take the stickmark";
      done.onclick = function () {
        self.audio.click();
        self.root.querySelector("#win-best").textContent = "Best " + self.save.best;
        self.mode = "win";
        self.show("win");
        self.refreshAds();
      };
      actions.appendChild(done);
    } else if (won) {
      var next = document.createElement("button");
      next.className = "btn btn-primary";
      next.type = "button";
      next.textContent = "Next loft";
      next.onclick = function () {
        self.audio.click();
        self.beginLevel(self.levelIndex + 1, true);
      };
      actions.appendChild(next);
    } else {
      if (this.adsUsed < 2 && this.tossesLeft > 0) {
        var adb = document.createElement("button");
        adb.className = "btn btn-primary";
        adb.type = "button";
        adb.textContent = "Watch ad for +2 arrows";
        adb.onclick = function () {
          self.offerAd();
        };
        actions.appendChild(adb);
      }
      var retry = document.createElement("button");
      retry.className = "btn btn-secondary";
      retry.type = "button";
      retry.textContent = "Restart loft";
      retry.onclick = function () {
        self.audio.click();
        self.beginLevel(self.levelIndex, true);
      };
      actions.appendChild(retry);
    }
    var desk = document.createElement("button");
    desk.className = "btn btn-ghost";
    desk.type = "button";
    desk.textContent = "Range desk";
    desk.onclick = function () {
      self.audio.click();
      self.mode = "start";
      self.show("start");
      self.refreshAds();
    };
    actions.appendChild(desk);
    this.show("result");
    this.refreshAds();
  };

  Game.prototype.offerAd = function () {
    if (this.adsUsed >= 2) return;
    this.audio.unlock();
    this.audio.click();
    this.mode = "ad";
    this.adTimer = 5;
    this.root.querySelector("#btn-ad-claim").disabled = true;
    this.root.querySelector("#ad-count").textContent = "Ad playing… 5s";
    this.show("ad");
    this.injectAd(this.root.querySelector('.banner-slot[data-ad="reward"]'));
  };

  Game.prototype.claimAd = function () {
    if (this.adTimer > 0) return;
    this.audio.click();
    this.adsUsed += 1;
    this.arrowsLeft += 2;
    this.closeAd(true);
  };

  Game.prototype.closeAd = function (claimed) {
    if (claimed) {
      this.mode = "play";
      this.show(null);
      this.refreshHud();
    } else if (this.arrowsLeft <= 0) {
      this.finishLane(false);
    } else {
      this.mode = "play";
      this.show(null);
    }
  };

  Game.prototype.injectAd = function (slot) {
    if (!slot) return;
    slot.innerHTML = "";
    var fb = document.createElement("div");
    fb.className = "ad-fallback";
    fb.textContent = "Sponsored";
    slot.appendChild(fb);
    if (!adsAllowed()) return;
    try {
      var ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", AD_CLIENT);
      ins.setAttribute("data-ad-slot", AD_SLOT_BANNER);
      ins.setAttribute("data-ad-format", "horizontal");
      ins.setAttribute("data-full-width-responsive", "true");
      slot.insertBefore(ins, fb);
      (global.adsbygoogle = global.adsbygoogle || []).push({});
    } catch (e) {}
  };

  Game.prototype.refreshAds = function () {
    var slots = this.root.querySelectorAll(".banner-slot");
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].offsetParent === null) continue;
      this.injectAd(slots[i]);
    }
  };

  Game.prototype.persistNow = function () {
    persist(this.save);
  };

  Game.prototype.predictPath = function () {
    var bow = this.bowPos();
    var spd = this.arrowSpeed(this.power);
    var x = bow.x + Math.cos(this.aim) * 36 * this.unit;
    var y = bow.y + Math.sin(this.aim) * 36 * this.unit;
    var vx = Math.cos(this.aim) * spd;
    var vy = Math.sin(this.aim) * spd;
    var pts = [{ x: x, y: y }];
    var hit = null;
    var vis = Math.floor(90 * this.level.predict);
    var apples = [];
    for (var k = 0; k < this.apples.length; k++) {
      var ap = this.apples[k];
      if (ap.dead) continue;
      apples.push({ x: ap.x, y: ap.y, vx: ap.vx, vy: ap.vy, r: ap.r, sway: ap.sway || 0, swayT: ap.swayT || 0 });
    }
    var g = this.level.gravity;
    var wind = this.windNow;
    for (var i = 0; i < vis; i++) {
      var j;
      for (j = 0; j < apples.length; j++) {
        apples[j].vy += g * STEP;
        apples[j].vx += wind * STEP * 0.35;
        apples[j].x += apples[j].vx * STEP;
        apples[j].y += apples[j].vy * STEP;
        if (apples[j].sway) {
          apples[j].swayT += STEP;
          apples[j].x += Math.sin(apples[j].swayT * 3.1) * apples[j].sway * STEP;
        }
      }
      vy += 520 * STEP;
      vx += wind * STEP * 0.42;
      x += vx * STEP;
      y += vy * STEP;
      pts.push({ x: x, y: y });
      if (!hit) {
        for (j = 0; j < apples.length; j++) {
          if (Math.hypot(apples[j].x - x, apples[j].y - y) <= apples[j].r + this.hitPad() * 0.5) {
            hit = { x: apples[j].x, y: apples[j].y, r: apples[j].r };
            break;
          }
        }
      }
      if (y > this.ground || x > this.W + 40) break;
    }
    return { pts: pts, hit: hit };
  };

  Game.prototype.render = function () {
    var ctx = this.ctx;
    var W = this.W;
    var H = this.H;
    ctx.clearRect(0, 0, W, H);
    var shake = this.trauma * this.trauma;
    var sx = 0;
    var sy = 0;
    if (shake > 0.002 && !this.reduced) {
      sx = (Math.random() * 2 - 1) * shake * 9;
      sy = (Math.random() * 2 - 1) * shake * 7;
    }
    ctx.save();
    ctx.translate(sx, sy);
    this.drawBg(ctx, W, H);
    this.drawPlatform(ctx, W, H);
    this.drawNpc(ctx);
    this.drawApples(ctx);
    this.drawPlayer(ctx);
    if (this.arrow) this.drawArrow(ctx, this.arrow, true);
    if (this.aiming && this.power > 0.06) this.drawAim(ctx);
    this.drawParticles(ctx);
    this.drawSlashes(ctx);
    this.drawFloaters(ctx);
    ctx.restore();
  };

  Game.prototype.drawBg = function (ctx, W, H) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3a3a3c");
    g.addColorStop(0.55, "#2c2c2e");
    g.addColorStop(1, "#232326");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.42, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < this.motes.length; i++) {
      var m = this.motes[i];
      var mx = ((m.x * W + this.time * m.s) % (W + 20)) - 10;
      var my = ((m.y * H + Math.sin(this.time * 0.4 + i) * 12) % H);
      ctx.globalAlpha = m.a;
      ctx.fillStyle = "#f4f4f2";
      ctx.beginPath();
      ctx.arc(mx, my, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  Game.prototype.drawPlatform = function (ctx, W, H) {
    var gY = this.ground;
    ctx.fillStyle = "#3f3f42";
    ctx.fillRect(0, gY, W, H - gY);
    ctx.fillStyle = "#4a4a4c";
    ctx.fillRect(0, gY, W, 10);
    ctx.fillStyle = "#353538";
    var s = this.unit;
    roundRect(ctx, this.playerX - 48 * s, gY - 14 * s, 96 * s, 18 * s, 3);
    ctx.fill();
    roundRect(ctx, this.npcX - 48 * s, gY - 14 * s, 96 * s, 18 * s, 3);
    ctx.fill();
    ctx.fillStyle = "#2a2a2c";
    ctx.fillRect(this.playerX - 52 * s, gY + 4 * s, 104 * s, 8 * s);
    ctx.fillRect(this.npcX - 52 * s, gY + 4 * s, 104 * s, 8 * s);
  };

  Game.prototype.drawPlayer = function (ctx) {
    var s = this.unit;
    var x = this.playerX;
    var y = this.ground - 14 * s;
    var aim = this.aiming || this.arrow ? this.aim : -0.45 + Math.sin(this.time * 1.4) * 0.04;
    var draw = this.player.draw;
    this.drawStick(ctx, x, y, 1, {
      kind: "player",
      aim: aim,
      draw: draw,
      lean: -0.04 - draw * 0.08,
    });
  };

  Game.prototype.drawNpc = function (ctx) {
    var s = this.unit;
    var x = this.npcX;
    var y = this.ground - 14 * s;
    this.drawStick(ctx, x, y, -1, {
      kind: "npc",
      toss: this.npc.toss,
      hold: this.npc.holdApple && this.npc.tossing,
      lean: 0.05 + this.npc.toss * 0.06,
    });
    this.drawBasket(ctx, x + 28 * s, y);
  };

  Game.prototype.drawBasket = function (ctx, x, y) {
    var s = this.unit;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#5a4634";
    ctx.beginPath();
    ctx.moveTo(-12 * s, -4 * s);
    ctx.lineTo(12 * s, -4 * s);
    ctx.lineTo(9 * s, 10 * s);
    ctx.lineTo(-9 * s, 10 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3a2c20";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    var left = this.mode === "play" || this.mode === "shot" ? this.tossesLeft : 3;
    var show = Math.min(4, Math.max(0, left));
    var i;
    for (i = 0; i < show; i++) {
      this.drawAppleIcon(ctx, -7 * s + i * 5.2 * s, -9 * s - (i % 2) * 3 * s, 4.6 * s, 0.15 * i, false);
    }
    ctx.restore();
  };

  Game.prototype.drawStick = function (ctx, feetX, feetY, facing, opt) {
    var s = this.unit;
    ctx.save();
    ctx.translate(feetX, feetY);
    ctx.scale(facing, 1);
    var bob = Math.sin(this.time * 2.2) * 1.1 * s;
    ctx.translate(0, bob);
    if (opt.lean) ctx.rotate(opt.lean * facing);

    var hipY = -34 * s;
    var shY = -74 * s;
    var headY = -96 * s;

    ctx.strokeStyle = "#f4f4f2";
    ctx.fillStyle = "#f4f4f2";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 7.2 * s;

    ctx.beginPath();
    ctx.moveTo(-12 * s, 0);
    ctx.lineTo(0, hipY);
    ctx.lineTo(13 * s, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(2 * s, shY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(4 * s, headY, 13.5 * s, 0, Math.PI * 2);
    ctx.fill();

    if (opt.kind === "player") this.drawPlayerGear(ctx, s, shY, opt);
    else this.drawNpcGear(ctx, s, shY, opt);

    ctx.restore();
  };

  Game.prototype.drawPlayerGear = function (ctx, s, shY, opt) {
    var ang = opt.aim;
    var draw = Math.min(opt.draw || 0, 0.82);
    var shX = 2 * s;
    var alongX = Math.cos(ang);
    var alongY = Math.sin(ang);
    var bowLen = 38 * s;
    var nockLen = 12 * s + draw * 24 * s;
    var bhx = shX + alongX * bowLen;
    var bhy = shY + alongY * bowLen;
    var nx = shX - alongX * nockLen;
    var ny = shY - alongY * nockLen;

    ctx.strokeStyle = "#f4f4f2";
    ctx.lineWidth = 6.2 * s;
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(bhx, bhy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    var perpX = -alongY;
    var perpY = alongX;
    var limb = 28 * s;
    var rec = 10 * s + draw * 4 * s;
    var tipX1 = bhx + perpX * limb - alongX * rec;
    var tipY1 = bhy + perpY * limb - alongY * rec;
    var tipX2 = bhx - perpX * limb - alongX * rec;
    var tipY2 = bhy - perpY * limb - alongY * rec;
    var bellyX = bhx + alongX * 7 * s;
    var bellyY = bhy + alongY * 7 * s;

    ctx.strokeStyle = "#c48a18";
    ctx.lineWidth = 8.2 * s;
    ctx.beginPath();
    ctx.moveTo(tipX1, tipY1);
    ctx.quadraticCurveTo(bellyX, bellyY, tipX2, tipY2);
    ctx.stroke();
    ctx.strokeStyle = "#e8b02a";
    ctx.lineWidth = 4.2 * s;
    ctx.beginPath();
    ctx.moveTo(tipX1, tipY1);
    ctx.quadraticCurveTo(bhx + alongX * 12 * s, bhy + alongY * 12 * s, tipX2, tipY2);
    ctx.stroke();

    ctx.strokeStyle = "#f4f4f2";
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(tipX1, tipY1);
    ctx.lineTo(nx, ny);
    ctx.lineTo(tipX2, tipY2);
    ctx.stroke();

    if (!this.arrow) {
      var tip = 26 * s;
      ctx.strokeStyle = "#d8d4cc";
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(bhx + alongX * tip, bhy + alongY * tip);
      ctx.stroke();
      ctx.fillStyle = "#e23c32";
      ctx.beginPath();
      var ax = bhx + alongX * tip;
      var ay = bhy + alongY * tip;
      ctx.moveTo(ax + alongX * 10 * s, ay + alongY * 10 * s);
      ctx.lineTo(ax + perpX * 4 * s, ay + perpY * 4 * s);
      ctx.lineTo(ax - perpX * 4 * s, ay - perpY * 4 * s);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#f4f4f2";
    ctx.beginPath();
    ctx.arc(bhx, bhy, 4.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(nx, ny, 4.2 * s, 0, Math.PI * 2);
    ctx.fill();
  };

  Game.prototype.drawNpcGear = function (ctx, s, shY, opt) {
    var toss = opt.toss || 0;
    var arm = lerp(0.9, -1.35, easeOut(clamp(toss, 0, 1)));
    var shX = 2 * s;
    var hx = shX + Math.cos(arm) * 40 * s;
    var hy = shY + Math.sin(arm) * 40 * s;
    ctx.strokeStyle = "#f4f4f2";
    ctx.lineWidth = 6.4 * s;
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(shX - 18 * s, shY + 22 * s);
    ctx.stroke();
    ctx.fillStyle = "#f4f4f2";
    ctx.beginPath();
    ctx.arc(hx, hy, 4.2 * s, 0, Math.PI * 2);
    ctx.fill();
    if (opt.hold || (!this.npc.tossing && this.npc.holdApple)) {
      this.drawAppleIcon(ctx, hx + 2 * s, hy - 8 * s, this.appleRadius(false), 0.2, false);
    }
  };

  Game.prototype.drawApples = function (ctx) {
    for (var i = 0; i < this.apples.length; i++) {
      var a = this.apples[i];
      if (a.dead) {
        ctx.globalAlpha = Math.max(0, 1 - a.deadT / 0.35);
        this.drawAppleIcon(ctx, a.x, a.y, a.r * (1 + a.deadT * 0.8), a.rot, a.gold);
        ctx.globalAlpha = 1;
      } else {
        this.drawAppleIcon(ctx, a.x, a.y, a.r, a.rot, a.gold);
      }
    }
  };

  Game.prototype.drawAppleIcon = function (ctx, x, y, r, rot, gold) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = gold ? "#e8b02a" : "#e23c32";
    ctx.beginPath();
    ctx.ellipse(0, 2, r * 0.92, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gold ? "#c48a18" : "#b82c28";
    ctx.beginPath();
    ctx.ellipse(r * 0.18, r * 0.28, r * 0.55, r * 0.62, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.28, r * 0.22, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a3a22";
    ctx.lineWidth = Math.max(1.4, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.82);
    ctx.quadraticCurveTo(r * 0.08, -r * 1.15, r * 0.02, -r * 1.28);
    ctx.stroke();
    ctx.fillStyle = "#7aaf3a";
    ctx.beginPath();
    ctx.ellipse(r * 0.38, -r * 1.05, r * 0.32, r * 0.16, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  Game.prototype.drawArrow = function (ctx, a, flying) {
    var s = this.unit;
    var len = 34 * s;
    var ang = a.ang;
    var x2 = a.x - Math.cos(ang) * len;
    var y2 = a.y - Math.sin(ang) * len;
    ctx.strokeStyle = "#d8d4cc";
    ctx.lineWidth = 2.4 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
    ctx.fillStyle = "#e23c32";
    ctx.beginPath();
    var px = -Math.sin(ang);
    var py = Math.cos(ang);
    ctx.moveTo(a.x + Math.cos(ang) * 8 * s, a.y + Math.sin(ang) * 8 * s);
    ctx.lineTo(a.x + px * 3.4 * s, a.y + py * 3.4 * s);
    ctx.lineTo(a.x - px * 3.4 * s, a.y - py * 3.4 * s);
    ctx.closePath();
    ctx.fill();
    if (flying) {
      ctx.strokeStyle = "rgba(244,244,242,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - a.vx * 0.04, y2 - a.vy * 0.04);
      ctx.stroke();
    }
  };

  Game.prototype.drawAim = function (ctx) {
    var pred = this.predictPath();
    var pts = pred.pts;
    ctx.save();
    ctx.setLineDash([5, 9]);
    ctx.strokeStyle = "rgba(244,244,242,0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    var step = Math.max(1, Math.floor(pts.length / 18));
    for (i = 2; i < pts.length; i += step) {
      var t = i / pts.length;
      ctx.fillStyle = "rgba(244,244,242," + (0.35 + 0.5 * t) + ")";
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, lerp(3.4, 1.4, t), 0, Math.PI * 2);
      ctx.fill();
    }
    var last = pts[pts.length - 1];
    if (pred.hit) {
      ctx.strokeStyle = "rgba(244,244,242,0.95)";
      ctx.lineWidth = 2;
      var pulse = 10 + Math.sin(this.time * 10) * 2;
      ctx.beginPath();
      ctx.arc(pred.hit.x, pred.hit.y, pred.hit.r + pulse * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pred.hit.x - 12, pred.hit.y);
      ctx.lineTo(pred.hit.x + 12, pred.hit.y);
      ctx.moveTo(pred.hit.x, pred.hit.y - 12);
      ctx.lineTo(pred.hit.x, pred.hit.y + 12);
      ctx.stroke();
    } else if (last) {
      ctx.strokeStyle = "rgba(196,60,50,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(last.x - 7, last.y - 7);
      ctx.lineTo(last.x + 7, last.y + 7);
      ctx.moveTo(last.x + 7, last.y - 7);
      ctx.lineTo(last.x - 7, last.y + 7);
      ctx.stroke();
    }
    ctx.restore();

    var bx = this.bowPos().x;
    var by = this.ground + 18;
    ctx.fillStyle = "rgba(20,20,22,0.55)";
    roundRect(ctx, bx - 50, by, 100, 8, 4);
    ctx.fill();
    ctx.fillStyle = "#e8e6e1";
    roundRect(ctx, bx - 50, by, 100 * this.power, 8, 4);
    ctx.fill();
  };

  Game.prototype.drawParticles = function (ctx) {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      ctx.globalAlpha = clamp(p.life / (p.max || 0.5), 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  Game.prototype.drawSlashes = function (ctx) {
    for (var i = 0; i < this.slashes.length; i++) {
      var s = this.slashes[i];
      var a = s.t < 0.08 ? s.t / 0.08 : 1 - (s.t - 0.08) / 0.2;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.strokeStyle = "#e23c32";
      ctx.lineWidth = s.w;
      ctx.lineCap = "round";
      ctx.shadowColor = "#e23c32";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -s.h * 0.5);
      ctx.lineTo(0, s.h * 0.5);
      ctx.stroke();
      ctx.restore();
    }
  };

  Game.prototype.drawFloaters = function (ctx) {
    for (var i = 0; i < this.floaters.length; i++) {
      var f = this.floaters[i];
      var k = f.t;
      ctx.save();
      ctx.globalAlpha = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.78;
      ctx.fillStyle = f.color;
      ctx.font = "700 22px 'Bebas Neue', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y - k * 40);
      ctx.restore();
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function AudioBus() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.9;
    this.drawOsc = null;
    this.drawGain = null;
    this.noise = null;
  }

  AudioBus.prototype.setLevel = function (slider, muted) {
    this.volume = clamp(slider, 0, 1);
    this.muted = !!muted || this.volume < 0.005;
    var gain = this.muted ? 0.0001 : Math.max(0.0001, this.volume * this.volume);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.025);
    }
  };

  AudioBus.prototype.unlock = function () {
    if (!this.ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0.0001 : Math.max(0.0001, this.volume * this.volume);
      this.master.connect(this.ctx.destination);
      var buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.setLevel(this.volume, this.muted);
  };

  AudioBus.prototype.resume = function () {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  };

  AudioBus.prototype.close = function () {
    this.drawStop();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
    }
  };

  AudioBus.prototype.out = function () {
    return this.muted ? 0.0001 : 1;
  };

  AudioBus.prototype.tone = function (freq, dur, type, vol, slide) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * this.out(), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  };

  AudioBus.prototype.noiseBurst = function (dur, vol, hpFreq) {
    if (!this.ctx || this.muted || !this.noise) return;
    var t = this.ctx.currentTime;
    var src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    var f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hpFreq || 400;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * this.out(), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
  };

  AudioBus.prototype.click = function () {
    this.tone(520, 0.06, "square", 0.04, 180);
  };
  AudioBus.prototype.toss = function () {
    this.tone(180, 0.1, "sine", 0.04, 90);
    this.noiseBurst(0.08, 0.04, 600);
  };
  AudioBus.prototype.drawStart = function () {
    if (!this.ctx || this.muted) return;
    this.drawStop();
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.value = 70;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(this.master);
    o.start();
    this.drawOsc = o;
    this.drawGain = g;
  };
  AudioBus.prototype.drawUpdate = function (power) {
    if (!this.drawOsc || !this.ctx) return;
    var t = this.ctx.currentTime;
    this.drawOsc.frequency.setTargetAtTime(70 + power * 90, t, 0.05);
    this.drawGain.gain.setTargetAtTime(this.muted ? 0.0001 : 0.012 + power * 0.03, t, 0.05);
  };
  AudioBus.prototype.drawStop = function () {
    if (this.drawOsc) {
      try {
        this.drawOsc.stop();
      } catch (e) {}
      this.drawOsc = null;
      this.drawGain = null;
    }
  };
  AudioBus.prototype.release = function (power) {
    this.drawStop();
    this.tone(220 + power * 80, 0.16, "triangle", 0.12, 70);
    this.noiseBurst(0.12, 0.08 + power * 0.06, 800);
    this.tone(90, 0.2, "sine", 0.08, 50);
  };
  AudioBus.prototype.hit = function (gold) {
    this.noiseBurst(0.1, 0.12, 700);
    this.tone(gold ? 740 : 320, 0.14, "triangle", 0.09, gold ? 1480 : 180);
    if (gold) this.tone(980, 0.2, "sine", 0.06);
  };
  AudioBus.prototype.miss = function () {
    this.noiseBurst(0.14, 0.08, 220);
    this.tone(90, 0.16, "sine", 0.05, 50);
  };
  AudioBus.prototype.win = function () {
    var self = this;
    this.tone(523, 0.16, "sine", 0.08);
    setTimeout(function () {
      self.tone(659, 0.16, "sine", 0.08);
    }, 90);
    setTimeout(function () {
      self.tone(784, 0.28, "sine", 0.1);
    }, 180);
  };

  global.StickbowGame = { mount: mount, unmount: unmount };
})(typeof window !== "undefined" ? window : globalThis);