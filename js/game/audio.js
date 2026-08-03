/* ============================================================
   SOUND — everything synthesised with WebAudio.
   No files to download, so nothing to wait for and nothing
   that can arrive late mid-swipe.
   ============================================================ */

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // one shared second of noise, reused for every whoosh and splat
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  resume() { this.init(); if (this.ctx?.state === 'suspended') this.ctx.resume(); }
  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? 0.5 : 0; }

  _now() { return this.ctx.currentTime; }

  _noiseBurst({ dur = 0.18, type = 'bandpass', f0 = 1800, f1 = 500, q = 1.2, gain = 0.3, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const t = this._now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  _tone({ f = 440, f2 = null, dur = 0.2, type = 'sine', gain = 0.2, delay = 0 }) {
    if (!this.enabled || !this.ctx) return;
    const t = this._now() + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /* the blade cutting air — fires on fast swipes, throttled by the game */
  whoosh(speed = 1) {
    this._noiseBurst({
      dur: 0.16, f0: 900 + speed * 900, f1: 320, q: 2.2,
      gain: 0.05 + Math.min(0.09, speed * 0.05),
    });
  }

  /* wet cut: bright transient + juicy body, pitched by fruit size */
  slice(pitch = 1) {
    this._noiseBurst({ dur: 0.1, f0: 5200 * pitch, f1: 1400, q: 0.9, gain: 0.22 });
    this._noiseBurst({ dur: 0.22, type: 'lowpass', f0: 1400 * pitch, f1: 260, q: 0.7, gain: 0.16, delay: 0.012 });
    this._tone({ f: 320 * pitch, f2: 130 * pitch, dur: 0.14, type: 'triangle', gain: 0.1 });
  }

  bomb() {
    this._noiseBurst({ dur: 0.55, type: 'lowpass', f0: 3000, f1: 90, q: 0.5, gain: 0.5 });
    this._tone({ f: 160, f2: 32, dur: 0.6, type: 'sawtooth', gain: 0.3 });
    this._tone({ f: 70, f2: 25, dur: 0.8, type: 'sine', gain: 0.35 });
  }

  /* rising bell arpeggio, one note per extra fruit in the combo */
  combo(n = 3) {
    const scale = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    const count = Math.min(n, scale.length);
    for (let i = 0; i < count; i++) {
      this._tone({ f: scale[i], dur: 0.34, type: 'sine', gain: 0.14, delay: i * 0.055 });
      this._tone({ f: scale[i] * 2, dur: 0.2, type: 'sine', gain: 0.05, delay: i * 0.055 });
    }
  }

  miss() {
    this._tone({ f: 300, f2: 120, dur: 0.3, type: 'sine', gain: 0.16 });
  }

  gameOver() {
    const notes = [392, 349.23, 293.66, 233.08];
    notes.forEach((f, i) => {
      this._tone({ f, dur: 0.55, type: 'triangle', gain: 0.16, delay: i * 0.15 });
    });
  }

  start() {
    [523.25, 659.25, 880].forEach((f, i) =>
      this._tone({ f, dur: 0.3, type: 'sine', gain: 0.13, delay: i * 0.07 }));
  }
}
