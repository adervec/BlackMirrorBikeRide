// Sensor simulator. Lets the entire game be ridden without any hardware paired.
//
//   manual : Arrow Up/Down (or +/-) nudge target watts; you "pedal" by holding.
//   auto   : power oscillates around a set point on its own.
//
// Cadence is derived from power; a simple lagged model drives a believable heart
// rate. Values are pushed through the same onData callback shape as the BLE code.

export class Simulator {
  constructor(onData) {
    this.onData = onData;
    this.mode = 'manual';
    this.targetWatts = 150;
    this.power = 0;
    this.cadence = 0;
    this.heartRate = 70;
    this.t = 0;
    this._timer = null;
    this._keyHandler = null;
  }

  start(mode = 'manual') {
    this.mode = mode;
    this.stop();
    this._keyHandler = (e) => this._onKey(e);
    window.addEventListener('keydown', this._keyHandler);
    const tickMs = 200;
    this._timer = setInterval(() => this._tick(tickMs / 1000), tickMs);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._keyHandler) { window.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
  }

  _onKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') {
      this.targetWatts = Math.min(1200, this.targetWatts + 10); e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === '-' || e.key === '_') {
      this.targetWatts = Math.max(0, this.targetWatts - 10); e.preventDefault();
    }
  }

  setTarget(w) { this.targetWatts = Math.max(0, Math.min(1500, w)); }

  _tick(dt) {
    this.t += dt;
    let target = this.targetWatts;
    if (this.mode === 'auto') {
      target = this.targetWatts + Math.sin(this.t * 0.25) * 60 + Math.sin(this.t * 1.7) * 15;
    } else {
      target += (Math.random() - 0.5) * 12; // human jitter
    }
    target = Math.max(0, target);

    // Power tracks target with a short time constant.
    this.power += (target - this.power) * Math.min(1, dt * 3);
    this.power = Math.max(0, this.power);

    // Cadence rises with power; ~0 W -> coasting/0, climbing watts -> ~70-100 rpm.
    const cadTarget = this.power < 5 ? 0 : 60 + Math.min(40, this.power / 8) + Math.sin(this.t * 2) * 3;
    this.cadence += (cadTarget - this.cadence) * Math.min(1, dt * 2);

    // Heart-rate lag model.
    const hrTarget = Math.min(190, 65 + this.power * 0.42);
    this.heartRate += (hrTarget - this.heartRate) * Math.min(1, dt * 0.05);

    this.onData({
      power: Math.round(this.power),
      cadence: Math.round(this.cadence),
      heartRate: Math.round(this.heartRate)
    });
  }
}
