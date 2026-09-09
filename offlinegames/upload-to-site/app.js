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
      /* window.SITE_GAMES must stay current — library-sync.js and
       * contact-panel.js read it. But the localStorage copy is only useful
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

  function catalogLabel(n) { return "GV-" + String(n || 0).padStart(4, "0"); }
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
    if (!url || warm[url] || Object.keys(warm).length > 6) return;
    var f = document.createElement("iframe");
    f.src = url;
    f.setAttribute("sandbox", "allow-scripts allow-same-origin");
    f.style.cssText = "position:fixed;left:-1200px;top:0;width:840px;height:480px;opacity:0;pointer-events:none;border:0";
    document.body.appendChild(f);
    warm[url] = f;
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
  function downloadGame(g) {
    var url = playUrl(g.embedUrl);
    return fetch(url, { cache: "reload" }).then(function (res) { return res.text(); }).then(function (html) {
      var extras = [];
      html.replace(/(?:src|href)=["']([^"']+)["']/g, function (_, u) {
        if (/^(data:|mailto:|javascript:|#)/i.test(u)) return;
        try { extras.push(new URL(u, url).href); } catch (e) {}
      });
      extras = extras.filter(function (u, i, a) { return a.indexOf(u) === i; }).slice(0, 50);
      return Promise.all(extras.map(function (u) { return fetch(u).catch(function () {}); }));
    }).then(function () { markCached(g); });
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
  function prefetchAllGames() {
    if (isOgWebView()) return;
    if (!navigator.onLine || prefetching || !games.length) return;
    prefetching = true;
    var queue = games.filter(function (g) { return !isCached(g); });
    if (!queue.length) { prefetching = false; setSaveStatus(""); return; }
    var done = 0, total = queue.length;
    setSaveStatus("Saving games 0/" + total);
    function next() {
      if (!navigator.onLine) { prefetching = false; setSaveStatus(""); renderGrid(); return; }
      if (!queue.length) { prefetching = false; setSaveStatus("Games saved for offline"); setTimeout(function(){ setSaveStatus(""); }, 1600); renderGrid(); return; }
      var g = queue.shift();
      downloadGame(g).catch(function () {}).then(function () {
        done += 1;
        setSaveStatus("Saving games " + done + "/" + total);
        next();
      });
    }
    next();
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
          '<img src="' + esc(g.coverUrl) + '" alt="' + esc(g.title) + '" loading="lazy" decoding="async" width="320" height="200">' +
          '<div class="demo"></div>' +
          ((!navigator.onLine && !isCached(g)) ? '<span class="dl-flag blocked" title="Needs Wi‑Fi to download">⬇</span>' : '') +
        "</div>" +
        '<div class="stripe"></div>' +
        '<div class="cart-body"><h3 class="cart-title">' + esc(g.title) + "</h3>" +
        '<p class="cart-desc">' + esc(g.description) + "</p>" +
        '<div class="cart-meta"><span class="badge">' + esc(g.category) + '</span><span class="gv">' + catalogLabel(g.catalog) + "</span></div></div></article>";
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
  }
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

  function attachDemo(cover) {
    if (touchUI) return;
    var url = cover.getAttribute("data-embed");
    if (!url) return;
    warmup(url);
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
    var map = {
      news: "news",
      about: "about-page",
      library: "library-page",
      guides: "guides-page",
      contact: "contact-page",
      privacy: "privacy-page",
      terms: "terms-page"
    };
    Object.keys(map).forEach(function (key) {
      var el = document.getElementById(map[key]);
      if (el) el.hidden = name !== key;
    });
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

    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a");
      if (!a) return;
      var href = (a.getAttribute("href") || "").toLowerCase();
      var panel = a.getAttribute("data-panel");
      if (panel === "vault" || href === "#vault" || href === "index.html" || href === "./" || href === "/") {
        if (a.closest(".top-nav") || href === "#vault") { e.preventDefault(); showPanel("vault"); }
        return;
      }
      var pages = ["news","about","library","guides","contact","privacy","terms"];
      var n;
      for (n = 0; n < pages.length; n++) {
        var pg = pages[n];
        if (panel === pg || href === "#" + pg || href.indexOf(pg + ".html") >= 0) {
          e.preventDefault();
          showPanel(pg);
          return;
        }
      }
    }, true);
    function currentPanel() {
      var h = (location.hash || "").replace(/^#/, "").toLowerCase();
      if (!h || h === "vault") return "vault";
      return h;
    }
    showPanel(currentPanel());
    window.addEventListener("hashchange", function () { showPanel(currentPanel()); });

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
        var card = e.target.closest("[data-id]");
        if (card) playGame(card.getAttribute("data-id"));
      });
      gameGrid.addEventListener("mouseover", function (e) {
        if (touchUI) return;
        var cover = e.target.closest && e.target.closest(".cover");
        if (cover) attachDemo(cover);
      });
      gameGrid.addEventListener("mouseout", function (e) {
        if (touchUI) return;
        var cover = e.target.closest && e.target.closest(".cover");
        if (!cover) return;
        if (cover.contains(e.relatedTarget)) return;
        cover.classList.remove("playing");
      });
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
    if (location.hash === "#admin06") {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      if (!SA.isAdmin()) SA.promptSignIn(refreshAdminUI);
      else refreshAdminUI();
    }
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
    document.getElementById("picker-meta").textContent = catalogLabel(g.catalog) + " · " + g.category;
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
    if (em) em.textContent = catalogLabel(g.catalog);
  }

  renderCats();
  renderGrid();
  renderNews();
  featured();
  bind();
  prefetchAllGames();
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