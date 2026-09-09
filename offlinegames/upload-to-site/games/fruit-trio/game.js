(function () {
  "use strict";

  const LEVEL_COUNT = 100;
  const MAX_LIVES = 5;
  const LIFE_REGEN_MS = 20 * 60 * 1000;
  const SAVE_VERSION = 1;
  const SAVE_KEY = "fruit-trio-save-v1";
  const AD_CLIENT = "ca-pub-4203857211510947";
  const AD_SLOT_BANNER = "7417753724";

  const FRUITS = [
    { id: 0, name: "Cherry", fill: "#e23d4a", deep: "#9e1f2c", leaf: "#3f7a45" },
    { id: 1, name: "Orange", fill: "#ef8a2a", deep: "#c45e12", leaf: "#4a7c3a" },
    { id: 2, name: "Lemon", fill: "#e2c84b", deep: "#b8941c", leaf: "#4f7d3c" },
    { id: 3, name: "Apple", fill: "#5aa64e", deep: "#2f6d32", leaf: "#3d6b38" },
    { id: 4, name: "Blueberry", fill: "#4a7ec8", deep: "#2a4f8c", leaf: "#3f6e44" },
    { id: 5, name: "Plum", fill: "#8b5aad", deep: "#5a3478", leaf: "#3f6e44" },
    { id: 6, name: "Strawberry", fill: "#d4466f", deep: "#9a2148", leaf: "#3f7a45" },
    { id: 7, name: "Peach", fill: "#e89b7a", deep: "#c46a4e", leaf: "#4a7c3a" },
  ];

  const ICONS = {
    heart:
      '<svg class="icon heart" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 12.57 12 20l-7.5-7.43A5 5 0 1 1 12 6.27a5 5 0 1 1 7.5 6.3z"/></svg>',
    play: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/></svg>',
    map: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>',
    settings:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    volume:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    mute: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    back: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
    pause:
      '<svg class="icon-sm" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
    lock: '<svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    star: '<svg class="star" viewBox="0 0 24 24"><path d="M12 3l2.6 6.3 6.9.6-5.2 4.5 1.6 6.7L12 17.8 6.1 21.1l1.6-6.7L2.5 9.9l6.9-.6z"/></svg>',
    starOn:
      '<svg class="star on" viewBox="0 0 24 24"><path d="M12 3l2.6 6.3 6.9.6-5.2 4.5 1.6 6.7L12 17.8 6.1 21.1l1.6-6.7L2.5 9.9l6.9-.6z"/></svg>',
    close:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    spark:
      '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></svg>',
    retry:
      '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/></svg>',
  };

  let nextId = 1;
  function makeTile(fruit, special) {
    return { id: nextId++, fruit: fruit, special: special || "none" };
  }
  function inBounds(r, c, rows, cols) {
    return r >= 0 && c >= 0 && r < rows && c < cols;
  }
  function posKey(r, c) {
    return r * 32 + c;
  }
  function unkey(k) {
    return { r: Math.floor(k / 32), c: k % 32 };
  }
  function areAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }
  function cloneGrid(grid) {
    return grid.map(function (row) {
      return row.slice();
    });
  }
  function sameFruit(a, b) {
    if (!a || !b) return false;
    if (a.special === "rainbow" || b.special === "rainbow") return false;
    return a.fruit === b.fruit;
  }

  function findMatches(grid) {
    var rows = grid.length;
    var cols = grid[0] ? grid[0].length : 0;
    var cells = new Set();
    var hLen = new Map();
    var vLen = new Map();
    var r, c, start, tile, len, x, y, k;

    for (r = 0; r < rows; r++) {
      c = 0;
      while (c < cols) {
        start = c;
        tile = grid[r][c];
        if (!tile || tile.special === "rainbow") {
          c += 1;
          continue;
        }
        while (c + 1 < cols && sameFruit(grid[r][c + 1], tile)) c += 1;
        len = c - start + 1;
        if (len >= 3) {
          for (x = start; x <= c; x++) {
            k = posKey(r, x);
            cells.add(k);
            hLen.set(k, Math.max(hLen.get(k) || 0, len));
          }
        }
        c += 1;
      }
    }
    for (c = 0; c < cols; c++) {
      r = 0;
      while (r < rows) {
        start = r;
        tile = grid[r][c];
        if (!tile || tile.special === "rainbow") {
          r += 1;
          continue;
        }
        while (r + 1 < rows && sameFruit(grid[r + 1][c], tile)) r += 1;
        len = r - start + 1;
        if (len >= 3) {
          for (y = start; y <= r; y++) {
            k = posKey(y, c);
            cells.add(k);
            vLen.set(k, Math.max(vLen.get(k) || 0, len));
          }
        }
        r += 1;
      }
    }
    return { cells: cells, hLen: hLen, vLen: vLen };
  }

  function specialForCell(k, hLen, vLen) {
    var h = hLen.get(k) || 0;
    var v = vLen.get(k) || 0;
    if (h >= 5 || v >= 5) return "rainbow";
    if (h >= 3 && v >= 3) return "bomb";
    if (h >= 4) return "stripe-h";
    if (v >= 4) return "stripe-v";
    return "none";
  }

  function pickSpecialSpawns(match, preferred) {
    var spawns = new Map();
    var candidates = [];
    match.cells.forEach(function (k) {
      var special = specialForCell(k, match.hLen, match.vLen);
      if (special !== "none") candidates.push({ k: k, special: special });
    });
    if (candidates.length === 0) return spawns;
    function rank(s) {
      return s === "rainbow" ? 4 : s === "bomb" ? 3 : s === "stripe-h" || s === "stripe-v" ? 2 : 0;
    }
    candidates.sort(function (a, b) {
      return rank(b.special) - rank(a.special);
    });
    var usedGroups = new Set();
    candidates.forEach(function (cand) {
      var group = cand.special + ":" + Math.floor(cand.k / 32) + ":" + (cand.k % 32 < 16);
      if (usedGroups.has(group) && cand.special !== "bomb" && cand.special !== "rainbow") return;
      usedGroups.add(group);
      if (!spawns.has(cand.k)) spawns.set(cand.k, cand.special);
    });
    if (preferred) {
      var pk = posKey(preferred.r, preferred.c);
      if (match.cells.has(pk)) {
        var special = specialForCell(pk, match.hLen, match.vLen);
        if (special !== "none") {
          Array.from(spawns.entries()).forEach(function (entry) {
            if (entry[1] === special) spawns.delete(entry[0]);
          });
          spawns.set(pk, special);
        } else if (spawns.size > 0) {
          var best = Array.from(spawns.entries()).sort(function (a, b) {
            return rank(b[1]) - rank(a[1]);
          })[0];
          if (best) {
            spawns.delete(best[0]);
            spawns.set(pk, best[1]);
          }
        }
      }
    }
    return spawns;
  }

  function swapCells(grid, a, b) {
    var tmp = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = tmp;
  }
  function isRainbowSwap(grid, a, b) {
    var ta = grid[a.r][a.c];
    var tb = grid[b.r][b.c];
    return Boolean(ta && tb && (ta.special === "rainbow" || tb.special === "rainbow"));
  }
  function swapCreatesMatch(grid, a, b) {
    if (isRainbowSwap(grid, a, b)) return true;
    swapCells(grid, a, b);
    var match = findMatches(grid);
    swapCells(grid, a, b);
    return match.cells.size > 0;
  }
  function findHint(grid) {
    var rows = grid.length;
    var cols = grid[0] ? grid[0].length : 0;
    var r, c, a, b;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        if (c + 1 < cols) {
          a = { r: r, c: c };
          b = { r: r, c: c + 1 };
          if (swapCreatesMatch(grid, a, b)) return [a, b];
        }
        if (r + 1 < rows) {
          a = { r: r, c: c };
          b = { r: r + 1, c: c };
          if (swapCreatesMatch(grid, a, b)) return [a, b];
        }
      }
    }
    return null;
  }

  function collectSpecialBlast(grid, start, rainbowFruit) {
    var rows = grid.length;
    var cols = grid[0] ? grid[0].length : 0;
    var toClear = new Set(start);
    var queue = Array.from(start);
    var processed = new Set();
    while (queue.length) {
      var k = queue.pop();
      if (processed.has(k)) continue;
      processed.add(k);
      var pos = unkey(k);
      var r = pos.r;
      var c = pos.c;
      if (!inBounds(r, c, rows, cols)) continue;
      var tile = grid[r][c];
      if (!tile) continue;
      function add(nr, nc) {
        if (!inBounds(nr, nc, rows, cols)) return;
        var nk = posKey(nr, nc);
        if (!toClear.has(nk)) {
          toClear.add(nk);
          queue.push(nk);
        }
      }
      var x, y;
      if (tile.special === "stripe-h") {
        for (x = 0; x < cols; x++) add(r, x);
      } else if (tile.special === "stripe-v") {
        for (y = 0; y < rows; y++) add(y, c);
      } else if (tile.special === "bomb") {
        for (y = r - 1; y <= r + 1; y++) {
          for (x = c - 1; x <= c + 1; x++) add(y, x);
        }
      } else if (tile.special === "rainbow") {
        var target = rainbowFruit != null ? rainbowFruit : tile.fruit;
        for (y = 0; y < rows; y++) {
          for (x = 0; x < cols; x++) {
            var t = grid[y][x];
            if (t && (t.fruit === target || t.special === "rainbow")) add(y, x);
          }
        }
      }
    }
    return toClear;
  }

  function clearMatches(grid, preferred, extraStart, rainbowFruit) {
    var match = findMatches(grid);
    var start = new Set(match.cells);
    if (extraStart) extraStart.forEach(function (k) { start.add(k); });
    if (start.size === 0) return { cleared: [], spawned: [], fruits: [], specialsFired: 0 };
    var spawns = pickSpecialSpawns(match, preferred);
    var blast = collectSpecialBlast(grid, start, rainbowFruit == null ? null : rainbowFruit);
    var cleared = [];
    var fruits = [];
    var specialsFired = 0;
    blast.forEach(function (k) {
      var pos = unkey(k);
      var tile = grid[pos.r][pos.c];
      if (!tile) return;
      if (tile.special !== "none") specialsFired += 1;
      cleared.push({ r: pos.r, c: pos.c, tile: tile });
      fruits.push(tile.fruit);
      grid[pos.r][pos.c] = null;
    });
    var spawned = [];
    spawns.forEach(function (special, k) {
      if (!blast.has(k) && !match.cells.has(k)) return;
      var pos = unkey(k);
      var source = cleared.find(function (x) { return x.r === pos.r && x.c === pos.c; });
      var fruit = source && source.tile ? source.tile.fruit : 0;
      var tile = makeTile(fruit, special);
      grid[pos.r][pos.c] = tile;
      spawned.push({ r: pos.r, c: pos.c, tile: tile });
    });
    return { cleared: cleared, spawned: spawned, fruits: fruits, specialsFired: specialsFired };
  }

  function applyRainbowSwap(grid, a, b) {
    var ta = grid[a.r][a.c];
    var tb = grid[b.r][b.c];
    if (!ta || !tb) return { cleared: [], spawned: [], fruits: [], specialsFired: 0 };
    var rainbowPos = ta.special === "rainbow" ? a : b;
    var other = ta.special === "rainbow" ? tb : ta;
    var start = new Set([posKey(rainbowPos.r, rainbowPos.c), posKey(a.r, a.c), posKey(b.r, b.c)]);
    if (other.special === "rainbow") {
      var rows = grid.length;
      var cols = grid[0] ? grid[0].length : 0;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) start.add(posKey(r, c));
      }
    }
    return clearMatches(grid, null, start, other.fruit);
  }

  function applyGravity(grid) {
    var rows = grid.length;
    var cols = grid[0] ? grid[0].length : 0;
    var moves = [];
    for (var c = 0; c < cols; c++) {
      var write = rows - 1;
      for (var r = rows - 1; r >= 0; r--) {
        var tile = grid[r][c];
        if (!tile) continue;
        if (write !== r) {
          moves.push({ id: tile.id, fromR: r, toR: write, c: c });
          grid[write][c] = tile;
          grid[r][c] = null;
        }
        write -= 1;
      }
    }
    return moves;
  }

  function refill(grid, fruitCount, rng) {
    rng = rng || Math.random;
    var rows = grid.length;
    var cols = grid[0] ? grid[0].length : 0;
    var spawns = [];
    for (var c = 0; c < cols; c++) {
      var missing = 0;
      var r;
      for (r = 0; r < rows; r++) if (!grid[r][c]) missing += 1;
      var spawned = 0;
      for (r = 0; r < rows; r++) {
        if (!grid[r][c]) {
          var fruit = Math.floor(rng() * fruitCount);
          var tile = makeTile(fruit);
          grid[r][c] = tile;
          spawns.push({ tile: tile, r: r, c: c, fromR: -missing + spawned });
          spawned += 1;
        }
      }
    }
    return spawns;
  }

  function fillRandom(rows, cols, fruitCount, rng) {
    var grid = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push(makeTile(Math.floor(rng() * fruitCount)));
      grid.push(row);
    }
    return grid;
  }

  function generateSafePattern(rows, cols, fruitCount) {
    var grid = [];
    var r, c;
    for (r = 0; r < rows; r++) {
      var row = [];
      for (c = 0; c < cols; c++) row.push(makeTile((r + c) % Math.min(fruitCount, 4)));
      grid.push(row);
    }
    if (rows >= 3 && cols >= 3) {
      grid[0][1] = makeTile(0);
      grid[1][0] = makeTile(0);
      grid[1][2] = makeTile(1);
      grid[2][1] = makeTile(0);
    }
    return grid;
  }

  function generateBoard(rows, cols, fruitCount, rng) {
    rng = rng || Math.random;
    for (var attempt = 0; attempt < 90; attempt++) {
      var grid = fillRandom(rows, cols, fruitCount, rng);
      for (var i = 0; i < 24; i++) {
        var match = findMatches(grid);
        if (match.cells.size === 0) break;
        match.cells.forEach(function (k) {
          var pos = unkey(k);
          var tile = grid[pos.r][pos.c];
          if (!tile) return;
          grid[pos.r][pos.c] = makeTile((tile.fruit + 1 + Math.floor(rng() * (fruitCount - 1))) % fruitCount);
        });
      }
      if (findMatches(grid).cells.size > 0) continue;
      if (!findHint(grid)) continue;
      return grid;
    }
    return generateSafePattern(rows, cols, fruitCount);
  }

  function shuffleBoard(grid, fruitCount, rng) {
    rng = rng || Math.random;
    var rows = grid.length;
    var cols = grid[0] ? grid[0].length : 0;
    var tiles = [];
    grid.forEach(function (row) {
      row.forEach(function (t) { if (t) tiles.push(t); });
    });
    for (var attempt = 0; attempt < 60; attempt++) {
      var i, j, tmp;
      for (i = tiles.length - 1; i > 0; i--) {
        j = Math.floor(rng() * (i + 1));
        tmp = tiles[i];
        tiles[i] = tiles[j];
        tiles[j] = tmp;
      }
      i = 0;
      var next = cloneGrid(grid);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          next[r][c] = tiles[i++] || makeTile(Math.floor(rng() * fruitCount));
        }
      }
      if (findMatches(next).cells.size === 0 && findHint(next)) return next;
    }
    return generateBoard(rows, cols, fruitCount, rng);
  }

  function scoreForClear(count, chain, specialsFired) {
    var base = count * 40 + Math.max(0, count - 3) * 30;
    var chainBonus = 1 + (chain - 1) * 0.55;
    return Math.round(base * chainBonus + specialsFired * 80);
  }
  function comboWord(chain) {
    if (chain >= 6) return "Radiant";
    if (chain >= 5) return "Superb";
    if (chain >= 4) return "Lovely";
    if (chain >= 3) return "Sweet";
    if (chain >= 2) return "Nice";
    return "";
  }

  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickGoals(n, fruitCount, rng) {
    var goalSlots = n <= 5 ? 1 : n <= 22 ? 2 : 3;
    var used = new Set();
    var goals = [];
    for (var i = 0; i < goalSlots; i++) {
      var fruit = Math.floor(rng() * fruitCount);
      var guard = 0;
      while (used.has(fruit) && guard++ < 12) fruit = (fruit + 1) % fruitCount;
      used.add(fruit);
      var base = n <= 8 ? 10 : n <= 20 ? 14 : n <= 40 ? 18 : n <= 70 ? 22 : 26;
      var count = Math.round(base + n * 0.18 + i * 3 + rng() * 2);
      goals.push({ fruit: fruit, count: Math.min(48, count) });
    }
    return goals;
  }

  function makeLevel(n) {
    var id = Math.max(1, Math.min(LEVEL_COUNT, n));
    var rows = 6;
    var cols = 6;
    if (id <= 10) rows = cols = 6;
    else if (id <= 24) rows = cols = 7;
    else if (id <= 84) rows = cols = 8;
    else rows = cols = 9;
    var fruitCount = 4;
    if (id <= 6) fruitCount = 4;
    else if (id <= 18) fruitCount = 5;
    else if (id <= 40) fruitCount = 6;
    else if (id <= 70) fruitCount = 7;
    else fruitCount = 8;
    var moveBase = id <= 8 ? 30 : id <= 20 ? 28 : id <= 40 ? 26 : id <= 60 ? 24 : id <= 80 ? 22 : 20;
    var moves = Math.max(14, moveBase - Math.floor((id % 10) / 4));
    var rng = mulberry32(id * 9973 + 17);
    return { id: id, rows: rows, cols: cols, fruitCount: fruitCount, moves: moves, goals: pickGoals(id, fruitCount, rng) };
  }

  function starsForResult(movesLeft, movesTotal, won) {
    if (!won) return 0;
    var ratio = movesLeft / Math.max(1, movesTotal);
    if (ratio >= 0.35) return 3;
    if (ratio >= 0.15) return 2;
    return 1;
  }

  function tierLabel(id) {
    if (id <= 10) return "Grove";
    if (id <= 25) return "Orchard";
    if (id <= 50) return "Harvest";
    if (id <= 75) return "Canopy";
    return "Night Grove";
  }

  function defaultSave() {
    return {
      version: SAVE_VERSION,
      unlocked: 1,
      stars: Array.from({ length: LEVEL_COUNT }, function () { return 0; }),
      scores: Array.from({ length: LEVEL_COUNT }, function () { return 0; }),
      lives: MAX_LIVES,
      livesAt: Date.now(),
      settings: { music: true, sfx: true, shake: true },
      seenHowTo: false,
    };
  }

  function loadSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      var parsed = JSON.parse(raw);
      var base = defaultSave();
      return {
        version: SAVE_VERSION,
        unlocked: Math.min(LEVEL_COUNT, Math.max(1, parsed.unlocked || 1)),
        stars: Array.from({ length: LEVEL_COUNT }, function (_, i) { return parsed.stars && parsed.stars[i] ? parsed.stars[i] : 0; }),
        scores: Array.from({ length: LEVEL_COUNT }, function (_, i) { return parsed.scores && parsed.scores[i] ? parsed.scores[i] : 0; }),
        lives: Math.min(MAX_LIVES, Math.max(0, parsed.lives == null ? MAX_LIVES : parsed.lives)),
        livesAt: parsed.livesAt || Date.now(),
        settings: Object.assign(base.settings, parsed.settings || {}),
        seenHowTo: Boolean(parsed.seenHowTo),
      };
    } catch (e) {
      return defaultSave();
    }
  }

  function persistSave(save) {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) { /* private mode */ }
  }

  function regenLives(save, now) {
    now = now || Date.now();
    if (save.lives >= MAX_LIVES) return save;
    var elapsed = Math.max(0, now - save.livesAt);
    var gained = Math.floor(elapsed / LIFE_REGEN_MS);
    if (gained <= 0) return save;
    var lives = Math.min(MAX_LIVES, save.lives + gained);
    var livesAt = lives >= MAX_LIVES ? now : save.livesAt + gained * LIFE_REGEN_MS;
    return Object.assign({}, save, { lives: lives, livesAt: livesAt });
  }

  function nextLifeInMs(save, now) {
    now = now || Date.now();
    if (save.lives >= MAX_LIVES) return 0;
    return Math.max(0, save.livesAt + LIFE_REGEN_MS - now);
  }

  function formatLife(ms) {
    var total = Math.ceil(ms / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  var audioBus = null;
  var musicTimer = null;
  var musicStep = 0;
  var musicOn = true;
  var sfxOn = true;

  function ensureAudio() {
    if (audioBus) return audioBus;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx = new Ctx({ latencyHint: "interactive" });
    var master = ctx.createGain();
    var music = ctx.createGain();
    var sfx = ctx.createGain();
    master.gain.value = 0.85;
    music.gain.value = musicOn ? 0.18 : 0;
    sfx.gain.value = sfxOn ? 0.7 : 0;
    music.connect(master);
    sfx.connect(master);
    master.connect(ctx.destination);
    audioBus = { ctx: ctx, master: master, music: music, sfx: sfx };
    return audioBus;
  }

  function unlockAudio() {
    var b = ensureAudio();
    if (b && b.ctx.state === "suspended") b.ctx.resume();
  }

  function stopMusic() {
    if (musicTimer != null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  var SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
  var PATTERN = [0, 2, 4, 2, 3, 1, 4, 2, 0, 3, 4, 5, 4, 2, 1, 0];

  function scheduleMusic() {
    var b = ensureAudio();
    if (!b || !musicOn) return;
    var stepDur = 0.42;
    var t = b.ctx.currentTime + 0.04;
    var freq = SCALE[PATTERN[musicStep % PATTERN.length]];
    var osc = b.ctx.createOscillator();
    var g = b.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq / 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.9);
    osc.connect(g);
    g.connect(b.music);
    osc.start(t);
    osc.stop(t + stepDur);
    if (musicStep % 4 === 0) {
      var bass = b.ctx.createOscillator();
      var bg = b.ctx.createGain();
      bass.type = "triangle";
      bass.frequency.value = SCALE[0] / 4;
      bg.gain.setValueAtTime(0.12, t);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 1.6);
      bass.connect(bg);
      bg.connect(b.music);
      bass.start(t);
      bass.stop(t + stepDur * 1.6);
    }
    musicStep += 1;
  }

  function startMusic() {
    var b = ensureAudio();
    if (!b || !musicOn) return;
    if (musicTimer != null) return;
    scheduleMusic();
    musicTimer = window.setInterval(scheduleMusic, 420);
  }

  function setMusicEnabled(on) {
    musicOn = on;
    if (!audioBus) return;
    audioBus.music.gain.setTargetAtTime(on ? 0.18 : 0, audioBus.ctx.currentTime, 0.04);
    if (on) startMusic();
    else stopMusic();
  }

  function setSfxEnabled(on) {
    sfxOn = on;
    if (!audioBus) return;
    audioBus.sfx.gain.setTargetAtTime(on ? 0.7 : 0, audioBus.ctx.currentTime, 0.02);
  }

  function tone(freq, dur, type, gain, when, slideTo) {
    var b = ensureAudio();
    if (!b || !sfxOn) return;
    when = when || 0;
    gain = gain == null ? 0.12 : gain;
    var t = b.ctx.currentTime + when;
    var osc = b.ctx.createOscillator();
    var g = b.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(b.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, gain, when) {
    var b = ensureAudio();
    if (!b || !sfxOn) return;
    when = when || 0;
    var t = b.ctx.currentTime + when;
    var len = Math.floor(b.ctx.sampleRate * dur);
    var buffer = b.ctx.createBuffer(1, len, b.ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = b.ctx.createBufferSource();
    src.buffer = buffer;
    var g = b.ctx.createGain();
    var filter = b.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(b.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function playSfx(name) {
    var rate = 1 + (Math.random() * 2 - 1) * 0.04;
    if (name === "click") tone(640 * rate, 0.06, "triangle", 0.05);
    else if (name === "swap") {
      tone(420 * rate, 0.08, "sine", 0.07);
      tone(620 * rate, 0.07, "sine", 0.04, 0.03);
    } else if (name === "invalid") tone(220, 0.12, "square", 0.04, 0, 140);
    else if (name === "match") {
      tone(520 * rate, 0.1, "triangle", 0.08);
      tone(780 * rate, 0.12, "sine", 0.05, 0.04);
    } else if (name === "cascade") {
      tone(660 * rate, 0.1, "triangle", 0.07);
      tone(880 * rate, 0.14, "sine", 0.05, 0.05);
      tone(1040 * rate, 0.12, "sine", 0.04, 0.09);
    } else if (name === "special") {
      noiseBurst(0.12, 0.07);
      tone(300, 0.16, "sawtooth", 0.05, 0, 720);
    } else if (name === "drop") tone(180 * rate, 0.05, "sine", 0.03);
    else if (name === "star") {
      tone(880, 0.12, "sine", 0.06);
      tone(1320, 0.16, "triangle", 0.05, 0.08);
    } else if (name === "win") {
      tone(523, 0.16, "triangle", 0.08);
      tone(659, 0.16, "triangle", 0.08, 0.12);
      tone(784, 0.18, "triangle", 0.08, 0.24);
      tone(1046, 0.28, "sine", 0.07, 0.38);
    } else if (name === "lose") {
      tone(392, 0.2, "sine", 0.07, 0, 280);
      tone(311, 0.24, "triangle", 0.05, 0.12, 196);
    }
  }

  function fruitGlyph(fruit, special) {
    special = special || "none";
    var def = FRUITS[fruit] || FRUITS[0];
    var uid = def.id + "-" + special + "-" + Math.random().toString(36).slice(2, 7);
    var body;
    if (special === "rainbow") {
      body =
        '<circle cx="32" cy="34" r="20" fill="#f3efe4"/>' +
        '<path d="M16 36a16 16 0 0 1 32 0" fill="none" stroke="#e23d4a" stroke-width="4"/>' +
        '<path d="M19 36a13 13 0 0 1 26 0" fill="none" stroke="#ef8a2a" stroke-width="4"/>' +
        '<path d="M22 36a10 10 0 0 1 20 0" fill="none" stroke="#e2c84b" stroke-width="4"/>' +
        '<path d="M25 36a7 7 0 0 1 14 0" fill="none" stroke="#5aa64e" stroke-width="4"/>';
    } else {
      var fill = "url(#g-" + uid + ")";
      var leaf = def.leaf;
      if (fruit === 0) {
        body =
          '<path d="M30 21c2-6 8-9 13-9" stroke="' + leaf + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<path d="M30 21c-1-5-5-8-9-8" stroke="' + leaf + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<circle cx="23" cy="39" r="13" fill="' + fill + '"/>' +
          '<circle cx="41" cy="37" r="13" fill="' + fill + '"/>' +
          '<ellipse cx="46" cy="18" rx="5" ry="2.6" fill="' + leaf + '" transform="rotate(20 46 18)"/>';
      } else if (fruit === 1) {
        body =
          '<circle cx="32" cy="36" r="18" fill="' + fill + '"/>' +
          '<path d="M28 19c1.5-2.4 6-2.4 7.5 0" stroke="' + leaf + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
          '<circle cx="32" cy="18" r="2.4" fill="' + leaf + '"/>' +
          '<g fill="#000" opacity="0.1">' +
          '<circle cx="25" cy="29" r="1.1"/><circle cx="38" cy="27" r="1.1"/>' +
          '<circle cx="41" cy="40" r="1.1"/><circle cx="24" cy="42" r="1.1"/>' +
          '<circle cx="32" cy="45" r="1.1"/><circle cx="33" cy="33" r="1.1"/>' +
          "</g>";
      } else if (fruit === 2) {
        body =
          '<path d="M32 16c8 0 15 9 15 21s-7 21-15 21-15-9-15-21 7-21 15-21z" fill="' + fill + '"/>' +
          '<ellipse cx="16.5" cy="37" rx="3" ry="2.2" fill="' + fill + '"/>' +
          '<ellipse cx="47.5" cy="37" rx="3" ry="2.2" fill="' + fill + '"/>' +
          '<path d="M32 16c-1 2-1 4 0.5 5.5" stroke="' + leaf + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
          '<ellipse cx="38" cy="15" rx="6" ry="2.8" fill="' + leaf + '" transform="rotate(24 38 15)"/>';
      } else if (fruit === 3) {
        body =
          '<path d="M32 18c-2-3-6-5-9-4 1 3 3 4 5 5-8 3-13 12-13 21 0 12 8 19 17 19s17-7 17-19c0-9-5-18-13-21 2-1 4-2 5-5-3-1-7 1-9 4z" fill="' + fill + '"/>' +
          '<path d="M32 20c0 8-2 12-4 16" stroke="#1d3a20" stroke-opacity="0.25" stroke-width="2" fill="none"/>' +
          '<path d="M32 12v6" stroke="#6b4a2a" stroke-width="2.4" stroke-linecap="round"/>' +
          '<ellipse cx="40" cy="14" rx="7" ry="3" fill="' + leaf + '" transform="rotate(18 40 14)"/>';
      } else if (fruit === 4) {
        body =
          '<circle cx="21" cy="41" r="9.5" fill="' + fill + '"/>' +
          '<circle cx="38" cy="43" r="10.5" fill="' + fill + '"/>' +
          '<circle cx="29" cy="27" r="9.5" fill="' + fill + '"/>' +
          '<g stroke="' + def.deep + '" stroke-width="1.3" opacity="0.55" stroke-linecap="round">' +
          '<path d="M21 37.5v3M19.5 39h3"/>' +
          '<path d="M38 38.5v3M36.5 40h3"/>' +
          '<path d="M29 23v3M27.5 24.5h3"/>' +
          "</g>" +
          '<path d="M31 14c2-4 8-6 11-4" stroke="' + leaf + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
      } else if (fruit === 5) {
        body =
          '<ellipse cx="32" cy="37" rx="15" ry="17" fill="' + fill + '"/>' +
          '<path d="M32 22c-3 6-3 11 0 15" stroke="' + def.deep + '" stroke-width="2" fill="none" opacity="0.5" stroke-linecap="round"/>' +
          '<path d="M32 17v8" stroke="' + leaf + '" stroke-width="3" stroke-linecap="round"/>' +
          '<ellipse cx="40" cy="18" rx="6" ry="2.6" fill="' + leaf + '" transform="rotate(18 40 18)"/>';
      } else if (fruit === 6) {
        body =
          '<path d="M14 33c0-12 8-19 18-19s18 7 18 19c0 14-8 24-16 29-1 1-3 1-4 0-8-5-16-15-16-29z" fill="' + fill + '"/>' +
          '<g fill="' + leaf + '">' +
          '<ellipse cx="32" cy="12" rx="3" ry="6"/>' +
          '<ellipse cx="24" cy="15" rx="2.8" ry="5.6" transform="rotate(-38 24 15)"/>' +
          '<ellipse cx="40" cy="15" rx="2.8" ry="5.6" transform="rotate(38 40 15)"/>' +
          '<ellipse cx="18.5" cy="21" rx="2.4" ry="4.6" transform="rotate(-58 18.5 21)"/>' +
          '<ellipse cx="45.5" cy="21" rx="2.4" ry="4.6" transform="rotate(58 45.5 21)"/>' +
          "</g>" +
          '<g fill="#f6dfa0" opacity="0.9">' +
          '<ellipse cx="23" cy="32" rx="1.2" ry="1.9" transform="rotate(-18 23 32)"/>' +
          '<ellipse cx="34" cy="27" rx="1.2" ry="1.9" transform="rotate(8 34 27)"/>' +
          '<ellipse cx="41" cy="36" rx="1.2" ry="1.9" transform="rotate(28 41 36)"/>' +
          '<ellipse cx="21" cy="45" rx="1.2" ry="1.9" transform="rotate(-16 21 45)"/>' +
          '<ellipse cx="30" cy="49" rx="1.2" ry="1.9" transform="rotate(4 30 49)"/>' +
          '<ellipse cx="39" cy="47" rx="1.2" ry="1.9" transform="rotate(22 39 47)"/>' +
          '<ellipse cx="28" cy="38" rx="1.2" ry="1.9" transform="rotate(-6 28 38)"/>' +
          "</g>";
      } else {
        body =
          '<ellipse cx="32" cy="36" rx="17" ry="18" fill="' + fill + '"/>' +
          '<path d="M32 16c1 6 0 10-1 12" stroke="' + leaf + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<ellipse cx="41" cy="16" rx="7" ry="3.2" fill="' + leaf + '" transform="rotate(18 41 16)"/>';
      }
    }
    var overlay = "";
    if (special === "stripe-h") overlay = '<rect x="10" y="30" width="44" height="5" rx="2" fill="#fff" opacity="0.72"/>';
    if (special === "stripe-v") overlay = '<rect x="30" y="10" width="5" height="44" rx="2" fill="#fff" opacity="0.72"/>';
    if (special === "bomb") {
      overlay =
        '<circle cx="32" cy="32" r="22" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="3 4"/>' +
        '<circle cx="32" cy="32" r="4" fill="#fff" opacity="0.8"/>';
    }
    return (
      '<svg viewBox="0 0 64 64" class="glyph" aria-hidden="true">' +
      "<defs>" +
      '<radialGradient id="g-' + uid + '" cx="32%" cy="28%" r="70%">' +
      '<stop offset="0%" stop-color="#fff" stop-opacity="0.55"/>' +
      '<stop offset="42%" stop-color="' + def.fill + '"/>' +
      '<stop offset="100%" stop-color="' + def.deep + '"/>' +
      "</radialGradient>" +
      '<linearGradient id="shine-' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#fff" stop-opacity="0.55"/>' +
      '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
      "</linearGradient>" +
      "</defs>" +
      body +
      '<ellipse cx="24" cy="22" rx="8" ry="5" fill="url(#shine-' + uid + ')" transform="rotate(-18 24 22)"/>' +
      overlay +
      "</svg>"
    );
  }

  function adHtml(format) {
    var height = format === "square" ? 250 : format === "compact" ? 56 : 90;
    var adFormat = format === "square" ? "rectangle" : "horizontal";
    return (
      '<div class="ad" style="height:' + height + "px;min-height:" + height + "px;max-height:" + height + 'px">' +
      '<div class="ad-label">Advertisement</div>' +
      '<ins class="adsbygoogle" style="display:block;min-height:' + height + 'px" data-ad-client="' +
      AD_CLIENT +
      '" data-ad-slot="' +
      AD_SLOT_BANNER +
      '" data-ad-format="' +
      adFormat +
      '" data-full-width-responsive="true"></ins></div>'
    );
  }

  function pushAds() {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) { /* blocked */ }
  }

  function btn(label, opts) {
    opts = opts || {};
    var cls = "btn " + (opts.variant === "secondary" ? "btn-secondary" : opts.variant === "ghost" ? "btn-ghost" : "btn-primary");
    cls += " " + (opts.size === "lg" ? "btn-lg" : opts.size === "icon" ? "btn-icon" : "btn-md");
    if (opts.className) cls += " " + opts.className;
    var extra = opts.disabled ? " disabled" : "";
    var aria = opts.aria ? ' aria-label="' + opts.aria + '"' : "";
    var action = opts.action ? ' data-action="' + opts.action + '"' : "";
    var arg = opts.arg != null ? ' data-arg="' + opts.arg + '"' : "";
    return "<button type=\"button\" class=\"" + cls + "\"" + extra + aria + action + arg + ">" + label + "</button>";
  }

  var app = document.getElementById("app");
  var save = regenLives(loadSave());
  var screen = "start";
  var settingsOpen = false;
  var levelId = 1;
  var nowTick = Date.now();

  var play = null;
  var particles = [];
  var particleLast = 0;
  var particleRaf = 0;
  var idleTimer = null;
  var trauma = 0;
  var shakeRaf = 0;

  function bootAudio() {
    unlockAudio();
    setMusicEnabled(save.settings.music);
    setSfxEnabled(save.settings.sfx);
    if (save.settings.music) startMusic();
  }

  function persist() {
    persistSave(save);
  }

  function updateSettings(next) {
    save.settings = next;
    bootAudio();
    persist();
    render();
  }

  function startLevel(id) {
    bootAudio();
    levelId = id;
    var level = makeLevel(id);
    play = {
      level: level,
      grid: generateBoard(level.rows, level.cols, level.fruitCount),
      moves: level.moves,
      score: 0,
      collected: Array(8).fill(0),
      phase: "idle",
      selected: null,
      hint: null,
      popping: new Set(),
      falling: false,
      combo: "",
      starsEarned: 0,
      shuffleNote: false,
      adKind: null,
      adLeft: 0,
      busy: false,
      won: false,
      dragFrom: null,
    };
    screen = "play";
    resetIdle();
    render();
  }

  function consumeLife() {
    if (save.lives <= 0) return;
    var lives = save.lives - 1;
    save = Object.assign({}, save, {
      lives: lives,
      livesAt: save.lives >= MAX_LIVES ? Date.now() : save.livesAt,
    });
    persist();
  }

  function grantLife() {
    save = Object.assign({}, save, { lives: Math.min(MAX_LIVES, save.lives + 1) });
    persist();
  }

  function onWin(stars, score) {
    var nextStars = save.stars.slice();
    var nextScores = save.scores.slice();
    var idx = levelId - 1;
    nextStars[idx] = Math.max(nextStars[idx] || 0, stars);
    nextScores[idx] = Math.max(nextScores[idx] || 0, score);
    save = Object.assign({}, save, {
      stars: nextStars,
      scores: nextScores,
      unlocked: Math.min(LEVEL_COUNT, Math.max(save.unlocked, levelId + 1)),
    });
    persist();
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function goalsMet(goals, collected) {
    return goals.every(function (g) { return (collected[g.fruit] || 0) >= g.count; });
  }

  function resetIdle() {
    if (idleTimer) window.clearTimeout(idleTimer);
    if (play) play.hint = null;
    idleTimer = window.setTimeout(function () {
      if (!play || play.busy || play.won) return;
      play.hint = findHint(play.grid);
      paintBoard();
    }, 7000);
  }

  function cellCenter(r, c) {
    var el = document.getElementById("board-inner");
    if (!el) return { x: 0, y: 0 };
    var rect = el.getBoundingClientRect();
    return {
      x: ((c + 0.5) / play.level.cols) * rect.width,
      y: ((r + 0.5) / play.level.rows) * rect.height,
    };
  }

  function addBurst(x, y, color, kind, count) {
    kind = kind || "spark";
    count = count || (kind === "confetti" ? 48 : 14);
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = kind === "confetti" ? 80 + Math.random() * 220 : 40 + Math.random() * 140;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (kind === "confetti" ? 80 : 20),
        life: 1,
        max: kind === "confetti" ? 1.4 + Math.random() : 0.45 + Math.random() * 0.35,
        size: kind === "confetti" ? 4 + Math.random() * 5 : 2 + Math.random() * 3,
        color: color,
        kind: kind,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
      });
    }
  }

  function bumpShake(amount) {
    if (!save.settings.shake) return;
    trauma = Math.min(1, trauma + amount);
  }

  function paintBoard() {
    if (!play) return;
    var inner = document.getElementById("board-inner");
    if (!inner) return;
    var level = play.level;
    var html = "";
    for (var r = 0; r < play.grid.length; r++) {
      for (var c = 0; c < play.grid[r].length; c++) {
        var tile = play.grid[r][c];
        if (!tile) continue;
        var selectedHere = play.selected && play.selected.r === r && play.selected.c === c;
        var hinted = play.hint && play.hint.some(function (p) { return p.r === r && p.c === c; });
        var poppingHere = play.popping.has(tile.id);
        var cls = "tile";
        if (selectedHere) cls += " selected";
        if (hinted) cls += " hint";
        if (poppingHere) cls += " popping";
        var trans = play.falling
          ? "top 260ms cubic-bezier(0.22, 1, 0.36, 1), left 160ms ease"
          : "top 160ms ease, left 160ms ease, transform 150ms ease";
        html +=
          '<button type="button" class="' + cls + '" data-r="' + r + '" data-c="' + c + '" aria-label="' +
          (FRUITS[tile.fruit] ? FRUITS[tile.fruit].name : "Fruit") + " row " + (r + 1) + " column " + (c + 1) +
          '" style="width:' + 100 / level.cols + "%;height:" + 100 / level.rows + "%;left:" +
          (c * 100) / level.cols + "%;top:" + (r * 100) / level.rows + "%;transition:" + trans + '">' +
          fruitGlyph(tile.fruit, tile.special) +
          "</button>";
      }
    }
    inner.innerHTML = html;
    var comboEl = document.getElementById("combo");
    if (comboEl) {
      comboEl.classList.toggle("hidden", !play.combo);
      comboEl.innerHTML = play.combo ? "<span>" + play.combo + "</span>" : "";
    }
    var shuffleEl = document.getElementById("shuffle-note");
    if (shuffleEl) shuffleEl.classList.toggle("hidden", !play.shuffleNote);
    var scoreEl = document.getElementById("score-line");
    if (scoreEl) scoreEl.textContent = play.score.toLocaleString() + " pts";
    var movesEl = document.getElementById("moves-n");
    if (movesEl) movesEl.textContent = String(play.moves);
    var goalsEl = document.getElementById("goals");
    if (goalsEl) {
      goalsEl.innerHTML = play.level.goals.map(function (goal) {
        var remaining = Math.max(0, goal.count - (play.collected[goal.fruit] || 0));
        return (
          '<div class="goal"><span class="glyph">' + fruitGlyph(goal.fruit) +
          '</span><span class="tabular font-semibold text-sm">' + (remaining === 0 ? "Done" : remaining) + "</span></div>"
        );
      }).join("");
    }
  }

  async function playClear(working, event, chain) {
    if (event.cleared.length === 0) return { nextCollected: play.collected, nextScore: play.score };
    play.popping = new Set(event.cleared.map(function (c) { return c.tile.id; }));
    play.grid = cloneGrid(working);
    paintBoard();
    playSfx(chain > 1 ? "cascade" : event.specialsFired ? "special" : "match");
    bumpShake(event.specialsFired ? 0.45 : 0.18 + chain * 0.05);
    var word = comboWord(chain);
    if (word) {
      play.combo = word;
      paintBoard();
      window.setTimeout(function () {
        if (play) play.combo = "";
        paintBoard();
      }, 700);
    }
    event.cleared.forEach(function (cell) {
      var p = cellCenter(cell.r, cell.c);
      addBurst(p.x, p.y, (FRUITS[cell.tile.fruit] && FRUITS[cell.tile.fruit].fill) || "#f3efe4");
    });
    var nextCollected = play.collected.slice();
    event.fruits.forEach(function (fruit) {
      if (fruit >= 0 && fruit < nextCollected.length) nextCollected[fruit] += 1;
    });
    var gained = scoreForClear(event.cleared.length, chain, event.specialsFired);
    var nextScore = play.score + gained;
    play.collected = nextCollected;
    play.score = nextScore;
    paintBoard();
    await wait(220);
    play.popping = new Set();
    applyGravity(working);
    play.falling = true;
    play.grid = cloneGrid(working);
    paintBoard();
    playSfx("drop");
    await wait(260);
    refill(working, play.level.fruitCount);
    play.grid = cloneGrid(working);
    paintBoard();
    await wait(280);
    play.falling = false;
    return { nextCollected: nextCollected, nextScore: nextScore };
  }

  function finishIfNeeded(nextCollected, nextMoves, nextScore) {
    if (play.won) return true;
    if (goalsMet(play.level.goals, nextCollected)) {
      play.won = true;
      var stars = starsForResult(nextMoves, play.level.moves, true);
      play.starsEarned = stars;
      play.phase = "won";
      playSfx("win");
      var board = document.getElementById("board-inner");
      if (board) {
        var rect = board.getBoundingClientRect();
        addBurst(rect.width / 2, rect.height / 2, "#f3efe4", "confetti", 64);
        addBurst(rect.width / 2, rect.height / 3, "#6d8a72", "confetti", 36);
      }
      onWin(stars, nextScore);
      render();
      return true;
    }
    if (nextMoves <= 0) {
      play.phase = "lost";
      playSfx("lose");
      bumpShake(0.9);
      render();
      return true;
    }
    return false;
  }

  async function resolveBoard(preferred, rainbowPair) {
    var working = cloneGrid(play.grid);
    var chain = 1;
    if (rainbowPair) {
      var event = applyRainbowSwap(working, rainbowPair[0], rainbowPair[1]);
      var res = await playClear(working, event, chain);
      chain += 1;
      if (goalsMet(play.level.goals, res.nextCollected)) {
        finishIfNeeded(res.nextCollected, play.moves, res.nextScore);
        return;
      }
    }
    for (var safety = 0; safety < 24; safety++) {
      var ev = clearMatches(working, chain === 1 ? preferred : null);
      if (ev.cleared.length === 0) break;
      var r2 = await playClear(working, ev, chain);
      chain += 1;
      if (goalsMet(play.level.goals, r2.nextCollected)) {
        finishIfNeeded(r2.nextCollected, play.moves, r2.nextScore);
        return;
      }
    }
    if (!findHint(working)) {
      play.shuffleNote = true;
      paintBoard();
      working = shuffleBoard(working, play.level.fruitCount);
      play.grid = cloneGrid(working);
      paintBoard();
      await wait(500);
      play.shuffleNote = false;
      paintBoard();
    }
    finishIfNeeded(play.collected, play.moves, play.score);
  }

  async function trySwap(a, b) {
    if (!play || play.busy || play.phase !== "idle") return;
    if (!areAdjacent(a, b)) return;
    var current = cloneGrid(play.grid);
    if (!current[a.r][a.c] || !current[b.r][b.c]) return;
    play.busy = true;
    play.phase = "resolving";
    play.selected = null;
    play.hint = null;
    resetIdle();
    var rainbow = isRainbowSwap(current, a, b);
    var valid = rainbow || swapCreatesMatch(current, a, b);
    swapCells(current, a, b);
    play.grid = cloneGrid(current);
    paintBoard();
    playSfx("swap");
    await wait(160);
    if (!valid) {
      swapCells(current, a, b);
      play.grid = cloneGrid(current);
      paintBoard();
      playSfx("invalid");
      play.busy = false;
      play.phase = "idle";
      return;
    }
    play.moves -= 1;
    paintBoard();
    await resolveBoard(b, rainbow ? [a, b] : undefined);
    if (!play.won && play.moves > 0 && play.phase !== "lost" && play.phase !== "won") {
      play.phase = "idle";
    }
    play.busy = false;
  }

  function onTilePointerDown(r, c, e) {
    if (!play || play.phase !== "idle") return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    play.dragFrom = { r: r, c: c };
    if (play.selected && areAdjacent(play.selected, { r: r, c: c })) {
      trySwap(play.selected, { r: r, c: c });
      return;
    }
    if (play.selected && play.selected.r === r && play.selected.c === c) {
      play.selected = null;
      paintBoard();
      return;
    }
    play.selected = { r: r, c: c };
    playSfx("click");
    paintBoard();
  }

  function bindBoard() {
    var inner = document.getElementById("board-inner");
    if (!inner || !play) return;
    inner.addEventListener("pointerdown", function (e) {
      var btnEl = e.target.closest(".tile");
      if (!btnEl) return;
      onTilePointerDown(Number(btnEl.dataset.r), Number(btnEl.dataset.c), e);
    });
    inner.addEventListener("pointermove", function (e) {
      if (!play || !play.dragFrom || play.phase !== "idle") return;
      var el = inner.getBoundingClientRect();
      var c = Math.floor(((e.clientX - el.left) / el.width) * play.level.cols);
      var r = Math.floor(((e.clientY - el.top) / el.height) * play.level.rows);
      if (!inBounds(r, c, play.level.rows, play.level.cols)) return;
      if (play.dragFrom.r === r && play.dragFrom.c === c) return;
      if (areAdjacent(play.dragFrom, { r: r, c: c })) {
        var origin = play.dragFrom;
        play.dragFrom = null;
        trySwap(origin, { r: r, c: c });
      }
    });
    inner.addEventListener("pointerup", function () { if (play) play.dragFrom = null; });
    inner.addEventListener("pointercancel", function () { if (play) play.dragFrom = null; });
  }

  function startParticleLoop() {
    if (particleRaf) return;
    var loop = function (t) {
      var canvas = document.getElementById("particles");
      if (canvas) {
        var ctx = canvas.getContext("2d");
        if (ctx) {
          var dt = Math.min(0.1, particleLast ? (t - particleLast) / 1000 : 0.016);
          particleLast = t;
          var parent = canvas.parentElement;
          var w = parent ? parent.clientWidth : 300;
          var h = parent ? parent.clientHeight : 300;
          var dpr = Math.min(2, window.devicePixelRatio || 1);
          if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);
          var next = [];
          particles.forEach(function (p) {
            p.life -= dt / p.max;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += (p.kind === "confetti" ? 420 : 180) * dt;
            p.vx *= 0.98;
            p.rot += p.vr * dt;
            if (p.life <= 0) return;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            if (p.kind === "confetti") ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            else {
              ctx.beginPath();
              ctx.arc(0, 0, p.size, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
            next.push(p);
          });
          particles = next;
          ctx.globalAlpha = 1;
        }
      }
      trauma = Math.max(0, trauma - 0.016 * 2.4);
      var mag = trauma * trauma * 7;
      var wrap = document.getElementById("board-wrap");
      if (wrap) wrap.style.transform = mag ? "translateX(" + (Math.random() * 2 - 1) * mag + "px)" : "";
      particleRaf = requestAnimationFrame(loop);
    };
    particleRaf = requestAnimationFrame(loop);
  }

  function overlay(inner, extraClass) {
    return (
      '<div class="overlay">' +
      '<div class="sheet' + (extraClass ? " " + extraClass : "") + '">' + inner + "</div></div>"
    );
  }

  function renderStart() {
    var muted = !save.settings.music && !save.settings.sfx;
    var lifeMs = nextLifeInMs(save, nowTick);
    var lifeLabel = lifeMs ? formatLife(lifeMs) : "";
    return (
      '<div class="screen px-5 pb-8 pt-safe">' +
      '<div class="wrap">' +
      '<div class="row justify-between">' +
      '<div class="pill">' + ICONS.heart + '<span class="tabular font-semibold">' + save.lives +
      '</span><span class="subtle">/ ' + MAX_LIVES + "</span>" +
      (save.lives < MAX_LIVES ? '<span class="muted text-xs tabular">' + lifeLabel + "</span>" : "") +
      "</div>" +
      '<div class="row gap-2">' +
      btn(muted ? ICONS.mute : ICONS.volume, { variant: "secondary", size: "icon", action: "mute", aria: muted ? "Unmute" : "Mute" }) +
      btn(ICONS.settings, { variant: "secondary", size: "icon", action: "settings", aria: "Settings" }) +
      "</div></div>" +
      '<div class="stagger-in mt-10 flex flex-col center grow">' +
      '<div class="hero-fruits"><span class="g-sm">' + fruitGlyph(0) + '</span><span class="g-lg">' +
      fruitGlyph(3) + '</span><span class="g-sm">' + fruitGlyph(1) + "</span></div>" +
      '<p class="kicker">One hundred groves</p>' +
      "<h1 class=\"title\">Fruit Trio</h1>" +
      '<p class="lede">Match three fruits in a line. Climb from a quiet grove to a night harvest.</p>' +
      '<div class="stack">' +
      btn(ICONS.play + " Play level " + Math.min(save.unlocked, 100), { size: "lg", className: "w-full display-xl", action: "play" }) +
      btn(ICONS.map + " Levels", { variant: "secondary", size: "lg", className: "w-full", action: "levels" }) +
      btn("How to play", { variant: "ghost", className: "w-full muted", action: "howto" }) +
      "</div></div>" +
      '<div class="mt-6">' + adHtml("banner") + "</div>" +
      "</div></div>"
    );
  }

  function renderLevels() {
    var html =
      '<div class="screen px-4 pb-8 pt-safe"><div class="wrap wrap-lg">' +
      '<div class="row gap-3 mb-4">' +
      btn(ICONS.back, { variant: "secondary", size: "icon", action: "home", aria: "Back" }) +
      "<div><h1 class=\"title\" style=\"font-size:1.5rem\">Levels</h1>" +
      '<p class="text-sm muted">' + save.stars.filter(function (s) { return s > 0; }).length + " of " + LEVEL_COUNT + " cleared</p></div></div>";
    if (save.lives <= 0) {
      html += '<p class="warn">No lives left. They return on a timer, or restore one from a failed grove.</p>';
    }
    html += '<div class="mb-4">' + adHtml("compact") + '</div><div class="level-grid">';
    for (var i = 1; i <= LEVEL_COUNT; i++) {
      var locked = i > save.unlocked;
      var stars = save.stars[i - 1] || 0;
      var startOfTier = i === 1 || tierLabel(i) !== tierLabel(i - 1);
      if (startOfTier) html += '<p class="tier">' + tierLabel(i) + "</p>";
      html +=
        '<button type="button" class="level-btn' + (locked ? " locked" : stars ? " cleared" : "") +
        '"' + (locked ? " disabled" : "") + ' data-action="pick" data-arg="' + i +
        '" aria-label="' + (locked ? "Level " + i + " locked" : "Level " + i) + '">' +
        (locked
          ? ICONS.lock
          : "<span>" + i + '</span><span class="stars-mini">' +
            [1, 2, 3].map(function (s) { return s <= stars ? ICONS.starOn : ICONS.star; }).join("") +
            "</span>") +
        "</button>";
    }
    html += "</div></div></div>";
    return html;
  }

  function renderHowTo() {
    return (
      '<div class="screen px-5 pb-8 pt-safe"><div class="wrap">' +
      '<div class="row gap-3 mb-6">' +
      btn(ICONS.back, { variant: "secondary", size: "icon", action: "home", aria: "Back" }) +
      "<h1 style=\"font-size:1.5rem\">How to play</h1></div>" +
      '<ol class="howto-list">' +
      '<li class="card"><p class="fg">Swap neighbors</p><p class="mt-1">Tap two adjacent fruits, or drag from one onto the next. The swap stays only if it makes a line of three or more.</p></li>' +
      '<li class="card"><p class="fg">Clear the basket</p><p class="mt-1">Each level asks for a set of fruits. Cascades count. Finish before moves run out.</p>' +
      '<div class="fruit-row"><span>' + fruitGlyph(0) + "</span><span>" + fruitGlyph(3) + "</span><span>" + fruitGlyph(1) + "</span></div></li>" +
      '<li class="card"><p class="fg">Specials</p><p class="mt-1">Four in a line makes a stripe that clears a row or column. An L or T makes a burst. Five in a line makes a prism that clears a whole fruit.</p></li>' +
      '<li class="card"><p class="fg">Lives</p><p class="mt-1">A failed grove costs one life. Lives return over time, or you can restore one after a short sponsored pause.</p></li>' +
      "</ol>" +
      btn("Start level 1", { size: "lg", className: "mt-8 w-full display-xl", action: "start1" }) +
      "</div></div>"
    );
  }

  function renderPlay() {
    var level = play.level;
    var muted = !save.settings.music && !save.settings.sfx;
    var html =
      '<div class="screen px-3 pb-safe" style="padding-top:max(0.5rem,env(safe-area-inset-top))">' +
      '<div class="wrap wrap-lg">' +
      '<header class="row mb-2">' +
      btn(ICONS.back, { variant: "secondary", size: "icon", action: "exit", aria: "Back" }) +
      '<div class="grow"><p class="header-title">Level ' + level.id + '</p>' +
      '<p class="score-line" id="score-line">' + play.score.toLocaleString() + " pts</p></div>" +
      '<div class="pill" style="padding:0.25rem 0.625rem">' + ICONS.heart.replace("icon heart", "icon-sm heart") +
      '<span class="tabular">' + save.lives + "</span></div>" +
      btn(ICONS.pause, { variant: "secondary", size: "icon", action: "pause", aria: "Pause" }) +
      "</header>" +
      '<div class="row mb-2">' +
      '<div class="goals" id="goals">' +
      level.goals.map(function (goal) {
        var remaining = Math.max(0, goal.count - (play.collected[goal.fruit] || 0));
        return '<div class="goal"><span class="glyph">' + fruitGlyph(goal.fruit) +
          '</span><span class="tabular font-semibold text-sm">' + (remaining === 0 ? "Done" : remaining) + "</span></div>";
      }).join("") +
      '</div><div class="moves-box"><span class="text-xs kicker-sm subtle">Moves</span>' +
      '<span class="n" id="moves-n">' + play.moves + "</span></div></div>" +
      '<div class="board-wrap" id="board-wrap"><div class="board">' +
      '<div class="board-inner" id="board-inner"></div>' +
      '<canvas class="particles" id="particles"></canvas>' +
      '<div class="combo' + (play.combo ? "" : " hidden") + '" id="combo">' +
      (play.combo ? "<span>" + play.combo + "</span>" : "") + "</div>" +
      '<div class="shuffle-note' + (play.shuffleNote ? "" : " hidden") + '" id="shuffle-note"><p>Shuffling</p></div>' +
      "</div></div>" +
      '<div class="mt-2">' + adHtml("compact") + "</div></div>";

    if (play.phase === "paused") {
      html += overlay(
        "<h2 style=\"font-size:1.5rem\">Paused</h2>" +
        btn("Resume", { size: "lg", className: "mt-5 w-full", action: "resume" }) +
        btn((muted ? ICONS.mute : ICONS.volume) + " Audio", { variant: "secondary", className: "mt-2 w-full", action: "settings" }) +
        btn("Leave grove", { variant: "ghost", className: "mt-2 w-full", action: "leave" })
      );
    }
    if (play.phase === "won") {
      html += overlay(
        '<p class="kicker kicker-sm">Grove cleared</p>' +
        "<h2 class=\"mt-1\" style=\"font-size:1.875rem\">Level " + level.id + "</h2>" +
        '<div class="star-row">' +
        [1, 2, 3].map(function (s) {
          var on = s <= play.starsEarned;
          var cls = "star-lg" + (on ? " on" : "");
          return '<svg class="' + cls + '" viewBox="0 0 24 24" style="animation-delay:' + s * 90 + 'ms"><path d="M12 3l2.6 6.3 6.9.6-5.2 4.5 1.6 6.7L12 17.8 6.1 21.1l1.6-6.7L2.5 9.9l6.9-.6z"/></svg>';
        }).join("") +
        "</div>" +
        '<p class="mt-3 tabular muted">' + play.score.toLocaleString() + " pts</p>" +
        '<div class="mt-4">' + adHtml("banner") + "</div>" +
        btn("Next grove", { size: "lg", className: "mt-5 w-full display-xl", action: "next" }) +
        btn(ICONS.retry + " Replay", { variant: "secondary", className: "mt-2 w-full", action: "replay" })
      );
    }
    if (play.phase === "lost" && !play.adKind) {
      html += overlay(
        '<p class="kicker kicker-sm">Out of moves</p>' +
        "<h2 class=\"mt-1\" style=\"font-size:1.875rem\">The grove holds</h2>" +
        '<p class="mt-2 text-sm muted">Restore five moves with a short ad, or try the grove again.</p>' +
        '<div class="mt-4">' + adHtml("banner") + "</div>" +
        btn(ICONS.spark + " Extra moves", { size: "lg", className: "mt-5 w-full", action: "ad-moves" }) +
        btn("Try again", { variant: "secondary", className: "mt-2 w-full", action: "retry", disabled: save.lives <= 0 }) +
        (save.lives <= 0 ? btn("Restore a life", { variant: "ghost", className: "mt-2 w-full", action: "ad-life" }) : "") +
        btn("Map", { variant: "ghost", className: "mt-2 w-full muted", action: "map-lost" }),
        "shake-lose"
      );
    }
    if (play.adKind) {
      html += overlay(
        '<p class="kicker kicker-sm">Sponsored</p>' +
        "<h2 class=\"mt-1\" style=\"font-size:1.5rem\">" + (play.adKind === "moves" ? "Extra moves" : "A life returns") + "</h2>" +
        '<p class="mt-2 text-sm muted">A short pause while the grove rests.</p>' +
        '<div class="mt-4">' + adHtml("square") + "</div>" +
        '<p class="mt-3 center text-sm tabular muted">Continuing in ' + play.adLeft + "s</p>"
      );
    }
    html += "</div>";
    return html;
  }

  function renderSettings() {
    if (!settingsOpen) return "";
    function toggle(label, on, action) {
      return (
        '<button type="button" class="settings-row" data-action="' + action + '"><span>' + label +
        '</span><span class="toggle' + (on ? " on" : "") + '"><span class="toggle-knob"></span></span></button>'
      );
    }
    return (
      '<div class="overlay" style="z-index:50">' +
      '<button type="button" class="overlay-scrim" data-action="close-settings" aria-label="Close settings" style="background:color-mix(in oklab, var(--bg) 70%, transparent)"></button>' +
      '<div class="sheet">' +
      '<div class="row justify-between mb-3"><h2 style="font-size:1.25rem">Settings</h2>' +
      btn(ICONS.close, { variant: "ghost", size: "icon", action: "close-settings", aria: "Close" }) +
      "</div>" +
      '<div class="settings-list">' +
      toggle("Music", save.settings.music, "tog-music") +
      toggle("Sound", save.settings.sfx, "tog-sfx") +
      toggle("Board shake", save.settings.shake, "tog-shake") +
      "</div></div></div>"
    );
  }

  function render() {
    var html = "";
    if (screen === "start") html = renderStart();
    else if (screen === "levels") html = renderLevels();
    else if (screen === "howto") html = renderHowTo();
    else if (screen === "play" && play) html = renderPlay();
    html += renderSettings();
    app.innerHTML = html;
    if (screen === "play" && play) {
      paintBoard();
      bindBoard();
      startParticleLoop();
    }
    window.setTimeout(pushAds, 0);
  }

  app.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.dataset.action;
    var arg = el.dataset.arg;
    if (action === "mute") {
      var on = !(save.settings.music || save.settings.sfx);
      updateSettings(Object.assign({}, save.settings, { music: on, sfx: on }));
    } else if (action === "settings") {
      settingsOpen = true;
      render();
    } else if (action === "close-settings") {
      settingsOpen = false;
      render();
    } else if (action === "play") {
      if (!save.seenHowTo) {
        screen = "howto";
        render();
        return;
      }
      if (save.lives <= 0) {
        screen = "levels";
        render();
        return;
      }
      startLevel(Math.min(save.unlocked, LEVEL_COUNT));
    } else if (action === "levels") {
      bootAudio();
      screen = "levels";
      render();
    } else if (action === "howto") {
      screen = "howto";
      render();
    } else if (action === "home") {
      screen = "start";
      render();
    } else if (action === "start1") {
      save.seenHowTo = true;
      persist();
      startLevel(1);
    } else if (action === "pick") {
      if (save.lives <= 0) return;
      startLevel(Number(arg));
    } else if (action === "exit") {
      if (play && play.phase === "lost") consumeLife();
      screen = "levels";
      play = null;
      render();
    } else if (action === "leave") {
      screen = "levels";
      play = null;
      render();
    } else if (action === "pause") {
      if (play && play.phase === "idle") {
        play.phase = "paused";
        render();
      }
    } else if (action === "resume") {
      if (play) {
        play.phase = "idle";
        render();
      }
    } else if (action === "next") {
      startLevel(Math.min(LEVEL_COUNT, levelId + 1));
    } else if (action === "replay") {
      startLevel(levelId);
    } else if (action === "retry") {
      consumeLife();
      if (save.lives <= 0) {
        screen = "levels";
        play = null;
        render();
        return;
      }
      startLevel(levelId);
    } else if (action === "map-lost") {
      consumeLife();
      screen = "levels";
      play = null;
      render();
    } else if (action === "ad-moves") {
      if (!play) return;
      play.adKind = "moves";
      play.adLeft = 4;
      render();
      var t1 = window.setInterval(function () {
        if (!play) { window.clearInterval(t1); return; }
        play.adLeft = Math.max(0, play.adLeft - 1);
        var label = document.querySelector(".sheet .tabular");
        if (label) label.textContent = "Continuing in " + play.adLeft + "s";
      }, 1000);
      window.setTimeout(function () {
        window.clearInterval(t1);
        if (!play) return;
        play.adKind = null;
        play.moves += 5;
        play.phase = "idle";
        play.busy = false;
        resetIdle();
        render();
      }, 4000);
    } else if (action === "ad-life") {
      if (!play) return;
      play.adKind = "life";
      play.adLeft = 4;
      render();
      var t2 = window.setInterval(function () {
        if (!play) { window.clearInterval(t2); return; }
        play.adLeft = Math.max(0, play.adLeft - 1);
        var label = document.querySelector(".sheet .tabular");
        if (label) label.textContent = "Continuing in " + play.adLeft + "s";
      }, 1000);
      window.setTimeout(function () {
        window.clearInterval(t2);
        if (!play) return;
        play.adKind = null;
        grantLife();
        startLevel(levelId);
      }, 4000);
    } else if (action === "tog-music") {
      updateSettings(Object.assign({}, save.settings, { music: !save.settings.music }));
    } else if (action === "tog-sfx") {
      updateSettings(Object.assign({}, save.settings, { sfx: !save.settings.sfx }));
    } else if (action === "tog-shake") {
      updateSettings(Object.assign({}, save.settings, { shake: !save.settings.shake }));
    }
  });

  window.setInterval(function () {
    nowTick = Date.now();
    save = regenLives(save, nowTick);
    persist();
    if (screen === "start") {
      var pill = document.querySelector(".pill .tabular");
      if (pill) pill.textContent = String(save.lives);
    }
  }, 1000);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (audioBus && audioBus.ctx.state === "suspended") audioBus.ctx.resume();
      save = regenLives(save);
    } else persist();
  });
  window.addEventListener("pagehide", persist);

  render();
})();