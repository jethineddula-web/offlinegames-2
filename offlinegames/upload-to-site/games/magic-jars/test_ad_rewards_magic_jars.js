/* Functional test for the new "watch ad" free-reward rows in Magic Jars. */
const { JSDOM } = require('jsdom');
const path = require('path');

let failures = 0;
function check(name, cond) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name);
  if (!cond) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const store = new Map();

  const dom = await JSDOM.fromFile(path.join(__dirname, 'magic-jars.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'https://example.com/magic-jars.html',
    beforeParse(window) {
      class FakeParam {}
      class FakeGain { constructor(){ this.gain = { setValueAtTime(){}, exponentialRampToValueAtTime(){} }; } connect(){ return this; } }
      class FakeOsc { constructor(){ this.frequency = { setValueAtTime(){}, exponentialRampToValueAtTime(){} }; } connect(){ return this; } start(){} stop(){} }
      class FakeAudioContext {
        constructor(){ this.currentTime = 0; this.state = 'running'; this.destination = {}; }
        createGain(){ return new FakeGain(); }
        createOscillator(){ return new FakeOsc(); }
        resume(){ return Promise.resolve(); }
      }
      window.AudioContext = FakeAudioContext;

      // Minimal window.storage shim matching the documented contract:
      // get() on a missing key THROWS (does not resolve null).
      window.storage = {
        async get(key) {
          if (!store.has(key)) throw new Error('not found');
          return { key, value: store.get(key), shared: false };
        },
        async set(key, value) {
          store.set(key, value);
          return { key, value, shared: false };
        },
      };
    },
  });
  const { window } = dom;
  const doc = window.document;
  await sleep(200);

  const mj = window.__mj;
  check('test hook exposed', !!mj);
  check('starting coins loaded', mj.state.coins === 300);

  console.log('--- opening the shop shows free-reward rows ---');
  mj.startLevel(1);
  mj.openShop();
  check('shop screen active', mj.state.shopActive === true);
  const adRows = doc.querySelectorAll('#adRewardsList .shop-item-ad');
  check('two free-reward rows rendered', adRows.length === 2);
  const watchButtons = doc.querySelectorAll('#adRewardsList .btn-ghost');
  check('watch-ad buttons rendered', watchButtons.length === 2);
  check('watch-ad buttons start enabled', ![...watchButtons].some(b => b.disabled));

  console.log('--- watching an ad for free coins (ads unavailable in test env) ---');
  const t0 = Date.now();
  const coinsBefore = mj.state.coins;
  mj.watchAdCoins();
  check('busy flag set immediately', mj.state.adCoinsBusy === true);

  let resolved = false;
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    if (mj.state.adCoinsBusy === false) { resolved = true; break; }
  }
  const elapsed = Date.now() - t0;
  check('ad call resolves (does not hang forever)', resolved);
  check('resolves quickly (<7s)', elapsed < 7000);
  check('no coins granted when no real ad was watched', mj.state.coins === coinsBefore);
  console.log('   (took ' + elapsed + 'ms)');

  console.log('--- watching an ad for a free hint (same safe fallback) ---');
  const t1 = Date.now();
  mj.watchAdHint();
  let hintResolved = false;
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    if (mj.state.adHintBusy === false) { hintResolved = true; break; }
  }
  check('hint ad call resolves too', hintResolved);
  check('hint resolves quickly (<7s)', Date.now() - t1 < 7000);
  check('no hint applied / screen unchanged when ad unavailable', mj.state.shopActive === true);

  console.log('--- progress actually persists via window.storage ---');
  check('a save landed in storage', store.has('chroma-pour-sort-progress-v2'));

  console.log('--- simulating an actual ad view grants the reward ---');
  // Force the ad pathway into an approved, always-plays-through state, the
  // way a real live ad SDK would behave once AdSense is approved.
  mj.simulateAdReady();
  const coinsBeforeReal = mj.state.coins;
  mj.watchAdCoins();
  await sleep(50);
  check('coins granted after a real ad view', mj.state.coins === coinsBeforeReal + 50);

  mj.startLevel(2);
  mj.openShop();
  mj.watchAdHint();
  await sleep(50);
  check('back on game screen after a real hint ad', mj.state.gameActive === true);
  const hintedTubes = doc.querySelectorAll('#tubesWrap .tube.hinted');
  check('a hint highlight was actually applied', hintedTubes.length === 2);

  console.log('');
  console.log(failures === 0 ? 'ALL TESTS PASSED 🎉' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
