/* ============================================================
   textures.js  —  Procedural texture generation (no assets)
   RGB = albedo,  A = emissive window mask (glows at night)
   ============================================================ */
'use strict';

const TEX = (function () {

  function cv(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    /* every generator reads its pixels back, so hint the browser up-front */
    c.getContext('2d', { willReadFrequently: true });
    return c;
  }

  /* combine an opaque colour canvas with a greyscale mask canvas into ImageData */
  function combine(colorCanvas, maskCanvas) {
    const s = colorCanvas.width;
    const cd = colorCanvas.getContext('2d').getImageData(0, 0, s, s);
    const md = maskCanvas ? maskCanvas.getContext('2d').getImageData(0, 0, s, s) : null;
    for (let i = 0; i < cd.data.length; i += 4) {
      cd.data[i + 3] = md ? md.data[i] : 0;
    }
    return cd;
  }

  function noiseOverlay(ctx, s, amount, alpha) {
    const img = ctx.getImageData(0, 0, s, s);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    if (alpha) { /* reserved */ }
  }

  function streaks(ctx, s, count, alpha) {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const x = Math.random() * s;
      const w = 1 + Math.random() * 3;
      const h = s * (0.2 + Math.random() * 0.8);
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(0,0,0,' + alpha + ')');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.translate(x, Math.random() * s * 0.4);
      ctx.fillRect(0, 0, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /*  BUILDING FACADES                                                   */
  /*  1 texture tile == 4 floors (14 m) x 4 bays (14 m)                  */
  /* ------------------------------------------------------------------ */

  function facade(style, seed) {
    const S = 512;
    const rnd = M.makeRng(seed || 1);
    const c = cv(S), x = c.getContext('2d');
    const m = cv(S), mx = m.getContext('2d');
    mx.fillStyle = '#000'; mx.fillRect(0, 0, S, S);

    const cols = 4, rows = 4;
    const cw = S / cols, ch = S / rows;

    const P = {
      glass:  { wall: '#4a5560', frame: '#8d97a2', win: ['#2a4a63', '#31576f', '#25405a', '#3a6076'], lit: 0.34, ledge: false, winPad: 0.06 },
      office: { wall: '#b9b2a6', frame: '#8f887c', win: ['#26343f', '#2c3d4a', '#1f2b35'], lit: 0.30, ledge: true, winPad: 0.18 },
      brick:  { wall: '#8a4f3d', frame: '#6d3d2f', win: ['#2b3138', '#333a42', '#242a30'], lit: 0.42, ledge: true, winPad: 0.24 },
      modern: { wall: '#d6d3cc', frame: '#5c6068', win: ['#2f4552', '#38505f', '#293b47'], lit: 0.28, ledge: false, winPad: 0.10 },
      steel:  { wall: '#5e646b', frame: '#7d848c', win: ['#1e2a33', '#26333d', '#182129'], lit: 0.26, ledge: false, winPad: 0.05 }
    }[style] || null;
    const p = P || { wall: '#999', frame: '#777', win: ['#333'], lit: 0.3, ledge: true, winPad: 0.2 };

    x.fillStyle = p.wall; x.fillRect(0, 0, S, S);

    // subtle vertical panel joints
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2;
    for (let i = 0; i <= cols; i++) {
      x.beginPath(); x.moveTo(i * cw, 0); x.lineTo(i * cw, S); x.stroke();
    }

    for (let r = 0; r < rows; r++) {
      // floor slab / ledge
      if (p.ledge) {
        x.fillStyle = 'rgba(0,0,0,0.16)';
        x.fillRect(0, r * ch, S, ch * 0.09);
        x.fillStyle = 'rgba(255,255,255,0.10)';
        x.fillRect(0, r * ch + ch * 0.09, S, 2);
      }
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const px = p.winPad * cw, py = p.winPad * ch + (p.ledge ? ch * 0.10 : 0);
        const wx = cIdx * cw + px;
        const wy = r * ch + py;
        const ww = cw - px * 2;
        const wh = ch - py - p.winPad * ch;

        // frame
        x.fillStyle = p.frame;
        x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

        // glass with vertical gradient (sky reflection)
        const g = x.createLinearGradient(wx, wy, wx, wy + wh);
        const base = p.win[(rnd() * p.win.length) | 0];
        g.addColorStop(0, '#6f8ea8');
        g.addColorStop(0.35, base);
        g.addColorStop(1, base);
        x.fillStyle = g;
        x.fillRect(wx, wy, ww, wh);

        // mullion cross
        x.fillStyle = p.frame;
        x.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        if (style !== 'glass') x.fillRect(wx, wy + wh / 2 - 1, ww, 2);

        /* each bay is a 2x2 group of panes, lit independently — that keeps
           the night skyline from turning into big glowing blocks */
        const paneW = ww / 2, paneH = wh / 2;
        for (let pv = 0; pv < 2; pv++) {
          for (let pu = 0; pu < 2; pu++) {
            if (rnd() >= p.lit) continue;
            const warm = rnd();
            const col = warm < 0.6 ? '#ffd9a0' : (warm < 0.86 ? '#fff3d8' : '#bfe0ff');
            const gx = wx + pu * paneW + 1.5, gy = wy + pv * paneH + 1.5;
            const gw = paneW - 3, gh = paneH - 3;
            if (gw <= 1 || gh <= 1) continue;
            x.fillStyle = col; x.globalAlpha = 0.62;
            x.fillRect(gx, gy, gw, gh);
            x.globalAlpha = 1;
            const lvl = 130 + ((rnd() * 125) | 0);
            mx.fillStyle = 'rgb(' + lvl + ',' + lvl + ',' + lvl + ')';
            mx.fillRect(gx, gy, gw, gh);
            /* a half-drawn blind on some of them */
            if (rnd() < 0.35) {
              const bh = gh * (0.25 + rnd() * 0.45);
              x.fillStyle = 'rgba(28,24,20,0.55)'; x.fillRect(gx, gy, gw, bh);
              mx.fillStyle = '#000'; mx.fillRect(gx, gy, gw, bh);
            }
          }
        }
      }
    }

    if (style === 'brick') {
      // brick courses
      x.globalAlpha = 0.10;
      for (let y = 0; y < S; y += 7) {
        x.fillStyle = '#000'; x.fillRect(0, y, S, 1);
      }
      x.globalAlpha = 1;
    }

    streaks(x, S, 26, 0.10);
    noiseOverlay(x, S, 16);
    return combine(c, m);
  }

  /* ------------------------------------------------------------------ */
  /*  ROOF                                                               */
  /* ------------------------------------------------------------------ */
  function roof() {
    const S = 256;
    const c = cv(S), x = c.getContext('2d');
    x.fillStyle = '#5b5e5c'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2200; i++) {
      const g = 60 + Math.random() * 60;
      x.fillStyle = 'rgba(' + (g | 0) + ',' + ((g + 4) | 0) + ',' + ((g - 4) | 0) + ',0.6)';
      x.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    x.strokeStyle = 'rgba(0,0,0,0.20)'; x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      x.beginPath(); x.moveTo(i * S / 4, 0); x.lineTo(i * S / 4, S); x.stroke();
      x.beginPath(); x.moveTo(0, i * S / 4); x.lineTo(S, i * S / 4); x.stroke();
    }
    noiseOverlay(x, S, 26);
    return combine(c, null);
  }

  /* ------------------------------------------------------------------ */
  /*  ROAD  (1 tile = 16 m across a 2-lane road, repeats along length)   */
  /* ------------------------------------------------------------------ */
  function road() {
    const S = 512;
    const c = cv(S), x = c.getContext('2d');
    x.fillStyle = '#33363a'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 6000; i++) {
      const g = 40 + Math.random() * 34;
      x.fillStyle = 'rgba(' + (g | 0) + ',' + (g | 0) + ',' + ((g + 3) | 0) + ',0.5)';
      x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    // kerbs at the two edges
    x.fillStyle = '#8e8e88'; x.fillRect(0, 0, S * 0.055, S); x.fillRect(S * 0.945, 0, S * 0.055, S);
    x.fillStyle = '#6f6f6a'; x.fillRect(S * 0.055, 0, 3, S); x.fillRect(S * 0.94, 0, 3, S);
    // sidewalk hatching
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1;
    for (let y = 0; y < S; y += 26) {
      x.beginPath(); x.moveTo(0, y); x.lineTo(S * 0.055, y); x.stroke();
      x.beginPath(); x.moveTo(S * 0.945, y); x.lineTo(S, y); x.stroke();
    }
    // solid outer lines
    x.fillStyle = 'rgba(235,235,225,0.75)';
    x.fillRect(S * 0.14, 0, 4, S); x.fillRect(S * 0.855, 0, 4, S);
    // dashed centre line
    x.fillStyle = 'rgba(240,225,120,0.85)';
    for (let y = 0; y < S; y += 64) x.fillRect(S * 0.495, y, 5, 34);
    // tyre wear
    x.fillStyle = 'rgba(0,0,0,0.10)';
    x.fillRect(S * 0.26, 0, S * 0.10, S); x.fillRect(S * 0.63, 0, S * 0.10, S);
    noiseOverlay(x, S, 12);
    return combine(c, null);
  }

  /* ------------------------------------------------------------------ */
  /*  PAVEMENT / PLAZA                                                   */
  /* ------------------------------------------------------------------ */
  function pavement() {
    const S = 256;
    const c = cv(S), x = c.getContext('2d');
    x.fillStyle = '#9a988f'; x.fillRect(0, 0, S, S);
    const n = 4, t = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const g = 145 + Math.random() * 26;
      x.fillStyle = 'rgb(' + (g | 0) + ',' + ((g - 2) | 0) + ',' + ((g - 10) | 0) + ')';
      x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
    }
    noiseOverlay(x, S, 20);
    return combine(c, null);
  }

  /* ------------------------------------------------------------------ */
  /*  GRASS / PARK                                                       */
  /* ------------------------------------------------------------------ */
  function grass() {
    const S = 256;
    const c = cv(S), x = c.getContext('2d');
    x.fillStyle = '#3f5f31'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      const g = 60 + Math.random() * 70;
      x.fillStyle = 'rgba(' + ((g * 0.55) | 0) + ',' + g + ',' + ((g * 0.42) | 0) + ',0.7)';
      x.fillRect(Math.random() * S, Math.random() * S, 2, 3);
    }
    noiseOverlay(x, S, 14);
    return combine(c, null);
  }

  /* ------------------------------------------------------------------ */
  /*  HELIPAD (clamped, single decal)                                    */
  /* ------------------------------------------------------------------ */
  function helipad() {
    const S = 256;
    const c = cv(S), x = c.getContext('2d');
    const m = cv(S), mx = m.getContext('2d');
    mx.fillStyle = '#000'; mx.fillRect(0, 0, S, S);

    x.fillStyle = '#2f3336'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 3000; i++) {
      const g = 40 + Math.random() * 26;
      x.fillStyle = 'rgba(' + (g | 0) + ',' + (g | 0) + ',' + (g | 0) + ',0.5)';
      x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    // outer circle
    x.strokeStyle = '#f2f2e8'; x.lineWidth = 9;
    x.beginPath(); x.arc(S / 2, S / 2, S * 0.40, 0, Math.PI * 2); x.stroke();
    // H
    x.fillStyle = '#f2f2e8';
    x.fillRect(S * 0.34, S * 0.28, S * 0.075, S * 0.44);
    x.fillRect(S * 0.585, S * 0.28, S * 0.075, S * 0.44);
    x.fillRect(S * 0.34, S * 0.465, S * 0.32, S * 0.07);
    // corner lights (glow at night)
    const pts = [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88],
                 [0.5, 0.07], [0.5, 0.93], [0.07, 0.5], [0.93, 0.5]];
    for (const [px, py] of pts) {
      x.fillStyle = '#ffd66b';
      x.beginPath(); x.arc(px * S, py * S, 6, 0, Math.PI * 2); x.fill();
      mx.fillStyle = '#fff';
      mx.beginPath(); mx.arc(px * S, py * S, 6, 0, Math.PI * 2); mx.fill();
    }
    return combine(c, m);
  }

  /* ------------------------------------------------------------------ */
  /*  METAL PANELS (helicopter skin)                                     */
  /* ------------------------------------------------------------------ */
  function metal() {
    const S = 256;
    const c = cv(S), x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(0,0,0,0.13)'; x.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
      x.beginPath(); x.moveTo(0, i * S / 4); x.lineTo(S, i * S / 4); x.stroke();
    }
    for (let i = 0; i <= 3; i++) {
      x.beginPath(); x.moveTo(i * S / 3, 0); x.lineTo(i * S / 3, S); x.stroke();
    }
    // rivets
    x.fillStyle = 'rgba(0,0,0,0.16)';
    for (let i = 0; i <= 4; i++) for (let j = 0; j < 26; j++) {
      x.beginPath(); x.arc(j * S / 26 + 4, i * S / 4, 1.3, 0, Math.PI * 2); x.fill();
    }
    noiseOverlay(x, S, 8);
    return combine(c, null);
  }

  /* ------------------------------------------------------------------ */
  /*  WATER                                                              */
  /* ------------------------------------------------------------------ */
  function water() {
    const S = 256;
    const c = cv(S), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#1d3f56'); g.addColorStop(0.5, '#245069'); g.addColorStop(1, '#1a3b52');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 500; i++) {
      x.strokeStyle = 'rgba(180,215,235,' + (0.04 + Math.random() * 0.09) + ')';
      x.lineWidth = 1 + Math.random();
      const y = Math.random() * S, w = 8 + Math.random() * 40, xx = Math.random() * S;
      x.beginPath(); x.moveTo(xx, y); x.quadraticCurveTo(xx + w / 2, y - 3, xx + w, y); x.stroke();
    }
    return combine(c, null);
  }

  /* ------------------------------------------------------------------ */
  /*  ROTOR DISC  (alpha = blur density, used with alphaTex batches)      */
  /* ------------------------------------------------------------------ */
  function rotorDisc() {
    const S = 256, C = S / 2;
    const c = cv(S), x = c.getContext('2d');
    const m = cv(S), mx = m.getContext('2d');
    x.fillStyle = '#c9d4de'; x.fillRect(0, 0, S, S);
    mx.fillStyle = '#000'; mx.fillRect(0, 0, S, S);

    /* density ring: nothing at the hub, densest near the tips, soft edge */
    const grd = mx.createRadialGradient(C, C, 0, C, C, C);
    grd.addColorStop(0.00, 'rgba(255,255,255,0.00)');
    grd.addColorStop(0.10, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.30)');
    grd.addColorStop(0.90, 'rgba(255,255,255,0.62)');
    grd.addColorStop(0.985, 'rgba(255,255,255,0.85)');
    grd.addColorStop(1.00, 'rgba(255,255,255,0.00)');
    mx.fillStyle = grd; mx.fillRect(0, 0, S, S);

    /* faint rotational streaks so it reads as moving blades */
    mx.save();
    mx.translate(C, C);
    /* a handful of strong, unevenly spaced streaks: the eye locks onto these
       and reads the disc as turning once the quad is rotated each frame */
    const N = 9;
    for (let i = 0; i < N; i++) {
      mx.rotate((Math.PI * 2) / N);
      mx.globalAlpha = 0.26 + Math.random() * 0.26;
      mx.fillStyle = '#fff';
      const wdt = 3.0 + Math.random() * 3.5;
      mx.fillRect(C * 0.10, -wdt / 2, C * 0.88, wdt);
      /* trailing smear behind each streak */
      mx.globalAlpha = 0.10;
      mx.fillRect(C * 0.10, -wdt * 1.6, C * 0.88, wdt * 1.6);
    }
    mx.restore();
    /* the mask lives in the alpha channel */
    return combine(c, m);
  }

  /* soft round glow sprite (lights, star halo) */
  function glow() {
    const S = 128, C = S / 2;
    const c = cv(S), x = c.getContext('2d');
    const m = cv(S), mx = m.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
    mx.fillStyle = '#000'; mx.fillRect(0, 0, S, S);
    const g2 = mx.createRadialGradient(C, C, 0, C, C, C);
    g2.addColorStop(0, 'rgba(255,255,255,1)');
    g2.addColorStop(0.25, 'rgba(255,255,255,0.62)');
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    mx.fillStyle = g2; mx.fillRect(0, 0, S, S);
    return combine(c, m);
  }

  return { facade, roof, road, pavement, grass, helipad, metal, water, rotorDisc, glow };
})();

if (typeof module !== 'undefined') module.exports = TEX;
