/* library-sync.js — keeps the Library page honest.
 *
 * THE PROBLEM
 *
 * The library's game notes are hand-written into the HTML, but the vault is
 * driven by catalog.js. The two drift apart the moment you add or rename a
 * game, and nothing was reconciling them:
 *
 *   - index.html has the same 17 hand-written cards and an empty #lib-extra
 *     div, but nothing ever filled it. Eight catalog games — Umbra Fight,
 *     Crayon Kingdom, 2048, Tic-Tac-Toe, Timber Blade, Stick Bow, Flappy Plane
 *     and Guess The Country — simply did not appear on the Library panel.
 *     (library.html has an inline script that fills it; index.html does not,
 *     and the nav sends people to index.html#library.)
 *
 *   - Two hand-written cards, "Shadow Fight" and "Crazy Kingdom", name games
 *     that no longer exist under those names. They were dead entries, and
 *     their renamed versions would have shown up a second time as extras.
 *
 * WHAT THIS DOES
 *
 * Reconciles the page against catalog.js every time it loads:
 *   1. A hand-written card whose game still exists keeps its editorial note,
 *      but takes the catalog's current title and cover art.
 *   2. A hand-written card whose game is gone is removed.
 *   3. Any catalog game with no hand-written card gets a generated card.
 *
 * Runs on both index.html and library.html. Idempotent — safe to run again.
 */
(function () {
  "use strict";

  /* Games that were renamed in the catalog but still have their old name on a
   * hand-written card. Keeping the note is worth more than the stale heading,
   * so match them up rather than deleting good writing. */
  var ALIASES = {
    "shadow fight": "umbra fight",
    "crazy kingdom": "crayon kingdom"
  };

  function norm(s) { return String(s || "").trim().toLowerCase(); }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function games() {
    return Array.isArray(window.SITE_GAMES) ? window.SITE_GAMES.slice() : [];
  }

  /* On index.html the vault is a panel on the same page; on library.html it is
   * a separate document. Link accordingly. */
  function vaultLink() {
    return document.getElementById("library-page")
      ? '<a href="#vault" data-panel="vault">'
      : '<a href="index.html">';
  }

  /* A cover that 404s leaves a 150px broken-image box in the middle of the
   * card on a phone. Collapse it instead — the note reads fine without art. */
  function hideIfBroken(img) {
    if (!img || img.dataset.ogChecked) return;
    img.dataset.ogChecked = "1";
    var drop = function () { img.style.display = "none"; };
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) drop();
    img.addEventListener("error", drop);
  }

  function findGame(list, title) {
    var want = norm(title);
    var alias = ALIASES[want];
    for (var i = 0; i < list.length; i++) {
      var t = norm(list[i].title);
      if (t === want || (alias && t === alias)) return list[i];
    }
    return null;
  }

  function sync() {
    var list = games();
    if (!list.length) return;              // catalog not loaded on this page

    // Prefer the library panel's container on index.html, else the standalone
    // page's. Both use the same ids.
    var scope = document.getElementById("library-page") ||
                document.getElementById("lib-static") ||
                document;
    var extraBox = scope.querySelector ? scope.querySelector("#lib-extra") : null;
    if (!extraBox) extraBox = document.getElementById("lib-extra");
    if (!extraBox) return;

    var cards = scope.querySelectorAll("#lib-static [data-title], [data-title]");
    var covered = {};

    Array.prototype.forEach.call(cards, function (card) {
      if (card.closest("#lib-extra")) return;      // generated, not hand-written
      var title = card.getAttribute("data-title");
      var g = findGame(list, title);

      if (!g) {
        // The game behind this note is gone from the catalog. Leaving it would
        // advertise a game nobody can play.
        card.remove();
        return;
      }

      covered[norm(g.title)] = true;

      // Take the catalog's current name and art, keep the hand-written prose.
      var h = card.querySelector("h2");
      if (h && h.textContent.trim() !== g.title) h.textContent = g.title;

      var eyebrow = card.querySelector(".eyebrow");
      if (eyebrow && g.category) eyebrow.textContent = g.category;

      var img = card.querySelector("img");
      if (img) {
        if (g.coverUrl && img.getAttribute("src") !== g.coverUrl) {
          img.src = g.coverUrl;
          img.alt = g.title;
        }
        hideIfBroken(img);
      }

      // The "Play X in the vault" line should name the game as it is now.
      var link = card.querySelector("a[href*='vault'], a[href*='index.html']");
      if (link) link.textContent = "Play " + g.title + " in the vault";

      card.setAttribute("data-title", g.title);
    });

    // Anything in the catalog without a hand-written note gets a generated one.
    var missing = list.filter(function (g) { return !covered[norm(g.title)]; })
                      .sort(function (a, b) { return (b.catalog || 0) - (a.catalog || 0); });

    var html = missing.map(function (g) {
      return '<article class="card lib-card" data-lib-sync="1" data-id="' + esc(g.id) + '">' +
        (g.coverUrl ? '<img src="' + esc(g.coverUrl) + '" alt="' + esc(g.title) + '" loading="lazy">' : "") +
        '<div><p class="eyebrow">' + esc(g.category || "") + "</p>" +
        "<h2>" + esc(g.title) + "</h2>" +
        "<p>" + esc(g.description || "") + "</p>" +
        "<p>" + vaultLink() + "Play " + esc(g.title) + " in the vault</a></p></div></article>";
    }).join("");
    extraBox.innerHTML = html;
    Array.prototype.forEach.call(extraBox.querySelectorAll("img"), hideIfBroken);
  }

  function boot() {
    sync();
    // library.html has its own inline script that also writes #lib-extra on
    // load. Run once more after it settles so the reconciled version wins.
    setTimeout(sync, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // app.js polls catalog.js every 15s; re-reconcile when it changes.
  var lastCount = 0;
  setInterval(function () {
    var n = games().length;
    if (n && n !== lastCount) { lastCount = n; sync(); }
  }, 4000);

  window.OG_SYNC_LIBRARY = sync;
})();
