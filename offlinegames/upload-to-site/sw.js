/* sw.js — service worker for offlinegames.art
 *
 * VERSION og-v6 — the "my updated game is not showing up" fix.
 *
 * There were THREE independent layers holding the old copy of a game.
 * All three had to go, and this file only fixes two of them; the third is
 * in _headers, which must be deployed alongside this file.
 *
 *   1. og-v3 served everything under /games/ and /covers/ cache-first.
 *      Once a game file was in the SW cache it was NEVER re-fetched.
 *      Fixed in og-v5.
 *
 *   2. og-v5 was "network first" — but network-first written as plain
 *      fetch(req) is a lie. fetch() consults the browser's own HTTP disk
 *      cache before it touches the network, and _headers was stamping
 *      /games/* with max-age=604800 and /covers/* with
 *      "immutable, max-age=2592000". So fetch() happily returned a
 *      week-old (or month-old, and immutable so not even revalidated)
 *      copy out of the disk cache and the service worker dutifully
 *      "refreshed" its cache with the stale bytes. That is exactly why
 *      incognito looked correct: a fresh incognito profile has no HTTP
 *      disk cache to poison.
 *      Fixed here by netFetch(), which forces cache: "no-cache" so the
 *      request always goes to the server with a validator and can return
 *      304 or fresh bytes, but never a blind disk-cache hit.
 *
 *   3. _headers itself. Even with this file deployed, the browser can
 *      still satisfy a *non*-service-worker request (a direct visit, a
 *      hard link, an iframe in a browser where the SW has not activated
 *      yet) from the immutable disk entry. The corrected _headers
 *      shipped next to this file replaces the long max-ages with
 *      "max-age=0, must-revalidate". Deploy both or the symptom stays.
 *
 * Strategy now: everything same-origin is network-first with the cache as
 * an offline fallback only. Offline play still works — the cache is still
 * populated on every successful fetch — but an online phone always sees
 * what is actually on the server.
 */
"use strict";

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

/* The whole point of og-v6.
 *
 * new Request(req, { cache: "no-cache" }) keeps the original request's
 * method, headers, mode and credentials but tells the browser: do not
 * serve this out of the HTTP disk cache without asking the server first.
 * The server may still answer 304 Not Modified, so this is cheap — it is
 * a revalidation, not a full re-download of every game on every load.
 *
 * Some older WebViews throw on constructing a Request from a Request with
 * an overridden cache mode, hence the two fallbacks. */
function netFetch(req) {
  try {
    return fetch(new Request(req, { cache: "no-cache" }));
  } catch (e) {
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

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      // addAll fails the whole install if any single file 404s, so add them
      // one at a time and tolerate misses.
      return Promise.all(SHELL_FILES.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      // Deletes og-v3 and og-v5 caches outright, so every phone that has
      // been carrying stale games starts clean the moment this activates.
      return Promise.all(keys.map(function (k) {
        if (k.indexOf(VERSION) !== 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function put(cacheName, req, res) {
  if (!res || !res.ok || res.type === "opaque") return;
  var copy = res.clone();
  caches.open(cacheName).then(function (c) {
    c.put(req, copy).catch(function () {});
  });
}

/* Network first, always with a real network round trip. Cache is the
 * offline fallback and nothing else. */
function networkFirst(req, cacheName) {
  return netFetch(req).then(function (res) {
    put(cacheName, req, res);
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("/index.html");
      return new Response("", { status: 504, statusText: "Offline" });
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

  // Never touch the admin tooling or the raw catalog source.
  if (path.indexOf("/admin-hash-tool") === 0 ||
      path.indexOf("/catalog.source") === 0) {
    return;
  }

  /* Games, covers, catalog, HTML, CSS, JS — all of it network-first.
   * Games in particular: you edit them and redeploy, so treating them as
   * immutable was the original mistake. */
  var bucket = (path.indexOf("/games/") === 0 || path.indexOf("/covers/") === 0)
    ? ASSETS
    : SHELL;

  e.respondWith(networkFirst(req, bucket));
});

/* Escape hatches you can run from the console on a stuck phone:
 *   navigator.serviceWorker.controller.postMessage({og:"purge"})
 *   navigator.serviceWorker.controller.postMessage({og:"version"})   */
self.addEventListener("message", function (e) {
  var d = e.data || {};
  if (d.og === "purge") {
    e.waitUntil(caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }));
  }
  if (d.og === "version" && e.source) {
    e.source.postMessage({ og: "version", value: VERSION });
  }
});