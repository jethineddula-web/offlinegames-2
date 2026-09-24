/* promo.js — makes the next game easy to reach.
     • "Continue playing" shelf (recent games + minutes played)
     • "You haven't tried these yet" shelf, weighted to the categories the
       player actually spends time in, with a "Try next" chip on the top picks
     • a "Play next" card after a game is closed
   All suggestions are worked out on the device from what this player has
   played; nothing is tracked or sent anywhere. */
(function () {
  "use strict";
  var DAY = 864e5, nextEl = null, nextTimer = 0;

  function games() { return (window.SITE_GAMES || []).filter(function (g) { return g && g.id && g.embedUrl; }); }
  function byId(id) { return games().filter(function (g) { return g.id === id; })[0]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || "null") || {}; } catch (e) { return {}; } }

  // Minutes per game come from reviews.js; recents order comes from the vault.
  function playedSecs() { var r = read("og-reviews-v1").games || {}, o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k].secs || 0; }); return o; }
  function recents() { return (read("og-vault-v1").recents || []).filter(byId); }
  function isNew(g) { var t = new Date(g.dateAdded).getTime(); return !isNaN(t) && Date.now() - t < 21 * DAY; }

  /* Rank games this player has never opened: favourite categories first,
     then newer titles, with a stable daily shuffle so the shelf changes. */
  function untried(exclude) {
    var secs = playedSecs(), played = {}, catTime = {};
    recents().forEach(function (id) { played[id] = true; });
    Object.keys(secs).forEach(function (id) { played[id] = true; var g = byId(id); if (g) catTime[g.category] = (catTime[g.category] || 0) + secs[id]; });
    var day = Math.floor(Date.now() / DAY);
    return games().filter(function (g) { return !played[g.id] && g.id !== exclude; })
      .map(function (g) {
        var h = 0; for (var i = 0; i < g.id.length; i++) h = (h * 31 + g.id.charCodeAt(i) + day) % 997;
        return { g: g, score: (catTime[g.category] || 0) / 60 * 3 + (isNew(g) ? 25 : 0) + h / 997 * 10 };
      })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (x) { return x.g; });
  }

  function reason(g, secs) {
    if (secs[g.id]) return Math.max(1, Math.round(secs[g.id] / 60)) + " min played";
    if (isNew(g)) return "New · " + (g.category || "Game");
    return g.category || "Game";
  }
  function tile(g, label, pct) {
    return '<button type="button" class="og-tile" data-id="' + esc(g.id) + '">' +
      '<img src="' + esc(g.coverUrl) + '" alt="" loading="lazy" decoding="async">' +
      (pct !== undefined ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : "") +
      "<span>" + esc(g.title) + "</span><em>" + esc(label) + "</em></button>";
  }
  function wire(root) {
    root.querySelectorAll(".og-tile").forEach(function (b) {
      b.addEventListener("click", function () { hideNext(); if (window.OG_PLAY) window.OG_PLAY(b.dataset.id); });
    });
  }

  /* ------------------------------------------------------------ shelves */
  function shelves() {
    var anchor = document.getElementById("cat-btn");
    if (!anchor || !games().length) return;
    var host = document.getElementById("og-shelves");
    if (!host) { host = document.createElement("div"); host.id = "og-shelves"; anchor.parentNode.insertBefore(host, anchor); }
    var secs = playedSecs(), rec = recents().slice(0, 8), html = "";
    if (rec.length) {
      var max = Math.max.apply(null, rec.map(function (id) { return secs[id] || 0; }).concat([60]));
      html += '<section class="og-shelf" aria-label="Continue playing"><h2>Continue playing</h2><div class="og-strip">' +
        rec.map(function (id) { var g = byId(id); return tile(g, reason(g, secs), Math.round(((secs[id] || 0) / max) * 100)); }).join("") + "</div></section>";
    }
    var fresh = untried().slice(0, 10);
    if (fresh.length) {
      html += '<section class="og-shelf" aria-label="Games you have not tried"><h2>' + (rec.length ? "You haven’t tried these yet" : "Start with these") +
        "<small>" + fresh.length + (fresh.length === 10 ? "+" : "") + " picked for you</small></h2><div class=\"og-strip\">" +
        fresh.map(function (g) { return tile(g, reason(g, secs)); }).join("") + "</div></section>";
    }
    host.innerHTML = html;
    wire(host);
    chips(fresh.slice(0, 3));
  }

  /* "Try next" chips on the top three recommendations in the main grid. */
  var chipIds = [];
  function chips(top) {
    if (top) chipIds = top.map(function (g) { return g.id; });
    var grid = document.getElementById("game-grid"); if (!grid) return;
    var secs = playedSecs();
    grid.querySelectorAll(".cartridge").forEach(function (card) {
      var id = card.getAttribute("data-id"), cover = card.querySelector(".cover");
      if (!cover) return;
      var old = cover.querySelector(".og-chip"); if (old) old.remove();
      var label = null, cls = "";
      if (chipIds.indexOf(id) >= 0) { label = "Try next"; cls = " try"; }
      else if (secs[id] >= 60) label = "▶ " + Math.round(secs[id] / 60) + " min";
      if (!label) return;
      var c = document.createElement("span"); c.className = "og-chip" + cls; c.textContent = label; cover.appendChild(c);
    });
  }

  /* ---------------------------------------------------------- play next */
  function showNext(closed) {
    var secs = playedSecs();
    var same = untried(closed.id).filter(function (g) { return g.category === closed.category; });
    var picks = same.slice(0, 2);
    untried(closed.id).forEach(function (g) { if (picks.length < 3 && picks.indexOf(g) < 0) picks.push(g); });
    // Everything tried already? Suggest their other favourites instead.
    recents().forEach(function (id) { var g = byId(id); if (picks.length < 3 && g && g.id !== closed.id && picks.indexOf(g) < 0) picks.push(g); });
    if (!picks.length) return;
    hideNext(true);
    nextEl = document.createElement("div");
    nextEl.className = "og-next"; nextEl.setAttribute("role", "dialog"); nextEl.setAttribute("aria-label", "Play next");
    nextEl.innerHTML = '<div class="hd"><b>Play next</b><button type="button" aria-label="Close">✕</button></div><div class="og-strip">' +
      picks.map(function (g) { return tile(g, g.category === closed.category ? "More " + (g.category || "") : reason(g, secs)); }).join("") + "</div>";
    document.body.appendChild(nextEl);
    wire(nextEl);
    nextEl.querySelector(".hd button").addEventListener("click", function () { hideNext(); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (nextEl) nextEl.classList.add("show"); }); });
    nextTimer = setTimeout(hideNext, 14000);
  }
  function hideNext(now) {
    clearTimeout(nextTimer);
    if (!nextEl) return;
    var el = nextEl; nextEl = null;
    el.classList.remove("show");
    if (now) el.remove(); else setTimeout(function () { el.remove(); }, 400);
  }

  window.addEventListener("og:play", function () { hideNext(true); });
  window.addEventListener("og:close", function (e) {
    var closed = e.detail;
    setTimeout(function () {
      shelves();
      // Let a review prompt finish first; never stack two panels.
      if (window.OG_REVIEW_OPEN) window.addEventListener("og:review-closed", function once() { window.removeEventListener("og:review-closed", once); showNext(closed); });
      else showNext(closed);
    }, 700);
  });

  function init() {
    shelves();
    var grid = document.getElementById("game-grid");
    if (grid && window.MutationObserver) new MutationObserver(function () { chips(); }).observe(grid, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
