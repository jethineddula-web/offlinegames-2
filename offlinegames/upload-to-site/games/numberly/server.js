// Optional dependency-free server. Run with Node.js: node server.js
(async function () {
'use strict';
const { createServer } = await import('node:http');
const { readFile, stat } = await import('node:fs/promises');
const { dirname, resolve, extname, sep } = await import('node:path');
const root = dirname(resolve(process.argv[1]));
const port = Number(process.env.PORT) || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const seller = 'google.com, pub-4203857211510947, DIRECT, f08c47fec0942fa0\n';

createServer(async (request, response) => {
  const send = (status, type, content) => {
    response.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : content);
  };
  if (!['GET', 'HEAD'].includes(request.method)) { send(405, 'text/plain', 'Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { send(400, 'text/plain', 'Invalid URL'); return; }
  // ads.txt is a generated HTTP response, not a physical TXT file.
  if (pathname === '/ads.txt') { send(200, 'text/plain; charset=utf-8', seller); return; }
  if (pathname === '/sitemap.xml') {
    send(200, 'application/xml; charset=utf-8', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://offlinegames.art/numberly/</loc></url></urlset>');
    return;
  }
  if (pathname === '/robots.txt') { send(200, 'text/plain; charset=utf-8', 'User-agent: *\nAllow: /\n'); return; }
  if (pathname === '/') pathname = '/index.html';
  const file = resolve(root, '.' + pathname);
  if (!file.startsWith(root + sep) || pathname.includes('\0') || !types[extname(file)]) {
    send(404, 'text/plain', 'Not found'); return;
  }
  try {
    if (!(await stat(file)).isFile()) { send(404, 'text/plain', 'Not found'); return; }
    send(200, types[extname(file)], await readFile(file));
  } catch { send(404, 'text/plain', 'Not found'); }
}).listen(port, '127.0.0.1', () => {
  console.log(`Numberly is ready at http://localhost:${port}/`);
  console.log(`Regression checks: http://localhost:${port}/tests.html`);
});
})().catch((error) => { console.error(error); process.exitCode = 1; });