/* Crayon Kingdom — vanilla JS. Open index.html in any browser. */
(function () {
  "use strict";

  var I = {
    red: "#E23B2F", coral: "#FF6B57", orange: "#F4A12C", amber: "#F5C84B",
    yellow: "#FFE066", lime: "#9EDB5C", green: "#3FAE66", mint: "#6DDBB0",
    teal: "#2BB7B3", sky: "#7EC8F5", blue: "#3D8FE8", navy: "#2C4A8C",
    indigo: "#5B5FCF", grape: "#8A6BD0", pink: "#F48FB1", rose: "#E85A7A",
    brown: "#8B5E3C", tan: "#D4A574", cream: "#FFF4D6", white: "#FFFDF8",
    gray: "#C5C0B8", charcoal: "#3A3646", night: "#2A2E5A", dusk: "#3D3A6B",
    paper: "#F6F0E6", grass: "#6FBF5B", sea: "#4A9FCF", hull: "#C46A3A",
    sand: "#E8D5A3", blush: "#FFD6DE", leaf: "#4C9A4A", bark: "#6B4423",
    ice: "#D7F1FF", foam: "#E8F7FF"
  };

  var WORLDS = [
    { id: "first", title: "First Strokes", tagline: "Big shapes, few colors" },
    { id: "garden", title: "Garden Path", tagline: "Flowers, bugs, and trees" },
    { id: "town", title: "Little Town", tagline: "Houses, cars, and castles" },
    { id: "ocean", title: "Seaside", tagline: "Fish, boats, and waves" },
    { id: "sky", title: "Big Sky", tagline: "Rockets, kites, and rainbows" },
    { id: "pals", title: "Animal Pals", tagline: "Friendly faces to color" },
    { id: "sweets", title: "Sweet Shop", tagline: "Treats you can paint" }
  ];

  function Pix(n) {
    this.n = n;
    this.d = new Uint8Array(n * n);
  }
  Pix.prototype.bg = function (c) { this.d.fill(c); return this; };
  Pix.prototype.set = function (x, y, c) {
    if (x < 0 || y < 0 || x >= this.n || y >= this.n) return;
    this.d[y * this.n + x] = c;
  };
  Pix.prototype.paintWhere = function (c, test) {
    var n = this.n;
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (test(x + 0.5, y + 0.5)) this.d[y * n + x] = c;
      }
    }
    return this;
  };
  Pix.prototype.rect = function (x, y, w, h, c) {
    var x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) this.set(xx, yy, c);
    return this;
  };
  Pix.prototype.roundRect = function (x, y, w, h, r, c) {
    var x0 = x, y0 = y, x1 = x + w, y1 = y + h;
    return this.paintWhere(c, function (px, py) {
      if (px < x0 || py < y0 || px >= x1 || py >= y1) return false;
      var cx = px < x0 + r ? x0 + r : px > x1 - r ? x1 - r : px;
      var cy = py < y0 + r ? y0 + r : py > y1 - r ? y1 - r : py;
      if (cx === px || cy === py) return true;
      var dx = px - cx, dy = py - cy;
      return dx * dx + dy * dy <= r * r;
    });
  };
  Pix.prototype.circle = function (cx, cy, r, c) {
    var r2 = r * r;
    return this.paintWhere(c, function (x, y) {
      var dx = x - cx, dy = y - cy;
      return dx * dx + dy * dy <= r2;
    });
  };
  Pix.prototype.ring = function (cx, cy, rOut, rIn, c) {
    var o2 = rOut * rOut, i2 = rIn * rIn;
    return this.paintWhere(c, function (x, y) {
      var d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      return d <= o2 && d >= i2;
    });
  };
  Pix.prototype.ellipse = function (cx, cy, rx, ry, c) {
    return this.paintWhere(c, function (x, y) {
      var dx = (x - cx) / rx, dy = (y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    });
  };
  Pix.prototype.line = function (x0, y0, x1, y1, w, c) {
    var dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, r = w * 0.5;
    return this.paintWhere(c, function (x, y) {
      var t = ((x - x0) * dx + (y - y0) * dy) / (len * len);
      t = Math.max(0, Math.min(1, t));
      var px = x0 + t * dx, py = y0 + t * dy;
      var ddx = x - px, ddy = y - py;
      return ddx * ddx + ddy * ddy <= r * r;
    });
  };
  Pix.prototype.tri = function (ax, ay, bx, by, cx, cy, col) {
    return this.paintWhere(col, function (x, y) { return pointInTri(x, y, ax, ay, bx, by, cx, cy); });
  };
  Pix.prototype.poly = function (pts, c) {
    if (pts.length < 3) return this;
    return this.paintWhere(c, function (x, y) { return pointInPoly(x, y, pts); });
  };
  Pix.prototype.diamond = function (cx, cy, r, c) {
    return this.paintWhere(c, function (x, y) { return Math.abs(x - cx) + Math.abs(y - cy) <= r; });
  };
  Pix.prototype.heart = function (cx, cy, s, c) {
    this.circle(cx - s * 0.32, cy - s * 0.18, s * 0.4, c);
    this.circle(cx + s * 0.32, cy - s * 0.18, s * 0.4, c);
    this.tri(cx - s * 0.7, cy - s * 0.08, cx + s * 0.7, cy - s * 0.08, cx, cy + s * 0.82, c);
    this.paintWhere(c, function (x, y) {
      var nx = (x - cx) / s, ny = (y - cy) / s + 0.15;
      var a = nx * nx + ny * ny - 0.28;
      return a * a * a - nx * nx * ny * ny * ny < 0 && ny > -0.55;
    });
    return this;
  };
  Pix.prototype.star = function (cx, cy, r, c, spikes) {
    spikes = spikes || 5;
    var pts = [], inner = r * 0.4;
    for (var i = 0; i < spikes * 2; i++) {
      var a = -Math.PI / 2 + (i * Math.PI) / spikes;
      var rad = i % 2 === 0 ? r : inner;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    return this.poly(pts, c);
  };
  Pix.prototype.cloud = function (cx, cy, s, c) {
    this.ellipse(cx, cy + s * 0.15, s * 1.15, s * 0.55, c);
    this.circle(cx - s * 0.55, cy, s * 0.5, c);
    this.circle(cx, cy - s * 0.25, s * 0.62, c);
    this.circle(cx + s * 0.6, cy, s * 0.52, c);
    return this;
  };
  Pix.prototype.toGrid = function () {
    var n = this.n, g = [];
    for (var y = 0; y < n; y++) {
      var row = [];
      for (var x = 0; x < n; x++) row.push(this.d[y * n + x]);
      g.push(row);
    }
    return g;
  };

  function pointInTri(px, py, ax, ay, bx, by, cx, cy) {
    var d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    var d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    var d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    var hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    var hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos) || Math.min(Math.abs(d1), Math.abs(d2), Math.abs(d3)) < 0.01;
  }
  function pointInPoly(px, py, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      var intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + (yj === yi ? 1e-9 : 0)) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pic(title, world, size, colors, paint) {
    return { title: title, world: world, size: size, colors: colors, paint: paint };
  }

  var PICTURES = [
    pic("Sweet Heart", "first", 16, [I.blush, I.rose, I.red, I.cream], function (p) {
      p.bg(1); p.heart(8, 8.2, 6.2, 2); p.heart(8, 8.2, 4.4, 3); p.circle(6.4, 6.6, 1.1, 4);
    }),
    pic("Night Star", "first", 16, [I.night, I.amber, I.yellow, I.cream], function (p) {
      p.bg(1); p.circle(3, 3, 0.7, 4); p.circle(13, 4, 0.55, 4); p.circle(12.5, 12, 0.5, 4);
      p.star(8, 8.2, 6.2, 2); p.star(8, 8.2, 3.2, 3);
    }),
    pic("Big Sun", "first", 16, [I.sky, I.orange, I.yellow, I.white], function (p) {
      p.bg(1);
      for (var i = 0; i < 8; i++) {
        var a = (i * Math.PI) / 4;
        p.line(8 + Math.cos(a) * 5.2, 8 + Math.sin(a) * 5.2, 8 + Math.cos(a) * 7.4, 8 + Math.sin(a) * 7.4, 1.6, 2);
      }
      p.circle(8, 8, 4.4, 3); p.circle(6.8, 7.1, 0.9, 4);
    }),
    pic("Red Balloon", "first", 16, [I.sky, I.red, I.coral, I.white, I.charcoal], function (p) {
      p.bg(1); p.ellipse(8, 6.2, 4.2, 5.0, 2); p.ellipse(8, 6.2, 3.2, 3.9, 3);
      p.circle(6.6, 4.6, 1.1, 4); p.tri(7.2, 11.1, 8.8, 11.1, 8, 12.4, 2); p.line(8, 12.2, 8, 15.2, 0.9, 5);
    }),
    pic("Crisp Apple", "first", 16, [I.cream, I.red, I.leaf, I.bark, I.white], function (p) {
      p.bg(1); p.circle(8, 9.2, 5.2, 2); p.circle(6.6, 7.6, 1.3, 5); p.rect(7.4, 2.2, 1.4, 3.2, 4); p.ellipse(10.4, 4.2, 2.4, 1.3, 3);
    }),
    pic("Ice Pop", "first", 16, [I.ice, I.rose, I.cream, I.mint, I.tan], function (p) {
      p.bg(1); p.roundRect(5, 1.5, 6, 4.2, 1.4, 2); p.rect(5, 5.4, 6, 3.4, 3);
      p.roundRect(5, 8.6, 6, 3.6, 0.2, 4); p.roundRect(6.7, 12, 2.6, 3.6, 0.8, 5);
    }),
    pic("Crescent Moon", "first", 16, [I.night, I.cream, I.amber, I.white], function (p) {
      p.bg(1); p.circle(3, 4, 0.6, 4); p.circle(13, 3, 0.5, 4); p.circle(12, 13, 0.55, 4); p.circle(5, 12, 0.45, 4);
      p.circle(8.2, 8, 5.4, 2); p.circle(10.4, 7.1, 4.4, 1); p.star(12.4, 5.2, 1.3, 3, 4);
    }),
    pic("Daisy", "first", 16, [I.sky, I.white, I.amber, I.leaf, I.grass], function (p) {
      p.bg(1); p.rect(0, 13, 16, 3, 5); p.rect(7.3, 10, 1.5, 4.2, 4); p.ellipse(5.6, 12.2, 2.2, 1.1, 4);
      for (var i = 0; i < 8; i++) {
        var a = (i * Math.PI) / 4;
        p.ellipse(8 + Math.cos(a) * 3.3, 6.4 + Math.sin(a) * 3.3, 1.55, 1.55, 2);
      }
      p.circle(8, 6.4, 2.1, 3);
    }),
    pic("Tulip", "garden", 20, [I.sky, I.grass, I.leaf, I.rose, I.red, I.white], function (p) {
      p.bg(1); p.rect(0, 16, 20, 4, 2); p.line(10, 9, 10, 17, 1.6, 3);
      p.ellipse(7.2, 14.5, 2.6, 1.3, 3); p.ellipse(12.8, 13.6, 2.6, 1.3, 3);
      p.ellipse(10, 6.6, 4.4, 5.0, 4); p.ellipse(7.6, 6.2, 2.0, 3.6, 5);
      p.ellipse(12.4, 6.2, 2.0, 3.6, 5); p.ellipse(10, 5.4, 1.8, 3.4, 4); p.circle(8.6, 5.2, 0.8, 6);
    }),
    pic("Apple Tree", "garden", 20, [I.sky, I.grass, I.bark, I.leaf, I.red, I.amber], function (p) {
      p.bg(1); p.rect(0, 16, 20, 4, 2); p.circle(16.5, 3.2, 2.0, 6);
      p.roundRect(8.4, 11, 3.2, 6.4, 0.8, 3); p.cloud(10, 8.2, 5.4, 4);
      p.circle(6.5, 7.4, 1.0, 5); p.circle(12.6, 6.6, 1.0, 5); p.circle(9.4, 9.6, 0.9, 5); p.circle(13.4, 10.2, 0.85, 5);
    }),
    pic("Toadstool", "garden", 20, [I.mint, I.grass, I.cream, I.red, I.white, I.rose], function (p) {
      p.bg(1); p.rect(0, 16, 20, 4, 2); p.roundRect(8, 11, 4.2, 6, 1.4, 3);
      p.ellipse(10.1, 8.4, 6.4, 4.4, 4); p.ellipse(10.1, 10.4, 6.4, 1.6, 4);
      p.circle(7.2, 7.4, 1.15, 5); p.circle(11.6, 6.6, 1.3, 5); p.circle(13.4, 9.0, 0.95, 5); p.circle(8.8, 9.6, 0.8, 5);
      p.circle(9.4, 13.4, 0.55, 6); p.circle(10.8, 14.6, 0.45, 6);
    }),
    pic("Butterfly", "garden", 20, [I.cream, I.navy, I.orange, I.amber, I.white, I.charcoal], function (p) {
      p.bg(1); p.ellipse(6.2, 7.4, 4.4, 3.6, 2); p.ellipse(6.6, 12.6, 3.6, 2.8, 3);
      p.ellipse(13.8, 7.4, 4.4, 3.6, 2); p.ellipse(13.4, 12.6, 3.6, 2.8, 3);
      p.circle(5.4, 7.0, 1.3, 4); p.circle(14.6, 7.0, 1.3, 4); p.circle(6.2, 12.4, 1.0, 5); p.circle(13.8, 12.4, 1.0, 5);
      p.roundRect(9.2, 5.6, 1.8, 9.4, 0.9, 6); p.circle(10.1, 5.2, 1.1, 6);
      p.line(9.4, 5.0, 8.0, 2.6, 0.7, 6); p.line(10.8, 5.0, 12.2, 2.6, 0.7, 6);
    }),
    pic("Busy Bee", "garden", 20, [I.sky, I.grass, I.amber, I.charcoal, I.white, I.leaf], function (p) {
      p.bg(1); p.rect(0, 16, 20, 4, 2); p.ellipse(6, 17.2, 1.6, 0.8, 6); p.ellipse(14, 17.4, 1.4, 0.7, 6);
      p.ellipse(10, 9.4, 5.4, 3.6, 3); p.rect(7.2, 6.4, 1.4, 6.2, 4); p.rect(10.6, 6.4, 1.4, 6.2, 4);
      p.circle(15.2, 9.4, 1.6, 4); p.ellipse(7.2, 6.2, 3.0, 2.2, 5); p.ellipse(12.6, 5.8, 3.0, 2.2, 5); p.circle(16.2, 8.8, 0.45, 5);
    }),
    pic("Ladybug", "garden", 20, [I.lime, I.grass, I.red, I.charcoal, I.white], function (p) {
      p.bg(1); p.rect(0, 16, 20, 4, 2); p.ellipse(10, 10.4, 6.0, 4.6, 3);
      p.rect(9.4, 6.2, 1.2, 8.6, 4); p.circle(10, 6.2, 2.3, 4);
      p.circle(6.6, 9.2, 1.15, 4); p.circle(13.4, 9.2, 1.15, 4);
      p.circle(7.4, 12.6, 0.95, 4); p.circle(12.6, 12.6, 0.95, 4);
      p.circle(9.2, 5.4, 0.45, 5); p.circle(10.8, 5.4, 0.45, 5);
    }),
    pic("Cozy House", "town", 24, [I.sky, I.grass, I.amber, I.white, I.hull, I.brown, I.blue, I.tan], function (p) {
      p.bg(1); p.rect(0, 17, 24, 7, 2); p.circle(19.5, 4.2, 2.4, 3); p.cloud(6, 5.2, 2.6, 4);
      p.rect(5, 12, 14, 9, 8); p.tri(3.5, 12.4, 12, 4.6, 20.5, 12.4, 5);
      p.rect(16.4, 7.2, 2.2, 4.2, 6); p.roundRect(10.2, 15.2, 3.6, 5.8, 0.4, 6);
      p.circle(13.0, 18.2, 0.4, 3); p.rect(6.6, 13.6, 3.2, 3.2, 7); p.rect(14.4, 13.6, 3.2, 3.2, 7);
    }),
    pic("Speedy Car", "town", 24, [I.sky, I.gray, I.white, I.red, I.navy, I.amber, I.charcoal, I.blue], function (p) {
      p.bg(1); p.circle(19.4, 4.0, 2.2, 6); p.cloud(6.2, 5.4, 2.4, 3); p.rect(0, 17, 24, 7, 2);
      p.rect(2, 19.2, 4, 0.8, 3); p.rect(9, 19.2, 4, 0.8, 3); p.rect(16, 19.2, 4, 0.8, 3);
      p.roundRect(3.2, 11.6, 17.6, 6.2, 2.0, 4); p.roundRect(7.4, 8.0, 9.4, 4.4, 1.6, 5);
      p.rect(8.4, 8.8, 3.4, 2.8, 8); p.rect(12.6, 8.8, 3.4, 2.8, 8); p.rect(3.8, 13.6, 2.4, 1.4, 6);
      p.circle(7.4, 17.6, 2.5, 7); p.circle(16.6, 17.6, 2.5, 7); p.circle(7.4, 17.6, 1.05, 2); p.circle(16.6, 17.6, 1.05, 2);
    }),
    pic("School Bus", "town", 24, [I.sky, I.gray, I.amber, I.charcoal, I.white, I.orange, I.blue], function (p) {
      p.bg(1); p.rect(0, 17, 24, 7, 2); p.roundRect(2, 8.4, 20, 9.2, 1.6, 3); p.rect(16.6, 8.4, 5.4, 5.2, 3);
      p.rect(3.2, 9.6, 3.0, 3.0, 7); p.rect(7.0, 9.6, 3.0, 3.0, 7); p.rect(10.8, 9.6, 3.0, 3.0, 7);
      p.rect(14.6, 9.6, 3.0, 3.0, 7); p.rect(18.4, 10.0, 2.6, 2.6, 7);
      p.rect(2.2, 13.8, 2.2, 1.4, 6); p.rect(19.6, 13.8, 2.0, 1.4, 5);
      p.circle(7.0, 17.6, 2.4, 4); p.circle(17.2, 17.6, 2.4, 4); p.circle(7.0, 17.6, 1.0, 2); p.circle(17.2, 17.6, 1.0, 2);
    }),
    pic("Lighthouse", "town", 24, [I.sky, I.sea, I.sand, I.white, I.red, I.amber, I.navy], function (p) {
      p.bg(1); p.rect(0, 16, 24, 8, 2); p.rect(0, 18, 24, 6, 3); p.circle(19.2, 4.2, 2.3, 6);
      p.poly([[8.4, 19], [15.6, 19], [14.2, 6.6], [9.8, 6.6]], 4);
      p.rect(9.6, 10.2, 4.8, 2.2, 5); p.rect(10.0, 15.2, 4.0, 2.2, 5);
      p.roundRect(9.4, 4.0, 5.2, 3.0, 0.6, 7); p.rect(11.2, 2.2, 1.6, 2.2, 5); p.circle(12, 5.4, 1.1, 6);
    }),
    pic("Castle", "town", 24, [I.dusk, I.cream, I.gray, I.navy, I.rose, I.amber, I.grass], function (p) {
      p.bg(1); p.rect(0, 18, 24, 6, 7); p.star(4, 4, 1.1, 6, 4); p.star(19.5, 6, 0.9, 6, 4); p.star(12, 3.2, 0.7, 2, 4);
      p.rect(4, 10, 16, 10, 3); p.rect(3.2, 7.2, 4.2, 13, 3); p.rect(16.6, 7.2, 4.2, 13, 3); p.rect(9.6, 6.0, 4.8, 14, 3);
      p.tri(2.4, 7.4, 5.3, 3.4, 8.2, 7.4, 4); p.tri(15.8, 7.4, 18.7, 3.4, 21.6, 7.4, 4); p.tri(9.0, 6.2, 12, 2.2, 15.0, 6.2, 4);
      p.rect(11.1, 14.2, 1.8, 5.8, 5); p.rect(4.4, 11.4, 1.8, 2.0, 6); p.rect(17.8, 11.4, 1.8, 2.0, 6); p.rect(10.4, 9.4, 3.2, 2.4, 6);
    }),
    pic("Little Train", "town", 24, [I.sky, I.grass, I.red, I.navy, I.amber, I.charcoal, I.white, I.gray], function (p) {
      p.bg(1); p.rect(0, 17, 24, 7, 2); p.rect(0, 17.6, 24, 1.2, 8);
      p.roundRect(11.4, 9.6, 10.2, 6.6, 0.8, 4); p.roundRect(2.2, 8.0, 9.6, 8.2, 0.8, 3);
      p.rect(3.2, 5.0, 2.4, 3.4, 6); p.cloud(4.4, 3.8, 1.4, 7);
      p.rect(6.4, 9.2, 3.6, 2.8, 7); p.rect(13.0, 10.8, 2.6, 2.4, 7); p.rect(17.2, 10.8, 2.6, 2.4, 7);
      p.circle(5.2, 16.6, 2.0, 6); p.circle(10.2, 16.6, 2.0, 6); p.circle(15.2, 16.6, 1.7, 6); p.circle(19.4, 16.6, 1.7, 6);
      p.rect(10.8, 12.6, 1.4, 1.4, 5);
    }),
    pic("Happy Fish", "ocean", 24, [I.ice, I.sea, I.orange, I.coral, I.white, I.charcoal, I.amber, I.teal], function (p) {
      p.bg(1); p.rect(0, 0, 24, 24, 2); p.circle(5, 5, 1.1, 5); p.circle(9, 3.6, 0.7, 5); p.circle(18, 6, 0.9, 5);
      p.ellipse(12, 13, 7.2, 5.0, 3); p.tri(18.4, 13, 23.2, 8.6, 23.2, 17.4, 4);
      p.ellipse(12.4, 8.6, 2.4, 1.6, 4); p.ellipse(12.4, 17.4, 2.4, 1.6, 4);
      p.circle(8.2, 12.2, 1.6, 5); p.circle(7.8, 12.2, 0.7, 6); p.circle(14.6, 13.6, 0.7, 7); p.circle(16.2, 11.6, 0.55, 7);
      p.ellipse(4.4, 20.6, 1.3, 2.6, 8); p.ellipse(19.6, 21.0, 1.5, 2.4, 8);
    }),
    pic("Sailboat", "ocean", 24, [I.sky, I.sea, I.white, I.hull, I.brown, I.red, I.amber], function (p) {
      p.bg(1); p.rect(0, 15, 24, 9, 2); p.circle(19.2, 4.4, 2.3, 7); p.cloud(6, 5.2, 2.5, 3);
      p.poly([[4.4, 15.2], [19.6, 15.2], [17.4, 19.4], [6.6, 19.4]], 4);
      p.rect(11.2, 5.2, 1.2, 10.2, 5); p.tri(12.4, 6.0, 12.4, 15.0, 19.2, 15.0, 3);
      p.tri(11.2, 7.4, 11.2, 15.0, 5.6, 15.0, 3); p.tri(12.4, 5.4, 16.4, 6.4, 12.4, 7.2, 6);
    }),
    pic("Crab", "ocean", 24, [I.sand, I.sea, I.coral, I.red, I.white, I.charcoal], function (p) {
      p.bg(1); p.rect(0, 16, 24, 8, 2); p.ellipse(12, 13.2, 6.2, 4.0, 3); p.ellipse(12, 13.2, 4.6, 2.8, 4);
      p.circle(9.4, 11.6, 1.3, 5); p.circle(14.6, 11.6, 1.3, 5); p.circle(9.4, 11.6, 0.55, 6); p.circle(14.6, 11.6, 0.55, 6);
      p.circle(5.0, 10.6, 2.4, 3); p.circle(19.0, 10.6, 2.4, 3); p.circle(5.0, 10.6, 1.3, 1); p.circle(19.0, 10.6, 1.3, 1);
      p.line(8.2, 16.4, 6.4, 19.6, 1.1, 4); p.line(12, 16.8, 12, 20.0, 1.1, 4); p.line(15.8, 16.4, 17.6, 19.6, 1.1, 4);
    }),
    pic("Whale", "ocean", 24, [I.ice, I.sea, I.navy, I.blue, I.white, I.foam], function (p) {
      p.bg(1); p.rect(0, 0, 24, 24, 2); p.ellipse(11.4, 13.6, 8.4, 5.0, 3); p.ellipse(11.4, 15.2, 6.4, 2.6, 4);
      p.tri(19.0, 12.4, 23.4, 8.6, 23.2, 16.6, 3); p.ellipse(12.6, 9.2, 2.6, 1.6, 3);
      p.circle(6.6, 12.4, 1.15, 5); p.circle(6.3, 12.4, 0.5, 3); p.rect(7.4, 6.0, 1.2, 3.4, 6); p.cloud(8.0, 4.6, 1.5, 6);
      p.circle(4, 6, 0.8, 5); p.circle(16, 5, 0.6, 5);
    }),
    pic("Octopus", "ocean", 24, [I.ice, I.sea, I.grape, I.pink, I.white, I.charcoal], function (p) {
      p.bg(1); p.rect(0, 0, 24, 24, 2); p.circle(12, 8.6, 5.2, 3); p.ellipse(12, 10.2, 5.4, 4.0, 3);
      p.circle(10.0, 8.0, 1.4, 5); p.circle(14.0, 8.0, 1.4, 5); p.circle(10.1, 8.1, 0.6, 6); p.circle(14.1, 8.1, 0.6, 6);
      p.line(8.2, 13.4, 5.2, 21.2, 1.8, 3); p.line(10.2, 14.0, 9.0, 21.6, 1.8, 4); p.line(12.0, 14.2, 12.4, 21.8, 1.8, 3);
      p.line(13.8, 14.0, 16.0, 21.6, 1.8, 4); p.line(15.8, 13.4, 19.2, 20.8, 1.8, 3);
      p.circle(5.2, 21.2, 1.2, 4); p.circle(19.2, 20.8, 1.2, 4);
    }),
    pic("Seahorse", "ocean", 24, [I.ice, I.sea, I.orange, I.amber, I.leaf, I.white], function (p) {
      p.bg(1); p.rect(0, 0, 24, 24, 2); p.ellipse(4.6, 19.4, 1.4, 3.0, 5); p.ellipse(19.2, 18.6, 1.2, 2.6, 5);
      p.circle(12.4, 6.4, 3.4, 3); p.ellipse(12.4, 11.6, 2.4, 4.4, 3); p.ellipse(14.6, 16.6, 2.8, 2.2, 4);
      p.ellipse(11.2, 18.6, 2.2, 1.6, 3); p.ellipse(15.6, 6.0, 2.4, 1.3, 3); p.circle(11.4, 5.8, 0.7, 6);
      p.ellipse(10.2, 10.4, 2.0, 1.5, 4); p.diamond(12.4, 8.8, 0.8, 4); p.diamond(12.4, 11.2, 0.8, 4);
    }),
    pic("Rocket", "sky", 24, [I.night, I.white, I.red, I.blue, I.amber, I.orange, I.cream], function (p) {
      p.bg(1); p.star(4, 4, 1.0, 7, 4); p.star(19, 6, 0.8, 7, 4); p.star(16, 3, 0.6, 7, 4); p.star(6, 14, 0.55, 7, 4);
      p.ellipse(12, 10.4, 3.4, 8.2, 2); p.tri(8.6, 4.4, 15.4, 4.4, 12, 1.4, 3);
      p.tri(8.6, 16.2, 6.0, 20.6, 9.6, 17.4, 3); p.tri(15.4, 16.2, 18.0, 20.6, 14.4, 17.4, 3);
      p.circle(12, 8.6, 1.7, 4); p.circle(12, 8.6, 0.85, 7);
      p.tri(10.2, 18.4, 13.8, 18.4, 12, 23.0, 5); p.tri(10.8, 18.6, 13.2, 18.6, 12, 21.6, 6);
    }),
    pic("Flying Kite", "sky", 24, [I.sky, I.grass, I.red, I.amber, I.white, I.blue, I.charcoal], function (p) {
      p.bg(1); p.rect(0, 19, 24, 5, 2); p.cloud(5.4, 5.0, 2.3, 5); p.cloud(18.6, 7.0, 2.0, 5);
      p.poly([[12, 3.4], [19.4, 10.6], [12, 18.0], [4.6, 10.6]], 3);
      p.tri(12, 3.4, 12, 10.6, 19.4, 10.6, 4); p.tri(12, 10.6, 12, 18.0, 4.6, 10.6, 6);
      p.line(12, 3.4, 12, 18.0, 0.7, 7); p.line(4.6, 10.6, 19.4, 10.6, 0.7, 7); p.line(12, 18.0, 14.6, 23.0, 0.7, 7);
      p.diamond(12.6, 19.6, 0.9, 3); p.diamond(14.0, 21.6, 0.9, 4);
    }),
    pic("Rainbow", "sky", 24, [I.sky, I.red, I.orange, I.amber, I.green, I.blue, I.grape, I.white], function (p) {
      p.bg(1);
      var cols = [2, 3, 4, 5, 6, 7];
      for (var i = 0; i < cols.length; i++) p.ring(12, 20, 16.2 - i * 1.7, 14.6 - i * 1.7, cols[i]);
      p.rect(0, 20, 24, 4, 1); p.cloud(4.2, 18.6, 3.0, 8); p.cloud(19.6, 18.8, 3.0, 8);
    }),
    pic("Hot Air Balloon", "sky", 24, [I.sky, I.red, I.white, I.amber, I.hull, I.grass, I.navy], function (p) {
      p.bg(1); p.rect(0, 20, 24, 4, 6); p.cloud(18.6, 5.4, 2.4, 3); p.circle(12, 8.6, 6.2, 2);
      p.rect(9.4, 6.6, 1.6, 8.2, 3); p.rect(13.0, 6.6, 1.6, 8.2, 4); p.ellipse(12, 8.2, 6.2, 2.0, 4);
      p.tri(8.8, 14.4, 15.2, 14.4, 12, 17.2, 2);
      p.line(10.2, 16.6, 10.0, 18.6, 0.7, 7); p.line(13.8, 16.6, 14.0, 18.6, 0.7, 7);
      p.roundRect(9.4, 18.2, 5.2, 3.0, 0.5, 5);
    }),
    pic("Airplane", "sky", 24, [I.sky, I.white, I.red, I.navy, I.amber, I.blue], function (p) {
      p.bg(1); p.cloud(5.2, 6.2, 2.4, 2); p.cloud(18.8, 16.6, 2.2, 2);
      p.ellipse(12, 12, 8.6, 2.2, 2); p.ellipse(11.4, 11.4, 3.6, 1.3, 6);
      p.poly([[10.4, 11.6], [13.6, 11.6], [18.2, 17.6], [15.2, 17.6]], 3);
      p.poly([[10.4, 12.4], [13.6, 12.4], [6.6, 17.4], [4.2, 17.4]], 3);
      p.tri(19.6, 11.0, 23.2, 9.2, 20.4, 13.0, 4); p.tri(19.6, 12.2, 23.0, 15.4, 20.0, 13.2, 4);
      p.circle(19.6, 5.2, 2.0, 5); p.rect(6.4, 10.6, 2.2, 1.2, 4);
    }),
    pic("Curious Cat", "pals", 24, [I.cream, I.orange, I.tan, I.pink, I.white, I.leaf, I.charcoal, I.green], function (p) {
      p.bg(1); p.rect(0, 18, 24, 6, 8); p.ellipse(12, 16.4, 7.2, 4.6, 2); p.circle(12, 10.2, 5.4, 2);
      p.tri(7.2, 8.2, 7.6, 3.6, 11.0, 7.0, 2); p.tri(16.8, 8.2, 16.4, 3.6, 13.0, 7.0, 2);
      p.tri(8.2, 7.6, 8.4, 5.0, 10.4, 7.2, 4); p.tri(15.8, 7.6, 15.6, 5.0, 13.6, 7.2, 4);
      p.ellipse(12, 12.4, 2.6, 1.6, 5); p.circle(9.6, 9.6, 1.3, 6); p.circle(14.4, 9.6, 1.3, 6);
      p.circle(9.6, 9.6, 0.5, 7); p.circle(14.4, 9.6, 0.5, 7); p.tri(11.2, 11.6, 12.8, 11.6, 12, 13.0, 4);
      p.ellipse(19.4, 16.6, 2.4, 1.5, 2); p.roundRect(8.6, 15.6, 6.8, 1.4, 0.6, 4);
    }),
    pic("Happy Dog", "pals", 24, [I.cream, I.grass, I.tan, I.brown, I.white, I.charcoal, I.pink, I.amber], function (p) {
      p.bg(1); p.rect(0, 18, 24, 6, 2); p.ellipse(12, 16.6, 7.0, 4.8, 3); p.circle(12, 10.4, 5.2, 3);
      p.ellipse(6.6, 11.2, 2.2, 3.2, 4); p.ellipse(17.4, 11.2, 2.2, 3.2, 4); p.ellipse(12, 12.6, 2.8, 1.8, 5);
      p.circle(10.0, 9.6, 1.2, 5); p.circle(14.0, 9.6, 1.2, 5); p.circle(10.0, 9.6, 0.5, 6); p.circle(14.0, 9.6, 0.5, 6);
      p.ellipse(12, 12.2, 1.3, 0.9, 4); p.circle(12, 13.4, 0.55, 7); p.ellipse(19.2, 16.8, 2.6, 1.4, 3);
      p.circle(8.4, 17.6, 1.5, 4); p.circle(15.6, 17.6, 1.5, 4);
    }),
    pic("Panda", "pals", 24, [I.mint, I.grass, I.white, I.charcoal, I.pink, I.leaf], function (p) {
      p.bg(1); p.rect(0, 18, 24, 6, 2); p.ellipse(12, 16.8, 6.6, 4.6, 3); p.circle(12, 10.4, 5.6, 3);
      p.circle(7.4, 6.4, 2.3, 4); p.circle(16.6, 6.4, 2.3, 4);
      p.ellipse(9.2, 10.0, 2.2, 1.8, 4); p.ellipse(14.8, 10.0, 2.2, 1.8, 4);
      p.circle(9.3, 10.0, 0.7, 3); p.circle(14.7, 10.0, 0.7, 3);
      p.ellipse(12, 12.8, 1.6, 1.0, 4); p.circle(12, 13.4, 0.45, 5);
      p.ellipse(8.4, 17.4, 1.7, 1.5, 4); p.ellipse(15.6, 17.4, 1.7, 1.5, 4);
    }),
    pic("Bunny", "pals", 24, [I.blush, I.grass, I.white, I.pink, I.charcoal, I.cream], function (p) {
      p.bg(1); p.rect(0, 18, 24, 6, 2);
      p.ellipse(8.0, 7.2, 1.5, 4.6, 3); p.ellipse(16.0, 7.2, 1.5, 4.6, 3);
      p.ellipse(8.0, 7.4, 0.7, 3.2, 4); p.ellipse(16.0, 7.4, 0.7, 3.2, 4);
      p.ellipse(12, 16.8, 6.2, 4.4, 3); p.circle(12, 11.0, 5.2, 3);
      p.circle(10.0, 10.4, 0.7, 5); p.circle(14.0, 10.4, 0.7, 5);
      p.ellipse(12, 12.4, 1.3, 0.9, 4); p.circle(12, 13.2, 0.4, 4);
      p.ellipse(12, 17.2, 2.4, 1.5, 6); p.ellipse(18.6, 17.4, 1.5, 2.6, 3);
    }),
    pic("Chick", "pals", 24, [I.sky, I.grass, I.yellow, I.amber, I.orange, I.charcoal, I.white], function (p) {
      p.bg(1); p.rect(0, 18, 24, 6, 2); p.circle(12, 12.4, 6.0, 3); p.circle(12, 8.2, 4.2, 3);
      p.ellipse(6.6, 12.4, 2.2, 1.5, 4); p.ellipse(17.4, 12.4, 2.2, 1.5, 4);
      p.circle(10.4, 7.8, 0.7, 6); p.circle(13.6, 7.8, 0.7, 6);
      p.tri(12, 8.6, 12, 10.6, 15.2, 9.6, 5);
      p.ellipse(10.4, 18.0, 1.5, 0.8, 5); p.ellipse(13.6, 18.0, 1.5, 0.8, 5); p.circle(16.8, 4.6, 2.0, 4);
    }),
    pic("Ice Cream", "sweets", 24, [I.cream, I.tan, I.pink, I.mint, I.rose, I.red, I.white], function (p) {
      p.bg(1); p.tri(7.4, 13.6, 16.6, 13.6, 12, 23.0, 2);
      p.line(9.2, 16.4, 10.4, 21.0, 0.5, 1); p.line(14.8, 16.4, 13.6, 21.0, 0.5, 1);
      p.circle(12, 12.4, 4.8, 3); p.circle(12, 8.2, 4.2, 4); p.circle(12, 4.6, 3.4, 5);
      p.circle(12, 1.8, 1.1, 6); p.circle(10.4, 10.8, 0.7, 7); p.circle(13.6, 7.0, 0.55, 7);
    }),
    pic("Cupcake", "sweets", 24, [I.blush, I.tan, I.brown, I.white, I.pink, I.rose, I.red], function (p) {
      p.bg(1); p.poly([[6.4, 14.2], [17.6, 14.2], [16.2, 21.6], [7.8, 21.6]], 2);
      p.rect(7.2, 16.2, 1.2, 4.4, 3); p.rect(11.4, 16.2, 1.2, 4.4, 3); p.rect(15.4, 16.2, 1.2, 4.4, 3);
      p.ellipse(12, 13.6, 7.0, 2.4, 4); p.circle(9.2, 11.4, 3.2, 5); p.circle(14.8, 11.4, 3.2, 5);
      p.circle(12, 9.2, 3.6, 5); p.circle(12, 7.0, 2.4, 6); p.circle(12, 4.6, 1.15, 7);
    }),
    pic("Donut", "sweets", 24, [I.cream, I.tan, I.pink, I.rose, I.amber, I.mint, I.white], function (p) {
      p.bg(1); p.circle(12, 12, 8.2, 2); p.circle(12, 12, 6.6, 3); p.circle(12, 12, 3.2, 1);
      p.rect(8.2, 7.6, 1.4, 0.7, 5); p.rect(14.6, 8.2, 1.4, 0.7, 6); p.rect(16.4, 13.2, 0.7, 1.4, 7);
      p.rect(7.2, 13.8, 1.4, 0.7, 6); p.rect(11.6, 6.4, 0.7, 1.3, 5); p.rect(10.2, 16.6, 1.3, 0.7, 7);
    }),
    pic("Cake Slice", "sweets", 24, [I.blush, I.brown, I.cream, I.rose, I.red, I.white, I.pink], function (p) {
      p.bg(1); p.poly([[4.4, 16.6], [20.2, 16.6], [16.4, 21.6], [7.6, 21.6]], 2);
      p.poly([[4.4, 16.6], [12.2, 6.2], [20.2, 16.6]], 3);
      p.rect(6.2, 13.4, 11.6, 1.6, 4); p.ellipse(12.2, 7.4, 4.6, 1.4, 7);
      p.circle(12.2, 5.2, 1.3, 5); p.circle(9.4, 10.6, 0.55, 6); p.circle(14.8, 12.2, 0.55, 6);
    })
  ];

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function compactColors(grid, colors) {
    var used = {};
    for (var y = 0; y < grid.length; y++) for (var x = 0; x < grid[y].length; x++) if (grid[y][x]) used[grid[y][x]] = 1;
    var map = {}, next = [], keys = Object.keys(used).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < keys.length; i++) {
      var hex = colors[keys[i] - 1];
      if (!hex) continue;
      next.push(hex);
      map[keys[i]] = next.length;
    }
    var ng = grid.map(function (row) { return row.map(function (v) { return v ? (map[v] || 0) : 0; }); });
    return { grid: ng, colors: next };
  }

  function extractRegions(grid) {
    var n = grid.length;
    var seen = [];
    var map = [];
    for (var i = 0; i < n; i++) { seen[i] = []; map[i] = []; for (var j = 0; j < n; j++) { seen[i][j] = false; map[i][j] = -1; } }
    var regions = [];
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var color = grid[y][x];
        if (!color || seen[y][x]) continue;
        var cells = [], stack = [[x, y]];
        seen[y][x] = true;
        var sx = 0, sy = 0;
        while (stack.length) {
          var cur = stack.pop(), cx = cur[0], cy = cur[1];
          cells.push({ x: cx, y: cy });
          map[cy][cx] = regions.length;
          sx += cx; sy += cy;
          for (var d = 0; d < 4; d++) {
            var nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
            if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
            if (seen[ny][nx] || grid[ny][nx] !== color) continue;
            seen[ny][nx] = true;
            stack.push([nx, ny]);
          }
        }
        regions.push({ id: regions.length, colorIndex: color, cells: cells, cx: sx / cells.length, cy: sy / cells.length });
      }
    }
    return { regions: regions, map: map };
  }

  function absorbSpeckles(grid, minCells) {
    var n = grid.length;
    for (var pass = 0; pass < 5; pass++) {
      var regions = extractRegions(grid).regions;
      var changed = false;
      for (var r = 0; r < regions.length; r++) {
        var reg = regions[r];
        if (reg.cells.length >= minCells) continue;
        var votes = {};
        for (var i = 0; i < reg.cells.length; i++) {
          var c = reg.cells[i];
          for (var d = 0; d < 4; d++) {
            var nx = c.x + DIRS[d][0], ny = c.y + DIRS[d][1];
            if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
            var col = grid[ny][nx];
            if (col && col !== reg.colorIndex) votes[col] = (votes[col] || 0) + 1;
          }
        }
        var best = 0, bestN = 0;
        for (var k in votes) if (votes[k] > bestN) { best = +k; bestN = votes[k]; }
        if (!best) continue;
        for (var i2 = 0; i2 < reg.cells.length; i2++) grid[reg.cells[i2].y][reg.cells[i2].x] = best;
        changed = true;
      }
      if (!changed) break;
    }
  }

  function compileLevels() {
    return PICTURES.map(function (def, i) {
      var pix = new Pix(def.size);
      def.paint(pix);
      var compacted = compactColors(pix.toGrid(), def.colors);
      absorbSpeckles(compacted.grid, def.size <= 16 ? 3 : 4);
      var compacted2 = compactColors(compacted.grid, compacted.colors);
      var ex = extractRegions(compacted2.grid);
      var cellCount = 0;
      for (var y = 0; y < compacted2.grid.length; y++) {
        for (var x = 0; x < compacted2.grid[y].length; x++) if (compacted2.grid[y][x]) cellCount++;
      }
      return {
        id: i, title: def.title, world: def.world, size: def.size,
        colors: compacted2.colors, grid: compacted2.grid, regions: ex.regions, regionMap: ex.map,
        cellCount: cellCount
      };
    });
  }

  /* ---------- audio ---------- */
  var actx = null, master = null, muted = false;
  function unlockAudio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(actx.destination);
    }
    if (actx.state === "suspended") actx.resume();
  }
  function beep(freq, start, dur, type, vol) {
    if (!actx || !master || muted) return;
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    var t = actx.currentTime + start;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.04);
  }
  function playClick() { unlockAudio(); beep(620, 0, 0.06, "triangle", 0.08); }
  function playFill(streak) {
    unlockAudio();
    var scale = [523, 587, 659, 698, 784, 880, 988, 1046];
    beep(scale[streak % scale.length], 0, 0.11, "sine", 0.16);
  }
  function playWrong() { unlockAudio(); beep(170, 0, 0.14, "sawtooth", 0.08); }
  function playWin() {
    unlockAudio();
    [523, 659, 784, 1046].forEach(function (f, i) { beep(f, i * 0.1, 0.22, "triangle", 0.18); });
  }
  function playHint() { unlockAudio(); beep(880, 0, 0.08, "sine", 0.1); beep(1320, 0.08, 0.12, "sine", 0.1); }

  /* ---------- save ---------- */
  var KEY = "crayonKingdom.pixel.v1";
  function defaultSave() {
    return { unlocked: 1, stars: {}, coins: 0, muted: false, seenTutorial: false, lastLevel: 0, hintsLeft: 5 };
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultSave();
      var d = JSON.parse(raw);
      var s = defaultSave();
      for (var k in s) if (d[k] !== undefined) s[k] = d[k];
      if (!s.stars) s.stars = {};
      return s;
    } catch (e) { return defaultSave(); }
  }
  function writeSave(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  /* ---------- ads ---------- */
  function loadAd(slotEl, kind) {
    if (!slotEl) return;
    slotEl.innerHTML = "";
    var label = document.createElement("div");
    label.className = "ad-label";
    label.textContent = "Advertisement";
    var box = document.createElement("div");
    box.className = "ad-box " + (kind === "square" ? "rect" : "banner");
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.width = "100%";
    ins.style.height = kind === "square" ? "250px" : "70px";
    ins.setAttribute("data-ad-client", window.AD_CLIENT || "ca-pub-4203857211510947");
    ins.setAttribute("data-ad-slot", window.AD_SLOT_BANNER || "7417753724");
    ins.setAttribute("data-ad-format", kind === "square" ? "rectangle" : "horizontal");
    ins.setAttribute("data-full-width-responsive", "true");
    box.appendChild(ins);
    slotEl.appendChild(label);
    slotEl.appendChild(box);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }

  /* ---------- game state ---------- */
  var levels = compileLevels();
  var save = loadSave();
  muted = !!save.muted;
  var screen = "home";
  var currentId = 0, selected = null, painted = new Uint8Array(0), mistakes = 0, hintsUsed = 0, streak = 0;
  var fillAnims = [], shakes = [], hintUntil = 0, peekUntil = 0, comboLabel = null;
  var undoStack = [];
  var tutorialStep = 0, lastStars = 0, lastCoins = 0, finishing = false;
  var displaySize = 1, raf = 0;
  var painting = false, lastCell = null, strokeSnap = null, strokeWrong = false, lastTick = 0;

  var canvas = document.getElementById("gameCanvas");
  var ctx = canvas.getContext("2d");
  var wrap = document.getElementById("canvasWrap");

  function shade(hex, amt) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    var mix = function (c) { return Math.round(c + (255 - c) * amt); };
    return "rgb(" + mix(r) + "," + mix(g) + "," + mix(b) + ")";
  }
  function contrastText(hex) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62 ? "#2a2838" : "#fffdf8";
  }
  function cellKey(x, y, size) { return y * size + x; }
  function paintedCount() {
    var n = 0;
    for (var i = 0; i < painted.length; i++) if (painted[i]) n++;
    return n;
  }
  function remainingColors(level) {
    var remaining = {}, size = level.size;
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var idx = level.grid[y][x];
      if (!idx || painted[cellKey(x, y, size)]) continue;
      remaining[idx] = (remaining[idx] || 0) + 1;
    }
    return remaining;
  }
  function nextIncomplete(level, current) {
    var remaining = remainingColors(level);
    if (current && remaining[current]) return current;
    for (var n = 1; n <= level.colors.length; n++) if (remaining[n]) return n;
    return null;
  }
  function snapshotPainted() { return new Uint8Array(painted); }
  function lineCells(x0, y0, x1, y1) {
    var cells = [], dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy, x = x0, y = y0;
    for (;;) {
      cells.push({ x: x, y: y });
      if (x === x1 && y === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return cells;
  }
  function remainingCellsOfColor(level, colorIndex) {
    var cells = [], size = level.size;
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      if (level.grid[y][x] === colorIndex && !painted[cellKey(x, y, size)]) cells.push({ x: x, y: y });
    }
    return cells;
  }
  function smallestLeftoverCluster(level, colorIndex) {
    var leftover = remainingCellsOfColor(level, colorIndex);
    if (!leftover.length) return [];
    var size = level.size, remain = {};
    leftover.forEach(function (c) { remain[cellKey(c.x, c.y, size)] = true; });
    var clusters = [];
    leftover.forEach(function (start) {
      var k = cellKey(start.x, start.y, size);
      if (!remain[k]) return;
      var cells = [], stack = [start];
      delete remain[k];
      while (stack.length) {
        var cur = stack.pop();
        cells.push(cur);
        for (var d = 0; d < 4; d++) {
          var nx = cur.x + DIRS[d][0], ny = cur.y + DIRS[d][1], nk = cellKey(nx, ny, size);
          if (!remain[nk]) continue;
          delete remain[nk];
          stack.push({ x: nx, y: ny });
        }
      }
      clusters.push(cells);
    });
    clusters.sort(function (a, b) { return a.length - b.length; });
    var smallest = clusters[0] || [];
    if (smallest.length <= 14) return smallest;
    var cx = 0, cy = 0;
    smallest.forEach(function (c) { cx += c.x; cy += c.y; });
    cx /= smallest.length; cy /= smallest.length;
    return smallest.slice().sort(function (a, b) {
      return Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy);
    }).slice(0, 12);
  }

  function showScreen(name) {
    screen = name;
    ["home", "gallery", "play", "complete", "howto"].forEach(function (id) {
      document.getElementById(id).classList.toggle("active", id === name);
    });
    if (name === "home" || name === "gallery" || name === "complete") {
      document.querySelectorAll("#" + name + " [data-ad]").forEach(function (el) {
        loadAd(el, el.getAttribute("data-ad"));
      });
    }
  }

  function toast(text, kind) {
    var el = document.getElementById("toast");
    el.textContent = text;
    el.className = "toast show " + (kind || "");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.className = "toast"; }, 900);
  }

  function drawThumb(cv, level, completed) {
    var n = level.size, css = cv.clientWidth || 72, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.floor(css * dpr); cv.height = Math.floor(css * dpr);
    var c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    var cell = css / n;
    c.fillStyle = "#fffbf5"; c.fillRect(0, 0, css, css);
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var idx = level.grid[y][x]; if (!idx) continue;
      c.fillStyle = completed ? level.colors[idx - 1] : shade(level.colors[idx - 1], 0.72);
      c.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }

  function draw() {
    var level = levels[currentId]; if (!level) return;
    var n = level.size, cell = displaySize / n, now = performance.now();
    var peeking = now < peekUntil, hinting = now < hintUntil;
    ctx.clearRect(0, 0, displaySize, displaySize);
    ctx.fillStyle = "#fffbf5"; ctx.fillRect(0, 0, displaySize, displaySize);
    var animKey = {};
    for (var a = 0; a < fillAnims.length; a++) animKey[fillAnims[a].x + "," + fillAnims[a].y] = fillAnims[a];

    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var idx = level.grid[y][x]; if (!idx) continue;
      var hex = level.colors[idx - 1];
      var isFilled = painted[cellKey(x, y, n)] === 1 || peeking;
      var anim = animKey[x + "," + y];
      if (anim && !peeking) {
        var life = (now - anim.born) / anim.dur;
        if (life < 1) {
          var pop = 1 + 0.18 * Math.sin(Math.min(1, Math.max(0, life)) * Math.PI);
          var pad = ((1 - pop) * cell) / 2;
          ctx.fillStyle = hex;
          ctx.fillRect(x * cell + pad, y * cell + pad, cell * pop + 0.5, cell * pop + 0.5);
          continue;
        }
      }
      ctx.fillStyle = isFilled ? hex : (selected === idx || hinting ? shade(hex, 0.58) : shade(hex, 0.82));
      ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    }
    ctx.strokeStyle = "rgba(42,40,56,0.10)"; ctx.lineWidth = 1;
    for (var i = 0; i <= n; i++) {
      var p = Math.round(i * cell) + 0.5;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, displaySize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(displaySize, p); ctx.stroke();
    }
    if (!peeking) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var numFont = Math.max(8, Math.min(15, cell * 0.48));
      ctx.font = "700 " + numFont + "px Fredoka, Nunito, sans-serif";
      for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) {
        var cidx = level.grid[yy][xx];
        if (!cidx || painted[cellKey(xx, yy, n)]) continue;
        ctx.fillStyle = selected === cidx ? contrastText(shade(level.colors[cidx - 1], 0.5)) : "rgba(42,40,56,0.72)";
        ctx.fillText(String(cidx), (xx + 0.5) * cell, (yy + 0.5) * cell + 0.5);
      }
    }
    for (var s = 0; s < shakes.length; s++) {
      var sh = shakes[s];
      if (sh.until < now) continue;
      ctx.save(); ctx.strokeStyle = "#e85d4c"; ctx.lineWidth = 2.5;
      ctx.globalAlpha = Math.max(0.2, (sh.until - now) / 280);
      ctx.strokeRect(sh.x * cell + 1, sh.y * cell + 1, cell - 2, cell - 2);
      ctx.restore();
    }
    if (comboLabel) {
      ctx.save(); ctx.font = "700 " + Math.max(22, displaySize * 0.08) + "px Fredoka, sans-serif";
      ctx.textAlign = "center"; ctx.fillStyle = "rgba(42,40,56,0.88)";
      ctx.fillText(comboLabel, displaySize / 2, displaySize * 0.12); ctx.restore();
    }
    fillAnims = fillAnims.filter(function (a) { return now - a.born < a.dur + 80; });
    shakes = shakes.filter(function (sh) { return sh.until > now; });
    if (peekUntil && peekUntil < now) peekUntil = 0;
    if (hintUntil && hintUntil < now) hintUntil = 0;
    if (comboLabel && !fillAnims.length) comboLabel = null;
    var live = fillAnims.length || shakes.length || now < peekUntil || now < hintUntil || comboLabel;
    if (live) raf = requestAnimationFrame(draw);
  }

  function resizeCanvas() {
    var rect = wrap.getBoundingClientRect();
    var size = Math.floor(Math.max(80, Math.min(rect.width, rect.height)));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(size * dpr); canvas.height = Math.floor(size * dpr);
    canvas.style.width = size + "px"; canvas.style.height = size + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    displaySize = size; draw();
  }

  function paintCell(cellX, cellY) {
    var level = levels[currentId]; if (!level) return false;
    if (cellX < 0 || cellY < 0 || cellX >= level.size || cellY >= level.size) return false;
    var idx = level.grid[cellY][cellX];
    if (!idx) return false;
    var i = cellKey(cellX, cellY, level.size);
    if (painted[i]) return false;
    if (!selected) { toast("Pick a crayon first"); return false; }
    if (idx !== selected) {
      if (!strokeWrong) {
        strokeWrong = true;
        playWrong(); mistakes++; streak = 0; comboLabel = null;
        toast("Wrong number — look at the crayon", "bad");
      }
      shakes.push({ x: cellX, y: cellY, until: performance.now() + 280 });
      draw();
      return false;
    }
    if (!strokeSnap) strokeSnap = snapshotPainted();
    painted[i] = 1;
    fillAnims.push({ x: cellX, y: cellY, born: performance.now(), dur: 180 });
    streak++;
    var now = performance.now();
    if (now - lastTick > 55) {
      lastTick = now;
      playFill(streak);
    }
    if (streak >= 40) comboLabel = "Brilliant";
    else if (streak >= 24) comboLabel = "Great";
    else if (streak >= 12) comboLabel = "Nice";
    if (!remainingColors(level)[selected]) selected = nextIncomplete(level, selected);
    if (tutorialStep === 2) tutorialStep = 3;
    else if (tutorialStep === 3 && paintedCount() >= 8) tutorialStep = 0;
    return true;
  }

  function finishIfDone() {
    var level = levels[currentId];
    if (finishing || paintedCount() < level.cellCount) return;
    finishing = true;
    var stars = 1;
    if (mistakes === 0 && hintsUsed === 0) stars = 3;
    else if (mistakes <= 3 && hintsUsed <= 1) stars = 2;
    var coinsGain = stars === 3 ? 15 : stars === 2 ? 10 : 5;
    save.stars[currentId] = Math.max(save.stars[currentId] || 0, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(levels.length, currentId + 2));
    save.coins += coinsGain;
    save.lastLevel = Math.min(levels.length - 1, currentId + 1);
    save.seenTutorial = true;
    writeSave(save);
    lastStars = stars; lastCoins = coinsGain;
    playWin();
    setTimeout(function () {
      finishing = false;
      document.getElementById("completeTitle").textContent = currentId + 1 >= levels.length ? "You colored them all" : "Picture complete";
      document.getElementById("completeSub").textContent = level.title;
      document.getElementById("completeStars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
      document.getElementById("completeCoins").textContent = "+" + coinsGain + " coins";
      document.getElementById("nextBtn").style.display = currentId + 1 < levels.length ? "flex" : "none";
      drawThumb(document.getElementById("completeThumb"), level, true);
      showScreen("complete");
    }, 420);
  }

  function refreshPlay() {
    var level = levels[currentId];
    var remaining = remainingColors(level);
    var dock = document.getElementById("palette");
    dock.innerHTML = "";
    for (var n = 1; n <= level.colors.length; n++) {
      (function (num) {
        var b = document.createElement("button");
        b.className = "crayon" + (selected === num ? " selected" : "") + (!remaining[num] ? " done" : "");
        b.style.background = level.colors[num - 1];
        b.style.color = contrastText(level.colors[num - 1]);
        b.textContent = num;
        b.onclick = function () { playClick(); selected = num; if (tutorialStep === 1) tutorialStep = 2; refreshPlay(); draw(); };
        dock.appendChild(b);
      })(n);
    }
    document.getElementById("progressBar").style.width = Math.round((paintedCount() / Math.max(1, level.cellCount)) * 100) + "%";
    document.getElementById("playHint").textContent = selected
      ? "Drag across every pixel numbered " + selected + " — color them one by one."
      : "Tap a numbered crayon, then drag across matching pixels in the picture.";
    document.getElementById("hintBtn").textContent = save.hintsLeft > 0 ? "Hint " + save.hintsLeft : "Hint";
    var tut = document.getElementById("tut");
    if (tutorialStep > 0 && tutorialStep < 4) {
      tut.hidden = false;
      document.getElementById("tutText").textContent =
        tutorialStep === 1 ? "1 / 3  Tap a numbered crayon below."
        : tutorialStep === 2 ? "2 / 3  Drag across every matching numbered pixel. Each square fills on its own."
        : "3 / 3  Keep dragging. Finish every pixel to complete the picture.";
    } else tut.hidden = true;
  }

  function startLevel(id) {
    if (!levels[id] || id >= save.unlocked) return;
    playClick();
    currentId = id; selected = null;
    painted = new Uint8Array(levels[id].size * levels[id].size);
    mistakes = 0; hintsUsed = 0; streak = 0;
    fillAnims = []; shakes = []; hintUntil = 0; peekUntil = 0; comboLabel = null;
    undoStack = []; finishing = false; strokeSnap = null; strokeWrong = false; lastCell = null;
    tutorialStep = save.seenTutorial ? 0 : 1;
    save.lastLevel = id; writeSave(save);
    document.getElementById("lvlBadge").textContent = (id + 1) + ". " + levels[id].title;
    showScreen("play");
    refreshPlay();
    requestAnimationFrame(function () { resizeCanvas(); });
  }

  function renderHome() {
    var done = Object.keys(save.stars).length;
    document.getElementById("coinChip").textContent = "Coins " + save.coins;
    document.getElementById("homeProgress").textContent = done + "/" + levels.length + " colored";
    document.getElementById("playBtn").textContent = done === 0 ? "Start coloring" : "Keep coloring";
    document.getElementById("muteBtn").textContent = save.muted ? "🔇" : "🔊";
    var strip = document.getElementById("demoChips");
    if (!strip.childElementCount) {
      ["#E85D4C", "#F4A12C", "#F5C84B", "#3D9A5F", "#6FB6E8", "#2C4A8C"].forEach(function (c, i) {
        var s = document.createElement("span");
        s.className = "crayon"; s.style.width = "32px"; s.style.height = "32px"; s.style.fontSize = "14px";
        s.style.background = c; s.style.color = "#fff"; s.textContent = i + 1; strip.appendChild(s);
      });
    }
  }

  function renderGallery() {
    var list = document.getElementById("galleryList");
    list.innerHTML = "";
    WORLDS.forEach(function (world) {
      var wrapEl = document.createElement("div");
      wrapEl.className = "world";
      wrapEl.innerHTML = '<div class="row"><h3>' + world.title + '</h3><div class="spacer"></div><span class="tag">' + world.tagline + "</span></div>";
      var grid = document.createElement("div");
      grid.className = "level-grid";
      levels.filter(function (l) { return l.world === world.id; }).forEach(function (lvl) {
        var locked = lvl.id >= save.unlocked;
        var stars = save.stars[lvl.id] || 0;
        var btn = document.createElement("button");
        btn.className = "level-tile";
        btn.disabled = locked;
        btn.innerHTML = '<div class="thumb"><canvas></canvas>' + (locked ? '<span class="lock">🔒</span>' : "") + "</div>" +
          '<div class="tile-name">' + (lvl.id + 1) + ". " + lvl.title + "</div>" +
          '<div class="stars">' + "★".repeat(stars) + "☆".repeat(3 - stars) + "</div>";
        grid.appendChild(btn);
        requestAnimationFrame(function () { drawThumb(btn.querySelector("canvas"), lvl, stars > 0); });
        btn.onclick = function () { startLevel(lvl.id); };
      });
      wrapEl.appendChild(grid);
      list.appendChild(wrapEl);
    });
  }

  /* events */
  document.getElementById("playBtn").onclick = function () {
    startLevel(Math.max(0, Math.min(save.lastLevel, save.unlocked - 1)));
  };
  document.getElementById("galleryBtn").onclick = function () { playClick(); renderGallery(); showScreen("gallery"); };
  document.getElementById("galBack").onclick = function () { playClick(); renderHome(); showScreen("home"); };
  document.getElementById("howBtn").onclick = function () { playClick(); showScreen("howto"); };
  document.getElementById("howBack").onclick = function () { playClick(); showScreen("home"); };
  document.getElementById("gotItBtn").onclick = function () { save.seenTutorial = true; writeSave(save); startLevel(0); };
  document.getElementById("playBack").onclick = function () { playClick(); renderGallery(); showScreen("gallery"); };
  document.getElementById("nextBtn").onclick = function () { startLevel(currentId + 1); };
  document.getElementById("replayBtn").onclick = function () { startLevel(currentId); };
  document.getElementById("toGalleryBtn").onclick = function () { playClick(); renderGallery(); showScreen("gallery"); };
  document.getElementById("muteBtn").onclick = function () {
    save.muted = !save.muted; muted = save.muted; writeSave(save);
    if (master && actx) master.gain.setTargetAtTime(muted ? 0 : 0.9, actx.currentTime, 0.02);
    if (!muted) { unlockAudio(); playClick(); }
    renderHome();
  };
  document.getElementById("resetBtn").onclick = function () {
    playClick();
    if (confirm("Reset all stars and unlocks on this device?")) {
      save = defaultSave(); writeSave(save); muted = false; renderGallery();
    }
  };
  document.getElementById("undoBtn").onclick = function () {
    var prev = undoStack.pop(); if (!prev) return;
    playClick(); painted = prev;
    selected = nextIncomplete(levels[currentId], selected);
    fillAnims = []; comboLabel = null;
    refreshPlay(); draw();
  };
  document.getElementById("hintBtn").onclick = function () {
    var level = levels[currentId];
    if (save.hintsLeft <= 0 && save.coins < 8) { toast("Need 8 coins for another hint"); return; }
    var color = selected || nextIncomplete(level, null); if (!color) return;
    var cluster = smallestLeftoverCluster(level, color);
    if (!cluster.length) return;
    playHint();
    if (save.hintsLeft > 0) save.hintsLeft--; else save.coins -= 8;
    writeSave(save); hintsUsed++;
    undoStack.push(snapshotPainted());
    var size = level.size, born = performance.now();
    cluster.forEach(function (c) {
      painted[cellKey(c.x, c.y, size)] = 1;
      fillAnims.push({ x: c.x, y: c.y, born: born, dur: 280 });
    });
    selected = color; hintUntil = born + 900;
    if (!remainingColors(level)[color]) selected = nextIncomplete(level, color);
    refreshPlay(); draw(); finishIfDone();
  };
  document.getElementById("peekBtn").onclick = function () { playClick(); peekUntil = performance.now() + 1400; draw(); };
  document.getElementById("fillBtn").onclick = function () {
    var level = levels[currentId];
    if (!selected) { toast("Pick a crayon, then fill them all"); return; }
    if (save.coins < 12) { toast("Need 12 coins to fill a whole color"); return; }
    var leftover = remainingCellsOfColor(level, selected);
    if (!leftover.length) return;
    playHint(); save.coins -= 12; writeSave(save);
    undoStack.push(snapshotPainted());
    var size = level.size, born = performance.now();
    leftover.forEach(function (c, i) {
      painted[cellKey(c.x, c.y, size)] = 1;
      fillAnims.push({ x: c.x, y: c.y, born: born + i * 8, dur: 280 });
    });
    selected = nextIncomplete(level, selected);
    refreshPlay(); draw(); finishIfDone();
  };
  document.getElementById("tutSkip").onclick = function () { save.seenTutorial = true; writeSave(save); tutorialStep = 0; refreshPlay(); };

  function eventCell(e) {
    var rect = canvas.getBoundingClientRect();
    var n = levels[currentId].size;
    return {
      x: Math.floor(((e.clientX - rect.left) / rect.width) * n),
      y: Math.floor(((e.clientY - rect.top) / rect.height) * n)
    };
  }
  function paintFromEvent(e) {
    var events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    var changed = false;
    for (var i = 0; i < events.length; i++) {
      var cell = eventCell(events[i]);
      var steps = lastCell ? lineCells(lastCell.x, lastCell.y, cell.x, cell.y) : [cell];
      for (var s = 0; s < steps.length; s++) {
        if (paintCell(steps[s].x, steps[s].y)) changed = true;
      }
      lastCell = cell;
    }
    if (changed) { refreshPlay(); draw(); finishIfDone(); }
    else draw();
  }
  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    unlockAudio(); painting = true; strokeWrong = false; lastCell = null;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    paintFromEvent(e);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!painting) return;
    paintFromEvent(e);
  });
  function endP() {
    if (painting && strokeSnap) {
      undoStack.push(strokeSnap);
      if (undoStack.length > 24) undoStack.shift();
    }
    painting = false; lastCell = null; strokeSnap = null; strokeWrong = false;
  }
  canvas.addEventListener("pointerup", endP);
  canvas.addEventListener("pointercancel", endP);
  window.addEventListener("resize", function () { if (screen === "play") resizeCanvas(); });
  window.addEventListener("pointerdown", unlockAudio, { once: true });

  renderHome();
  showScreen("home");
})();
