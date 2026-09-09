(function (global) {
  function unlockNative() {
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {}
  }

  // Best-effort native lock. Only works in a handful of browsers (mostly
  // Android Chrome, and usually only in fullscreen), so it's a bonus on
  // top of the CSS rotation below, never something we depend on.
  function tryLockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(function () {});
      }
    } catch (e) {}
  }

  function isTouchLike() {
    try {
      return (
        matchMedia("(pointer: coarse)").matches ||
        global.innerWidth < 900 ||
        global.innerHeight < 900
      );
    } catch (e) {
      return global.innerWidth < 900;
    }
  }

  function isPortrait() {
    // Prefer the OS-reported orientation type: it updates immediately
    // and correctly reflects a locked orientation, whereas
    // innerWidth/innerHeight can briefly lag (or get the wrong answer
    // while the browser's address bar is animating) right as a phone
    // is physically rotated, which was making the canvas size itself
    // against stale numbers for a moment.
    try {
      if (screen.orientation && screen.orientation.type) {
        return screen.orientation.type.indexOf("portrait") === 0;
      }
    } catch (e) {}
    return global.innerHeight > global.innerWidth;
  }

  // Flip the whole app sideways with CSS when a phone/tablet is held
  // upright. This is the part that actually makes the game "auto
  // rotate" — it doesn't wait for (or require) the OS to rotate.
  function applyRotation() {
    const wrap = document.getElementById("wrap");
    if (!wrap) return;
    const embedded = (function () { try { return global.parent !== global; } catch (e) { return true; } })();
    const shouldRotate = !embedded && isTouchLike() && isPortrait();
    wrap.classList.toggle("rot90", shouldRotate);
  }

  function layoutGame() {
    applyRotation();
    if (global.__umbraLayout) global.__umbraLayout();
    global.dispatchEvent(new Event("resize"));
  }

  function onTurn() {
    unlockNative();
    tryLockLandscape();
    layoutGame();
    setTimeout(layoutGame, 60);
    setTimeout(layoutGame, 200);
    setTimeout(layoutGame, 450);
  }

  global.addEventListener("orientationchange", onTurn);
  global.addEventListener("resize", layoutGame);
  if (global.visualViewport) {
    global.visualViewport.addEventListener("resize", layoutGame);
  }
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener("change", onTurn);
  }
  document.addEventListener("DOMContentLoaded", function () {
    // The CSS rotation trick covers every case, so the old "please
    // rotate your device" prompt is never needed anymore.
    var overlay = document.getElementById("rotate-overlay");
    if (overlay) overlay.classList.add("hidden");
    unlockNative();
    onTurn();
  });
  unlockNative();

  global.UmbraOrientation = {
    isBlocked: function () {
      return false;
    },
    check: onTurn,
  };
})(window);