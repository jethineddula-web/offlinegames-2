// Fully synthesized audio: web "thwips", impacts, wind, city ambience and an
// adaptive orchestral-synth score. No audio files needed.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.5;
    this.sfxVol = 0.8;
    this.intensity = 0;
    this.targetIntensity = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicVol * 0.32;
    this.music.connect(this.master);

    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // brown noise for rumble
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      b[i] = last * 3.5;
    }

    // wind: looped noise through a band-pass that opens with speed
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.sfx);
    wind.start();

    // city rumble
    const amb = ctx.createBufferSource();
    amb.buffer = this.brown;
    amb.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0.12;
    amb.connect(lp).connect(this.ambGain).connect(this.sfx);
    amb.start();

    // reverb send for music
    this.verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.5, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.6);
    }
    this.verb.buffer = ir;
    const vg = ctx.createGain();
    vg.gain.value = 0.35;
    this.verb.connect(vg).connect(this.music);

    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(music * 0.32, this.ctx.currentTime, 0.1);
    this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.1);
  }

  suspend(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend();
    else this.ctx.resume();
  }

  // ---------------------------------------------------------------- sfx helpers
  env(gain, t, a, peak, d) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  noiseBurst({ type = 'bandpass', f0 = 2000, f1 = 800, q = 1, a = 0.005, peak = 0.4, d = 0.15, dest = this.sfx, when = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + a + d);
    const g = this.ctx.createGain();
    this.env(g, t, a, peak, d);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random());
    s.stop(t + a + d + 0.05);
  }
  tone({ type = 'sine', f0 = 440, f1 = f0, a = 0.005, peak = 0.3, d = 0.2, dest = this.sfx, when = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    const g = this.ctx.createGain();
    this.env(g, t, a, peak, d);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  thwip() {
    this.noiseBurst({ type: 'bandpass', f0: 5200, f1: 1400, q: 1.4, a: 0.003, peak: 0.5, d: 0.13 });
    this.tone({ type: 'triangle', f0: 1800, f1: 380, peak: 0.12, d: 0.09 });
  }
  zip() {
    this.noiseBurst({ type: 'bandpass', f0: 700, f1: 3200, q: 0.8, a: 0.05, peak: 0.35, d: 0.25 });
    this.thwip();
  }
  whoosh(strength = 1) {
    this.noiseBurst({ type: 'bandpass', f0: 400, f1: 1600, q: 0.7, a: 0.06, peak: 0.25 * strength, d: 0.3 });
  }
  punch(heavy = false) {
    this.tone({ type: 'sine', f0: heavy ? 170 : 220, f1: 45, peak: heavy ? 0.9 : 0.7, d: heavy ? 0.22 : 0.14 });
    this.noiseBurst({ type: 'lowpass', f0: 3000, f1: 400, q: 0.5, peak: heavy ? 0.6 : 0.45, d: 0.07 });
    this.noiseBurst({ type: 'highpass', f0: 3500, f1: 2500, q: 0.5, peak: 0.15, d: 0.03 });
  }
  hurt() {
    this.tone({ type: 'sawtooth', f0: 180, f1: 60, peak: 0.25, d: 0.25 });
    this.noiseBurst({ type: 'lowpass', f0: 1200, f1: 200, peak: 0.5, d: 0.12 });
  }
  gunshot() {
    this.noiseBurst({ type: 'lowpass', f0: 5000, f1: 300, q: 0.3, a: 0.001, peak: 0.8, d: 0.25 });
    this.tone({ type: 'square', f0: 120, f1: 40, peak: 0.3, d: 0.12 });
  }
  land(hard = false) {
    this.tone({ type: 'sine', f0: 110, f1: 35, peak: hard ? 0.9 : 0.35, d: hard ? 0.35 : 0.15 });
    this.noiseBurst({ type: 'lowpass', f0: 900, f1: 150, peak: hard ? 0.5 : 0.2, d: hard ? 0.4 : 0.15 });
  }
  collect() {
    [0, 0.07, 0.14, 0.21].forEach((w, i) => this.tone({ type: 'sine', f0: [784, 988, 1175, 1568][i], peak: 0.18, d: 0.35, when: w }));
  }
  sense() {
    this.tone({ type: 'sine', f0: 1320, f1: 1250, peak: 0.12, d: 0.18 });
    this.tone({ type: 'sine', f0: 1980, f1: 1900, peak: 0.07, d: 0.18, when: 0.05 });
  }
  alert() {
    this.tone({ type: 'sawtooth', f0: 220, peak: 0.12, d: 0.35 });
    this.tone({ type: 'sawtooth', f0: 330, peak: 0.1, d: 0.5, when: 0.12 });
  }
  success() {
    [0, 0.12, 0.24].forEach((w, i) => this.tone({ type: 'triangle', f0: [523, 659, 784][i], peak: 0.2, d: 0.6, when: w }));
    this.tone({ type: 'triangle', f0: 1046, peak: 0.18, d: 1.0, when: 0.36 });
  }
  carHit() {
    this.tone({ type: 'sine', f0: 120, f1: 40, peak: 0.9, d: 0.3 });
    this.noiseBurst({ type: 'lowpass', f0: 2500, f1: 300, a: 0.002, peak: 0.7, d: 0.25 });
    this.noiseBurst({ type: 'highpass', f0: 4000, f1: 2500, peak: 0.25, d: 0.12, when: 0.02 });
    // angry horn
    this.tone({ type: 'square', f0: 392, peak: 0.07, d: 0.55, when: 0.12 });
    this.tone({ type: 'square', f0: 330, peak: 0.07, d: 0.55, when: 0.12 });
  }
  heal() {
    this.tone({ type: 'sine', f0: 440, f1: 880, a: 0.05, peak: 0.2, d: 0.5 });
  }
  splash() {
    this.noiseBurst({ type: 'lowpass', f0: 1800, f1: 200, a: 0.01, peak: 0.6, d: 0.6 });
  }

  setWind(speed) {
    if (!this.ctx) return;
    const k = Math.min(1, speed / 45);
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(Math.pow(k, 1.6) * 0.5, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(350 + k * 1600, t, 0.15);
  }

  // ---------------------------------------------------------------- music
  // D minor heroic loop: Dm - Bb - F - C, 16th-note sequencer.
  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.intensity += (this.targetIntensity - this.intensity) * 0.05;
    const bpm = 112;
    const stepDur = 60 / bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % 128;
      this.nextTime += stepDur;
    }
  }

  playStep(step, t, sd) {
    const chords = [
      [50, 53, 57, 62],
      [46, 50, 53, 58],
      [53, 57, 60, 65],
      [48, 52, 55, 60],
    ];
    const bar = Math.floor(step / 16) % 8;
    const chord = chords[Math.floor(bar / 2) % 4];
    const s = step % 16;
    const I = this.intensity;
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    // pad at the start of every 2 bars
    if (s === 0 && bar % 2 === 0) {
      for (const n of chord) this.voice('sawtooth', mtof(n), t, sd * 32, 0.035, 900 + I * 1400, 0.6);
      this.voice('sine', mtof(chord[0] - 12), t, sd * 32, 0.12, 400, 0.3);
    }
    // bass ostinato
    if (I > 0.15 && s % 2 === 0) {
      const n = chord[0] - 24 + (s % 8 === 6 ? 7 : 0);
      this.voice('square', mtof(n), t, sd * 1.6, 0.05 * Math.min(1, I * 1.5), 500, 0.01);
    }
    // arpeggio
    if (I > 0.35) {
      const pat = [0, 1, 2, 3, 2, 1, 2, 3];
      const n = chord[pat[s % 8]] + 12;
      this.voice('triangle', mtof(n), t, sd * 0.9, 0.04 * Math.min(1, (I - 0.35) * 2.5), 3000, 0.005, true);
    }
    // brass stabs
    if (I > 0.55 && (s === 0 || s === 6 || s === 12) && bar % 2 === 1) {
      for (const n of chord.slice(0, 3)) this.voice('sawtooth', mtof(n + 12), t, sd * 2.5, 0.03, 2400, 0.01);
    }
    // drums
    if (I > 0.3) {
      if (s === 0 || s === 8 || (I > 0.7 && s === 11)) this.kick(t, Math.min(1, I));
      if (I > 0.5 && (s === 4 || s === 12)) this.snare(t, Math.min(1, I));
      if (I > 0.6 && s % 2 === 1) this.hat(t);
    }
  }

  voice(type, f, t, dur, vol, cutoff, attack, verb = false) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 12;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.15);
    o.connect(flt).connect(g);
    g.connect(this.music);
    if (verb || dur > 1) g.connect(this.verb);
    o.start(t);
    o.stop(t + dur * 1.5);
  }
  kick(t, v) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.5 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + 0.4);
  }
  snare(t, v) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s.connect(f).connect(g);
    g.connect(this.music);
    g.connect(this.verb);
    s.start(t, Math.random());
    s.stop(t + 0.2);
  }
  hat(t) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(this.music);
    s.start(t, Math.random());
    s.stop(t + 0.06);
  }
}
