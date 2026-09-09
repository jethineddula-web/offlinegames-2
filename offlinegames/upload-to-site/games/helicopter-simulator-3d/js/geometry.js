/* ============================================================
   geometry.js  —  Procedural primitive builders + merging
   ============================================================ */
'use strict';

const G = (function () {

  function empty() { return { positions: [], normals: [], uvs: [], indices: [] }; }

  function push(g, px, py, pz, nx, ny, nz, u, v) {
    g.positions.push(px, py, pz);
    g.normals.push(nx, ny, nz);
    g.uvs.push(u, v);
  }

  /* ---------- BOX (centered, size w,h,d) ---------- */
  function box(w, h, d, uvScale) {
    uvScale = uvScale || 1;
    const g = empty();
    const hx = w / 2, hy = h / 2, hz = d / 2;
    const faces = [
      // normal, u-axis, v-axis, center
      [[0, 0, 1], [hx, 0, 0], [0, hy, 0], [0, 0, hz], w, h],
      [[0, 0, -1], [-hx, 0, 0], [0, hy, 0], [0, 0, -hz], w, h],
      [[1, 0, 0], [0, 0, -hz], [0, hy, 0], [hx, 0, 0], d, h],
      [[-1, 0, 0], [0, 0, hz], [0, hy, 0], [-hx, 0, 0], d, h],
      [[0, 1, 0], [hx, 0, 0], [0, 0, -hz], [0, hy, 0], w, d],
      [[0, -1, 0], [hx, 0, 0], [0, 0, hz], [0, -hy, 0], w, d]
    ];
    for (const [n, ua, va, c, uw, vh] of faces) {
      const base = g.positions.length / 3;
      const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
      for (const [su, sv, tu, tv] of corners) {
        push(g,
          c[0] + ua[0] * su + va[0] * sv,
          c[1] + ua[1] * su + va[1] * sv,
          c[2] + ua[2] * su + va[2] * sv,
          n[0], n[1], n[2],
          tu * uw * uvScale, tv * vh * uvScale);
      }
      g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return g;
  }

  /* ---------- PLANE on XZ ---------- */
  function plane(w, d, segs, uvScale) {
    segs = segs || 1; uvScale = uvScale === undefined ? 1 : uvScale;
    const g = empty();
    for (let j = 0; j <= segs; j++) {
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, v = j / segs;
        push(g, (u - 0.5) * w, 0, (v - 0.5) * d, 0, 1, 0, u * w * uvScale, v * d * uvScale);
      }
    }
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * (segs + 1) + i, b = a + 1, c = a + segs + 1, dd = c + 1;
        g.indices.push(a, c, b, b, c, dd);
      }
    }
    return g;
  }

  /* ---------- CYLINDER along Y ---------- */
  function cylinder(rTop, rBot, h, radial, caps) {
    radial = radial || 16; caps = caps !== false;
    const g = empty();
    const hy = h / 2;
    const slope = (rBot - rTop) / h;
    for (let j = 0; j <= 1; j++) {
      const r = j === 0 ? rBot : rTop;
      const y = j === 0 ? -hy : hy;
      for (let i = 0; i <= radial; i++) {
        const a = (i / radial) * Math.PI * 2;
        const cx = Math.cos(a), sz = Math.sin(a);
        const n = [cx, slope, sz];
        const l = Math.hypot(n[0], n[1], n[2]);
        push(g, cx * r, y, sz * r, n[0] / l, n[1] / l, n[2] / l, i / radial, j);
      }
    }
    const row = radial + 1;
    for (let i = 0; i < radial; i++) {
      const a = i, b = i + 1, c = row + i, d = row + i + 1;
      g.indices.push(a, c, b, b, c, d);
    }
    if (caps) {
      for (const [y, r, ny] of [[hy, rTop, 1], [-hy, rBot, -1]]) {
        if (r <= 0.0001) continue;
        const base = g.positions.length / 3;
        push(g, 0, y, 0, 0, ny, 0, 0.5, 0.5);
        for (let i = 0; i <= radial; i++) {
          const a = (i / radial) * Math.PI * 2;
          push(g, Math.cos(a) * r, y, Math.sin(a) * r, 0, ny, 0,
            0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
        }
        for (let i = 0; i < radial; i++) {
          if (ny > 0) g.indices.push(base, base + 1 + i, base + 2 + i);
          else g.indices.push(base, base + 2 + i, base + 1 + i);
        }
      }
    }
    return g;
  }

  /* ---------- SPHERE ---------- */
  function sphere(r, wSeg, hSeg) {
    wSeg = wSeg || 20; hSeg = hSeg || 14;
    const g = empty();
    for (let j = 0; j <= hSeg; j++) {
      const v = j / hSeg, phi = v * Math.PI;
      for (let i = 0; i <= wSeg; i++) {
        const u = i / wSeg, theta = u * Math.PI * 2;
        const nx = Math.cos(theta) * Math.sin(phi);
        const ny = Math.cos(phi);
        const nz = Math.sin(theta) * Math.sin(phi);
        push(g, nx * r, ny * r, nz * r, nx, ny, nz, u, 1 - v);
      }
    }
    const row = wSeg + 1;
    for (let j = 0; j < hSeg; j++) {
      for (let i = 0; i < wSeg; i++) {
        const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
        g.indices.push(a, b, c, b, d, c);
      }
    }
    return g;
  }

  /* ---------- TORUS (ring / star gate) ---------- */
  function torus(R, r, tubular, radial) {
    tubular = tubular || 32; radial = radial || 12;
    const g = empty();
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      for (let i = 0; i <= tubular; i++) {
        const u = (i / tubular) * Math.PI * 2;
        const cx = (R + r * Math.cos(v)) * Math.cos(u);
        const cy = (R + r * Math.cos(v)) * Math.sin(u);
        const cz = r * Math.sin(v);
        const nx = Math.cos(v) * Math.cos(u), ny = Math.cos(v) * Math.sin(u), nz = Math.sin(v);
        push(g, cx, cy, cz, nx, ny, nz, i / tubular, j / radial);
      }
    }
    const row = tubular + 1;
    for (let j = 0; j < radial; j++) {
      for (let i = 0; i < tubular; i++) {
        const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
        g.indices.push(a, c, b, b, c, d);
      }
    }
    return g;
  }

  /* ---------- 3D STAR (collectible) ---------- */
  function star(outer, inner, thick, points) {
    points = points || 5;
    const g = empty();
    const ring = [];
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      ring.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const hz = thick / 2;
    // two faces
    for (const [z, nz] of [[hz, 1], [-hz, -1]]) {
      const base = g.positions.length / 3;
      push(g, 0, 0, z * 1.35, 0, 0, nz, 0.5, 0.5); // slight point for a gem look
      for (const [x, y] of ring) push(g, x, y, z, 0, 0, nz, 0.5 + x / outer * 0.5, 0.5 + y / outer * 0.5);
      for (let i = 0; i < ring.length; i++) {
        const a = base + 1 + i, b = base + 1 + ((i + 1) % ring.length);
        if (nz > 0) g.indices.push(base, a, b); else g.indices.push(base, b, a);
      }
    }
    // rim
    for (let i = 0; i < ring.length; i++) {
      const p0 = ring[i], p1 = ring[(i + 1) % ring.length];
      const base = g.positions.length / 3;
      const nx = (p0[1] - p1[1]), ny = (p1[0] - p0[0]);
      const l = Math.hypot(nx, ny) || 1;
      push(g, p0[0], p0[1], hz, nx / l, ny / l, 0, 0, 0);
      push(g, p1[0], p1[1], hz, nx / l, ny / l, 0, 1, 0);
      push(g, p1[0], p1[1], -hz, nx / l, ny / l, 0, 1, 1);
      push(g, p0[0], p0[1], -hz, nx / l, ny / l, 0, 0, 1);
      g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return g;
  }

  /* ---------- DISC (rotor blur) ---------- */
  function disc(r, segs) {
    segs = segs || 40;
    const g = empty();
    const base = 0;
    push(g, 0, 0, 0, 0, 1, 0, 0.5, 0.5);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      push(g, Math.cos(a) * r, 0, Math.sin(a) * r, 0, 1, 0,
        0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let i = 0; i < segs; i++) g.indices.push(base, base + 1 + i, base + 2 + i);
    // back side
    const off = g.positions.length / 3;
    push(g, 0, 0, 0, 0, -1, 0, 0.5, 0.5);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      push(g, Math.cos(a) * r, 0, Math.sin(a) * r, 0, -1, 0,
        0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let i = 0; i < segs; i++) g.indices.push(off, off + 2 + i, off + 1 + i);
    return g;
  }

  /* ---------- TAPERED FUSELAGE (lofted cross-sections) ---------- */
  /* sections: [{z, w, h, yOff}] front(-) to back(+) along Z */
  function loft(sections, radial) {
    radial = radial || 14;
    const g = empty();
    for (let s = 0; s < sections.length; s++) {
      const S = sections[s];
      for (let i = 0; i <= radial; i++) {
        const a = (i / radial) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        // superellipse for a rounded-rectangular fuselage cross section
        const p = 2.35;
        const sx = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / p);
        const sy = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / p);
        const x = sx * S.w, y = sy * S.h + (S.yOff || 0);
        let nx = sx / Math.max(S.w, 0.01), ny = sy / Math.max(S.h, 0.01);
        const nl = Math.hypot(nx, ny) || 1;
        push(g, x, y, S.z, nx / nl, ny / nl, 0, i / radial, s / (sections.length - 1));
      }
    }
    const row = radial + 1;
    for (let s = 0; s < sections.length - 1; s++) {
      for (let i = 0; i < radial; i++) {
        const a = s * row + i, b = a + 1, c = a + row, d = c + 1;
        g.indices.push(a, c, b, b, c, d);
      }
    }
    // caps
    const capEnds = [{ idx: 0, dir: -1 }, { idx: sections.length - 1, dir: 1 }];
    for (const { idx, dir } of capEnds) {
      const S = sections[idx];
      const base = g.positions.length / 3;
      push(g, 0, S.yOff || 0, S.z, 0, 0, dir, 0.5, 0.5);
      for (let i = 0; i <= radial; i++) {
        const off = (idx * row + i) * 3;
        push(g, g.positions[off], g.positions[off + 1], g.positions[off + 2], 0, 0, dir, 0.5, 0.5);
      }
      for (let i = 0; i < radial; i++) {
        if (dir > 0) g.indices.push(base, base + 1 + i, base + 2 + i);
        else g.indices.push(base, base + 2 + i, base + 1 + i);
      }
    }
    return g;
  }

  /* ---------- TRANSFORM & MERGE ---------- */
  function transform(g, opts) {
    const t = opts.t || [0, 0, 0];
    const s = opts.s || [1, 1, 1];
    const r = opts.r || [0, 0, 0]; // euler XYZ radians
    const out = { positions: [], normals: [], uvs: g.uvs.slice(), indices: g.indices.slice() };
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]);
    const cy = Math.cos(r[1]), sy = Math.sin(r[1]);
    const cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    const rot = (x, y, z) => {
      let y1 = y * cx - z * sx, z1 = y * sx + z * cx;
      let x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
      let x3 = x2 * cz - y1 * sz, y3 = x2 * sz + y1 * cz;
      return [x3, y3, z2];
    };
    for (let i = 0; i < g.positions.length; i += 3) {
      const p = rot(g.positions[i] * s[0], g.positions[i + 1] * s[1], g.positions[i + 2] * s[2]);
      out.positions.push(p[0] + t[0], p[1] + t[1], p[2] + t[2]);
      const n = rot(g.normals[i] / s[0], g.normals[i + 1] / s[1], g.normals[i + 2] / s[2]);
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      out.normals.push(n[0] / l, n[1] / l, n[2] / l);
    }
    return out;
  }

  function merge(list) {
    const g = empty();
    for (const item of list) {
      const src = item.geom ? transform(item.geom, item) : item;
      const off = g.positions.length / 3;
      for (let i = 0; i < src.positions.length; i++) g.positions.push(src.positions[i]);
      for (let i = 0; i < src.normals.length; i++) g.normals.push(src.normals[i]);
      for (let i = 0; i < src.uvs.length; i++) g.uvs.push(src.uvs[i]);
      for (let i = 0; i < src.indices.length; i++) g.indices.push(src.indices[i] + off);
    }
    return g;
  }

  return { empty, box, plane, cylinder, sphere, torus, star, disc, loft, transform, merge };
})();

if (typeof module !== 'undefined') module.exports = G;
