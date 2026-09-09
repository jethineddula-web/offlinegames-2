/* Regression test: a stalled ad script (ad blocker swallows the request —
   no load, no error, ever) must NOT be able to freeze the game. */
const { JSDOM } = require('jsdom');
const path = require('path');

let failures = 0;
function check(name, cond) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name);
  if (!cond) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'file://' + __dirname + '/index.html',
  });
  const { window } = dom;
  const doc = window.document;
  await sleep(250);

  // Make the adsbygoogle script tag hang forever: never fires load or error.
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const el = origCreate(tag);
    if (tag === 'script') {
      const origSetSrc = Object.getOwnPropertyDescriptor(window.HTMLScriptElement.prototype, 'src').set;
      Object.defineProperty(el, 'src', {
        set(v) { if (typeof v === 'string' && v.includes('adsbygoogle')) { /* swallow: never load, never error */ return; } origSetSrc.call(el, v); },
        get() { return ''; },
        configurable: true,
      });
    }
    return el;
  };

  console.log('--- stalled ad script must not freeze Play ---');
  const t0 = Date.now();
  doc.getElementById('btn-play').click();
  // Poll instead of a single fixed sleep, since we don't know exactly how
  // long the internal timeout takes (should be well under ~7s).
  let started = false;
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    if (window.__pz.state.phase === 'memorize') { started = true; break; }
  }
  const elapsed = Date.now() - t0;
  check('level eventually started despite stalled ad script', started);
  check('unstuck within a reasonable time (<7s)', elapsed < 7000);
  console.log('   (took ' + elapsed + 'ms)');

  console.log('');
  console.log(failures === 0 ? 'ALL TESTS PASSED 🎉' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
