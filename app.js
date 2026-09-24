(function () {
  var SA = window.SiteAdmin;
  var games = (window.SITE_GAMES || []).slice();
  var news = (window.SITE_NEWS || []).slice();
  var icons = window.CAT_ICONS || {};
  var state = { search: "", category: "All", catsOpen: false, favs: [], recents: [] };
  var touchUI = window.matchMedia("(hover: none)").matches || window.matchMedia("(pointer: coarse)").matches;

  /* WAS: every page load merged a localStorage snapshot ("og-catalog-draft")
   * on top of the freshly downloaded catalog.js. And because refreshAdminUI()
   * runs unconditionally at startup, EVERY visitor wrote that snapshot on
   * their first visit — not just you while editing.
   *
   * The merge kept the server's copy for any id it already had, then appended
   * every id the snapshot had that the server did not. So a game you DELETED
   * from catalog.js came straight back out of the visitor's own localStorage,
   * forever, on every future visit. Incognito looked correct because incognito
   * has no localStorage to merge.
   *
   * The catalog file is the single source of truth. Nothing local gets to
   * override it, and any snapshot left over from the old code is deleted here
   * so browsers that are already poisoned heal themselves on the next load. */
  try { localStorage.removeItem("og-catalog-draft"); } catch (e) {}

  try {
    var saved = JSON.parse(localStorage.getItem("og-vault-v1") || "{}");
    state.favs = saved.favorites || [];
    state.recents = saved.recents || [];
  } catch (e) {}

  function persistCatalog() {
    try {
      /* window.SITE_GAMES must stay current — contact-panel.js reads it.
       * But the localStorage copy is only useful
       * while you are mid-edit in the admin panel, and writing it for every
       * visitor is what caused deleted games to reappear. Admins only. */
      window.SITE_GAMES = games;
      window.SITE_NEWS = news;
      if (SA && SA.isAdmin && SA.isAdmin()) {
        localStorage.setItem("og-catalog-draft", JSON.stringify({ games: games, news: news }));
      }
    } catch (e) {}
  }
  function save() {
    try {
      localStorage.setItem("og-vault-v1", JSON.stringify({ favorites: state.favs, recents: state.recents }));
    } catch (e) {}
  }

  /* Play and hover demos load from the local games/ folder next to index.html. */
  /* Each game has a real indexable landing page at game/<slug>.html. The grid
   * links to it so a crawler can reach all 29 of them; a visitor still plays
   * by tapping the cover, which never navigates. */
  /* A cover that 404s otherwise renders as a broken-image icon with the alt
   * text spilling across the tile. Draw a lettered placeholder instead so the
   * grid still looks deliberate, and tag the tile so a missing file is easy to
   * spot in devtools. */
  window.OG_COVER_FALLBACK = function (img) {
    if (!img || img.dataset.ogFallback) return;
    img.dataset.ogFallback = "1";
    var card = img.closest(".cartridge");
    var title = (img.getAttribute("alt") || "?").trim();
    var initials = title.split(/\s+/).slice(0, 2).map(function (w) {
      return w.charAt(0).toUpperCase();
    }).join("");
    // Stable hue per title so the same game always gets the same colour.
    var h = 0;
    for (var i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="hsl(' + h + ',45%,26%)"/>' +
          '<stop offset="1" stop-color="hsl(' + ((h + 40) % 360) + ',50%,14%)"/>' +
        "</linearGradient></defs>" +
        '<rect width="320" height="200" fill="url(#g)"/>' +
        '<text x="160" y="118" text-anchor="middle" font-family="Chakra Petch,sans-serif" ' +
          'font-size="72" font-weight="700" fill="rgba(255,255,255,.82)">' + initials + "</text>" +
      "</svg>";
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    img.alt = title;
    if (card) card.setAttribute("data-cover-missing", "1");
    if (window.console && console.warn) {
      console.warn("[offlinegames] cover missing for \"" + title + "\" - upload it to /covers/");
    }
  };

  function slugify(t) {
    return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function playUrl(embed) {
    if (!embed) return "";
    if (/^https?:\/\//i.test(embed)) return embed;
    var path = String(embed).replace(/^\.\//, "").replace(/^\//, "");
    if (path.indexOf("games/") !== 0) path = "games/" + path;
    if (!/\.[a-z0-9]+$/i.test(path)) {
      if (path.charAt(path.length - 1) !== "/") path += "/";
    }
    return path.split("/").map(function (part) {
      return encodeURIComponent(part);
    }).join("/");
  }

  function catalogLabel(n) { return ""; } // GV codes removed per request
  function isNew(d) {
    var t = new Date(d).getTime();
    return !isNaN(t) && Date.now() - t < 7 * 24 * 60 * 60 * 1000;
  }
  function uniqueCats() {
    var order = ["Arcade","Puzzle","Skill","Racing","Shooting","Fighting","Chess","Mind","Music","Drawing"];
    var have = {};
    games.forEach(function (g) { have[g.category] = true; });
    return order.filter(function (c) { return have[c]; }).concat(
      Object.keys(have).filter(function (c) { return order.indexOf(c) < 0; }).sort()
    );
  }
  function filtered() {
    var q = state.search.trim().toLowerCase();
    return games.filter(function (g) {
      if (state.category === "Favorites") return state.favs.indexOf(g.id) >= 0;
      if (state.category !== "All" && g.category !== state.category) return false;
      if (q && g.title.toLowerCase().indexOf(q) < 0 && (g.description || "").toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (b.catalog || 0) - (a.catalog || 0); });
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({
        "&": "&" + "amp;",
        "<": "&" + "lt;",
        ">": "&" + "gt;",
        '"': "&" + "quot;",
        "'": "&#39;"
      })[c];
    });
  }

  var warm = {};
  function warmup(url) {
    if (touchUI) return;
    if (!url || warm[url] || Object.keys(warm).length > 12) return;
    var l = document.createElement("link");
    l.rel = "prefetch"; l.href = url;
    document.head.appendChild(l);
    warm[url] = l;
  }


  function gameKey(g) { return playUrl(g.embedUrl); }
  function cachedMap() {
    try { return JSON.parse(localStorage.getItem("og-cached-games") || "{}"); }
    catch (e) { return {}; }
  }
  function isCached(g) { return !!(g && cachedMap()[gameKey(g)]); }
  function markCached(g) {
    var map = cachedMap();
    map[gameKey(g)] = Date.now();
    localStorage.setItem("og-cached-games", JSON.stringify(map));
  }
  function ensureDlCss() {
    if (document.getElementById("og-dl-css")) return;
    var s = document.createElement("style");
    s.id = "og-dl-css";
    s.textContent = ".play.need-land iframe{top:50%!important;left:50%!important;width:100dvh!important;height:100dvw!important;transform:translate(-50%,-50%) rotate(90deg)!important;transform-origin:center center!important}.play.need-port iframe{top:50%!important;left:50%!important;width:100dvh!important;height:100dvw!important;transform:translate(-50%,-50%) rotate(-90deg)!important;transform-origin:center center!important}.cartridge.needs-dl .cover{outline:0}"
      + ".dl-flag{position:absolute;right:8px;bottom:8px;z-index:4;width:28px;height:28px;border-radius:50%;"
      + "background:#111319;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;"
      + "box-shadow:0 2px 8px rgba(0,0,0,.4)}"
      + ".dl-flag.blocked{background:#ff4fa0}"
      + ".cartridge.downloading .cover::after{content:'Downloading…';position:absolute;inset:0;background:rgba(9,10,22,.72);"
      + "color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;z-index:5;font-size:13px}"
      + ".og-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111319;color:#fff;"
      + "padding:10px 16px;border-radius:999px;z-index:80;font-size:13px}";
    document.head.appendChild(s);
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "og-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  /* games-manifest.json lists every file each game needs. Reading the game's
     HTML for src/href misses everything loaded from JavaScript — most of the
     art and audio in the larger games — so those games looked "saved" but
     still failed without a connection. */
  var manifest = null, manifestTried = false;
  function loadManifest() {
    if (manifest || manifestTried) return Promise.resolve(manifest);
    manifestTried = true;
    return fetch("games-manifest.json").then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { manifest = j; return j; }).catch(function () { return null; });
  }
  function manifestKey(g) { return String(g.embedUrl || "").replace(/^\/+/, "").replace(/\/$/, ""); }
  function gameBytes(g) { var e = manifest && manifest[manifestKey(g)]; return e ? e.bytes : 0; }

  // Fetch a list of files a few at a time so one game cannot flood the network.
  function fetchAll(urls, parallel) {
    var i = 0, failures = 0;
    function worker() {
      if (i >= urls.length) return Promise.resolve();
      var u = urls[i++];
      return fetch(u).then(function (r) { if (!r || !r.ok) failures++; })
        .catch(function () { failures++; })
        .then(worker);
    }
    var lanes = [];
    for (var k = 0; k < Math.min(parallel || 3, urls.length); k++) lanes.push(worker());
    return Promise.all(lanes).then(function () { return failures; });
  }

  function downloadGame(g) {
    return loadManifest().then(function () {
      var entry = manifest && manifest[manifestKey(g)];
      if (entry && entry.files && entry.files.length) {
        return fetchAll(entry.files.slice(), 3).then(function (failures) {
          // Allow the odd missing file rather than never marking a game saved.
          if (failures <= Math.max(1, Math.floor(entry.files.length * 0.05))) markCached(g);
        });
      }
      // No manifest (older build): fall back to reading the game's HTML.
      var url = playUrl(g.embedUrl);
      return fetch(url).then(function (res) { return res.text(); }).then(function (html) {
        var extras = [];
        html.replace(/(?:src|href)=["']([^"']+)["']/g, function (_, u) {
          if (/^(data:|mailto:|javascript:|#)/i.test(u)) return;
          try { extras.push(new URL(u, url).href); } catch (e) {}
        });
        extras = extras.filter(function (u, i, a) { return a.indexOf(u) === i; }).slice(0, 60);
        return fetchAll(extras, 3);
      }).then(function () { markCached(g); });
    });
  }

  function isOgWebView(){ return /; wv\)/.test(navigator.userAgent||'') || /WebView/i.test(navigator.userAgent||''); }
  var prefetching = false;
  function setSaveStatus(text) {
    var el = document.getElementById("og-save-status");
    if (!text) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "og-save-status";
      el.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#111319;color:#e8ecf4;padding:8px 14px;border-radius:999px;z-index:70;font-size:12px;opacity:.92";
      document.body.appendChild(el);
    }
    el.textContent = text;
  }
  /* Saving games for offline used to start immediately and fetch all of them
     back to back, which competed with the page the visitor was actually
     looking at — worst on a weak connection, where it made everything crawl.
     Now it waits until the page is quiet, skips slow or data-saving
     connections entirely, pauses while a game is being played or the tab is
     hidden, and leaves a gap between games. */
  var prefetchPaused = false;
  /* Installed as an app (Play Store / Add to Home Screen / desktop install):
     the visitor asked for an offline games app, so save everything. In a
     normal browser tab, save a useful handful instead of ~48 MB uninvited. */
  function isInstalledApp() {
    try {
      if (navigator.standalone === true) return true;
      if (document.referrer.indexOf("android-app://") === 0) return true;
      if (isOgWebView()) return true;
      return ["standalone", "fullscreen", "minimal-ui"].some(function (m) {
        return window.matchMedia("(display-mode: " + m + ")").matches;
      });
    } catch (e) { return false; }
  }
  var BROWSER_SAVE_LIMIT = 8;          // games saved when not installed
  function connectionUnsuitable() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return false;                       // unknown: assume it is fine
    if (c.saveData) return true;                // visitor asked to save data
    var t = c.effectiveType || "";
    if (t === "slow-2g" || t === "2g") return true;
    return t === "3g" && !isInstalledApp();     // the app may use 3G, a tab may not
  }
  function prefetchAllGames() {
    if (isOgWebView()) return;
    if (!navigator.onLine || prefetching || !games.length) return;
    if (connectionUnsuitable()) { setSaveStatus(""); return; }

    // Most useful first: what they played recently, then the newest games.
    var queue = games.filter(function (g) { return !isCached(g); }).sort(function (a, b) {
      var ra = state.recents.indexOf(a.id), rb = state.recents.indexOf(b.id);
      if (ra !== rb) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
      return String(b.dateAdded || "").localeCompare(String(a.dateAdded || ""));
    });
    if (!queue.length) { setSaveStatus(""); return; }
    var app = isInstalledApp();
    if (!app) queue = queue.slice(0, BROWSER_SAVE_LIMIT);
    if (app && navigator.storage && navigator.storage.persist) {
      // Ask the browser not to evict the saved games to reclaim space.
      try { navigator.storage.persist(); } catch (e) {}
    }
    prefetching = true;
    var done = 0, total = queue.length, gap = app ? 300 : 1200;
    setSaveStatus("Saving games 0/" + total);
    function next() {
      if (!navigator.onLine || connectionUnsuitable()) { prefetching = false; setSaveStatus(""); renderGrid(); return; }
      if (!queue.length) { prefetching = false; setSaveStatus("Games saved for offline"); setTimeout(function(){ setSaveStatus(""); }, 1600); renderGrid(); return; }
      // Wait while the visitor is playing, or the tab is in the background.
      if (prefetchPaused || document.hidden) { setTimeout(next, 2000); return; }
      var g = queue.shift();
      downloadGame(g).catch(function () {}).then(function () {
        done += 1;
        setSaveStatus("Saving games " + done + "/" + total);
        setTimeout(next, gap);                  // breathing room between games
      });
    }
    setTimeout(next, 1200);
  }

  function renderCats() {
    var cats = uniqueCats();
    var counts = {};
    games.forEach(function (g) { counts[g.category] = (counts[g.category] || 0) + 1; });
    var cards = [{ name: "All", label: "All games", count: games.length }].concat(
      cats.map(function (c) { return { name: c, label: c + " games", count: counts[c] || 0 }; })
    );
    if (state.favs.length) cards.push({ name: "Favorites", label: "Favorites", count: state.favs.length });
    var grid = document.getElementById("cat-grid");
    if (!grid) return;
    grid.innerHTML = cards.map(function (c) {
      return '<button type="button" class="cat-card' + (c.name === state.category ? " active" : "") + '" data-cat="' + esc(c.name) + '">' +
        '<span class="cat-ico">' + (icons[c.name] || "▦") + "</span>" +
        "<div><b class=\"full\">" + esc(c.label) + "</b><b class=\"short\">" + esc(c.name) + "</b><span>" + c.count + "</span></div></button>";
    }).join("");
    grid.classList.toggle("open", state.catsOpen);
    var btn = document.getElementById("cat-btn");
    if (btn) btn.classList.toggle("open", state.catsOpen);
    var heading = document.getElementById("cat-heading");
    if (heading) {
      if (!state.catsOpen && state.category !== "All") {
        heading.hidden = false;
        heading.querySelector("h2").textContent = state.category + " games";
      } else heading.hidden = true;
    }
    var gameGrid = document.getElementById("game-grid");
    var hints = document.getElementById("khints");
    if (gameGrid) gameGrid.style.display = state.catsOpen ? "none" : "";
    if (hints) hints.style.display = state.catsOpen ? "none" : "";
  }

  function renderGrid() {
    var list = filtered();
    var grid = document.getElementById("game-grid");
    var empty = document.getElementById("empty");
    if (!grid) return;
    if (!games.length) {
      grid.innerHTML = "";
      if (empty) {
        empty.hidden = false;
        empty.innerHTML = "<h2>No games loaded.</h2><p>Keep <b>catalog.js</b>, <b>app.js</b>, and your <b>games/</b> folder next to index.html.</p>";
      }
      return;
    }
    if (!list.length) {
      grid.innerHTML = "";
      if (empty) { empty.hidden = false; empty.innerHTML = "<h2>Nothing matches.</h2>"; }
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = list.map(function (g) {
      var fav = state.favs.indexOf(g.id) >= 0;
      var admin = SA && SA.isAdmin();
      var adminBtns = admin
        ? '<div class="cart-admin-actions">' +
            '<button type="button" class="icon-btn" data-edit="' + esc(g.id) + '" title="Edit">✎</button>' +
            '<button type="button" class="icon-btn danger" data-del="' + esc(g.id) + '" title="Delete">✕</button>' +
          "</div>"
        : "";
      return '<article class="cartridge' + ((!navigator.onLine && !isCached(g)) ? ' needs-dl' : '') + '" data-id="' + esc(g.id) + '" tabindex="0" aria-label="Play ' + esc(g.title) + '">' +
        (isNew(g.dateAdded) ? '<span class="new-ribbon">New</span>' : "") +
        adminBtns +
        '<button type="button" class="heart' + (fav ? " on" : "") + '" data-fav="' + esc(g.id) + '" aria-label="Favorite">♥</button>' +
        '<div class="cover" data-embed="' + esc(playUrl(g.embedUrl)) + '">' +
          '<img src="' + esc(g.coverUrl) + '" alt="' + esc(g.title) + '" loading="lazy" decoding="async" width="320" height="200" onerror="OG_COVER_FALLBACK(this)">' +
          '<div class="demo"></div>' +
          ((!navigator.onLine && !isCached(g)) ? '<span class="dl-flag blocked" title="Needs Wi‑Fi to download">⬇</span>' : '') +
        "</div>" +
        '<div class="stripe"></div>' +
        '<div class="cart-body"><h3 class="cart-title">' + esc(g.title) + "</h3>" +
        '<p class="cart-desc">' + esc(g.description) + "</p>" +
        '<div class="cart-meta"><span class="badge">' + esc(g.category) + '</span>' +
        (g.rating ? '<span class="badge rating rating-' + esc(String(g.rating).toLowerCase().replace(/[^a-z0-9]+/g, "-")) + '" title="Content rating">' + esc(g.rating) + '</span>' : '') +
        '' +
        '<a class="cart-more" href="play/' + slugify(g.title) + '" aria-label="About ' + esc(g.title) + '">Details</a>' +
        "</div></div></article>";
    }).join("");
  }

  function renderNews() {
    var el = document.getElementById("news-grid");
    if (!el) return;
    var sorted = news.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    el.innerHTML = (SA && SA.isAdmin()
      ? '<button type="button" class="add-news-card" id="btn-add-news"><span>＋</span><span>Add News Post</span></button>'
      : "") + sorted.map(function (n) {
      var d = new Date(n.date);
      var ds = isNaN(d) ? n.date : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      var admin = SA && SA.isAdmin()
        ? '<div class="cart-admin-actions">' +
            '<button type="button" class="icon-btn" data-news-edit="' + esc(n.id) + '" title="Edit">✎</button>' +
            '<button type="button" class="icon-btn danger" data-news-del="' + esc(n.id) + '" title="Delete">✕</button>' +
          "</div>"
        : "";
      return '<article class="news-card" data-news-id="' + esc(n.id) + '" tabindex="0">' + admin + '<div class="thumb">' +
        (n.image ? '<img src="' + esc(n.image) + '" alt="">' : "✦") +
        '</div><div class="body"><span class="badge date">' + esc(ds) + "</span><h3>" + esc(n.title) + "</h3><p>" + esc(n.excerpt) + "</p></div></article>";
    }).join("");
    var addNews = document.getElementById("btn-add-news");
    if (addNews) addNews.addEventListener("click", function () { openNewsForm(null); });
  }

  function gameOrient(g) {
    if (g && (g.orient === "landscape" || g.orient === "portrait")) return g.orient;
    var blob = (((g && g.embedUrl) || "") + " " + ((g && g.title) || "") + " " + ((g && g.id) || "")).toLowerCase();
    if (/umbra|impossible[\s\-]*master|apex[\s\-]*drift|dead[\s\-]*streets|8[\s\-]*ball|flingwing|pop[\s\-]*a[\s\-]*lock/.test(blob)) {
      return "landscape";
    }
    return "portrait";
  }
  var currentOrient = "unlock";
  function isPhone() {
    try {
      if (/Android|iPhone|iPad|Mobile|; wv\)/i.test(navigator.userAgent||"")) return true;
      return matchMedia("(pointer: coarse)").matches || window.innerWidth < 900;
    } catch (e) {
      return window.innerWidth < 900;
    }
  }
  function applyWebOrient() {
    var play = document.getElementById("play");
    if (!play) return;
    play.classList.remove("need-land", "need-port");
    if (!play.classList.contains("open") || currentOrient === "unlock" || !isPhone()) return;
    var type = "";
    try { type = (screen.orientation && screen.orientation.type) || ""; } catch (e) {}
    var portrait = window.innerHeight > window.innerWidth + 20;
    if (type.indexOf("landscape") === 0) portrait = false;
    if (type.indexOf("portrait") === 0) portrait = true;
    if (currentOrient === "landscape" && portrait) play.classList.add("need-land");
    if (currentOrient === "portrait" && !portrait) play.classList.add("need-port");
  }
  function lockOrient(mode) {
    currentOrient = mode || "unlock";
    try {
      if (window.OfflineGamesAds) {
        if (mode === "landscape" && OfflineGamesAds.lockLandscape) OfflineGamesAds.lockLandscape();
        else if (mode === "portrait" && OfflineGamesAds.lockPortrait) OfflineGamesAds.lockPortrait();
        else if (mode === "unlock" && OfflineGamesAds.unlockOrientation) OfflineGamesAds.unlockOrientation();
      }
    } catch (e) {}
    try {
      if (mode === "unlock") {
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      } else {
        try {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock(mode === "landscape" ? "landscape" : "portrait").catch(function () {});
          }
        } catch (e2) {}
      }
    } catch (e) {}
    applyWebOrient();
  }
  window.addEventListener("resize", applyWebOrient);
  window.addEventListener("orientationchange", function () { setTimeout(applyWebOrient, 60); setTimeout(applyWebOrient, 280); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", applyWebOrient);
  function freshPlayFrame() {
    var old = document.getElementById("play-frame");
    if (!old || !old.parentNode) return old;
    var neu = old.cloneNode(false);
    neu.removeAttribute("src");
    old.parentNode.replaceChild(neu, old);
    return neu;
  }
  function openPlay(g) {
    try {
      if (window.OfflineGamesAds && OfflineGamesAds.showInterstitial) OfflineGamesAds.showInterstitial();
    } catch (e) {}
    stopOtherDemos(null);
    state.recents = [g.id].concat(state.recents.filter(function (x) { return x !== g.id; })).slice(0, 8);
    save();
    var frame = document.getElementById("play");
    var iframe = freshPlayFrame() || document.getElementById("play-frame");
    iframe.src = playUrl(g.embedUrl);
    frame.classList.add("open");
    document.body.style.overflow = "hidden";
    lockOrient(gameOrient(g));
    currentGame = g;
    try { window.dispatchEvent(new CustomEvent("og:play", { detail: g })); } catch (e) {}
  }
  var currentGame = null;
  function playGame(id) {
    var g = games.find(function (x) { return x.id === id; });
    if (!g) return;
    ensureDlCss();
    if (!navigator.onLine && !isCached(g)) {
      toast("This game is not saved. Turn on Wi‑Fi to download it.");
      return;
    }
    if (navigator.onLine && !isCached(g)) downloadGame(g).catch(function () {});
    openPlay(g);
  }
  function closePlay() {
    var play = document.getElementById("play");
    if (!play) return;
    play.classList.remove("open");
    freshPlayFrame();
    document.body.style.overflow = "";
    lockOrient("unlock");
    var closed = currentGame; currentGame = null;
    if (closed) { try { window.dispatchEvent(new CustomEvent("og:close", { detail: closed })); } catch (e) {} }
  }

  function openNewsDetail(id) {
    var n = news.find(function (x) { return x.id === id; });
    var box = document.getElementById("news-open");
    if (!n || !box) return;
    var img = document.getElementById("news-open-img");
    if (img) {
      if (n.image) { img.src = n.image; img.hidden = false; }
      else { img.removeAttribute("src"); img.hidden = true; }
    }
    var t = document.getElementById("news-open-title");
    if (t) t.textContent = n.title || "";
    var dEl = document.getElementById("news-open-date");
    if (dEl) {
      var d = new Date(n.date);
      dEl.textContent = isNaN(d) ? (n.date || "") : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }
    var b = document.getElementById("news-open-body");
    if (b) b.textContent = n.excerpt || n.body || "";
    box.classList.add("open");
  }
  function closeNewsDetail() {
    var box = document.getElementById("news-open");
    if (box) box.classList.remove("open");
  }

  var demoTimer = 0, demoKill = 0;
  function attachDemo(cover) {
    if (touchUI) return;
    var url = cover.getAttribute("data-embed");
    if (!url) return;
    stopOtherDemos(cover);                // only one live preview at a time
    var demo = cover.querySelector(".demo");
    if (!demo.querySelector("iframe")) {
      var f = document.createElement("iframe");
      f.tabIndex = -1;
      f.setAttribute("sandbox", "allow-scripts allow-same-origin");
      f.src = url;
      demo.appendChild(f);
      var fit = function () {
        var w = cover.clientWidth;
        if (w) f.style.transform = "scale(" + (w / 960) + ")";
      };
      fit();
      cover.classList.add("playing");
      f.addEventListener("load", function () { cover.classList.add("playing"); });
    } else cover.classList.add("playing");
  }

  function stopOtherDemos(except) {
    document.querySelectorAll("#game-grid .cover.playing").forEach(function (c) {
      if (c === except) return;
      c.classList.remove("playing");
      var f = c.querySelector("iframe");
      if (f) { f.src = "about:blank"; f.remove(); }
    });
  }


  function showPanel(name) {
    name = name || "vault";
    /* Panel-dependent furniture: visible on the vault, hidden elsewhere. */
    var vaultBits = document.querySelectorAll(".hero, .cat-btn, #cat-grid, #game-grid, #khints, .about-strip");
    vaultBits.forEach(function (el) { if (el) el.hidden = name !== "vault"; });

    /* #empty and #cat-heading are STATE-dependent, not panel-dependent.
     *
     * They used to sit in the list above, which meant returning to the vault
     * set hidden = false on both unconditionally — revealing the "Nothing
     * matches." placeholder baked into index.html, and an empty category
     * heading with a stray "Show all" button, while a full grid of games sat
     * right underneath. renderGrid() and renderCats() are the only things that
     * know whether those belong on screen, so hide them here and let those two
     * decide when we land back on the vault. */
    ["empty", "cat-heading"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    if (name === "vault") { renderCats(); renderGrid(); }
    /* WAS: a map of seven in-page panels (about / guides / contact /
     * privacy / terms / news), each duplicating the full text of a standalone
     * .html page that also exists. That put ~250 lines of hidden duplicate
     * content on the site's most important URL. The panels are gone; the nav
     * links to the real pages. #news stays visible on the vault as a preview
     * strip -- it is generated from catalog.js, not duplicated prose. */
    document.querySelectorAll(".top-nav a[data-panel]").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-panel") === name);
    });
    try { window.scrollTo(0, 0); } catch (e) {}
    try {
      var want = name === "vault" ? (location.pathname || "/") : (location.pathname || "/") + "#" + name;
      if (location.hash.replace("#","") !== (name === "vault" ? "" : name)) {
        history.replaceState(null, "", want);
      }
    } catch (e) {}
  }
  function bind() {

    /* WAS: a delegated click handler that called preventDefault() on any link
     * whose href contained "about.html", "contact.html", etc, and opened an
     * in-page panel instead. With the panels removed that would have made
     * every nav and footer link dead. Links now navigate normally. */

    /* Old bookmarks and inbound links still point at index.html#about and
     * friends. Send them to the real page rather than showing a blank vault. */
    var LEGACY = {
      about: "about.html", guides: "guides.html",
      contact: "contact.html", privacy: "privacy.html", terms: "terms.html",
      news: "news.html"
    };
    function routeLegacyHash() {
      var h = (location.hash || "").replace(/^#/, "").toLowerCase();
      if (LEGACY[h]) { location.replace(LEGACY[h]); return true; }
      return false;
    }
    /* game/<slug>.html links back as index.html#play-<id>. Launch it. */
    function routePlayHash() {
      var h = (location.hash || "").replace(/^#/, "");
      if (h.indexOf("play-") !== 0) return false;
      var id = h.slice(5);
      try { history.replaceState(null, "", location.pathname); } catch (e) {}
      if (games.some(function (g) { return g.id === id; })) { playGame(id); return true; }
      return false;
    }

    if (!routeLegacyHash()) {
      showPanel("vault");
      setTimeout(routePlayHash, 0);
    }
    window.addEventListener("hashchange", function () {
      if (!routeLegacyHash()) routePlayHash();
    });

    window.addEventListener("online", function () { ensureDlCss(); renderGrid(); prefetchAllGames(); });
    window.addEventListener("offline", function (e) {
      try { if (e && e.preventDefault) e.preventDefault(); } catch (err) {}
      ensureDlCss();
      renderGrid();
    });
    ensureDlCss();

    var catBtn = document.getElementById("cat-btn");
    if (catBtn) catBtn.addEventListener("click", function () {
      state.catsOpen = !state.catsOpen;
      renderCats();
    });
    var catGrid = document.getElementById("cat-grid");
    if (catGrid) catGrid.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      state.category = b.getAttribute("data-cat");
      state.catsOpen = false;
      renderCats();
      renderGrid();
    });
    var showAll = document.getElementById("show-all");
    if (showAll) showAll.addEventListener("click", function () {
      state.category = "All";
      renderCats();
      renderGrid();
    });
    var search = document.getElementById("search");
    /* og-qparam: /?q=chess deep-links straight into a filtered vault, which is
       also what the sitelinks search box in Google results uses. */
    try {
      var q0 = new URLSearchParams(location.search).get("q");
      if (q0 && search) { search.value = q0; state.search = q0; }
    } catch (e) {}
    var search = document.getElementById("search");
    if (search) search.addEventListener("input", function (e) {
      state.search = e.target.value;
      state.catsOpen = false;
      renderCats();
      renderGrid();
    });
    var coin = document.getElementById("insert-coin");
    if (coin) coin.addEventListener("click", randomPick);
    var spot = document.getElementById("spotlight");
    if (spot) spot.addEventListener("click", function () { playGame(spot.getAttribute("data-id")); });
    var gameGrid = document.getElementById("game-grid");
    if (gameGrid) {
      gameGrid.addEventListener("click", function (e) {
        var edit = e.target.closest("[data-edit]");
        if (edit) {
          e.stopPropagation();
          openGameForm(games.find(function (g) { return g.id === edit.getAttribute("data-edit"); }));
          return;
        }
        var del = e.target.closest("[data-del]");
        if (del) {
          e.stopPropagation();
          openConfirmDeleteGame(games.find(function (g) { return g.id === del.getAttribute("data-del"); }));
          return;
        }
        var fav = e.target.closest("[data-fav]");
        if (fav) {
          e.stopPropagation();
          var id = fav.getAttribute("data-fav");
          var i = state.favs.indexOf(id);
          if (i >= 0) state.favs.splice(i, 1); else state.favs.push(id);
          save();
          renderCats();
          renderGrid();
          return;
        }
        /* The Details link navigates to the game's own page. Without this the
         * click bubbles to the card handler below and launches the game
         * instead, so the link looked dead. */
        if (e.target.closest(".cart-more")) return;

        var card = e.target.closest("[data-id]");
        if (card) playGame(card.getAttribute("data-id"));
      });
      gameGrid.addEventListener("mouseover", function (e) {
        if (touchUI) return;
        var cover = e.target.closest && e.target.closest(".cover");
        if (!cover) return;
        clearTimeout(demoKill);
        if (cover.classList.contains("playing")) return;
        // Hover intent: sweeping the mouse across the grid starts nothing.
        clearTimeout(demoTimer);
        demoTimer = setTimeout(function () { if (cover.matches(":hover")) attachDemo(cover); }, 380);
      });
      gameGrid.addEventListener("mouseout", function (e) {
        if (touchUI) return;
        var cover = e.target.closest && e.target.closest(".cover");
        if (!cover) return;
        if (cover.contains(e.relatedTarget)) return;
        clearTimeout(demoTimer);
        // Short grace period so brushing past the edge doesn't reload it.
        clearTimeout(demoKill);
        demoKill = setTimeout(function () { stopOtherDemos(null); }, 250);
      });
      // Scrolling away or switching tabs ends any preview immediately.
      window.addEventListener("scroll", function () { if (!touchUI) { clearTimeout(demoTimer); stopOtherDemos(null); } }, { passive: true });
      document.addEventListener("visibilitychange", function () { if (document.hidden) stopOtherDemos(null); });
    }
    var playBack = document.getElementById("play-back");
    if (playBack) playBack.addEventListener("click", closePlay);
    window.addEventListener("message", function (e) {
      if (e && e.data && e.data.og === "back") closePlay();
    });
    var newsClose = document.getElementById("news-open-close");
    if (newsClose) newsClose.addEventListener("click", closeNewsDetail);
    var newsOpen = document.getElementById("news-open");
    if (newsOpen) newsOpen.addEventListener("click", function (e) {
      if (e.target === newsOpen) closeNewsDetail();
    });
    var newsGrid = document.getElementById("news-grid");
    if (newsGrid) newsGrid.addEventListener("click", function (e) {
      var ed = e.target.closest("[data-news-edit]");
      if (ed) {
        openNewsForm(news.find(function (n) { return n.id === ed.getAttribute("data-news-edit"); }));
        return;
      }
      var dl = e.target.closest("[data-news-del]");
      if (dl) {
        openConfirmDeleteNews(news.find(function (n) { return n.id === dl.getAttribute("data-news-del"); }));
        return;
      }
      var card = e.target.closest("[data-news-id]");
      if (card) openNewsDetail(card.getAttribute("data-news-id"));
    });
    var addBtn = document.getElementById("btn-add-game");
    if (addBtn) addBtn.addEventListener("click", function () { openGameForm(null); });
    var saveBtn = document.getElementById("btn-save-exit");
    if (saveBtn) saveBtn.addEventListener("click", openDownloadPrompt);
    window.addEventListener("hashchange", maybeHandleAdmin);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePlay();
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
        if (search) search.focus();
      }
      if ((e.key === "r" || e.key === "R") && document.activeElement.tagName !== "INPUT") {
        randomPick();
      }
    });
  }

  function nextCatalogNumber() {
    var max = 0;
    games.forEach(function (g) { if ((g.catalog || 0) > max) max = g.catalog; });
    return max + 1;
  }
  /* Exposed unconditionally: admin-boot.js calls this after a successful
     sign-in. Tying it to the #admin06 hash was fragile, because the hash is
     cleared as soon as it is read. */
  window.OG_REFRESH_ADMIN = function () { refreshAdminUI(); };
  function refreshAdminUI() {
    var on = !!(SA && SA.isAdmin());
    var add = document.getElementById("btn-add-game");
    var save = document.getElementById("btn-save-exit");
    if (add) add.hidden = !on;
    if (save) save.hidden = !on;
    renderCats();
    renderGrid();
    renderNews();
    featured();
    persistCatalog();
  }
  function maybeHandleAdmin() {
    if (!SA) return;
    if (location.hash !== "#admin06") return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    /* The sign-in modal has to open AFTER the rest of the page has finished
       building. console-ui.js rebuilds the layout once it loads, which used to
       throw away a modal opened during parsing — so the prompt never appeared. */
    /* admin-boot.js opens the sign-in prompt once the page has settled. */
    if (SA.isAdmin()) refreshAdminUI();
  }
  function openGameForm(existing) {
    window.AdminForms.openGameForm(existing, games, function (record, isNew) {
      if (isNew) games.push(record);
      else {
        var idx = games.findIndex(function (x) { return x.id === record.id; });
        if (idx >= 0) games[idx] = record;
      }
      refreshAdminUI();
      SA.showToast("Saved — click Save & exit, then replace catalog.js.");
    });
  }
  function openConfirmDeleteGame(game) {
    if (!game) return;
    window.AdminForms.confirmDelete(game.title, function () {
      games = games.filter(function (x) { return x.id !== game.id; });
      refreshAdminUI();
    });
  }
  function openNewsForm(existing) {
    window.AdminForms.openNewsForm(existing, function (record, isNew) {
      if (isNew) news.push(record);
      else {
        var idx = news.findIndex(function (x) { return x.id === record.id; });
        if (idx >= 0) {
          news[idx] = record;
        } else if (existing) {
          existing.image = record.image;
        }
      }
      persistCatalog();
      refreshAdminUI();
      SA.showToast("What's new picture saved. Click Save & exit to download catalog.js.");
    });
  }
  function openConfirmDeleteNews(article) {
    if (!article) return;
    window.AdminForms.confirmDelete(article.title, function () {
      news = news.filter(function (x) { return x.id !== article.id; });
      refreshAdminUI();
    });
  }
  function openDownloadPrompt() {
    window.AdminForms.downloadCatalog(games, news);
  }

  function randomPick() {
    var list = filtered();
    if (!list.length) list = games;
    if (!list.length) return;
    var g = list[Math.floor(Math.random() * list.length)];
    var picker = document.getElementById("picker");
    document.getElementById("picker-img").src = g.coverUrl;
    document.getElementById("picker-title").textContent = g.title;
    document.getElementById("picker-meta").textContent = g.category;
    picker.classList.add("open");
    document.getElementById("picker-play").onclick = function () {
      picker.classList.remove("open");
      playGame(g.id);
    };
    document.getElementById("picker-close").onclick = function () { picker.classList.remove("open"); };
  }

  function cursor() {}

  function featured() {
    var g = games.slice().sort(function (a, b) { return (b.catalog || 0) - (a.catalog || 0); })[0];
    if (!g) return;
    var spot = document.getElementById("spotlight");
    if (!spot) return;
    spot.setAttribute("data-id", g.id);
    var img = spot.querySelector("img");
    if (img) img.src = g.coverUrl;
    var strong = spot.querySelector("strong");
    if (strong) strong.textContent = g.title;
    var em = spot.querySelector("em");
    if (em) em.textContent = g.category;
  }

  renderCats();
  renderGrid();
  renderNews();
  featured();
  bind();
  window.addEventListener("online", function () { setTimeout(prefetchAllGames, 2000); });
  window.addEventListener("og:play", function () { prefetchPaused = true; });
  window.addEventListener("og:close", function () { prefetchPaused = false; });
  // Start well after first paint, when the browser is idle.
  (function startPrefetch() {
    var go = function () { setTimeout(prefetchAllGames, isInstalledApp() ? 1500 : 4000); };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go);
  })();
  cursor();
  maybeHandleAdmin();
  refreshAdminUI();
  setTimeout(function () {
    if (touchUI) return;
    games.slice().sort(function (a, b) { return (b.catalog || 0) - (a.catalog || 0); })
      .slice(0, 4).forEach(function (g) { warmup(playUrl(g.embedUrl)); });
  }, 800);

  function catalogFp(list) {
    return (list || []).map(function (g) { return g.id + ":" + (g.title || ""); }).join("|");
  }
  var seenFp = catalogFp(games);
  function pollCatalog() {
    if (SA && SA.isAdmin()) return;
    var play = document.getElementById("play");
    if (play && play.classList.contains("open")) return;
    fetch("catalog.js?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var fake = {};
        (new Function("window", text))(fake);
        var next = fake.SITE_GAMES;
        if (!next || !next.length) return;
        var fp = catalogFp(next);
        if (fp === seenFp) return;
        games = next.slice();
        if (fake.SITE_NEWS && fake.SITE_NEWS.length) news = fake.SITE_NEWS.slice();
        seenFp = fp;
        window.SITE_GAMES = games;
        window.SITE_NEWS = news;
        renderCats();
        renderGrid();
        renderNews();
        featured();
      })
      .catch(function () {});
  }
  window.OG_POLL_CATALOG = pollCatalog;
  window.OG_PLAY = function (id) { playGame(id); };
  window.OG_HANDLE_BACK = function () {
    var play = document.getElementById("play");
    if (play && play.classList.contains("open")) { closePlay(); return "handled"; }
    var picker = document.getElementById("picker");
    if (picker && picker.classList.contains("open")) { picker.classList.remove("open"); return "handled"; }
    var nd = document.getElementById("news-open");
    if (nd && nd.classList.contains("open")) { closeNewsDetail(); return "handled"; }
    var path = location.pathname || "";
    if (path !== "/" && path.indexOf("index.html") === -1) {
      location.href = "index.html";
      return "handled";
    }
    return "exit";
  };
  setInterval(pollCatalog, 15000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) pollCatalog();
  });
})();