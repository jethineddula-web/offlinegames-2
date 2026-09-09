/* ============================================================
   audio.js  —  100% procedural WebAudio engine (no audio files)
   Menu music, in-game ambience, rotor loop, SFX.
   ============================================================ */
'use strict';

const AUDIO = (function () {

  let ctx = null;
  let masterGain, musicGain, sfxGain;
  let started = false;
  let musicEnabled = true, sfxEnabled = true;

  /* ---- rotor engine voices ---- */
  let rotor = null;
  let wind = null;

  /* ---- music scheduler ---- */
  let musicTimer = null, musicNodes = [], musicMode = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain(); masterGain.gain.value = 0.9;
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32;
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.75;
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);

    // gentle master compression so nothing clips
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 26;
    comp.ratio.value = 8; comp.attack.value = 0.004; comp.release.value = 0.22;
    masterGain.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  /* ---------------- noise buffer ---------------- */
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;   // brown-ish noise
      d[i] = last * 3.2 + w * 0.25;
    }
    return noiseBuf;
  }

  /* ---------------- SFX primitives ---------------- */

  function env(node, t0, a, d, peak, sustain, rel) {
    const g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.exponentialRampToValueAtTime(Math.max(0.0002, sustain), t0 + a + d);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d + rel);
  }

  function tone(freq, dur, type, vol, detune, slideTo) {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    if (detune) o.detune.value = detune;
    env(g, t, 0.008, dur * 0.35, vol || 0.3, (vol || 0.3) * 0.28, dur * 0.6);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.1);
  }

  function noiseBurst(dur, freq, q, vol, type) {
    if (!ctx || !sfxEnabled) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    env(g, t, 0.004, dur * 0.3, vol || 0.4, (vol || 0.4) * 0.2, dur * 0.7);
    s.connect(f); f.connect(g); g.connect(sfxGain);
    s.start(t); s.stop(t + dur + 0.15);
  }

  /* ---------------- public SFX ---------------- */
  const SFX = {
    click()      { tone(880, 0.06, 'square', 0.10); tone(1320, 0.05, 'sine', 0.06); },
    hover()      { tone(1200, 0.03, 'sine', 0.04); },
    star()       {
      const base = 660;
      [0, 4, 7, 12].forEach((s, i) => setTimeout(() => tone(base * Math.pow(2, s / 12), 0.22, 'triangle', 0.22), i * 45));
    },
    coin()       { tone(1046, 0.10, 'square', 0.13); setTimeout(() => tone(1568, 0.16, 'square', 0.11), 70); },
    ring()       { tone(523, 0.18, 'sine', 0.2); setTimeout(() => tone(784, 0.26, 'sine', 0.17), 60); },
    hit()        { noiseBurst(0.35, 220, 0.7, 0.55, 'lowpass'); tone(90, 0.3, 'sawtooth', 0.28, 0, 45); },
    crash()      {
      noiseBurst(1.4, 320, 0.5, 0.85, 'lowpass');
      tone(70, 1.0, 'sawtooth', 0.4, 0, 28);
      setTimeout(() => noiseBurst(0.9, 900, 1.2, 0.35), 60);
    },
    landing()    { noiseBurst(0.3, 180, 1.2, 0.3, 'lowpass'); tone(160, 0.2, 'sine', 0.16); },
    warn()       { tone(880, 0.12, 'square', 0.16); setTimeout(() => tone(660, 0.12, 'square', 0.16), 150); },
    success()    { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'triangle', 0.25), i * 110)); },
    fail()       { [392, 349, 294, 233].forEach((f, i) => setTimeout(() => tone(f, 0.45, 'sawtooth', 0.16), i * 130)); },
    purchase()   { [659, 880, 1174].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'square', 0.14), i * 90)); },
    denied()     { tone(200, 0.18, 'square', 0.16); setTimeout(() => tone(150, 0.22, 'square', 0.16), 110); },
    startup()    { tone(60, 2.2, 'sawtooth', 0.14, 0, 210); }
  };

  /* ---------------- rotor / engine loop ---------------- */

  function startRotor() {
    if (!ctx || rotor) return;
    const t = ctx.currentTime;

    // 1. blade slap: noise pulsed by an LFO at blade-passing frequency
    const src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 340; bp.Q.value = 0.9;
    const chop = ctx.createGain(); chop.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 18;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.5;
    lfo.connect(lfoAmt); lfoAmt.connect(chop.gain);

    // 2. turbine whine
    const whine = ctx.createOscillator(); whine.type = 'sawtooth'; whine.frequency.value = 420;
    const whineF = ctx.createBiquadFilter(); whineF.type = 'lowpass'; whineF.frequency.value = 1800;
    const whineG = ctx.createGain(); whineG.gain.value = 0.045;

    // 3. low engine rumble
    const rum = ctx.createOscillator(); rum.type = 'sine'; rum.frequency.value = 58;
    const rumG = ctx.createGain(); rumG.gain.value = 0.10;

    const out = ctx.createGain(); out.gain.value = 0.0001;

    src.connect(bp); bp.connect(chop); chop.connect(out);
    whine.connect(whineF); whineF.connect(whineG); whineG.connect(out);
    rum.connect(rumG); rumG.connect(out);
    out.connect(sfxGain);

    src.start(t); lfo.start(t); whine.start(t); rum.start(t);
    out.gain.exponentialRampToValueAtTime(0.3, t + 1.6);

    rotor = { src, lfo, whine, rum, out, chop, bp, whineG, rumG };

    // wind noise, driven by airspeed
    const ws = ctx.createBufferSource(); ws.buffer = noise(); ws.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'highpass'; wf.frequency.value = 700;
    const wg = ctx.createGain(); wg.gain.value = 0.0001;
    ws.connect(wf); wf.connect(wg); wg.connect(sfxGain);
    ws.start(t);
    wind = { ws, wf, wg };
  }

  function stopRotor() {
    if (!ctx || !rotor) return;
    const t = ctx.currentTime;
    rotor.out.gain.cancelScheduledValues(t);
    rotor.out.gain.setValueAtTime(Math.max(0.0001, rotor.out.gain.value), t);
    rotor.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    const r = rotor, w = wind;
    setTimeout(() => {
      try { r.src.stop(); r.lfo.stop(); r.whine.stop(); r.rum.stop(); } catch (e) {}
      if (w) { try { w.ws.stop(); } catch (e) {} }
    }, 900);
    rotor = null; wind = null;
  }

  /** rpm 0..1, load 0..1 (collective), speed in m/s */
  function updateRotor(rpm, load, speed) {
    if (!ctx || !rotor) return;
    const t = ctx.currentTime;
    const k = 0.08;
    rotor.lfo.frequency.setTargetAtTime(6 + rpm * 26, t, k);
    rotor.whine.frequency.setTargetAtTime(180 + rpm * 520 + load * 120, t, k);
    rotor.rum.frequency.setTargetAtTime(38 + rpm * 34, t, k);
    rotor.bp.frequency.setTargetAtTime(240 + rpm * 300 + load * 200, t, k);
    rotor.out.gain.setTargetAtTime(sfxEnabled ? (0.05 + rpm * 0.30 + load * 0.10) : 0.0001, t, k);
    if (wind) {
      const s = Math.min(1, Math.abs(speed) / 60);
      wind.wg.gain.setTargetAtTime(sfxEnabled ? s * s * 0.22 : 0.0001, t, 0.15);
      wind.wf.frequency.setTargetAtTime(500 + s * 1400, t, 0.15);
    }
  }

  /* ---------------- MUSIC ---------------- */
  /* Two moods, generated: 'menu' (cinematic, hopeful) and 'game' (light pad) */

  const SCALES = {
    menu: [0, 2, 4, 7, 9, 12, 14, 16],          // major pentatonic-ish
    game: [0, 3, 5, 7, 10, 12, 15, 17]          // minor pentatonic
  };

  const PROGRESSIONS = {
    menu: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 7], [2, 5, 9, 12]],
    game: [[0, 3, 7], [-2, 3, 5], [-4, 0, 3], [-5, -1, 2]]
  };

  function padVoice(freq, dur, vol, type, filterHz) {
    const t = ctx.currentTime;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = type; o2.type = type;
    o1.frequency.value = freq; o2.frequency.value = freq;
    o2.detune.value = 7;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = filterHz || 1400; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(musicGain);
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    musicNodes.push(o1, o2);
  }

  function pluck(freq, dur, vol) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    o.connect(f); f.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.05);
    musicNodes.push(o);
  }

  function kick(vol) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.35);
  }

  function hat(vol) {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noise();
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(f); f.connect(g); g.connect(musicGain);
    s.start(t); s.stop(t + 0.1);
  }

  let step = 0, bar = 0;

  function musicStep() {
    if (!ctx || !musicEnabled || !musicMode) return;
    const mode = musicMode;
    const scale = SCALES[mode];
    const prog = PROGRESSIONS[mode];
    const chord = prog[bar % prog.length];
    const root = mode === 'menu' ? 130.81 : 110;   // C3 / A2
    const nf = (semi) => root * Math.pow(2, semi / 12);

    if (step === 0) {
      for (const s of chord) padVoice(nf(s), mode === 'menu' ? 3.6 : 4.2,
        mode === 'menu' ? 0.075 : 0.05, mode === 'menu' ? 'sawtooth' : 'sine',
        mode === 'menu' ? 1500 : 900);
      padVoice(nf(chord[0] - 12), 4.0, 0.06, 'sine', 480);
    }

    if (mode === 'menu') {
      // arpeggio melody
      const patt = [0, 2, 4, 2, 5, 4, 2, 0];
      const idx = patt[step % patt.length];
      if (Math.random() < 0.92) pluck(nf(chord[0] + scale[idx] + 12), 0.55, 0.085);
      if (step % 4 === 0) kick(0.10);
      if (step % 2 === 1) hat(0.020);
    } else {
      if (step % 4 === 0) kick(0.075);
      if (step % 2 === 1) hat(0.012);
      if (step % 8 === 3 || step % 8 === 6) {
        pluck(nf(chord[0] + scale[(Math.random() * scale.length) | 0] + 12), 0.7, 0.045);
      }
    }

    step++;
    if (step >= 8) { step = 0; bar++; }
  }

  function startMusic(mode) {
    ensure();
    if (!ctx) return;
    if (musicMode === mode && musicTimer) return;
    stopMusic();
    musicMode = mode; step = 0; bar = 0;
    if (!musicEnabled) return;
    const bpm = mode === 'menu' ? 84 : 96;
    const stepMs = (60000 / bpm) / 2;      // eighth notes
    musicStep();
    musicTimer = setInterval(musicStep, stepMs);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    musicMode = null;
    musicNodes = [];
  }

  /* ---------------- settings ---------------- */
  function setMusic(on) {
    musicEnabled = on;
    if (musicGain) musicGain.gain.value = on ? 0.32 : 0;
    if (!on) { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
    else if (musicMode) { const m = musicMode; musicMode = null; startMusic(m); }
  }
  function setSfx(on) {
    sfxEnabled = on;
    if (sfxGain) sfxGain.gain.value = on ? 0.75 : 0;
  }

  return {
    resume, ensure,
    sfx: SFX,
    startRotor, stopRotor, updateRotor,
    startMusic, stopMusic,
    setMusic, setSfx,
    get isStarted() { return started; },
    get ctx() { return ctx; }
  };
})();

if (typeof module !== 'undefined') module.exports = AUDIO;
