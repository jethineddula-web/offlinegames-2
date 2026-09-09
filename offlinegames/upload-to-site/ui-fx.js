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

    document.addEventListener("pointermove", function (e) {
      var card = e.target.closest && e.target.closest(".cartridge");
      if (!card) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width  - .5;
      var py = (e.clientY - r.top)  / r.height - .5;
      card.style.setProperty("--ry", (px *  MAX * 2).toFixed(2) + "deg");
      card.style.setProperty("--rx", (py * -MAX * 2).toFixed(2) + "deg");
      card.classList.add("fx-tilt");
    }, { passive: true });

    document.addEventListener("pointerout", function (e) {
      var card = e.target.closest && e.target.closest(".cartridge");
      if (!card) return;
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
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
})();
