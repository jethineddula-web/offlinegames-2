/* ui-fx.js — motion layer for OfflineGames.
 *
 * Load AFTER app.js. Everything here is additive and delegated, so it keeps
 * working when app.js re-renders the grid (search, category switch, catalog
 * poll). It touches no game logic.
 *
 * All of it switches itself off if the visitor has "reduce motion" enabled.
 */
(function () {
  "use strict";

  var reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var coarse = false;
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches;
  } catch (e) {}

  // ---------------------------------------------------------------------------
  // 1. 3D tilt on cartridge covers (desktop pointers only)
  // ---------------------------------------------------------------------------
  if (!reduce && !coarse) {
    var MAX = 7; // degrees — past about 8 it stops looking like a card and
                 // starts looking like a bug

    var tiltCard = null, tiltRect = null, tiltX = 0, tiltY = 0, tiltQueued = false;
    function applyTilt() {
      tiltQueued = false;
      if (!tiltCard || !tiltRect) return;
      var px = (tiltX - tiltRect.left) / tiltRect.width  - .5;
      var py = (tiltY - tiltRect.top)  / tiltRect.height - .5;
      tiltCard.style.setProperty("--ry", (px *  MAX * 2).toFixed(2) + "deg");
      tiltCard.style.setProperty("--rx", (py * -MAX * 2).toFixed(2) + "deg");
      tiltCard.classList.add("fx-tilt");
    }
    document.addEventListener("pointermove", function (e) {
      var card = e.target.closest && e.target.closest(".cartridge");
      if (!card) return;
      if (card !== tiltCard) { tiltCard = card; tiltRect = card.getBoundingClientRect(); }
      tiltX = e.clientX; tiltY = e.clientY;
      if (!tiltQueued) { tiltQueued = true; requestAnimationFrame(applyTilt); }
    }, { passive: true });
    window.addEventListener("scroll", function () { tiltRect = tiltCard ? tiltCard.getBoundingClientRect() : null; }, { passive: true });

    document.addEventListener("pointerout", function (e) {
      var card = e.target.closest && e.target.closest(".cartridge");
      if (!card) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      if (card === tiltCard) { tiltCard = null; tiltRect = null; }
      card.classList.remove("fx-tilt");
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
    }, { passive: true });
  }

  // ---------------------------------------------------------------------------
  // 2. Ripple on buttons and menu rows
  // ---------------------------------------------------------------------------
  if (!reduce) {
    document.addEventListener("pointerdown", function (e) {
      var t = e.target.closest && e.target.closest(".btn, .cx-row, .cx-send, .cat-card");
      if (!t || t.disabled) return;

      var r = t.getBoundingClientRect();
      var size = Math.max(r.width, r.height);
      var dot = document.createElement("span");
      dot.className = "fx-ripple";
      dot.style.width = dot.style.height = size + "px";
      dot.style.left = (e.clientX - r.left - size / 2) + "px";
      dot.style.top  = (e.clientY - r.top  - size / 2) + "px";
      t.appendChild(dot);
      setTimeout(function () { dot.remove(); }, 600);
    }, { passive: true });
  }

  // ---------------------------------------------------------------------------
  // 3. Scroll reveal for the long text pages
  // ---------------------------------------------------------------------------
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("seen");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });

    function watch() {
      document.querySelectorAll(
        ".prose .card, .news-card, .about-strip, .page > .prose > p, .page > .prose > h2"
      ).forEach(function (el) {
        if (el.classList.contains("fx-reveal")) return;
        el.classList.add("fx-reveal");
        io.observe(el);
      });
    }
    watch();

    /* FAILSAFE. .fx-reveal starts at opacity:0 and only becomes visible when
     * the IntersectionObserver fires. A renderer that never scrolls -- Google's
     * crawler, the AdSense review fetch, a headless screenshot -- would see a
     * page of invisible boxes. Anything still unrevealed after 1.5s is shown
     * regardless. Costs nothing for a real visitor: by then the observer has
     * already handled everything on screen. */
    setTimeout(function () {
      document.querySelectorAll(".fx-reveal:not(.seen)").forEach(function (el) {
        el.classList.add("seen");
      });
    }, 1500);

    // app.js re-renders news; pick up anything new without polling hard.
    var newsGrid = document.getElementById("news-grid");
    if (newsGrid && "MutationObserver" in window) {
      new MutationObserver(function () { watch(); })
        .observe(newsGrid, { childList: true });
    }
    window.addEventListener("hashchange", function () { setTimeout(watch, 60); });
  }

  // ---------------------------------------------------------------------------
  // 4. Stagger indices for the category tray
  //    (CSS reads --i; without this every chip animates at the same instant)
  // ---------------------------------------------------------------------------
  var catGrid = document.getElementById("cat-grid");
  if (catGrid && "MutationObserver" in window) {
    var index = function () {
      var kids = catGrid.children;
      for (var i = 0; i < kids.length; i++) kids[i].style.setProperty("--i", i);
    };
    index();
    new MutationObserver(index).observe(catGrid, { childList: true });
  }
  // ---------------------------------------------------------------------------
  // 4b. Link repair — adds the missing ".html"
  //
  //     A plain file server (VS Code Live Server, python -m http.server, a
  //     folder opened from disk) will not turn "credits" into "credits.html".
  //     It answers "Cannot GET .../credits". Only a host with clean-URL
  //     rewriting does that, which is why the live site works and local
  //     testing does not.
  //
  //     This walks every internal link and appends ".html" when the last part
  //     of the path has no file extension. It runs on load and again whenever
  //     app.js renders new links, so game and news links are covered too.
  //
  //     Untouched: external links, mailto:, tel:, #anchors, javascript:,
  //     anything that already has an extension, and anything ending in "/".
  // ---------------------------------------------------------------------------
  (function () {
    var SKIP = /^(https?:|mailto:|tel:|javascript:|data:|#)/i;

    function repair(a) {
      var href = a.getAttribute("href");
      if (!href || SKIP.test(href)) return;

      var hash = "", query = "";
      var i = href.indexOf("#");
      if (i >= 0) { hash = href.slice(i); href = href.slice(0, i); }
      i = href.indexOf("?");
      if (i >= 0) { query = href.slice(i); href = href.slice(0, i); }

      if (!href || href.slice(-1) === "/") return;

      var last = href.split("/").pop();
      if (!last || last.indexOf(".") >= 0) return; // has an extension already

      a.setAttribute("href", href + ".html" + query + hash);
    }

    function sweep(root) {
      var links = (root || document).querySelectorAll("a[href]");
      for (var i = 0; i < links.length; i++) repair(links[i]);
    }

    sweep(document);

    if ("MutationObserver" in window) {
      var pending = false;
      new MutationObserver(function () {
        if (pending) return;
        pending = true;
        setTimeout(function () { pending = false; sweep(document); }, 0);
      }).observe(document.body, { childList: true, subtree: true });
    }
  })();

  // ---------------------------------------------------------------------------
  // 5. Left sidebar navigation (CrazyGames-style)
  //
  //    Desktop / tablet (>= 900px): a fixed left sidebar. The button at its top
  //      shrinks it to an icon rail; the choice is remembered.
  //    Phones and the Android app (< 900px): a hamburger in the top bar opens
  //      the same sidebar as a slide-in drawer. It stays out of the way of the
  //      bottom AdMob banner, which a bottom tab bar would have fought with.
  //
  //    The page's own <nav class="top-nav"> is MOVED into the sidebar rather
  //    than copied, so any click handlers app.js or contact-panel.js already
  //    attached to those links keep working. Privacy / Credits / Terms are
  //    taken from the footer so their hrefs are right at any folder depth
  //    (play/, articles/). On the vault page the categories are mirrored too.
  //
  //    For the Android app's back button (optional), MainActivity can run:
  //      window.OGSidebar && OGSidebar.isOpen() && (OGSidebar.close(), true)
  // ---------------------------------------------------------------------------
  (function () {
    var header = document.querySelector("header.top");
    var nav = header && header.querySelector(".top-nav");
    if (!header || !nav || document.getElementById("og-sb")) return;

    var root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia("(min-width: 900px)") : null;
    var RAIL_KEY = "og-sb-rail";

    var ICONS = {
      grid:    '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
      spark:   '<path d="M11 4l1.9 5.1L18 11l-5.1 1.9L11 18l-1.9-5.1L4 11l5.1-1.9z"/><path d="M18.5 3.5v3.5M16.75 5.25h3.5"/>',
      info:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 7.9v.1"/>',
      compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
      mail:    '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>',
      shield:  '<path d="M12 3.5l7 2.8v5.2c0 4.3-2.9 7.7-7 9-4.1-1.3-7-4.7-7-9V6.3z"/><path d="M9.2 12l2 2 3.8-3.8"/>',
      star:    '<path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>',
      doc:     '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.8 12.5h5.4M9.8 16h5.4"/>',
      all:     '<path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9"/>',
      dot:     '<circle cx="12" cy="12" r="3"/>',
      menu:    '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
      rail:    '<path d="M4 6.5h16M11 12h9M4 17.5h16M7.5 9.5L5 12l2.5 2.5"/>',
      close:   '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'
    };
    var ICON_FOR = {
      vault: "grid", news: "spark", about: "info", guides: "compass",
      contact: "mail", privacy: "shield", credits: "star", terms: "doc"
    };
    function svg(name, cls) {
      return '<svg class="' + (cls || "sb-ico") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        (ICONS[name] || ICONS.dot) + "</svg>";
    }

    // "news", "/news", "../news.html", "news.html#x" -> "news";  "/", "../index.html" -> "vault"
    function keyOf(href) {
      var h = String(href || "").split(/[?#]/)[0].replace(/\/+$/, "");
      var seg = (h.split("/").pop() || "").replace(/\.html?$/i, "").toLowerCase();
      return (seg === "" || seg === "index" || seg === "." || seg === "..") ? "vault" : seg;
    }

    function decorate(a) {
      if (a.querySelector(".sb-ico")) return;
      var label = (a.textContent || "").trim();
      a.innerHTML = svg(ICON_FOR[keyOf(a.getAttribute("href"))]) + '<span class="sb-text"></span>';
      a.querySelector(".sb-text").textContent = label;
      a.setAttribute("data-label", label);
    }

    function button(cls, iconName, label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.innerHTML = svg(iconName, "");
      b.setAttribute("aria-label", label);
      return b;
    }

    // --- build ---------------------------------------------------------------
    var sb = document.createElement("aside");
    sb.className = "sb";
    sb.id = "og-sb";
    sb.tabIndex = -1;
    sb.setAttribute("aria-label", "Site menu");

    var head = document.createElement("div");
    head.className = "sb-head";
    var toggle = button("sb-toggle", "rail", "Collapse menu");
    var closeBtn = button("sb-close", "close", "Close menu");
    head.appendChild(toggle);
    var brandSrc = header.querySelector(".brand");
    if (brandSrc) {
      var brand = brandSrc.cloneNode(true);
      brand.removeAttribute("id");
      brand.classList.add("sb-brand");
      head.appendChild(brand);
    }
    head.appendChild(closeBtn);

    var scroll = document.createElement("div");
    scroll.className = "sb-scroll";

    nav.classList.add("sb-nav");
    [].forEach.call(nav.querySelectorAll("a"), decorate);
    scroll.appendChild(nav);

    // Categories (vault page only) sit between the main links and the fine print.
    var catGrid = document.getElementById("cat-grid");
    var catsWrap = null, catList = null;
    if (catGrid) {
      catsWrap = document.createElement("div");
      catsWrap.className = "sb-cats";
      catsWrap.hidden = true;
      catsWrap.innerHTML = '<hr class="sb-div"><p class="sb-label">Categories</p>';
      catList = document.createElement("div");
      catList.className = "sb-cat-list";
      catsWrap.appendChild(catList);
      scroll.appendChild(catsWrap);
    }

    // Privacy / Credits / Terms, with hrefs borrowed from the footer.
    var have = {};
    [].forEach.call(nav.querySelectorAll("a"), function (a) { have[keyOf(a.getAttribute("href"))] = 1; });
    var foot = [].slice.call(document.querySelectorAll(".site-foot a[href]"));
    function footFor(k) { return foot.filter(function (a) { return keyOf(a.getAttribute("href")) === k; })[0]; }
    var sample = foot.filter(function (a) { return keyOf(a.getAttribute("href")) !== "vault"; })[0];

    var more = document.createElement("nav");
    more.className = "sb-nav sb-more";
    more.setAttribute("aria-label", "Site information");
    [["privacy", "Privacy"], ["credits", "Credits"], ["terms", "Terms"]].forEach(function (m) {
      if (have[m[0]]) return;
      var href, f = footFor(m[0]);
      if (f) {
        href = f.getAttribute("href");
      } else if (sample) {
        // e.g. the footer has "../about.html" but no Credits -> "../credits.html"
        var sh = sample.getAttribute("href"), sk = keyOf(sh);
        href = sh.indexOf(sk) >= 0 ? sh.replace(sk, m[0]) : "/" + m[0];
      } else {
        href = "/" + m[0];
      }
      var a = document.createElement("a");
      a.setAttribute("href", href);
      a.textContent = m[1];
      decorate(a);
      more.appendChild(a);
    });
    if (more.children.length) {
      var div = document.createElement("hr");
      div.className = "sb-div";
      scroll.appendChild(div);
      scroll.appendChild(more);
    }

    // Highlight the current page if the markup didn't already.
    var here = keyOf(location.pathname);
    function markHere(list) {
      [].forEach.call(list, function (a) {
        if (keyOf(a.getAttribute("href")) === here) a.classList.add("active");
      });
    }
    if (!nav.querySelector("a.active")) markHere(nav.querySelectorAll("a"));
    markHere(more.querySelectorAll("a"));
    [].forEach.call(sb.querySelectorAll("a.active"), function (a) { a.setAttribute("aria-current", "page"); });

    sb.appendChild(head);
    sb.appendChild(scroll);
    header.parentNode.insertBefore(sb, header.nextSibling);

    var scrim = document.createElement("div");
    scrim.className = "sb-scrim";
    scrim.setAttribute("aria-hidden", "true");
    document.body.appendChild(scrim);

    var burger = button("sb-burger", "menu", "Open menu");
    burger.setAttribute("aria-controls", "og-sb");
    burger.setAttribute("aria-expanded", "false");
    header.insertBefore(burger, header.firstChild);

    // With the links gone, a header that held only the logo has nothing to
    // show on desktop (the logo now lives in the sidebar), so it is hidden.
    header.classList.toggle("sb-empty", ![].some.call(header.children, function (el) {
      return !el.matches(".brand, .sb-burger");
    }));

    // --- desktop rail -----------------------------------------------------------
    function isDesk() { return mq ? mq.matches : window.innerWidth >= 900; }
    function railPref() {
      var v = null;
      try { v = localStorage.getItem(RAIL_KEY); } catch (e) {}
      if (v === "1") return true;
      if (v === "0") return false;
      return window.innerWidth < 1200;
    }
    function titles(on) {
      [].forEach.call(sb.querySelectorAll("[data-label]"), function (el) {
        if (on) el.setAttribute("title", el.getAttribute("data-label"));
        else el.removeAttribute("title");
      });
    }
    function setRail(on, save) {
      root.classList.toggle("sb-rail", on);
      toggle.setAttribute("aria-label", on ? "Expand menu" : "Collapse menu");
      toggle.setAttribute("aria-expanded", String(!on));
      titles(on);
      if (save) { try { localStorage.setItem(RAIL_KEY, on ? "1" : "0"); } catch (e) {} }
    }

    // --- phone drawer -----------------------------------------------------------
    var isOpen = false, lastFocus = null, muted = [];

    function openDrawer() {
      if (isDesk() || isOpen) return;
      isOpen = true;
      lastFocus = document.activeElement;
      sb.removeAttribute("inert");
      sb.removeAttribute("aria-hidden");
      root.classList.add("sb-open");
      burger.setAttribute("aria-expanded", "true");
      // Keep keyboard / screen-reader focus inside the drawer while it is open.
      muted = [].filter.call(document.querySelectorAll("body > main, body > header.top, body > .site-foot"),
        function (el) { return !el.hasAttribute("inert"); });
      muted.forEach(function (el) { el.setAttribute("inert", ""); });
      setTimeout(function () { try { sb.focus({ preventScroll: true }); } catch (e) {} }, 30);
    }

    function closeDrawer(restoreFocus) {
      if (!isOpen) return;
      isOpen = false;
      root.classList.remove("sb-open");
      burger.setAttribute("aria-expanded", "false");
      muted.forEach(function (el) { el.removeAttribute("inert"); });
      muted = [];
      if (!isDesk()) { sb.setAttribute("inert", ""); sb.setAttribute("aria-hidden", "true"); }
      if (restoreFocus && lastFocus && lastFocus.focus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
      }
    }

    function apply() {
      var desk = isDesk();
      root.classList.add("sb-on");
      root.classList.toggle("sb-desk", desk);
      root.classList.toggle("sb-mob", !desk);
      if (desk) {
        closeDrawer(false);
        setRail(railPref(), false);
        sb.removeAttribute("inert");
        sb.removeAttribute("aria-hidden");
      } else {
        root.classList.remove("sb-rail");
        titles(false);
        if (!isOpen) { sb.setAttribute("inert", ""); sb.setAttribute("aria-hidden", "true"); }
      }
    }

    burger.addEventListener("click", function () { if (isOpen) closeDrawer(true); else openDrawer(); });
    closeBtn.addEventListener("click", function () { closeDrawer(true); });
    scrim.addEventListener("click", function () { closeDrawer(true); });
    toggle.addEventListener("click", function () { setRail(!root.classList.contains("sb-rail"), true); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) closeDrawer(true);
    });

    // Picking anything in the drawer closes it. Capture phase, and deferred a
    // tick, so the link's own handler (contact panel, page router) still runs
    // and focus is not yanked back from whatever that handler opens.
    sb.addEventListener("click", function (e) {
      if (!isOpen) return;
      if (e.target.closest && e.target.closest("a[href], .sb-cat")) {
        setTimeout(function () { closeDrawer(false); }, 0);
      }
    }, true);

    // Swipe left to close.
    var sx = null, sy = 0;
    sb.addEventListener("touchstart", function (e) {
      if (!isOpen) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    sb.addEventListener("touchmove", function (e) {
      if (sx === null) return;
      var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) { sx = null; closeDrawer(true); }
    }, { passive: true });
    sb.addEventListener("touchend", function () { sx = null; }, { passive: true });

    // Coming back with the browser's Back button must not find the drawer open.
    window.addEventListener("pageshow", function (e) { if (e.persisted) closeDrawer(false); });

    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", apply);
      else if (mq.addListener) mq.addListener(apply);
    }
    apply();
    // Transitions only after the first layout, so nothing animates on load.
    setTimeout(function () { root.classList.add("sb-ready"); }, 60);

    window.OGSidebar = {
      open: openDrawer,
      close: function () { closeDrawer(true); },
      isOpen: function () { return isOpen; }
    };

    // --- category mirror (vault page) ----------------------------------------
    if (!catGrid) return;

    function afterPick() {
      var target = document.getElementById("cat-heading");
      if (!target || target.hidden) target = document.getElementById("game-grid");
      if (target && target.scrollIntoView) {
        setTimeout(function () {
          target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }, 40);
      }
    }

    function markCats() {
      var any = false;
      [].forEach.call(catList.querySelectorAll(".sb-cat"), function (b) {
        if (!b._card) return;
        var on = b._card.classList.contains("active");
        any = any || on;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      var all = catList.querySelector(".sb-cat-all");
      if (all) { all.classList.toggle("active", !any); all.setAttribute("aria-pressed", String(!any)); }
    }

    function syncCats() {
      var cards = catGrid.querySelectorAll(".cat-card");
      catsWrap.hidden = !cards.length;
      root.classList.toggle("sb-has-cats", !!cards.length);
      catList.innerHTML = "";
      if (!cards.length) return;

      var all = document.createElement("button");
      all.type = "button";
      all.className = "sb-cat sb-cat-all";
      all.innerHTML = svg("all") + '<span class="sb-text">All games</span>';
      all.setAttribute("data-label", "All games");
      all.addEventListener("click", function () {
        var sa = document.getElementById("show-all");
        var ch = document.getElementById("cat-heading");
        if (sa && ch && !ch.hidden) sa.click();
        afterPick();
      });
      catList.appendChild(all);

      [].forEach.call(cards, function (card) {
        var nameEl = card.querySelector(".full") || card.querySelector("b") || card;
        var name = (nameEl.textContent || "").trim();
        var ico = card.querySelector(".cat-ico");
        var b = document.createElement("button");
        b.type = "button";
        b.className = "sb-cat";
        var i = document.createElement("span");
        i.className = "sb-cat-ico";
        i.setAttribute("aria-hidden", "true");
        if (ico) i.innerHTML = ico.innerHTML;
        var t = document.createElement("span");
        t.className = "sb-text";
        t.textContent = name;
        b.appendChild(i);
        b.appendChild(t);
        b.setAttribute("data-label", name);
        b._card = card;
        b.addEventListener("click", function () { card.click(); afterPick(); });
        catList.appendChild(b);
      });
      markCats();
      titles(root.classList.contains("sb-rail"));
    }

    syncCats();
    if ("MutationObserver" in window) {
      new MutationObserver(function (muts) {
        var rebuilt = muts.some(function (m) { return m.type === "childList"; });
        if (rebuilt) syncCats(); else markCats();
      }).observe(catGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  })();
})();