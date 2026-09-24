import { clamp } from "./types.js";
const GAME_KEYS = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    "ShiftLeft",
    "ShiftRight",
    "KeyN",
    "KeyP",
    "Escape",
    "KeyR",
    "KeyC",
]);
export function createInput() {
    const keys = new Set();
    const pointers = new Map();
    let steerTouch = 0;
    let gasTouch = false;
    let brakeTouch = false;
    let hbTouch = false;
    let nitroTouch = false;
    let injectedSteer = null;
    let injectedKeys = null;
    let pauseEdge = false;
    let lastPause = false;
    let camEdge = false;
    let lastCam = false;
    function onKeyDown(e) {
        if (GAME_KEYS.has(e.code))
            e.preventDefault();
        keys.add(e.code);
    }
    function onKeyUp(e) {
        keys.delete(e.code);
    }
    function clearKeys() {
        keys.clear();
        pointers.clear();
        steerTouch = 0;
        gasTouch = false;
        brakeTouch = false;
        hbTouch = false;
        nitroTouch = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden)
            clearKeys();
    });
    function pollGamepad(actions) {
        const pads = navigator.getGamepads?.() ?? [];
        for (const pad of pads) {
            if (!pad)
                continue;
            const ax = pad.axes[0] ?? 0;
            const mag = Math.abs(ax);
            if (mag > 0.15) {
                const v = ((mag - 0.15) / 0.85) * Math.sign(ax);
                actions.steer += -v;
            }
            const lt = pad.buttons[6]?.value ?? 0;
            const rt = pad.buttons[7]?.value ?? 0;
            if (rt > 0.05)
                actions.throttle = Math.max(actions.throttle, rt);
            if (lt > 0.05)
                actions.brake = Math.max(actions.brake, lt);
            if (pad.buttons[0]?.pressed)
                actions.throttle = 1;
            if (pad.buttons[2]?.pressed || pad.buttons[1]?.pressed)
                actions.handbrake = true;
            if (pad.buttons[5]?.pressed || pad.buttons[3]?.pressed)
                actions.nitro = true;
            if (pad.buttons[9]?.pressed)
                actions.pause = true;
            if (pad.buttons[14]?.pressed)
                actions.steer += 1;
            if (pad.buttons[15]?.pressed)
                actions.steer -= 1;
        }
    }
    function sample() {
        const k = injectedKeys ? new Set(injectedKeys) : keys;
        const actions = {
            throttle: 0,
            brake: 0,
            steer: 0,
            handbrake: false,
            nitro: false,
            pause: false,
            camera: false,
        };
        if (k.has("KeyW") || k.has("ArrowUp"))
            actions.throttle = 1;
        if (k.has("KeyS") || k.has("ArrowDown"))
            actions.brake = 1;
        if (k.has("KeyA") || k.has("ArrowLeft"))
            actions.steer += 1;
        if (k.has("KeyD") || k.has("ArrowRight"))
            actions.steer -= 1;
        if (k.has("Space"))
            actions.handbrake = true;
        if (k.has("ShiftLeft") || k.has("ShiftRight") || k.has("KeyN"))
            actions.nitro = true;
        if (k.has("Escape") || k.has("KeyP"))
            actions.pause = true;
        if (k.has("KeyC"))
            actions.camera = true;
        if (gasTouch)
            actions.throttle = 1;
        if (brakeTouch)
            actions.brake = 1;
        if (hbTouch)
            actions.handbrake = true;
        if (nitroTouch)
            actions.nitro = true;
        actions.steer += steerTouch;
        pollGamepad(actions);
        if (injectedSteer !== null)
            actions.steer = injectedSteer;
        actions.steer = clamp(actions.steer, -1, 1);
        const pause = actions.pause;
        pauseEdge = pause && !lastPause;
        lastPause = pause;
        actions.pause = pauseEdge;
        const cam = actions.camera;
        camEdge = cam && !lastCam;
        lastCam = cam;
        actions.camera = camEdge;
        return actions;
    }
    return {
        sample,
        clearKeys,
        setSteerTouch(v) {
            steerTouch = clamp(v, -1, 1);
        },
        setGas(v) {
            gasTouch = v;
        },
        setBrake(v) {
            brakeTouch = v;
        },
        setHandbrake(v) {
            hbTouch = v;
        },
        setNitro(v) {
            nitroTouch = v;
        },
        setInjectedSteer(v) {
            injectedSteer = v;
        },
        setInjectedKeys(codes) {
            injectedKeys = codes;
        },
        pointers,
        destroy() {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        },
    };
}
