/* Regression test: a stalled/blocked ad script (ad blocker, sandboxed
   webview, or restrictive network swallows the request — no load, no
   error, ever) must NOT be able to prevent the game from starting. */
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
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      // jsdom has no Web Audio implementation — stub just enough of the
      // surface this game touches so we can exercise the real start flow
      // end-to-end. This is a test-harness shim only; it has nothing to do
      // with the bug being verified.
      class FakeParam { setValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime() {} }
      class FakeNode { connect() {} disconnect() {} }
      class FakeGain extends FakeNode { constructor() { super(); this.gain = new FakeParam(); } }
      class FakeOsc extends FakeNode {
        constructor() { super(); this.frequency = new FakeParam(); }
        start() {} stop() {}
      }
      class FakeFilter extends FakeNode { constructor() { super(); this.frequency = new FakeParam(); this.Q = { value: 0 }; } }
      class FakeBufferSource extends FakeNode { start() {} stop() {} }
      class FakeAudioContext {
        constructor() { this.currentTime = 0; this.state = 'running'; this.destination = new FakeNode(); this.sampleRate = 44100; }
        createGain() { return new FakeGain(); }
        createOscillator() { return new FakeOsc(); }
        createBiquadFilter() { return new FakeFilter(); }
        createBufferSource() { return new FakeBufferSource(); }
        createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
        resume() { return Promise.resolve(); }
      }
      window.AudioContext = FakeAudioContext;
    },
  });
  const { window } = dom;
  const doc = window.document;
  await sleep(150);

  check('menu screen visible on load', !doc.getElementById('screen-menu').classList.contains('hidden'));
  check('4 track cards rendered', doc.querySelectorAll('#track-list .track').length === 4);

  // Simulate an ad script request that hangs forever: never fires load or
  // error (this is exactly what ad blockers and many sandboxed/restricted
  // environments do to third-party ad domains).
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

  console.log('--- clicking a track with a stalled ad script ---');
  const t0 = Date.now();
  const firstTrack = doc.querySelectorAll('#track-list .track')[0];
  check('track button starts enabled', !firstTrack.disabled);
  firstTrack.click();
  check('track button disables itself while loading', firstTrack.disabled);

  let started = false;
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    if (!doc.getElementById('screen-play').classList.contains('hidden')) { started = true; break; }
  }
  const elapsed = Date.now() - t0;
  check('game actually started despite stalled ad script', started);
  check('unstuck within a reasonable time (<7s)', elapsed < 7000);
  console.log('   (took ' + elapsed + 'ms)');

  console.log('');
  console.log(failures === 0 ? 'ALL TESTS PASSED 🎉' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
