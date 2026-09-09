/* Offline assets and same-folder songs. Change the version when shipping updates. */
const SCOPE = new URL(self.registration.scope);
const PREFIX = `piano-world:${encodeURIComponent(SCOPE.pathname)}:`;
const CACHE = `${PREFIX}endless-v2`;
const absolute = path => new URL(path, SCOPE).href;
const CORE = [
  "./", "./index.html", "./piano-world.html", "./piano-world.css", "./piano-world.js",
  "./images/piano-world-home.jpg", "./images/piano-world-play.jpg",
  "./images/world-tokyo.jpg", "./images/world-gym.jpg", "./images/world-villain.jpg",
  "./images/world-showtime.jpg", "./images/song-cover-dream.jpg"
].map(absolute);
const SONGS = [
  "./ordinary.mp3", "./midnight.mp3", "./tokyo.mp3",
  "./phonk-gym.mp3", "./villain.mp3", "./showtime.mp3"
].map(absolute);
const ALLOWED = new Set([...CORE, ...SONGS]);
const AUDIO = new Set(SONGS);
const fullAudioLoads = new Map();

function validResponse(url, response) {
  if (!response || response.status !== 200) return false;
  const type = response.headers.get("Content-Type") || "";
  if (AUDIO.has(url)) return /^(audio\/|application\/(octet-stream|ogg))/i.test(type);
  if (/\.js$/.test(url)) return /javascript|ecmascript/i.test(type);
  if (/\.css$/.test(url)) return /text\/css/i.test(type);
  if (/\.(jpg|jpeg|png)$/.test(url)) return /^image\//i.test(type);
  return /text\/html/i.test(type);
}

async function store(cache, url, response) {
  if (!validResponse(url, response)) return;
  try { await cache.put(url, response.clone()); }
  catch (_) { /* A full browser cache must not block network playback. */ }
}

async function cacheFile(url) {
  try {
    const cache = await caches.open(CACHE);
    const response = await fetch(new Request(url, { cache: "reload" }));
    await store(cache, url, response);
  } catch (_) { /* Missing MP3s can be supplied later. */ }
}

function cacheFullAudio(url) {
  if (!fullAudioLoads.has(url)) {
    fullAudioLoads.set(url, cacheFile(url).finally(() => fullAudioLoads.delete(url)));
  }
  return fullAudioLoads.get(url);
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    await Promise.all(CORE.map(cacheFile));
    await Promise.all(SONGS.map(cacheFullAudio));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Leave all unrelated website caches alone.
    await Promise.all(keys.filter(key => key !== CACHE && (key.startsWith(PREFIX) || key === "piano-world-v1")).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const key = url.origin + url.pathname;
  if (url.origin !== SCOPE.origin || !ALLOWED.has(key)) return;

  event.respondWith((async () => {
    let cache;
    try { cache = await caches.open(CACHE); }
    catch (_) { return fetch(request); }
    const cached = await cache.match(key);
    const isAudio = AUDIO.has(key);
    const range = request.headers.get("Range");
    if (isAudio && validResponse(key, cached)) {
      return range ? rangeResponse(cached, range) : cached;
    }
    if (/\.(jpg|jpeg|png)$/.test(key) && validResponse(key, cached)) return cached;
    try {
      // Network-first code prevents an older cached game masking new releases.
      const response = await fetch(request);
      if (isAudio && response.status === 206) {
        // Cache only the complete recording, never a partial range response.
        event.waitUntil(cacheFullAudio(key));
        return response;
      }
      if (validResponse(key, response)) {
        await store(cache, key, response);
        return isAudio && range ? rangeResponse(response, range) : response;
      }
      if (validResponse(key, cached)) return cached;
      return response;
    } catch (_) {
      if (validResponse(key, cached)) return range && isAudio ? rangeResponse(cached, range) : cached;
      if (request.mode === "navigate") {
        const page = await cache.match(absolute("./piano-world.html"));
        if (page) return page;
      }
      return new Response("This file is not saved for offline use yet.", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});

async function rangeResponse(response, rangeHeader) {
  const buffer = await response.arrayBuffer();
  const size = buffer.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");
  const invalid = () => new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  if (!match || (!match[1] && !match[2]) || !size) return invalid();
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return invalid();
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return invalid();
    end = Math.min(end, size - 1);
  }
  const headers = new Headers(response.headers);
  headers.delete("Content-Encoding");
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Accept-Ranges", "bytes");
  return new Response(buffer.slice(start, end + 1), { status: 206, statusText: "Partial Content", headers });
}
