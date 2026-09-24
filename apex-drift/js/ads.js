import { AD_CLIENT, AD_SLOT_BANNER } from "./types.js";
function pushAd() {
    try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
    catch {
        /* adblock / preview */
    }
}
export function fillBanner(el) {
    if (!el)
        return;
    el.innerHTML = "";
    const fallback = document.createElement("span");
    fallback.style.cssText = "position:absolute;color:#71717a;font-size:11px;letter-spacing:0.16em;text-transform:uppercase";
    fallback.textContent = "Sponsored";
    el.style.position = "relative";
    el.appendChild(fallback);
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.width = "100%";
    ins.style.minHeight = "60px";
    ins.setAttribute("data-ad-client", AD_CLIENT);
    ins.setAttribute("data-ad-slot", AD_SLOT_BANNER);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    el.appendChild(ins);
    pushAd();
}
export function fillRewarded(el) {
    if (!el)
        return;
    el.innerHTML = "";
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.width = "100%";
    ins.style.minHeight = "110px";
    ins.setAttribute("data-ad-client", AD_CLIENT);
    ins.setAttribute("data-ad-slot", AD_SLOT_BANNER);
    ins.setAttribute("data-ad-format", "rectangle");
    el.appendChild(ins);
    pushAd();
}
