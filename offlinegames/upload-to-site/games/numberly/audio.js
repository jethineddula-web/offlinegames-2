(function (N) {
'use strict';

class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicTimer = null;
    this.soundEnabled = true;
    this.musicEnabled = false;
    this.muted = false;
    this.note = 0;
  }

  unlock() {
    try {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.65;
        this.master.connect(this.context.destination);
      }
      if (this.context.state !== 'running') void this.context.resume().catch(() => {});
      this.syncMusic();
    } catch { /* Audio is optional when a browser blocks Web Audio. */ }
  }

  configure(sound, music) {
    this.soundEnabled = sound;
    this.musicEnabled = music;
    this.syncMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.65, this.context.currentTime, 0.08);
    }
    this.syncMusic();
  }

  tone(frequency, duration, volume, delay = 0, type = 'sine') {
    if (!this.context || !this.master || this.muted || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  play(name, number = 1) {
    if (!this.soundEnabled) return;
    if (name === 'step') this.tone(250 + (number % 8) * 28, 0.065, 0.09);
    if (name === 'checkpoint') {
      const frequency = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5][(number - 1) % 8];
      this.tone(frequency, 0.32, 0.16);
      this.tone(frequency * 2, 0.2, 0.035, 0.015);
    }
    if (name === 'undo') this.tone(294, 0.13, 0.08);
    if (name === 'error') this.tone(147, 0.13, 0.08, 0, 'triangle');
    if (name === 'click') this.tone(520, 0.1, 0.08);
    if (name === 'win') [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => this.tone(note, 0.7, 0.14, index * 0.095));
    if (name === 'lose') [392, 329.63, 261.63].forEach((note, index) => this.tone(note, 0.45, 0.1, index * 0.14));
  }

  syncMusic() {
    if ((!this.musicEnabled || this.muted || !this.context) && this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicEnabled && !this.muted && this.context && !this.musicTimer) {
      const melody = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66, 220, 293.66, 349.23, 440, 392, 349.23, 293.66, 329.63];
      const play = () => {
        this.tone(melody[this.note % melody.length], 2.8, 0.04);
        if (this.note % 4 === 0) this.tone(melody[this.note % melody.length] / 2, 3.7, 0.025);
        this.note++;
      };
      play();
      this.musicTimer = setInterval(play, 1050);
    }
  }
}

N.audio = new GameAudio();
})(globalThis.Numberly = globalThis.Numberly || {});