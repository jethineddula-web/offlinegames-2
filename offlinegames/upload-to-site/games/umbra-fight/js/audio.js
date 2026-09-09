(function (global) {
  const AudioEngine = {
    ctx: null,
    master: null,
    music: null,
    sfx: null,
    muted: false,
    musicOn: true,
    unlocked: false,
    musicNodes: [],
    fightPulse: 0,
    musicMode: null,

    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC({ latencyHint: "interactive" });
        this.master = this.ctx.createGain();
        this.music = this.ctx.createGain();
        this.sfx = this.ctx.createGain();
        this.music.gain.value = 0.18;
        this.sfx.gain.value = 0.7;
        this.music.connect(this.master);
        this.sfx.connect(this.master);
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.unlocked = true;
      this.applyMute();
    },

    applyMute() {
      if (!this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.03);
    },

    toggleMute() {
      this.muted = !this.muted;
      this.applyMute();
      return this.muted;
    },

    env(gain, t, a, d, s, r, peak) {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * s), t + a + d);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
    },

    tone(freq, type, dur, peak, dest, slide) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      o.connect(g);
      g.connect(dest || this.sfx);
      this.env(g, t, 0.006, 0.03, 0.32, dur, peak);
      o.start(t);
      o.stop(t + dur + 0.05);
    },

    noise(dur, peak, freq, type) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * Math.max(0.02, dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = type || (freq > 1200 ? "highpass" : "bandpass");
      f.frequency.value = freq;
      f.Q.value = type === "lowpass" ? 0.6 : 1.05;
      const g = this.ctx.createGain();
      src.connect(f);
      f.connect(g);
      g.connect(this.sfx);
      this.env(g, t, 0.003, 0.025, 0.26, dur, peak);
      src.start(t);
      src.stop(t + dur + 0.03);
    },

    play(name) {
      if (!this.unlocked) return;
      const j = 0.94 + Math.random() * 0.12;
      switch (name) {
        case "ui":
          this.tone(640, "triangle", 0.06, 0.07);
          break;
        case "ui2":
          this.tone(784, "sine", 0.09, 0.06);
          this.tone(1175, "sine", 0.12, 0.035);
          break;
        case "punchswing":
          this.noise(0.07, 0.22, 2600 * j, "highpass");
          this.tone(310 * j, "triangle", 0.06, 0.04, null, 170);
          break;
        case "kickswing":
          this.noise(0.1, 0.26, 700 * j, "bandpass");
          this.tone(120 * j, "sawtooth", 0.08, 0.05, null, 70);
          this.noise(0.06, 0.1, 1800, "highpass");
          break;
        case "whoosh":
          this.noise(0.09, 0.16, 1700 * j, "highpass");
          this.tone(200 * j, "sine", 0.08, 0.03, null, 90);
          break;
        case "punch":
        case "punchhit":
          this.noise(0.045, 0.38, 1800 * j, "highpass");
          this.noise(0.08, 0.34, 380, "bandpass");
          this.tone(86 * j, "sine", 0.12, 0.46, null, 44);
          this.tone(240 * j, "triangle", 0.05, 0.07);
          break;
        case "kick":
        case "kickhit":
          this.noise(0.09, 0.4, 160, "lowpass");
          this.tone(48 * j, "sine", 0.22, 0.55, null, 28);
          this.tone(110, "sawtooth", 0.07, 0.05);
          this.noise(0.05, 0.12, 900, "bandpass");
          break;
        case "hit":
          this.noise(0.07, 0.3, 620 * j, "bandpass");
          this.tone(96 * j, "sine", 0.1, 0.24, null, 50);
          break;
        case "block":
          this.tone(420 * j, "square", 0.04, 0.08);
          this.tone(210, "triangle", 0.09, 0.1);
          this.noise(0.05, 0.16, 2800, "highpass");
          this.tone(840, "sine", 0.04, 0.05);
          break;
        case "jump":
          this.tone(160 * j, "sine", 0.1, 0.08, null, 480);
          this.noise(0.07, 0.08, 2200, "highpass");
          break;
        case "land":
          this.noise(0.07, 0.2, 140, "lowpass");
          this.tone(62, "sine", 0.09, 0.16);
          break;
        case "step":
          this.noise(0.035, 0.07, 420 * j, "bandpass");
          this.tone(90, "sine", 0.04, 0.04);
          break;
        case "special":
          this.noise(0.14, 0.16, 900, "bandpass");
          this.tone(70, "sawtooth", 0.26, 0.1, null, 220);
          this.tone(330, "triangle", 0.3, 0.07, null, 520);
          break;
        case "hurt":
          this.tone(170 * j, "sawtooth", 0.12, 0.09, null, 72);
          this.noise(0.09, 0.16, 500, "bandpass");
          break;
        case "ko":
          this.tone(62, "sine", 0.7, 0.38, null, 32);
          this.tone(44, "triangle", 0.9, 0.14);
          this.noise(0.32, 0.2, 140, "lowpass");
          break;
        case "win":
          [392, 523, 659, 784].forEach((f, i) => {
            setTimeout(() => this.tone(f, "triangle", 0.24, 0.1), i * 130);
          });
          break;
        case "lose":
          this.tone(174, "sawtooth", 0.32, 0.09, null, 96);
          this.tone(130, "triangle", 0.5, 0.07);
          this.tone(87, "sine", 0.7, 0.12);
          break;
        case "meter":
          this.tone(880, "sine", 0.06, 0.05);
          break;
        case "fire":
          this.noise(0.26, 0.26, 340, "bandpass");
          this.tone(64, "sawtooth", 0.2, 0.08);
          this.noise(0.18, 0.1, 1400, "highpass");
          break;
        case "ice":
          this.tone(1760, "sine", 0.14, 0.07);
          this.tone(2480, "triangle", 0.18, 0.04);
          this.noise(0.1, 0.08, 5200, "highpass");
          break;
        case "lightning":
          this.noise(0.05, 0.46, 3800, "highpass");
          this.tone(78, "square", 0.07, 0.14, null, 36);
          this.tone(1400, "triangle", 0.04, 0.05);
          break;
        case "poison":
          this.noise(0.22, 0.14, 640, "bandpass");
          this.tone(78, "triangle", 0.24, 0.05, null, 46);
          break;
        case "earth":
          this.tone(42, "sine", 0.3, 0.24);
          this.noise(0.2, 0.2, 110, "lowpass");
          break;
        case "dash":
          this.noise(0.11, 0.18, 2100, "highpass");
          this.tone(240, "sine", 0.09, 0.05, null, 80);
          break;
        case "coin":
          this.tone(988, "sine", 0.07, 0.09);
          this.tone(1319, "triangle", 0.11, 0.06);
          break;
        case "revive":
          this.tone(392, "sine", 0.18, 0.1);
          this.tone(523, "triangle", 0.26, 0.08);
          this.tone(784, "sine", 0.32, 0.07);
          break;
        default:
          this.tone(440, "sine", 0.05, 0.04);
      }
    },

    startMusic(mode) {
      if (this.musicMode === mode && this.musicNodes.length) return;
      this.stopMusic();
      this.musicMode = mode;
      if (!this.ctx || this.muted || !this.musicOn) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const drone = ctx.createOscillator();
      const drone2 = ctx.createOscillator();
      const g = ctx.createGain();
      drone.type = "sine";
      drone2.type = "triangle";
      drone.frequency.value = mode === "fight" ? 49 : 41;
      drone2.frequency.value = mode === "fight" ? 73.5 : 61.5;
      g.gain.value = mode === "fight" ? 0.05 : 0.04;
      drone.connect(g);
      drone2.connect(g);
      g.connect(this.music);
      drone.start(t);
      drone2.start(t);
      this.musicNodes = [drone, drone2, g];

      if (mode === "fight") {
        let beat = 0;
        const pulse = () => {
          if (!this.musicNodes.length) return;
          beat += 1;
          this.tone(42, "sine", 0.08, 0.05, this.music);
          if (beat % 2 === 0) this.tone(84, "triangle", 0.05, 0.016, this.music);
          if (beat % 4 === 0) this.tone(126, "sine", 0.16, 0.014, this.music);
          this.fightPulse = setTimeout(pulse, 540);
        };
        this.fightPulse = setTimeout(pulse, 380);
      } else {
        const notes = [98, 110, 130.8, 146.8, 164.8, 196];
        const melody = () => {
          if (!this.musicNodes.length) return;
          const n = notes[(Math.random() * notes.length) | 0];
          this.tone(n, "sine", 0.85, 0.03, this.music);
          this.fightPulse = setTimeout(melody, 1600 + Math.random() * 900);
        };
        this.fightPulse = setTimeout(melody, 700);
      }
    },

    stopMusic() {
      if (this.fightPulse) {
        clearTimeout(this.fightPulse);
        this.fightPulse = 0;
      }
      this.musicNodes.forEach((n) => {
        try {
          if (n.stop) n.stop();
          n.disconnect();
        } catch (e) {}
      });
      this.musicNodes = [];
      this.musicMode = null;
    },
  };

  document.addEventListener("visibilitychange", () => {
    if (!AudioEngine.ctx) return;
    if (document.hidden) AudioEngine.ctx.suspend();
    else if (AudioEngine.unlocked) AudioEngine.ctx.resume();
  });

  global.AudioEngine = AudioEngine;
})(window);
