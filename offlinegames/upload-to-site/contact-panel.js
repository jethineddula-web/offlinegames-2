/* contact-panel.js — slide-over contact panel for OfflineGames.
 *
 * IMPORTANT: load this BEFORE app.js. It registers a capture-phase click
 * handler that needs to run ahead of app.js's own nav router, so that the
 * Contact links open this panel instead of the old full-page section.
 *
 * No backend. Submitting opens the visitor's mail app with everything
 * pre-filled, so nothing is stored, posted, or logged anywhere.
 */
(function () {
  "use strict";

  /* The address is assembled at runtime rather than sitting in the source as
   * plain text. Address-harvesting bots overwhelmingly regex for a literal
   * "name@domain" pattern in HTML/JS and never execute it, so this removes you
   * from the easy list. It is not a guarantee — a bot that runs JavaScript can
   * still read it — but it costs nothing and the address is never rendered on
   * screen anywhere on the site. */
  function mailTo() {
    try { return atob("amV0aGlucHJvZHVjdGlvbnNAZ21haWwuY29t"); }
    catch (e) { return ["jethinproductions", "gmail.com"].join("@"); }
  }

  var SUBJECTS = [
    "A game won't load",
    "A game is broken mid-play",
    "Controls don't work on my device",
    "Something looks wrong on the page",
    "The site is slow",
    "Copyright / takedown request",
    "Something else"
  ];

  var MENU = [
    { key: "game",     icon: "▣", label: "Feedback about a game" },
    { key: "site",     icon: "▣", label: "Feedback about OfflineGames" },
    { key: "suggest",  icon: "◆", label: "Suggest a game" },
    { key: "business", icon: "▬", label: "Business inquiries" },
    { key: "other",    icon: "●", label: "Other" }
  ];

  var DOCS = [
    { icon: "⊕", label: "How the vault works", href: "about.html" }
  ];

  var panel, scrim, headTitle, headSub, backBtn, body, foot;
  var built = false;
  var stack = [];          // navigation history of screen names
  var chosenGame = null;
  var pending = null;   // { subject, body } awaiting a send method

  // --- helpers ---------------------------------------------------------------

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function games() {
    return Array.isArray(window.SITE_GAMES) ? window.SITE_GAMES : [];
  }

  function recentGames() {
    var ids = [];
    try {
      ids = (JSON.parse(localStorage.getItem("og-vault-v1") || "{}").recents) || [];
    } catch (e) { ids = []; }
    var all = games();
    return ids.map(function (id) {
      return all.find(function (g) { return g.id === id; });
    }).filter(Boolean).slice(0, 5);
  }

  function stagger(container) {
    var kids = container.children;
    for (var i = 0; i < kids.length; i++) kids[i].style.setProperty("--i", i);
  }

  // --- build once ------------------------------------------------------------

  function build() {
    if (built) return;
    built = true;

    scrim = document.createElement("div");
    scrim.className = "cx-scrim";
    scrim.addEventListener("click", close);

    panel = document.createElement("aside");
    panel.className = "cx-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Contact");
    panel.innerHTML =
      '<div class="cx-head">' +
        '<button type="button" class="cx-icon-btn cx-back" aria-label="Back" hidden>←</button>' +
        '<button type="button" class="cx-icon-btn cx-close" aria-label="Close">✕</button>' +
        '<h2></h2><p></p>' +
      "</div>" +
      '<div class="cx-body"></div>' +
      '<div class="cx-foot" hidden></div>';

    document.body.appendChild(scrim);
    document.body.appendChild(panel);

    headTitle = panel.querySelector(".cx-head h2");
    headSub   = panel.querySelector(".cx-head p");
    backBtn   = panel.querySelector(".cx-back");
    body      = panel.querySelector(".cx-body");
    foot      = panel.querySelector(".cx-foot");

    backBtn.addEventListener("click", goBack);
    panel.querySelector(".cx-close").addEventListener("click", close);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("open")) close();
    });
  }

  // --- open / close ----------------------------------------------------------

  var lastFocus = null;

  function open() {
    build();
    lastFocus = document.activeElement;
    stack = [];
    chosenGame = null;
    render("menu");
    scrim.classList.add("open");
    panel.classList.add("open");
    document.documentElement.style.overflow = "hidden";
    setTimeout(function () {
      var first = panel.querySelector(".cx-row, .cx-search, input, button");
      if (first) first.focus();
    }, 260);
  }

  function close() {
    if (!built) return;
    scrim.classList.remove("open");
    panel.classList.remove("open");
    document.documentElement.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function goBack() {
    if (stack.length < 2) { render("menu"); return; }
    stack.pop();
    var prev = stack.pop();
    render(prev, true);
  }

  // --- screens ---------------------------------------------------------------

  function render(name, isBack) {
    stack.push(name);
    backBtn.hidden = stack.length <= 1;
    foot.hidden = true;
    foot.innerHTML = "";

    var screen = document.createElement("div");
    screen.className = "cx-screen" + (isBack ? " back" : "");

    if (name === "menu")            screenMenu(screen);
    else if (name === "pickGame")   screenPickGame(screen);
    else if (name === "formGame")   screenForm(screen, "game");
    else if (name === "formSite")   screenForm(screen, "site");
    else if (name === "suggest")    screenForm(screen, "suggest");
    else if (name === "business")   screenForm(screen, "business");
    else if (name === "other")      screenForm(screen, "other");
    else if (name === "sent")       screenSent(screen);

    body.innerHTML = "";
    body.appendChild(screen);
    body.scrollTop = 0;
  }

  function screenMenu(root) {
    headTitle.textContent = "Contact";
    headSub.textContent = "";

    var wrap = document.createElement("div");

    var l1 = document.createElement("p");
    l1.className = "cx-label";
    l1.textContent = "Send us a message";
    wrap.appendChild(l1);

    var list = document.createElement("div");
    list.className = "cx-stagger";
    MENU.forEach(function (item) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cx-row";
      b.innerHTML =
        '<span class="cx-ico">' + item.icon + "</span>" +
        '<span class="cx-txt">' + esc(item.label) + "</span>" +
        '<span class="cx-chev">›</span>';
      b.addEventListener("click", function () {
        // about/contact/guides/privacy don't load catalog.js — there is no game
        // list to pick from there, so skip straight to the message form rather
        // than showing an empty picker.
        if (item.key === "game") render(games().length ? "pickGame" : "formGame");
        else if (item.key === "site") render("formSite");
        else render(item.key);
      });
      list.appendChild(b);
    });
    stagger(list);
    wrap.appendChild(list);

    var l2 = document.createElement("p");
    l2.className = "cx-label";
    l2.textContent = "Documentation";
    wrap.appendChild(l2);

    DOCS.forEach(function (item) {
      var a = document.createElement("a");
      a.className = "cx-row";
      a.href = item.href;
      a.innerHTML =
        '<span class="cx-ico">' + item.icon + "</span>" +
        '<span class="cx-txt"><b>' + esc(item.label) + "</b></span>" +
        '<span class="cx-chev">↗</span>';
      a.addEventListener("click", function () { close(); });
      wrap.appendChild(a);
    });

    root.appendChild(wrap);
  }

  function screenPickGame(root) {
    headTitle.textContent = "Feedback";
    headSub.textContent = "Select a game";

    var search = document.createElement("input");
    search.type = "search";
    search.className = "cx-search";
    search.placeholder = "Search games and categories";
    search.setAttribute("aria-label", "Search games and categories");
    root.appendChild(search);

    var results = document.createElement("div");
    root.appendChild(results);

    function gameRow(g) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cx-game";
      // A missing cover renders as a lettered tile rather than a broken-image
      // box — some catalog entries have no art yet.
      var cover = g.coverUrl
        ? '<img src="' + esc(g.coverUrl) + '" alt="" loading="lazy">'
        : '<i class="cx-tile">' + esc((g.title || "?").charAt(0)) + "</i>";
      b.innerHTML = cover +
        "<span>" + esc(g.title) + "<em>" + esc(g.category || "") + "</em></span>";
      b.addEventListener("click", function () {
        chosenGame = g;
        render("formGame");
      });
      return b;
    }

    function paint(q) {
      results.innerHTML = "";
      q = (q || "").trim().toLowerCase();

      if (!q) {
        var recents = recentGames();
        if (recents.length) {
          var rl = document.createElement("p");
          rl.className = "cx-label";
          rl.textContent = "Recently played";
          results.appendChild(rl);
          var rBox = document.createElement("div");
          rBox.className = "cx-stagger";
          recents.forEach(function (g) { rBox.appendChild(gameRow(g)); });
          stagger(rBox);
          results.appendChild(rBox);
        }
        var al = document.createElement("p");
        al.className = "cx-label";
        al.textContent = "All games";
        results.appendChild(al);
      }

      var list = games().filter(function (g) {
        if (!q) return true;
        return (g.title || "").toLowerCase().indexOf(q) >= 0 ||
               (g.category || "").toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return (a.title || "").localeCompare(b.title || ""); });

      if (!list.length) {
        var none = document.createElement("p");
        none.className = "cx-note";
        none.textContent = "No game matches “" + q + "”. Pick Other on the previous screen and describe it.";
        results.appendChild(none);
        return;
      }

      var box = document.createElement("div");
      box.className = "cx-stagger";
      list.forEach(function (g) { box.appendChild(gameRow(g)); });
      stagger(box);
      results.appendChild(box);
    }

    var t;
    search.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () { paint(search.value); }, 120);
    });
    paint("");
  }

  var COPY = {
    game:     { title: "Feedback", sub: "About a game" },
    site:     { title: "Feedback", sub: "About OfflineGames" },
    suggest:  { title: "Contact",  sub: "Suggest a game" },
    business: { title: "Contact",  sub: "Business inquiries" },
    other:    { title: "Contact",  sub: "Other" }
  };

  var PLACEHOLDER = {
    game:     "What happened? Which device and browser were you on?",
    site:     "Tell us what's wrong, or what you'd like to see.",
    suggest:  "Which game, and where can we find it? A link helps.",
    business: "Partnerships, licensing, ad placement — tell us what you have in mind.",
    other:    "Anything else."
  };

  function screenForm(root, kind) {
    headTitle.textContent = COPY[kind].title;
    headSub.textContent = (kind === "game" && chosenGame)
      ? chosenGame.title
      : COPY[kind].sub;

    var form = document.createElement("form");
    form.className = "cx-stagger";
    form.noValidate = true;

    // No game was picked (page without a catalog) — ask for the name in text.
    var gameName = null;
    if (kind === "game" && !chosenGame) {
      var gf = document.createElement("div");
      gf.className = "cx-field";
      var gcap = document.createElement("span");
      gcap.className = "cx-cap";
      gcap.textContent = "Which game?";
      gameName = document.createElement("input");
      gameName.type = "text";
      gameName.className = "cx-input";
      gameName.placeholder = "Game name";
      gf.appendChild(gcap);
      gf.appendChild(gameName);
      form.appendChild(gf);
    }

    // Subject dropdown — only on the two feedback flows, matching the layout
    // in your reference screenshots.
    var subject = null;
    if (kind === "site" || kind === "game") {
      var sf = document.createElement("div");
      sf.className = "cx-field sel";
      subject = document.createElement("select");
      subject.className = "cx-select";
      subject.required = true;
      subject.innerHTML =
        '<option value="" selected disabled>Select an option</option>' +
        SUBJECTS.map(function (s) { return '<option>' + esc(s) + "</option>"; }).join("");
      sf.appendChild(subject);
      form.appendChild(sf);
    }

    var ef = document.createElement("div");
    ef.className = "cx-field";
    var cap = document.createElement("span");
    cap.className = "cx-cap";
    cap.textContent = "Your email (optional)";
    var email = document.createElement("input");
    email.type = "email";
    email.className = "cx-input";
    email.placeholder = "So we can reply";
    email.autocomplete = "email";
    ef.appendChild(cap);
    ef.appendChild(email);
    form.appendChild(ef);

    var mf = document.createElement("div");
    mf.className = "cx-field";
    var msg = document.createElement("textarea");
    msg.className = "cx-textarea";
    msg.placeholder = PLACEHOLDER[kind];
    msg.required = true;
    mf.appendChild(msg);
    form.appendChild(mf);

    stagger(form);
    root.appendChild(form);

    // Footer send button
    foot.hidden = false;
    var send = document.createElement("button");
    send.type = "button";
    send.className = "cx-send";
    send.textContent = kind === "game" || kind === "site" ? "Send feedback" : "Send message";
    send.disabled = true;

    var note = document.createElement("p");
    note.className = "cx-note";
    note.textContent = "You'll pick how to send on the next step. Nothing is sent or stored by this site.";

    foot.appendChild(send);
    foot.appendChild(note);

    function validate() {
      var ok = msg.value.trim().length > 2;
      if (subject) ok = ok && !!subject.value;
      send.disabled = !ok;
    }
    msg.addEventListener("input", validate);
    if (subject) subject.addEventListener("change", validate);

    send.addEventListener("click", function () {
      if (send.disabled) return;

      var gLabel = chosenGame ? chosenGame.title
                 : (gameName && gameName.value.trim()) || "Unspecified game";
      var subjLine;
      if (kind === "game") {
        subjLine = "[Game] " + gLabel + " — " + (subject ? subject.value : "Feedback");
      } else if (kind === "site") {
        subjLine = "[Site] " + subject.value;
      } else if (kind === "suggest") {
        subjLine = "[Suggestion] New game for the vault";
      } else if (kind === "business") {
        subjLine = "[Business] Inquiry";
      } else {
        subjLine = "[Contact] Other";
      }

      var lines = [msg.value.trim()];
      var facts = [];
      if (chosenGame) facts.push("Game: " + chosenGame.title + (chosenGame.category ? " (" + chosenGame.category + ")" : ""));
      else if (kind === "game") facts.push("Game: " + gLabel);
      if (email.value.trim()) facts.push("Reply to: " + email.value.trim());
      if (facts.length) lines.push("", "---", facts.join("\n"));

      // Hand the composed message to the chooser instead of firing mailto
      // straight away. A bare mailto: goes to whatever the OS has registered
      // as the default handler, which on Windows is very often Outlook even
      // for people who only use Gmail — and there is no way to detect that
      // from a web page. Letting the person pick is the only reliable fix.
      pending = { subject: subjLine, body: lines.join("\n") };
      render("sent");
    });

    setTimeout(function () { (gameName || subject || msg).focus(); }, 320);
  }

  /* Sending, without depending on anyone else's login state.
   *
   * This started out as a plain mailto:, which opened the wrong program for
   * people whose OS default is not the mail client they actually use. The fix
   * was to offer Gmail and Outlook web-compose links — and those turned out to
   * be worse: they redirect-loop (ERR_TOO_MANY_REDIRECTS) whenever the browser
   * is signed out of Google, signed into several Google accounts, or blocking
   * the cookies accounts.google.com needs. That failure happens in a new
   * cross-origin tab, so this page cannot even detect it.
   *
   * I tried the modern "/mail/u/0/?tf=cm" form too. Still a loop, this time on
   * accounts.google.com. Whether those links work depends on the visitor's
   * Google session, how many accounts they are signed into, and their cookie
   * settings — none of which a web page can see or control, and the failure
   * happens in a cross-origin tab where it cannot even be detected.
   *
   * So the webmail links are removed entirely. What is left cannot fail:
   * copying to the clipboard is primary, and the device's own mail app is
   * secondary.
   *
   * The address is never displayed. It rides along invisibly in the clipboard
   * and in the mailto: URL. It only becomes visible if the clipboard API
   * itself fails, at which point showing it is the only way to be useful.
   */
  function composed() {
    return "To: " + mailTo() +
           "\nSubject: " + pending.subject +
           "\n\n" + pending.body;
  }

  function screenSent(root) {
    headTitle.textContent = "Send your message";
    headSub.textContent = "";
    backBtn.hidden = false;

    if (!pending) { render("menu"); return; }

    var wrap = document.createElement("div");
    wrap.className = "cx-stagger";

    var lead = document.createElement("p");
    lead.className = "cx-note";
    lead.style.margin = "0 0 16px";
    lead.textContent =
      "Your message is ready. Copying is the reliable way — it works on every " +
      "device and every email service.";
    wrap.appendChild(lead);

    // --- primary: copy -------------------------------------------------------
    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "cx-primary-action";
    copyBtn.innerHTML = "<b>Copy the message</b><em>Then paste it into your email</em>";

    var fallback = null;
    function revealText() {
      if (fallback) return;
      fallback = document.createElement("textarea");
      fallback.className = "cx-textarea";
      fallback.readOnly = true;
      fallback.value = composed();
      fallback.style.marginTop = "12px";
      wrap.insertBefore(fallback, copyBtn.nextSibling);
      fallback.focus();
      fallback.select();
    }

    copyBtn.addEventListener("click", function () {
      var text = composed();
      function ok() {
        copyBtn.classList.add("done");
        copyBtn.innerHTML = "<b>Copied ✓</b><em>Address and message are on your clipboard</em>";
      }
      function no() {
        copyBtn.innerHTML = "<b>Select and copy this</b><em>Your browser blocked automatic copying</em>";
        revealText();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, no);
      } else { no(); }
    });
    wrap.appendChild(copyBtn);

    // --- secondary: the device's own mail app --------------------------------
    var appBtn = document.createElement("button");
    appBtn.type = "button";
    appBtn.className = "cx-row cx-send-opt";
    appBtn.innerHTML =
      '<span class="cx-ico">▤</span>' +
      '<span class="cx-txt">Open my mail app<em>Uses this device\'s default email program</em></span>' +
      '<span class="cx-chev">›</span>';
    appBtn.addEventListener("click", function () {
      window.location.href = "mailto:" + mailTo() +
        "?subject=" + encodeURIComponent(pending.subject) +
        "&body=" + encodeURIComponent(pending.body);
    });
    wrap.appendChild(appBtn);

    var note = document.createElement("p");
    note.className = "cx-note";
    note.style.marginTop = "18px";
    note.textContent =
      "There used to be Gmail and Outlook buttons here. They opened a compose " +
      "window only if you were already signed in on this browser with a single " +
      "account, and returned a redirect error otherwise — so they are gone. " +
      "Copying always works.";
    wrap.appendChild(note);

    stagger(wrap);
    root.appendChild(wrap);

    foot.hidden = false;
    var done = document.createElement("button");
    done.type = "button";
    done.className = "cx-send";
    done.textContent = "Done";
    done.addEventListener("click", close);
    foot.appendChild(done);
  }

  // --- wire up the existing Contact links ------------------------------------
  // Capture phase so this runs before app.js's page router.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a, button");
    if (!a) return;

    var href = (a.getAttribute("href") || "").toLowerCase();
    var isContact =
      a.getAttribute("data-contact-open") !== null ||
      a.getAttribute("data-panel") === "contact" ||
      href === "#contact" ||
      href.indexOf("contact.html") >= 0;

    if (!isContact) return;
    e.preventDefault();
    // stopImmediatePropagation, NOT stopPropagation: app.js registers its page
    // router as another capture listener on `document` itself. stopPropagation
    // only blocks listeners on *other* nodes, so app.js would still run and
    // reveal the old #contact-page section behind this panel.
    e.stopImmediatePropagation();
    open();
  }, true);

  window.OGContact = { open: open, close: close };
})();
