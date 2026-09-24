/**
 * Ads layer — AdSense display banner + H5 Games Ad Placement API interstitial /
 * rewarded units. Wrapped in timeouts + try/catch so a blocked or offline ad
 * network can never break gameplay.
 */
export const AD_CLIENT = "ca-pub-4203857211510947";
export const AD_SLOT_BANNER = "7417753724";
export const AD_PLACEMENT_INTERSTITIAL = "game-interstitial";
export const AD_PLACEMENT_REWARD = "gem-doubler";

export const isMobile = () =>
  /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

/** Hooks the game sets so its audio is muted while any ad is on screen —
 *  the Ad Placement API requires the game to go quiet during an ad. */
export const adHooks = { beforeAd: () => {}, afterAd: () => {} };

let configured = false;

export function initAds() {
  if (configured) return;
  configured = true;
  try {
    window.adsbygoogle = window.adsbygoogle || [];
    if (!window.adConfig) window.adConfig = (o) => window.adsbygoogle.push(o);
    if (!window.adBreak) window.adBreak = (o) => window.adsbygoogle.push(o);
    window.adConfig({ preloadAdBreaks: "on", sound: "on", onReady: () => {} });
  } catch {
    /* ad blocker / offline */
  }
}

/** Render a banner into `container`. Falls back to a house strip. */
export function mountBanner(container) {
  if (!container) return;
  container.innerHTML = "";
  // Fixed 60px strip sized by CSS. No data-ad-format / full-width-responsive:
  // with those set AdSense can grow the unit past this height and push the
  // menu buttons off a landscape phone screen.
  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.cssText = "display:block;width:100%;height:60px";
  ins.setAttribute("data-ad-client", AD_CLIENT);
  ins.setAttribute("data-ad-slot", AD_SLOT_BANNER);
  container.appendChild(ins);
  let failed = false;
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    failed = true;
  }
  const house = () => {
    container.innerHTML =
      '<div class="glass house-ad"><span>🛸</span><span>OFFLINEGAMES.ART · PLAY FREE HTML5 GAMES</span></div>';
  };
  if (failed) return house();
  setTimeout(() => {
    if (!container.isConnected) return;
    // No data-adsbygoogle-status means the AdSense script never picked the
    // slot up (offline, blocked, in-app WebView) — show the house strip
    // rather than an empty black box.
    const unfilled = ins.getAttribute("data-ad-status") === "unfilled" || !ins.getAttribute("data-adsbygoogle-status");
    if (unfilled) house();
  }, 2600);
}

/** Between-rounds interstitial through the Ad Placement API. Google decides
 *  whether an ad actually shows (frequency caps etc.); resolves when done. */
export function showInterstitial() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    const timer = setTimeout(() => finish(false), 3500);
    try {
      if (!navigator.onLine || !window.adBreak) return finish(false);
      window.adBreak({
        type: "next",
        name: AD_PLACEMENT_INTERSTITIAL,
        beforeAd: () => { clearTimeout(timer); adHooks.beforeAd(); },
        afterAd: () => adHooks.afterAd(),
        adBreakDone: (info) => { clearTimeout(timer); finish(info && info.breakStatus === "viewed"); },
      });
    } catch {
      clearTimeout(timer);
      finish(false);
    }
  });
}

/** Rewarded video for “2× gems”. Resolves "viewed", "dismissed" (an ad was
 *  shown and closed early — no reward) or "unavailable" (no ad to show). */
export function showRewarded(onAdReady) {
  return new Promise((resolve) => {
    let done = false;
    let shown = false;
    let granted = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(() => finish("unavailable"), 4000);
    try {
      if (!navigator.onLine || !window.adBreak) return finish("unavailable");
      window.adBreak({
        type: "reward",
        name: AD_PLACEMENT_REWARD,
        beforeReward: (showAdFn) => {
          clearTimeout(timer);
          if (onAdReady) onAdReady();
          shown = true;
          try { showAdFn(); } catch { shown = false; finish("unavailable"); }
        },
        beforeAd: () => adHooks.beforeAd(),
        afterAd: () => adHooks.afterAd(),
        adViewed: () => { granted = true; },
        adDismissed: () => { granted = false; },
        adBreakDone: () => { clearTimeout(timer); finish(granted ? "viewed" : shown ? "dismissed" : "unavailable"); },
      });
    } catch {
      clearTimeout(timer);
      finish("unavailable");
    }
  });
}
