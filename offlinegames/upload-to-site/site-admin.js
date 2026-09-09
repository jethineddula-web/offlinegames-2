// site-admin.js — local-only editing tools for OfflineGames.  v2
//
// WHAT CHANGED FROM v1, AND WHY
//
// v1 stored your admin password in localStorage as plain readable text, and
// unlocked itself whenever sessionStorage held the string "1". That meant:
//   1. Anyone opening devtools on ANY browser could type one line and become
//      "admin" — sessionStorage.setItem('og-admin-session','1')
//   2. On a browser that had never seen the site, the first-run flow happily
//      let a stranger CREATE a password and unlock the tools.
//   3. Your real password sat in cleartext on your own machine.
//
// v2 fixes all three:
//   1. The unlocked flag now lives in a closure variable that no console can
//      reach or set. There is no storage key to forge.
//   2. There is no "create a password" flow any more. The password hash is
//      baked into ADMIN below, so a stranger's browser only ever sees a
//      password prompt it cannot satisfy.
//   3. The password is stored as a PBKDF2-SHA256 hash (210,000 rounds) with a
//      random salt, so the file reveals nothing about the password itself.
//
// HONEST LIMIT: this site has no server. Everything here runs on the visitor's
// machine, so a determined person with devtools can always reach the editing
// functions directly. What they still CANNOT do is change your live site —
// edits only ever produce a file you choose to upload. If you want a real
// lock, put Cloudflare Access in front of an /admin/ path; notes are in
// SECURITY.md.

window.SiteAdmin = (function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // REPLACE THIS BLOCK with the output of admin-hash-tool.html.
  // Open that file locally in your browser, type the password you want, and
  // paste the generated object over this one. Never commit the password itself.
  // ---------------------------------------------------------------------------
  var ADMIN = {
    salt: "30e705b603fb36b70d593d64c343e5f7",
    hash: "7357ebabd3b207f90f812598d112281a8e868117d2be76b3c1dabc40a5bc64b0",
    iterations: 210000
  };

  // ---------------------------------------------------------------------------
  // NOTE ON CATALOG OBFUSCATION
  //
  // An earlier version of this file emitted an obfuscated catalog.js: a base64
  // payload plus an XOR decoder. It hid the game list from casual copying, but
  // that structure is indistinguishable from a JavaScript packer, and antivirus
  // heuristics flag it as malware — which is exactly what happened.
  //
  // A false-positive malware warning on a family games site (browser download
  // blocks, possible Safe Browsing listing, AdSense risk) costs far more than a
  // competitor reading a list of game titles that are visible on the page
  // anyway. So the catalog is plain readable JavaScript again, deliberately.
  // ---------------------------------------------------------------------------

  // Unlocked state lives HERE — a private closure variable. Not in
  // localStorage, not in sessionStorage, not on window. Nothing outside this
  // file can set it, which is what kills the old one-line bypass.
  var unlocked = false;

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "g" + Date.now() + Math.random().toString(16).slice(2);
  }

  function showToast(msg, isError) {
    var container = document.getElementById("toast-container");
    if (!container) return;
    var t = document.createElement("div");
    t.className = "toast" + (isError ? " error" : "");
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  function isAdmin() { return unlocked === true; }
  function logout() { unlocked = false; }

  // --- password hashing -----------------------------------------------------

  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function bytesToHex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }

  // PBKDF2 is deliberately slow. That is the point: it makes guessing the
  // password from the stored hash cost real time per attempt.
  function derive(password, saltHex, iterations) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error("no-webcrypto"));
    return subtle.importKey(
      "raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
    ).then(function (key) {
      return subtle.deriveBits({
        name: "PBKDF2",
        salt: hexToBytes(saltHex),
        iterations: iterations,
        hash: "SHA-256"
      }, key, 256);
    }).then(bytesToHex);
  }

  // Constant-time-ish comparison: always walks the whole string so the time
  // taken does not leak how many characters matched.
  function safeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // --- modal plumbing -------------------------------------------------------

  function closeModal() {
    var overlay = document.getElementById("modal-overlay");
    if (overlay) {
      overlay.classList.remove("in");
      setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 180);
    }
    document.removeEventListener("keydown", onEscClose);
  }
  function onEscClose(e) { if (e.key === "Escape") closeModal(); }

  function openModal(innerHtml) {
    closeModal();
    var overlay = document.createElement("div");
    overlay.id = "modal-overlay";
    overlay.className = "modal-overlay";
    overlay.innerHTML = '<div class="modal-box">' + innerHtml + "</div>";
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("in"); });
    document.addEventListener("keydown", onEscClose);
    return overlay;
  }

  // --- sign in --------------------------------------------------------------

  var attempts = 0;
  var lockedUntil = 0;

  function promptSignIn(onSuccess) {
    if (ADMIN.hash === "REPLACE_ME_HASH") {
      openModal(
        '<div class="modal-form">' +
          '<div class="modal-header"><h2>Editing not configured</h2>' +
          '<button class="modal-close" id="sa-close0">&#10005;</button></div>' +
          '<p style="color:var(--text-muted,#8b93a7);font-size:13px;line-height:1.6">' +
          'No admin password has been set for this build. Open <b>admin-hash-tool.html</b> ' +
          'on your own machine, generate a hash, and paste it into the ADMIN block at ' +
          'the top of <b>site-admin.js</b>.</p>' +
        "</div>"
      );
      var c0 = document.getElementById("sa-close0");
      if (c0) c0.addEventListener("click", closeModal);
      return;
    }

    var html =
      '<div class="modal-form">' +
        '<div class="modal-header"><h2>Editing sign in</h2>' +
        '<button class="modal-close" id="sa-close2">&#10005;</button></div>' +
        '<div class="field"><label>Password</label>' +
        '<input type="password" id="sa-pass" placeholder="Enter password" autocomplete="current-password"></div>' +
        '<div class="field-error" id="sa-err2">Incorrect password.</div>' +
        '<div class="subform-actions">' +
        '<button class="btn btn-primary" id="sa-submit">Sign in</button>' +
        '<button class="btn btn-ghost" id="sa-cancel2">Cancel</button></div>' +
      "</div>";

    openModal(html);
    document.getElementById("sa-close2").addEventListener("click", closeModal);
    document.getElementById("sa-cancel2").addEventListener("click", closeModal);

    var input = document.getElementById("sa-pass");
    var err = document.getElementById("sa-err2");
    var submit = document.getElementById("sa-submit");
    input.focus();

    function fail(msg) {
      err.textContent = msg || "Incorrect password.";
      err.classList.add("show");
      input.value = "";
      input.focus();
    }

    function attempt() {
      // Simple throttle: after 5 wrong tries, cool off for 30 seconds. Stops
      // someone sitting there trying 1234, 0000, password, ...
      var now = Date.now();
      if (now < lockedUntil) {
        fail("Too many attempts. Wait " + Math.ceil((lockedUntil - now) / 1000) + "s.");
        return;
      }
      submit.disabled = true;
      submit.textContent = "Checking…";
      derive(input.value, ADMIN.salt, ADMIN.iterations).then(function (got) {
        submit.disabled = false;
        submit.textContent = "Sign in";
        if (safeEqual(got, ADMIN.hash)) {
          attempts = 0;
          unlocked = true;
          closeModal();
          onSuccess();
        } else {
          attempts++;
          if (attempts >= 5) { lockedUntil = Date.now() + 30000; attempts = 0; }
          fail();
        }
      }).catch(function () {
        submit.disabled = false;
        submit.textContent = "Sign in";
        fail("This browser cannot verify the password (needs HTTPS).");
      });
    }

    submit.addEventListener("click", attempt);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") attempt(); });
  }

  // --- catalog export -------------------------------------------------------

  function jsStr(s) { return JSON.stringify(s == null ? "" : s); }

  // The readable master copy. Keep this file private — it is your source of
  // truth and the thing you edit if you ever want to hand-fix something.
  function generateSourceJs(games, news) {
    var lines = [];
    lines.push("/* OfflineGames catalog — " + games.length + " games, " + news.length + " news posts.");
    lines.push("   embedUrl must match a file or folder inside games/");
    lines.push("   e.g. games/pop-a-lock/index.html  or  games/buzz-game.html");
    lines.push("*/");
    lines.push('window.LIVE_ORIGIN = "";');
    lines.push("window.SITE_GAMES = [");
    games.forEach(function (g) {
      lines.push("  {");
      lines.push("    id: " + jsStr(g.id) + ",");
      lines.push("    title: " + jsStr(g.title) + ",");
      lines.push("    description: " + jsStr(g.description) + ",");
      lines.push("    category: " + jsStr(g.category) + ",");
      lines.push("    coverUrl: " + jsStr(g.coverUrl) + ",");
      lines.push("    embedUrl: " + jsStr(g.embedUrl) + ",");
      lines.push("    catalog: " + (g.catalog || 0) + ",");
      lines.push("    dateAdded: " + jsStr(g.dateAdded) + ",");
      lines.push("  },");
    });
    lines.push("];");
    lines.push("window.SITE_NEWS = [");
    news.forEach(function (n) {
      lines.push("  {");
      lines.push("    id: " + jsStr(n.id) + ",");
      lines.push("    title: " + jsStr(n.title) + ",");
      lines.push("    date: " + jsStr(n.date) + ",");
      lines.push("    excerpt: " + jsStr(n.excerpt) + ",");
      lines.push("    emoji: " + jsStr(n.emoji || "📰") + ",");
      lines.push("    image: " + jsStr(n.image || "") + ",");
      lines.push("  },");
    });
    lines.push("];");
    lines.push("window.CAT_ICONS = " + (window.CAT_ICONS ? JSON.stringify(window.CAT_ICONS) : "{}") + ";");
    return lines.join("\n");
  }

  // The file you upload. Kept deliberately readable — see the note at the top
  // of this file and the "catalog obfuscation" section of SECURITY.md for why
  // the packed variant was removed.
  function generateSiteDataJs(games, news) {
    return generateSourceJs(games, news);
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: "text/javascript" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  return {
    escapeHtml: escapeHtml,
    uid: uid,
    showToast: showToast,
    isAdmin: isAdmin,
    logout: logout,
    openModal: openModal,
    closeModal: closeModal,
    promptSignIn: promptSignIn,
    generateSiteDataJs: generateSiteDataJs,
    generateSourceJs: generateSourceJs,
    downloadText: downloadText
  };
})();
