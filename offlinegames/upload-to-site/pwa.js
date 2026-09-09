/* pwa.js — service worker registration.
 *
 * WAS: registered /sw.js unconditionally.
 *
 * Two problems with that. First, index.html and news.html deliberately
 * *unregister* the service worker inside your Android WebView wrapper —
 * and then pwa.js, loaded at the bottom of the same page, registered it
 * straight back. Second, it never told an already-installed worker to
 * check for a new one before registering, so a phone stuck on og-v3 or
 * og-v5 could sit there for a long time.
 *
 * This version: same WebView guard as index.html, and an explicit
 * update() on whatever is already installed so the new sw.js is picked
 * up on the very next page load.
 */
(function () {
  if (!("serviceWorker" in navigator)) return;

  var ua = navigator.userAgent || "";
  var isWebView = /; wv\)/.test(ua) || /WebView/i.test(ua);

  if (isWebView) {
    // The wrapper app ships its own assets; a service worker only gets in
    // the way and is another place for stale files to hide.
    navigator.serviceWorker.getRegistrations().then(function (rs) {
      rs.forEach(function (r) { r.unregister(); });
    }).catch(function () {});
    return;
  }

  navigator.serviceWorker.getRegistrations().then(function (rs) {
    return Promise.all(rs.map(function (r) { return r.update(); }));
  }).catch(function () {}).then(function () {
    return navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }).then(function (reg) {
    // When a new worker takes over, reload once so the page is not left
    // rendering assets the old worker handed it.
    if (!navigator.serviceWorker.controller) return;
    var reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
    if (reg && reg.waiting) reg.waiting.postMessage({ og: "skipWaiting" });
  }).catch(function () {});
})();