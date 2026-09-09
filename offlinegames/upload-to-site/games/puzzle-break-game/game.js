/* ============================================================
   PUZZLE BREAK — 50 jigsaw adventures
   Watch 2s → the picture shatters → rebuild it → sparkles!
   ============================================================ */
'use strict';

/* ---------------- utilities ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand  = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];

const store = (() => {
  try {
    localStorage.setItem('__pz', '1'); localStorage.removeItem('__pz');
    return localStorage;
  } catch (e) {
    const m = {};
    return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
  }
})();

const save = {
  progress: clamp(parseInt(store.getItem('pz_progress') || '1', 10) || 1, 1, 50),
  stars:    (() => { try { return JSON.parse(store.getItem('pz_stars') || '{}') || {}; } catch (e) { return {}; } })(),
  muted:    store.getItem('pz_muted') === '1',
  ref:      store.getItem('pz_ref') !== '0'   // reference picture on screen (default on)
};
const persist = () => {
  try {
    store.setItem('pz_progress', String(save.progress));
    store.setItem('pz_stars', JSON.stringify(save.stars));
    store.setItem('pz_muted', save.muted ? '1' : '0');
    store.setItem('pz_ref', save.ref ? '1' : '0');
  } catch (e) {}
};

/* ---------- ads (Google AdSense / H5 Games Ad Placement API) ---------- */
// Fill in AD_CLIENT (and AD_SLOT_BANNER, for the banner unit) once AdSense
// approves the site. Until AD_CLIENT is set, every ad call below just runs
// its "no ad" fallback immediately, so the game is fully playable during
// review and for anyone with an ad blocker. Nothing else needs to change
// when ads go live — just fill in the constants.
var AD_CLIENT = "ca-pub-4203857211510947";
var AD_SLOT_BANNER = "7417753724";
let adsScriptState = 'idle'; // idle | loading | ready | failed
let adPendingCbs = [];
const adsEnabled = () => !!AD_CLIENT;

// Wraps a (name, onDone) ad-trigger function so onDone is guaranteed to
// fire exactly once within `ms` — even if Google's adBreak/adConfig
// machinery (or a stalled script) never calls back. A stuck ad must never
// be able to freeze the game.
function guardedAdCall(fn, ms) {
  return (name, onDone) => {
    let done = false;
    const finish = () => { if (done) return; done = true; onDone && onDone(); };
    const timer = setTimeout(finish, ms);
    fn(name, () => { clearTimeout(timer); finish(); });
  };
}

function loadAdScript(cb) {
  if (!adsEnabled() || adsScriptState === 'failed') return cb && cb(false);
  if (adsScriptState === 'ready') return cb && cb(true);
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adBreak || (o => window.adsbygoogle.push(o));
  window.adConfig = window.adConfig || (o => window.adsbygoogle.push(o));
  if (adsScriptState === 'loading') { adPendingCbs.push(cb); return; }
  adsScriptState = 'loading';
  adPendingCbs.push(cb);
  const settle = ok => {
    if (adsScriptState !== 'loading') return; // already settled (e.g. by the timeout)
    adsScriptState = ok ? 'ready' : 'failed';
    if (ok) { try { window.adConfig({ preloadAdBreaks: 'on', sound: 'off' }); } catch (e) {} }
    const cbs = adPendingCbs.splice(0);
    cbs.forEach(fn => fn && fn(ok));
  };
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + AD_CLIENT;
  s.onload = () => settle(true);
  s.onerror = () => settle(false);
  document.head.appendChild(s);
  // Ad blockers / restrictive networks can swallow the request silently —
  // no load, no error, ever. Never let that leave the game stuck: if it
  // hasn't settled quickly, treat it as failed and unblock the game. This
  // only ever matters on the very first call (loadAdScript is warmed up
  // in the background at boot, so by the time a level actually needs it,
  // it's almost always already settled).
  setTimeout(() => settle(false), 1500);
}

// Full-screen interstitial (e.g. between levels). onDone always fires —
// whether an ad actually played, was skipped, ads aren't live yet, or the
// ad call itself stalls — so callers can just chain the next action off it.
const showInterstitial = guardedAdCall((name, onDone) => {
  if (!adsEnabled()) return onDone();
  loadAdScript(ok => {
    if (!ok || typeof window.adBreak !== 'function') return onDone();
    window.adBreak({
      type: 'next',
      name: name || 'level-transition',
      afterAd: onDone,
      adBreakDone: onDone,
    });
  });
}, 12000); // generous: protects against a genuine SDK hang without cutting off a real ad mid-play once ads go live

// Banner/display ad. Renders an <ins class="adsbygoogle"> unit into the
// given container once AdSense is live; leaves it empty until AD_CLIENT and
// AD_SLOT_BANNER are filled in.
function renderBannerAd(container) {
  if (!container) return;
  if (!adsEnabled() || !AD_SLOT_BANNER) { container.innerHTML = ''; return; }
  loadAdScript(ok => {
    if (!ok) return;
    container.innerHTML = '<ins class="adsbygoogle" style="display:block" data-ad-client="' + AD_CLIENT + '" data-ad-slot="' + AD_SLOT_BANNER + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  });
}

// Rewarded ad (e.g. "watch an ad to unlock another hint"). onReward fires
// only if the ad was actually watched; onSkipped fires if the player
// declined, the ad failed, ads aren't live yet, or the call stalls.
function showRewardedAd(name, onReward, onSkipped) {
  let done = false;
  const reward = () => { if (done) return; done = true; clearTimeout(timer); onReward && onReward(); };
  const skip = () => { if (done) return; done = true; clearTimeout(timer); onSkipped && onSkipped(); };
  const timer = setTimeout(skip, 30000); // rewarded videos legitimately run up to ~30s — don't cut a real one off mid-play
  if (!adsEnabled()) return skip();
  loadAdScript(ok => {
    if (!ok || typeof window.adBreak !== 'function') return skip();
    window.adBreak({
      type: 'reward',
      name: name || 'extra-hint',
      beforeReward: showAdFn => showAdFn(),
      adViewed: reward,
      adDismissed: skip,
      adBreakDone: info => { if (info && info.breakStatus && info.breakStatus !== 'viewed') skip(); },
    });
  });
}

// Gate a feature behind a rewarded ad, but never actually lock the game:
// if ads aren't live yet (not approved, blocked, or AD_CLIENT unset) the
// feature just unlocks for free instead of staying stuck behind a broken ad.
function unlockOrWatchAd(name, onUnlock, onDecline) {
  if (!adsEnabled()) return onUnlock && onUnlock();
  showRewardedAd(name, onUnlock, onDecline);
}

/* ---------------- level definitions ---------------- */
// images are injected by a later <script>, so read them lazily
function imgArr() { return window.PUZZLE_IMAGES || []; }
const imgCount = () => imgArr().length;
const imgAt = i => imgArr()[((i % imgArr().length) + imgArr().length) % imgArr().length];
const gridFor = l => {
  if (l <= 1) return 2;
  if (l <= 4) return 3;
  if (l <= 10) return 4;
  if (l <= 18) return 5;
  if (l <= 40) return 6;
  return 7;
};
// Pick a random image for the level, avoiding an immediate repeat of the last one.
function pickImgIdx(prevIdx) {
  const n = imgCount();
  if (n <= 1) return 0;
  let idx;
  do { idx = irand(0, n - 1); } while (idx === prevIdx);
  return idx;
}
const rotModeFor = l => (l >= 23 ? 'quarter' : (l >= 15 ? 'tilt12' : 'tilt6'));

/* ---------------- audio engine ---------------- */
const Audio_ = (() => {
  let AC = null, master = null, musicTimer = null, musicIdx = 0;
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  function ctx() {
    try {
      if (!AC) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        AC = new C();
        master = AC.createGain();
        master.gain.value = save.muted ? 0 : 0.9;
        master.connect(AC.destination);
      }
      if (AC.state === 'suspended') AC.resume();
      return AC;
    } catch (e) { return null; }
  }
  function tone(freq, dur, opt) {
    const c = ctx(); if (!c) return;
    opt = opt || {};
    try {
      const t0 = c.currentTime + (opt.delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = opt.type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, opt.slide), t0 + dur);
      const vol = opt.gain != null ? opt.gain : 0.1;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (opt.attack || 0.008));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  function noise(dur, opt) {
    const c = ctx(); if (!c) return;
    opt = opt || {};
    try {
      const t0 = c.currentTime + (opt.delay || 0);
      const n = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = opt.ftype || 'highpass';
      f.frequency.value = opt.freq || 2000;
      const g = c.createGain(); g.gain.value = opt.gain != null ? opt.gain : 0.12;
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0);
    } catch (e) {}
  }
  function seq(notes, step, opt) {
    opt = opt || {};
    notes.forEach((f, i) => tone(f, opt.dur || 0.14, {
      type: opt.type || 'sine', gain: opt.gain || 0.09,
      delay: (opt.delay || 0) + i * step
    }));
  }
  const sfx = {
    click:   () => { tone(720, 0.06, { type: 'triangle', gain: 0.09 }); tone(1080, 0.05, { type: 'sine', gain: 0.05, delay: 0.035 }); },
    pickup:  () => { tone(340, 0.1, { type: 'triangle', gain: 0.07, slide: 780 }); },
    snap:    () => { tone(880, 0.07, { type: 'triangle', gain: 0.16 }); tone(1320, 0.1, { type: 'sine', gain: 0.08, delay: 0.05 }); noise(0.03, { freq: 3500, gain: 0.08 }); },
    buzz:    () => { tone(150, 0.22, { type: 'sawtooth', gain: 0.08, slide: 88 }); },
    shatter: () => { noise(0.4, { ftype: 'bandpass', freq: 900, gain: 0.22 }); noise(0.3, { ftype: 'highpass', freq: 4000, gain: 0.12, delay: 0.05 }); tone(210, 0.3, { type: 'triangle', gain: 0.06, slide: 1200, delay: 0.02 }); },
    sparkle: () => { seq([1568, 2093, 2637, 3136], 0.07, { type: 'sine', gain: 0.06 }); },
    tick:    () => { tone(950, 0.045, { type: 'sine', gain: 0.06 }); },
    win: () => {
      seq([523, 659, 784, 1046], 0.13, { type: 'triangle', gain: 0.16, dur: 0.2 });
      seq([783.99], 0.0, { type: 'sine', gain: 0.05, delay: 0.52, dur: 1.6 });
      seq([1319, 1568, 2093, 1568, 2093, 2637], 0.09, { type: 'sine', gain: 0.07, delay: 0.55 });
      noise(0.5, { ftype: 'highpass', freq: 5000, gain: 0.08, delay: 0.6 });
    },
    levelUp: () => { seq([392, 523, 659, 784], 0.12, { type: 'triangle', gain: 0.14 }); }
  };

  function music() {
    const c = ctx(); if (!c || save.muted) return;
    clearInterval(musicTimer);
    const play = () => {
      const c2 = ctx(); if (!c2 || save.muted || !AC) return;
      const n1 = PENTA[(musicIdx + irand(-2, 2) + PENTA.length * 4) % PENTA.length];
      musicIdx++;
      tone(n1, 1.4, { type: 'sine', gain: 0.028, attack: 0.4 });
      if (Math.random() < 0.3) {
        const n2 = PENTA[(musicIdx + irand(-1, 2) + PENTA.length * 4) % PENTA.length];
        tone(n2, 1.2, { type: 'sine', gain: 0.02, attack: 0.5, delay: 0.55 });
      }
      if (Math.random() < 0.25) tone(n1 * 2, 0.5, { type: 'sine', gain: 0.012, attack: 0.2, delay: 0.9 });
    };
    play();
    musicTimer = setInterval(play, 2100);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
  function setMuted(m) { save.muted = m; persist(); if (AC && master) master.gain.value = m ? 0 : 0.9; if (m) stopMusic(); }

  return { sfx, music, stopMusic, setMuted, unlock: ctx };
})();

/* ---------------- particle engine ---------------- */
const FX = (() => {
  const canvas = document.getElementById('fx');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  const parts = [];
  let running = false;
  const GOLD = ['#ffd54a', '#ff6ec7', '#6ee7ff', '#7cffb2', '#ff9f43', '#ffffff'];

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  function start() {
    if (running || !ctx) return;
    running = true;
    requestAnimationFrame(frame);
  }
  function frame(tnow) {
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= p.dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * p.dt; p.y += p.vy * p.dt;
        p.vy += (p.g || 0) * p.dt;
        p.rot += p.vr * p.dt;
        const a = clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = p.fade ? a : 1;
        ctx.fillStyle = p.color;
        if (p.shape === 'confetti') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.scale(1, Math.sin(p.life * 6 + p.wob) * 0.7 + 0.85);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else if (p.shape === 'star') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalCompositeOperation = 'lighter';
          ctx.shadowColor = p.color; ctx.shadowBlur = 8;
          const s = p.size * a;
          ctx.beginPath();
          for (let k = 0; k < 4; k++) {
            ctx.rotate(Math.PI / 2);
            ctx.moveTo(0, 0); ctx.lineTo(s, 0);
          }
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.22); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (p.shrink ? a : 1), 0, 7);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } catch (e) {}
    if (parts.length) requestAnimationFrame(frame);
    else { running = false; if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  function add(p) { parts.push(p); start(); }

  function sparkleBurst(x, y, n, opts) {
    opts = opts || {};
    for (let i = 0; i < (n || 18); i++) {
      const ang = rand(0, Math.PI * 2), sp = rand(40, opts.sp || 260);
      const life = rand(0.4, 1.0);
      add({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30,
        g: 140, dt: 0.016, life, maxLife: life, rot: rand(0, 6), vr: rand(-6, 6),
        color: pick(opts.colors || GOLD), shape: 'star', size: rand(4, 10), fade: true
      });
    }
  }
  let confettiTimer = null;
  function confettiStorm(ms) {
    clearInterval(confettiTimer);
    const end = Date.now() + ms;
    confettiTimer = setInterval(() => {
      if (Date.now() > end) { clearInterval(confettiTimer); confettiTimer = null; return; }
      for (let i = 0; i < 7; i++) {
        const life = rand(1.6, 3);
        add({
          x: rand(0, canvas ? canvas.width : 800), y: -20,
          vx: rand(-40, 40), vy: rand(60, 190),
          g: 60, dt: 0.016, life, maxLife: life, rot: rand(0, 6), vr: rand(-8, 8),
          color: pick(GOLD), shape: 'confetti', size: rand(6, 13), fade: true, wob: rand(0, 6)
        });
      }
    }, 90);
  }
  function stopConfetti() { clearInterval(confettiTimer); confettiTimer = null; }

  return { sparkleBurst, confettiStorm, stopConfetti, resize };
})();
window.addEventListener('resize', () => FX.resize());

/* ============================================================
   GAME
   ============================================================ */
const G = {
  level: 1, n: 3, imgIdx: 0,
  shape: null,
  tabs: [],
  clip: {},
  pieces: [],
  placed: 0,
  moves: 0,
  phase: 'idle',                    // idle | memorize | breaking | play | won
  drag: null,
  timeStart: 0, timerInt: null,
  layout: null,                     // {S,M,D,board:{x,y,w,h},tray:{x,y,w,h}}
  hintCount: 0, hintBusy: false, hintTimer: null,
  navBusy: false,                   // true while waiting on the level-transition ad call
  navCalls: 0,                      // diagnostic: counts real (non-ignored) goToLevel entries
  el: {}
};

/* ---------- geometry: jigsaw tab edges ---------- */
function quadPts(p0, c, p1, n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
              u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}
function edgePts(L, h) { // (0,0) -> (L,0), bump height h (signed)
  const pts = [[0, 0]];
  if (Math.abs(h) < 1e-9) { pts.push([L, 0]); return pts; }
  pts.push(...quadPts([0.30 * L, 0], [0.37 * L, 0.55 * h], [0.365 * L, 0.92 * h], 12));
  pts.push(...quadPts([0.365 * L, 0.92 * h], [0.5 * L, 1.16 * h], [0.635 * L, 0.92 * h], 14));
  pts.push(...quadPts([0.635 * L, 0.92 * h], [0.63 * L, 0.55 * h], [0.70 * L, 0], 10));
  pts.push([L, 0]);
  return pts;
}
function pieceOutline(S, tabs, depth) {
  const out = [[0, 0]];
  const sides = [
    [0, 0, 0, tabs.t],
    [S, 0, Math.PI / 2, tabs.r],
    [S, S, Math.PI, tabs.b],
    [0, S, -Math.PI / 2, tabs.l]
  ];
  for (const [x, y, a, htype] of sides) {
    const h = -htype * depth;
    for (const [px, py] of edgePts(S, h)) {
      const rx = px * Math.cos(a) - py * Math.sin(a);
      const ry = px * Math.sin(a) + py * Math.cos(a);
      out.push([x + rx, y + ry]);
    }
  }
  return out;
}

/* ---------- level building ---------- */
function buildLevel(l) {
  G.level = l;
  G.n = gridFor(l);
  G.imgIdx = pickImgIdx(G.imgIdx);
  G.clip = {};
  const n = G.n;
  G.shape = { ve: [], he: [] };
  for (let r = 0; r < n; r++) {
    G.shape.ve.push([]);
    for (let c = 0; c < n - 1; c++) {
      const x = Math.random();
      G.shape.ve[r].push(x < 0.18 ? 0 : (x < 0.6 ? 1 : -1));
    }
  }
  for (let r = 0; r < n - 1; r++) {
    G.shape.he.push([]);
    for (let c = 0; c < n; c++) {
      const x = Math.random();
      G.shape.he[r].push(x < 0.18 ? 0 : (x < 0.6 ? 1 : -1));
    }
  }
  G.tabs = [];
  for (let r = 0; r < n; r++) {
    G.tabs.push([]);
    for (let c = 0; c < n; c++) {
      G.tabs[r].push({
        t: r > 0 ? -G.shape.he[r - 1][c] : 0,
        r: c < n - 1 ? G.shape.ve[r][c] : 0,
        b: r < n - 1 ? G.shape.he[r][c] : 0,
        l: c > 0 ? -G.shape.ve[r][c - 1] : 0
      });
    }
  }
}

/* ---------- DOM ---------- */
function cacheEls() {
  G.el = {
    screens: { title: $('#screen-title'), levels: $('#screen-levels'), game: $('#screen-game') },
    game: $('#game'), boardFrame: $('#board-frame'),
    slots: $('#slots-layer'), pieces: $('#pieces-layer'),
    peek: $('#peek-img'), ref: $('#ref-img'), memorizeLabel: $('#memorize-label'),
    memorizeBar: $('#memorize-bar'), memorizeFill: null,
    flash: $('#flash'), trayArea: $('#tray-area'),
    hudLevel: $('#hud-level'), hudTheme: $('#hud-theme'), hudMoves: $('#hud-moves'),
    hudTime: $('#hud-time'), hudProgress: $('#hud-progress'), trayCount: $('#tray-count'),
    complete: $('#complete-panel'), completeStars: $('#complete-stars'), statMoves: $('#stat-moves'),
    statTime: $('#stat-time'), statPieces: $('#stat-pieces'), newBest: $('#new-best'),
    completeTitle: $('#complete-title'),
    levelGrid: $('#level-grid'), starsTotal: $('#stars-total'), adSlot: $('#ad-slot-levels'),
    floatLayer: $('#float-layer'),
    btnPlay: $('#btn-play'), btnLevels: $('#btn-levels'), btnSoundTitle: $('#btn-sound-title'),
    btnBackTitle: $('#btn-back-title'), btnBackLevels: $('#btn-back-levels'),
    btnHint: $('#btn-hint'), btnSoundGame: $('#btn-sound-game'), btnRef: $('#btn-ref'),
    btnReplay: $('#btn-replay'), btnNext: $('#btn-next'), btnToLevels: $('#btn-to-levels')
  };
  G.el.memorizeFill = G.el.memorizeBar.querySelector('div');
}

/* ---------- screens ---------- */
function showScreen(name) {
  for (const k in G.el.screens) G.el.screens[k].classList.toggle('active', k === name);
  if (name === 'levels') buildLevelGrid();
}
function refreshSoundBtns() {
  const s = save.muted ? '🔇' : '🔊';
  G.el.btnSoundTitle.textContent = s + '  Sound: ' + (save.muted ? 'Off' : 'On');
  G.el.btnSoundGame.textContent = s;
  G.el.btnRef.classList.toggle('off', !save.ref);
}

/* ---------- reference picture (small completed-image guide) ---------- */
function positionRef() {
  const lay = G.layout, el = G.el.ref;
  if (!lay || !el) return;
  const gw = G.el.game.clientWidth;
  const mini = Math.round(clamp(lay.board.w * 0.18, 56, 150));
  el.style.width = mini + 'px';
  el.style.height = mini + 'px';
  el.style.backgroundImage = 'url(' + imgAt(G.imgIdx).s + ')';
  el.style.backgroundSize = 'cover';
  el.style.backgroundPosition = 'center';
  const bx = lay.board.x, by = lay.board.y, bw = lay.board.w;
  const gap = 12;
  if (bx + bw + mini + gap <= gw - 4) {
    // free space to the right of the board
    el.style.left = (bx + bw + gap) + 'px';
    el.style.top = by + 'px';
    el.style.opacity = '';
  } else {
    // small screens: overlay the board's top-right corner
    el.style.left = (bx + bw - mini - 4) + 'px';
    el.style.top = (by + 4) + 'px';
    el.style.opacity = '0.8';
  }
}
function showRef(show) {
  const el = G.el.ref;
  if (!el) return;
  el.classList.toggle('show', !!(show && save.ref));
}


/* ---------- level select ---------- */
function buildLevelGrid() {
  const grid = G.el.levelGrid;
  grid.innerHTML = '';
  let total = 0;
  for (let i = 1; i <= 50; i++) total += save.stars[i] || 0;
  G.el.starsTotal.textContent = '⭐ ' + total + ' / 150';
  for (let l = 1; l <= 50; l++) {
    const b = document.createElement('button');
    b.className = 'lvl-btn';
    const done = (save.stars[l] || 0) > 0;
    const locked = l > save.progress;
    if (locked) b.classList.add('locked');
    if (l === save.progress && !done) b.classList.add('current');
    if (done) b.classList.add('done');
    b.innerHTML = locked
      ? '<span class="lock">🔒</span>'
      : (l + '<span class="mini-stars">' + '★'.repeat(save.stars[l] || 0) + '☆'.repeat(3 - (save.stars[l] || 0)) + '</span>');
    if (!locked) b.addEventListener('click', () => { Audio_.sfx.click(); goToLevel(l); });
    grid.appendChild(b);
  }
  renderBannerAd(G.el.adSlot);
}

// Route every "go play a level" action through here so the interstitial
// (when ads are live) always sits at the same natural pause point —
// after the player has chosen a level, before it actually loads.
//
// showInterstitial can legitimately take a couple of seconds (up to its
// 12s worst-case guard) while the ad SDK is contacted. Without a guard
// here, an impatient player mashing Play/Next/a level tile would queue up
// several independent showInterstitial() calls, each with its own timer —
// and if they all happened to settle around the same time, startLevel()
// would fire repeatedly in a row, which looked like the game "loading
// everything at once". navBusy + setNavLoading() make the wait visible
// and stop it from being retriggered.
function goToLevel(l) {
  if (G.navBusy) return;
  G.navBusy = true;
  G.navCalls++;
  setNavLoading(true);
  showInterstitial('level-transition', () => {
    G.navBusy = false;
    setNavLoading(false);
    startLevel(l);
  });
}

// Disable every button that can call goToLevel() and swap in a loading
// label while we wait, so a slow ad call reads as "loading" instead of
// "broken" — and can't be re-triggered by extra taps.
function setNavLoading(on) {
  const btns = [G.el.btnPlay, G.el.btnNext, G.el.btnLevels];
  if (G.el.levelGrid) btns.push(...G.el.levelGrid.querySelectorAll('.lvl-btn'));
  btns.forEach(b => {
    if (!b) return;
    if (on) {
      if (b.dataset.navLabel === undefined) b.dataset.navLabel = b.innerHTML;
      b.disabled = true;
      if (b === G.el.btnPlay || b === G.el.btnNext) b.textContent = '⏳ Loading…';
    } else {
      b.disabled = false;
      if (b.dataset.navLabel !== undefined) {
        b.innerHTML = b.dataset.navLabel;
        delete b.dataset.navLabel;
      }
    }
  });
}

/* ---------- layout ---------- */
function computeLayout() {
  const gameRect = G.el.game.getBoundingClientRect();
  const gw = gameRect.width, gh = gameRect.height;
  const trayRect = G.el.trayArea.getBoundingClientRect();
  const tray = {
    x: trayRect.left - gameRect.left,
    y: trayRect.top - gameRect.top,
    w: trayRect.width,
    h: trayRect.height
  };
  const pad = 14;
  const availW = Math.max(80, gw - pad * 2);
  const availH = Math.max(80, tray.y - pad * 2 - 8);
  const n = G.n;
  const S = Math.max(48, Math.floor(Math.min(availW / n, availH / n)));
  const M = Math.round(S * 0.26);
  const D = S + 2 * M;
  const board = {
    w: S * n, h: S * n,
    x: Math.max(2, Math.floor((gw - S * n) / 2)),
    y: Math.max(2, Math.floor((tray.y - S * n) / 2))
  };
  return { S, M, D, board, tray };
}

function slotCenter(r, c, lay) {
  return { x: lay.board.x + c * lay.S + lay.S / 2, y: lay.board.y + r * lay.S + lay.S / 2 };
}

function clipOf(r, c, lay) {
  const key = lay.S + ',' + r + ',' + c;
  if (!G.clip[key]) {
    const outline = pieceOutline(lay.S, G.tabs[r][c], lay.S * 0.18);
    const pct = outline.map(([x, y]) =>
      (((x + lay.M) / lay.D) * 100).toFixed(2) + '% ' + (((y + lay.M) / lay.D) * 100).toFixed(2) + '%'
    );
    G.clip[key] = 'polygon(' + pct.join(',') + ')';
  }
  return G.clip[key];
}

/* ---------- build board DOM ---------- */
function buildBoardDOM() {
  const lay = G.layout;
  const img = imgAt(G.imgIdx);
  const bf = G.el.boardFrame;
  bf.style.width = lay.board.w + 'px';
  bf.style.height = lay.board.h + 'px';

  const slots = G.el.slots;
  slots.innerHTML = '';
  for (let r = 0; r < G.n; r++) for (let c = 0; c < G.n; c++) {
    const s = document.createElement('div');
    s.className = 'slot';
    s.dataset.rc = r + ',' + c;
    s.style.width = lay.D + 'px'; s.style.height = lay.D + 'px';
    s.style.left = (c * lay.S - lay.M) + 'px';
    s.style.top = (r * lay.S - lay.M) + 'px';
    s.style.clipPath = clipOf(r, c, lay);
    slots.appendChild(s);
  }

  const pk = G.el.peek;
  pk.style.width = lay.board.w + 'px'; pk.style.height = lay.board.h + 'px';
  pk.style.backgroundImage = 'url(' + img.s + ')';
  pk.style.backgroundSize = lay.board.w + 'px ' + lay.board.h + 'px';

  const layer = G.el.pieces;
  layer.innerHTML = '';
  G.pieces = [];
  for (let r = 0; r < G.n; r++) for (let c = 0; c < G.n; c++) {
    const p = document.createElement('div');
    p.className = 'piece';
    p.dataset.rc = r + ',' + c;
    p.style.width = lay.D + 'px'; p.style.height = lay.D + 'px';
    p.style.clipPath = clipOf(r, c, lay);
    p.style.backgroundImage = 'url(' + img.s + ')';
    p.style.backgroundSize = (lay.S * G.n) + 'px ' + (lay.S * G.n) + 'px';
    p.style.backgroundPosition = (-(c * lay.S - lay.M)) + 'px ' + (-(r * lay.S - lay.M)) + 'px';
    const pin = document.createElement('div');
    pin.className = 'pin';
    p.appendChild(pin);
    layer.appendChild(p);
    G.pieces.push({ el: p, pin, r, c, placed: false, tx: 0, ty: 0, ts: 1, rot: 0 });
  }
}

/* ---------- tray layout ---------- */
function layoutTray() {
  const lay = G.layout, n = G.n;
  const count = n * n;
  const D = lay.D;
  let ts = n >= 7 ? 0.44 : (n >= 5 ? 0.5 : 0.56);
  let foot = 30, cols = 1, rows = count;
  for (; ts > 0.22; ts -= 0.02) {
    foot = Math.max(30, D * ts * 1.24);
    cols = Math.max(1, Math.floor((lay.tray.w - 18) / foot));
    rows = Math.ceil(count / cols);
    if (rows * foot <= lay.tray.h - 10) break;
  }
  // shuffle tray positions
  const order = [];
  for (let i = 0; i < count; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) { const j = irand(0, i); const t = order[i]; order[i] = order[j]; order[j] = t; }
  order.forEach((k, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    G.pieces[k].tx = lay.tray.x + 9 + foot * (col + 0.5) + rand(-foot * 0.05, foot * 0.05);
    G.pieces[k].ty = lay.tray.y + 8 + foot * (row + 0.5) + rand(-foot * 0.05, foot * 0.05);
    G.pieces[k].trayTs = ts;
    if (!G.drag || G.drag.p !== G.pieces[k]) G.pieces[k].ts = ts;
  });
}

function pieceTransformStr(p) {
  const D = G.layout.D;
  const x = p.placed ? slotCenter(p.r, p.c, G.layout).x : p.tx;
  const y = p.placed ? slotCenter(p.r, p.c, G.layout).y : p.ty;
  const rot = p.placed ? 0 : p.rot;
  const s = p.placed ? 1 : p.ts;
  return 'translate3d(' + (x - D / 2) + 'px,' + (y - D / 2) + 'px,0) rotate(' + rot + 'deg) scale(' + s + ')';
}
function applyPieceTransform(p, immediate) {
  if (immediate) p.el.style.transition = 'none';
  p.el.style.transform = pieceTransformStr(p);
}

/* ---------- tray rotations ---------- */
function assignTrayRot(p) {
  const mode = rotModeFor(G.level);
  if (mode === 'quarter') {
    const q = irand(0, 3) * 90;
    p.rot = Math.random() < 0.22 ? 0 : q; // some straight, rest rotated
  } else {
    const t = mode === 'tilt12' ? 12 : 6;
    p.rot = rand(-t, t);
  }
}

/* ============================================================
   FLOW
   ============================================================ */
function startLevel(l) {
  clearInterval(G.timerInt);
  Audio_.stopMusic();
  FX.stopConfetti();
  if (G.drag) { G.drag = null; clearHighlights(); }
  showScreen('game');
  buildLevel(l);
  G.phase = 'memorize';
  G.moves = 0; G.placed = 0; G.hintCount = 0; G.hintBusy = false;
  clearTimeout(G.hintTimer);
  G.el.hudLevel.textContent = l;
  G.el.hudTheme.textContent = imgAt(G.imgIdx).t;
  G.el.hudMoves.textContent = '0';
  G.el.hudTime.textContent = '0:00';
  G.el.hudProgress.textContent = '🧩 0/' + (G.n * G.n);
  G.el.trayCount.textContent = '· 0/' + (G.n * G.n);
  refreshHintBtn();
  G.el.complete.classList.remove('show');
  G.el.newBest.classList.remove('show');
  G.el.boardFrame.classList.remove('dim');
  G.el.peek.classList.add('show');
  G.el.peek.style.opacity = '1';
  G.el.memorizeLabel.style.display = 'block';
  G.el.memorizeBar.style.display = 'block';
  G.el.memorizeFill.style.transition = 'none';
  G.el.memorizeFill.style.width = '100%';

  layoutNow(true);
  buildBoardDOM();
  layoutTray();
  positionRef();
  showRef(false);          // during the 2s reveal the big picture is already shown
  // memorize pill straddles the board's top edge, bar just above it
  G.el.memorizeLabel.style.left = (G.layout.board.x + G.layout.board.w / 2) + 'px';
  G.el.memorizeLabel.style.top = Math.max(-24, G.layout.board.y - 22) + 'px';
  G.el.memorizeBar.style.left = (G.layout.board.x + G.layout.board.w / 2) + 'px';
  G.el.memorizeBar.style.top = Math.max(2, G.layout.board.y - 44) + 'px';

  G.pieces.forEach(p => {
    p.el.style.opacity = '0';
    applyPieceTransform(p, true);
  });

  // countdown: exactly 2000 ms
  requestAnimationFrame(() => requestAnimationFrame(() => {
    G.el.memorizeFill.style.transition = 'width 2000ms linear';
    G.el.memorizeFill.style.width = '0%';
  }));
  setTimeout(() => { if (G.phase === 'memorize' && G.level === l) breakApart(); }, 2025);
}

function breakApart() {
  Audio_.sfx.shatter();
  G.phase = 'breaking';
  const lay = G.layout;
  const gRect = G.el.game.getBoundingClientRect();
  G.el.flash.classList.remove('go');
  void G.el.flash.offsetWidth;
  G.el.flash.classList.add('go');
  G.el.peek.style.opacity = '0';
  G.el.peek.classList.remove('show');
  G.el.memorizeLabel.style.display = 'none';
  G.el.memorizeBar.style.display = 'none';
  positionRef();
  showRef(true);           // small guide picture stays on screen from now on
  FX.sparkleBurst(gRect.left + lay.board.x + lay.board.w / 2, gRect.top + lay.board.y + lay.board.h / 2, 30, { sp: 340 });

  layoutTray(); // final tray positions for all pieces
  G.pieces.forEach(p => {
    p.el.style.opacity = '1';
    p.pin.classList.add('crack');
    setTimeout(() => {
      p.pin.classList.remove('crack');
      const d = rand(0.55, 0.8);
      const del = (p.r + p.c) * 55 + rand(0, 90);
      p.el.style.transition = 'transform ' + d + 's cubic-bezier(.16,.9,.28,1.28) ' + del + 'ms';
      p.el.style.transform = pieceTransformStr(p);
      setTimeout(() => { p.el.style.transition = ''; }, (d + 0.12) * 1000 + del + 60);
    }, 45 + rand(0, 70));
  });
  const total = (G.n * 2) * 55 + 1050;
  setTimeout(() => { if (G.phase === 'breaking') startPlayPhase(); }, total);
}

function startPlayPhase() {
  G.phase = 'play';
  G.pieces.forEach(p => assignTrayRot(p));
  // apply rotations with a small transition so pieces settle into place
  G.pieces.forEach(p => {
    p.el.style.transition = 'transform .5s cubic-bezier(.3,1.2,.4,1)';
    p.el.style.transform = pieceTransformStr(p);
    setTimeout(() => { p.el.style.transition = ''; }, 560);
  });
  G.timeStart = Date.now();
  G.timerInt = setInterval(updateTimer, 500);
  Audio_.music();
}

function updateTimer() {
  const s = Math.floor((Date.now() - G.timeStart) / 1000);
  G.el.hudTime.textContent = fmtTime(s);
}
function fmtTime(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

function layoutNow(immediate) {
  G.layout = computeLayout();
  const lay = G.layout;
  G.el.boardFrame.style.left = lay.board.x + 'px';
  G.el.boardFrame.style.top = lay.board.y + 'px';
  G.el.peek.style.left = lay.board.x + 'px';
  G.el.peek.style.top = lay.board.y + 'px';
}
let resizeTimer = null;
window.addEventListener('resize', () => {
  FX.resize();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (G.el.screens.game.classList.contains('active') && G.pieces.length) {
      G.clip = {};
      layoutNow(true);
      G.pieces.forEach(p => {
        p.el.style.clipPath = clipOf(p.r, p.c, G.layout);
        p.el.style.backgroundSize = (G.layout.S * G.n) + 'px ' + (G.layout.S * G.n) + 'px';
        p.el.style.backgroundPosition = (-(p.c * G.layout.S - G.layout.M)) + 'px ' + (-(p.r * G.layout.S - G.layout.M)) + 'px';
        p.el.style.width = G.layout.D + 'px'; p.el.style.height = G.layout.D + 'px';
        applyPieceTransform(p, true);
      });
      layoutTray();
      positionRef();
      if (G.phase === 'memorize') {
        G.el.peek.style.width = G.layout.board.w + 'px';
        G.el.peek.style.height = G.layout.board.h + 'px';
        G.el.peek.style.backgroundSize = G.layout.board.w + 'px ' + G.layout.board.h + 'px';
      }
      if (G.phase === 'play' || G.phase === 'won') {
        G.pieces.forEach(p => applyPieceTransform(p, true));
      }
      if (G.phase === 'breaking' || G.phase === 'play' || G.phase === 'won') showRef(true);
    }
  }, 150);
});

/* ============================================================
   DRAG & PLACE
   ============================================================ */
function onPointerDown(e) {
  if (G.phase !== 'play') return;
  if (G.drag) return;             // a finger/pointer is already dragging a piece — ignore others
  const pieceEl = e.target.closest ? e.target.closest('.piece') : null;
  if (!pieceEl || pieceEl.classList.contains('placed')) return;
  const p = G.pieces.find(q => q.el === pieceEl);
  if (!p) return;
  e.preventDefault();
  Audio_.sfx.pickup();
  const rect = G.el.game.getBoundingClientRect();
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
  G.drag = { p, dx: cx - p.tx, dy: cy - p.ty, id: e.pointerId };
  p.el.classList.add('dragging');
  p.rot = 0;
  p.ts = 1;                       // grow to full size in hand
  p.el.style.transition = 'transform .18s ease-out';
  p.el.style.transform = pieceTransformStr(p);
  if (p.el.setPointerCapture) { try { p.el.setPointerCapture(e.pointerId); } catch (err) {} }
}
function onPointerMove(e) {
  if (!G.drag || e.pointerId !== G.drag.id) return;
  const rect = G.el.game.getBoundingClientRect();
  const p = G.drag.p;
  p.tx = clamp(e.clientX - rect.left - G.drag.dx, -60, rect.width + 60);
  p.ty = clamp(e.clientY - rect.top - G.drag.dy, -60, rect.height + 60);
  p.el.style.transition = 'none';
  p.el.style.transform = pieceTransformStr(p);
  highlightSlots(p);
}
function onPointerUp(e) {
  if (!G.drag || (e && e.pointerId !== G.drag.id)) return;
  const { p } = G.drag;
  const lay = G.layout;
  const own = slotCenter(p.r, p.c, lay);
  const inBoard = p.tx > lay.board.x - lay.S * 0.6 && p.tx < lay.board.x + lay.board.w + lay.S * 0.6 &&
                  p.ty > lay.board.y - lay.S * 0.6 && p.ty < lay.board.y + lay.board.h + lay.S * 0.6;
  const dist = Math.hypot(p.tx - own.x, p.ty - own.y);
  clearHighlights();
  if (inBoard) G.moves++;
  if (inBoard && dist < lay.S * 0.46) {
    placePiece(p);
  } else {
    if (inBoard) {
      Audio_.sfx.buzz();
      p.pin.classList.add('shake');
      setTimeout(() => p.pin.classList.remove('shake'), 330);
    }
    returnToTray(p);
  }
  updateHud();
  endDrag();
}
function endDrag() {
  if (G.drag) {
    G.drag.p.el.classList.remove('dragging');
    G.drag = null;
  }
}
function returnToTray(p) {
  p.ts = p.trayTs || p.ts;
  p.el.style.transition = 'transform .3s cubic-bezier(.3,1.5,.4,1)';
  p.el.style.transform = pieceTransformStr(p);
}
function highlightSlots(p) {
  clearHighlights();
  const lay = G.layout;
  for (const s of G.el.slots.children) {
    const [r, c] = s.dataset.rc.split(',').map(Number);
    const sc = slotCenter(r, c, lay);
    const d = Math.hypot(p.tx - sc.x, p.ty - sc.y);
    if (d < lay.S * 0.5) s.classList.add(r === p.r && c === p.c ? 'own-near' : 'near');
  }
}
function clearHighlights() {
  $$('.slot.near,.slot.own-near').forEach(s => s.classList.remove('near', 'own-near'));
}

function placePiece(p) {
  p.placed = true;
  G.placed++;
  p.rot = 0;
  p.el.classList.add('placed');
  p.el.style.transition = 'transform .24s cubic-bezier(.25,1.6,.4,1)';
  p.el.style.transform = pieceTransformStr(p);
  Audio_.sfx.snap();
  const lay = G.layout;
  const sc = slotCenter(p.r, p.c, lay);
  const gRect = G.el.game.getBoundingClientRect();
  FX.sparkleBurst(gRect.left + sc.x, gRect.top + sc.y, 14, { sp: 190 });
  setTimeout(() => Audio_.sfx.sparkle(), 60);
  updateHud();
  if (G.placed === G.n * G.n) winLevel();
}

function updateHud() {
  G.el.hudMoves.textContent = G.moves;
  G.el.hudProgress.textContent = '🧩 ' + G.placed + '/' + (G.n * G.n);
  G.el.trayCount.textContent = '· ' + G.placed + '/' + (G.n * G.n);
}

/* ============================================================
   WIN!
   ============================================================ */
function winLevel() {
  G.phase = 'won';
  clearInterval(G.timerInt);
  Audio_.stopMusic();
  const l = G.level;
  const secs = Math.max(1, Math.round((Date.now() - G.timeStart) / 1000));
  const pieces = G.n * G.n;
  const stars = G.moves <= Math.ceil(pieces * 1.5) ? 3 : (G.moves <= Math.ceil(pieces * 2.5) ? 2 : 1);
  const prevBest = save.stars[l] || 0;
  const isNewBest = stars > prevBest;
  save.stars[l] = Math.max(prevBest, stars);
  save.progress = Math.max(save.progress, Math.min(50, l + 1));
  persist();

  Audio_.sfx.win();
  const lay = G.layout;
  const gRect = G.el.game.getBoundingClientRect();
  // sparkling waves over every placed piece
  G.pieces.forEach((p, i) => {
    setTimeout(() => {
      const sc = slotCenter(p.r, p.c, lay);
      FX.sparkleBurst(gRect.left + sc.x, gRect.top + sc.y, 6, { sp: 160 });
    }, i * 26);
  });
  setTimeout(() => {
    FX.sparkleBurst(gRect.left + lay.board.x + lay.board.w / 2, gRect.top + lay.board.y + lay.board.h / 2, 48, { sp: 430 });
    FX.confettiStorm(3800);
  }, 620);
  setTimeout(() => {
    G.el.complete.classList.add('show');
    G.el.completeTitle.textContent = l >= 50 ? 'All 50 Levels Done!' : 'Level ' + l + ' Complete!';
    G.el.statMoves.textContent = G.moves;
    G.el.statTime.textContent = fmtTime(secs);
    G.el.statPieces.textContent = pieces;
    G.el.newBest.classList.toggle('show', isNewBest);
    const starsEl = G.el.completeStars;
    starsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const sp = document.createElement('span');
      sp.textContent = '⭐';
      if (i < stars) { sp.classList.add('on'); sp.style.animationDelay = (0.25 + i * 0.22) + 's'; }
      starsEl.appendChild(sp);
    }
    G.el.btnNext.textContent = l >= 50 ? '🏆 Play Again' : '▶ Next Level';
    Audio_.sfx.levelUp();
  }, 980);
}

function preloadAll() {
  imgArr().forEach(im => { const i = new Image(); i.src = im.s; });
}

/* ---------- hint / peek ---------- */
function doHintPeek() {
  Audio_.sfx.sparkle();
  const lay = G.layout;
  const pk = G.el.peek;
  pk.style.left = lay.board.x + 'px';
  pk.style.top = lay.board.y + 'px';
  pk.style.width = lay.board.w + 'px'; pk.style.height = lay.board.h + 'px';
  pk.style.backgroundSize = lay.board.w + 'px ' + lay.board.h + 'px';
  pk.classList.add('show');
  pk.style.opacity = '0.32';
  G.el.boardFrame.classList.add('dim');
  clearTimeout(G.hintTimer);
  G.hintTimer = setTimeout(() => {
    pk.style.opacity = '0';
    pk.classList.remove('show');
    G.el.boardFrame.classList.remove('dim');
  }, 2600);
}
// 1 free hint per level always. A 2nd hint is available behind a rewarded
// ad — but if ads aren't live yet (pending approval, blocked, etc.) it
// just unlocks for free instead of staying stuck.
function refreshHintBtn() {
  const b = G.el.btnHint;
  if (!b) return;
  if (G.hintCount >= 2) {
    b.disabled = true; b.textContent = '💡'; b.title = 'No more hints this level';
  } else if (G.hintCount === 1 && adsEnabled()) {
    b.disabled = G.hintBusy;
    b.textContent = G.hintBusy ? '⏳' : '📺';
    b.title = G.hintBusy ? 'Loading ad…' : 'Watch a short ad for another hint';
  } else {
    b.disabled = false; b.textContent = '💡'; b.title = 'Hint';
  }
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  cacheEls();
  FX.resize();
  preloadAll();
  refreshSoundBtns();
  // Warm up the ad script in the background the moment the page opens, so
  // by the time the player taps Play, loadAdScript() below is usually
  // already resolved (ready or failed) instead of making them wait for it.
  loadAdScript();

  G.el.btnPlay.addEventListener('click', () => { Audio_.unlock(); Audio_.sfx.click(); goToLevel(save.progress); });
  G.el.btnLevels.addEventListener('click', () => { Audio_.unlock(); Audio_.sfx.click(); showScreen('levels'); });
  G.el.btnSoundTitle.addEventListener('click', () => { Audio_.unlock(); Audio_.setMuted(!save.muted); refreshSoundBtns(); Audio_.sfx.click(); });
  G.el.btnBackTitle.addEventListener('click', () => { Audio_.sfx.click(); showScreen('title'); });

  G.el.btnBackLevels.addEventListener('click', () => { Audio_.sfx.click(); clearInterval(G.timerInt); Audio_.stopMusic(); FX.stopConfetti(); showScreen('levels'); });
  G.el.btnSoundGame.addEventListener('click', () => { Audio_.setMuted(!save.muted); refreshSoundBtns(); Audio_.sfx.click(); });
  G.el.btnRef.addEventListener('click', () => {
    Audio_.sfx.click();
    save.ref = !save.ref;
    persist();
    refreshSoundBtns();
    if (G.phase === 'breaking' || G.phase === 'play' || G.phase === 'won') showRef(save.ref);
  });
  G.el.btnHint.addEventListener('click', () => {
    if (G.phase !== 'play' || G.hintBusy || G.hintCount >= 2) return;
    if (G.hintCount === 0) {
      G.hintCount = 1;
      doHintPeek();
      refreshHintBtn();
      return;
    }
    // 2nd hint: gated behind a rewarded ad (auto-unlocks if ads aren't live)
    G.hintBusy = true;
    refreshHintBtn();
    unlockOrWatchAd('extra-hint',
      () => { G.hintBusy = false; G.hintCount = 2; doHintPeek(); refreshHintBtn(); },
      () => { G.hintBusy = false; refreshHintBtn(); }
    );
  });

  G.el.btnNext.addEventListener('click', () => {
    Audio_.sfx.click();
    goToLevel(G.level >= 50 ? 1 : G.level + 1);
  });
  G.el.btnReplay.addEventListener('click', () => { Audio_.sfx.click(); startLevel(G.level); }); // retry: no ad, same level
  G.el.btnToLevels.addEventListener('click', () => { Audio_.sfx.click(); showScreen('levels'); });

  const layer = G.el.pieces;
  layer.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', () => { if (G.drag) { returnToTray(G.drag.p); endDrag(); clearHighlights(); } });

  makeFloaters();
  showScreen('title');
}

function makeFloaters() {
  const layer = G.el.floatLayer;
  if (!layer) return;
  const colors = ['#ffd54a', '#ff6ec7', '#6ee7ff', '#7cffb2', '#ff9f43', '#c69bff'];
  for (let i = 0; i < 11; i++) {
    const d = document.createElement('div');
    d.className = 'float-piece';
    const S = 30 + Math.random() * 46;
    const tabs = { t: Math.random() < .5 ? 1 : -1, r: Math.random() < .5 ? 1 : -1, b: Math.random() < .5 ? 1 : -1, l: Math.random() < .5 ? 1 : -1 };
    const out = pieceOutline(S, tabs, S * 0.2);
    const pct = out.map(([x, y]) => (x / S * 100).toFixed(1) + '% ' + (y / S * 100).toFixed(1) + '%');
    d.style.width = S + 'px'; d.style.height = S + 'px';
    d.style.left = rand(2, 96) + 'vw';
    d.style.clipPath = 'polygon(' + pct.join(',') + ')';
    d.style.background = 'linear-gradient(135deg,' + pick(colors) + ',' + pick(colors) + ')';
    d.style.animationDuration = rand(9, 20) + 's';
    d.style.animationDelay = -rand(0, 20) + 's';
    layer.appendChild(d);
  }
}

/* ----- test/demo hooks (harmless in production) ----- */
window.__pz = {
  get state() { return { level: G.level, n: G.n, phase: G.phase, placed: G.placed, moves: G.moves, progress: save.progress, navCalls: G.navCalls, navBusy: G.navBusy }; },
  get layout() { return G.layout ? { S: G.layout.S, D: G.layout.D, board: G.layout.board, tray: G.layout.tray, ts: G.pieces.length ? G.pieces[0].ts : null } : null; },
  start: startLevel,
  placeAll: function () {
    G.pieces.filter(p => !p.placed).forEach(p => placePiece(p));
  },
  cleanup: function () { clearInterval(G.timerInt); FX.stopConfetti(); }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();