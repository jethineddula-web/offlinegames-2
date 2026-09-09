(function (N) {
'use strict';

async function enterFullscreen(notify, silent = false) {
  let locked = false;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (screen.orientation?.lock) {
      for (const direction of ['portrait-primary', 'portrait']) {
        try { await screen.orientation.lock(direction); locked = true; break; } catch { /* Try the browser's other portrait mode. */ }
      }
    }
  } catch { /* Fullscreen can be blocked by the browser or its embedding page. */ }
  if (!locked && !silent) notify('Portrait locking is not available in this browser. The game still fits your screen.');
  updateOrientation();
  return locked;
}

function updateOrientation() {
  const button = document.getElementById('portrait-nudge');
  if (!button) return;
  const phoneLike = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 740;
  button.hidden = !phoneLike || innerWidth <= innerHeight;
}

async function makeIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const scale = size / 512;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#f2f5e9'; ctx.fillRect(0, 0, 512, 512);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 38; ctx.strokeStyle = '#829a6c';
  ctx.beginPath(); ctx.moveTo(155, 173); ctx.lineTo(322, 173); ctx.bezierCurveTo(409, 173, 409, 339, 319, 339); ctx.lineTo(223, 339); ctx.stroke();
  [[155, 173, '1'], [223, 339, '2']].forEach(([x, y, number]) => {
    ctx.fillStyle = '#829a6c'; ctx.beginPath(); ctx.arc(x, y, 59, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fffef8'; ctx.font = '600 67px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(number, x, y + 3);
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function setupOffline() {
  if (N.testMode || !('serviceWorker' in navigator) || !isSecureContext || !/^https?:$/.test(location.protocol)) return;
  try {
    const base = new URL('./', location.href);
    const registration = await navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname, updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    const cache = await caches.open(N.resources.cacheName(base));
    void Promise.allSettled(N.resources.FONTS.map(async (url) => {
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    }));
    let iconsReady = true;
    for (const size of [192, 512]) {
      const blob = await makeIcon(size);
      if (blob) await cache.put(new URL(`icon-${size}.png`, base), new Response(blob, { headers: { 'Content-Type': 'image/png' } }));
      else iconsReady = false;
    }
    const activateManifest = () => {
      if (!navigator.serviceWorker.controller || !iconsReady || document.querySelector('link[rel="manifest"]')) return;
      const link = document.createElement('link');
      link.rel = 'manifest'; link.href = new URL('manifest.webmanifest', base).href;
      document.head.appendChild(link);
      const touch = document.createElement('link'); touch.rel = 'apple-touch-icon'; touch.href = new URL('icon-192.png', base).href;
      document.head.appendChild(touch);
    };
    activateManifest();
    navigator.serviceWorker.addEventListener('controllerchange', activateManifest);
    if (registration.waiting) registration.waiting.postMessage({ type: 'ACTIVATE' });
  } catch { /* Online and file-based play remain available when offline storage is blocked. */ }
}

function setupPlatform() {
  updateOrientation();
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', updateOrientation);
  document.addEventListener('fullscreenchange', updateOrientation);
  void setupOffline();
}

Object.assign(N, { enterFullscreen, setupPlatform });
})(globalThis.Numberly = globalThis.Numberly || {});