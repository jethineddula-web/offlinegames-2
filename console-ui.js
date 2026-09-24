/* ============================================================================
   console-ui.js — behaviour for the console-dashboard theme
   ----------------------------------------------------------------------------
   Load LAST, after app.js and ui-fx.js.

   Nothing here touches game logic. It observes the grid app.js renders and
   layers four things on top:

     1. a play affordance on each tile
     2. real arrow-key navigation (your hint line has always promised this,
        but nothing implemented it — now it works)
     3. ambient background tint sampled from the focused game's cover art
     4. staggered entrance as tiles populate

   All of it no-ops under prefers-reduced-motion where motion is involved, and
   every piece fails quietly if the DOM isn't what it expects.
   ========================================================================== */
(function () {
  "use strict";

  var grid = document.getElementById("game-grid");
  if (!grid) return;

  var reduce = false;
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var coarse = false;
  try { coarse = matchMedia("(pointer: coarse)").matches; } catch (e) {}

  var root = document.documentElement;

  // ---------------------------------------------------------------------------
  // 1. Decorate tiles as they appear
  // ---------------------------------------------------------------------------

  function decorate() {
    var cards = grid.querySelectorAll(".cartridge");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      card.style.setProperty("--ci", i);

      if (!reduce && !card.classList.contains("ce-in")) card.classList.add("ce-in");

      var cover = card.querySelector(".cover");
      if (cover && !cover.querySelector(".ce-play")) {
        var play = document.createElement("span");
        play.className = "ce-play";
        play.setAttribute("aria-hidden", "true");
        play.textContent = "▶";
        cover.appendChild(play);
      }
    }
  }

  decorate();
  if ("MutationObserver" in window) {
    new MutationObserver(function () { decorate(); })
      .observe(grid, { childList: true });
  }

  // ---------------------------------------------------------------------------
  // 2. Ambient tint sampled from cover art
  //
  // Downscale the cover to 10x10 on a canvas and average it, skipping very dark
  // and very desaturated pixels so a mostly-black cover doesn't produce a muddy
  // grey wash. Cached per image src — sampling is cheap but not free.
  // ---------------------------------------------------------------------------

  var tintCache = {};
  var tintTimer = null;

  /* Keep the hue, raise saturation to a floor, pin lightness. Returns an
   * "r, g, b" string ready to drop into rgba(). */
  function vivid(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, h = 0, s = 0, d = max - min;

    if (d) {
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else                h = ((r - g) / d + 4) / 6;
    }

    s = Math.max(s, 0.62);   // saturation floor — no grey washes
    l = 0.60;                // consistent brightness whatever the art

    function hue(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q2 = l < .5 ? l * (1 + s) : l + s - l * s;
    var p2 = 2 * l - q2;

    return [
      Math.round(hue(p2, q2, h + 1 / 3) * 255),
      Math.round(hue(p2, q2, h) * 255),
      Math.round(hue(p2, q2, h - 1 / 3) * 255)
    ].join(", ");
  }

  function sample(img) {
    var key = img.getAttribute("src") || "";
    if (!key) return null;
    if (tintCache[key]) return tintCache[key];
    if (!img.complete || !img.naturalWidth) return null;

    try {
      var c = document.createElement("canvas");
      c.width = c.height = 10;
      var ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 10, 10);
      var d = ctx.getImageData(0, 0, 10, 10).data;

      var r = 0, g = 0, b = 0, n = 0;
      for (var i = 0; i < d.length; i += 4) {
        var pr = d[i], pg = d[i + 1], pb = d[i + 2];
        var max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
        if (max < 42) continue;              // near-black: carries no hue
        if (max - min < 18) continue;        // near-grey: would wash out
        r += pr; g += pg; b += pb; n++;
      }
      if (!n) return null;
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);

      // Averaging pulls colours toward grey, so a straight scale-up gives a
      // muddy wash. Keep the hue the art actually has, then force saturation
      // and lightness to a level that reads as a glow on a near-black page.
      tintCache[key] = vivid(r, g, b);
      return tintCache[key];
    } catch (e) {
      // Canvas tainted (a cross-origin cover) — just skip the tint.
      tintCache[key] = null;
      return null;
    }
  }

  function tintFrom(card) {
    if (!card) return;
    var img = card.querySelector(".cover img");
    if (!img) return;
    var rgb = sample(img);
    if (!rgb) return;
    root.style.setProperty("--ce-amb-1", rgb);
    root.style.setProperty("--ce-amb-2", rgb);
    root.style.setProperty("--ce-amb-strength", "1");
  }

  function clearTint() {
    root.style.setProperty("--ce-amb-strength", "0");
  }

  grid.addEventListener("pointerover", function (e) {
    var card = e.target.closest && e.target.closest(".cartridge");
    if (!card) return;
    clearTimeout(tintTimer);
    tintTimer = setTimeout(function () { tintFrom(card); }, 90);
  }, { passive: true });

  grid.addEventListener("pointerleave", function () {
    clearTimeout(tintTimer);
    tintTimer = setTimeout(clearTint, 260);
  }, { passive: true });

  // ---------------------------------------------------------------------------
  // 3. Arrow-key navigation
  //
  // index.html has always said "Arrow keys browse · Enter plays" but nothing
  // listened for them. Columns are derived from the rendered grid rather than
  // hard-coded, so it stays correct at every breakpoint.
  // ---------------------------------------------------------------------------

  function tiles() {
    return Array.prototype.slice.call(grid.querySelectorAll(".cartridge"));
  }

  function columnCount(list) {
    if (list.length < 2) return 1;

    // Read the resolved grid template rather than measuring tile positions.
    // Measuring is tempting but wrong: while the entrance animation is running,
    // tiles carry a translateY, which getBoundingClientRect() includes — so
    // row-mates look like they're on different rows and the count comes out
    // too small.
    try {
      var tpl = getComputedStyle(grid).gridTemplateColumns;
      if (tpl && tpl !== "none") {
        var n = tpl.trim().split(/\s+/).length;
        if (n > 0) return Math.min(n, list.length);
      }
    } catch (e) {}

    // Fallback: measure, but against untransformed layout boxes.
    var top = list[0].offsetTop, count = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].offsetTop === top) count++;
      else break;
    }
    return Math.max(1, count);
  }

  function markActive(card) {
    var prev = grid.querySelector(".cartridge.ce-active");
    if (prev && prev !== card) prev.classList.remove("ce-active");
    if (!card) return;
    card.classList.add("ce-active");
    card.focus({ preventScroll: true });
    try { card.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }); } catch (e) {
      card.scrollIntoView();
    }
    clearTimeout(tintTimer);
    tintTimer = setTimeout(function () { tintFrom(card); }, 60);
  }

  function busy() {
    var play = document.getElementById("play");
    if (play && play.classList.contains("open")) return true;
    var picker = document.getElementById("picker");
    if (picker && picker.classList.contains("open")) return true;
    if (document.getElementById("modal-overlay")) return true;
    var panel = document.querySelector(".cx-panel");
    if (panel && panel.classList.contains("open")) return true;
    var t = document.activeElement;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return true;
    return false;
  }

  document.addEventListener("keydown", function (e) {
    var keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"];
    if (keys.indexOf(e.key) < 0) return;
    if (busy()) return;
    if (grid.offsetParent === null) return;   // vault panel not showing

    var list = tiles();
    if (!list.length) return;

    var current = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest(".cartridge")
      : null;

    if (e.key === "Enter") {
      if (!current) return;
      e.preventDefault();
      current.click();
      return;
    }

    e.preventDefault();

    if (!current) { markActive(list[0]); return; }

    var i = list.indexOf(current);
    var cols = columnCount(list);
    var next = i;

    if (e.key === "ArrowRight") next = Math.min(list.length - 1, i + 1);
    if (e.key === "ArrowLeft")  next = Math.max(0, i - 1);
    if (e.key === "ArrowDown")  next = Math.min(list.length - 1, i + cols);
    if (e.key === "ArrowUp")    next = i - cols < 0 ? i : i - cols;

    markActive(list[next]);
  });

  // Clicking or hovering should not leave a stale keyboard highlight behind.
  grid.addEventListener("pointerdown", function () {
    var prev = grid.querySelector(".cartridge.ce-active");
    if (prev) prev.classList.remove("ce-active");
  }, { passive: true });

  // ---------------------------------------------------------------------------
  // 4. Rewrite the hint line as key caps, now that the keys are real
  // ---------------------------------------------------------------------------

  var hints = document.getElementById("khints");
  if (hints && !hints.dataset.ce) {
    hints.dataset.ce = "1";
    hints.innerHTML =
      '<span class="ce-key"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> Browse</span>' +
      '<span class="ce-key"><kbd>Enter</kbd> Play</span>' +
      '<span class="ce-key"><kbd>R</kbd> Random</span>' +
      '<span class="ce-key"><kbd>/</kbd> Search</span>' +
      (coarse ? "" : '<span class="ce-key"><kbd>Esc</kbd> Back</span>');
  }
})();
