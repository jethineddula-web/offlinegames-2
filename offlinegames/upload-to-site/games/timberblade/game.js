(function () {
  "use strict";

  var AD_CLIENT = window.AD_CLIENT || "ca-pub-4203857211510947";
  var AD_SLOT_BANNER = window.AD_SLOT_BANNER || "7417753724";
  var ADMOB_BANNER = window.ADMOB_BANNER || "ca-app-pub-4203857211510947/8086182570";
  var ADMOB_INTERSTITIAL =
    window.ADMOB_INTERSTITIAL || "ca-app-pub-4203857211510947/3025427580";
  var ASSET = (window.TB_ASSETS || "assets/").replace(/\/?$/, "/");
  var SAVE_KEY = "timberblade-save-v1";
  var TOTAL = 50;
  var FRUIT_KINDS = [
    "apple",
    "orange",
    "strawberry",
    "pear",
    "cherry",
    "lemon",
    "kiwi",
    "watermelon",
  ];
  var BOSS = {
    10: { name: "Cedar Wheel", tint: [1.05, 0.72, 0.48] },
    20: { name: "Ash Spindle", tint: [0.72, 0.7, 0.66] },
    30: { name: "Ironbark", tint: [0.62, 0.68, 0.82] },
    40: { name: "Night Oak", tint: [0.5, 0.46, 0.58] },
    50: { name: "Heartwood", tint: [0.95, 0.55, 0.48] },
  };

  var TAU = Math.PI * 2;
  var FRUIT_ORBIT = 0.78;
  var FRUIT_SIZE = 0.3;
  var root = null;
  var stage = null;
  var canvas = null;
  var ctx = null;
  var overlay = null;
  var hud = null;
  var bannerEl = null;
  var adModal = null;
  var rotateEl = null;
  var raf = 0;
  var lastTs = 0;
  var acc = 0;
  var STEP = 1 / 60;
  var dpr = 1;
  var W = 390;
  var H = 844;
  var destroyed = false;
  var images = {};
  var fallbacks = {};
  var adsenseLoaded = false;
  var adsenseFailed = false;
  var bannerPushed = false;

  var save = loadSave();

  var G = {
    screen: "start",
    mode: "aim",
    level: Math.min(save.unlocked, TOTAL),
    knivesLeft: 0,
    knivesMax: 0,
    fruits: [],
    stuck: [],
    flying: null,
    falling: [],
    shards: [],
    particles: [],
    pops: [],
    impacts: [],
    boardAngle: 0,
    boardTime: 0,
    trauma: 0,
    freeze: 0,
    flash: 0,
    score: 0,
    combo: 0,
    adUsed: false,
    def: null,
    hint: true,
    reduced: false,
  };

  var audio = {
    ctx: null,
    master: null,
    sfx: null,
    muted: !!save.muted,
  };

  function wrap(a) {
    a = a % TAU;
    if (a < -Math.PI) a += TAU;
    if (a > Math.PI) a -= TAU;
    return a;
  }

  function absAng(a) {
    return Math.abs(wrap(a));
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { v: 1, unlocked: 1, muted: false, high: 0, best: {} };
      var d = JSON.parse(raw);
      return {
        v: 1,
        unlocked: clamp(d.unlocked || 1, 1, TOTAL),
        muted: !!d.muted,
        high: d.high || 0,
        best: d.best || {},
      };
    } catch (e) {
      return { v: 1, unlocked: 1, muted: false, high: 0, best: {} };
    }
  }

  function writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {}
  }

  function makeLevel(n) {
    var i = n - 1;
    var fruitCount = Math.min(2 + Math.floor(i / 3), 10);
    var preStuck = i < 6 ? 0 : Math.min(1 + Math.floor((i - 6) / 4), 7);
    var boss = !!BOSS[n];
    if (boss) fruitCount = Math.min(fruitCount + 1, 11);
    var spare = n <= 8 ? 4 : n <= 18 ? 3 : n <= 35 ? 2 : 2;
    var knives = fruitCount + spare;
    var speed = 1.05 + i * 0.05;
    var pattern = "steady";
    if (n >= 5) pattern = "pulse";
    if (n >= 11) pattern = "reverse";
    if (n >= 19) pattern = "wobble";
    if (n >= 29) pattern = "burst";
    if (n >= 39) pattern = "chaos";
    var kinds = [];
    for (var k = 0; k < fruitCount; k++) kinds.push(FRUIT_KINDS[(i + k) % FRUIT_KINDS.length]);
    if (boss) speed *= 1.12;
    return {
      n: n,
      fruitCount: fruitCount,
      fruitKinds: kinds,
      knives: knives,
      preStuck: preStuck,
      speed: speed,
      pattern: pattern,
      boss: boss,
      title: boss ? BOSS[n].name : "Level " + n,
      tint: boss ? BOSS[n].tint : null,
    };
  }


  function spinSpeed(def, t) {
    var s = Math.max(def.speed, 0.5);
    var p = def.pattern;
    var w;
    if (p === "steady") {
      w = s;
    } else if (p === "pulse") {
      w = s * (0.82 + 0.28 * Math.sin(t * 1.55));
    } else if (p === "reverse") {
      var period = Math.max(8, (TAU * 2.4) / s);
      var phase = t / period;
      var dir = phase % 2 < 1 ? 1 : -1;
      var local = phase - Math.floor(phase);
      var ease = 0.7 + 0.3 * Math.sin(local * Math.PI);
      w = s * dir * ease;
    } else if (p === "wobble") {
      w = s * (0.84 + 0.22 * Math.sin(t * 1.05) + 0.1 * Math.sin(t * 2.45));
    } else if (p === "burst") {
      var cyc = t % 3.2;
      w = cyc > 2.3 ? s * 2.05 : s * 0.88;
    } else {
      w = s * (0.9 + 0.18 * Math.sin(t * 1.05) + 0.1 * Math.sin(t * 2.3) + 0.06 * Math.sin(t * 4));
    }
    if (p !== "reverse") w = Math.max(w, s * 0.55);
    return w;
  }



  function unlockAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio.ctx) {
        audio.ctx = new AC({ latencyHint: "interactive" });
        audio.master = audio.ctx.createGain();
        audio.sfx = audio.ctx.createGain();
        audio.sfx.connect(audio.master);
        audio.master.connect(audio.ctx.destination);
        applyMute();
      }
      if (audio.ctx.state === "suspended") audio.ctx.resume();
    } catch (e) {}
  }

  function applyMute() {
    if (!audio.master) return;
    var v = audio.muted ? 0 : 1;
    audio.master.gain.setTargetAtTime(v, audio.ctx.currentTime, 0.03);
  }

  function envGain(g, peak, dur) {
    var t = audio.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function playOsc(type, freq, dur, peak, slide) {
    if (!audio.ctx || audio.muted) return;
    var o = audio.ctx.createOscillator();
    var g = audio.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, audio.ctx.currentTime + dur);
    envGain(g, peak, dur);
    o.connect(g);
    g.connect(audio.sfx);
    o.start();
    o.stop(audio.ctx.currentTime + dur + 0.02);
  }

  function playNoise(dur, peak, bpFreq, q) {
    if (!audio.ctx || audio.muted) return;
    var n = audio.ctx.createBuffer(1, Math.max(1, (audio.ctx.sampleRate * dur) | 0), audio.ctx.sampleRate);
    var d = n.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var src = audio.ctx.createBufferSource();
    src.buffer = n;
    var bp = audio.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = bpFreq;
    bp.Q.value = q;
    var g = audio.ctx.createGain();
    envGain(g, peak, dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(audio.sfx);
    src.start();
  }

  var sfx = {
    throw: function () {
      playNoise(0.12, 0.22, 900, 0.7);
      playOsc("triangle", 420, 0.14, 0.08, 180);
    },
    stick: function () {
      playOsc("triangle", 90, 0.16, 0.28, 55);
      playNoise(0.08, 0.16, 300, 0.8);
    },
    fruit: function () {
      playNoise(0.14, 0.22, 1400, 0.6);
      playOsc("sine", 520 + Math.random() * 80, 0.12, 0.12, 240);
    },
    clash: function () {
      playOsc("square", 220, 0.18, 0.12, 90);
      playNoise(0.16, 0.28, 1800, 1.1);
    },
    crack: function () {
      playNoise(0.4, 0.34, 220, 0.5);
      playOsc("sawtooth", 70, 0.45, 0.18, 28);
    },
    win: function () {
      playOsc("sine", 523, 0.18, 0.1);
      setTimeout(function () {
        playOsc("sine", 659, 0.18, 0.1);
      }, 90);
      setTimeout(function () {
        playOsc("sine", 784, 0.28, 0.12);
      }, 180);
    },
    fail: function () {
      playOsc("triangle", 196, 0.28, 0.12, 90);
    },
    click: function () {
      playOsc("sine", 880, 0.05, 0.06);
    },
  };

  function isNativeApp() {
    var w = window;
    if (w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform()) return true;
    if (w.cordova || w.phonegap) return true;
    if (w.admob || w.AdMob) return true;
    var ua = navigator.userAgent || "";
    return /; wv\)/.test(ua);
  }

  function nativeAd() {
    var w = window;
    return w.admob || w.AdMob || (w.Capacitor && w.Capacitor.Plugins && w.Capacitor.Plugins.AdMob) || null;
  }

  function loadAdSense() {
    if (adsenseLoaded || adsenseFailed) return Promise.resolve(adsenseLoaded);
    return new Promise(function (resolve) {
      var s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + AD_CLIENT;
      s.onload = function () {
        adsenseLoaded = true;
        resolve(true);
      };
      s.onerror = function () {
        adsenseFailed = true;
        resolve(false);
      };
      document.head.appendChild(s);
      setTimeout(function () {
        if (!adsenseLoaded) {
          adsenseFailed = true;
          resolve(false);
        }
      }, 4000);
    });
  }

  function pushAdsense(el) {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
    if (el) el.setAttribute("data-pushed", "1");
  }

  function showBanner(on) {
    if (!bannerEl) return;
    if (!on || G.screen === "play") {
      bannerEl.hidden = true;
      return;
    }
    bannerEl.hidden = false;
    if (isNativeApp()) {
      var admob = nativeAd();
      try {
        if (admob && admob.banner && admob.banner.show) {
          admob.banner.show({ id: ADMOB_BANNER });
        }
      } catch (e) {}
    }
    loadAdSense().then(function (ok) {
      if (!ok || !bannerEl || bannerEl.hidden) return;
      if (!bannerEl.querySelector("ins.adsbygoogle")) {
        bannerEl.innerHTML =
          '<ins class="adsbygoogle" style="display:block" data-ad-client="' +
          AD_CLIENT +
          '" data-ad-slot="' +
          AD_SLOT_BANNER +
          '" data-ad-format="horizontal" data-full-width-responsive="false"></ins>';
        pushAdsense(bannerEl);
        bannerPushed = true;
      }
    });
  }

  function showRewardedAd(done) {
    var granted = false;
    var finish = function () {
      if (granted) return;
      granted = true;
      if (adModal) adModal.hidden = true;
      done();
    };
    if (adModal) {
      adModal.hidden = false;
      adModal.innerHTML =
        '<p class="ov-kicker">Sponsored</p><div class="ad-frame" id="tb-ad-frame"><div class="ad-fallback">Advertisement</div></div><p class="ad-note" id="tb-ad-note">Unlocking extra knives…</p><button class="btn btn-primary" id="tb-ad-claim" disabled>Collect +2 knives</button>';
    }
    var claim = adModal && adModal.querySelector("#tb-ad-claim");
    var note = adModal && adModal.querySelector("#tb-ad-note");
    var readyAt = Date.now() + 5000;
    var enable = function () {
      if (claim) {
        claim.disabled = false;
        claim.onclick = function () {
          sfx.click();
          finish();
        };
      }
      if (note) note.textContent = "Ad complete. Collect your knives.";
    };
    var tick = setInterval(function () {
      if (Date.now() >= readyAt) {
        clearInterval(tick);
        enable();
      }
    }, 200);

    var admob = nativeAd();
    if (isNativeApp() && admob) {
      Promise.resolve()
        .then(function () {
          if (admob.interstitial && admob.interstitial.load) {
            return admob.interstitial.load({ id: ADMOB_INTERSTITIAL });
          }
          if (admob.prepareInterstitial) return admob.prepareInterstitial({ adId: ADMOB_INTERSTITIAL });
        })
        .then(function () {
          if (admob.interstitial && admob.interstitial.show) return admob.interstitial.show();
          if (admob.showInterstitial) return admob.showInterstitial();
        })
        .catch(function () {})
        .then(function () {
          readyAt = Math.min(readyAt, Date.now() + 400);
        });
    } else {
      loadAdSense().then(function (ok) {
        var frame = document.getElementById("tb-ad-frame");
        if (!ok || !frame) return;
        frame.innerHTML =
          '<ins class="adsbygoogle" style="display:block;width:100%;min-height:240px" data-ad-client="' +
          AD_CLIENT +
          '" data-ad-slot="' +
          AD_SLOT_BANNER +
          '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
        pushAdsense(frame);
      });
    }
  }

  function lockPortrait() {
    try {
      var o = screen.orientation || screen.mozOrientation;
      if (o && o.lock) {
        o.lock("portrait").catch(function () {
          try {
            o.lock("portrait-primary").catch(function () {});
          } catch (e) {}
        });
      }
    } catch (e) {}
  }

  function imgOf(name) {
    return images[name] || fallbacks[name] || null;
  }

  function makeFallbackBoard() {
    var c = document.createElement("canvas");
    c.width = c.height = 512;
    var g = c.getContext("2d");
    var cx = 256,
      cy = 256;
    g.fillStyle = "#2a1c12";
    g.beginPath();
    g.arc(cx, cy, 250, 0, TAU);
    g.fill();
    for (var i = 18; i >= 0; i--) {
      g.beginPath();
      g.fillStyle = i % 2 ? "#6b4423" : "#4a331f";
      if (i === 3) g.fillStyle = "#8b5a2b";
      g.arc(cx, cy, 12 + i * 13, 0, TAU);
      g.fill();
    }
    g.strokeStyle = "#1a120c";
    g.lineWidth = 18;
    g.beginPath();
    g.arc(cx, cy, 246, 0, TAU);
    g.stroke();
    return c;
  }

  function makeFallbackKnife() {
    var c = document.createElement("canvas");
    c.width = 80;
    c.height = 360;
    var g = c.getContext("2d");
    g.fillStyle = "#cfd3d8";
    g.beginPath();
    g.moveTo(40, 8);
    g.lineTo(52, 150);
    g.lineTo(40, 168);
    g.lineTo(28, 150);
    g.closePath();
    g.fill();
    g.fillStyle = "#5c4030";
    g.fillRect(32, 168, 16, 170);
    g.fillStyle = "#8a847c";
    g.fillRect(28, 330, 24, 22);
    return c;
  }

  function makeFallbackFruit(color) {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var g = c.getContext("2d");
    g.fillStyle = color;
    g.beginPath();
    g.arc(64, 70, 44, 0, TAU);
    g.fill();
    g.fillStyle = "#3d6b32";
    g.beginPath();
    g.ellipse(64, 24, 10, 18, 0.4, 0, TAU);
    g.fill();
    return c;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }

  function loadAllAssets() {
    fallbacks.board = makeFallbackBoard();
    fallbacks.knife = makeFallbackKnife();
    var colors = {
      apple: "#c4453c",
      orange: "#d97a2b",
      strawberry: "#c23b45",
      pear: "#c6b14a",
      cherry: "#a02732",
      lemon: "#d4c35a",
      kiwi: "#7a9e4a",
      watermelon: "#2f6b3a",
    };
    FRUIT_KINDS.forEach(function (k) {
      fallbacks[k] = makeFallbackFruit(colors[k]);
    });
    var names = ["board", "knife"]
      .concat(FRUIT_KINDS)
      .concat(["shard-0", "shard-1", "shard-2", "shard-3", "bg-portrait", "bg-landscape"]);
    return Promise.all(
      names.map(function (n) {
        var file = n + (n.indexOf("bg-") === 0 ? ".jpg" : ".png");
        if (n === "board" || FRUIT_KINDS.indexOf(n) >= 0 || n === "knife") file += "?v=4";
        return loadImage(ASSET + file).then(function (img) {
          if (img) images[n] = img;
        });
      })
    );
  }

  var ICO = {
    pause:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/></svg>',
    play:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>',
    mute:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
    sound:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/></svg>',
  };

  function mount(el) {
    destroy();
    destroyed = false;
    root = el;
    root.innerHTML = "";
    G.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    rotateEl = document.createElement("div");
    rotateEl.id = "tb-rotate";
    rotateEl.innerHTML =
      '<div><div class="rotate-mark"></div><p class="ov-title" style="font-size:1.6rem">Turn your device</p><p class="ov-sub">Timberblade is locked to portrait.</p></div>';
    root.appendChild(rotateEl);

    stage = document.createElement("div");
    stage.id = "tb-stage";
    root.appendChild(stage);

    canvas = document.createElement("canvas");
    canvas.id = "tb-canvas";
    stage.appendChild(canvas);
    ctx = canvas.getContext("2d");

    hud = document.createElement("div");
    hud.id = "tb-hud";
    hud.hidden = true;
    stage.appendChild(hud);

    overlay = document.createElement("div");
    overlay.id = "tb-overlay";
    stage.appendChild(overlay);

    bannerEl = document.createElement("div");
    bannerEl.id = "tb-banner";
    bannerEl.hidden = true;
    bannerEl.innerHTML = '<div class="ad-fallback">Advertisement</div>';
    stage.appendChild(bannerEl);

    adModal = document.createElement("div");
    adModal.id = "tb-ad-modal";
    adModal.hidden = true;
    stage.appendChild(adModal);

    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    window.addEventListener("orientationchange", onOrient);
    document.addEventListener("visibilitychange", onVis);
    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, true);
    lockPortrait();

    overlay.innerHTML =
      '<div class="start-hero"><p class="ov-kicker">50 levels · limited knives</p><h1 class="ov-title">Timberblade</h1><p class="ov-sub">Stick every fruit on the spinning oak. When the last one splits, the board breaks.</p></div>';
    G.screen = "start";
    G.def = makeLevel(1);
    placePieces(G.def);
    G.stuck = [];
    renderUI();
    lastTs = performance.now();
    raf = requestAnimationFrame(loop);
    loadAllAssets().then(function () {
      if (destroyed) return;
      renderUI();
    });

    window.__tb = {
      get screen() {
        return G.screen;
      },
      get level() {
        return G.level;
      },
      get knives() {
        return G.knivesLeft;
      },
      play: function () {
        startLevel(save.unlocked);
      },
      throw: function () {
        tryThrow();
      },
      split: function () {
        if (G.screen === "play" && G.mode !== "breaking") beginBreak();
      },
    };
  }

  function destroy() {
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener("resize", sizeCanvas);
    window.removeEventListener("orientationchange", onOrient);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("keydown", onKey, true);
    if (canvas) canvas.removeEventListener("pointerdown", onPointer);
    if (root) root.innerHTML = "";
    root = stage = canvas = ctx = overlay = hud = bannerEl = adModal = null;
  }

  function onOrient() {
    lockPortrait();
    sizeCanvas();
  }

  function onVis() {
    if (document.visibilityState === "visible") {
      unlockAudio();
      lockPortrait();
    }
  }

  function sizeCanvas() {
    if (!stage || !canvas) return;
    var r = stage.getBoundingClientRect();
    W = Math.max(280, r.width || 390);
    H = Math.max(420, r.height || 720);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function boardGeom() {
    var R = Math.min(W, H) * 0.22;
    return { cx: W * 0.5, cy: H * 0.3, R: R };
  }

  function onPointer(ev) {
    unlockAudio();
    lockPortrait();
    if (G.screen !== "play" || G.mode !== "aim") return;
    if (ev.target && ev.target.closest && ev.target.closest("button")) return;
    tryThrow();
  }

  function onKey(ev) {
    if (ev.code === "Space" || ev.code === "Enter") {
      ev.preventDefault();
      unlockAudio();
      if (G.screen === "start") startLevel(save.unlocked);
      else if (G.screen === "play") tryThrow();
      else if (G.screen === "win") nextLevel();
      else if (G.screen === "fail") retryLevel();
    }
    if (ev.code === "Escape" && G.screen === "play") pauseGame();
    if (ev.code === "KeyM") toggleMute();
  }

  function tryThrow() {
    if (G.screen !== "play" || G.mode !== "aim") return;
    if (G.knivesLeft <= 0) {
      failLevel("knives");
      return;
    }
    G.knivesLeft -= 1;
    G.hint = false;
    var geom = boardGeom();
    G.flying = {
      x: geom.cx,
      y: H - 78,
      t: 0,
      rot: 0,
    };
    G.mode = "flight";
    sfx.throw();
    renderHud();
  }

  function startLevel(n) {
    unlockAudio();
    lockPortrait();
    sfx.click();
    n = clamp(n, 1, TOTAL);
    G.level = n;
    G.def = makeLevel(n);
    G.mode = "aim";
    G.screen = "play";
    G.boardAngle = rand(0, TAU);
    G.boardTime = 0;
    G.knivesLeft = G.def.knives;
    G.knivesMax = G.def.knives;
    G.adUsed = false;
    G.flying = null;
    G.falling = [];
    G.shards = [];
    G.particles = [];
    G.pops = [];
    G.impacts = [];
    G.trauma = 0;
    G.freeze = 0;
    G.flash = 0;
    G.combo = 0;
    G.hint = n === 1;
    placePieces(G.def);
    renderUI();
  }

  function placePieces(def) {
    var fruits = [];
    var stuck = [];
    var base = rand(0, TAU);
    var count = def.fruitCount;
    var i;
    for (i = 0; i < count; i++) {
      fruits.push({
        kind: def.fruitKinds[i] || FRUIT_KINDS[i % FRUIT_KINDS.length],
        a: wrap(base + (i / count) * TAU + rand(-0.12, 0.12)),
        hit: false,
        scale: 1,
        wobble: rand(0, TAU),
      });
    }
    var used = fruits.map(function (f) {
      return f.a;
    });
    for (i = 0; i < def.preStuck; i++) {
      var a = wrap(base + ((i + 0.5) / Math.max(count, 1)) * TAU + rand(-0.08, 0.08));
      var ok = true;
      for (var j = 0; j < used.length; j++) {
        if (absAng(a - used[j]) < 0.28) ok = false;
      }
      if (!ok) a = wrap(a + 0.4);
      stuck.push({ a: a, pre: true });
      used.push(a);
    }
    G.fruits = fruits;
    G.stuck = stuck;
  }

  function update(dt) {
    var i;
    G.boardTime += dt;
    if (G.freeze > 0) {
      G.freeze -= dt;
      decayJuice(dt);
      updateFx(dt);
      return;
    }
    if (G.screen === "start" || G.screen === "levels") {
      G.boardAngle += 0.45 * dt;
      updateFx(dt);
      decayJuice(dt);
      return;
    }
    if (G.mode === "breaking") {
      updateBreak(dt);
      updateFx(dt);
      decayJuice(dt);
      return;
    }
    if (G.screen !== "play") {
      updateFx(dt);
      decayJuice(dt);
      return;
    }

    G.boardAngle += spinSpeed(G.def, G.boardTime) * dt;

    if (G.flying) {
      G.flying.t += dt / 0.18;
      var geom = boardGeom();
      var ty = geom.cy + geom.R - 8;
      var k = easeOutCubic(clamp(G.flying.t, 0, 1));
      G.flying.y = (H - 78) + (ty - (H - 78)) * k;
      G.flying.x = geom.cx;
      if (G.flying.t >= 1) resolveHit();
    }

    for (i = G.falling.length - 1; i >= 0; i--) {
      var f = G.falling[i];
      f.vy += 1800 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      f.life -= dt;
      if (f.life <= 0 || f.y > H + 80) G.falling.splice(i, 1);
    }

    updateFx(dt);
    decayJuice(dt);

    if (G.mode === "aim" && G.knivesLeft <= 0 && fruitsLeft() > 0 && G.falling.length === 0) {
      failLevel("knives");
    }
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function fruitsLeft() {
    var n = 0;
    for (var i = 0; i < G.fruits.length; i++) if (!G.fruits[i].hit) n++;
    return n;
  }

  function resolveHit() {
    var geom = boardGeom();
    var impactLocal = wrap(Math.PI / 2 - G.boardAngle);
    var flying = G.flying;
    G.flying = null;

    var hitFruit = null;
    var i;
    for (i = 0; i < G.fruits.length; i++) {
      var fr = G.fruits[i];
      if (fr.hit) continue;
      if (absAng(impactLocal - fr.a) < 0.24) {
        hitFruit = fr;
        break;
      }
    }

    for (i = 0; i < G.stuck.length; i++) {
      if (absAng(impactLocal - G.stuck[i].a) < 0.13) {
        clashFail(flying, geom);
        return;
      }
    }

    G.stuck.push({ a: impactLocal, pre: false });
    addImpact(geom.cx, geom.cy + geom.R);
    addTrauma(0.28);
    G.flash = 0.08;
    sfx.stick();

    if (hitFruit) {
      hitFruit.hit = true;
      hitFruit.scale = 1.25;
      G.combo += 1;
      var pts = 100 * G.level + G.combo * 20;
      G.score += pts;
      spawnJuice(geom, hitFruit);
      G.pops.push({
        x: geom.cx + Math.cos(G.boardAngle + hitFruit.a) * geom.R * FRUIT_ORBIT,
        y: geom.cy + Math.sin(G.boardAngle + hitFruit.a) * geom.R * FRUIT_ORBIT,
        t: 0,
        text: "+" + pts,
      });
      sfx.fruit();
      G.freeze = 0.045;
      addTrauma(0.22);
    }

    if (fruitsLeft() <= 0) {
      beginBreak();
      return;
    }
    G.mode = "aim";
    renderHud();
  }

  function clashFail(flying, geom) {
    sfx.clash();
    addTrauma(0.55);
    G.flash = 0.12;
    G.falling.push({
      x: geom.cx,
      y: geom.cy + geom.R,
      vx: rand(-220, 220),
      vy: rand(-80, 40),
      rot: 0,
      vr: rand(-8, 8),
      life: 1.2,
    });
    G.mode = "dead";
    failLevel("clash");
  }

  function spawnJuice(geom, fruit) {
    var a = G.boardAngle + fruit.a;
    var x = geom.cx + Math.cos(a) * geom.R * FRUIT_ORBIT;
    var y = geom.cy + Math.sin(a) * geom.R * FRUIT_ORBIT;
    var colors = {
      apple: "#c4453c",
      orange: "#e0893a",
      strawberry: "#d94a58",
      pear: "#c6b14a",
      cherry: "#a02732",
      lemon: "#d4c35a",
      kiwi: "#7a9e4a",
      watermelon: "#c45c48",
    };
    var col = colors[fruit.kind] || "#c45c48";
    for (var i = 0; i < 18; i++) {
      var ang = rand(0, TAU);
      var sp = rand(80, 280);
      G.particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: rand(0.35, 0.7),
        max: 0.7,
        size: rand(2, 5),
        color: col,
      });
    }
  }

  function addImpact(x, y) {
    G.impacts.push({ x: x, y: y, t: 0 });
    var chips = ["#e8dcc8", "#c4a574", "#8b5a2b", "#f3eee6", "#5c4030"];
    for (var i = 0; i < 14; i++) {
      var ang = rand(0, TAU);
      var sp = rand(70, 260);
      G.particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: rand(0.18, 0.38),
        max: 0.38,
        size: rand(1.5, 4),
        color: chips[(Math.random() * chips.length) | 0],
      });
    }
  }

  function addTrauma(v) {
    if (G.reduced) return;
    G.trauma = clamp(G.trauma + v, 0, 1);
  }

  function decayJuice(dt) {
    G.trauma = Math.max(0, G.trauma - dt * 1.8);
    G.flash = Math.max(0, G.flash - dt * 3);
  }

  function updateFx(dt) {
    var i;
    for (i = G.particles.length - 1; i >= 0; i--) {
      var p = G.particles[i];
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) G.particles.splice(i, 1);
    }
    for (i = G.pops.length - 1; i >= 0; i--) {
      G.pops[i].t += dt;
      if (G.pops[i].t > 0.7) G.pops.splice(i, 1);
    }
    for (i = G.impacts.length - 1; i >= 0; i--) {
      G.impacts[i].t += dt;
      if (G.impacts[i].t > 0.28) G.impacts.splice(i, 1);
    }
    for (i = 0; i < G.fruits.length; i++) {
      var fr = G.fruits[i];
      fr.wobble += dt * 3;
      if (fr.scale > 1) fr.scale = Math.max(1, fr.scale - dt * 2.4);
    }
  }

  function beginBreak() {
    G.mode = "breaking";
    G.breakT = 0;
    sfx.crack();
    addTrauma(0.85);
    G.flash = 0.2;
    G.freeze = 0.08;
    var geom = boardGeom();
    G.shards = [];
    var n = 10;
    var i;
    for (i = 0; i < n; i++) {
      var a0 = (i / n) * TAU;
      var a1 = ((i + 1) / n) * TAU;
      var mid = a0 + (a1 - a0) * 0.5 + G.boardAngle;
      G.shards.push({
        kind: "wedge",
        a0: a0 + G.boardAngle,
        a1: a1 + G.boardAngle,
        x: geom.cx,
        y: geom.cy,
        vx: Math.cos(mid) * rand(180, 420),
        vy: Math.sin(mid) * rand(140, 380) - 80,
        rot: G.boardAngle,
        vr: rand(-4, 4),
        alpha: 1,
      });
    }
    for (i = 0; i < 4; i++) {
      var ang = rand(0, TAU);
      G.shards.push({
        kind: "sprite",
        img: "shard-" + i,
        x: geom.cx + Math.cos(ang) * geom.R * 0.4,
        y: geom.cy + Math.sin(ang) * geom.R * 0.4,
        vx: Math.cos(ang) * rand(200, 460),
        vy: Math.sin(ang) * rand(160, 400) - 120,
        rot: rand(0, TAU),
        vr: rand(-6, 6),
        alpha: 1,
      });
    }
    for (i = 0; i < G.stuck.length; i++) {
      var sa = G.boardAngle + G.stuck[i].a;
      G.falling.push({
        x: geom.cx + Math.cos(sa) * geom.R,
        y: geom.cy + Math.sin(sa) * geom.R,
        vx: Math.cos(sa) * rand(80, 260),
        vy: Math.sin(sa) * rand(40, 200) - 60,
        rot: sa - Math.PI / 2,
        vr: rand(-5, 5),
        life: 1.6,
      });
    }
    G.stuck = [];
    for (i = 0; i < 40; i++) {
      var ang2 = rand(0, TAU);
      G.particles.push({
        x: geom.cx,
        y: geom.cy,
        vx: Math.cos(ang2) * rand(60, 360),
        vy: Math.sin(ang2) * rand(60, 360),
        life: rand(0.4, 0.9),
        max: 0.9,
        size: rand(2, 6),
        color: pick(["#6b4423", "#c8b08a", "#3e2a18", "#8b5a2b"]),
      });
    }
  }

  function updateBreak(dt) {
    G.breakT += dt;
    for (var i = 0; i < G.shards.length; i++) {
      var s = G.shards[i];
      s.vy += 1600 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vr * dt;
      if (G.breakT > 0.7) s.alpha = Math.max(0, s.alpha - dt * 1.2);
    }
    for (i = G.falling.length - 1; i >= 0; i--) {
      var f = G.falling[i];
      f.vy += 1800 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      f.life -= dt;
    }
    if (G.breakT > 1.35 && G.screen === "play") {
      winLevel();
    }
  }

  function winLevel() {
    G.screen = G.level >= TOTAL ? "finale" : "win";
    G.mode = "aim";
    var leftover = G.knivesLeft * 50;
    G.score += leftover;
    save.high = Math.max(save.high, G.score);
    if (save.unlocked < G.level + 1 && G.level < TOTAL) save.unlocked = G.level + 1;
    save.best[G.level] = Math.max(save.best[G.level] || 0, leftover + 100 * G.level);
    writeSave();
    sfx.win();
    renderUI();
    if (G.level % 5 === 0 && G.level < TOTAL) {
      /* interstitial after boss-ish cadence, does not block collect */
    }
  }

  function failLevel(why) {
    G.screen = "fail";
    G.failWhy = why;
    sfx.fail();
    renderUI();
  }

  function retryLevel() {
    startLevel(G.level);
  }

  function nextLevel() {
    if (G.level >= TOTAL) {
      G.screen = "start";
      renderUI();
      return;
    }
    startLevel(G.level + 1);
  }

  function pauseGame() {
    if (G.screen !== "play") return;
    G.screen = "pause";
    sfx.click();
    renderUI();
  }

  function resumeGame() {
    G.screen = "play";
    sfx.click();
    renderUI();
  }

  function toggleMute() {
    audio.muted = !audio.muted;
    save.muted = audio.muted;
    writeSave();
    unlockAudio();
    applyMute();
    sfx.click();
    renderUI();
  }

  function grantKnives() {
    G.adUsed = true;
    G.knivesLeft += 2;
    G.knivesMax += 2;
    G.mode = "aim";
    G.screen = "play";
    renderUI();
  }

  function loop(now) {
    if (destroyed) return;
    var dt = Math.min(0.1, (now - lastTs) / 1000 || 0.016);
    lastTs = now;
    if (G.screen !== "pause" && G.screen !== "ad") {
      acc += dt;
      while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
      }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    var shake = G.trauma * G.trauma;
    if (shake && !G.reduced) {
      ctx.translate((Math.random() * 2 - 1) * 14 * shake, (Math.random() * 2 - 1) * 14 * shake);
      ctx.rotate((Math.random() * 2 - 1) * 0.04 * shake);
    }
    drawBg();
    drawScene();
    ctx.restore();
    if (G.flash > 0) {
      ctx.fillStyle = "rgba(255,245,230," + G.flash * 0.45 + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBg() {
    var bg = imgOf(W > H ? "bg-landscape" : "bg-portrait") || imgOf("bg-portrait");
    if (bg) {
      var s = Math.max(W / bg.width, H / bg.height);
      var bw = bg.width * s;
      var bh = bg.height * s;
      ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
    } else {
      ctx.fillStyle = "#120e0c";
      ctx.fillRect(0, 0, W, H);
    }
    var g = ctx.createRadialGradient(W * 0.5, H * 0.28, 20, W * 0.5, H * 0.4, H * 0.7);
    g.addColorStop(0, "rgba(12,11,10,0.08)");
    g.addColorStop(1, "rgba(12,11,10,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawScene() {
    var geom = boardGeom();
    var attract = G.screen === "start" || G.screen === "levels" || G.screen === "boot";

    if (G.mode !== "breaking") {
      drawBoard(geom);
      drawStuck(geom);
      drawFruits(geom);
    } else {
      drawShards(geom);
    }

    drawFalling();
    if (G.flying) drawKnife(G.flying.x, G.flying.y, 0, 1);
    if (G.screen === "play" && G.mode === "aim") drawReadyKnife(geom);
    drawParticles();
    drawImpacts();
    drawPops();

    if (attract) {
      /* board already spinning as a teaser */
    }
  }

  function drawBoard(geom) {
    var img = imgOf("board");
    ctx.save();
    ctx.translate(geom.cx, geom.cy);
    ctx.rotate(G.boardAngle);
    ctx.beginPath();
    ctx.arc(0, 0, geom.R * 0.99, 0, TAU);
    ctx.clip();
    if (G.def && G.def.tint) {
      ctx.filter = "sepia(0.15)";
    }
    var size = geom.R * 2;
    if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
    if (G.def && G.def.tint) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle =
        "rgba(" +
        ((G.def.tint[0] * 180) | 0) +
        "," +
        ((G.def.tint[1] * 140) | 0) +
        "," +
        ((G.def.tint[2] * 100) | 0) +
        ",0.28)";
      ctx.beginPath();
      ctx.arc(0, 0, geom.R, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
    }
    ctx.restore();
  }

  function drawStuck(geom) {
    for (var i = 0; i < G.stuck.length; i++) {
      var a = G.boardAngle + G.stuck[i].a;
      var x = geom.cx + Math.cos(a) * geom.R;
      var y = geom.cy + Math.sin(a) * geom.R;
      drawKnife(x, y, a - Math.PI / 2, 0.92);
    }
  }

  function drawFruits(geom) {
    for (var i = 0; i < G.fruits.length; i++) {
      var fr = G.fruits[i];
      if (fr.hit) continue;
      var a = G.boardAngle + fr.a;
      var r = geom.R * FRUIT_ORBIT;
      var x = geom.cx + Math.cos(a) * r;
      var y = geom.cy + Math.sin(a) * r;
      var img = imgOf(fr.kind);
      var s = geom.R * FRUIT_SIZE * fr.scale * (1 + Math.sin(fr.wobble) * 0.03);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = "rgba(12,11,10,0.28)";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.12, s * 0.34, s * 0.12, 0, 0, TAU);
      ctx.fill();
      if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  function drawKnife(x, y, rot, scale) {
    var img = imgOf("knife");
    var h = 92 * (scale || 1);
    var w = h * 0.22;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (img) ctx.drawImage(img, -w / 2, -h * 0.22, w, h);
    ctx.restore();
  }

  function drawReadyKnife(geom) {
    var pulse = 1 + Math.sin(G.boardTime * 6) * 0.03;
    drawKnife(geom.cx, H - 78, 0, pulse);
    if (G.hint) {
      ctx.fillStyle = "rgba(243,238,230,0.7)";
      ctx.font = "500 13px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Tap to throw", geom.cx, H - 22);
    }
  }

  function drawFalling() {
    for (var i = 0; i < G.falling.length; i++) {
      var f = G.falling[i];
      drawKnife(f.x, f.y, f.rot, 0.9);
    }
  }

  function drawShards(geom) {
    for (var i = 0; i < G.shards.length; i++) {
      var s = G.shards[i];
      ctx.save();
      ctx.globalAlpha = s.alpha;
      if (s.kind === "sprite") {
        var img = imgOf(s.img);
        if (img) {
          ctx.translate(s.x, s.y);
          ctx.rotate(s.rot);
          var sz = geom.R * 0.55;
          ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
        }
      } else {
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, geom.R, s.a0 - s.rot, s.a1 - s.rot);
        ctx.closePath();
        ctx.clip();
        var imgb = imgOf("board");
        if (imgb) ctx.drawImage(imgb, -geom.R, -geom.R, geom.R * 2, geom.R * 2);
      }
      ctx.restore();
    }
  }

  function drawParticles() {
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      ctx.globalAlpha = clamp(p.life / (p.max || 0.7), 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawImpacts() {
    for (var i = 0; i < G.impacts.length; i++) {
      var im = G.impacts[i];
      var t = im.t / 0.28;
      var alpha = 1 - t;
      var rad = 8 + t * 28;
      ctx.save();
      ctx.translate(im.x, im.y);
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = "#f3eee6";
      ctx.fillStyle = "rgba(243,238,230," + (0.35 * alpha) + ")";
      ctx.beginPath();
      ctx.arc(0, 0, 4 + t * 10, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 1.6;
      var n = 7;
      for (var k = 0; k < n; k++) {
        var a = (k / n) * TAU + t * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawPops() {
    ctx.textAlign = "center";
    ctx.font = "600 16px Outfit, sans-serif";
    for (var i = 0; i < G.pops.length; i++) {
      var p = G.pops[i];
      ctx.globalAlpha = 1 - p.t / 0.7;
      ctx.fillStyle = "#f3eee6";
      ctx.fillText(p.text, p.x, p.y - p.t * 40);
      ctx.globalAlpha = 1;
    }
  }

  function renderUI() {
    if (!overlay || !hud) return;
    var play = G.screen === "play";
    overlay.hidden = false;
    overlay.dataset.mode = play ? "play" : G.screen;
    hud.hidden = !play && G.screen !== "pause";
    if (play) {
      overlay.innerHTML = "";
      overlay.style.pointerEvents = "none";
    } else {
      overlay.style.pointerEvents = "auto";
      overlay.innerHTML = overlayHtml();
      bindOverlay();
    }
    renderHud();
    showBanner(!play && G.screen !== "boot" && G.screen !== "ad");
  }

  function renderHud() {
    if (!hud) return;
    if (G.screen !== "play" && G.screen !== "pause") {
      hud.hidden = true;
      return;
    }
    hud.hidden = false;
    var left = fruitsLeft();
    var pips = G.fruits
      .map(function (f) {
        return '<span class="fruit-pip' + (f.hit ? "" : " on") + '"></span>';
      })
      .join("");
    var knives = "";
    var i;
    for (i = 0; i < G.knivesMax; i++) {
      if (i < G.knivesLeft) {
        var src = (imgOf("knife") && images.knife && images.knife.src) || "";
        knives += src
          ? '<img alt="" src="' + src + '"/>'
          : '<span class="knife-ghost"></span>';
      } else {
        knives += '<span class="knife-ghost"></span>';
      }
    }
    var extra =
      !G.adUsed && G.screen === "play"
        ? '<button class="ad-extra" type="button" id="tb-extra">Extra knives</button>'
        : "";
    hud.innerHTML =
      '<div class="hud-top"><div class="hud-chip">Lv <strong>' +
      G.level +
      "</strong></div><div class=\"fruits-row\">" +
      pips +
      '</div><div class="hud-actions"><button class="icon-btn" id="tb-mute" type="button" aria-label="Mute">' +
      (audio.muted ? ICO.mute : ICO.sound) +
      '</button><button class="icon-btn" id="tb-pause" type="button" aria-label="Pause">' +
      ICO.pause +
      "</button></div></div>" +
      '<div class="hud-bottom"><div class="knives-row">' +
      knives +
      "</div>" +
      extra +
      "</div>";
    var muteBtn = hud.querySelector("#tb-mute");
    var pauseBtn = hud.querySelector("#tb-pause");
    var extraBtn = hud.querySelector("#tb-extra");
    if (muteBtn)
      muteBtn.onclick = function (e) {
        e.stopPropagation();
        toggleMute();
      };
    if (pauseBtn)
      pauseBtn.onclick = function (e) {
        e.stopPropagation();
        pauseGame();
      };
    if (extraBtn)
      extraBtn.onclick = function (e) {
        e.stopPropagation();
        unlockAudio();
        showRewardedAd(grantKnives);
      };
  }

  function overlayHtml() {
    if (G.screen === "start" || G.screen === "boot") {
      return (
        '<div class="start-hero"><p class="ov-kicker">50 levels · limited knives</p>' +
        '<h1 class="ov-title">Timberblade</h1>' +
        '<p class="ov-sub">Stick every fruit on the spinning oak. When the last one splits, the board breaks.</p>' +
        '<div class="ov-actions">' +
        '<button class="btn btn-primary" data-act="play">Play level ' +
        save.unlocked +
        "</button>" +
        '<button class="btn btn-ghost" data-act="levels">Level select</button>' +
        '<button class="btn btn-ghost" data-act="mute">' +
        (audio.muted ? "Sound is off" : "Sound is on") +
        "</button></div>" +
        '<p class="ov-sub" style="margin-top:18px">Best ' +
        save.high +
        "</p></div>"
      );
    }
    if (G.screen === "levels") {
      var cells = "";
      for (var i = 1; i <= TOTAL; i++) {
        var lock = i > save.unlocked;
        var done = i < save.unlocked;
        var boss = BOSS[i] ? " boss" : "";
        cells +=
          '<button class="lvl' +
          (lock ? " lock" : "") +
          (done ? " done" : "") +
          boss +
          '" data-lvl="' +
          i +
          '"' +
          (lock ? " disabled" : "") +
          ">" +
          i +
          "</button>";
      }
      return (
        '<div class="ov-card" style="width:min(100%,360px)"><p class="ov-kicker">Campaign</p>' +
        '<h2 class="ov-title" style="font-size:1.8rem">Levels</h2>' +
        '<div class="level-grid">' +
        cells +
        "</div>" +
        '<div class="ov-actions"><button class="btn btn-ghost" data-act="home">Back</button></div></div>'
      );
    }
    if (G.screen === "pause") {
      return (
        '<div class="ov-card"><p class="ov-kicker">Paused</p><h2 class="ov-title" style="font-size:2rem">Hold</h2>' +
        '<p class="ov-sub">Level ' +
        G.level +
        " · " +
        fruitsLeft() +
        " fruit left</p>" +
        '<div class="ov-actions"><button class="btn btn-primary" data-act="resume">Resume</button>' +
        '<button class="btn btn-ghost" data-act="retry">Restart level</button>' +
        '<button class="btn btn-ghost" data-act="home">Quit to title</button></div></div>'
      );
    }
    if (G.screen === "win") {
      return (
        '<div class="ov-card"><p class="ov-kicker">Board split</p><h2 class="ov-title" style="font-size:2rem">' +
        (G.def && G.def.boss ? G.def.title : "Level " + G.level) +
        "</h2>" +
        '<p class="ov-sub">Score ' +
        G.score +
        " · knives left " +
        G.knivesLeft +
        "</p>" +
        '<div class="ov-actions"><button class="btn btn-primary" data-act="next">Next level</button>' +
        '<button class="btn btn-ghost" data-act="retry">Replay</button></div></div>'
      );
    }
    if (G.screen === "finale") {
      return (
        '<div class="ov-card"><p class="ov-kicker">Campaign complete</p><h2 class="ov-title" style="font-size:2rem">Heartwood falls</h2>' +
        '<p class="ov-sub">You split all fifty boards. Score ' +
        G.score +
        "</p>" +
        '<div class="ov-actions"><button class="btn btn-primary" data-act="home">Title</button></div></div>'
      );
    }
    if (G.screen === "fail") {
      var msg =
        G.failWhy === "clash"
          ? "Your blade struck another knife."
          : "No knives left, and fruit still hangs on the oak.";
      var extra = !G.adUsed
        ? '<button class="btn btn-primary" data-act="ad">Watch ad for +2 knives</button>'
        : "";
      return (
        '<div class="ov-card"><p class="ov-kicker">Board holds</p><h2 class="ov-title" style="font-size:2rem">Missed</h2>' +
        '<p class="ov-sub">' +
        msg +
        "</p>" +
        '<div class="ov-actions">' +
        extra +
        '<button class="btn ' +
        (G.adUsed ? "btn-primary" : "btn-ghost") +
        '" data-act="retry">Retry</button>' +
        '<button class="btn btn-ghost" data-act="home">Title</button></div></div>'
      );
    }
    return "";
  }

  function bindOverlay() {
    if (!overlay) return;
    overlay.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        unlockAudio();
        lockPortrait();
        var act = btn.getAttribute("data-act");
        if (act === "play") startLevel(save.unlocked);
        if (act === "levels") {
          G.screen = "levels";
          sfx.click();
          renderUI();
        }
        if (act === "home") {
          G.screen = "start";
          sfx.click();
          renderUI();
        }
        if (act === "mute") toggleMute();
        if (act === "resume") resumeGame();
        if (act === "retry") retryLevel();
        if (act === "next") nextLevel();
        if (act === "ad") showRewardedAd(grantKnives);
      });
    });
    overlay.querySelectorAll("[data-lvl]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        startLevel(parseInt(btn.getAttribute("data-lvl"), 10));
      });
    });
  }

  function boot() {
    var el = document.getElementById("tb-root");
    if (el) mount(el);
  }

  window.Timberblade = { mount: mount, destroy: destroy };
})();
