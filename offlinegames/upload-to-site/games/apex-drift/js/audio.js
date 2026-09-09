import { clamp } from "./types.js";
export function createAudio() {
    let ctx = null;
    let master = null;
    let musicBus = null;
    let sfxBus = null;
    let engineOsc = null;
    let engineGain = null;
    let engineFilter = null;
    let tireGain = null;
    let musicTimer = 0;
    let musicOn = false;
    let sfxVol = 0.8;
    let musicVol = 0.55;
    let unlocked = false;
    function ensure() {
        if (ctx)
            return ctx;
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC({ latencyHint: "interactive" });
        master = ctx.createGain();
        musicBus = ctx.createGain();
        sfxBus = ctx.createGain();
        musicBus.connect(master);
        sfxBus.connect(master);
        master.connect(ctx.destination);
        master.gain.value = 1;
        musicBus.gain.value = musicVol * musicVol;
        sfxBus.gain.value = sfxVol * sfxVol;
        return ctx;
    }
    function unlock() {
        const c = ensure();
        if (c.state === "suspended")
            void c.resume();
        unlocked = true;
        if (!engineOsc && ctx && sfxBus) {
            engineOsc = ctx.createOscillator();
            engineFilter = ctx.createBiquadFilter();
            engineGain = ctx.createGain();
            engineOsc.type = "sawtooth";
            engineOsc.frequency.value = 40;
            engineFilter.type = "lowpass";
            engineFilter.frequency.value = 420;
            engineGain.gain.value = 0;
            engineOsc.connect(engineFilter);
            engineFilter.connect(engineGain);
            engineGain.connect(sfxBus);
            engineOsc.start();
            const noise = ctx.createBufferSource();
            const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++)
                data[i] = Math.random() * 2 - 1;
            noise.buffer = buf;
            noise.loop = true;
            const ng = ctx.createGain();
            ng.gain.value = 0;
            const nf = ctx.createBiquadFilter();
            nf.type = "bandpass";
            nf.frequency.value = 900;
            noise.connect(nf);
            nf.connect(ng);
            ng.connect(sfxBus);
            noise.start();
            tireGain = ng;
        }
        startMusic();
    }
    function beep(freq, dur, gain = 0.08, type = "square") {
        if (!ctx || !sfxBus)
            return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(gain, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        o.connect(g);
        g.connect(sfxBus);
        o.start();
        o.stop(ctx.currentTime + dur + 0.02);
    }
    function noiseBurst(dur, gain = 0.12, freq = 400) {
        if (!ctx || !sfxBus)
            return;
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++)
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(f);
        f.connect(g);
        g.connect(sfxBus);
        src.start();
    }
    function startMusic() {
        if (!ctx || !musicBus || musicOn)
            return;
        musicOn = true;
        const notes = [110, 146.8, 164.8, 196, 164.8, 146.8];
        let i = 0;
        const pulse = () => {
            if (!ctx || !musicBus || !musicOn)
                return;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "triangle";
            o.frequency.value = notes[i % notes.length];
            g.gain.setValueAtTime(0.0001, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
            o.connect(g);
            g.connect(musicBus);
            o.start();
            o.stop(ctx.currentTime + 0.6);
            i++;
            musicTimer = window.setTimeout(pulse, 520);
        };
        pulse();
    }
    return {
        unlock,
        resume() {
            if (ctx?.state === "suspended")
                void ctx.resume();
        },
        setVolumes(music, sfx) {
            musicVol = clamp(music, 0, 1);
            sfxVol = clamp(sfx, 0, 1);
            if (musicBus)
                musicBus.gain.setTargetAtTime(musicVol * musicVol, ctx?.currentTime ?? 0, 0.03);
            if (sfxBus)
                sfxBus.gain.setTargetAtTime(sfxVol * sfxVol, ctx?.currentTime ?? 0, 0.03);
        },
        engine(speed, throttle, slip) {
            if (!ctx || !engineOsc || !engineGain || !engineFilter || !tireGain)
                return;
            const t = ctx.currentTime;
            const hz = 42 + speed * 2.4 + throttle * 18;
            engineOsc.frequency.setTargetAtTime(hz, t, 0.05);
            engineFilter.frequency.setTargetAtTime(380 + throttle * 520 + speed * 8, t, 0.05);
            engineGain.gain.setTargetAtTime(unlocked ? 0.03 + throttle * 0.05 : 0, t, 0.08);
            tireGain.gain.setTargetAtTime(unlocked ? Math.min(0.12, slip * 0.18) : 0, t, 0.05);
        },
        ui() {
            beep(520, 0.06, 0.05, "square");
        },
        boost() {
            beep(180, 0.2, 0.08, "sawtooth");
            beep(420, 0.18, 0.05, "triangle");
        },
        crash() {
            noiseBurst(0.28, 0.2, 280);
        },
        clash() {
            noiseBurst(0.16, 0.22, 420);
            beep(90, 0.12, 0.1, "sawtooth");
        },
        win() {
            beep(392, 0.12, 0.07, "triangle");
            setTimeout(() => beep(523, 0.16, 0.07, "triangle"), 120);
            setTimeout(() => beep(659, 0.22, 0.07, "triangle"), 240);
        },
        lose() {
            beep(196, 0.3, 0.08, "sine");
            setTimeout(() => beep(147, 0.4, 0.07, "sine"), 180);
        },
        checkpoint() {
            beep(660, 0.07, 0.04, "square");
        },
        lightRed() {
            beep(220, 0.16, 0.09, "square");
        },
        lightGreen() {
            beep(523, 0.12, 0.1, "triangle");
            setTimeout(() => beep(784, 0.22, 0.1, "triangle"), 90);
        },
        silence() {
            musicOn = false;
            window.clearTimeout(musicTimer);
            musicTimer = 0;
            try { if (engineGain) engineGain.gain.value = 0; } catch {}
            try { if (tireGain) tireGain.gain.value = 0; } catch {}
            try { if (musicBus) musicBus.gain.value = 0; } catch {}
            try { if (sfxBus) sfxBus.gain.value = 0; } catch {}
            try { if (master) master.gain.value = 0; } catch {}
        },
        destroy() {
            musicOn = false;
            window.clearTimeout(musicTimer);
            musicTimer = 0;
            try { engineOsc?.stop(); } catch {}
            try { if (tireGain) tireGain.gain.value = 0; } catch {}
            try { if (master) master.gain.value = 0; } catch {}
            try { void ctx?.close(); } catch {}
            engineOsc = null;
            engineGain = null;
            engineFilter = null;
            tireGain = null;
            musicBus = null;
            sfxBus = null;
            master = null;
            ctx = null;
            unlocked = false;
        },
    };
}
