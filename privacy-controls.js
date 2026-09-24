/* privacy-controls.js — advertising privacy controls for offlinegames.art
 *
 * Three jobs, all of them things the privacy policy promises:
 *
 *   1. Child-directed pages request NON-PERSONALISED ads only. Parts of this
 *      site are written for children (the under-8s guide, the parents' guide),
 *      so no advertising profile should be built from those visits. A page can
 *      also opt in by setting <html data-child-directed="1">.
 *
 *   2. Global Privacy Control is honoured. If the browser sends GPC, ads are
 *      switched to non-personalised site-wide, which is what the CCPA/CPRA
 *      section of the privacy policy commits to.
 *
 *   3. A "Privacy options" link is added to the footer so a visitor can reopen
 *      the consent message and change their mind. It only appears when a
 *      consent management platform is actually present, so it never becomes a
 *      link that does nothing.
 *
 * Load this BEFORE the adsbygoogle script so the flag is set before the first
 * ad request is made.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- 1 + 2 */

  // Pages written for children. Paths are matched with "starts with", so both
  // /articles/best-games-for-kids-under-8 and the .html form are covered.
  var CHILD_DIRECTED = [
    "/articles/best-games-for-kids-under-8",
    "/articles/choosing-games-for-young-children",
  ];

  function pathIsChildDirected() {
    var p = location.pathname.replace(/\/+$/, "") || "/";
    for (var i = 0; i < CHILD_DIRECTED.length; i++) {
      if (p.indexOf(CHILD_DIRECTED[i]) === 0) return true;
    }
    return false;
  }

  function markedChildDirected() {
    var el = document.documentElement;
    return !!(el && el.getAttribute("data-child-directed") === "1");
  }

  function gpcEnabled() {
    try {
      return navigator.globalPrivacyControl === true ||
             navigator.globalPrivacyControl === "1";
    } catch (e) { return false; }
  }

  var childDirected = pathIsChildDirected() || markedChildDirected();
  var restricted = gpcEnabled();

  if (childDirected || restricted) {
    window.adsbygoogle = window.adsbygoogle || [];
    // Ask Google for non-personalised ads on this page.
    window.adsbygoogle.requestNonPersonalizedAds = 1;
    if (restricted) {
      // CCPA/CPRA: restrict data processing for this visitor.
      try { window.adsbygoogle.push({ restrictDataProcessing: true }); } catch (e) {}
    }
    // Exposed so it can be confirmed from the console when testing.
    window.OG_AD_PRIVACY = {
      nonPersonalised: true,
      childDirected: childDirected,
      globalPrivacyControl: restricted,
    };
  }

  /* ---------------------------------------------------------------- 2b
     AdSense may run on the web and inside a Trusted Web Activity, but NOT
     inside an app WebView — Google requires AdMob there instead. The ad
     loader is therefore declared with data-ad-src and only switched on when
     we are certain we are not inside a WebView. If this script never runs,
     no ads load, which is the safe direction to fail in. */

  function inAppWebView() {
    var ua = navigator.userAgent || "";
    if (/;\s*wv\)/.test(ua)) return true;       // Android WebView
    if (/WebView/i.test(ua)) return true;
    // iOS WKWebView: Safari-like UA with no "Safari" token and not standalone.
    var iOS = /iPhone|iPad|iPod/.test(ua);
    if (iOS && !/Safari/.test(ua) && !window.navigator.standalone) return true;
    return false;
  }

  function activateAdLoader() {
    var wv = inAppWebView();
    var list = document.querySelectorAll("script[data-ad-src]");
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.dataset.ogAdDone) continue;
      s.dataset.ogAdDone = "1";
      if (wv) { s.parentNode && s.parentNode.removeChild(s); continue; }
      s.src = s.getAttribute("data-ad-src");
    }
    window.OG_ADS_BLOCKED_IN_APP = wv;
  }

  // Catch the tag the moment the parser creates it, so ads are not delayed.
  if (window.MutationObserver) {
    var mo = new MutationObserver(activateAdLoader);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 8000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", activateAdLoader);
  else activateAdLoader();

  /* -------------------------------------------------------------------- 3 */

  function addPrivacyOptionsLink() {
    var nav = document.querySelector(".site-foot nav");
    if (!nav || document.getElementById("og-privacy-options")) return;

    var a = document.createElement("a");
    a.id = "og-privacy-options";
    a.href = "#";
    a.textContent = "Privacy options";
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      try {
        if (window.googlefc && typeof window.googlefc.showRevocationMessage === "function") {
          window.googlefc.showRevocationMessage();
          return;
        }
        if (window.__tcfapi) {
          window.__tcfapi("displayConsentUi", 2, function () {});
          return;
        }
      } catch (e) {}
      location.href = document.querySelector('.site-foot a[href$="privacy"]') ? document.querySelector('.site-foot a[href$="privacy"]').href : "privacy";
    });
    nav.appendChild(a);
  }

  // Only show the link once a consent platform has actually loaded.
  function whenConsentPlatformReady() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var ready = (window.googlefc && window.googlefc.showRevocationMessage) || window.__tcfapi;
      if (ready) { clearInterval(iv); addPrivacyOptionsLink(); return; }
      if (tries > 20) clearInterval(iv); // ~10s; no CMP on this visit
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", whenConsentPlatformReady);
  } else {
    whenConsentPlatformReady();
  }
})();
