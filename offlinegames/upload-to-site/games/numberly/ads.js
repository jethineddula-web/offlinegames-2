(function (N) {
'use strict';

const AD_CLIENT = 'ca-pub-4203857211510947';
const AD_SLOT_BANNER = '7417753724';
const AD_ANCHOR_POSITION = 'collapsed-bottom';
const isProductionAdHost = () => /(^|\.)offlinegames\.art$/.test(window.location.hostname);
let loading = null;
let ready = false;
let busy = false;
let lastAdAt = 0;
let desiredSound = false;

function initializeAds() {
  if (N.testMode || !isProductionAdHost() || !navigator.onLine) return Promise.resolve(false);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adBreak || ((options) => { window.adsbygoogle.push(options); });
    window.adConfig = window.adConfig || ((options) => { window.adsbygoogle.push(options); });
    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-ad-client', AD_CLIENT);
    script.setAttribute('data-ad-frequency-hint', '120s');
    // Google's own bottom anchor supports mobile; do not pin or refresh a regular display unit.
    script.setAttribute('data-overlays', AD_ANCHOR_POSITION);
    script.onerror = () => resolve(false);
    script.onload = () => resolve(true);
    document.head.appendChild(script);
    window.adConfig({ preloadAdBreaks: 'on', sound: desiredSound ? 'on' : 'off', onReady: () => {
      ready = true;
      window.adConfig?.({ sound: desiredSound ? 'on' : 'off' });
    } });
    window.setTimeout(() => resolve(false), 7000);
  });
  return loading;
}

function updateAdSound(enabled) {
  desiredSound = enabled;
  if (ready) window.adConfig?.({ sound: enabled ? 'on' : 'off' });
}

function requestAd(type, onActive, onVerifiedReward) {
  if (!ready || !window.adBreak || busy || !navigator.onLine) return Promise.resolve('unavailable');
  if (type === 'next' && Date.now() - lastAdAt < 120000) return Promise.resolve('unavailable');
  busy = true;
  return new Promise((resolve) => {
    let settled = false;
    let result = 'unavailable';
    let rewarded = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      busy = false;
      onActive(false);
      resolve(result);
    };
    let timeout = window.setTimeout(finish, 8000);
    try {
      window.adBreak({
        type,
        name: type === 'reward' ? 'numberly-double-gems' : 'numberly-every-two-rounds',
        beforeAd: () => {
          if (settled) return;
          lastAdAt = Date.now();
          clearTimeout(timeout);
          // A provider failure must not leave the game permanently waiting.
          timeout = window.setTimeout(finish, 180000);
          onActive(true);
        },
        afterAd: () => {
          if (settled) return;
          onActive(false);
          clearTimeout(timeout);
          timeout = window.setTimeout(finish, 1000);
        },
        ...(type === 'reward' ? {
          beforeReward: (show) => { if (!settled) show(); },
          adViewed: () => {
            if (settled || rewarded) return;
            rewarded = true;
            result = 'viewed';
            onVerifiedReward?.();
          },
          adDismissed: () => { if (!settled) result = 'dismissed'; },
        } : {}),
        adBreakDone: (info) => {
          if (type === 'next' && info.breakStatus === 'viewed') result = 'viewed';
          finish();
        },
      });
    } catch { finish(); }
  });
}

Object.assign(N, { AD_CLIENT, AD_SLOT_BANNER, AD_ANCHOR_POSITION, isProductionAdHost, initializeAds, updateAdSound, requestAd });
})(globalThis.Numberly = globalThis.Numberly || {});