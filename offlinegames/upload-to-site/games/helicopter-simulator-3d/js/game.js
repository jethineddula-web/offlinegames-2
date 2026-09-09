/* ============================================================
   game.js  —  Main loop, cameras, input, missions, UI
   Helicopter Simulator 3D  |  offlinegames.art
   ============================================================ */
'use strict';

const GAME = (function () {

  /* Bump this whenever you upload a new build. It is printed on the start
     screen and returned by GAME.orientationInfo, which makes "is the app
     actually running the new files?" a two-second question to answer. */
  const BUILD = '20260909b';

  /* ---------------- module state ---------------- */
  let canvas, gl;
  let heli = null, city = null, level = null, envDef = null;
  let batches = [];
  let running = false, paused = false;
  let state = 'boot';          // boot | menu | playing | paused | complete | failed | shop | levels
  let lastT = 0, timeAcc = 0, elapsed = 0, missionTime = 0;
  let camMode = 1;             // 0 pilot, 1 chase, 2 far
  const CAM_NAMES = ['PILOT VIEW', 'CHASE VIEW', 'WIDE VIEW'];

  let stars = [], gates = [], landing = null;
  let bStar, bGate, bBeam, bLandRing, bBoom, bDebris;
  let boomParts = [];
  let collected = 0, gateIndex = 0, damageTaken = 0;
  let hintTarget = null, hintUntil = 0;
  let crashReason = '', crashHold = 0;
  let windPhase = 0;
  const wind = M.v3.create(0, 0, 0);
  let shakeT = 0, shakeAmt = 0;
  let usedRepair = false, usedFuel = false;

  /* ---------------- camera ---------------- */
  const cam = {
    pos: M.v3.create(0, 20, 40),
    target: M.v3.create(0, 5, 0),
    up: M.v3.create(0, 1, 0),
    view: M.m4.create(),
    proj: M.m4.create(),
    viewProj: M.m4.create(),
    fov: 62 * M.DEG,
    smoothPos: M.v3.create(0, 20, 40),
    smoothTgt: M.v3.create(0, 0, 0)
  };

  /* ---------------- input ---------------- */
  const keys = {};
  const input = { collective: 0, pitch: 0, roll: 0, yaw: 0 };
  const touch = {
    active: false,
    stick: { id: null, cx: 0, cy: 0, x: 0, y: 0 },
    coll: { id: null, v: 0 },
    yaw: 0
  };

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    canvas = document.getElementById('gl');
    gl = R.init(canvas, { antialias: true, shadowSize: pickShadowSize() });
    if (!gl) {
      document.getElementById('nowebgl').classList.remove('hidden');
      document.getElementById('loader').classList.add('hidden');
      return false;
    }
    UI.init();
    ADS.init();
    bindInput();
    WORLD.createResources();
    buildCollectibleBatches();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(onResize, 120);
      setTimeout(onResize, 420);        // iOS reports the new size late
    });
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener('change', () => setTimeout(onResize, 160));
    }
    /* some mobile browsers only settle the viewport after the URL bar hides */
    window.addEventListener('pageshow', () => setTimeout(onResize, 200));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => setTimeout(onResize, 60));
    }
    onResize();
    /* an app can lock straight away; a browser tab needs a user gesture first */
    scheduleNativeLock();
    const lockOnce = () => {
      if (!nativeLockTried) { nativeLockTried = true; goFullscreenAndLock(); }
      window.removeEventListener('pointerdown', lockOnce);
    };
    window.addEventListener('pointerdown', lockOnce);

    try {
      if (/[?&#]debug=1/i.test(location.search + location.hash)) setDebug(true);
      const stamp = document.getElementById('buildStamp');
      if (stamp) stamp.textContent = 'build ' + BUILD;
    } catch (e) { /* ignore */ }

    state = 'menu';
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    running = true;
    lastT = performance.now();
    requestAnimationFrame(frame);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  ORIENTATION                                                        */
  /*  A browser cannot physically turn the handset, so on a phone held in */
  /*  portrait we turn the whole game a quarter turn instead. The player  */
  /*  is never asked to do anything: it is always landscape, and it stays */
  /*  landscape whichever way the phone is held or locked.                */
  /* ------------------------------------------------------------------ */
  let stageEl = null;
  let stageRotated = false;
  let stageW = 1, stageH = 1, uiScale = 1;
  let nativeLockTried = false;
  let nativeLockSettled = false;   /* app builds: give the real lock a moment */
  let lockAttempts = 0;
  const NATIVE_BANNER_PX = 58;   /* height an AdMob anchored banner occupies */

  /* Force the quarter-turn on or off, bypassing all detection.
       null  = decide automatically (default)
       true  = always rotate portrait -> landscape
       false = never rotate
     Set it with ?landscape=1 / ?landscape=0 in the URL, or at runtime with
     GAME.setLandscape(true|false|null). Handy inside an app WebView where you
     cannot open devtools. */
  let orientationOverride = null;
  (function readOverride() {
    try {
      const q = (location.search + location.hash).toLowerCase();
      if (/[?&#]landscape=1/.test(q)) orientationOverride = true;
      else if (/[?&#]landscape=0/.test(q)) orientationOverride = false;
    } catch (e) { /* ignore */ }
  })();

  /** Running inside a Cordova / Capacitor shell rather than a browser tab. */
  function isNativeApp() {
    return !!(window.cordova || window.Capacitor || window.phonegap ||
      (window.plugins && window.plugins.screenorientation) ||
      /^(file|capacitor|ionic|app):$/i.test(location.protocol));
  }

  function isPhone() {
    /* an app shell only ever runs on a handset or tablet */
    if (isNativeApp()) return true;
    const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
    const coarse = mq('(pointer: coarse)');
    const noHover = mq('(hover: none)');
    /* "; wv)" marks an Android WebView; the rest are the usual handset tokens */
    const ua = /Android|iPhone|iPod|IEMobile|Mobile|Silk|; wv\)/i.test(navigator.userAgent);
    /* A WebView that ignores or has not yet parsed the viewport meta reports a
       fictional ~980 css px wide layout, so the old `< 900` gate silently
       switched the whole feature off inside the app. Judge the platform first
       and use a generous size ceiling only as a sanity check. */
    const smallest = Math.min(window.innerWidth, window.innerHeight);
    return (coarse || ua || noHover) && smallest < 1100;
  }

  /** Ask the platform for a real landscape lock, through every API that might
   *  be present: the standards one, the old Screen Orientation draft, and the
   *  Cordova / Capacitor plugins. When one works the viewport itself reports
   *  landscape and the CSS quarter-turn below never has to engage. */
  function tryNativeLock() {
    lockAttempts++;
    let asked = false;
    try {
      if (window.screen && screen.orientation && screen.orientation.lock) {
        const p = screen.orientation.lock('landscape');
        if (p && p.catch) p.catch(() => {});
        asked = true;
      }
    } catch (e) { /* refused outside fullscreen */ }
    try {
      /* older Screen Orientation draft, still what some WebViews expose */
      const sc = window.screen;
      const legacy = sc && (sc.lockOrientation || sc.mozLockOrientation ||
                            sc.msLockOrientation || sc.webkitLockOrientation);
      if (legacy) { legacy.call(sc, 'landscape'); asked = true; }
    } catch (e) { /* ignore */ }
    try {
      /* cordova-plugin-screen-orientation, older API surface */
      if (window.plugins && window.plugins.screenorientation &&
          window.plugins.screenorientation.setOrientation) {
        window.plugins.screenorientation.setOrientation('landscape');
        asked = true;
      }
    } catch (e) { /* ignore */ }
    try {
      /* @capacitor/screen-orientation */
      const cap = window.Capacitor && window.Capacitor.Plugins;
      if (cap && cap.ScreenOrientation && cap.ScreenOrientation.lock) {
        cap.ScreenOrientation.lock({ orientation: 'landscape' });
        asked = true;
      }
    } catch (e) { /* ignore */ }
    return asked;
  }

  function goFullscreenAndLock() {
    if (!isPhone()) return;
    /* a native shell is already fullscreen; asking again just throws */
    if (isNativeApp()) { tryNativeLock(); return; }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req && !document.fullscreenElement) {
      try {
        const r = req.call(el, { navigationUI: 'hide' });
        if (r && r.then) r.then(tryNativeLock).catch(tryNativeLock);
        else tryNativeLock();
        return;
      } catch (e) { /* fall through */ }
    }
    tryNativeLock();
  }

  /** Keep asking for a real lock in the background. This never blocks the CSS
   *  fallback any more — whichever one wins, layoutStage() reacts to the size
   *  the viewport actually reports. */
  function scheduleNativeLock() {
    nativeLockSettled = true;
    tryNativeLock();
    /* Cordova/Capacitor plugins register on deviceready, which may not have
       fired yet; a plain WebView never fires it and simply skips this. */
    document.addEventListener('deviceready', () => {
      tryNativeLock();
      setTimeout(() => { tryNativeLock(); onResize(); }, 200);
    }, false);
    [150, 450, 900, 1800].forEach(ms => setTimeout(() => {
      if (window.innerHeight > window.innerWidth) tryNativeLock();
      onResize();
    }, ms));
  }

  /** Size the stage, decide whether it needs the quarter turn, and publish
   *  the stage's own dimensions to CSS so vh/vw-style rules stay correct. */
  function layoutStage() {
    if (!stageEl) stageEl = document.getElementById('stage');
    if (!stageEl) return;

    const w = window.innerWidth, h = window.innerHeight;
    /* Rotate the moment we see a portrait handset. If a native lock lands a
       beat later the viewport becomes landscape, resize fires and we simply
       un-rotate — and because start-up sits behind the loader, that flip is
       never visible. Waiting for the lock first was safer in theory and just
       meant "no rotation at all" whenever the lock silently failed. */
    const rotate = orientationOverride !== null
      ? orientationOverride
      : (isPhone() && h > w);

    /* A native AdMob banner is drawn by the OS at the physical bottom of the
       screen, outside the WebView's control. Once the stage is turned, the
       physical bottom is the GAME'S RIGHT EDGE, so the banner would sit on top
       of the collective. Shrinking the stage's width by the banner strip keeps
       the two from ever overlapping. */
    const nativeBanner = (rotate && typeof ADS !== 'undefined' && ADS.platform === 'app')
      ? NATIVE_BANNER_PX : 0;

    stageRotated = rotate;
    stageW = (rotate ? h : w) - nativeBanner;
    stageH = rotate ? w : h;

    stageEl.style.width = stageW + 'px';
    stageEl.style.height = stageH + 'px';

    /* Layout classes are driven by the STAGE, never by a media query: once the
       stage is turned a quarter, the viewport's width and height describe the
       wrong axes and every @media rule would fire backwards. */
    const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
    const fine = mq('(pointer: fine)');      // primary pointer is a mouse/trackpad
    const coarse = mq('(pointer: coarse)');  // primary pointer is a finger
    const mobileUA = /Android|iPhone|iPod|iPad|Mobile|Silk|Tablet/i.test(navigator.userAgent);
    const cl = stageEl.classList;
    cl.toggle('rot', rotate);
    cl.toggle('sz-narrow', stageW <= 780);
    cl.toggle('sz-short', stageH <= 560);
    cl.toggle('touch', coarse || !fine || mobileUA);
    /* Hide the on-screen sticks only where we are confident there is a real
       mouse: a wide stage, a fine pointer, and nothing that smells like a
       handset. Getting this wrong on a phone would leave it unflyable, so the
       benefit of the doubt always goes to showing the controls. */
    cl.toggle('no-touch', fine && !coarse && !mobileUA && stageW >= 900);

    /* one scale factor keeps every HUD cluster inside the smallest handsets */
    uiScale = M.clamp(Math.min(stageW / 880, stageH / 430), 0.62, 1);

    const rs = document.documentElement.style;
    rs.setProperty('--vw', stageW + 'px');
    rs.setProperty('--vh', stageH + 'px');
    rs.setProperty('--ui', uiScale.toFixed(3));
  }

  /** A readout pinned outside the stage (so it stays upright even when the
   *  game is turned), for diagnosing a phone with no devtools attached.
   *  Enable with ?debug=1 in the URL, or GAME.debug(true). */
  let dbgEl = null, dbgTimer = null;
  function setDebug(on) {
    if (on) {
      if (!dbgEl) {
        dbgEl = document.createElement('pre');
        dbgEl.id = 'orientDebug';
        document.body.appendChild(dbgEl);
        dbgEl.addEventListener('click', () => setDebug(false));
      }
      dbgEl.style.display = 'block';
      const tick = () => {
        const i = api.orientationInfo;
        dbgEl.textContent =
          'build   ' + i.build +
          '\nrotated ' + i.rotated + '   override ' + i.override +
          '\nphone   ' + i.phone + '   app ' + i.nativeApp +
          '\ninner   ' + i.inner.join(' x ') +
          '\nscreen  ' + i.screen.join(' x ') + '  dpr ' + i.dpr +
          '\nstage   ' + i.stage.join(' x ') + '   ui ' + i.ui +
          '\nlocks   ' + i.lockAttempts +
          '\n\n' + i.ua.replace(/(.{34})/g, '$1\n') +
          '\n\n(tap to close)';
      };
      tick();
      if (dbgTimer) clearInterval(dbgTimer);
      dbgTimer = setInterval(tick, 600);
    } else if (dbgEl) {
      dbgEl.style.display = 'none';
      if (dbgTimer) { clearInterval(dbgTimer); dbgTimer = null; }
    }
  }

  /** viewport point -> stage point (identity unless the stage is turned) */
  function toStage(clientX, clientY) {
    if (!stageRotated) return { x: clientX, y: clientY };
    return { x: clientY, y: window.innerWidth - clientX };
  }

  /** an element's box, expressed in stage coordinates */
  function stageRect(el) {
    const r = el.getBoundingClientRect();
    const a = toStage(r.left, r.top);
    const b = toStage(r.right, r.bottom);
    const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y);
    return { left, top, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
  }

  function pickShadowSize() {
    const q = SAVE.data.settings.quality;
    if (q === 'low') return 1024;
    if (q === 'high') return 2048;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    return mobile ? 1024 : 2048;
  }

  function onResize() {
    layoutStage();
    const r = R.resize(SAVE.data.settings.quality === 'low' ? 1 : 2);
    M.m4.perspective(cam.proj, cam.fov, r.aspect, 0.35, 4200);
    UI.resizeMinimap();
  }

  /* ============================================================
     COLLECTIBLE BATCHES
     ============================================================ */
  function buildCollectibleBatches() {
    const meshes = WORLD.getMeshes();
    bStar = R.makeBatch(meshes.star, null, { capacity: 40, castShadow: false, blend: false });
    bGate = R.makeBatch(meshes.ring, null, { capacity: 24, castShadow: false, doubleSided: true });
    bBeam = R.makeBatch(meshes.cyl, null, { capacity: 4, castShadow: false, blend: true, order: 2 });
    bLandRing = R.makeBatch(meshes.ring, null, { capacity: 2, castShadow: false, doubleSided: true, blend: true, order: 2 });
    bBoom = R.makeBatch(meshes.unitPlane, WORLD.getTextures().glow,
      { capacity: 140, castShadow: false, blend: true, doubleSided: true, alphaTex: true, order: 9 });
    bDebris = R.makeBatch(meshes.unitBox, null, { capacity: 40, castShadow: false, order: 8 });
  }

  /* ------------------------------------------------------------------ */
  /*  EXPLOSION                                                          */
  /* ------------------------------------------------------------------ */
  function spawnExplosion(x, y, z, power) {
    power = power || 1;
    boomParts.length = 0;
    /* core fireball */
    for (let i = 0; i < 12; i++) {
      boomParts.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 9, vy: Math.random() * 7 + 1, vz: (Math.random() - 0.5) * 9,
        t: 0, life: 0.70 + Math.random() * 0.60,
        r0: 2.8 + Math.random() * 3.4, grow: 10 + Math.random() * 9,
        kind: 'fire', delay: Math.random() * 0.10, spin: 0, spinRate: 0
      });
    }
    /* flung debris */
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, s = 9 + Math.random() * 24;
      boomParts.push({
        x, y, z,
        vx: Math.cos(a) * s, vy: 5 + Math.random() * 20, vz: Math.sin(a) * s,
        t: 0, life: 1.3 + Math.random() * 0.9,
        r0: 0.16 + Math.random() * 0.30, grow: 0,
        kind: 'debris', delay: 0,
        spin: Math.random() * 6.28, spinRate: (Math.random() - 0.5) * 16
      });
    }
    /* smoke column */
    for (let i = 0; i < 34; i++) {
      boomParts.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 9, vy: 2 + Math.random() * 9, vz: (Math.random() - 0.5) * 9,
        t: 0, life: 2.0 + Math.random() * 2.0,
        r0: 1.4 + Math.random() * 2.6, grow: 8 + Math.random() * 9,
        kind: 'smoke', delay: Math.random() * 0.65, spin: 0, spinRate: 0
      });
    }
    shakeT = 1.4; shakeAmt = 3.2 * power;
    UI.bigFlash();
  }

  const _bbQ = M.quat.create();
  const _bbAxis = M.v3.create();
  function updateBillboardQuat() {
    /* rotate the plane's +Y normal onto the vector pointing at the camera */
    const fx = cam.smoothTgt[0] - cam.smoothPos[0];
    const fy = cam.smoothTgt[1] - cam.smoothPos[1];
    const fz = cam.smoothTgt[2] - cam.smoothPos[2];
    const l = Math.hypot(fx, fy, fz) || 1;
    const nx = -fx / l, ny = -fy / l, nz = -fz / l;   // surface normal faces the camera
    M.v3.set(_bbAxis, nz, 0, -nx);                   // cross([0,1,0], n)
    const s = Math.hypot(_bbAxis[0], _bbAxis[1], _bbAxis[2]);
    if (s < 1e-5) { M.quat.identity(_bbQ); if (ny < 0) M.quat.setAxisAngle(_bbQ, 1, 0, 0, Math.PI); return; }
    const ang = Math.acos(M.clamp(ny, -1, 1));
    M.quat.setAxisAngle(_bbQ, _bbAxis[0] / s, _bbAxis[1] / s, _bbAxis[2] / s, ang);
  }

  function updateExplosion(dt) {
    bBoom.clear();
    bDebris.clear();
    if (!boomParts.length) return;
    updateBillboardQuat();
    let alive = false;
    for (const p of boomParts) {
      if (p.delay > 0) { p.delay -= dt; alive = true; continue; }
      p.t += dt;
      if (p.t >= p.life) continue;
      alive = true;
      const k = p.t / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 'debris') { p.vy -= 22 * dt; p.vx *= 0.985; p.vz *= 0.985; }
      else { p.vy = p.vy * 0.94 + 1.6 * dt; p.vx *= 0.93; p.vz *= 0.93; }

      const rad = p.r0 + p.grow * k;
      M.v3.set(_p, p.x, p.y, p.z);

      if (p.kind === 'debris') {
        p.spin += dt * p.spinRate;
        M.quat.fromEuler(_q, p.spin, p.spin * 0.7, p.spin * 1.3);
        M.v3.set(_s, rad, rad * 0.6, rad * 1.4);
        M.m4.fromRotationTranslationScale(_m, _q, _p, _s);
        const glow = Math.max(0, 1 - k * 3);
        bDebris.push(_m, [0.46 + glow * 0.40, 0.43 + glow * 0.16, 0.41, 1],
                     [1, 1, glow * 1.0, 0.35]);
        continue;
      }

      let col, alpha, emis;
      if (p.kind === 'fire') {
        const hot = 1 - k;
        /* saturated orange that stays orange through the tonemap */
        col = [1.0, 0.16 + hot * 0.34, 0.03 + hot * 0.07];
        alpha = Math.min(0.95, (1 - k) * 1.6);
        emis = 1.35 * hot + 0.30;
      } else {
        /* smoke lightens and thins as it climbs, so it never reads as a solid ball */
        const g2 = 0.26 + k * 0.24;
        col = [g2, g2 * 0.97, g2 * 0.95];
        alpha = Math.min(0.21, (1 - k) * 0.32) * Math.min(1, p.t * 1.8);
        emis = 0.08;
      }
      M.v3.set(_s, rad * 2.0, 1, rad * 2.0);
      M.m4.fromRotationTranslationScale(_m, _bbQ, _p, _s);
      bBoom.push(_m, [col[0], col[1], col[2], alpha], [1, 1, emis, 0]);
    }
    if (!alive) boomParts.length = 0;
  }

  /* ============================================================
     LEVEL LOADING
     ============================================================ */
  function loadLevel(id) {
    level = LEVELS.get(id);
    envDef = LEVELS.env(level.env);

    UI.showLoader('Building ' + level.name + '…');

    /* let the loader paint before the heavy build */
    setTimeout(() => {
      city = WORLD.build(level.city);
      WORLD.setNight(envDef.night > 0.4);

      const rng = M.makeRng(level.city.seed + 7);
      const plan = level.plan(rng, city);

      stars = plan.stars.map(p => ({ x: p.x, y: p.y, z: p.z, got: false, spin: Math.random() * 6.28 }));
      gates = (plan.gates || []).map(g => Object.assign({ passed: false }, g));
      landing = plan.landing || null;
      collected = 0; gateIndex = 0; damageTaken = 0; missionTime = 0;
      usedRepair = false; usedFuel = false;
      hintTarget = null; hintUntil = 0;
      crashReason = ''; crashHold = 0;

      /* helicopter */
      const d = SAVE.data;
      heli = new HELI.Helicopter(d.heli, d.upgrades);
      const home = city.helipads.find(p => p.home) || { x: 0, y: 0, z: 0 };
      heli.reset(home.x, home.y + 1.35 * heli.scale, home.z, Math.PI);

      boomParts.length = 0;
      batches = city.batches.concat([bStar, bGate, bLandRing, bBeam, bDebris, bBoom], heli.batches);

      state = 'playing';
      paused = false;
      elapsed = 0;
      AUDIO.startMusic('game');
      AUDIO.startRotor();
      UI.hideAll();
      UI.showHud(true);
      UI.resetHudNudges();
      UI.applyKeyHelp();
      UI.setBrief(level);
      ADS.showBanner();
      UI.hideLoader();
    }, 60);
  }

  function restartLevel() { if (level) loadLevel(level.id); }

  function quitToMenu() {
    state = 'menu';
    AUDIO.stopRotor();
    AUDIO.startMusic('menu');
    UI.hideAll();
    UI.showHud(false);
    document.getElementById('menu').classList.remove('hidden');
    heli = null;
  }

  /* ============================================================
     INPUT
     ============================================================ */
  function bindInput() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (state !== 'playing') return;
      if (e.code === 'KeyC') { cycleCamera(); }
      if (e.code === 'KeyE') { if (heli && !heli.engineOn) { heli.startEngine(); AUDIO.sfx.startup(); UI.toast('Engine start — rotor spooling up'); } }
      if (e.code === 'KeyH') { UI.requestHint(); }
      if (e.code === 'KeyR') { restartLevel(); }
      if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); }
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    /* ---- touch ---- */
    const zone = document.getElementById('touchLayer');
    const stickEl = document.getElementById('stick');
    const knobEl = document.getElementById('stickKnob');
    const collEl = document.getElementById('collSlider');
    const collKnob = document.getElementById('collKnob');

    const startStick = (id, x, y) => {
      touch.stick.id = id;
      const r = stageRect(stickEl);
      touch.stick.cx = r.left + r.width / 2;
      touch.stick.cy = r.top + r.height / 2;
      /* the travel radius follows the on-screen size, so it scales with --ui */
      touch.stick.max = Math.max(24, r.width * 0.44);
      moveStick(x, y);
    };
    const moveStick = (x, y) => {
      const p = toStage(x, y);
      const dx = p.x - touch.stick.cx, dy = p.y - touch.stick.cy;
      const max = touch.stick.max || 58;
      const d = Math.hypot(dx, dy);
      const k = d > max ? max / d : 1;
      touch.stick.x = (dx * k) / max;
      touch.stick.y = (dy * k) / max;
      /* the knob lives inside a scaled parent, so undo that scale here */
      const s = uiScale || 1;
      knobEl.style.transform =
        'translate(' + (dx * k / s).toFixed(1) + 'px,' + (dy * k / s).toFixed(1) + 'px)';
    };
    const endStick = () => {
      touch.stick.id = null; touch.stick.x = 0; touch.stick.y = 0;
      knobEl.style.transform = 'translate(0,0)';
    };

    const moveColl = (clientX, clientY) => {
      const r = stageRect(collEl);
      const p = toStage(clientX, clientY);
      let v = 1 - (p.y - r.top) / Math.max(1, r.height);
      v = M.clamp(v, 0, 1);
      touch.coll.v = v;
      collKnob.style.bottom = (v * 100) + '%';
    };

    const onStart = (e) => {
      touch.active = true;
      for (const t of e.changedTouches) {
        const p = toStage(t.clientX, t.clientY);
        const inColl = p.x > stageW * 0.66;
        if (inColl && touch.coll.id === null) { touch.coll.id = t.identifier; moveColl(t.clientX, t.clientY); }
        else if (touch.stick.id === null) startStick(t.identifier, t.clientX, t.clientY);
      }
      e.preventDefault();
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touch.stick.id) moveStick(t.clientX, t.clientY);
        else if (t.identifier === touch.coll.id) moveColl(t.clientX, t.clientY);
      }
      e.preventDefault();
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touch.stick.id) endStick();
        else if (t.identifier === touch.coll.id) touch.coll.id = null;
      }
      e.preventDefault();
    };
    if (zone) {
      zone.addEventListener('touchstart', onStart, { passive: false });
      zone.addEventListener('touchmove', onMove, { passive: false });
      zone.addEventListener('touchend', onEnd, { passive: false });
      zone.addEventListener('touchcancel', onEnd, { passive: false });
    }
    const hold = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = (e) => { el.dataset.on = '1'; fn(true); e.preventDefault(); };
      const off = (e) => { el.dataset.on = ''; fn(false); e.preventDefault(); };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
    };
    hold('yawL', v => touch.yaw = v ? -1 : 0);
    hold('yawR', v => touch.yaw = v ? 1 : 0);
  }

  function readInput(dt) {
    if (!heli) return;
    /* collective is a lever that stays where you put it */
    let cRate = 0;
    if (keys.KeyW || keys.ShiftLeft || keys.ShiftRight) cRate += 1;
    if (keys.KeyS || keys.ControlLeft || keys.ControlRight) cRate -= 1;
    if (cRate !== 0) input.collective = M.clamp(input.collective + cRate * dt * 0.85, 0, 1);
    if (touch.coll.id !== null) input.collective = touch.coll.v;

    const inv = SAVE.data.settings.invertY ? -1 : 1;
    let p = 0, r = 0, y = 0;
    if (keys.ArrowUp) p += 1;                     /* nose down -> fly forward  */
    if (keys.ArrowDown) p -= 1;                   /* nose up   -> fly backward */
    if (keys.ArrowLeft) r += 1;                   /* bank left  -> slide left  */
    if (keys.ArrowRight) r -= 1;                  /* bank right -> slide right */
    if (keys.KeyA || keys.KeyQ) y += 1;           /* pedal left  -> nose left  */
    if (keys.KeyD) y -= 1;                        /* pedal right -> nose right */
    if (touch.stick.id !== null) { p += -touch.stick.y; r += -touch.stick.x; }
    y += -touch.yaw;

    input.pitch = M.clamp(p, -1, 1) * inv;
    input.roll = M.clamp(r, -1, 1);
    input.yaw = M.clamp(y, -1, 1);

    /* hover assist: hold altitude when the stick is centred */
    if (SAVE.data.settings.assist && heli.engineOn && cRate === 0 &&
        touch.coll.id === null && heli.rotorRpm > 0.9 && heli.agl > 2.5) {
      const vy = M.clamp(heli.vel[1], -6, 6);
      input.collective = M.clamp(input.collective - vy * dt * 0.020, 0.05, 1);
    }
  }

  function cycleCamera() {
    camMode = (camMode + 1) % 3;
    UI.toast(CAM_NAMES[camMode]);
    AUDIO.sfx.click();
    UI.setCamLabel(CAM_NAMES[camMode]);
  }

  function togglePause() {
    if (state === 'playing') {
      paused = true; state = 'paused';
      document.getElementById('pause').classList.remove('hidden');
      AUDIO.updateRotor(0.05, 0, 0);
    } else if (state === 'paused') {
      paused = false; state = 'playing';
      document.getElementById('pause').classList.add('hidden');
    }
  }

  /* ============================================================
     CAMERA UPDATE
     ============================================================ */
  const _tmpA = M.v3.create(), _tmpB = M.v3.create(), _tmpC = M.v3.create();

  function updateCamera(dt) {
    if (!heli) return;
    const spd = M.v3.len(heli.vel);

    if (camMode === 0) {
      /* --- pilot / cockpit --- */
      heli.localToWorld(_tmpA, 0.44, 0.46, -1.55);
      heli.localToWorld(_tmpB, 0.44, -0.20, -9.0);
      M.v3.copy(cam.pos, _tmpA);
      M.v3.copy(cam.target, _tmpB);
      M.v3.set(_tmpC, 0, 1, 0);
      M.v3.transformQuat(cam.up, _tmpC, heli.quat);
      M.v3.copy(cam.smoothPos, cam.pos);
      M.v3.copy(cam.smoothTgt, cam.target);
      cam.fov = (58 + Math.min(18, spd * 0.30)) * M.DEG;
    } else {
      /* --- chase / wide: follow yaw only, so the horizon stays level --- */
      const far = camMode === 2;
      const dist = far ? 34 : 15.5;
      const high = far ? 13 : 5.2;
      const yaw = heli.yaw;
      const bx = Math.sin(yaw), bz = Math.cos(yaw);
      /* offset behind the nose (nose is -Z in local space) */
      const tx = heli.pos[0] + bx * dist * -1 * -1;
      const px = heli.pos[0] - Math.sin(yaw + Math.PI) * dist;
      const pz = heli.pos[2] - Math.cos(yaw + Math.PI) * dist;
      M.v3.set(_tmpA, px, heli.pos[1] + high, pz);

      /* lead the camera slightly in the direction of travel */
      M.v3.set(_tmpB,
        heli.pos[0] + heli.vel[0] * 0.28,
        heli.pos[1] + heli.vel[1] * 0.16 + (far ? 1.5 : 1.0),
        heli.pos[2] + heli.vel[2] * 0.28);

      /* keep the camera out of buildings */
      const hit = WORLD.collide(_tmpA[0], _tmpA[1], _tmpA[2], 2.0);
      if (hit) {
        _tmpA[0] += hit.nx * (hit.depth + 0.6);
        _tmpA[1] += hit.ny * (hit.depth + 0.6);
        _tmpA[2] += hit.nz * (hit.depth + 0.6);
      }
      const gh = WORLD.supportHeight(_tmpA[0], _tmpA[2]);
      if (_tmpA[1] < gh + 2.2) _tmpA[1] = gh + 2.2;

      const k = far ? 4.2 : 7.5;
      cam.smoothPos[0] = M.damp(cam.smoothPos[0], _tmpA[0], k, dt);
      cam.smoothPos[1] = M.damp(cam.smoothPos[1], _tmpA[1], k, dt);
      cam.smoothPos[2] = M.damp(cam.smoothPos[2], _tmpA[2], k, dt);
      cam.smoothTgt[0] = M.damp(cam.smoothTgt[0], _tmpB[0], k * 1.4, dt);
      cam.smoothTgt[1] = M.damp(cam.smoothTgt[1], _tmpB[1], k * 1.4, dt);
      cam.smoothTgt[2] = M.damp(cam.smoothTgt[2], _tmpB[2], k * 1.4, dt);
      M.v3.set(cam.up, 0, 1, 0);
      cam.fov = ((far ? 55 : 60) + Math.min(14, spd * 0.24)) * M.DEG;
    }

    /* impact shake */
    if (shakeT > 0) {
      shakeT -= dt;
      const a = shakeAmt * Math.max(0, shakeT) ;
      cam.smoothPos[0] += (Math.random() - 0.5) * a;
      cam.smoothPos[1] += (Math.random() - 0.5) * a;
      cam.smoothPos[2] += (Math.random() - 0.5) * a;
    }

    M.m4.perspective(cam.proj, cam.fov, R.width / Math.max(1, R.height), 0.35, 4200);
    M.m4.lookAt(cam.view, cam.smoothPos, cam.smoothTgt, cam.up);
    M.m4.multiply(cam.viewProj, cam.proj, cam.view);
  }

  /* ============================================================
     COLLECTIBLES
     ============================================================ */
  const _m = new Float32Array(16);
  const _q = M.quat.create();
  const _p = M.v3.create();
  const _s = M.v3.create();

  function updateCollectibles(dt) {
    const t = performance.now() / 1000;

    /* stars */
    bStar.clear();
    for (const s of stars) {
      if (s.got) continue;
      s.spin += dt * 1.9;
      const bob = Math.sin(t * 1.6 + s.spin) * 0.8;
      M.quat.fromEuler(_q, 0.22, s.spin, 0);
      M.v3.set(_p, s.x, s.y + bob, s.z);
      M.v3.set(_s, 3.0, 3.0, 3.0);
      M.m4.fromRotationTranslationScale(_m, _q, _p, _s);
      bStar.push(_m, [1.0, 0.82, 0.16, 1], [1, 1, 1.35, 0.9]);

      if (heli && !heli.crashed) {
        const d = Math.hypot(heli.pos[0] - s.x, heli.pos[1] - (s.y + bob), heli.pos[2] - s.z);
        if (d < 7.2) {
          s.got = true; collected++;
          AUDIO.sfx.star();
          UI.pop('+1 MARKER');
          UI.flashScore();
          if (hintTarget === s) hintTarget = null;
        }
      }
    }

    /* gates (must be taken in order) */
    bGate.clear();
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i];
      const active = i === gateIndex;
      const col = g.passed ? [0.35, 0.85, 0.45, 1] : (active ? [0.25, 0.72, 1.0, 1] : [0.55, 0.58, 0.65, 1]);
      const pulse = active ? 1 + Math.sin(t * 3.4) * 0.05 : 1;
      M.quat.fromEuler(_q, Math.PI / 2, g.ry, 0);
      M.v3.set(_p, g.x, g.y, g.z);
      M.v3.set(_s, g.r * pulse, g.r * pulse, g.r * pulse);
      M.m4.fromRotationTranslationScale(_m, _q, _p, _s);
      bGate.push(_m, col, [1, 1, active ? 0.9 : 0.25, 0.4]);

      if (active && heli && !heli.crashed) {
        const dx = heli.pos[0] - g.x, dy = heli.pos[1] - g.y, dz = heli.pos[2] - g.z;
        const planar = g.ry === 0 ? Math.abs(dz) : Math.abs(dx);
        const radial = g.ry === 0 ? Math.hypot(dx, dy) : Math.hypot(dz, dy);
        if (planar < 5.5 && radial < g.r * 0.95) {
          g.passed = true; gateIndex++;
          AUDIO.sfx.ring();
          UI.pop('RING ' + gateIndex + '/' + gates.length);
        }
      }
    }

    /* landing marker */
    bLandRing.clear();
    if (landing && allCollected()) {
      const pulse = 1 + Math.sin(t * 2.4) * 0.08;
      M.quat.fromEuler(_q, Math.PI / 2, 0, 0);
      M.v3.set(_p, landing.x, landing.y + 1.2 + Math.sin(t * 1.4) * 0.4, landing.z);
      const rr = (landing.r || 10) * pulse;
      M.v3.set(_s, rr, rr, rr);
      M.m4.fromRotationTranslationScale(_m, _q, _p, _s);
      bLandRing.push(_m, [0.25, 1.0, 0.45, 0.75], [1, 1, 1.1, 0.2]);
    }

    /* hint beam */
    bBeam.clear();
    if (hintTarget && performance.now() < hintUntil) {
      const h = hintTarget;
      M.quat.identity(_q);
      M.v3.set(_p, h.x, h.y / 2, h.z);
      M.v3.set(_s, 1.6, h.y, 1.6);
      M.m4.fromRotationTranslationScale(_m, _q, _p, _s);
      bBeam.push(_m, [1.0, 0.85, 0.25, 0.20], [1, 1, 1.2, 0]);
    }
  }

  function allCollected() {
    return collected >= stars.length && gateIndex >= gates.length;
  }

  /* ============================================================
     MISSION LOGIC
     ============================================================ */
  function checkMission(dt) {
    if (!heli || state !== 'playing') return;

    /* crash — hold a beat so the fireball is on screen before the panel */
    if (heli.crashed) {
      crashHold += dt;
      if (crashHold > 1.25) endMission(false, crashReason || 'AIRFRAME DESTROYED');
      return;
    }

    /* out of fuel and falling */
    if (heli.fuel <= 0 && heli.agl > 4 && heli.vel[1] < -8) {
      UI.setWarn('FUEL EXHAUSTED — AUTOROTATE!');
    }

    /* timer */
    if (level.timeLimit > 0 && missionTime > level.timeLimit) {
      endMission(false, 'OUT OF TIME');
      return;
    }

    /* success */
    if (allCollected()) {
      if (!landing) {
        endMission(true);
      } else {
        const d = Math.hypot(heli.pos[0] - landing.x, heli.pos[2] - landing.z);
        const dy = Math.abs(heli.pos[1] - landing.y);
        if (d < (landing.r || 10) && dy < 4.0 && heli.isSettled()) {
          endMission(true);
        }
      }
    }
  }

  let endLock = false;
  function endMission(success, reason) {
    if (endLock) return;
    endLock = true;
    setTimeout(() => endLock = false, 800);

    AUDIO.stopRotor();
    if (success) {
      const rating = LEVELS.rate(level, { time: missionTime, damage: damageTaken, collected, total: stars.length });
      const timeBonus = level.timeLimit ? Math.max(0, Math.round((level.timeLimit - missionTime) * 3)) : 0;
      const cleanBonus = damageTaken < 8 ? Math.round(level.reward * 0.25) : 0;
      const coins = level.reward + timeBonus + cleanBonus;
      SAVE.recordLevel(level.id, rating, missionTime, coins);
      AUDIO.sfx.success();
      state = 'complete';
      UI.showComplete({ rating, coins, timeBonus, cleanBonus, base: level.reward, time: missionTime, damage: damageTaken });
    } else {
      AUDIO.sfx.fail();
      state = 'failed';
      UI.showFailed(reason || 'MISSION FAILED');
    }
  }

  /* ============================================================
     MAIN LOOP
     ============================================================ */
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);

    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 0.0001;
    elapsed += dt;

    if (state === 'playing') {
      missionTime += dt;
      readInput(dt);

      /* wind */
      windPhase += dt * 0.6;
      const wm = level.windMax || 0;
      if (wm > 0) {
        M.v3.set(wind,
          Math.sin(windPhase * 0.9) * wm + Math.sin(windPhase * 2.7) * wm * 0.35,
          Math.sin(windPhase * 1.7) * wm * 0.30,
          Math.cos(windPhase * 0.7) * wm + Math.cos(windPhase * 3.1) * wm * 0.35);
      } else M.v3.set(wind, 0, 0, 0);

      const before = heli.health;
      const opts = { wind: wm > 0 ? wind : null, fuelBurn: level.fuelBurn || 1 };
      const steps = M.clamp(Math.ceil(dt / 0.02), 1, 6);
      const sdt = dt / steps;
      let res = null;
      for (let i = 0; i < steps; i++) {
        const r = heli.update(sdt, input, opts);
        if (r && (!res || r.crashedThisFrame)) res = r;
        if (r && r.crashedThisFrame) break;
      }
      const dmg = before - heli.health;
      if (dmg > 0.3) {
        damageTaken += dmg;
        shakeT = 0.35; shakeAmt = Math.min(1.4, dmg * 0.10);
        if (dmg > 3) AUDIO.sfx.hit();
        UI.flashDamage();
      }
      if (res && res.crashedThisFrame) {
        AUDIO.sfx.crash();
        spawnExplosion(heli.pos[0], heli.pos[1], heli.pos[2], res.struck ? 1.25 : 1);
        crashReason = res.struck
          ? (res.impact > 8 ? 'DESTROYED ON IMPACT' : 'ROTOR STRIKE — AIRFRAME DESTROYED')
          : 'AIRFRAME DESTROYED';
      }

      AUDIO.updateRotor(heli.rotorRpm, input.collective, M.v3.len(heli.vel));
      WORLD.update(dt, city.extent);
      updateCollectibles(dt);
      updateExplosion(dt);
      checkMission(dt);
      UI.updateHud({
        heli, level, missionTime, collected,
        totalStars: stars.length, gateIndex, totalGates: gates.length,
        target: nextTarget(), landing, allDone: allCollected(), camName: CAM_NAMES[camMode]
      });
    } else if (heli) {
      /* keep the world alive behind menus */
      heli.update(dt, { collective: 0, pitch: 0, roll: 0, yaw: 0 }, {});
      updateCollectibles(dt * 0.4);
      updateExplosion(dt);
    }

    if (heli) heli.render(envDef ? envDef.night : 0, camMode === 0);
    updateCamera(dt);
    drawScene();
  }

  function nextTarget() {
    if (gates.length && gateIndex < gates.length) return gates[gateIndex];
    let best = null, bd = Infinity;
    for (const s of stars) {
      if (s.got) continue;
      const d = Math.hypot(heli.pos[0] - s.x, heli.pos[1] - s.y, heli.pos[2] - s.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best && landing) return landing;
    return best;
  }

  function drawScene() {
    if (!envDef) envDef = LEVELS.env('day');
    if (!batches.length) return;
    const c = heli ? heli.pos : cam.smoothPos;
    R.render({
      viewProj: cam.viewProj,
      camPos: cam.smoothPos,
      batches,
      env: {
        sunDir: new Float32Array(normalize(envDef.sunDir)),
        sunColor: new Float32Array(envDef.sunColor),
        skyTop: new Float32Array(envDef.skyTop),
        skyHorizon: new Float32Array(envDef.skyHorizon),
        ambTop: new Float32Array(envDef.ambTop),
        ambBot: new Float32Array(envDef.ambBot),
        fogColor: new Float32Array(envDef.fogColor),
        fogDensity: envDef.fogDensity,
        night: envDef.night,
        clouds: envDef.clouds,
        exposure: envDef.exposure
      },
      shadowCenter: new Float32Array([c[0], Math.max(0, c[1] * 0.35), c[2]]),
      shadowRadius: 190,
      time: elapsed
    });
  }

  function normalize(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  /* ============================================================
     PUBLIC HOOKS (used by ui.js)
     ============================================================ */
  function giveHint() {
    hintTarget = nextTarget();
    hintUntil = performance.now() + 12000;
    UI.toast('Guidance beam active for 12s');
  }
  function useRepair() {
    if (!heli || usedRepair) return false;
    if ((SAVE.data.repairKits || 0) <= 0) return false;
    SAVE.data.repairKits--; SAVE.save();
    heli.health = 100; usedRepair = true;
    UI.toast('Airframe repaired');
    return true;
  }
  function useFuelCan() {
    if (!heli || usedFuel) return false;
    if ((SAVE.data.fuelCans || 0) <= 0) return false;
    SAVE.data.fuelCans--; SAVE.save();
    heli.fuel = Math.min(heli.fuelMax, heli.fuel + heli.fuelMax * 0.4);
    usedFuel = true;
    UI.toast('Reserve fuel transferred');
    return true;
  }
  function continueAfterFail() {
    if (!heli) return;
    heli.crashed = false;
    heli.destroyed = false;
    heli.health = 100;
    crashReason = ''; crashHold = 0;
    boomParts.length = 0;
    heli.fuel = Math.max(heli.fuel, heli.fuelMax * 0.45);
    const home = city.helipads.find(p => p.home) || { x: 0, y: 0, z: 0 };
    /* respawn hovering above the nearest safe point */
    let y = Math.max(60, WORLD.supportHeight(heli.pos[0], heli.pos[2]) + 45);
    let x = heli.pos[0], z = heli.pos[2];
    if (!WORLD.isClear(x, y, z, 12)) { x = home.x; z = home.z; y = 80; }
    heli.reset(x, y, z, heli.yaw);
    heli.engineOn = true;
    heli.rotorRpm = 1;
    if (level.timeLimit) missionTime = Math.max(0, missionTime - 25);
    state = 'playing';
    AUDIO.startRotor();
    UI.hideAll();
    UI.showHud(true);
  }

  const api = {
    boot, loadLevel, restartLevel, quitToMenu, togglePause, cycleCamera,
    giveHint, useRepair, useFuelCan, continueAfterFail,
    get state() { return state; },
    set state(v) { state = v; },
    get level() { return level; },
    get heli() { return heli; },
    get city() { return city; },
    get stars() { return stars; },
    get gates() { return gates; },
    get landingZone() { return landing; },
    get camMode() { return camMode; },
    set camMode(v) { camMode = v % 3; },
    get input() { return input; },
    get stageRotated() { return stageRotated; },
    get orientationInfo() {
      return {
        build: BUILD,
        nativeApp: isNativeApp(), phone: isPhone(), rotated: stageRotated,
        override: orientationOverride, lockAttempts,
        inner: [window.innerWidth, window.innerHeight],
        screen: [screen.width, screen.height],
        dpr: window.devicePixelRatio,
        stage: [stageW, stageH], ui: +uiScale.toFixed(3),
        ua: navigator.userAgent
      };
    },
    forceLandscape() { orientationOverride = true; tryNativeLock(); onResize(); },
    setLandscape(v) { orientationOverride = (v === null ? null : !!v); onResize(); },
    debug: setDebug,
    get build() { return BUILD; },
    get uiScale() { return uiScale; },
    relayout: onResize
  };
  return api;
})();
