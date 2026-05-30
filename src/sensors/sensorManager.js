// One object the rest of the app talks to for live rider data, regardless of
// whether values come from a real BLE trainer/HR strap or the simulator.

import { connectPower, connectHeartRate, BLE_SUPPORTED } from './ble.js';
import { Simulator } from './simulator.js';

const STALE_MS = 3000; // if a real sensor goes quiet this long, treat power as 0

export class SensorManager {
  constructor() {
    this._power = 0;
    this._cadence = null;
    this._heartRate = null;
    this._lastPowerTs = 0;
    this._lastHrTs = 0;

    this.powerHandle = null;
    this.hrHandle = null;
    this.simulator = null;

    this.powerSource = null; // label
    this.hrSource = null;
    this.listeners = new Set();
  }

  get bleSupported() { return BLE_SUPPORTED; }
  get simulatorActive() { return !!this.simulator; }

  // Stale-aware power: a quiet real trainer means the rider stopped pedalling.
  get power() {
    if (this.simulator) return this._power;
    if (this.powerSource && performance.now() - this._lastPowerTs > STALE_MS) return 0;
    return this._power;
  }
  get cadence() {
    if (this.simulator) return this._cadence;
    if (this.powerSource && performance.now() - this._lastPowerTs > STALE_MS) return 0;
    return this._cadence;
  }
  get heartRate() {
    if (this.hrSource && performance.now() - this._lastHrTs > STALE_MS && !this.simulator) return null;
    return this._heartRate;
  }

  onStatus(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  _emit() { for (const cb of this.listeners) cb(this.status()); }

  status() {
    return {
      powerSource: this.powerSource,
      hrSource: this.hrSource,
      simulator: this.simulatorActive,
      bleSupported: BLE_SUPPORTED
    };
  }

  _ingest(d) {
    if (d.power !== null && d.power !== undefined) { this._power = d.power; this._lastPowerTs = performance.now(); }
    if (d.cadence !== null && d.cadence !== undefined) this._cadence = d.cadence;
    if (d.heartRate !== null && d.heartRate !== undefined) { this._heartRate = d.heartRate; this._lastHrTs = performance.now(); }
  }

  async connectPower() {
    this.stopSimulator();
    this.powerHandle = await connectPower(
      (d) => this._ingest(d),
      (state, name) => {
        if (state === 'connected') this.powerSource = name;
        if (state === 'disconnected') { this.powerSource = null; this.powerHandle = null; }
        this._emit();
      }
    );
    this.powerSource = this.powerHandle.name;
    this._emit();
  }

  async connectHeartRate() {
    this.hrHandle = await connectHeartRate(
      (d) => this._ingest(d),
      (state, name) => {
        if (state === 'connected') this.hrSource = name;
        if (state === 'disconnected') { this.hrSource = null; this.hrHandle = null; }
        this._emit();
      }
    );
    this.hrSource = this.hrHandle.name;
    this._emit();
  }

  disconnectPower() { try { this.powerHandle?.disconnect(); } catch {} this.powerHandle = null; this.powerSource = null; this._emit(); }
  disconnectHeartRate() { try { this.hrHandle?.disconnect(); } catch {} this.hrHandle = null; this.hrSource = null; this._emit(); }

  startSimulator(mode = 'manual') {
    this.disconnectPower();
    if (!this.simulator) this.simulator = new Simulator((d) => this._ingest(d));
    this.simulator.start(mode);
    this.powerSource = `Simulator (${mode})`;
    this._emit();
  }

  setSimulatorTarget(w) { this.simulator?.setTarget(w); }

  stopSimulator() {
    if (this.simulator) { this.simulator.stop(); this.simulator = null; if (this.powerSource?.startsWith('Simulator')) this.powerSource = null; this._emit(); }
  }
}

// App-wide singleton.
export const sensors = new SensorManager();
