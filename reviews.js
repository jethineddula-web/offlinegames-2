/* reviews.js — asks players for a review after they have spent real time in
   a game, and sends it to your Google Form (answers land in a Google Sheet).

   ------------------------------------------------------------------ SETUP
   1. Create a Google Form with four "Short answer" questions, in any order:
        Game · Stars · Review · Details
      In Settings, make sure "Collect email addresses" is OFF and
      "Restrict to users in your organisation" / sign-in is OFF.
   2. Form menu (⋮) → "Get pre-filled link". Type exactly these answers:
        Game = GAME   Stars = 5   Review = TEXT   Details = META
      Click "Get link" → "Copy link".
   3. Paste that link between the quotes below and upload the site.
   Until a link is pasted, players are never asked for a review.
   ------------------------------------------------------------------------ */
var OG_REVIEW_FORM_LINK = "https://docs.google.com/forms/d/e/1FAIpQLSeCeUkcQfSFbVxdx7SYzI-NGExIyKkaFo-8tER54IN1HWuj7Q/viewform?usp=pp_url&entry.360718652=GAME&entry.1115478614=5&entry.1738251467=TEXT&entry.337357658=META";

(function () {
  "use strict";
  var KEY = "og-reviews-v1";
  var FIRST_ASK = 300;      // seconds of total play in a game before the first ask
  var SESSION_MIN = 90;     // and at least this long in the session just ended
  var SNOOZE = 600;         // "Not now" waits for this much more play
  var MAX_ASKS = 2;         // per game, ever
  var GAP = 20 * 3600e3;    // at most one ask per ~day across all games

  var form = parseLink(OG_REVIEW_FORM_LINK);
  var st = load(), session = null, modal = null;

  /* The pre-filled link carries entry IDs next to our placeholder answers. */
  function parseLink(link) {
    if (!link) return null;
    try {
      var u = new URL(link), map = {};
      u.searchParams.forEach(function (v, k) {
        if (!/^entry\.\d+$/.test(k)) return;
        var val = v.trim().toUpperCase();
        if (val === "GAME") map.game = k; else if (val === "5") map.stars = k;
        else if (val === "TEXT") map.text = k; else if (val === "META") map.meta = k;
      });
      if (!map.game || !map.stars) return null;
      map.action = u.origin + u.pathname.replace(/\/viewform$/, "/formResponse");
      return map;
    } catch (e) { return null; }
  }

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    s = s || {};
    s.games = s.games || {}; s.queue = s.queue || []; s.lastAsk = s.lastAsk || 0;
    return s;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function rec(id) { return st.games[id] || (st.games[id] = { secs: 0, asks: 0, nextAt: FIRST_ASK, done: false }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------------------------------------------------- play-time tracking
     Only time with the tab visible counts. */
  var hiddenAt = 0;
  document.addEventListener("visibilitychange", function () {
    if (!session) return;
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt) { session.hidden += Date.now() - hiddenAt; hiddenAt = 0; }
  });
  window.addEventListener("og:play", function (e) {
    session = { g: e.detail, start: Date.now(), hidden: 0 };
  });
  window.addEventListener("og:close", function (e) {
    if (!session || !e.detail || session.g.id !== e.detail.id) { session = null; return; }
    var secs = Math.min(3600, Math.max(0, (Date.now() - session.start - session.hidden) / 1000));
    var g = session.g, r = rec(g.id); session = null;
    r.secs += secs; persist();
    if (shouldAsk(r, secs)) setTimeout(function () { ask(g, r); }, 500);
  });

  function shouldAsk(r, secs) {
    return !!form && !r.done && r.asks < MAX_ASKS && r.secs >= r.nextAt && secs >= SESSION_MIN &&
      Date.now() - st.lastAsk > GAP && !document.querySelector(".og-modal.open");
  }

  /* -------------------------------------------------------------- prompt */
  function ask(g, r) {
    r.asks++; st.lastAsk = Date.now(); persist();
    window.OG_REVIEW_OPEN = true;
    var stars = 0;
    modal = document.createElement("div");
    modal.className = "og-modal";
    modal.innerHTML =
      '<div class="og-sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="og-rv-title">' +
        '<div class="hd">' + (g.coverUrl ? '<img src="' + esc(g.coverUrl) + '" alt="">' : "") +
          '<div><h2 id="og-rv-title">Enjoying ' + esc(g.title) + '?</h2><p>You’ve played for ' + Math.max(1, Math.round(r.secs / 60)) + ' minutes. How would you rate it?</p></div></div>' +
        '<div class="og-stars" role="radiogroup" aria-label="Rating">' +
          [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" aria-checked="false" aria-label="' + n + ' star' + (n > 1 ? "s" : "") + '" data-s="' + n + '">★</button>'; }).join("") +
        "</div>" +
        '<textarea maxlength="400" placeholder="What did you like? What would make it better? (optional)"></textarea>' +
        '<p class="og-note">Sent anonymously to the site team. Please don’t include your name, email or phone number.</p>' +
        '<div class="og-row"><button type="button" data-later>Not now</button><button type="button" class="pri" data-send disabled>Send review</button></div>' +
        '<button type="button" class="og-never" data-never>Don’t ask about this game again</button>' +
      "</div>";
    document.body.appendChild(modal);
    var btns = modal.querySelectorAll(".og-stars button"), send = modal.querySelector("[data-send]");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        stars = +b.dataset.s;
        btns.forEach(function (x) { var on = +x.dataset.s <= stars; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(+x.dataset.s === stars)); });
        send.disabled = false;
      });
    });
    modal.querySelector("[data-later]").addEventListener("click", function () { r.nextAt = r.secs + SNOOZE; persist(); dismiss(); });
    modal.querySelector("[data-never]").addEventListener("click", function () { r.done = true; persist(); dismiss(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) { r.nextAt = r.secs + SNOOZE; persist(); dismiss(); } });
    send.addEventListener("click", function () {
      var text = scrub(modal.querySelector("textarea").value);
      r.done = true; r.stars = stars; persist();
      submit({ game: g.title, stars: stars, text: text, meta: meta(r) });
      modal.querySelector(".og-sheet").innerHTML = '<div class="og-thanks"><b>Thank you!</b><p>Your review helps decide what gets built next.</p></div>';
      setTimeout(dismiss, 1600);
    });
    // Focus the dialog, not a star, so nothing nudges the rating.
    requestAnimationFrame(function () { requestAnimationFrame(function () { modal.classList.add("open"); modal.querySelector(".og-sheet").focus(); }); });
  }
  function dismiss() {
    if (!modal) return;
    var m = modal; modal = null;
    m.classList.remove("open");
    setTimeout(function () { m.remove(); }, 250);
    window.OG_REVIEW_OPEN = false;
    try { window.dispatchEvent(new CustomEvent("og:review-closed")); } catch (e) {}
  }

  /* Strip anything that looks like contact details before it leaves the device. */
  function scrub(t) {
    return String(t || "").slice(0, 400)
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[removed]")
      .replace(/(https?:\/\/|www\.)\S+/gi, "[removed]")
      .replace(/(\+?\d[\d\s().-]{6,}\d)/g, "[removed]")
      .trim();
  }
  function meta(r) {
    var mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
    return Math.round(r.secs / 60) + " min played · " + (mobile ? "phone/tablet" : "computer") + " · " + (navigator.language || "");
  }

  /* ------------------------------------------------------------ sending
     Google Forms accepts a plain form POST. The response is opaque, so a
     review is only removed from the queue once the request itself succeeds;
     offline reviews wait and are sent on the next visit. */
  function submit(rv) { st.queue.push(rv); persist(); flush(); }
  function flush() {
    if (!form || !st.queue.length || navigator.onLine === false) return;
    var rv = st.queue[0], fd = new FormData();
    fd.append(form.game, rv.game); fd.append(form.stars, String(rv.stars));
    if (form.text) fd.append(form.text, rv.text || "");
    if (form.meta) fd.append(form.meta, rv.meta || "");
    fetch(form.action, { method: "POST", mode: "no-cors", body: fd })
      .then(function () { st.queue.shift(); persist(); if (st.queue.length) setTimeout(flush, 800); })
      .catch(function () {});
  }
  window.addEventListener("online", flush);
  setTimeout(flush, 3000);
})();
