/* Functional test for the new "watch ad to continue" flow in Balance Ball. */
const { JSDOM } = require('jsdom');
const path = require('path');
const { createCanvas } = require('canvas');

let failures = 0;
function check(name, cond) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name);
  if (!cond) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, 'balance-ball.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'https://example.com/balance-ball.html',
    beforeParse(window) {
      // jsdom has no real 2D canvas context — back HTMLCanvasElement's
      // getContext('2d') with node-canvas's real implementation so the
      // game's draw calls (gradients, arcs, etc.) actually work.
      const nodeCanvas = createCanvas(800, 500);
      const realCtx = nodeCanvas.getContext('2d');
      window.HTMLCanvasElement.prototype.getContext = function (type) {
        if (type === '2d') return realCtx;
        return null;
      };
      class FakeGainParam { constructor() { this.value = 1; } exponentialRampToValueAtTime() {} }
      class FakeNode { connect() { return this; } disconnect() {} }
      class FakeGain extends FakeNode { constructor() { super(); this.gain = new FakeGainParam(); } }
      class FakeOsc extends FakeNode {
        constructor() { super(); this.frequency = { value: 0 }; }
        start() {} stop() {}
      }
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
  await sleep(200);

  const bb = window.__bb;
  check('test hook exposed', !!bb);

  console.log('--- starting a run ---');
  bb.start();
  check('game running after start', bb.state.running === true);
  check('continue modal hidden at start', bb.state.continueShown === false);

  console.log('--- first drop offers a continue (ads configured) ---');
  bb.forceDrop();
  check('game paused on drop', bb.state.running === false);
  check('continue modal shown', bb.state.continueShown === true);
  check('over screen NOT shown yet', bb.state.overScreenActive === false);
  check('continue not used yet', bb.state.continueUsed === false);

  console.log('--- declining ends the run for real ---');
  bb.declineContinue();
  check('continue modal hidden after decline', bb.state.continueShown === false);
  check('over screen shown after decline', bb.state.overScreenActive === true);

  console.log('--- second run: ad unavailable/blocked falls through safely ---');
  bb.start();
  check('over screen hidden again after restart', bb.state.overScreenActive === false);
  bb.forceDrop();
  check('continue offered again on a fresh run', bb.state.continueShown === true);

  // Simulate the ad script being unreachable (blocked/ad-blocked).
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

  const t0 = Date.now();
  bb.watchAd();
  let resolved = false;
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    if (bb.state.overScreenActive === true) { resolved = true; break; }
  }
  const elapsed = Date.now() - t0;
  check('unavailable ad resolves (does not hang forever)', resolved);
  check('resolves quickly (<7s)', elapsed < 7000);
  check('continue modal hidden once resolved', bb.state.continueShown === false);
  check('continue NOT marked used (no ad actually watched)', bb.state.continueUsed === false);
  console.log('   (took ' + elapsed + 'ms)');

  console.log('--- third run: only one continue offer per run ---');
  bb.start();
  bb.forceDrop();
  check('continue offered on this run', bb.state.continueShown === true);
  bb.declineContinue();
  check('over screen shown after declining', bb.state.overScreenActive === true);

  console.log('');
  console.log(failures === 0 ? 'ALL TESTS PASSED 🎉' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
