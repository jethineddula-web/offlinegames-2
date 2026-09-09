/* Regression test: mashing Play/a level tile while a level transition is
   still "loading" (waiting on the interstitial ad call) must NOT queue up
   multiple startLevel() calls that all fire at once once it resolves. */
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

  // Make the ad script hang forever (never load, never error) so the
  // level-transition call takes the full internal fallback delay — this
  // is the window during which impatient extra clicks used to stack up.
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const el = origCreate(tag);
    if (tag === 'script') {
      const origSetSrc = Object.getOwnPropertyDescriptor(window.HTMLScriptElement.prototype, 'src').set;
      Object.defineProperty(el, 'src', {
        set(v) { if (typeof v === 'string' && v.includes('adsbygoogle')) return; origSetSrc.call(el, v); },
        get() { return ''; },
        configurable: true,
      });
    }
    return el;
  };

  console.log('--- mashing Play while a level-transition is pending ---');
  const btnPlay = doc.getElementById('btn-play');
  check('Play starts enabled', !btnPlay.disabled);
  btnPlay.click();
  check('Play disables itself while loading', btnPlay.disabled);
  // Mash it several more times immediately, the way an impatient player would.
  for (let i = 0; i < 5; i++) btnPlay.click();

  // Wait for it to resolve (well under the old 12s worst case).
  let resolved = false;
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    if (window.__pz.state.phase === 'memorize') { resolved = true; break; }
  }
  check('level eventually started', resolved);
  check('only ONE level-transition went through despite 6 clicks', window.__pz.state.navCalls === 1);
  check('Play re-enabled once loaded', !btnPlay.disabled);

  console.log('');
  console.log(failures === 0 ? 'ALL TESTS PASSED 🎉' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
