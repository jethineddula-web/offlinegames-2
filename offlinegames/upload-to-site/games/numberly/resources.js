(function (N) {
'use strict';

const VERSION = 'numberly-plain-v2-bottom-banner';
N.testMode = typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1';
const FILES = ['index.html', 'styles.css', 'resources.js', 'levels.js', 'clock.js', 'storage.js', 'audio.js', 'ads.js', 'ui.js', 'board.js', 'platform.js', 'game.js'];
const FONTS = [
  'https://cdn.jsdelivr.net/npm/@fontsource-variable/dm-sans@5.3.0/files/dm-sans-latin-wght-normal.woff2',
  'https://cdn.jsdelivr.net/npm/@fontsource-variable/bricolage-grotesque@5.3.0/files/bricolage-grotesque-latin-wght-normal.woff2',
];
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#f2f5e9"/><path d="M155 173H322C409 173 409 339 319 339H223" fill="none" stroke="#829a6c" stroke-width="38" stroke-linecap="round"/><circle cx="155" cy="173" r="59" fill="#829a6c"/><circle cx="223" cy="339" r="59" fill="#829a6c"/><text x="155" y="195" text-anchor="middle" fill="#fffef8" font-family="Arial,sans-serif" font-size="67" font-weight="600">1</text><text x="223" y="362" text-anchor="middle" fill="#fffef8" font-family="Arial,sans-serif" font-size="67" font-weight="600">2</text></svg>';

function cacheName(scope) {
  let hash = 0;
  for (const character of new URL(scope).pathname) hash = Math.imul(hash, 31) + character.charCodeAt(0) | 0;
  return `${VERSION}-${(hash >>> 0).toString(36)}`;
}

function manifest(scope) {
  const base = new URL('./', scope).href;
  return {
    id: base, name: 'Numberly - Number Connect Puzzle', short_name: 'Numberly',
    description: 'A little focus. A little flow. Connect your way through 200 free number puzzles.',
    start_url: base, scope: base, display: 'standalone', orientation: 'portrait-primary',
    background_color: '#f7f8f2', theme_color: '#f7f8f2', lang: 'en', categories: ['games', 'entertainment'],
    icons: [192, 512].map((size) => ({ src: new URL(`icon-${size}.png`, base).href, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any maskable' })),
  };
}

N.resources = { VERSION, FILES, FONTS, ICON, cacheName, manifest };
})(globalThis.Numberly = globalThis.Numberly || {});