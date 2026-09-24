/**
 * Fully procedural audio engine (WebAudio) — zero asset downloads, works offline.
 *  • Continuous layers: rotor hum, wind/airflow
 *  • One-shots: gem chime, checkpoint, hit, explosion, shot, UI blips
 *  • Generative per-level music: bass pulse, arpeggio, pad, hats
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.rotor = null;
    this.wind = null;
    this.started = false;
    this.musicTimer = null;
    this.step = 0;
    this.level = null;
    this.volume = 0.8;
    this.musicVolume = 0.55;
  }

  /** Silence everything (ad on screen, tab hidden). resume() undoes it. */
  suspend() {
    this.held = true;
    if (this.ctx && this.ctx.state === "running") this.ctx.suspend().catch(() => {});
  }
  resume() {
    this.held = false;
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !this.held) this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);
    this.engineBus = ctx.createGain();
    this.engineBus.gain.value = 0;
    this.engineBus.connect(this.master);
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicBus) this.musicBus.gain.value = v;
  }

  noise() {
    if (!this.ctx || !this.noiseBuf) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    return s;
  }

  startFlight() {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.started) {
      this.engineBus.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
      return;
    }
    this.started = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    f.Q.value = 3;
    const oscs = [];
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = i === 2 ? "square" : "sawtooth";
      o.frequency.value = 90 + i * 7;
      o.connect(f);
      o.start();
      oscs.push(o);
    }
    f.connect(g);
    g.connect(this.engineBus);
    this.rotor = { osc: oscs, gain: g, filter: f };
    const n = this.noise();
    if (n) {
      const wf = ctx.createBiquadFilter();
      wf.type = "bandpass";
      wf.frequency.value = 700;
      wf.Q.value = 0.7;
      const wg = ctx.createGain();
      wg.gain.value = 0;
      n.connect(wf);
      wf.connect(wg);
      wg.connect(this.engineBus);
      n.start();
      this.wind = { osc: [], gain: wg, filter: wf };
    }
    this.engineBus.gain.value = 1;
  }

  stopFlight() {
    if (!this.ctx) return;
    this.engineBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
  }
  resumeFlight() {
    if (!this.ctx) return;
    this.engineBus.gain.setTargetAtTime(1, this.ctx.currentTime, 0.12);
  }

  updateFlight(throttle, speedRatio, boosting) {
    if (!this.ctx || !this.rotor) return;
    const t = this.ctx.currentTime;
    const base = 78 + throttle * 120 + (boosting ? 46 : 0);
    for (let i = 0; i < this.rotor.osc.length; i++) {
      this.rotor.osc[i].frequency.setTargetAtTime(base + i * 9 * (1 + speedRatio), t, 0.08);
    }
    this.rotor.filter.frequency.setTargetAtTime(600 + speedRatio * 2600 + (boosting ? 900 : 0), t, 0.1);
    this.rotor.gain.gain.setTargetAtTime(0.055 + throttle * 0.05, t, 0.1);
    if (this.wind) {
      this.wind.gain.gain.setTargetAtTime(speedRatio * speedRatio * 0.14, t, 0.12);
      this.wind.filter.frequency.setTargetAtTime(500 + speedRatio * 2400, t, 0.12);
    }
  }

  env(dur, peak = 1, attack = 0.005) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  tone(freq, dur, type = "sine", peak = 0.3, slideTo) {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    const g = this.env(dur, peak);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start();
    o.stop(ctx.currentTime + dur + 0.05);
  }

  noiseBurst(dur, from, to, peak, type = "lowpass") {
    const ctx = this.ctx;
    if (!ctx) return;
    const n = this.noise();
    if (!n) return;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(from, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), ctx.currentTime + dur);
    const g = this.env(dur, peak, 0.01);
    n.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    n.start();
    n.stop(ctx.currentTime + dur + 0.05);
  }

  gem(pitchIdx = 0) {
    this.init();
    const base = 880 * Math.pow(2, (pitchIdx % 7) / 12);
    this.tone(base, 0.16, "sine", 0.22);
    this.tone(base * 1.5, 0.22, "triangle", 0.12);
  }
  checkpoint() {
    this.tone(523, 0.12, "square", 0.16);
    setTimeout(() => this.tone(784, 0.2, "square", 0.16), 70);
  }
  boostStart() {
    this.noiseBurst(0.55, 400, 4200, 0.3, "bandpass");
    this.tone(180, 0.4, "sawtooth", 0.1, 520);
  }
  hit() {
    this.noiseBurst(0.3, 1800, 120, 0.42);
    this.tone(90, 0.28, "square", 0.22, 40);
  }
  explosion() {
    this.noiseBurst(0.85, 2400, 60, 0.55);
    this.tone(70, 0.6, "sawtooth", 0.3, 28);
  }
  shoot() {
    this.tone(1250, 0.09, "square", 0.1, 380);
    this.noiseBurst(0.08, 3000, 900, 0.07, "bandpass");
  }
  ability() {
    this.tone(300, 0.5, "sine", 0.2, 1500);
    this.noiseBurst(0.5, 300, 5000, 0.18, "bandpass");
  }
  ui(up = true) {
    this.init();
    this.tone(up ? 660 : 420, 0.07, "square", 0.08);
  }
  purchase() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, "triangle", 0.18), i * 65));
  }
  fail() {
    [400, 320, 240, 160].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, "sawtooth", 0.16), i * 110));
  }
  victory() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, "triangle", 0.2), i * 110));
  }

  startMusic(level) {
    this.init();
    if (!this.ctx) return;
    this.stopMusic();
    this.level = level;
    this.step = 0;
    const interval = (60 / level.music.bpm) * 1000 * 0.5;
    this.musicTimer = window.setInterval(() => this.tick(), interval);
  }
  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  tick() {
    const ctx = this.ctx;
    const lv = this.level;
    if (!ctx || !lv || this.musicVolume <= 0.001) {
      this.step++;
      return;
    }
    const m = lv.music;
    const s = this.step++;
    const t = ctx.currentTime;
    const bar = Math.floor(s / 8) % 4;
    const play = (freq, dur, type, peak, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 900 + m.mood * 2600;
      o.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    if (s % 4 === 0) play(m.root * (bar === 3 ? 1.5 : 1), 0.34, m.padWave, 0.16);
    if (s % 4 === 0 || (m.mood > 0.6 && s % 8 === 6)) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.24);
    }
    const idx = (s * 3 + bar * 2) % m.scale.length;
    const semi = m.scale[idx] + (bar === 2 ? 3 : 0);
    play(m.root * 4 * Math.pow(2, semi / 12), 0.2 + m.mood * 0.08, m.wave, 0.055 + m.mood * 0.03, 6);
    if (m.mood > 0.5 && s % 2 === 1) {
      play(m.root * 8 * Math.pow(2, m.scale[(idx + 2) % m.scale.length] / 12), 0.1, m.wave, 0.025, -8);
    }
    if (s % 8 === 0) {
      [0, 3, 7].forEach((iv, k) =>
        play(m.root * 2 * Math.pow(2, (m.scale[bar % m.scale.length] + iv) / 12), 1.6, m.padWave, 0.035, k * 4)
      );
    }
    if (m.mood > 0.35 && s % 2 === 1 && this.noiseBuf) {
      const n = this.noise();
      if (n) {
        const f = ctx.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = 7000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05 * m.mood, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        n.connect(f);
        f.connect(g);
        g.connect(this.musicBus);
        n.start(t);
        n.stop(t + 0.07);
      }
    }
  }
}

export const audio = new AudioEngine();
