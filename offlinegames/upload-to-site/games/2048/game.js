/* Vault 2048 — standalone. Ads: AdSense web + AdMob native. */
(function () {
  "use strict";

  var SIZE = 4;
  var WIN_VALUE = 2048;
  var SAVE_KEY = "vault-2048-save";
  var AD_CLIENT = "ca-pub-4203857211510947";
  var AD_SLOT_BANNER = "7417753724";
  var ADMOB_BANNER = "ca-app-pub-4203857211510947/8086182570";
  var ADMOB_INTERSTITIAL = "ca-app-pub-4203857211510947/3025427580";

  var DIRS = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    KeyA: "left",
    KeyD: "right",
    KeyW: "up",
    KeyS: "down",
  };

  var ICONS = {
    play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    volume: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    mute: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    help: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    restart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  };

  function cellKey(row, col) {
    return row * SIZE + col;
  }

  function emptyCells(tiles) {
    var occ = {};
    tiles.forEach(function (t) {
      occ[cellKey(t.row, t.col)] = true;
    });
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (!occ[cellKey(r, c)]) cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  function spawn(state, rand) {
    rand = rand || Math.random;
    var cells = emptyCells(state.tiles);
    if (!cells.length) return state;
    var spot = cells[Math.floor(rand() * cells.length)];
    var value = rand() < 0.9 ? 2 : 4;
    return Object.assign({}, state, {
      nextId: state.nextId + 1,
      tiles: state.tiles.concat([
        { id: state.nextId, value: value, row: spot.row, col: spot.col },
      ]),
    });
  }

  function isOver(tiles) {
    if (emptyCells(tiles).length > 0) return false;
    var at = {};
    tiles.forEach(function (t) {
      at[cellKey(t.row, t.col)] = t.value;
    });
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      if (t.col + 1 < SIZE && at[cellKey(t.row, t.col + 1)] === t.value) return false;
      if (t.row + 1 < SIZE && at[cellKey(t.row + 1, t.col)] === t.value) return false;
    }
    return true;
  }

  function maxTile(tiles) {
    var max = 0;
    tiles.forEach(function (t) {
      if (t.value > max) max = t.value;
    });
    return max;
  }

  function toGrid(tiles) {
    var grid = [];
    for (var r = 0; r < SIZE; r++) {
      grid[r] = [null, null, null, null];
    }
    tiles.forEach(function (t) {
      grid[t.row][t.col] = t;
    });
    return grid;
  }

  function readLine(grid, dir, index) {
    var line = [];
    for (var i = 0; i < SIZE; i++) {
      if (dir === "left") line.push(grid[index][i]);
      else if (dir === "right") line.push(grid[index][SIZE - 1 - i]);
      else if (dir === "up") line.push(grid[i][index]);
      else line.push(grid[SIZE - 1 - i][index]);
    }
    return line;
  }

  function writeLine(grid, dir, index, line) {
    var moved = false;
    for (var i = 0; i < SIZE; i++) {
      var src = line[i] || null;
      var row, col;
      if (dir === "left") {
        row = index;
        col = i;
      } else if (dir === "right") {
        row = index;
        col = SIZE - 1 - i;
      } else if (dir === "up") {
        row = i;
        col = index;
      } else {
        row = SIZE - 1 - i;
        col = index;
      }
      if (src) {
        if (src.row !== row || src.col !== col) moved = true;
        grid[row][col] = { id: src.id, value: src.value, row: row, col: col };
      } else {
        grid[row][col] = null;
      }
    }
    return moved;
  }

  function compress(line) {
    var packed = line.filter(Boolean);
    var out = [];
    var score = 0;
    var mergedValues = [];
    var mergedIds = [];
    var i = 0;
    while (i < packed.length) {
      var a = packed[i];
      var b = packed[i + 1];
      if (b && a.value === b.value) {
        var value = a.value * 2;
        out.push({ id: a.id, value: value, row: a.row, col: a.col });
        score += value;
        mergedValues.push(value);
        mergedIds.push(a.id);
        i += 2;
      } else {
        out.push(a);
        i += 1;
      }
    }
    while (out.length < SIZE) out.push(null);
    return { line: out, score: score, mergedValues: mergedValues, mergedIds: mergedIds, merged: mergedIds.length > 0 };
  }

  function move(state, dir, rand) {
    rand = rand || Math.random;
    if (state.over) {
      return { state: state, moved: false, mergedValues: [], mergedIds: [], spawnedId: null };
    }
    var grid = toGrid(state.tiles);
    var moved = false;
    var scoreGain = 0;
    var mergedValues = [];
    var mergedIds = [];
    for (var index = 0; index < SIZE; index++) {
      var packed = compress(readLine(grid, dir, index));
      var lineMoved = writeLine(grid, dir, index, packed.line);
      if (lineMoved || packed.merged) moved = true;
      scoreGain += packed.score;
      mergedValues = mergedValues.concat(packed.mergedValues);
      mergedIds = mergedIds.concat(packed.mergedIds);
    }
    if (!moved) {
      return { state: state, moved: false, mergedValues: [], mergedIds: [], spawnedId: null };
    }
    var tiles = [];
    for (var row = 0; row < SIZE; row++) {
      for (var col = 0; col < SIZE; col++) {
        if (grid[row][col]) tiles.push(grid[row][col]);
      }
    }
    var next = Object.assign({}, state, { tiles: tiles, score: state.score + scoreGain });
    if (!next.won && tiles.some(function (t) { return t.value >= WIN_VALUE; })) {
      next = Object.assign({}, next, { won: true });
    }
    var beforeSpawn = next.nextId;
    next = spawn(next, rand);
    var spawnedId = next.nextId !== beforeSpawn ? beforeSpawn : null;
    next = Object.assign({}, next, { over: isOver(next.tiles) });
    return { state: next, moved: true, mergedValues: mergedValues, mergedIds: mergedIds, spawnedId: spawnedId };
  }

  function createGame() {
    var s = { tiles: [], score: 0, won: false, continued: false, over: false, nextId: 1 };
    s = spawn(s);
    s = spawn(s);
    s.over = isOver(s.tiles);
    return s;
  }

  function cloneState(state) {
    return Object.assign({}, state, {
      tiles: state.tiles.map(function (t) {
        return { id: t.id, value: t.value, row: t.row, col: t.col };
      }),
    });
  }

  /* ---- audio ---- */
  var bus = null;
  var muted = false;
  var desiredMute = false;

  function makeBus() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = new Ctx({ latencyHint: "interactive" });
    var master = ctx.createGain();
    var sfx = ctx.createGain();
    master.gain.value = desiredMute ? 0 : 0.7;
    sfx.gain.value = 0.85;
    sfx.connect(master);
    master.connect(ctx.destination);
    return { ctx: ctx, master: master, sfx: sfx };
  }

  function unlockAudio() {
    if (!bus) bus = makeBus();
    if (bus.ctx.state === "suspended") bus.ctx.resume();
    muted = desiredMute;
    bus.master.gain.setTargetAtTime(desiredMute ? 0 : 0.7, bus.ctx.currentTime, 0.02);
    document.addEventListener("visibilitychange", function () {
      if (bus && document.visibilityState === "visible" && bus.ctx.state === "suspended") {
        bus.ctx.resume();
      }
    });
  }

  function setMuted(next) {
    desiredMute = next;
    muted = next;
    if (bus) bus.master.gain.setTargetAtTime(next ? 0 : 0.7, bus.ctx.currentTime, 0.04);
  }

  function envGain(peak, attack, release) {
    var g = bus.ctx.createGain();
    var t = bus.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    g.connect(bus.sfx);
    return { g: g, t: t };
  }

  function tone(freq, duration, type, peak, detune) {
    if (!bus || muted) return;
    var eg = envGain(peak, 0.008, duration);
    var osc = bus.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, eg.t);
    if (detune) osc.detune.setValueAtTime(detune, eg.t);
    osc.connect(eg.g);
    osc.start(eg.t);
    osc.stop(eg.t + duration + 0.05);
    osc.onended = function () {
      osc.disconnect();
      eg.g.disconnect();
    };
  }

  function noiseBurst(duration, peak, hpFreq) {
    if (!bus || muted) return;
    var frames = Math.max(1, Math.floor(bus.ctx.sampleRate * duration));
    var buffer = bus.ctx.createBuffer(1, frames, bus.ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    var src = bus.ctx.createBufferSource();
    src.buffer = buffer;
    var filter = bus.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hpFreq;
    var eg = envGain(peak, 0.004, duration);
    src.connect(filter);
    filter.connect(eg.g);
    src.start(eg.t);
    src.stop(eg.t + duration + 0.02);
    src.onended = function () {
      src.disconnect();
      filter.disconnect();
      eg.g.disconnect();
    };
  }

  function playMove() {
    noiseBurst(0.035, 0.07, 1800);
    tone(640 + Math.random() * 40, 0.04, "triangle", 0.035);
  }
  function playMerge(value) {
    var n = Math.log2(Math.max(2, value));
    var freq = 196 * Math.pow(1.05946, n * 2);
    var peak = Math.min(0.22, 0.08 + n * 0.012);
    tone(freq, 0.12, "triangle", peak, (Math.random() * 2 - 1) * 12);
    tone(freq * 1.5, 0.16, "sine", peak * 0.55);
    if (value >= 128) tone(freq * 0.5, 0.22, "sine", peak * 0.35);
  }
  function playWin() {
    if (!bus || muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
      setTimeout(function () {
        tone(f, 0.28, "triangle", 0.14);
        tone(f * 2, 0.22, "sine", 0.05);
      }, i * 110);
    });
  }
  function playLose() {
    tone(330, 0.22, "triangle", 0.1);
    setTimeout(function () { tone(247, 0.28, "sine", 0.09); }, 120);
    setTimeout(function () { tone(196, 0.4, "sine", 0.08); }, 260);
  }
  function playClick() {
    tone(880, 0.045, "square", 0.028);
    noiseBurst(0.02, 0.04, 2400);
  }
  function playUndo() {
    tone(392, 0.08, "sine", 0.05);
    tone(330, 0.1, "triangle", 0.04);
  }
  function haptic(kind) {
    if (!navigator.vibrate) return;
    try {
      if (kind === "move") navigator.vibrate(8);
      else if (kind === "merge") navigator.vibrate(16);
      else if (kind === "win") navigator.vibrate([20, 40, 20, 40, 40]);
      else navigator.vibrate([40, 40, 80]);
    } catch (e) {}
  }

  /* ---- save ---- */
  function defaultsSave() {
    return { version: 1, best: 0, muted: false, gamesPlayed: 0, seenHowTo: false, board: null };
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultsSave();
      return Object.assign(defaultsSave(), JSON.parse(raw));
    } catch (e) {
      return defaultsSave();
    }
  }
  function writeSave(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(Object.assign({}, data, { version: 1 })));
    } catch (e) {}
  }
  function snapshotBoard(state) {
    return {
      tiles: state.tiles.map(function (t) { return { id: t.id, value: t.value, row: t.row, col: t.col }; }),
      score: state.score,
      won: state.won,
      continued: state.continued,
      nextId: state.nextId,
      over: state.over,
    };
  }

  /* ---- ads ---- */
  function isNativeApp() {
    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return true;
    } catch (e) {}
    return !!(window.cordova || window.admob || window.AdMob);
  }

  function pushAd() {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  }

  async function showNativeInterstitial() {
    if (!isNativeApp()) return false;
    try {
      var plugin = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) || window.AdMob || window.admob;
      if (!plugin) return false;
      if (plugin.prepareInterstitial && plugin.showInterstitial) {
        await plugin.prepareInterstitial({ adId: ADMOB_INTERSTITIAL });
        await plugin.showInterstitial();
        return true;
      }
      if (plugin.interstitial) {
        if (plugin.interstitial.load) await plugin.interstitial.load({ id: ADMOB_INTERSTITIAL });
        else if (plugin.interstitial.prepare) await plugin.interstitial.prepare({ id: ADMOB_INTERSTITIAL });
        if (plugin.interstitial.show) {
          await plugin.interstitial.show();
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  async function showNativeBanner() {
    if (!isNativeApp()) return false;
    try {
      var plugin = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) || window.AdMob || window.admob;
      if (!plugin) return false;
      if (plugin.showBanner) {
        await plugin.showBanner({ adId: ADMOB_BANNER, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER" });
        return true;
      }
      if (plugin.banner && plugin.banner.show) {
        await plugin.banner.show({ id: ADMOB_BANNER, position: "bottom" });
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ---- UI ---- */
  function tileTone(value) {
    if (value >= 4096) return "tile-super";
    if (value >= 2048) return "tile-2048";
    if (value >= 1024) return "tile-1024";
    if (value >= 512) return "tile-512";
    if (value >= 256) return "tile-256";
    if (value >= 128) return "tile-128";
    if (value >= 64) return "tile-64";
    if (value >= 32) return "tile-32";
    if (value >= 16) return "tile-16";
    if (value >= 8) return "tile-8";
    if (value >= 4) return "tile-4";
    return "tile-2";
  }

  var app = document.getElementById("app");
  var G = {
    screen: "start",
    state: createGame(),
    best: 0,
    muted: false,
    mergedIds: [],
    spawnedId: null,
    delta: 0,
    help: false,
    interstitial: false,
    afterAd: null,
    gamesPlayed: 0,
    hasResume: false,
    canRevive: false,
    lastAlive: null,
    save: loadSave(),
  };

  (function hydrate() {
    var save = loadSave();
    G.save = save;
    G.best = save.best || 0;
    G.muted = !!save.muted;
    G.gamesPlayed = save.gamesPlayed || 0;
    setMuted(G.muted);
    if (save.board && save.board.tiles && save.board.tiles.length && !save.board.over) {
      G.state = {
        tiles: save.board.tiles.map(function (t) { return { id: t.id, value: t.value, row: t.row, col: t.col }; }),
        score: save.board.score,
        won: save.board.won,
        continued: save.board.continued,
        over: save.board.over,
        nextId: save.board.nextId,
      };
      G.hasResume = true;
    }
    showNativeBanner();
  })();

  function persist() {
    G.save.best = Math.max(G.best, G.state.score);
    G.save.muted = G.muted;
    G.save.gamesPlayed = G.gamesPlayed;
    if (G.screen === "play") G.save.board = snapshotBoard(G.state);
    writeSave(G.save);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") persist();
  });
  window.addEventListener("pagehide", persist);

  function applyMove(dir) {
    if (G.screen !== "play") return;
    if (G.state.over) return;
    if (G.state.won && !G.state.continued) return;
    if (G.interstitial || G.help) return;
    var prev = cloneState(G.state);
    var result = move(G.state, dir);
    if (!result.moved) return;
    G.lastAlive = prev;
    G.state = result.state;
    G.mergedIds = result.mergedIds;
    G.spawnedId = result.spawnedId;
    G.delta = result.state.score - prev.score;
    if (G.state.score > G.best) G.best = G.state.score;
    if (G.state.over) G.canRevive = true;
    playMove();
    haptic("move");
    if (result.mergedValues.length) {
      var top = Math.max.apply(null, result.mergedValues);
      playMerge(top);
      haptic("merge");
    }
    if (G.state.won && !prev.won) {
      playWin();
      haptic("win");
    } else if (G.state.over) {
      playLose();
      haptic("lose");
    }
    persist();
    render();
  }

  function startFresh() {
    G.lastAlive = null;
    G.canRevive = false;
    G.state = createGame();
    G.mergedIds = [];
    G.spawnedId = null;
    G.delta = 0;
    G.screen = "play";
    G.hasResume = false;
    G.gamesPlayed += 1;
    G.save.gamesPlayed = G.gamesPlayed;
    G.save.board = snapshotBoard(G.state);
    persist();
    render();
  }

  function maybeAdThenNew() {
    playClick();
    if (G.gamesPlayed > 0 && G.gamesPlayed % 2 === 0) {
      G.afterAd = "new";
      openInterstitial(false, "Continue");
      return;
    }
    startFresh();
  }

  function revive() {
    if (!G.lastAlive) return;
    var prev = G.lastAlive;
    G.lastAlive = null;
    G.canRevive = false;
    playUndo();
    G.state = Object.assign({}, prev, { over: false });
    G.mergedIds = [];
    G.spawnedId = null;
    G.delta = 0;
    persist();
    render();
  }

  function watchAdToUndo() {
    if (!G.lastAlive) return;
    playClick();
    G.afterAd = "undo";
    openInterstitial(true, "Undo last move");
  }

  function begin(resume) {
    unlockAudio();
    playClick();
    G.save.seenHowTo = true;
    persist();
    if (resume && G.hasResume) {
      G.screen = "play";
      render();
      return;
    }
    startFresh();
  }

  function toggleMute() {
    unlockAudio();
    G.muted = !G.muted;
    setMuted(G.muted);
    if (!G.muted) playClick();
    persist();
    render();
  }

  var interstitialTimer = null;
  function openInterstitial(rewarded, doneLabel) {
    G.interstitial = true;
    render();
    showNativeInterstitial().then(function (ok) {
      if (ok) {
        finishAd();
        return;
      }
      setTimeout(pushAd, 60);
    });
    var seconds = 5;
    var btn = function () { return document.querySelector(".interstitial .btn-primary"); };
    interstitialTimer = setInterval(function () {
      seconds -= 1;
      var b = btn();
      if (!b) return;
      if (seconds <= 0) {
        clearInterval(interstitialTimer);
        b.disabled = false;
        b.textContent = doneLabel;
      } else {
        b.textContent = "Wait " + seconds;
      }
    }, 1000);
    setTimeout(function () {
      var b = btn();
      if (b && rewarded) return;
      if (b) {
        b.disabled = false;
        b.textContent = doneLabel;
      }
    }, rewarded ? 5200 : 1600);
  }

  function finishAd() {
    if (interstitialTimer) clearInterval(interstitialTimer);
    G.interstitial = false;
    var action = G.afterAd;
    G.afterAd = null;
    if (action === "new") startFresh();
    else if (action === "undo") revive();
    else render();
  }

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function iconBtn(label, svg, handler) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = svg;
    b.addEventListener("click", handler);
    return b;
  }

  function renderTiles(board) {
    for (var i = 0; i < 16; i++) {
      var cell = document.createElement("div");
      cell.className = "cell";
      board.appendChild(cell);
    }
    G.state.tiles.forEach(function (t) {
      var node = document.createElement("div");
      var cls = "tile " + tileTone(t.value);
      if (G.mergedIds.indexOf(t.id) >= 0) cls += " is-merged";
      if (G.spawnedId === t.id) cls += " is-new";
      node.className = cls;
      node.style.setProperty("--c", String(t.col));
      node.style.setProperty("--r", String(t.row));
      node.textContent = String(t.value);
      board.appendChild(node);
    });
  }

  function bannerHtml() {
    if (isNativeApp()) return '<div class="ad-slot ad-slot-native" aria-hidden data-admob="' + ADMOB_BANNER + '"></div>';
    return (
      '<div class="ad-slot" aria-label="Advertisement">' +
      '<span class="ad-label">Ad</span>' +
      '<ins class="adsbygoogle" style="display:block;width:100%;min-height:50px" data-ad-client="' +
      AD_CLIENT +
      '" data-ad-slot="' +
      AD_SLOT_BANNER +
      '" data-ad-format="horizontal" data-full-width-responsive="true"></ins></div>'
    );
  }

  var bannerPushed = false;

  function render() {
    var showWin = G.state.won && !G.state.continued && G.screen === "play" && !G.interstitial;
    var showOver = G.state.over && !showWin && G.screen === "play" && !G.interstitial;
    var root = document.createElement("div");
    root.className = "game-shell" + (G.screen === "play" ? " is-play" : "");
    root.innerHTML = '<div class="game-bg" aria-hidden="true"></div>';

    if (G.screen === "start") {
      var start = el(
        '<section class="start">' +
          '<div class="start-top"></div>' +
          '<div class="start-hero">' +
            '<p class="start-kicker stagger" style="animation-delay:40ms">A quiet sliding puzzle</p>' +
            '<h1 class="start-title stagger" style="animation-delay:120ms">2048</h1>' +
            '<div class="intro-tiles" aria-hidden="true">' +
              [2, 4, 8, 2048]
                .map(function (v, i) {
                  return (
                    '<div class="intro-wrap" style="animation-delay:' + i * 90 + 'ms">' +
                    '<div class="intro-tile ' + tileTone(v) + (v === 2048 ? " is-prize" : "") + '">' + v + "</div></div>"
                  );
                })
                .join("") +
            "</div>" +
            '<p class="start-sub stagger" style="animation-delay:280ms">Slide. Merge. Reach the tile.</p>' +
            '<div class="start-stats stagger" style="animation-delay:360ms"><div><span class="stat-label">Best</span><span class="stat-value">' +
            G.best.toLocaleString() +
            "</span></div></div>" +
            '<div class="start-actions stagger" style="animation-delay:440ms"></div>' +
            '<p class="start-hint stagger" style="animation-delay:520ms">Swipe on a phone · arrows on a keyboard</p>' +
          "</div></section>"
      );
      start.querySelector(".start-top").appendChild(iconBtn(G.muted ? "Unmute" : "Mute", G.muted ? ICONS.mute : ICONS.volume, toggleMute));
      start.querySelector(".start-top").appendChild(
        iconBtn("How to play", ICONS.help, function () {
          playClick();
          G.help = true;
          render();
        })
      );
      var actions = start.querySelector(".start-actions");
      if (G.hasResume) {
        var cont = document.createElement("button");
        cont.type = "button";
        cont.className = "btn-primary";
        cont.textContent = "Continue";
        cont.addEventListener("click", function () { begin(true); });
        actions.appendChild(cont);
      }
      var play = document.createElement("button");
      play.type = "button";
      play.className = G.hasResume ? "btn-ghost" : "btn-primary";
      play.innerHTML = ICONS.play + (G.hasResume ? " New game" : " Play");
      play.addEventListener("click", function () { begin(false); });
      actions.appendChild(play);
      root.appendChild(start);
    } else {
      var main = el(
        '<main class="play-layout">' +
          '<header class="hud">' +
            '<div class="brand-lockup"><p class="brand-kicker">Vault</p><h1 class="brand-title">2048</h1></div>' +
            '<div class="score-row">' +
              '<div class="score-chip"><span class="score-label">Score</span><span class="score-value">' +
              G.state.score.toLocaleString() +
              "</span>" +
              (G.delta > 0 ? '<span class="score-delta">+' + G.delta + "</span>" : "") +
              "</div>" +
              '<div class="score-chip"><span class="score-label">Best</span><span class="score-value">' +
              G.best.toLocaleString() +
              "</span></div>" +
            "</div></header>" +
          '<div class="toolbar"></div>' +
          '<div class="board-wrap"><div class="board" role="grid" aria-label="2048 board"></div></div>' +
          '<p class="hint">Swipe or arrow keys. WASD works too.</p>' +
        "</main>"
      );
      var bar = main.querySelector(".toolbar");
      bar.appendChild(iconBtn("New game", ICONS.restart, maybeAdThenNew));
      bar.appendChild(iconBtn(G.muted ? "Unmute" : "Mute", G.muted ? ICONS.mute : ICONS.volume, toggleMute));
      bar.appendChild(
        iconBtn("How to play", ICONS.help, function () {
          playClick();
          G.help = true;
          render();
        })
      );
      renderTiles(main.querySelector(".board"));
      root.appendChild(main);
    }

    root.insertAdjacentHTML("beforeend", bannerHtml());

    if (showWin) {
      var win = el(
        '<div class="overlay" role="dialog"><div class="overlay-card">' +
          '<p class="overlay-kicker">You did it</p><h2 class="overlay-title">2048</h2>' +
          '<p class="overlay-copy">Score ' + G.state.score.toLocaleString() + " · highest tile " + maxTile(G.state.tiles) + "</p>" +
          '<div class="overlay-actions"></div></div></div>'
      );
      var keep = document.createElement("button");
      keep.type = "button";
      keep.className = "btn-primary";
      keep.textContent = "Keep going";
      keep.addEventListener("click", function () {
        playClick();
        G.state = Object.assign({}, G.state, { continued: true });
        persist();
        render();
      });
      var ng = document.createElement("button");
      ng.type = "button";
      ng.className = "btn-ghost";
      ng.textContent = "New game";
      ng.addEventListener("click", maybeAdThenNew);
      win.querySelector(".overlay-actions").appendChild(keep);
      win.querySelector(".overlay-actions").appendChild(ng);
      root.appendChild(win);
    }

    if (showOver) {
      var over = el(
        '<div class="overlay" role="dialog"><div class="overlay-card">' +
          '<p class="overlay-kicker">Board is full</p><h2 id="over-title" class="overlay-title">Out of moves</h2>' +
          '<p class="overlay-copy">' +
          G.state.score.toLocaleString() +
          " points · best " +
          Math.max(G.best, G.state.score).toLocaleString() +
          (G.canRevive ? " · watch an ad to undo the last slide" : "") +
          '</p><div class="overlay-actions"></div></div></div>'
      );
      var actions = over.querySelector(".overlay-actions");
      if (G.canRevive) {
        var adBtn = document.createElement("button");
        adBtn.type = "button";
        adBtn.className = "btn-primary";
        adBtn.textContent = "Watch ad to undo";
        adBtn.addEventListener("click", watchAdToUndo);
        actions.appendChild(adBtn);
      }
      var again = document.createElement("button");
      again.type = "button";
      again.className = G.canRevive ? "btn-ghost" : "btn-primary";
      again.textContent = "Try again";
      again.addEventListener("click", maybeAdThenNew);
      actions.appendChild(again);
      root.appendChild(over);
    }

    if (G.help) {
      var help = el(
        '<div class="overlay" role="dialog" data-no-swipe><div class="overlay-card">' +
          '<div class="overlay-head"><h2 id="help-title" class="overlay-title sm">How to play</h2></div>' +
          "<ol class=\"help-list\">" +
          "<li>Slide tiles with a swipe, arrow keys, WASD, or a gamepad.</li>" +
          "<li>When two tiles with the same number touch, they merge into one.</li>" +
          "<li>Reach the 2048 tile. Keep going for 4096 and beyond.</li>" +
          "<li>Out of moves? Watch an ad to undo the last slide. Best score is saved on this device.</li>" +
          "</ol></div></div>"
      );
      var close = iconBtn("Close", ICONS.close, function () {
        playClick();
        G.help = false;
        render();
      });
      help.querySelector(".overlay-head").appendChild(close);
      var got = document.createElement("button");
      got.type = "button";
      got.className = "btn-primary";
      got.textContent = G.screen === "start" ? "Play" : "Got it";
      got.addEventListener("click", function () {
        playClick();
        G.help = false;
        if (G.screen === "start") begin(G.hasResume);
        else render();
      });
      help.querySelector(".overlay-card").appendChild(got);
      root.appendChild(help);
    }

    if (G.interstitial) {
      var rewarded = G.afterAd === "undo";
      var label = rewarded ? "Undo last move" : "Continue";
      var ad = el(
        '<div class="overlay interstitial" role="dialog" aria-label="Advertisement">' +
          '<div class="overlay-card interstitial-card">' +
          '<p class="ad-kicker">' + (rewarded ? "Watch to undo" : "Advertisement") + "</p>" +
          '<div class="interstitial-frame"><ins class="adsbygoogle" style="display:block;min-height:160px;width:100%" data-ad-client="' +
          AD_CLIENT +
          '" data-ad-slot="' +
          AD_SLOT_BANNER +
          '" data-ad-format="auto" data-full-width-responsive="true"></ins></div>' +
          "</div></div>"
      );
      var skip = document.createElement("button");
      skip.type = "button";
      skip.className = "btn-primary";
      skip.disabled = true;
      skip.textContent = "Wait 5";
      skip.addEventListener("click", finishAd);
      ad.querySelector(".interstitial-card").appendChild(skip);
      root.appendChild(ad);
    }

    app.replaceChildren(root);

    if (!isNativeApp() && !bannerPushed) {
      bannerPushed = true;
      setTimeout(pushAd, 80);
    }

    bindSwipe(root);
  }

  var swipe = null;
  function bindSwipe(root) {
    root.addEventListener("pointerdown", function (e) {
      if (G.screen !== "play") return;
      if (e.target.closest("button, a, [data-no-swipe]")) return;
      swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    root.addEventListener("pointerup", function (e) {
      if (!swipe || swipe.id !== e.pointerId) return;
      var dx = e.clientX - swipe.x;
      var dy = e.clientY - swipe.y;
      swipe = null;
      var ax = Math.abs(dx);
      var ay = Math.abs(dy);
      if (Math.max(ax, ay) < 28) return;
      applyMove(ax > ay ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    });
    root.addEventListener("pointercancel", function () {
      swipe = null;
    });
  }

  window.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.code === "KeyM") {
      toggleMute();
      return;
    }
    if (G.screen === "start" && (e.code === "Enter" || e.code === "Space")) {
      e.preventDefault();
      begin(G.hasResume);
      return;
    }
    var dir = DIRS[e.code];
    if (!dir) return;
    e.preventDefault();
    applyMove(dir);
  });

  var padPressed = false;
  function pollPad() {
    requestAnimationFrame(pollPad);
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var pad = pads[0];
    if (!pad) return;
    var dir = null;
    if (pad.buttons[14] && pad.buttons[14].pressed) dir = "left";
    else if (pad.buttons[15] && pad.buttons[15].pressed) dir = "right";
    else if (pad.buttons[12] && pad.buttons[12].pressed) dir = "up";
    else if (pad.buttons[13] && pad.buttons[13].pressed) dir = "down";
    else {
      var x = pad.axes[0] || 0;
      var y = pad.axes[1] || 0;
      if (Math.hypot(x, y) > 0.55) dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up";
    }
    if (dir && !padPressed) applyMove(dir);
    padPressed = !!dir;
  }
  requestAnimationFrame(pollPad);

  render();
})();
