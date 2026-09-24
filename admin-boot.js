/* admin-boot.js — loads the editing tools only for you, never for visitors.
 *
 * Why: site-admin.js, admin-forms.js and admin-export.js are about 40 KB of
 * editing code, and site-admin.js contains the hash of your admin password.
 * A visitor has no use for any of it, so nothing is requested unless the
 * tools are switched on for this browser.
 *
 * Turn the tools ON  : add #admin06 to the address — the site's own admin
 *                      trigger, which then asks for your password.
 *                      (#admin works too and just loads the tools.)
 * Turn the tools OFF : add #noadmin to the address
 * The choice is remembered in this browser only.
 *
 * WHERE THE TOOLS LIVE
 *   The whole toolkit is one folder: keep-private/admin-tools/
 *   To edit the site : move that folder into upload-to-site/  (so the files
 *                      sit at upload-to-site/admin-tools/…), open #admin06,
 *                      make your changes, export the new catalog.js.
 *   When finished    : move the folder back to keep-private/.
 *
 * Nothing else needs changing. If the folder is not there, the site runs
 * normally and this file tells you the tools are missing.
 *
 * The scripts are written into the page while it is still parsing, so they
 * keep loading before app.js exactly as they did before. If the files are not
 * on the server — the recommended setup — nothing breaks: the site checks for
 * the tools before using them, and simply runs without them.
 */
(function () {
  "use strict";
  var KEY = "og-admin-tools";
  var on = false;

  // Typing #admin into an already-open page does not reload it, so watch for
  // the change and reload once, otherwise nothing would appear to happen.
  var ON = { "#admin06": 1, "#admin": 1 };   // #admin06 is the site's own trigger

  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").toLowerCase();
    if (!ON[h] && h !== "#noadmin") return;
    try {
      var was = localStorage.getItem(KEY) === "1";
      var want = !!ON[h];
      if (was === want) return;
      if (want) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY);
    } catch (e) { return; }
    location.reload();
  });

  try {
    var h0 = (location.hash || "").toLowerCase();
    if (h0 === "#noadmin") { localStorage.removeItem(KEY); return; }
    if (ON[h0]) localStorage.setItem(KEY, "1");
    on = localStorage.getItem(KEY) === "1";
  } catch (e) { return; }
  if (!on) return;
  var DIR = "admin-tools/";   // relative: works from the folder and on the web
  var files = ["site-admin.js", "admin-forms.js", "admin-export.js"];
  for (var i = 0; i < files.length; i++) {
    document.write('<script src="' + DIR + files[i] + '"><\/script>');
  }

  // Ask for the password once the page has finished building. Doing it earlier
  // does not work: console-ui.js rebuilds the layout after app.js runs and
  // discards anything added during parsing.
  if (!ON[h0]) return;                     // only when the admin trigger was used

  // A visible message, since these problems are otherwise silent.
  function note(text) {
    var w = document.createElement("div");
    w.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:9999;max-width:min(560px,92vw);" +
      "background:#1b1030;color:#fff;border:1px solid #ff4fa0;border-radius:12px;padding:13px 16px;" +
      "font:14px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 18px 44px -18px #000;cursor:pointer";
    w.textContent = text;
    w.title = "Click to dismiss";
    w.addEventListener("click", function () { w.remove(); });
    document.body.appendChild(w);
    setTimeout(function () { if (w.parentNode) w.remove(); }, 20000);
  }
  window.addEventListener("load", function () {
    setTimeout(function () {
      // The password check uses crypto.subtle, which browsers only allow on
      // https:// or localhost. Opened straight from the folder (file://) it
      // cannot work, so say that plainly instead of failing at the prompt.
      var secure = window.isSecureContext || location.protocol === "https:" ||
                   location.hostname === "localhost" || location.hostname === "127.0.0.1";
      if (!secure || !(window.crypto && window.crypto.subtle)) {
        note("Signing in needs https or localhost. Double-clicking index.html will not work — run START-ADMIN.bat, then open http://localhost:8080/#admin06");
        return;
      }
      var SA = window.SiteAdmin;
      if (!SA) {
        note("Editing tools not found. Move the admin-tools folder into upload-to-site (so it sits at upload-to-site/admin-tools/), then reload this page.");
        return;
      }
      if (SA.isAdmin()) { if (window.OG_REFRESH_ADMIN) window.OG_REFRESH_ADMIN(); return; }
      SA.promptSignIn(function () { if (window.OG_REFRESH_ADMIN) window.OG_REFRESH_ADMIN(); });
    }, 300);
  });
})();
