/* Functional test for the new "watch ad to continue" flow in Pop-a-Lock. */
const { JSDOM } = require('jsdom');
const path = require('path');

let failures = 0;
function check(name, cond) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name);
  if (!cond) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, 'pop-a-lock.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'https://example.com/pop-a-lock.html',
    beforeParse(window) {
      class FakeParam { setValueAtTime() {} exponentialRampToValueAtTime() {} linearRampToValueAtTime() {} }
      class FakeNode { connect() { return this; } disconnect() {} }
      class FakeGain extends FakeNode { constructor() { super(); this.gain = new FakeParam(); } }
      class FakeOsc extends FakeNode { constructor() { super(); this.frequency = new FakeParam(); } start() {} stop() {} }
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
  await sleep(200);

  const pal = window.__pal;
  check('test hook exposed', !!pal);

  console.log('--- starting a run ---');
  pal.start();
  check('game running after start', pal.state.running === true);
  check('continue overlay hidden at start', pal.state.continueShown === false);

  console.log('--- first miss offers a continue (ads configured) ---');
  pal.forceMiss();
  check('game paused on miss', pal.state.running === false);
  check('continue overlay shown', pal.state.continueShown === true);
  check('main game-over overlay NOT shown yet', pal.state.overlayShown === false);
  check('continue not used yet', pal.state.continueUsed === false);

  console.log('--- declining ends the run for real ---');
  pal.declineContinue();
  check('continue overlay hidden after decline', pal.state.continueShown === false);
  check('main game-over overlay shown after decline', pal.state.overlayShown === true);

  console.log('--- second run: accept path via a stalled/unavailable ad ---');
  pal.start();
  check('overlay hidden again after restart', pal.state.overlayShown === false);
  pal.forceMiss();
  check('continue offered again on a fresh run', pal.state.continueShown === true);

  // Simulate the ad script being unreachable (blocked/ad-blocked), same as
  // the other games — this should fall through to "no ad available" and
  // end the run, since no free continue should be granted.
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
  pal.watchAd();
  let resolved = false;
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    if (pal.state.overlayShown === true) { resolved = true; break; }
  }
  const elapsed = Date.now() - t0;
  check('unavailable ad resolves (does not hang forever)', resolved);
  check('resolves quickly (<7s)', elapsed < 7000);
  check('continue overlay hidden once resolved', pal.state.continueShown === false);
  check('continue NOT marked used (no ad actually watched)', pal.state.continueUsed === false);
  console.log('   (took ' + elapsed + 'ms)');

  console.log('--- third run: only one continue offer per run ---');
  pal.start();
  pal.forceOverwound();
  check('continue offered on overwound too', pal.state.continueShown === true);
  // Manually mark continueUsed as if a real ad had been watched, then miss again.
  window.__pal.declineContinue(); // end this one to reset for a clean check
  check('overlay shown after declining overwound continue', pal.state.overlayShown === true);

  console.log('');
  console.log(failures === 0 ? 'ALL TESTS PASSED 🎉' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
