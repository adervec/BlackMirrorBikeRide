// Synthesised ride audio — no sample files. Tyre/wind hiss scales with speed,
// a chain hum follows cadence, the freewheel clicks when coasting, and short
// cues mark zone changes, workout steps, climbs and a low battery.

export class RideAudio {
  constructor(volume = 0.5) {
    this.ctx = null;
    this.volume = volume;
    this._fw = 0;
  }

  start() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (this.ctx || !AC) return;
    const ac = (this.ctx = new AC());
    this.master = ac.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ac.destination);

    // tyre + wind: looping white noise through a lowpass whose cutoff opens with speed
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    this.lp = ac.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 300;
    this.windGain = ac.createGain(); this.windGain.gain.value = 0;
    noise.connect(this.lp).connect(this.windGain).connect(this.master);
    noise.start();

    // chain hum: quiet sawtooth, pitch follows cadence
    this.chain = ac.createOscillator(); this.chain.type = 'sawtooth'; this.chain.frequency.value = 60;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2;
    this.chainGain = ac.createGain(); this.chainGain.gain.value = 0;
    this.chain.connect(bp).connect(this.chainGain).connect(this.master);
    this.chain.start();
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  update({ speed = 0, cadence = 0, dt = 0.016 } = {}) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const now = this.ctx.currentTime, v = speed || 0, c = cadence || 0;
    this.windGain.gain.setTargetAtTime(Math.min(0.45, (v * v) / 1100), now, 0.15);
    this.lp.frequency.setTargetAtTime(200 + v * 70, now, 0.15);
    const pedalling = c > 20;
    this.chainGain.gain.setTargetAtTime(pedalling ? 0.025 : 0, now, 0.08);
    this.chain.frequency.setTargetAtTime(40 + c * 0.9, now, 0.1);
    if (!pedalling && v > 1) {
      this._fw += dt * v * 5; // pawl clicks per second ∝ wheel speed
      while (this._fw >= 1) { this._fw -= 1; this._tone(2400 + Math.random() * 300, 0.006, 0.03, 'square'); }
    }
  }

  _tone(freq, dur, gain, type = 'sine', at = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  cue(kind) {
    switch (kind) {
      case 'zoneUp':   this._tone(880, 0.12, 0.2); this._tone(1175, 0.16, 0.2, 'sine', 0.12); break;
      case 'zoneDown': this._tone(880, 0.12, 0.2); this._tone(660, 0.16, 0.2, 'sine', 0.12); break;
      case 'step':     this._tone(1046, 0.08, 0.25); this._tone(1046, 0.08, 0.25, 'sine', 0.14); this._tone(1568, 0.2, 0.25, 'sine', 0.28); break;
      case 'climbStart': this._tone(523, 0.1, 0.2); this._tone(659, 0.1, 0.2, 'sine', 0.1); this._tone(784, 0.25, 0.2, 'sine', 0.2); break;
      case 'climbEnd': this._tone(784, 0.1, 0.2); this._tone(1046, 0.3, 0.2, 'sine', 0.1); break;
      case 'done':     [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.25, 0.22, 'sine', i * 0.13)); break;
      case 'battery':  [0, 0.25, 0.5].forEach((at) => this._tone(330, 0.18, 0.25, 'triangle', at)); break;
      default: break;
    }
  }

  stop() { try { this.ctx?.close(); } catch {} this.ctx = null; }
}
