/* sw.js — service worker for offlinegames.art
 *
 * ============================================================================
 * WHY YOUR UPDATES STILL WEREN'T SHOWING (and incognito was fine)
 * ============================================================================
 *
 * There were three layers holding your old files. The first two are fixed;
 * this version fixes the third, which was the one still biting you.
 *
 * 1. This worker used to serve /games/ and /covers/ with a cache-first
 *    strategy — once a file was cached it was NEVER re-requested. Fixed.
 *
 * 2. _headers told the browser to keep /games/* for 7 days and /covers/* for
 *    30 days with "immutable". Fixed.
 *
 * 3. THE ONE THAT KEPT IT BROKEN. Fixing _headers only changes the headers on
 *    NEW responses. It cannot reach back and expire what a browser already
 *    stored under the OLD headers. Those entries are still sitting on disk,
 *    still marked "immutable, max-age=2592000", and still considered fresh for
 *    up to another 30 days.
 *
 *    And a plain fetch(request) inside a service worker consults that same
 *    HTTP disk cache before it touches the network. So a fresh-looking stale
 *    entry was returned instantly and my "network first" worker never made a
 *    network request at all. It was network-first in name and HTTP-cache-first
 *    in practice, for exactly the files that were poisoned.
 *
 *    The fix is netFetch() below: every network request is reissued with
 *    cache: "no-cache", which forces the browser to revalidate with the server
 *    instead of trusting its stored copy. Changed file -> 200 with new bytes.
 *    Unchanged file -> 304 Not Modified, a few bytes, so it stays fast.
 *
 *    This is what un-sticks browsers that are already poisoned, without anyone
 *    having to clear anything by hand.
 *
 * ============================================================================
 * STRATEGY
 * ============================================================================
 *
 * Everything on this domain is NETWORK FIRST, revalidated, with the cache as
 * an offline fallback. While you are actively changing games, "never stale"
 * matters more than shaving a round-trip, and 304s keep the cost small.
 *
 * Offline still works: if the network fails, the cached copy is served.
 */
"use strict";

/* Bump this to force every browser to drop its caches on next visit. */
var VERSION = "og-v6";
var SHELL   = VERSION + "-shell";
var ASSETS  = VERSION + "-assets";

var SHELL_FILES = [
  "/",
  "/index.html",
  "/styles.css",
  "/ui-fx.css",
  "/console-ui.css",
  "/app.js",
  "/ui-fx.js",
  "/console-ui.js",
  "/library-sync.js",
  "/contact-panel.js",
  "/site-admin.js",
  "/manifest.webmanifest"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      // addAll fails the whole install if any single file 404s, so add them
      // one at a time and tolerate misses. Each is fetched with revalidation
      // so the precache cannot be seeded from a stale disk copy.
      return Promise.all(SHELL_FILES.map(function (u) {
        return fetch(u, { cache: "no-cache", credentials: "same-origin" })
          .then(function (res) { if (res && res.ok) return c.put(u, res); })
          .catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        // Anything not belonging to the current VERSION is deleted, so bumping
        // VERSION above is a one-shot purge for every visitor.
        if (k.indexOf(VERSION) !== 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* --------------------------------------------------------------------------
   Fetch from the network, deliberately bypassing the browser's stored copy.

   cache: "no-cache" does NOT mean "don't cache". It means "always ask the
   server whether my copy is still good". That is precisely what defeats an
   entry already saved under immutable/long-max-age headers.
   -------------------------------------------------------------------------- */
function netFetch(req) {
  // Preferred: clone the original request, keeping its headers and mode, and
  // only override the cache mode.
  try {
    return fetch(new Request(req, { cache: "no-cache" }));
  } catch (e) {
    // A navigation request cannot be cloned by the Request constructor, so
    // rebuild it from the URL instead.
    try {
      return fetch(new Request(req.url, {
        cache: "no-cache",
        credentials: "same-origin",
        redirect: "follow"
      }));
    } catch (e2) {
      return fetch(req);
    }
  }
}

/* A Range request (audio/video seeking) must not be written to the cache —
   cache.put() throws on a 206 Partial Content response. */
function cacheable(req, res) {
  return res && res.ok && res.status === 200 && !req.headers.get("range");
}

function put(cacheName, req, res) {
  if (!cacheable(req, res)) return;
  var copy = res.clone();
  caches.open(cacheName).then(function (c) {
    c.put(req, copy).catch(function () {});
  });
}

/* Fresh when online, cached when not. */
function networkFirst(req, cacheName) {
  return netFetch(req).then(function (res) {
    put(cacheName, req, res);
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      // Only a page navigation should fall back to the shell. Returning
      // index.html for a failed image request would be nonsense.
      if (req.mode === "navigate") return caches.match("/index.html");
      return Response.error();
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // let ads/fonts go direct

  var path = url.pathname;

  // Never touch the admin tooling or the private master catalog.
  if (path.indexOf("/admin-hash-tool") === 0 || path.indexOf("/catalog.source") === 0) {
    return;
  }

  // Everything else: always revalidated, cache only as an offline fallback.
  e.respondWith(networkFirst(req, /\/(games|covers)\//.test(path) ? ASSETS : SHELL));
});

/* --------------------------------------------------------------------------
   Escape hatch. Run this in the browser console on your site to wipe every
   cache immediately without touching DevTools:

     navigator.serviceWorker.controller.postMessage({ og: "purge" })

   Ask for the running version with:

     navigator.serviceWorker.controller.postMessage({ og: "version" })
   -------------------------------------------------------------------------- */
self.addEventListener("message", function (e) {
  if (!e.data) return;

  if (e.data.og === "version") {
    if (e.source) e.source.postMessage({ og: "version", version: VERSION });
    return;
  }

  if (e.data.og !== "purge") return;
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () {
        return self.clients.matchAll().then(function (cs) {
          cs.forEach(function (c) { c.postMessage({ og: "purged" }); });
        });
      })
  );
});