/**
 * Force-landscape stage. When the viewport is portrait (phone vertical, or OS
 * rotation lock holding a portrait layout), the game is CSS-rotated into a
 * landscape stage so play stays horizontal. Native landscape is left alone.
 * Pointer coords are remapped so slingshot aiming still hits.
 */
(function () {
  if (window.__fwOrient) return;
  window.__fwOrient = true;

  var html = document.documentElement;
  var lastKey = "";
  var forced = false;
  var timer = 0;
  var dispatching = false;
  var layout = { left: 0, top: 0, w: 0, h: 0, force: false };

  function viewport() {
    var vv = window.visualViewport;
    var w = Math.round(vv && vv.width ? vv.width : window.innerWidth);
    var h = Math.round(vv && vv.height ? vv.height : window.innerHeight);
    var x = Math.round(vv && vv.offsetLeft ? vv.offsetLeft : 0);
    var y = Math.round(vv && vv.offsetTop ? vv.offsetTop : 0);
    if (w < 1) w = window.innerWidth;
    if (h < 1) h = window.innerHeight;
    return { w: w, h: h, x: x, y: y };
  }

  function shouldForce(w, h) {
    if (forced) return h >= w - 2;
    return h > w + 2;
  }

  function clearInline(app) {
    app.style.inset = "";
    app.style.right = "";
    app.style.bottom = "";
    app.style.margin = "0";
    app.style.maxWidth = "none";
    app.style.maxHeight = "none";
  }

  function apply() {
    var app = document.getElementById("app");
    var vp = viewport();
    var force = shouldForce(vp.w, vp.h);
    forced = force;
    var key = vp.w + "x" + vp.h + ":" + vp.x + "," + vp.y + ":" + (force ? "1" : "0");
    if (key === lastKey && app) return false;
    lastKey = key;

    html.classList.toggle("fw-force-landscape", force);
    html.dataset.fwOrient = force ? "force" : "native";

    if (!app) return true;
    clearInline(app);
    app.style.position = "fixed";
    app.style.zIndex = "1";
    app.style.overflow = "hidden";

    if (force) {
      layout = { left: vp.x + vp.w, top: vp.y, w: vp.h, h: vp.w, force: true };
      app.style.top = layout.top + "px";
      app.style.left = layout.left + "px";
      app.style.width = layout.w + "px";
      app.style.height = layout.h + "px";
      if (window.parent !== window) { app.style.transform = "none"; } else app.style.transform = "rotate(90deg)";
      app.style.transformOrigin = "top left";
    } else {
      layout = { left: vp.x, top: vp.y, w: vp.w, h: vp.h, force: false };
      app.style.top = layout.top + "px";
      app.style.left = layout.left + "px";
      app.style.width = layout.w + "px";
      app.style.height = layout.h + "px";
      app.style.transform = "none";
      app.style.transformOrigin = "top left";
    }

    app.dataset.fwLeft = String(layout.left);
    app.dataset.fwTop = String(layout.top);
    app.dataset.fwW = String(layout.w);
    app.dataset.fwH = String(layout.h);
    return true;
  }

  function notifyGame() {
    if (dispatching) return;
    dispatching = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        dispatching = false;
        window.dispatchEvent(new Event("resize"));
      });
    });
  }

  function onChange() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = 0;
      if (apply()) notifyGame();
    }, 50);
  }

  function onOrientationChange() {
    lastKey = "";
    onChange();
    setTimeout(onChange, 80);
    setTimeout(onChange, 250);
    setTimeout(onChange, 480);
  }

  window.__fwPointer = function (clientX, clientY, rect, viewW, viewH) {
    if (!layout.force) {
      return { x: clientX - rect.left, y: clientY - rect.top };
    }
    // rotate(90deg) about top-left of the stage, stage laid out at (left, top):
    // local (lx, ly) -> viewport (left - ly, top + lx)
    var x = clientY - layout.top;
    var y = layout.left - clientX;
    if (viewW > 0 && Math.abs(x - viewW) < 0.5) x = viewW;
    if (viewH > 0 && Math.abs(y - viewH) < 0.5) y = viewH;
    return { x: x, y: y };
  };

  window.__fwLayout = function () {
    return {
      force: layout.force,
      w: layout.w,
      h: layout.h,
      left: layout.left,
      top: layout.top,
    };
  };

  function tryLockLandscape() {
    var o = screen.orientation;
    if (!o || typeof o.lock !== "function") return;
    var p = o.lock("landscape");
    if (p && typeof p.catch === "function") p.catch(function () {});
  }

  function onFirstGesture() {
    tryLockLandscape();
    lastKey = "";
    apply();
    notifyGame();
  }

  ["pointerdown", "touchstart", "click"].forEach(function (ev) {
    window.addEventListener(ev, onFirstGesture, { capture: true, once: true, passive: true });
  });

  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onOrientationChange);
  window.addEventListener("pageshow", onOrientationChange);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") onOrientationChange();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onChange);
    window.visualViewport.addEventListener("scroll", onChange);
  }
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener("change", onOrientationChange);
  }

  if (typeof MutationObserver === "function") {
    var mo = new MutationObserver(function () {
      if (document.getElementById("app")) {
        lastKey = "";
        apply();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () {
      try {
        mo.disconnect();
      } catch (e) {}
    }, 8000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      apply();
    });
  } else {
    apply();
  }
})();
