function viewport() {
    const vv = window.visualViewport;
    return {
        w: vv?.width ?? window.innerWidth,
        h: vv?.height ?? window.innerHeight,
        x: vv?.offsetLeft ?? 0,
        y: vv?.offsetTop ?? 0,
    };
}
export async function tryLockLandscape() {
    try {
        const orient = screen.orientation;
        if (typeof orient?.lock === "function") {
            await orient.lock("landscape");
        }
    }
    catch {
        /* iOS / permission / not in fullscreen */
    }
}
/*
 * True portrait/landscape check based on the real, physical viewport.
 * We no longer fake landscape by CSS-rotating the stage on a portrait
 * phone - instead the caller (boot.js) uses this to show a "rotate your
 * device" screen and pause the game until the phone is actually turned
 * sideways.
 */
export function isPortrait() {
    const vp = viewport();
    return vp.h > vp.w + 8;
}
function resetSteerPad(stage) {
    const pad = stage.querySelector("[data-steer-pad]");
    if (!pad)
        return;
    pad.style.position = "";
    pad.style.width = "";
    pad.style.height = "";
    pad.style.left = "";
    pad.style.top = "";
    pad.style.bottom = "";
    pad.style.transform = "";
    pad.style.transformOrigin = "";
}
export function applyLayout(stage) {
    const vp = viewport();
    document.documentElement.classList.remove("apex-rotated");
    stage.style.position = "fixed";
    stage.style.margin = "0";
    stage.style.padding = "0";
    stage.style.overflow = "hidden";
    stage.style.zIndex = "1";
    stage.style.width = `${vp.w}px`;
    stage.style.height = `${vp.h}px`;
    stage.style.left = `${vp.x}px`;
    stage.style.top = `${vp.y}px`;
    stage.style.transform = "none";
    stage.style.transformOrigin = "top left";
    resetSteerPad(stage);
    const layout = {
        rotated: false,
        w: vp.w,
        h: vp.h,
        screenW: vp.w,
        screenH: vp.h,
        offsetX: vp.x,
        offsetY: vp.y,
    };
    return layout;
}
export function mapClient(clientX, clientY, layout) {
    return { x: clientX - layout.offsetX, y: clientY - layout.offsetY };
}
export function bindLayout(stage, onChange, onOrientationChange) {
    let layout = applyLayout(stage);
    let portrait = isPortrait();
    onChange(layout);
    onOrientationChange?.(portrait);
    const refresh = () => {
        layout = applyLayout(stage);
        onChange(layout);
        const p = isPortrait();
        if (p !== portrait) {
            portrait = p;
            onOrientationChange?.(portrait);
        }
        void tryLockLandscape();
    };
    const onVis = () => {
        if (!document.hidden) {
            requestAnimationFrame(() => {
                refresh();
            });
        }
    };
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.visualViewport?.addEventListener("resize", refresh);
    window.visualViewport?.addEventListener("scroll", refresh);
    screen.orientation?.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    void tryLockLandscape();
    return {
        get: () => layout,
        isPortrait: () => portrait,
        refresh,
        destroy() {
            window.removeEventListener("resize", refresh);
            window.removeEventListener("orientationchange", refresh);
            window.visualViewport?.removeEventListener("resize", refresh);
            window.visualViewport?.removeEventListener("scroll", refresh);
            screen.orientation?.removeEventListener("change", refresh);
            document.removeEventListener("visibilitychange", onVis);
            window.removeEventListener("pageshow", refresh);
            window.removeEventListener("focus", refresh);
        },
    };
}
