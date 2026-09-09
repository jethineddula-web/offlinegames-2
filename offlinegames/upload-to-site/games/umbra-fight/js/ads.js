(function (global) {
  const AD_CLIENT = global.AD_CLIENT || "ca-pub-4203857211510947";
  const AD_SLOT_BANNER = global.AD_SLOT_BANNER || "7417753724";
  const WATCH_SECONDS = 5;

  let busy = false;
  let timer = 0;
  let remaining = 0;
  let onReward = null;
  let onSkip = null;

  function $(id) {
    return document.getElementById(id);
  }

  function refreshBanner() {
    const wrap = $("ad-wrap");
    if (!wrap) return;
    try {
      const ins = wrap.querySelector("ins.adsbygoogle");
      if (ins && !ins.getAttribute("data-adsbygoogle-status")) {
        (global.adsbygoogle = global.adsbygoogle || []).push({});
      }
    } catch (e) {}
  }

  function fillRewardSlot() {
    const slot = $("reward-ad");
    if (!slot) return;
    slot.innerHTML = "";
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.minHeight = "90px";
    ins.setAttribute("data-ad-client", AD_CLIENT);
    ins.setAttribute("data-ad-slot", AD_SLOT_BANNER);
    ins.setAttribute("data-ad-format", "horizontal");
    ins.setAttribute("data-full-width-responsive", "true");
    slot.appendChild(ins);
    try {
      (global.adsbygoogle = global.adsbygoogle || []).push({});
    } catch (e) {}
  }

  function tick() {
    remaining -= 1;
    const count = $("reward-count");
    const claim = $("reward-claim");
    if (count) count.textContent = remaining > 0 ? String(remaining) : "READY";
    if (remaining <= 0) {
      if (claim) {
        claim.disabled = false;
        claim.textContent = "CLAIM REWARD";
      }
      return;
    }
    timer = window.setTimeout(tick, 1000);
  }

  function closeModal(didReward) {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
    const modal = $("reward-modal");
    if (modal) modal.classList.add("hidden");
    busy = false;
    const reward = onReward;
    const skip = onSkip;
    onReward = null;
    onSkip = null;
    if (didReward && typeof reward === "function") reward();
    else if (!didReward && typeof skip === "function") skip();
  }

  function showRewarded(opts) {
    opts = opts || {};
    if (busy) return false;
    const modal = $("reward-modal");
    if (!modal) {
      if (typeof opts.onReward === "function") opts.onReward();
      return true;
    }
    busy = true;
    onReward = opts.onReward || null;
    onSkip = opts.onSkip || null;
    const title = $("reward-title");
    const copy = $("reward-copy");
    const claim = $("reward-claim");
    const skip = $("reward-skip");
    const count = $("reward-count");
    if (title) title.textContent = opts.title || "Shadow Offering";
    if (copy) copy.textContent = opts.body || "A brief offering fills the meter.";
    if (claim) {
      claim.disabled = true;
      claim.textContent = "WAIT…";
    }
    if (skip) skip.textContent = opts.skipLabel || "NO THANKS";
    remaining = WATCH_SECONDS;
    if (count) count.textContent = String(remaining);
    modal.classList.remove("hidden");
    fillRewardSlot();
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(tick, 1000);
    return true;
  }

  function bind() {
    const claim = $("reward-claim");
    const skip = $("reward-skip");
    if (claim) {
      claim.onclick = function () {
        if (claim.disabled) return;
        closeModal(true);
      };
    }
    if (skip) {
      skip.onclick = function () {
        closeModal(false);
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

  global.UmbraAds = {
    AD_CLIENT,
    AD_SLOT_BANNER,
    refreshBanner,
    showRewarded,
    isBusy: function () {
      return busy;
    },
  };
  global.refreshBannerAd = refreshBanner;
})(window);
