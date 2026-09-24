/* Regression test: a stalled/blocked ad script (ad blocker, sandboxed
   webview, or restrictive network swallows the request — no load, no
   error, ever) must NOT be able to prevent a match from starting. */
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
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
      class FakeParam { setValueAtTime() {} exponentialRampToValueAtTime() {} }
      class FakeNode { connect() { return this; } disconnect() {} }
      class FakeGain extends FakeNode { constructor() { super(); this.gain = new FakeParam(); } }
      class FakeOsc extends FakeNode { constructor() { super(); this.frequency = new FakeParam(); } start() {} stop() {} }
      class FakeAudioContext {
        constructor() { this.currentTime = 0; this.state = 'running'; this.destination = new FakeNode(); }
        createGain() { return new FakeGain(); }
        createOscillator() { return new FakeOsc(); }
        resume() { return Promise.resolve(); }
      }
      window.AudioContext = FakeAudioContext;
    },
  });
  const { window } = dom;
  const doc = window.document;
  await sleep(150);

  check('menu overlay visible on load', doc.getElementById('menuOverlay').hidden === false);
  check('mode cards rendered', doc.querySelectorAll('[data-mode]').length === 2);

  // Simulate an ad script request that hangs forever: never fires load or
  // error (what ad blockers / restrictive environments do in practice).
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

  console.log('--- clicking "Play the House" with a stalled ad script ---');
  const t0 = Date.now();
  const modeCard = doc.querySelector('[data-mode="bot"]');
  check('mode card starts enabled', !modeCard.disabled);
  modeCard.click();
  check('mode card disables itself while loading', modeCard.disabled);

  let started = false;
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    if (doc.getElementById('menuOverlay').hidden === true) { started = true; break; }
  }
  const elapsed = Date.now() - t0;
  check('match actually started despite stalled ad script', started);
  check('unstuck within a reasonable time (<7s)', elapsed < 7000);
  console.log('   (took ' + elapsed + 'ms)');

  console.log('');
  console.log(failures === 0 ? 'ALL TESTS PASSED 🎉' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
