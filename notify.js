/* notify.js — the notification bell.

   What players see
     • A bell in the header with an unread count.
     • The panel lists games added recently and your announcements (news posts).
     • The newest game they have not seen yet slides in once, bottom-left.

   How you "send" a notification
     • New game: add it to the catalogue as usual (its dateAdded makes it new).
     • Announcement: publish a news post from the admin panel — title, text
       and an optional image. It appears in every player's bell on their next
       visit. To keep a news post out of the bell, give it  notify: false.

   Everything is worked out on the player's device from catalog.js; nothing is
   sent anywhere and no account is involved. */
(function () {
  "use strict";
  var KEY = "og-notify-v1", WINDOW_DAYS = 60, DAY = 864e5;
  var st = load(), bell, badge, panel, list, pop;

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    if (!s || typeof s.seen !== "number") {
      // First visit: treat the last two weeks as new, not the whole history.
      s = { seen: Date.now() - 14 * DAY, popped: [] };
      persist(s);
    }
    s.popped = s.popped || [];
    return s;
  }
  function persist(s) { try { localStorage.setItem(KEY, JSON.stringify(s || st)); } catch (e) {} }

  function when(d) { var t = new Date(d).getTime(); return isNaN(t) ? 0 : t; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function ago(t) {
    var d = Math.floor((Date.now() - t) / DAY);
    return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? d + " days ago" : new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function items() {
    var cutoff = Date.now() - WINDOW_DAYS * DAY, out = [];
    (window.SITE_GAMES || []).forEach(function (g) {
      var t = when(g.dateAdded);
      if (t && t > cutoff && t <= Date.now() + DAY) out.push({ kind: "game", t: t, id: g.id, title: g.title, img: g.coverUrl, sub: (g.category || "Game") + (g.rating ? " · " + g.rating : ""), g: g });
    });
    (window.SITE_NEWS || []).forEach(function (n) {
      var t = when(n.date);
      if (n.notify === false || !t || t < cutoff || t > Date.now() + DAY) return;
      out.push({ kind: "news", t: t, id: n.id, title: n.title, img: n.image, text: n.excerpt || n.body || "" });
    });
    out.sort(function (a, b) { return b.t - a.t; });
    return out.slice(0, 20);
  }
  function unread(list) { return list.filter(function (i) { return i.t > st.seen; }); }

  function play(it) {
    if (window.OG_PLAY) { close(); hidePop(); window.OG_PLAY(it.id); }
    else location.href = "play/" + slug(it.title);
  }

  /* ---------------------------------------------------------------- ui */
  var BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

  function build() {
    var header = document.querySelector("header.top");
    if (!header) return false;
    bell = document.createElement("button");
    bell.type = "button"; bell.className = "og-bell"; bell.setAttribute("aria-label", "Notifications");
    bell.innerHTML = BELL + '<span class="og-badge" hidden></span>';
    header.appendChild(bell);
    badge = bell.querySelector(".og-badge");

    panel = document.createElement("div");
    panel.className = "og-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "What's new");
    panel.innerHTML = '<header><h2>What’s new</h2><button type="button" class="og-link" data-all>Mark all read</button></header><div class="og-list"></div>';
    document.body.appendChild(panel);
    list = panel.querySelector(".og-list");

    bell.addEventListener("click", function (e) { e.stopPropagation(); panel.classList.contains("open") ? close() : open(); });
    panel.addEventListener("click", function (e) { e.stopPropagation(); });
    panel.querySelector("[data-all]").addEventListener("click", function () { st.seen = Date.now(); persist(); render(); });
    document.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    return true;
  }

  function render() {
    var all = items(), un = unread(all);
    badge.textContent = un.length > 9 ? "9+" : String(un.length);
    badge.hidden = un.length === 0;
    bell.setAttribute("aria-label", un.length ? un.length + " new notifications" : "Notifications");
    if (!panel.classList.contains("open")) return;
    if (!all.length) { list.innerHTML = '<p class="og-empty">You’re all caught up. New games and announcements will appear here.</p>'; return; }
    list.innerHTML = all.map(function (it, n) {
      var isNew = it.t > (panel.dataset.seenAtOpen ? +panel.dataset.seenAtOpen : st.seen);
      if (it.kind === "game") {
        return '<div class="og-item' + (isNew ? " unread" : "") + '">' + (it.img ? '<img src="' + esc(it.img) + '" alt="" loading="lazy">' : "") +
          '<div class="b"><span class="k">New game · ' + ago(it.t) + '</span><p class="t">' + esc(it.title) + '</p><p class="d">' + esc(it.sub) + "</p>" +
          '<button type="button" class="og-play" data-n="' + n + '">Play now</button></div></div>';
      }
      return '<div class="og-item ann' + (isNew ? " unread" : "") + '">' + (it.img ? '<img src="' + esc(it.img) + '" alt="" loading="lazy">' : "") +
        '<div class="b"><span class="k">Announcement · ' + ago(it.t) + '</span><p class="t">' + esc(it.title) + '</p>' + (it.text ? '<p class="d">' + esc(it.text) + "</p>" : "") + "</div></div>";
    }).join("");
    list.querySelectorAll(".og-play").forEach(function (b) { b.addEventListener("click", function () { play(all[+b.dataset.n]); }); });
  }

  function open() {
    // Highlight what was unread when the panel opened, then count it as read.
    panel.dataset.seenAtOpen = String(st.seen);
    panel.classList.add("open");
    render();
    st.seen = Date.now(); persist();
    badge.hidden = true;
  }
  function close() { if (panel) panel.classList.remove("open"); }

  /* ---- one-time arrival pop-up for the newest unseen game ---- */
  function arrival() {
    // One pop-up per day at most. Without this, a visitor with several unseen
    // games got a fresh pop-up on every single page load until they ran out.
    if (Date.now() - (st.lastPop || 0) < 20 * 3600e3) return;
    var newGames = unread(items()).filter(function (i) { return i.kind === "game"; });
    var g = newGames.filter(function (i) { return st.popped.indexOf(i.id) < 0; })[0];
    if (!g) return;
    // Treat every game that is currently new as already shown, so the bell
    // stays as the place to catch up rather than nagging again and again.
    newGames.forEach(function (i) { if (st.popped.indexOf(i.id) < 0) st.popped.push(i.id); });
    st.popped = st.popped.slice(-50); st.lastPop = Date.now(); persist();
    pop = document.createElement("div");
    pop.className = "og-pop"; pop.setAttribute("role", "status");
    pop.innerHTML = (g.img ? '<img src="' + esc(g.img) + '" alt="">' : "") +
      '<div class="b"><span class="k" style="font:600 10px var(--font-display);letter-spacing:.12em;color:var(--magenta)">NEW GAME</span>' +
      '<p style="margin:2px 0 0;font:600 14px var(--font-sans)">' + esc(g.title) + '</p>' +
      '<button type="button" class="og-play">Play now</button></div><button type="button" class="x" aria-label="Dismiss">✕</button>';
    // The language switcher floats in the same corner on pages without the
    // sidebar; sit above it instead of covering it.
    if (document.querySelector(".lang-float")) pop.classList.add("above-lang");
    document.body.appendChild(pop);
    pop.querySelector(".og-play").addEventListener("click", function () { play(g); });
    pop.querySelector(".x").addEventListener("click", hidePop);
    requestAnimationFrame(function () { requestAnimationFrame(function () { pop.classList.add("show"); }); });
    bell.classList.add("ring");
    setTimeout(hidePop, 10000);
  }
  function hidePop() { if (pop) { pop.classList.remove("show"); var p = pop; pop = null; setTimeout(function () { p.remove(); }, 400); } }

  function init() {
    if (!build()) return;
    render();
    setTimeout(arrival, 2500);
    // The vault re-polls catalog.js; pick up newly published games and posts.
    setInterval(render, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
