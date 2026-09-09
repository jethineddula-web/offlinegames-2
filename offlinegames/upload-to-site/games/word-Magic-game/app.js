(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Word search engine                                                   */
  /* ------------------------------------------------------------------ */

  var DIRECTIONS = [
    { dr: 0, dc: 1 },
    { dr: 0, dc: -1 },
    { dr: 1, dc: 0 },
    { dr: -1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 },
    { dr: -1, dc: 1 },
    { dr: -1, dc: -1 },
  ];

  var FILL_LETTERS =
    "AAAAAAAAABBCCDDDDEEEEEEEEEFFGGGHHIIIIIIJKLLLLMMNNNNNNOOOOOOOPPQRRRRRRSSSSTTTTTTUUUVVWWXYYZ";

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function shuffle(arr, rng) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function inBounds(size, r, c) {
    return r >= 0 && c >= 0 && r < size && c < size;
  }

  function canPlace(grid, word, r, c, dir) {
    var size = grid.length;
    for (var i = 0; i < word.length; i++) {
      var nr = r + dir.dr * i;
      var nc = c + dir.dc * i;
      if (!inBounds(size, nr, nc)) return false;
      var existing = grid[nr][nc];
      if (existing && existing !== word[i]) return false;
    }
    return true;
  }

  function placeWord(grid, word, r, c, dir) {
    var cells = [];
    for (var i = 0; i < word.length; i++) {
      var nr = r + dir.dr * i;
      var nc = c + dir.dc * i;
      grid[nr][nc] = word[i];
      cells.push({ r: nr, c: nc });
    }
    return cells;
  }

  function generatePuzzle(def, rng) {
    var size = def.size;
    var words = def.words
      .map(function (w) {
        return w.toUpperCase().replace(/[^A-Z]/g, "");
      })
      .filter(function (w) {
        return w.length >= 3 && w.length <= size;
      })
      .sort(function (a, b) {
        return b.length - a.length;
      });

    var unique = [];
    var seen = {};
    for (var i = 0; i < words.length; i++) {
      if (!seen[words[i]]) {
        seen[words[i]] = true;
        unique.push(words[i]);
      }
    }

    function fillGrid(grid) {
      return grid.map(function (row) {
        return row.map(function (ch) {
          return ch || FILL_LETTERS[Math.floor(rng() * FILL_LETTERS.length)];
        });
      });
    }

    for (var attempt = 0; attempt < 40; attempt++) {
      var grid = [];
      for (var r = 0; r < size; r++) {
        var row = [];
        for (var c = 0; c < size; c++) row.push(null);
        grid.push(row);
      }
      var placed = [];
      var ok = true;

      for (var wi = 0; wi < unique.length; wi++) {
        var word = unique[wi];
        var dirs = shuffle(DIRECTIONS, rng);
        var starts = [];
        for (var sr = 0; sr < size; sr++) {
          for (var sc = 0; sc < size; sc++) starts.push({ r: sr, c: sc });
        }
        var order = shuffle(starts, rng);
        var placedThis = false;
        outer: for (var di = 0; di < dirs.length; di++) {
          for (var si = 0; si < order.length; si++) {
            var s = order[si];
            if (canPlace(grid, word, s.r, s.c, dirs[di])) {
              placed.push({
                word: word,
                cells: placeWord(grid, word, s.r, s.c, dirs[di]),
              });
              placedThis = true;
              break outer;
            }
          }
        }
        if (!placedThis) {
          ok = false;
          break;
        }
      }

      if (ok) return { grid: fillGrid(grid), placed: placed };
    }

    var fallback = [];
    for (var fr = 0; fr < size; fr++) {
      var frow = [];
      for (var fc = 0; fc < size; fc++) frow.push(null);
      fallback.push(frow);
    }
    var fplaced = [];
    unique.forEach(function (word, i) {
      var r = i % size;
      if (word.length <= size && canPlace(fallback, word, r, 0, { dr: 0, dc: 1 })) {
        fplaced.push({
          word: word,
          cells: placeWord(fallback, word, r, 0, { dr: 0, dc: 1 }),
        });
      }
    });
    return { grid: fillGrid(fallback), placed: fplaced };
  }

  function lineFromTo(start, end) {
    var dr = end.r - start.r;
    var dc = end.c - start.c;
    if (dr === 0 && dc === 0) return [start];
    var steps = Math.max(Math.abs(dr), Math.abs(dc));
    var sr = dr / steps;
    var sc = dc / steps;
    if (!Number.isInteger(sr) || !Number.isInteger(sc)) return null;
    var cells = [];
    for (var i = 0; i <= steps; i++) {
      cells.push({ r: start.r + sr * i, c: start.c + sc * i });
    }
    return cells;
  }

  function lettersOf(grid, cells) {
    return cells
      .map(function (c) {
        return grid[c.r][c.c];
      })
      .join("");
  }

  function cellKey(c) {
    return c.r + "," + c.c;
  }

  function nearestCell(size, clientX, clientY, rect) {
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    var c = Math.max(0, Math.min(size - 1, Math.floor((x / rect.width) * size)));
    var r = Math.max(0, Math.min(size - 1, Math.floor((y / rect.height) * size)));
    return { r: r, c: c };
  }

  /* ------------------------------------------------------------------ */
  /* Puzzles                                                              */
  /* ------------------------------------------------------------------ */

  var RAW = [
    ["Tidepool", "Low tide, wet stone, a small world in a rock.", "SHELL TIDE CRAB KELP FOAM WAVE SAND REEF"],
    ["Orchard", "Rows of trees and the smell of warm fruit.", "PEAR PLUM LEAF BARK ROOT RIPE STEM BEE"],
    ["Studio", "Dust on the floorboards, north light in the window.", "LINEN FRAME BRUSH CLAY TONE SKETCH GLAZE PAPER"],
    ["Atlas", "Folded maps and a coast you have not seen.", "RIDGE FJORD DUNE OASIS DELTA PEAK MARSH COAST"],
    ["Kitchen", "Steam on the glass, a knife on the board.", "THYME BROTH KNIFE FLOUR YEAST ZEST CRUST ONION"],
    ["Archive", "Quiet stacks, a lamp, the weight of paper.", "FOLIO INDEX SPINE MARGIN QUILL LEDGER SEAL CODEX"],
    ["Harbor", "Ropes, rust, and the long wait for weather.", "ANCHOR PIER BUOY WHARF SAIL CARGO WINCH HULL"],
    ["Summit", "Thin air, a cairn, the last switchback.", "GLACIER CAIRN ALPINE SCREE RIDGE TRAIL FROST PASS"],
    ["Meadow", "Tall grass and a path that forgets itself.", "GRASS CLOVER DAISY HARE PATH DEW LARK FENCE"],
    ["Canyon", "Red walls, a thin river, echo for miles.", "CLIFF RIVER ECHO MESA DUST SHADE RAVEN STONE"],
    ["Bakery", "Heat, sugar, and the first loaf of morning.", "BREAD OVEN YEAST CRUST FLOUR ROLL SUGAR STEAM"],
    ["Circus", "Canvas, sawdust, a drumroll in the dark.", "TENT RING CLOWN HORSE TRAPEZE DRUM LIGHT CROWD"],
    ["Desert", "Wind writes the dunes and erases them.", "DUNE OASIS CACTUS HEAT MIRAGE SAND WIND SKULL"],
    ["Forest", "Moss, mushroom, a trail of broken light.", "MOSS PINE FERN OWL ROOT TRAIL SHADE GROVE"],
    ["Glacier", "Blue ice older than any name you know.", "ICE CREVASSE BLUE MELT SNOW CRACK CALVE FROST"],
    ["Jungle", "Green noise, rain, a river you cannot see.", "VINE RAIN FROG CANOPY MANGO MIST TIGER CREEK"],
    ["Market", "Spice, copper, a shout over the awnings.", "SPICE STALL COIN MELON BASKET VENDOR AWNING SALT"],
    ["Museum", "Glass cases and the hush of old things.", "RELIC MARBLE BUST FRAME GUARD VAULT LABEL HALL"],
    ["Night", "Windows go gold. The street forgets its names.", "MOON LAMP MOTH QUIET ALLEY STAR PORCH OWL"],
    ["Ocean", "A long breath in, a longer breath out.", "SWELL CURRENT WHALE FOAM DEPTH SALT SQUID STORM"],
    ["Prairie", "Wind and a sky that will not sit down.", "GRASS BISON HAWK FENCE SKY DUST TRAIL HERD"],
    ["Railway", "Sparks, timetable, a whistle in the rain.", "TRACK STEAM SIGNAL PORTER TICKET BRIDGE COAL BELL"],
    ["River", "Brown water, green banks, a boat going home.", "BEND FERRY REED TROUT BANK CURRENT FORD MILL"],
    ["School", "Chalk, bells, a coat still wet from the walk.", "CHALK BELL DESK BOOK YARD LUNCH MAP GLOBE"],
    ["Space", "Black glass and a slow turning of worlds.", "ORBIT COMET NEBULA QUASAR LUNAR PROBE DUST FLARE"],
    ["Theater", "Velvet, dust, a light that finds a face.", "STAGE CURTAIN PROP ROLE WINGS MASK SPOT LINE"],
    ["Village", "Smoke from one chimney, bread from another.", "WELL LANE SMITH BARN GREEN POND GATE ROOST"],
    ["Winter", "The lake holds its breath under the ice.", "SNOW FROST SLEET ICICLE COAT FIRE SCARF PINE"],
    ["Autumn", "A road of leaves and a sky of iron.", "LEAF AMBER HARVEST GOURD CIDER CROW FROST MAPLE"],
    ["Spring", "Mud, blossom, a bird that will not wait.", "BUD RAIN LAMB BLOSSOM THAW NEST CREEK GREEN"],
    ["Summer", "Heat in the stones, lemonade in the shade.", "HEAT BEACH PICNIC MELON SHADE LAKE FIREFLY DUSK"],
    ["Airport", "A city of glass that never quite sleeps.", "GATE RUNWAY TAXI LUGGAGE TOWER JET DELAY BOARD"],
    ["Castle", "Cold stairs and a banner that still moves.", "KEEP MOAT TOWER HALL ARROW CROWN GATE STONE"],
    ["Farm", "Mud on the boot, milk in the pail.", "BARN SILO TRACTOR HEN PLOW FIELD HAY GOAT"],
    ["Garden", "A hose, a hoe, a stubborn tomato.", "ROSE THYME SOIL HOE PATH BEE POD TRELLIS"],
    ["Island", "Palm shade, a reef, a boat that might come.", "PALM REEF COVE HUT SHELL TIDE LAGOON SAND"],
    ["Library", "The long quiet of other people's thinking.", "SHELF NOVEL INDEX LAMP AISLE STAMP CARD TOME"],
    ["Mountain", "Switchbacks and a wind with an opinion.", "PEAK RIDGE SNOW GOAT TRAIL MIST CLIFF PASS"],
    ["Palace", "Gold leaf, long carpets, a door that waits.", "COURT HALL THRONE GARDEN GATE SILK GUARD BALL"],
    ["Picnic", "A blanket, ants, a sky that cooperates.", "BASKET BLANKET ANTS LEMONADE CHEESE FRUIT SHADE HILL"],
    ["Reef", "Color stacked on color, a fish like a jewel.", "CORAL FISH ANEMONE CLAM WRECK SAND TURTLE WAVE"],
    ["Safari", "Dust, binoculars, a shape in the grass.", "LION JEEP DUST ACACIA HERD TRACK CAMP DAWN"],
    ["Storm", "The sky tears. The house counts the seconds.", "THUNDER RAIN GALE FLASH ROOF GUTTER WIND HAIL"],
    ["Temple", "Stone that has been listening for centuries.", "SHRINE BELL COURT PILLAR INCENSE STEPS MONK GATE"],
    ["Valley", "A river of fog, orchards on both walls.", "MIST ORCHARD RIVER SLOPE FARM ROAD DAWN FENCE"],
    ["Volcano", "A mountain that remembers it is a mouth.", "LAVA ASH CRATER SMOKE ROCK HEAT SLOPE RIFT"],
    ["Workshop", "Sawdust, a vice, a plan drawn in pencil.", "SAW VICE BENCH NAIL PLANE TIMBER OIL RASP"],
    ["Zoo", "A map of the world folded into a park.", "PANDA OTTER AVIARY KEEPER FENCE POND ROAR PATH"],
    ["Ballet", "A wooden floor that knows every landing.", "TUTU BARRE STAGE POINT SHOE LEAP MUSIC WINGS"],
    ["Camping", "A tent, a kettle, a sky full of sharp lights.", "TENT FIRE TRAIL PACK CANTEEN STAR MOSS LAKE"],
    ["Carnival", "Sugar, bulbs, a wheel that should not be that high.", "WHEEL PRIZE TICKET LIGHT CANDY BOOTH CROWD SPIN"],
    ["Chess", "A quiet war on sixty-four squares.", "KING QUEEN ROOK PAWN KNIGHT BISHOP BOARD CLOCK"],
    ["Clockwork", "Brass, oil, a tick that outlives its maker.", "GEAR SPRING COG BRASS KEY TICK DIAL ESCAPE"],
    ["Coral", "A city built by animals the size of a nail.", "REEF POLYP FISH PINK BRAIN FAN SHRIMP TIDE"],
    ["Diner", "Chrome, coffee, a pie under a glass dome.", "COFFEE PIE BOOTH GRILL TOAST SHAKE JUKE WAIT"],
    ["Ember", "The last red thought in a bed of ash.", "FIRE ASH GLOW COAL HEAT SPARK LOG SMOKE"],
    ["Festival", "Paper lanterns, a drum, a street that forgot work.", "LANTERN DRUM PARADE MASK FLOAT CROWD BANNER SONG"],
    ["Greenhouse", "Wet glass, green air, a tomato in January.", "GLASS FERN TOMATO MIST BENCH VINE HEAT POT"],
    ["Honey", "A gold that remembers the field it came from.", "BEE COMB HIVE GOLD WAX FLOWER FIELD JAR"],
    ["Lighthouse", "A white tower telling the dark where the rocks are.", "BEAM TOWER FOG HORN ROCK REEF KEEPER STORM"],
    ["Observatory", "A dome that opens like an eye.", "DOME LENS STAR COMET NIGHT CHART SCOPE MOON"],
    ["Pottery", "Clay on the wheel, a bowl becoming itself.", "CLAY WHEEL KILN GLAZE BOWL SLIP FIRE EARTH"],
    ["Quilt", "A map of leftover cloth and leftover years.", "PATCH STITCH BATTING BLOCK FABRIC NEEDLE WARM SQUARE"],
    ["Ranch", "Fence to the horizon and a horse that knows it.", "HORSE FENCE CATTLE DUST BARN SADDLE GATE HERD"],
    ["Sailboat", "Canvas, salt, a tiller with a mind.", "SAIL MAST KEEL TILLER WIND HULL ROPE WAKE"],
    ["Telescope", "Glass that makes the far thing honest.", "LENS TUBE STAR MOON FOCUS MOUNT NIGHT RING"],
    ["Umbrella", "A small roof you carry through a wet city.", "RAIN SPOKE CANE CLOTH GUST PUDDLE STREET DRIP"],
    ["Vineyard", "Rows of green, a cellar that keeps secrets.", "GRAPE VINE CASK CELLAR PRESS SLOPE LEAF WINE"],
    ["Windmill", "Arms that turn the sky into flour.", "SAIL STONE FLOUR GEAR TOWER WIND GRAIN MILL"],
    ["Yarn", "A skein, a needle, a sweater that was a sheep.", "WOOL KNIT NEEDLE SKEIN LOOP STITCH DYE SHAWL"],
    ["Aurora", "A curtain of light the cold sky cannot keep.", "GREEN RIBBON NIGHT POLE GLOW FROST SKY WAVE"],
    ["Bazaar", "Lanterns, carpets, a bargain that is also a story.", "RUG SPICE LAMP COIN SILK CROWD STALL TEA"],
  ];

  function slug(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function sizeFor(words) {
    var max = Math.max.apply(
      null,
      words.map(function (w) {
        return w.length;
      }),
    );
    var n = words.length;
    if (n >= 10 || max >= 10) return Math.max(10, max);
    if (n >= 9 || max >= 9) return Math.max(9, max);
    return Math.max(8, max);
  }

  var PUZZLES = RAW.map(function (item, i) {
    var words = item[2].split(/\s+/).filter(Boolean);
    return {
      id: String(i + 1).padStart(2, "0") + "-" + slug(item[0]),
      title: item[0],
      blurb: item[1],
      size: sizeFor(words),
      words: words,
      hue: (i * 47) % 360,
    };
  });

  var FOUND_COLORS = [
    "#2a9d8f",
    "#e76f51",
    "#3d5a80",
    "#e9c46a",
    "#9b5de5",
    "#00bbf9",
    "#f15bb5",
    "#06d6a0",
    "#f4a261",
    "#118ab2",
    "#ef476f",
    "#7bdff2",
  ];

  function chapterTint(hue) {
    return (
      "background: hsl(" +
      hue +
      " 38% 16%); border-color: hsl(" +
      hue +
      " 45% 32%);"
    );
  }

  var DAILY_BANK = [
    "LANTERN", "RIVER", "STONE", "CLOUD", "EMBER", "QUIET", "FIELD", "GRAIN",
    "SILVER", "NEEDLE", "TIMBER", "HARBOR", "MEADOW", "CIPHER", "PENCIL", "WINDOW",
    "COPPER", "MIRROR", "GARDEN", "ORBIT", "LINEN", "SPARROW", "THISTLE", "AMBER",
    "CURRENT", "LEDGER", "MARBLE", "WILLOW", "CANYON", "VESSEL", "ORCHID", "QUARTZ",
  ];

  function dailyPuzzle(date) {
    date = date || new Date();
    var key = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    var rng = mulberry32(hashString(key));
    var pool = DAILY_BANK.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return {
      id: "daily-" + key,
      title: "Today’s page",
      blurb: "A new grid every morning. Same paper, different words.",
      size: 10,
      words: pool.slice(0, 10),
      hue: Math.floor(rng() * 360),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Per-device chapter order                                            */
  /* ------------------------------------------------------------------ */
  /* Every device/player gets its own persistent shuffle of the chapter
     order, so two people (or the same person on two phones) don't walk
     through the exact same "chapter 1, 2, 3..." sequence. The seed is
     generated once and stored locally so the order stays stable across
     sessions on that device. */

  var ORDER_KEY = "Word Magic-order-v1";

  function loadOrderSeed() {
    try {
      var raw = localStorage.getItem(ORDER_KEY);
      if (raw != null && raw !== "") {
        var n = parseInt(raw, 10);
        if (!isNaN(n)) return n;
      }
    } catch (e) {}
    var seed = Math.floor(Math.random() * 4294967296);
    try {
      localStorage.setItem(ORDER_KEY, String(seed));
    } catch (e) {}
    return seed;
  }

  var orderSeed = loadOrderSeed();
  var CHAPTER_ORDER = shuffle(PUZZLES, mulberry32(orderSeed));

  function nextPuzzle(id) {
    var i = -1;
    for (var n = 0; n < CHAPTER_ORDER.length; n++) {
      if (CHAPTER_ORDER[n].id === id) {
        i = n;
        break;
      }
    }
    if (i < 0 || i >= CHAPTER_ORDER.length - 1) return null;
    return CHAPTER_ORDER[i + 1];
  }

  /* ------------------------------------------------------------------ */
  /* Save                                                                 */
  /* ------------------------------------------------------------------ */

  var SAVE_KEY = "Word Magic-v1";

  function emptySave() {
    return { version: 1, bestMs: {}, completed: [] };
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return emptySave();
      var parsed = JSON.parse(raw);
      if (parsed.version !== 1) return emptySave();
      return {
        version: 1,
        bestMs: parsed.bestMs || {},
        completed: parsed.completed || [],
      };
    } catch (e) {
      return emptySave();
    }
  }

  function writeSave(next) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  }

  function recordFinish(id, ms) {
    var cur = loadSave();
    var prev = cur.bestMs[id];
    var bestMs = {};
    for (var k in cur.bestMs) bestMs[k] = cur.bestMs[k];
    if (prev == null || ms < prev) bestMs[id] = ms;
    var completed = cur.completed.indexOf(id) >= 0 ? cur.completed : cur.completed.concat([id]);
    var next = { version: 1, bestMs: bestMs, completed: completed };
    writeSave(next);
    return next;
  }

  function formatTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  /* ------------------------------------------------------------------ */
  /* Sound                                                                */
  /* ------------------------------------------------------------------ */

  var audioCtx = null;
  var master = null;
  var muted = false;

  function getCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      master = audioCtx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function dest() {
    var ac = getCtx();
    if (!ac || !master) return null;
    return { ac: ac, out: master };
  }

  function unlockAudio() {
    getCtx();
  }

  function setMuted(next) {
    muted = next;
    if (master) master.gain.value = muted ? 0 : 0.9;
  }

  function tone(freq, dur, type, gain, delay, slide) {
    var d = dest();
    if (!d) return;
    delay = delay || 0;
    var t0 = d.ac.currentTime + delay;
    var osc = d.ac.createOscillator();
    var g = d.ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(d.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(dur, gain, delay) {
    var d = dest();
    if (!d) return;
    delay = delay || 0;
    var n = Math.floor(d.ac.sampleRate * dur);
    var buf = d.ac.createBuffer(1, n, d.ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    var src = d.ac.createBufferSource();
    src.buffer = buf;
    var g = d.ac.createGain();
    var t0 = d.ac.currentTime + delay;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var f = d.ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    src.connect(f);
    f.connect(g);
    g.connect(d.out);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function playClick() {
    tone(880, 0.04, "square", 0.03);
  }
  function playStart() {
    tone(392, 0.12, "triangle", 0.06);
    tone(523, 0.14, "triangle", 0.055, 0.08);
    tone(659, 0.18, "sine", 0.05, 0.16);
    tone(784, 0.28, "sine", 0.04, 0.26);
  }
  function playTick(step) {
    tone(420 + Math.min(step, 12) * 28, 0.035, "sine", 0.028);
  }
  function playFound(index) {
    var notes = [523, 587, 659, 698, 784, 880, 988, 1046];
    var base = notes[index % 8];
    tone(base, 0.1, "triangle", 0.07);
    tone(base * 1.5, 0.14, "sine", 0.045, 0.04);
  }
  function playMiss() {
    noise(0.09, 0.05);
    tone(160, 0.12, "sine", 0.05, 0, 90);
  }
  function playHint() {
    tone(988, 0.08, "sine", 0.04);
    tone(1318, 0.16, "triangle", 0.035, 0.06);
  }
  function playWin() {
    var notes = [523, 659, 784, 1046, 784, 1318];
    notes.forEach(function (n, i) {
      tone(n, 0.16, i % 2 ? "sine" : "triangle", 0.055, i * 0.09);
    });
  }
  function playPage() {
    tone(330, 0.06, "triangle", 0.04);
    tone(440, 0.08, "sine", 0.03, 0.05);
  }

  /* ------------------------------------------------------------------ */
  /* Ads (Google AdSense / H5 Games Ad Placement API)                     */
  /* ------------------------------------------------------------------ */
  /* Fill in AD_CLIENT (and AD_SLOT_BANNER, for the banner unit) once
     AdSense approves the site. Until AD_CLIENT is set, adsEnabled() is
     false and every ad call below just runs its "no ad" fallback
     immediately, so the game is fully playable during review and for
     anyone with an ad blocker. Nothing else in the file needs to change
     when ads go live — just fill in the two constants. */

  var AD_CLIENT = "ca-pub-4203857211510947";
  var AD_SLOT_BANNER = "7417753724";
  var adsScriptState = "idle"; // idle | loading | ready | failed

  function adsEnabled() {
    return !!AD_CLIENT;
  }

  function loadAdScript(cb) {
    if (!adsEnabled() || adsScriptState === "failed") return cb && cb(false);
    if (adsScriptState === "ready") return cb && cb(true);
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak =
      window.adBreak ||
      function (o) {
        window.adsbygoogle.push(o);
      };
    window.adConfig =
      window.adConfig ||
      function (o) {
        window.adsbygoogle.push(o);
      };
    if (adsScriptState === "loading") {
      setTimeout(function () {
        loadAdScript(cb);
      }, 150);
      return;
    }
    adsScriptState = "loading";
    var s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      AD_CLIENT;
    s.onload = function () {
      adsScriptState = "ready";
      window.adConfig({ preloadAdBreaks: "on", sound: "off" });
      cb && cb(true);
    };
    s.onerror = function () {
      adsScriptState = "failed";
      cb && cb(false);
    };
    document.head.appendChild(s);
  }

  /* Full-screen interstitial (e.g. between chapters). onDone always
     fires — whether an ad actually played, was skipped, or ads aren't
     live yet — so callers can just chain the next action off it. */
  function showInterstitial(name, onDone) {
    if (!adsEnabled()) return onDone && onDone();
    loadAdScript(function (ok) {
      if (!ok || typeof window.adBreak !== "function") return onDone && onDone();
      window.adBreak({
        type: "next",
        name: name || "chapter-transition",
        beforeAd: function () {
          stopTimer();
        },
        afterAd: function () {
          onDone && onDone();
        },
        adBreakDone: function () {
          onDone && onDone();
        },
      });
    });
  }

  /* Rewarded ad (e.g. "watch an ad for a hint"). onReward fires only if
     the ad was actually watched; onSkipped fires if the player declined,
     the ad failed to load, or ads aren't live yet — callers should treat
     onSkipped as "no hint" rather than an error. */
  function showRewardedAd(name, onReward, onSkipped) {
    if (!adsEnabled()) return onReward && onReward();
    loadAdScript(function (ok) {
      if (!ok || typeof window.adBreak !== "function") return onReward && onReward();
      window.adBreak({
        type: "reward",
        name: name || "get-hint",
        beforeReward: function (showAdFn) {
          showAdFn();
        },
        adViewed: function () {
          onReward && onReward();
        },
        adDismissed: function () {
          onSkipped && onSkipped();
        },
        adBreakDone: function (info) {
          if (info && info.breakStatus && info.breakStatus !== "viewed") {
            onSkipped && onSkipped();
          }
        },
      });
    });
  }

  /* Banner/display ad. Renders an <ins class="adsbygoogle"> unit into
     the given container once AdSense is live; leaves it empty until
     AD_CLIENT and AD_SLOT_BANNER are filled in. */
  function renderBannerAd(container) {
    if (!container) return;
    if (!adsEnabled() || !AD_SLOT_BANNER) {
      container.innerHTML = "";
      return;
    }
    loadAdScript(function (ok) {
      if (!ok) return;
      container.innerHTML =
        '<ins class="adsbygoogle" style="display:block" data-ad-client="' +
        AD_CLIENT +
        '" data-ad-slot="' +
        AD_SLOT_BANNER +
        '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
    });
  }

  /* ------------------------------------------------------------------ */
  /* Icons                                                                */
  /* ------------------------------------------------------------------ */

  function svgIcon(path, cls) {
    return (
      '<svg class="' +
      (cls || "icon") +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      path +
      "</svg>"
    );
  }

  var ICO = {
    arrowLeft: svgIcon('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', "icon-sm"),
    check: svgIcon('<path d="M20 6 9 17l-5-5"/>', "icon-xs"),
    lightbulb: svgIcon(
      '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    ),
    rotate: svgIcon(
      '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    ),
    volume: svgIcon(
      '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L5.372 8H2.5A1.5 1.5 0 0 0 1 9.5v5A1.5 1.5 0 0 0 2.5 16h2.872l4.425 3.796A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    ),
    volumeOff: svgIcon(
      '<path d="M16 9a5 5 0 0 1 .95 2.5"/><path d="M19.364 5.636a9 9 0 0 1 1.889 9.96"/><path d="m2 2 20 20"/><path d="M11 4.702a.705.705 0 0 0-1.203-.498L5.372 8H2.5A1.5 1.5 0 0 0 1 9.5v5A1.5 1.5 0 0 0 2.5 16h2.872l4.425 3.796A.705.705 0 0 0 11 19.298z"/>',
    ),
  };

  /* ------------------------------------------------------------------ */
  /* App                                                                  */
  /* ------------------------------------------------------------------ */

  var START_LETTERS = "WordMagicSEEKFINDWORDPAGECHAPTERHUE".split("");

  var root = document.getElementById("app");
  var view = "start";
  var def = null;
  var puzzle = null;
  var found = [];
  var hintCell = null;
  var save = loadSave();
  var elapsed = 0;
  var hints = 0;
  var shake = false;
  var mutedState = false;
  var startedAt = 0;
  var rafId = 0;
  var daily = dailyPuzzle();
  var dragCells = null;
  var dragStart = null;
  var lastLen = 0;
  var shakeTimer = 0;

  function build(nextDef) {
    var seed = hashString(nextDef.id + nextDef.words.join(","));
    return generatePuzzle(nextDef, mulberry32(seed));
  }

  function paperFor(hue) {
    return "hsl(" + hue + " 42% 90%)";
  }

  function doneCount() {
    return save.completed.filter(function (id) {
      return id.indexOf("daily-") !== 0;
    }).length;
  }

  function remainingWords() {
    if (!puzzle) return [];
    var have = {};
    found.forEach(function (f) {
      have[f.word] = true;
    });
    return puzzle.placed.filter(function (p) {
      return !have[p.word];
    });
  }

  function muteButton() {
    return (
      '<button type="button" class="icon-btn" data-act="mute" aria-label="' +
      (mutedState ? "Unmute" : "Mute") +
      '">' +
      (mutedState ? ICO.volumeOff : ICO.volume) +
      "</button>"
    );
  }

  function stopTimer() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function startTimer() {
    stopTimer();
    startedAt = performance.now();
    function tick() {
      elapsed = performance.now() - startedAt;
      var el = root.querySelector(".timer");
      if (el) el.textContent = formatTime(elapsed);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function toggleMute() {
    mutedState = !mutedState;
    setMuted(mutedState);
    if (!mutedState) {
      unlockAudio();
      playClick();
    }
    var btns = root.querySelectorAll('[data-act="mute"]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-label", mutedState ? "Unmute" : "Mute");
      btns[i].innerHTML = mutedState ? ICO.volumeOff : ICO.volume;
    }
  }

  function startPuzzle(next) {
    unlockAudio();
    playPage();
    def = next;
    puzzle = build(next);
    found = [];
    hintCell = null;
    hints = 0;
    elapsed = 0;
    dragCells = null;
    dragStart = null;
    lastLen = 0;
    view = "play";
    render();
    startTimer();
  }

  function onTry(cells, word) {
    if (!puzzle || !def) return false;
    var rev = word.split("").reverse().join("");
    var rem = remainingWords();
    var match = null;
    for (var i = 0; i < rem.length; i++) {
      if (rem[i].word === word || rem[i].word === rev) {
        match = rem[i];
        break;
      }
    }
    if (!match) {
      playMiss();
      shake = true;
      var board = root.querySelector(".play-board");
      if (board) {
        board.classList.remove("is-shake");
        void board.offsetWidth;
        board.classList.add("is-shake");
      }
      if (shakeTimer) clearTimeout(shakeTimer);
      shakeTimer = setTimeout(function () {
        shake = false;
        if (board) board.classList.remove("is-shake");
      }, 180);
      return false;
    }
    found = found.concat([match]);
    hintCell = null;
    playFound(found.length - 1);
    paintGrid();
    paintWordList();
    if (found.length === puzzle.placed.length) {
      playWin();
      elapsed = performance.now() - startedAt;
      stopTimer();
      save = recordFinish(def.id, elapsed);
      view = "win";
      showWin();
    }
    return true;
  }

  function grantHint() {
    var rem = remainingWords();
    if (!rem.length) return;
    playHint();
    hintCell = rem[0].cells[0];
    hints += 1;
    paintGrid();
    paintWordList();
  }

  function hint() {
    var rem = remainingWords();
    if (!rem.length) return;
    showRewardedAd("get-hint", grantHint, function () {
      /* player skipped or ad unavailable: no hint given */
    });
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */

  function renderStart() {
    var tiles = "";
    for (var i = 0; i < 96; i++) {
      var hue = (i * 29) % 360;
      var ch = START_LETTERS[i % START_LETTERS.length];
      var op = 0.55 + ((i * 13) % 40) / 100;
      tiles +=
        '<span style="background:hsl(' +
        hue +
        " 55% 46%);color:hsl(" +
        hue +
        " 40% 96%);opacity:" +
        op +
        '">' +
        ch +
        "</span>";
    }
    root.innerHTML =
      '<div class="screen-start">' +
      '<div class="letter-bg" aria-hidden="true">' +
      tiles +
      "</div>" +
      '<div class="title-card">' +
      muteButton() +
      '<p class="kicker">Word finding</p>' +
      ' <h1 class="display">Word Magic</h1>' +
      '<p class="lede">' +
      PUZZLES.length +
      " colorful chapters. Drag letters. Bind the words.</p>" +
      '<button type="button" class="btn btn-primary btn-lg" data-act="to-menu">Start game</button>' +
      '<p class="progress-note">' +
      doneCount() +
      "/" +
      PUZZLES.length +
      " chapters found</p>" +
      "</div></div>";
  }

  function renderMenu() {
    var dailyDone = save.completed.indexOf(daily.id) >= 0;
    var cards = "";
    for (var i = 0; i < CHAPTER_ORDER.length; i++) {
      var p = CHAPTER_ORDER[i];
      var done = save.completed.indexOf(p.id) >= 0;
      cards +=
        '<button type="button" class="chapter-card" data-act="start" data-id="' +
        p.id +
        '" style="' +
        chapterTint(p.hue) +
        '">' +
        '<span class="meta"><span>' +
        String(i + 1).padStart(2, "0") +
        "</span>" +
        (done ? ICO.check : "") +
        "</span>" +
        '<span class="title">' +
        escapeHtml(p.title) +
        "</span>" +
        '<span class="blurb">' +
        escapeHtml(p.blurb) +
        "</span></button>";
    }
    root.innerHTML =
      '<div class="screen-menu">' +
      '<header class="menu-header"><div class="menu-header-copy">' +
      '<button type="button" class="back-link" data-act="to-start">' +
      ICO.arrowLeft +
      " Title</button>" +
      '<h1 class="menu-title">Chapters</h1>' +
      '<p class="progress-note">' +
      doneCount() +
      " of " +
      PUZZLES.length +
      " complete</p></div>" +
      muteButton() +
      "</header>" +
      '<button type="button" class="daily-card' +
      (dailyDone ? " is-done" : "") +
      '" data-act="start-daily" style="' +
      chapterTint(daily.hue) +
      '">' +
      '<span class="daily-top">' +
      '<span class="kicker" style="opacity:.7">Daily</span>' +
      (dailyDone
        ? '<span class="daily-done">' + ICO.check + " Solved</span>"
        : "") +
      "</span>" +
      '<span class="title">' +
      escapeHtml(daily.title) +
      "</span>" +
      '<span class="blurb">' +
      escapeHtml(daily.blurb) +
      "</span></button>" +
      '<div class="chapter-grid">' +
      cards +
      "</div>" +
      '<div class="ad-slot" data-ad-slot-role="banner"></div>' +
      "</div>";
    renderBannerAd(root.querySelector(".ad-slot"));
  }

  function renderPlay() {
    if (!def || !puzzle) return;
    var size = puzzle.grid.length;
    var cells = "";
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        cells +=
          '<div class="cell" role="gridcell" data-r="' +
          r +
          '" data-c="' +
          c +
          '">' +
          puzzle.grid[r][c] +
          "</div>";
      }
    }
    var paper = paperFor(def.hue);
    root.innerHTML =
      '<div class="screen-play" style="background:hsl(' +
      def.hue +
      ' 18% 8%)">' +
      '<div class="play-inner">' +
      '<div class="play-top">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="to-menu">' +
      ICO.arrowLeft +
      " Chapters</button>" +
      '<div class="play-heading"><h2>' +
      escapeHtml(def.title) +
      '</h2><p class="timer">' +
      formatTime(elapsed) +
      "</p></div>" +
      '<div class="play-actions">' +
      muteButton() +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="hint" aria-label="Hint" style="padding-left:.5rem;padding-right:.5rem">' +
      ICO.lightbulb +
      "</button>" +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="restart" aria-label="Restart" style="padding-left:.5rem;padding-right:.5rem">' +
      ICO.rotate +
      "</button></div></div>" +
      '<div class="play-board">' +
      '<div class="grid-paper" role="grid" aria-label="Letter grid" style="background:' +
      paper +
      '"><div class="letter-grid" style="grid-template-columns:repeat(' +
      size +
      ',minmax(0,1fr))">' +
      cells +
      "</div></div>" +
      '<aside class="word-aside"><p class="word-count"></p><ul class="word-list"></ul></aside>' +
      "</div></div></div>";
    paintGrid();
    paintWordList();
    bindGrid();
  }

  function paintGrid() {
    if (!puzzle) return;
    var colorByCell = {};
    found.forEach(function (w, wi) {
      var col = FOUND_COLORS[wi % FOUND_COLORS.length];
      w.cells.forEach(function (c) {
        colorByCell[cellKey(c)] = col;
      });
    });
    var dragSet = {};
    if (dragCells) {
      dragCells.forEach(function (c) {
        dragSet[cellKey(c)] = true;
      });
    }
    var hintKey = hintCell ? cellKey(hintCell) : null;
    var paper = paperFor(def.hue);
    var nodes = root.querySelectorAll(".cell");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-r") + "," + el.getAttribute("data-c");
      var isDrag = !!dragSet[key];
      var foundColor = colorByCell[key];
      el.classList.toggle("is-drag", isDrag);
      el.classList.toggle("is-hint", hintKey === key && !isDrag);
      if (isDrag) {
        el.style.background = "#161412";
        el.style.color = paper;
      } else if (foundColor) {
        el.style.background = foundColor + "33";
        el.style.color = foundColor;
      } else {
        el.style.background = "transparent";
        el.style.color = "#161412";
      }
    }
  }

  function paintWordList() {
    if (!puzzle) return;
    var foundSet = {};
    found.forEach(function (f) {
      foundSet[f.word] = true;
    });
    var count = root.querySelector(".word-count");
    if (count) {
      count.textContent =
        found.length +
        "/" +
        puzzle.placed.length +
        " found" +
        (hints > 0 ? " · " + hints + " hint" + (hints === 1 ? "" : "s") : "");
    }
    var list = root.querySelector(".word-list");
    if (!list) return;
    var html = "";
    puzzle.placed.forEach(function (p, i) {
      var done = !!foundSet[p.word];
      var color = FOUND_COLORS[i % FOUND_COLORS.length];
      var style = done
        ? "border-color:" +
          color +
          "66;background:" +
          color +
          "22;color:" +
          color
        : "";
      html +=
        '<li class="word-chip' +
        (done ? " is-found" : "") +
        '" style="' +
        style +
        '">' +
        escapeHtml(p.word) +
        "</li>";
    });
    list.innerHTML = html;
  }

  function showWin() {
    if (!def || !puzzle) return;
    var existing = root.querySelector(".win-overlay");
    if (existing) existing.remove();
    var nxt = nextPuzzle(def.id);
    var overlay = document.createElement("div");
    overlay.className = "win-overlay";
    overlay.innerHTML =
      '<div class="win-card" role="dialog" aria-labelledby="win-title">' +
      '<p class="kicker">Chapter complete</p>' +
      '<h2 id="win-title">' +
      escapeHtml(def.title) +
      "</h2>" +
      "<p>" +
      puzzle.placed.length +
      " words in " +
      formatTime(elapsed) +
      (hints ? " with " + hints + " hint" + (hints === 1 ? "" : "s") : "") +
      ".</p>" +
      '<div class="win-actions">' +
      (nxt
        ? '<button type="button" class="btn btn-primary btn-md" data-act="next">Next chapter</button>'
        : '<button type="button" class="btn btn-primary btn-md" data-act="to-menu">All chapters</button>') +
      '<button type="button" class="btn btn-secondary btn-md" data-act="restart">Play again</button>' +
      "</div></div>";
    root.appendChild(overlay);
    var timer = root.querySelector(".timer");
    if (timer) timer.textContent = formatTime(elapsed);
  }

  function bindGrid() {
    var paper = root.querySelector(".grid-paper");
    if (!paper) return;
    var size = puzzle.grid.length;

    function resolve(e) {
      return nearestCell(size, e.clientX, e.clientY, paper.getBoundingClientRect());
    }

    function onDown(e) {
      if (view === "win") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      paper.setPointerCapture(e.pointerId);
      var cell = resolve(e);
      if (!cell) return;
      dragStart = cell;
      lastLen = 1;
      dragCells = [cell];
      playTick(1);
      paintGrid();
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragStart) return;
      var cell = resolve(e);
      if (!cell) return;
      var line = lineFromTo(dragStart, cell);
      if (!line) return;
      if (line.length !== lastLen) {
        lastLen = line.length;
        playTick(line.length);
      }
      dragCells = line;
      paintGrid();
    }

    function onUp() {
      if (dragCells && dragCells.length >= 3) {
        onTry(dragCells, lettersOf(puzzle.grid, dragCells));
      }
      dragStart = null;
      lastLen = 0;
      dragCells = null;
      paintGrid();
    }

    paper.addEventListener("pointerdown", onDown);
    paper.addEventListener("pointermove", onMove);
    paper.addEventListener("pointerup", onUp);
    paper.addEventListener("pointercancel", onUp);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "\u0026amp;")
      .replace(/</g, "\u0026lt;")
      .replace(/>/g, "\u0026gt;")
      .replace(/"/g, "\u0026quot;");
  }

  function puzzleById(id) {
    for (var i = 0; i < PUZZLES.length; i++) {
      if (PUZZLES[i].id === id) return PUZZLES[i];
    }
    return null;
  }

  function render() {
    stopTimer();
    if (view === "start") renderStart();
    else if (view === "menu") renderMenu();
    else renderPlay();
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]");
    if (!t) return;
    var act = t.getAttribute("data-act");
    if (act === "mute") {
      toggleMute();
      return;
    }
    if (act === "to-menu") {
      unlockAudio();
      if (view === "start") playStart();
      else playClick();
      view = "menu";
      render();
      return;
    }
    if (act === "to-start") {
      playClick();
      view = "start";
      render();
      return;
    }
    if (act === "start-daily") {
      startPuzzle(daily);
      return;
    }
    if (act === "start") {
      var p = puzzleById(t.getAttribute("data-id"));
      if (p) startPuzzle(p);
      return;
    }
    if (act === "hint") {
      hint();
      return;
    }
    if (act === "restart") {
      if (def) startPuzzle(def);
      return;
    }
    if (act === "next") {
      var nxt = def ? nextPuzzle(def.id) : null;
      if (nxt) {
        showInterstitial("chapter-transition", function () {
          startPuzzle(nxt);
        });
      } else {
        view = "menu";
        render();
      }
    }
  });

  render();
})();