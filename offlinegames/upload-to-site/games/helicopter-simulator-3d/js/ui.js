/* ============================================================
   ui.js  —  All DOM: menus, HUD, minimap, level select, shop
   ============================================================ */
'use strict';

const UI = (function () {

  const $ = (id) => document.getElementById(id);
  let mmCtx = null, mmSize = 150;
  let toastTimer = null, popTimer = null;

  /* ------------------------------------------------------------------ */
  function init() {
    /* ---- start screen ---- */
    on('btnPlay', () => {
      AUDIO.resume(); AUDIO.sfx.click();
      const next = Math.min(100, SAVE.data.unlockedMax);
      hideAll(); GAME.loadLevel(next);
    });
    on('btnLevels', () => { AUDIO.sfx.click(); openLevels(); });
    on('btnShop', () => { AUDIO.sfx.click(); openShop(); });
    on('btnSettings', () => { AUDIO.sfx.click(); open('settings'); syncSettings(); });
    on('btnHowto', () => { AUDIO.sfx.click(); open('howto'); });

    /* ---- generic closers ---- */
    document.querySelectorAll('[data-close]').forEach(b => {
      b.addEventListener('click', () => {
        AUDIO.sfx.click();
        const id = b.getAttribute('data-close');
        if (id === 'shop') { closeShop(); return; }
        $(id).classList.add('hidden');
        if (GAME.state === 'menu') $('menu').classList.remove('hidden');
      });
    });

    /* ---- HUD buttons ---- */
    on('btnPause', () => { AUDIO.sfx.click(); GAME.togglePause(); });
    on('btnCam', () => GAME.cycleCamera());
    on('btnHint', () => requestHint());
    on('startEngineBtn', () => {
      const h = GAME.heli;
      if (h && !h.engineOn) { AUDIO.resume(); h.startEngine(); AUDIO.sfx.startup(); toast('Engine start — rotor spooling up'); }
    });
    on('btnRepair', () => {
      if (GAME.useRepair()) return;
      AUDIO.sfx.denied();
      toast('No repair kit in the hold — pick one up here');
      openShopFromGame('items');
    });
    on('btnFuel', () => {
      if (GAME.useFuelCan()) return;
      AUDIO.sfx.denied();
      toast('No reserve fuel in the hold — pick some up here');
      openShopFromGame('items');
    });

    /* keyboard legend (desktop) */
    on('keyHelpToggle', () => {
      const el = $('keyHelp');
      const collapsed = el.classList.toggle('collapsed');
      $('keyHelpToggle').textContent = collapsed ? 'CONTROLS ▸' : 'CONTROLS ▾';
      SAVE.data.settings.keyHelp = !collapsed;
      SAVE.save();
      AUDIO.sfx.click();
    });

    /* not-enough-coins offer */
    on('ncCancel', () => { AUDIO.sfx.click(); closeNeedCoins(false); });
    on('ncWatch', () => {
      ADS.showRewarded('coins', ok => {
        if (ok) {
          SAVE.addCoins(250); AUDIO.sfx.coin(); refreshCoins();
          toast('+250 coins');
          const again = pendingBuy;
          closeNeedCoins(true);
          if (again) setTimeout(again, 220);
        } else {
          AUDIO.sfx.denied(); toast('Ad not completed');
        }
      });
    });

    /* ---- pause menu ---- */
    on('pResume', () => { AUDIO.sfx.click(); GAME.togglePause(); });
    on('pRestart', () => { AUDIO.sfx.click(); $('pause').classList.add('hidden'); GAME.restartLevel(); });
    on('pQuit', () => { AUDIO.sfx.click(); $('pause').classList.add('hidden'); GAME.quitToMenu(); });
    on('pSettings', () => { AUDIO.sfx.click(); open('settings'); syncSettings(); });

    /* ---- complete ---- */
    on('cNext', () => {
      AUDIO.sfx.click();
      const next = Math.min(100, (GAME.level ? GAME.level.id : 1) + 1);
      $('complete').classList.add('hidden');
      ADS.notifyLevelComplete(() => GAME.loadLevel(next));
    });
    on('cReplay', () => { AUDIO.sfx.click(); $('complete').classList.add('hidden'); GAME.restartLevel(); });
    on('cMenu', () => { AUDIO.sfx.click(); $('complete').classList.add('hidden'); GAME.quitToMenu(); });
    on('cShop', () => { AUDIO.sfx.click(); $('complete').classList.add('hidden'); openShop(); });
    on('cBonus', () => {
      ADS.showRewarded('coins', (ok) => {
        if (ok) {
          const b = Math.round((GAME.level.reward || 200) * 0.75);
          SAVE.addCoins(b); AUDIO.sfx.coin();
          toast('+' + b + ' bonus coins');
          $('cBonus').disabled = true;
          $('cBonus').textContent = 'BONUS CLAIMED';
          refreshCoins();
        }
      });
    });

    /* ---- failed ---- */
    on('fRetry', () => { AUDIO.sfx.click(); $('failed').classList.add('hidden'); GAME.restartLevel(); });
    on('fMenu', () => { AUDIO.sfx.click(); $('failed').classList.add('hidden'); GAME.quitToMenu(); });
    on('fContinue', () => {
      ADS.showRewarded('continue', (ok) => {
        if (ok) { $('failed').classList.add('hidden'); GAME.continueAfterFail(); }
        else { AUDIO.sfx.denied(); toast('Ad not completed'); }
      });
    });

    /* ---- settings ---- */
    on('setMusic', null, 'change', e => { SAVE.data.settings.music = e.target.checked; SAVE.save(); AUDIO.setMusic(e.target.checked); });
    on('setSfx', null, 'change', e => { SAVE.data.settings.sfx = e.target.checked; SAVE.save(); AUDIO.setSfx(e.target.checked); });
    on('setAssist', null, 'change', e => { SAVE.data.settings.assist = e.target.checked; SAVE.save(); });
    on('setInvert', null, 'change', e => { SAVE.data.settings.invertY = e.target.checked; SAVE.save(); });
    on('setQuality', null, 'change', e => { SAVE.data.settings.quality = e.target.value; SAVE.save(); toast('Quality applies on next mission'); });
    on('setReset', () => {
      if (confirm('Erase all progress, coins and aircraft?')) { SAVE.reset(); location.reload(); }
    });

    /* ---- shop tabs ---- */
    document.querySelectorAll('.shop-tab').forEach(t => {
      t.addEventListener('click', () => {
        AUDIO.sfx.click();
        document.querySelectorAll('.shop-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelectorAll('.shop-page').forEach(p => p.classList.add('hidden'));
        $('shop_' + t.dataset.tab).classList.remove('hidden');
      });
    });

    applyKeyHelp();
    mmCtx = $('minimap').getContext('2d');
    resizeMinimap();
    refreshCoins();
    AUDIO.setMusic(SAVE.data.settings.music);
    AUDIO.setSfx(SAVE.data.settings.sfx);

    /* first interaction starts the audio context + menu music */
    const kick = () => {
      AUDIO.resume();
      AUDIO.startMusic(GAME.state === 'playing' ? 'game' : 'menu');
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
  }

  function on(id, fn, evt, handler) {
    const el = $(id);
    if (!el) return;
    if (evt) el.addEventListener(evt, handler);
    else el.addEventListener('click', fn);
  }

  /* ------------------------------------------------------------------ */
  /*  OVERLAY HELPERS                                                    */
  /* ------------------------------------------------------------------ */
  function open(id) {
    $(id).classList.remove('hidden');
    $('menu').classList.add('hidden');
  }
  function hideAll() {
    ['menu', 'levels', 'shop', 'settings', 'howto', 'pause', 'complete', 'failed']
      .forEach(id => { const e = $(id); if (e) e.classList.add('hidden'); });
  }
  function showHud(v) { $('hud').classList.toggle('hidden', !v); $('touchLayer').classList.toggle('hidden', !v); }
  function showLoader(txt) { $('loaderText').textContent = txt || 'Loading…'; $('loader').classList.remove('hidden'); }
  function hideLoader() { $('loader').classList.add('hidden'); }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function pop(msg) {
    const p = $('popText');
    p.textContent = msg;
    p.classList.remove('anim');
    void p.offsetWidth;
    p.classList.add('anim');
  }
  function bigFlash() {
    const f = $('bigFlash');
    if (!f) return;
    f.classList.remove('anim'); void f.offsetWidth; f.classList.add('anim');
  }
  function flashDamage() {
    const f = $('dmgFlash');
    f.classList.remove('anim'); void f.offsetWidth; f.classList.add('anim');
  }
  function flashScore() {
    const s = $('hCollect');
    s.classList.remove('anim'); void s.offsetWidth; s.classList.add('anim');
  }
  function setWarn(msg) {
    const w = $('warnLine');
    w.textContent = msg || '';
    w.classList.toggle('show', !!msg);
  }
  function setCamLabel(n) { $('hCam').textContent = n; }
  function applyKeyHelp() {
    const el = $('keyHelp');
    if (!el) return;
    const wantsHelp = SAVE.data.settings.keyHelp !== false;
    el.classList.toggle('collapsed', !wantsHelp);
    const tg = $('keyHelpToggle');
    if (tg) tg.textContent = wantsHelp ? 'CONTROLS ▾' : 'CONTROLS ▸';
  }

  function setBrief(level) {
    $('briefTitle').textContent = 'LEVEL ' + level.id + ' — ' + level.name;
    $('briefText').textContent = level.brief;
    const b = $('brief');
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 6500);
  }
  function refreshCoins() {
    document.querySelectorAll('.coin-val').forEach(e => e.textContent = SAVE.data.coins.toLocaleString());
    document.querySelectorAll('.hint-val').forEach(e => e.textContent = SAVE.data.hints);
  }

  /* ------------------------------------------------------------------ */
  /*  NOT ENOUGH COINS  ->  offer a rewarded video                        */
  /* ------------------------------------------------------------------ */
  let pendingBuy = null;

  function needCoins(price, retry) {
    const short = Math.max(0, price - SAVE.data.coins);
    pendingBuy = retry || null;
    $('ncText').textContent = 'That costs ' + price.toLocaleString() +
      ' coins and you are ' + short.toLocaleString() + ' short. ' +
      'Watch a short video to earn 250 coins — you can watch as many times as you like.';
    $('needCoins').classList.remove('hidden');
    AUDIO.sfx.denied();
  }

  function closeNeedCoins() {
    $('needCoins').classList.add('hidden');
    pendingBuy = null;
  }

  /* ------------------------------------------------------------------ */
  /*  HINTS (rewarded ad)                                                */
  /* ------------------------------------------------------------------ */
  function requestHint() {
    if (GAME.state !== 'playing') return;
    if (SAVE.data.hints > 0) {
      SAVE.data.hints--; SAVE.save(); refreshCoins();
      AUDIO.sfx.coin();
      GAME.giveHint();
      return;
    }
    ADS.showRewarded('hint', (ok) => {
      if (ok) {
        SAVE.data.hints += 1; SAVE.save(); refreshCoins();
        SAVE.data.hints--; SAVE.save(); refreshCoins();
        GAME.giveHint();
      } else {
        AUDIO.sfx.denied();
        toast('No hints left — watch an ad or buy a pack in the shop');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  HUD                                                                */
  /* ------------------------------------------------------------------ */
  function fmtTime(s) {
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  let hudAcc = 0;
  let lowFuelNudged = false;
  function resetHudNudges() { lowFuelNudged = false; }

  function updateHud(d) {
    const h = d.heli;
    hudAcc += 1;

    $('hAlt').textContent = Math.max(0, Math.round(h.agl || 0));
    $('hAltMsl').textContent = Math.round(h.pos[1]);
    const spdKmh = Math.round(Math.hypot(h.vel[0], h.vel[2]) * 3.6);
    $('hSpd').textContent = spdKmh;
    const vs = h.vel[1];
    $('hVs').textContent = (vs >= 0 ? '+' : '') + vs.toFixed(1);
    $('hVs').className = 'v ' + (vs < -5 ? 'bad' : vs > 0.5 ? 'good' : '');

    const fp = Math.max(0, h.fuel / h.fuelMax);
    $('fuelBar').style.width = (fp * 100) + '%';
    $('fuelBar').className = 'bar-fill ' + (fp < 0.15 ? 'crit' : fp < 0.33 ? 'warn' : 'fuel');
    $('fuelPct').textContent = Math.round(fp * 100) + '%';

    const hp = Math.max(0, h.health / 100);
    $('hpBar').style.width = (hp * 100) + '%';
    $('hpBar').className = 'bar-fill ' + (hp < 0.25 ? 'crit' : hp < 0.5 ? 'warn' : 'hp');
    $('hpPct').textContent = Math.round(hp * 100) + '%';

    $('collBar').style.height = (d.heli.collective * 100) + '%';

    $('hCollect').textContent = d.collected + '/' + d.totalStars;
    $('hGates').parentElement.style.display = d.totalGates ? '' : 'none';
    $('hGates').textContent = d.gateIndex + '/' + d.totalGates;
    $('hRpm').textContent = Math.round(h.rotorRpm * 100) + '%';

    if (d.level.timeLimit) {
      const left = Math.max(0, d.level.timeLimit - d.missionTime);
      $('hTime').textContent = fmtTime(left);
      $('hTime').className = left < 20 ? 'v crit' : left < 45 ? 'v warn' : 'v';
    } else {
      $('hTime').textContent = fmtTime(d.missionTime);
      $('hTime').className = 'v';
    }

    /* warnings */
    let warn = '';
    if (!h.engineOn) warn = 'PRESS  E  (or START ENGINE) TO SPOOL UP THE ROTOR';
    else if (h.fuel / h.fuelMax < 0.12) {
      warn = '⛽ LOW FUEL — TAP 🛢️ FUEL FOR A RESERVE CAN';
      if (!lowFuelNudged) {
        lowFuelNudged = true;
        toast('Low fuel — use the 🛢️ FUEL button. No can? It opens the shop.');
      }
    }
    else if (h.health < 30) warn = '⚠ AIRFRAME CRITICAL';
    else if (vs < -12) warn = '⬇ HIGH DESCENT RATE';
    else if (d.allDone && d.landing) warn = '🛬 ALL MARKERS COLLECTED — LAND ON THE PAD';
    else if (d.allDone) warn = '✅ MISSION COMPLETE';
    setWarn(warn);

    $('startEngineBtn').classList.toggle('hidden', h.engineOn);

    /* compass arrow to the next objective */
    const tgt = d.target;
    if (tgt) {
      const dx = tgt.x - h.pos[0], dz = tgt.z - h.pos[2];
      const dist = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, -dz) - h.yaw;
      $('navArrow').style.transform = 'rotate(' + (ang * 180 / Math.PI) + 'deg)';
      $('navDist').textContent = dist > 999 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m';
      const dy = tgt.y - h.pos[1];
      $('navAlt').textContent = (dy > 3 ? '▲ ' : dy < -3 ? '▼ ' : '● ') + Math.abs(Math.round(dy)) + 'm';
    } else {
      $('navDist').textContent = '--';
      $('navAlt').textContent = '';
    }

    $('hCam').textContent = d.camName;

    /* horizon / attitude indicator */
    const ai = $('aiInner');
    ai.style.transform = 'rotate(' + (-h.roll * 180 / Math.PI) + 'deg) translateY(' + (h.pitch * 90) + 'px)';

    if (hudAcc % 3 === 0) drawMinimap(d);
  }

  /* ------------------------------------------------------------------ */
  /*  MINIMAP                                                            */
  /* ------------------------------------------------------------------ */
  function resizeMinimap() {
    const c = $('minimap');
    if (!c) return;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    mmSize = c.clientWidth || parseInt(getComputedStyle(c).width) || 150;
    if (!mmSize || mmSize < 20) mmSize = 150;
    c.width = mmSize * d; c.height = mmSize * d;
    mmCtx = c.getContext('2d');
    mmCtx.setTransform(d, 0, 0, d, 0, 0);
  }

  function drawMinimap(d) {
    if (!mmCtx) return;
    if (mmSize < 20) { resizeMinimap(); if (mmSize < 20) return; }
    const S = mmSize, C = S / 2;
    const range = 420;                     // metres shown
    const k = C / range;
    const h = d.heli;
    const g = mmCtx;

    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(C, C, C - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(8,14,20,0.72)'; g.fillRect(0, 0, S, S);

    /* road grid, rotated with heading */
    const cs = Math.cos(-h.yaw), sn = Math.sin(-h.yaw);
    const { PITCH } = WORLD.constants();
    const proj = (wx, wz) => {
      const dx = (wx - h.pos[0]) * k, dz = (wz - h.pos[2]) * k;
      return [C + (dx * cs - dz * sn), C + (dx * sn + dz * cs)];
    };
    g.strokeStyle = 'rgba(120,150,175,0.30)'; g.lineWidth = 1;
    const n = Math.ceil(range / PITCH) + 1;
    const bi = Math.round(h.pos[0] / PITCH), bj = Math.round(h.pos[2] / PITCH);
    for (let i = -n; i <= n; i++) {
      const x = (bi + i - 0.5) * PITCH;
      const a = proj(x, h.pos[2] - range * 1.5), b = proj(x, h.pos[2] + range * 1.5);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      const z = (bj + i - 0.5) * PITCH;
      const c1 = proj(h.pos[0] - range * 1.5, z), c2 = proj(h.pos[0] + range * 1.5, z);
      g.beginPath(); g.moveTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.stroke();
    }

    /* stars */
    for (const s of GAME.stars) {
      if (s.got) continue;
      const p = proj(s.x, s.z);
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(p[0], p[1], 3.2, 0, Math.PI * 2); g.fill();
    }
    /* gates */
    const gs = GAME.gates;
    for (let i = 0; i < gs.length; i++) {
      const p = proj(gs[i].x, gs[i].z);
      g.strokeStyle = gs[i].passed ? 'rgba(70,210,110,0.85)' : (i === d.gateIndex ? '#3fb8ff' : 'rgba(160,170,180,0.6)');
      g.lineWidth = 2;
      g.beginPath(); g.arc(p[0], p[1], 4, 0, Math.PI * 2); g.stroke();
    }
    /* landing pad */
    if (d.landing) {
      const p = proj(d.landing.x, d.landing.z);
      g.strokeStyle = d.allDone ? '#3ef07a' : 'rgba(180,190,200,0.55)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(p[0], p[1], 6.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = g.strokeStyle;
      g.font = 'bold 9px system-ui'; g.textAlign = 'center';
      g.fillText('H', p[0], p[1] + 3);
    }

    g.restore();

    /* player triangle */
    g.fillStyle = '#eaf4ff';
    g.beginPath();
    g.moveTo(C, C - 7); g.lineTo(C - 5, C + 6); g.lineTo(C + 5, C + 6);
    g.closePath(); g.fill();

    g.strokeStyle = 'rgba(180,210,235,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.arc(C, C, C - 1, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(200,225,245,0.8)';
    g.font = 'bold 9px system-ui'; g.textAlign = 'center';
    g.fillText('N', C + Math.sin(-h.yaw) * (C - 10), C - Math.cos(-h.yaw) * (C - 10) + 3);
  }

  /* ------------------------------------------------------------------ */
  /*  RESULT SCREENS                                                     */
  /* ------------------------------------------------------------------ */
  function showComplete(r) {
    const s = $('complete');
    $('cTitle').textContent = 'MISSION COMPLETE';
    $('cLevel').textContent = 'Level ' + GAME.level.id + ' — ' + GAME.level.name;
    let starsHtml = '';
    for (let i = 1; i <= 3; i++) starsHtml += '<span class="rstar ' + (i <= r.rating ? 'on' : '') + '">★</span>';
    $('cStars').innerHTML = starsHtml;
    $('cRows').innerHTML =
      row('Mission reward', '+' + r.base) +
      (r.timeBonus ? row('Time bonus', '+' + r.timeBonus) : '') +
      (r.cleanBonus ? row('No-damage bonus', '+' + r.cleanBonus) : '') +
      row('Flight time', fmtTime(r.time)) +
      row('Damage taken', Math.round(r.damage) + '%') +
      '<div class="res-row total"><span>Total earned</span><b>+' + r.coins + ' 🪙</b></div>';
    const bonus = $('cBonus');
    bonus.disabled = false;
    bonus.textContent = '▶ WATCH AD  ·  +' + Math.round((GAME.level.reward || 200) * 0.75) + ' COINS';
    refreshCoins();
    s.classList.remove('hidden');
    $('touchLayer').classList.add('hidden');
  }

  function row(a, b) { return '<div class="res-row"><span>' + a + '</span><b>' + b + '</b></div>'; }

  function showFailed(reason) {
    $('fReason').textContent = reason;
    $('fLevel').textContent = 'Level ' + GAME.level.id + ' — ' + GAME.level.name;
    $('failed').classList.remove('hidden');
    $('touchLayer').classList.add('hidden');
  }

  /* ------------------------------------------------------------------ */
  /*  LEVEL SELECT                                                       */
  /* ------------------------------------------------------------------ */
  function openLevels() {
    const grid = $('levelGrid');
    grid.innerHTML = '';
    for (let i = 1; i <= LEVELS.count; i++) {
      const L = LEVELS.get(i);
      const p = SAVE.data.progress[i];
      const unlocked = SAVE.isUnlocked(i);
      const el = document.createElement('button');
      el.className = 'lvl' + (unlocked ? '' : ' locked') + (L.boss ? ' boss' : '');
      el.innerHTML =
        '<span class="ln">' + i + '</span>' +
        '<span class="lname">' + L.name + '</span>' +
        '<span class="lst">' + (unlocked
          ? [1, 2, 3].map(k => '<i class="' + (p && p.stars >= k ? 'on' : '') + '">★</i>').join('')
          : '🔒') + '</span>' +
        '<span class="lenv">' + LEVELS.env(L.env).name + '</span>';
      if (unlocked) {
        el.addEventListener('click', () => {
          AUDIO.sfx.click(); hideAll(); GAME.loadLevel(i);
        });
      }
      grid.appendChild(el);
    }
    $('lvlProgress').textContent = SAVE.data.totalStars + ' / ' + (LEVELS.count * 3) + ' stars';
    open('levels');
  }

  /* ------------------------------------------------------------------ */
  /*  SHOP                                                               */
  /* ------------------------------------------------------------------ */
  let shopFromGame = false;

  function selectShopTab(tab) {
    document.querySelectorAll('.shop-tab').forEach(x =>
      x.classList.toggle('active', x.dataset.tab === tab));
    document.querySelectorAll('.shop-page').forEach(p => p.classList.add('hidden'));
    const page = $('shop_' + tab);
    if (page) page.classList.remove('hidden');
  }

  function openShop(tab) {
    renderHangar();
    renderUpgrades();
    renderItems();
    refreshCoins();
    if (tab) selectShopTab(tab);
    open('shop');
  }

  /* opened mid-mission: freeze the flight, come back to it on close */
  function openShopFromGame(tab) {
    if (GAME.state === 'playing') {
      GAME.togglePause();
      $('pause').classList.add('hidden');
    }
    shopFromGame = true;
    openShop(tab || 'items');
  }

  function closeShop() {
    $('shop').classList.add('hidden');
    if (shopFromGame) {
      shopFromGame = false;
      if (GAME.state === 'paused') GAME.togglePause();
      showHud(true);
      $('touchLayer').classList.remove('hidden');
    } else if (GAME.state === 'menu') {
      $('menu').classList.remove('hidden');
    }
  }

  function renderHangar() {
    const wrap = $('shop_hangar');
    wrap.innerHTML = '';
    for (const key of Object.keys(HELI.VARIANTS)) {
      const v = HELI.VARIANTS[key];
      const owned = !!SAVE.data.owned[key];
      const active = SAVE.data.heli === key;
      const card = document.createElement('div');
      card.className = 'card heli-card' + (active ? ' active' : '');
      const swatch = 'rgb(' + v.color.map(c => Math.round(c * 255)).join(',') + ')';
      card.innerHTML =
        '<div class="heli-top"><div class="swatch" style="background:' + swatch + '"></div>' +
        '<div><h4>' + v.name + '</h4><p class="muted">' + v.desc + '</p></div></div>' +
        '<div class="stats">' +
        stat('Power', v.thrust / 24) + stat('Agility', v.agility / 1.4) +
        stat('Speed', v.maxSpeed / 80) + stat('Fuel', v.fuel / 240) + stat('Armour', v.armour / 3) +
        '</div>';
      const btn = document.createElement('button');
      btn.className = 'btn ' + (owned ? (active ? 'ghost' : 'primary') : 'buy');
      btn.textContent = owned ? (active ? 'IN USE' : 'SELECT') : ('BUY  ·  ' + v.price.toLocaleString() + ' 🪙');
      btn.disabled = active;
      const doBuy = () => {
        if (owned) { SHOP.selectHeli(key); AUDIO.sfx.click(); }
        else {
          const r = SHOP.buyHeli(key);
          if (r.ok) { AUDIO.sfx.purchase(); toast(r.msg); }
          else if (/coins/i.test(r.msg)) { needCoins(v.price, () => { renderHangar(); doBuy(); }); }
          else { AUDIO.sfx.denied(); toast(r.msg); }
        }
        renderHangar(); refreshCoins();
      };
      btn.addEventListener('click', doBuy);
      card.appendChild(btn);
      wrap.appendChild(card);
    }
  }

  function stat(name, v) {
    v = Math.max(0.05, Math.min(1, v));
    return '<div class="stat"><span>' + name + '</span><i><b style="width:' + (v * 100) + '%"></b></i></div>';
  }

  function renderUpgrades() {
    const wrap = $('shop_upgrades');
    wrap.innerHTML = '';
    for (const u of SHOP.UPGRADES) {
      const lv = SAVE.data.upgrades[u.key] || 0;
      const maxed = lv >= u.max;
      const price = SHOP.upgradePrice(u);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="up-top"><span class="up-ico">' + u.icon + '</span>' +
        '<div><h4>' + u.name + '</h4><p class="muted">' + u.desc + '</p></div></div>' +
        '<div class="pips">' + Array.from({ length: u.max },
          (_, i) => '<i class="' + (i < lv ? 'on' : '') + '"></i>').join('') + '</div>';
      const btn = document.createElement('button');
      btn.className = 'btn ' + (maxed ? 'ghost' : 'buy');
      btn.textContent = maxed ? 'MAX LEVEL' : ('UPGRADE  ·  ' + price.toLocaleString() + ' 🪙');
      btn.disabled = maxed;
      const doBuy = () => {
        const r = SHOP.buyUpgrade(u.key);
        if (r.ok) { AUDIO.sfx.purchase(); toast(r.msg); }
        else if (/coins/i.test(r.msg)) { needCoins(price, doBuy); }
        else { AUDIO.sfx.denied(); toast(r.msg); }
        renderUpgrades(); refreshCoins();
      };
      btn.addEventListener('click', doBuy);
      card.appendChild(btn);
      wrap.appendChild(card);
    }
  }

  function renderItems() {
    const wrap = $('shop_items');
    wrap.innerHTML = '';
    for (const c of SHOP.CONSUMABLES) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<div class="up-top"><span class="up-ico">' + c.icon + '</span>' +
        '<div><h4>' + c.name + '</h4><p class="muted">' + c.desc + '</p></div></div>';
      const btn = document.createElement('button');
      btn.className = 'btn buy';
      btn.textContent = 'BUY  ·  ' + c.price + ' 🪙';
      const doBuy = () => {
        const r = SHOP.buyConsumable(c.key);
        if (r.ok) { AUDIO.sfx.purchase(); toast(r.msg); }
        else if (/coins/i.test(r.msg)) { needCoins(c.price, doBuy); }
        else { AUDIO.sfx.denied(); toast(r.msg); }
        refreshCoins(); renderItems();
      };
      btn.addEventListener('click', doBuy);
      card.appendChild(btn);
      wrap.appendChild(card);
    }
    /* free coins via rewarded ad */
    const free = document.createElement('div');
    free.className = 'card free-card';
    free.innerHTML = '<div class="up-top"><span class="up-ico">🎬</span><div><h4>Free Coins</h4>' +
      '<p class="muted">Watch a short video for 250 coins. Available any time.</p></div></div>';
    const fb = document.createElement('button');
    fb.className = 'btn primary';
    fb.textContent = '▶ WATCH AD  ·  +250 🪙';
    fb.addEventListener('click', () => {
      ADS.showRewarded('coins', ok => {
        if (ok) { SAVE.addCoins(250); AUDIO.sfx.coin(); toast('+250 coins'); refreshCoins(); }
      });
    });
    free.appendChild(fb);
    wrap.appendChild(free);
  }

  /* ------------------------------------------------------------------ */
  function syncSettings() {
    const s = SAVE.data.settings;
    $('setMusic').checked = s.music;
    $('setSfx').checked = s.sfx;
    $('setAssist').checked = s.assist;
    $('setInvert').checked = s.invertY;
    $('setQuality').value = s.quality;
  }

  return {
    init, toast, pop, hideAll, showHud, showLoader, hideLoader,
    updateHud, showComplete, showFailed, setWarn, setCamLabel, setBrief,
    flashDamage, flashScore, bigFlash, refreshCoins, requestHint, resizeMinimap,
    openShop, openShopFromGame, closeShop, openLevels, needCoins,
    applyKeyHelp, resetHudNudges
  };
})();
