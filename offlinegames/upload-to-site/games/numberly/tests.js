(async function () {
'use strict';

const isNode = typeof process !== 'undefined' && !!process.versions?.node;
if (!globalThis.Numberly?.LEVELS) await import('./levels.js');
if (!globalThis.Numberly?.GameClock) await import('./clock.js');
if (!globalThis.Numberly?.formatTime) await import('./storage.js');
const N = globalThis.Numberly;
const outcomes = [];

function assert(value, message) { if (!value) throw new Error(message); }
function report(name, error) {
  outcomes.push({ name, passed: !error, error: error?.message || '' });
  if (typeof document !== 'undefined') {
    const host = document.getElementById('test-results');
    if (!host) return;
    const line = document.createElement('div');
    line.className = `test-result ${error ? 'failed' : 'passed'}`;
    line.textContent = `${error ? 'FAIL' : 'PASS'}: ${name}${error ? ' / ' + error.message : ''}`;
    host.appendChild(line);
    const failed = outcomes.filter((outcome) => !outcome.passed).length;
    document.getElementById('test-summary').textContent = `${outcomes.length - failed} checks passed, ${failed} failed.`;
  } else console.log(`${error ? 'FAIL' : 'PASS'}: ${name}${error ? ': ' + error.message : ''}`);
}
function test(name, run) { try { run(); report(name); } catch (error) { report(name, error); } }

function replay(level, cells) {
  let path = [], outcome;
  for (let index = 0; index < cells.length; index++) {
    const before = path.slice();
    outcome = N.advancePath(level, path, cells[index]);
    assert(path.join(',') === before.join(','), `Level ${level.id}: validator mutated its input`);
    assert(['move', 'complete'].includes(outcome.kind), `Level ${level.id}: invalid step ${index} (${outcome.kind})`);
    assert(outcome.kind !== 'complete' || index === cells.length - 1, `Level ${level.id}: completed before its last number`);
    path = outcome.path;
  }
  assert(outcome?.kind === 'complete', `Level ${level.id}: last number did not win`);
  return path;
}

function shortened(level) {
  const path = [...level.solution];
  for (let i = 0; i < path.length - 2; i++) {
    for (let j = i + 2; j < path.length; j++) {
      if (level.checkpoints[path[j - 1]]) break;
      if (N.adjacent(path[i], path[j], level.size)) {
        path.splice(i + 1, j - i - 1);
        j = i + 1;
      }
    }
  }
  return path;
}

test('Exactly 200 unique puzzle layouts', () => {
  assert(N.LEVELS.length === 200, 'Wrong level count');
  const signatures = new Set(N.LEVELS.map((level) => `${level.size}:${JSON.stringify(level.checkpoints)}`));
  assert(signatures.size === 200, 'Duplicate layouts');
});

for (const level of N.LEVELS) test(`Level ${N.levelLabel(level.id)}: legal solution, checkpoint order, final-number win`, () => {
  assert(level.id >= 1 && level.id <= 200 && level.size === 5 + Math.floor((level.id - 1) / 50), 'Invalid level metadata');
  assert(new Set(level.solution).size === level.size * level.size, 'Invalid reference coverage');
  assert(Object.keys(level.checkpoints).length === level.count, 'Invalid checkpoints');
  replay(level, level.solution);
  replay(level, shortened(level));
});

test('Final number wins even with empty squares', () => {
  const puzzle = { id: 'regression-9', size: 5, count: 9, checkpoints: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 9: 6, 8: 7, 7: 8, 6: 9 } };
  const path = replay(puzzle, [0, 1, 2, 3, 4, 9, 8, 7, 6]);
  assert(path.length < 25, 'Regression test must leave empty squares');
});

test('Undo works at every prefix of all 200 solutions', () => {
  for (const level of N.LEVELS) for (let length = 2; length < level.solution.length; length++) {
    const path = level.solution.slice(0, length);
    const move = N.advancePath(level, path, path[length - 2]);
    assert(move.kind === 'backtrack' && move.path.join(',') === path.slice(0, -1).join(','), `Level ${level.id}: undo failed`);
  }
});

test('Invalid boundaries, diagonals, row-wraps and checkpoint skips are rejected', () => {
  const first = N.LEVELS[0];
  for (const cell of [-1, 25, NaN, Infinity, 0.5]) assert(N.advancePath(first, [], cell).kind === 'invalid', 'Invalid coordinate accepted');
  assert(N.advancePath(first, [], 1).kind === 'invalid', 'Must begin at 1');
  assert(N.advancePath(first, [0], 6).kind === 'invalid', 'Diagonal accepted');
  assert(N.advancePath(first, [0, 1, 2, 3, 4], 5).kind === 'invalid', 'Row-wrap accepted');
  assert(N.advancePath(first, [0, 5], 10).kind === 'invalid', 'Out-of-order checkpoint accepted');
  assert(N.advancePath(first, [0], 0).kind === 'same', 'Repeated pointer changed state');
});

test('Pause time and repeated pause/resume calls do not change elapsed time', () => {
  N.verifyClock();
  assert(N.formatTime(65.9) === '01:05' && N.formatTime(-4) === '00:00', 'Invalid time formatting');
});

if (N.ui) test('Player names are escaped before inserting HTML', () => {
  const escaped = N.ui.escapeHtml('<img src=x onerror="alert(1)">');
  assert(!escaped.includes('<') && escaped.includes('&quot;'), 'Unsafe text inserted into UI');
});

if (isNode) {
  const { readdir } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const directory = dirname(resolve(process.argv[1]));
  const files = await readdir(directory, { withFileTypes: true });
  test('Standalone folder contains only HTML, CSS and JavaScript files', () => {
    for (const file of files) assert(file.isFile() && /\.(html|css|js)$/.test(file.name), `Unexpected file: ${file.name}`);
  });
  const failed = outcomes.filter((outcome) => !outcome.passed).length;
  console.log(`\n${outcomes.length - failed} passed; ${failed} failed.`);
  process.exitCode = failed ? 1 : 0;
  return;
}

const button = document.getElementById('run-smoke');
if (!button) return;
button.addEventListener('click', async () => {
  button.disabled = true;
  const container = document.getElementById('smoke-viewport');
  container.hidden = false;
  const frame = document.createElement('iframe');
  frame.id = 'smoke-frame'; frame.title = 'Isolated Numberly browser test'; frame.width = '1280'; frame.height = '900';
  frame.src = './index.html?test=1';
  container.replaceChildren(frame);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function until(check, timeout = 6000) {
    const start = performance.now();
    while (!check()) { if (performance.now() - start > timeout) throw new Error('Browser check timed out'); await wait(25); }
  }
  try {
    await until(() => frame.contentWindow?.Numberly?.game);
    const win = frame.contentWindow, doc = frame.contentDocument, api = win.Numberly;
    const banner = doc.getElementById('advertisement');
    assert(banner && !banner.hidden, 'Bottom banner is missing from the start screen');
    assert(banner.dataset.bannerState === 'preview', 'Test mode must not request real ads');
    assert(win.getComputedStyle(banner).position === 'fixed', 'Banner area is not pinned to the bottom');
    assert(!banner.querySelector('ins.adsbygoogle'), 'A standard display ad must not be manually made sticky');
    assert(api.AD_ANCHOR_POSITION === 'collapsed-bottom', 'Live ads must use the supported bottom-anchor format');
    report('Browser: persistent, labeled bottom banner with safe Google anchor configuration');
    const click = (selector) => { const control = doc.querySelector(selector); assert(control && !control.disabled, `Missing/disabled control ${selector}`); control.click(); };
    click('[data-action="start"]');
    await until(() => doc.getElementById('puzzle-board').classList.contains('is-active'));
    const svg = doc.getElementById('puzzle-board');
    const rect = svg.getBoundingClientRect();
    const solution = api.LEVELS[0].solution;
    function pointer(type, cell) {
      svg.dispatchEvent(new win.PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: rect.left + (cell % 5 + 0.5) * rect.width / 5, clientY: rect.top + (Math.floor(cell / 5) + 0.5) * rect.height / 5 }));
    }
    pointer('pointerdown', solution[0]);
    solution.slice(1).forEach((cell) => pointer('pointermove', cell));
    pointer('pointerup', solution[solution.length - 1]);
    await until(() => api.game.snapshot().status === 'won');
    assert(doc.getElementById('advertisement') === banner && !banner.hidden, 'Banner was removed or recreated after a win');
    report('Browser: continuous pointer drag completes level 1');
    await until(() => doc.querySelector('[data-action="next"]'));
    click('[data-action="next"]');
    await until(() => api.game.snapshot().levelId === 2 && !doc.getElementById('pause-button').disabled);
    click('#pause-button');
    assert(api.game.snapshot().status === 'paused', 'Pause did not activate');
    assert(!banner.hidden, 'Pausing the game hid the bottom banner');
    api.game.visit(api.LEVELS[1].solution[0]);
    assert(api.game.snapshot().path.length === 0, 'Input changed a paused game');
    await wait(50); click('#pause-button');
    await until(() => !doc.getElementById('hint-button').disabled);
    const gems = api.game.snapshot().gems;
    click('#hint-button');
    assert(api.game.snapshot().gems === gems - 5, 'Hint charge is incorrect');
    assert(api.game.snapshot().path[0] === api.LEVELS[1].solution[0], 'Hint start is incorrect');
    report('Browser: pause/resume, input blocking and hint costs');
    api.game.start(2);
    api.LEVELS[1].solution.forEach((cell) => api.game.visit(cell));
    let interstitials = 0;
    api.requestAd = async (type) => { if (type === 'next') interstitials++; return 'unavailable'; };
    await until(() => doc.querySelector('[data-action="next"]'));
    click('[data-action="next"]');
    await until(() => api.game.snapshot().levelId === 3);
    assert(interstitials === 1, 'Expected an interstitial request after the second win');
    report('Browser: every-two-round ad request and unavailable-ad continuation');
    click('[data-action="dialog"][data-value="settings"]');
    click('[data-action="setting"][data-value="music"]');
    assert(doc.querySelector('[data-action="setting"][data-value="music"]').getAttribute('aria-checked') === 'true', 'Music setting did not update');
    click('[data-action="close-dialog"]');
    click('[data-action="levels"]');
    click('[data-action="chapter"][data-value="3"]');
    click('[data-action="level"][data-value="200"]');
    assert(api.game.snapshot().levelId === 200, 'Expert selection failed');
    api.LEVELS[199].solution.forEach((cell) => api.game.visit(cell));
    assert(api.game.snapshot().status === 'won', 'Level 200 did not complete');
    click('[data-action="dialog"][data-value="leaderboard"]');
    assert(doc.querySelectorAll('.score-table-row').length === 3, 'High-score table is missing wins');
    click('[data-action="close-dialog"]');
    report('Browser: settings, expert-level selection and local high scores');
    api.game.start(1);
    for (const [width, height] of [[320, 568], [375, 667], [768, 900], [941, 760], [1280, 900]]) {
      frame.width = String(width); frame.height = String(height);
      await wait(150);
      assert(doc.documentElement.scrollWidth <= width + 1, `Horizontal overflow at ${width}px`);
      const box = svg.getBoundingClientRect();
      assert(box.width > 150 && Math.abs(box.width - box.height) < 2, `Board distorted at ${width}px`);
      const pane = doc.querySelector('.app-shell');
      const bannerBox = banner.getBoundingClientRect();
      assert(Math.abs(bannerBox.bottom - height) < 2, `Banner is not at the screen bottom at ${width}px`);
      assert(pane.getBoundingClientRect().bottom <= bannerBox.top + 1, `Banner overlaps the game pane at ${width}px`);
      assert(pane.scrollWidth <= pane.clientWidth + 1, `Game pane overflows horizontally at ${width}px`);
      doc.querySelector('.game-controls').scrollIntoView({ block: 'end' });
      await wait(30);
      assert(doc.querySelector('.game-controls').getBoundingClientRect().bottom <= bannerBox.top + 1, `Controls sit behind the banner at ${width}px`);
      assert(doc.getElementById('advertisement') === banner, 'Resizing recreated the banner');
    }
    report('Browser: mobile, tablet and desktop fit with a persistent banner that does not cover controls');
  } catch (error) { report('Browser smoke checks', error); }
  finally { button.disabled = false; }
});
})();