/* no-zoom.js v3 — disable pinch/double-tap zoom ONLY on game screens (phone app)
 * Previous v2 locked viewport on ALL pages, breaking About/Guides readability.
 * v3: only locks when #play overlay exists or pathname is /play/ or / (vault).
 * For legal pages (about, privacy, guides, articles) it leaves viewport as-is (allow zoom).
 */
(function () {
  "use strict";

  var path = location.pathname;
  var isGamePage = !!document.getElementById('play') || !!document.getElementById('play-frame') || path.indexOf('/play/') !== -1 || path === '/' || path.endsWith('/index.html') || path.endsWith('/') && document.getElementById('game-grid');

  function lockViewport() {
    if (!isGamePage) return;
    try {
      var vp = document.querySelector('meta[name="viewport"]');
      var locked = "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover";
      if (!vp) {
        vp = document.createElement("meta");
        vp.name = "viewport";
        vp.content = locked;
        document.head && document.head.appendChild(vp);
      } else {
        // only lock if not already locked to avoid fighting legal pages
        if (vp.getAttribute('content').indexOf('user-scalable=no') === -1 && isGamePage) {
          vp.setAttribute("content", locked);
        }
      }
    } catch (e) {}
  }

  if (isGamePage) {
    lockViewport();
    try {
      var vp0 = document.querySelector('meta[name="viewport"]');
      if (vp0 && window.MutationObserver) {
        new MutationObserver(function(){
          if (isGamePage) lockViewport();
        }).observe(vp0, { attributes: true, attributeFilter: ["content"] });
      }
    } catch (e) {}
  }

  // 2. Prevent pinch zoom (2+ fingers) — ONLY on game pages
  document.addEventListener(
    "touchmove",
    function (e) {
      if (!isGamePage) return;
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // 3. Prevent double-tap zoom (within 350ms) — only game pages
  var lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    function (e) {
      if (!isGamePage) return;
      var now = Date.now();
      if (now - lastTouchEnd <= 350) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  // 4. Prevent iOS gesture zoom — only game pages
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (ev) {
    document.addEventListener(
      ev,
      function (e) {
        if (!isGamePage) return;
        e.preventDefault();
      },
      { passive: false }
    );
  });

  // 5. Prevent ctrl+wheel / ctrl +/- zoom — only game pages
  document.addEventListener(
    "wheel",
    function (e) {
      if (!isGamePage) return;
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener("keydown", function (e) {
    if (!isGamePage) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0" || e.key === "_" )) {
      e.preventDefault();
    }
  });

  // 6. When game overlay (#play) is open, lock scroll/zoom more aggressively
  function applyPlayLock(isOpen) {
    try {
      if (isOpen) {
        document.documentElement.style.touchAction = "none";
        document.documentElement.style.overscrollBehavior = "none";
        if (document.body) {
          document.body.style.touchAction = "none";
          document.body.style.overscrollBehavior = "none";
          document.body.style.overflow = "hidden";
        }
        var play = document.getElementById("play") || document.querySelector(".play");
        if (play) {
          play.style.touchAction = "none";
          play.style.overscrollBehavior = "none";
        }
      } else {
        document.documentElement.style.touchAction = "";
        document.documentElement.style.overscrollBehavior = "";
        if (document.body) {
          document.body.style.touchAction = "";
          document.body.style.overscrollBehavior = "";
          document.body.style.overflow = "";
        }
        var play2 = document.getElementById("play") || document.querySelector(".play");
        if (play2) {
          play2.style.touchAction = "";
          play2.style.overscrollBehavior = "";
        }
      }
    } catch (e) {}
  }

  function isPlayOpen() {
    var el = document.getElementById("play") || document.querySelector(".play.open");
    if (!el) return false;
    return el.classList.contains("open");
  }

  var isStandalonePlay = !!document.getElementById("play-frame") || location.pathname.indexOf("/play/") !== -1;

  try {
    var playEl = document.getElementById("play") || document.querySelector(".play");
    if (playEl && window.MutationObserver) {
      if (playEl.classList.contains("open")) applyPlayLock(true);
      new MutationObserver(function () {
        applyPlayLock(playEl.classList.contains("open"));
      }).observe(playEl, { attributes: true, attributeFilter: ["class"] });
    }
  } catch (e) {}

  try {
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var open = isPlayOpen();
        if (open) applyPlayLock(true);
        else if (!isStandalonePlay) applyPlayLock(false);
      }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  } catch (e) {}
})();
