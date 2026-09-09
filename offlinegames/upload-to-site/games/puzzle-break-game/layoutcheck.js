/* Layout sanity: stub real viewport rects, verify S/board/tray playable */
const { JSDOM } = require('jsdom');
const path = require('path');

function setViewport(w, W, H, trayH) {
  const game = w.document.getElementById('game');
  const area = w.document.getElementById('tray-area');
  const hudH = 64, padL = 11, padTop = 74;
  Object.defineProperty(game, 'clientWidth', { get: () => W - 22, configurable: true });
  Object.defineProperty(game, 'clientHeight', { get: () => H - padTop - 12, configurable: true });
  const areaTop = padTop + (H - padTop - 12) - trayH + 30;
  const orig = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this === game) return { left: padL, top: padTop, width: W - 22, height: H - padTop - 12, right: W - 11, bottom: H - 12 };
    if (this === area) return { left: padL + 10, top: areaTop, width: W - 42, height: trayH - 32, right: W - 21, bottom: areaTop + trayH - 32 };
    return orig.call(this);
  };
}

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    url: 'file://' + __dirname + '/index.html',
  });
  const w = dom.window;
  await new Promise(r => setTimeout(r, 250));
  for (const [W, H] of [[1280, 800], [1920, 1080], [900, 700], [390, 780]]) {
    console.log('=== viewport', W + 'x' + H, '===');
    setViewport(w, W, H, H >= 700 ? 168 : 118);
    for (const l of [1, 5, 11, 19, 31, 41]) {
      w.__pz.start(l);
      const L = w.__pz.layout;
      const fits = L.board.x >= 0 && L.board.y >= 0 &&
                   L.board.x + L.board.w <= W - 20 && L.tray.y + L.tray.h <= H;
      const trayOk = L.tray.h > 40;
      console.log('  L' + String(l).padStart(2), 'grid', w.__pz.state.n + 'x' + w.__pz.state.n,
        'S=' + L.S, 'D=' + L.D, 'ts=' + (L.ts && L.ts.toFixed(2)),
        'board@(' + L.board.x + ',' + L.board.y + ') ' + L.board.w + 'px', 'tray y=' + Math.round(L.tray.y) + ' h=' + Math.round(L.tray.h),
        fits && trayOk ? 'OK' : '⚠ PROBLEM');
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
