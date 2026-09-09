/* Headless smoke test for Puzzle Break using jsdom (loads real external css/js files) */
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

  console.log('--- boot ---');
  await sleep(250); // let external scripts + DOMContentLoaded + init run
  const pz = window.__pz;
  check('game initialized', !!pz);
  check('title screen visible', doc.getElementById('screen-title').classList.contains('active'));

  console.log('--- level 1: gameplay flow ---');
  pz.start(1);
  check('phase = memorize', pz.state.phase === 'memorize');
  check('peek image shown', doc.getElementById('peek-img').classList.contains('show'));
  check('4 pieces built', doc.querySelectorAll('.piece').length === 4);
  check('4 slots built', doc.querySelectorAll('.slot').length === 4);
  check('2x2 grid', pz.state.n === 2);

  await sleep(2300);
  check('phase = breaking after 2s', pz.state.phase === 'breaking');
  await sleep(2600);
  check('phase = play after break', pz.state.phase === 'play');
  const pieces = [...doc.querySelectorAll('.piece')];
  check('pieces visible during play', pieces.every(p => p.style.opacity === '1'));
  const ref = doc.getElementById('ref-img');
  check('guide picture shown during play', ref.classList.contains('show'));
  check('guide picture has board image', ref.style.backgroundImage.includes('img/'));
  doc.getElementById('btn-ref').click();
  check('guide toggle hides it', !ref.classList.contains('show'));
  doc.getElementById('btn-ref').click();
  check('guide toggle shows it again', ref.classList.contains('show'));

  console.log('--- drag & drop simulation ---');
  const before = pz.state.placed;
  pz.placeAll();
  check('all 4 pieces placed', pz.state.placed === before + 4 && pz.state.placed === 4);
  check('phase = won', pz.state.phase === 'won');
  await sleep(1200);
  check('complete panel shown', doc.getElementById('complete-panel').classList.contains('show'));
  check('stars rendered', doc.querySelectorAll('#complete-stars .on').length >= 1);
  check('stars saved', (window.__pz.state.progress) >= 2);
  check('hud progress 4/4', doc.getElementById('hud-progress').textContent.includes('4/4'));

  console.log('--- next level button ---');
  doc.getElementById('btn-next').click();
  await sleep(150); // btn-next now checks for an ad break (async) before loading the level
  check('level 2 started', pz.state.level === 2);
  check('phase = memorize', pz.state.phase === 'memorize');
  check('3x3 grid', pz.state.n === 3);
  check('9 pieces', doc.querySelectorAll('.piece').length === 9);
  await sleep(2300);
  check('breaking lvl2', pz.state.phase === 'breaking');
  await sleep(2600);
  pz.placeAll();
  await sleep(1200);
  check('lvl2 won', pz.state.phase === 'won');

  console.log('--- level select ---');
  doc.getElementById('btn-to-levels').click();
  check('levels screen visible', doc.getElementById('screen-levels').classList.contains('active'));
  const btns = [...doc.querySelectorAll('.lvl-btn')];
  check('50 level buttons', btns.length === 50);
  check('level 3 unlocked, level 4 locked', !btns[2].classList.contains('locked') && btns[3].classList.contains('locked'));
  check('done stars on lvl 1-2', btns[0].classList.contains('done') && btns[1].classList.contains('done'));

  console.log('--- big grid level (7x7 = 49 pieces) ---');
  pz.start(50);
  await sleep(100);
  check('7x7 grid', pz.state.n === 7);
  check('49 pieces', doc.querySelectorAll('.piece').length === 49);
  check('49 slots', doc.querySelectorAll('.slot').length === 49);
  await sleep(2100);
  check('breaking lvl50', pz.state.phase === 'breaking');
  await sleep(2700);
  pz.placeAll();
  await sleep(1300);
  check('lvl50 won', pz.state.phase === 'won');
  const nextTxt = doc.getElementById('btn-next').textContent;
  check('next = Play Again at level 50', nextTxt.includes('Play Again'));

  console.log('--- hint lock (2nd hint gated by ad, auto-unlocks when ads not live) ---');
  pz.start(2);
  await sleep(2300);
  await sleep(2600);
  check('level 2 in play phase for hint test', pz.state.phase === 'play');
  const btnHint = doc.getElementById('btn-hint');
  check('hint starts enabled, free', !btnHint.disabled && btnHint.textContent === '💡');
  btnHint.click();
  check('1st hint used, peek shown', doc.getElementById('peek-img').classList.contains('show'));
  btnHint.click(); // 2nd hint: gated behind rewarded ad
  await sleep(80);
  check('2nd hint resolved, button not stuck on loading', btnHint.textContent !== '⏳');

  console.log('--- grid formula across all 50 levels ---');
  const expect = [];
  for (let l = 1; l <= 50; l++) {
    const n = l<=1?2 : l<=4?3 : l<=10?4 : l<=18?5 : l<=40?6 : 7;
    expect.push(n);
  }
  let ok = true;
  for (let l = 1; l <= 50; l++) {
    pz.start(l);
    if (pz.state.n !== expect[l-1]) { ok = false; console.log('   mismatch at', l, pz.state.n, expect[l-1]); }
  }
  check('grid sizes 2,3,3,..,7 match design', ok);

  console.log('');
  console.log(failures === 0 ? 'ALL TESTS PASSED 🎉' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });