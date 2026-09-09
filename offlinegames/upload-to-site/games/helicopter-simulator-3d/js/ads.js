/* ============================================================
   ads.js  —  Unified ad layer
     • Web      : Google AdSense (display banner + rewarded stub)
     • App      : AdMob via Cordova/Capacitor plugin if present
   Placements:
     - anchored bottom banner (menu + HUD)
     - interstitial after every N completed levels
     - rewarded video for hints / continue / bonus coins
   ============================================================ */
'use strict';

const ADS = (function () {

  /* ---------------------------------------------------------------- */
  /*  CONFIGURATION  — your live IDs                                    */
  /* ---------------------------------------------------------------- */
  const CFG = {
    /* ---- Web (AdSense) ---- */
    adClient: 'ca-pub-4203857211510947',
    slotBanner: '7417753724',

    /* ---- App (AdMob) ---- */
    admob: {
      appId: 'ca-app-pub-4203857211510947~0000000000',           // set your AdMob app ID
      banner: 'ca-app-pub-4203857211510947/8086182570',          // "Vault Banner"
      interstitial: 'ca-app-pub-4203857211510947/3025427580',    // "Game Interstitial"
      rewarded: 'ca-app-pub-4203857211510947/3025427580'         // reuse until a rewarded unit exists
    },

    /* test mode is forced on localhost / file:// so you never get invalid traffic */
    interstitialEveryLevels: 3,
    minSecondsBetweenInterstitials: 75
  };

  /* ---------------------------------------------------------------- */
  const state = {
    platform: 'web',      // 'web' | 'app'
    admobReady: false,
    testMode: false,
    bannerVisible: false,
    levelsSinceAd: 0,
    lastInterstitial: 0,
    adsenseLoaded: false,
    rewardCb: null
  };

  function isApp() {
    return !!(window.cordova || window.Capacitor ||
      (window.admob) || (window.plugins && window.plugins.AdMob) ||
      /(^file:)|(capacitor:)|(ionic:)/i.test(location.protocol));
  }

  function isLocal() {
    return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(location.hostname)
      || location.protocol === 'file:' || location.hostname === '';
  }

  /* ---------------------------------------------------------------- */
  /*  INIT                                                             */
  /* ---------------------------------------------------------------- */
  function init() {
    state.platform = isApp() ? 'app' : 'web';
    state.testMode = isLocal();
    document.documentElement.setAttribute('data-platform', state.platform);

    if (state.platform === 'app') initAdMob();
    else initAdSense();

    return state.platform;
  }

  /* ---------------- WEB : AdSense ---------------- */
  function initAdSense() {
    if (state.testMode) {
      // Never request live ads from localhost/file — show a labelled placeholder.
      markPlaceholders('AdSense placeholder — live ads serve on offlinegames.art');
      return;
    }
    try {
      const s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CFG.adClient;
      s.onload = () => { state.adsenseLoaded = true; pushAdSenseUnits(); };
      s.onerror = () => markPlaceholders('Ad could not load');
      document.head.appendChild(s);
    } catch (e) {
      markPlaceholders('Ad blocked');
    }
  }

  function pushAdSenseUnits() {
    document.querySelectorAll('ins.adsbygoogle:not([data-filled])').forEach(el => {
      try {
        el.setAttribute('data-filled', '1');
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) { /* ignore */ }
    });
  }

  function markPlaceholders(text) {
    document.querySelectorAll('.ad-slot').forEach(el => {
      el.classList.add('ad-placeholder');
      el.setAttribute('data-label', text);
    });
  }

  /* ---------------- APP : AdMob ---------------- */
  function admobPlugin() {
    return window.admob || (window.plugins && window.plugins.AdMob) || window.AdMob || null;
  }

  function initAdMob() {
    document.addEventListener('deviceready', setupAdMob, false);
    // Capacitor apps fire no deviceready
    if (window.Capacitor) setTimeout(setupAdMob, 300);
    else setTimeout(setupAdMob, 1500);   // safety net
  }

  let admobSetupDone = false;
  function setupAdMob() {
    if (admobSetupDone) return;
    const A = admobPlugin();
    if (!A) return;
    admobSetupDone = true;
    try {
      if (A.start) A.start();
      if (A.initialize) A.initialize({ appId: CFG.admob.appId });
      state.admobReady = true;
      showBanner();
      preloadInterstitial();
      preloadRewarded();
    } catch (e) {
      console.warn('AdMob init failed', e);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  BANNER                                                           */
  /* ---------------------------------------------------------------- */
  function showBanner() {
    state.bannerVisible = true;
    const bar = document.getElementById('adBanner');
    if (state.platform === 'web') {
      if (bar) bar.classList.remove('hidden');
      if (state.adsenseLoaded) pushAdSenseUnits();
      return;
    }
    const A = admobPlugin();
    if (!A) return;
    try {
      if (A.banner && A.banner.show) {
        A.banner.show({ id: CFG.admob.banner, position: 'bottom', npa: false });
      } else if (A.createBannerView) {
        A.createBannerView({ adId: CFG.admob.banner, position: 8, autoShow: true });
      }
    } catch (e) { /* ignore */ }
  }

  function hideBanner() {
    state.bannerVisible = false;
    const bar = document.getElementById('adBanner');
    if (state.platform === 'web') { if (bar) bar.classList.add('hidden'); return; }
    const A = admobPlugin();
    try {
      if (A && A.banner && A.banner.hide) A.banner.hide();
      else if (A && A.hideBanner) A.hideBanner();
    } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------- */
  /*  INTERSTITIAL — shown after every N levels                         */
  /* ---------------------------------------------------------------- */
  function preloadInterstitial() {
    const A = admobPlugin();
    if (!A) return;
    try {
      if (A.interstitial && A.interstitial.load) A.interstitial.load({ id: CFG.admob.interstitial });
      else if (A.prepareInterstitial) A.prepareInterstitial({ adId: CFG.admob.interstitial, autoShow: false });
    } catch (e) { /* ignore */ }
  }

  function notifyLevelComplete(onDone) {
    state.levelsSinceAd++;
    const now = Date.now() / 1000;
    const due = state.levelsSinceAd >= CFG.interstitialEveryLevels &&
                (now - state.lastInterstitial) > CFG.minSecondsBetweenInterstitials;
    if (!due) { if (onDone) onDone(false); return; }
    state.levelsSinceAd = 0;
    state.lastInterstitial = now;
    showInterstitial(onDone);
  }

  function showInterstitial(onDone) {
    if (state.platform === 'app') {
      const A = admobPlugin();
      if (A) {
        try {
          if (A.interstitial && A.interstitial.show) {
            A.interstitial.show().then(() => { preloadInterstitial(); if (onDone) onDone(true); })
              .catch(() => { if (onDone) onDone(false); });
            return;
          }
          if (A.showInterstitial) {
            A.showInterstitial();
            setTimeout(() => { preloadInterstitial(); if (onDone) onDone(true); }, 400);
            return;
          }
        } catch (e) { /* fall through */ }
      }
    }
    // Web: a full-screen house/AdSense panel with a skip timer
    showWebInterstitial(onDone);
  }

  function showWebInterstitial(onDone) {
    const ov = document.getElementById('adInterstitial');
    if (!ov) { if (onDone) onDone(false); return; }
    ov.classList.remove('hidden');
    if (!state.testMode) pushAdSenseUnits();
    const btn = document.getElementById('adSkip');
    let t = 5;
    btn.disabled = true;
    btn.textContent = 'Skip in ' + t;
    const iv = setInterval(() => {
      t--;
      if (t <= 0) {
        clearInterval(iv);
        btn.disabled = false;
        btn.textContent = 'Continue ▶';
      } else btn.textContent = 'Skip in ' + t;
    }, 1000);
    const close = () => {
      clearInterval(iv);
      ov.classList.add('hidden');
      btn.removeEventListener('click', close);
      if (onDone) onDone(true);
    };
    btn.addEventListener('click', close);
  }

  /* ---------------------------------------------------------------- */
  /*  REWARDED — hints, continue, coin bonus                            */
  /* ---------------------------------------------------------------- */
  function preloadRewarded() {
    const A = admobPlugin();
    if (!A) return;
    try {
      if (A.rewarded && A.rewarded.load) A.rewarded.load({ id: CFG.admob.rewarded });
      else if (A.prepareRewardVideoAd) A.prepareRewardVideoAd({ adId: CFG.admob.rewarded, autoShow: false });
    } catch (e) { /* ignore */ }
  }

  /**
   * showRewarded(reason, cb) — cb(granted:boolean)
   * reason: 'hint' | 'continue' | 'coins'
   */
  function showRewarded(reason, cb) {
    if (state.platform === 'app') {
      const A = admobPlugin();
      if (A) {
        try {
          if (A.rewarded && A.rewarded.show) {
            A.rewarded.show().then(() => { preloadRewarded(); cb(true); })
              .catch(() => cb(false));
            return;
          }
          if (A.showRewardVideoAd) {
            const handler = () => {
              document.removeEventListener('admob.rewardvideo.reward', handler);
              preloadRewarded(); cb(true);
            };
            document.addEventListener('admob.rewardvideo.reward', handler);
            A.showRewardVideoAd();
            setTimeout(() => cb(true), 12000);     // safety
            return;
          }
        } catch (e) { /* fall through */ }
      }
    }
    showWebRewarded(reason, cb);
  }

  function showWebRewarded(reason, cb) {
    const ov = document.getElementById('adRewarded');
    if (!ov) { cb(false); return; }
    const title = document.getElementById('adRewardTitle');
    const bar = document.getElementById('adRewardBar');
    const btn = document.getElementById('adRewardClose');
    const claim = document.getElementById('adRewardClaim');

    title.textContent = reason === 'hint' ? 'Watch an ad for a free hint'
      : reason === 'continue' ? 'Watch an ad to continue the mission'
      : 'Watch an ad for bonus coins';

    ov.classList.remove('hidden');
    claim.classList.add('hidden');
    btn.classList.add('hidden');
    bar.style.width = '0%';
    if (!state.testMode) pushAdSenseUnits();

    const dur = 8000;
    const t0 = performance.now();
    let done = false;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      bar.style.width = (p * 100).toFixed(1) + '%';
      if (p < 1) requestAnimationFrame(tick);
      else if (!done) {
        done = true;
        claim.classList.remove('hidden');
      }
    };
    requestAnimationFrame(tick);
    setTimeout(() => btn.classList.remove('hidden'), 3200);

    const finish = (granted) => {
      ov.classList.add('hidden');
      claim.removeEventListener('click', onClaim);
      btn.removeEventListener('click', onClose);
      cb(granted);
    };
    const onClaim = () => finish(true);
    const onClose = () => finish(false);
    claim.addEventListener('click', onClaim);
    btn.addEventListener('click', onClose);
  }

  return {
    CFG, init, showBanner, hideBanner,
    notifyLevelComplete, showInterstitial, showRewarded,
    get platform() { return state.platform; },
    get testMode() { return state.testMode; }
  };
})();

if (typeof module !== 'undefined') module.exports = ADS;
