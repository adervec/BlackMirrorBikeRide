// A session owns the per-frame loop and the live ride state. It runs in one of
// three modes:
//
//   ride    - sensors drive the physics; the ride is recorded to history.
//   preview - auto-advance / scrub through the route fast, with NO avatar.
//   replay  - play back a recorded activity at a speed multiplier.
//
// In ride & replay it can also render a GHOST of a past activity (default the
// all-time PB): the ghost appears only as an icon on the overhead minimap and a
// time-behind readout — never in the 3D world.

import { buildProfile, profileAt, totalDistance } from '../routes/virtualRoute.js';
import { surfaceCrr, surfaceLabel } from '../physics/surfaces.js';
import { createPhysics, computeCdA, totalMass } from '../physics/engine.js';
import { computeBikeSpec } from '../profile/garage.js';
import { createActivity, distanceAtTime, timeAtDistance, sampleAtTime } from './activity.js';

const R_AIR = 287.05;
const P_STD = 101325;
const HUMAN_EFFICIENCY = 0.24;

export class Session {
  constructor(opts) {
    const {
      route, reverse, player, bike, rider, decals = [], skyboxDef = null,
      sensors, world, minimap, hud, settings,
      mode = 'ride', replayActivity = null, ghost = null,
      onEnd, onFrame, onRecord
    } = opts;

    this.route = route;
    this.reverse = !!reverse;
    this.startReverse = !!reverse;
    this.player = player;
    this.bike = bike;
    this.rider = rider;
    this.decals = decals;
    this.skyboxDef = skyboxDef;
    this.sensors = sensors;
    this.world = world;
    this.minimap = minimap;
    this.hud = hud;
    this.settings = settings;
    this.mode = mode;
    this.replayActivity = replayActivity;
    this.ghost = ghost;
    this.onEnd = onEnd || (() => {});
    this.onFrame = onFrame || (() => {});
    this.onRecord = onRecord || (() => {});

    this.paused = false;
    this.finished = false;
    this._raf = null;
    this._last = 0;
    this._recorded = false;

    // mode params
    this.previewSpeed = settings.previewSpeedMs || 40;
    this.replaySpeedMul = settings.replaySpeedMul || 4;
    this.previewAtEnd = false;

    const bikeSpec = computeBikeSpec(bike);
    this.bikeSpec = bikeSpec;
    this.airDensity = route.airDensity || 1.25;
    this.temperatureC = P_STD / (R_AIR * this.airDensity) - 273.15;

    this.physics = createPhysics({
      massKg: totalMass(player, bikeSpec),
      cda: computeCdA(player, bikeSpec),
      airDensity: this.airDensity,
      drivetrainEfficiency: bikeSpec.drivetrainEfficiency
    });

    this._buildProfile();
    this._resetState();
    this.world.setHideAvatar(this.mode === 'preview');
  }

  _buildProfile() {
    this.profile = buildProfile(this.route, { reverse: this.reverse });
    this.total = this.routeTotal ?? (this.routeTotal = this.profile.totalLength);
    this.world.build(this.profile, this.route, {
      rider: this.rider, bike: this.bike, player: this.player,
      decals: this.decals, skyboxDef: this.skyboxDef
    });
    this.minimap.setProfile(this.profile, this.rider?.mapIconColor, this.settings.sessionEndMode);
  }

  _resetState() {
    this.distance = 0;
    this.speed = 0;
    this.smoothSpeed = 0;
    this.time = 0;
    this.replayTime = 0;
    this.energyJ = 0;
    this.ascent = 0;
    this.descent = 0;
    this.prevY = profileAt(this.profile, 0).y;
    this.maxPower = 0;
    this.maxSpeed = 0;
    this.sumPowerTime = 0;
    this.power3s = 0;
    this.roll30 = 0;
    this.np4Sum = 0;
    this.np4Time = 0;
    // current instantaneous values (filled per mode)
    this.curPower = 0; this.curSpeed = 0; this.curCadence = null; this.curHR = null;
    // recording
    this.samples = [{ t: 0, d: 0, p: 0, s: 0, hr: null, c: null }];
    this._recAccum = 0;
    // ghost
    this.ghostDistance = null;
    this.ghostDelta = null;
  }

  start() {
    this._last = performance.now();
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.25) dt = 0.25;
      if (!this.paused && !this.finished) this._tick(dt);
      this._render(dt);
    };
    this._raf = requestAnimationFrame(loop);
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this._last = performance.now(); }
  togglePause() { this.paused ? this.resume() : this.pause(); return this.paused; }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this.mode === 'ride') this.sensors.stopSimulator();
    this._finalizeRecording();
  }

  setCameraMode(m) { this.world.setCameraMode(m); }
  cycleCamera(d) { return this.world.cycleCamera(d); }

  // ---- preview / replay controls ----
  setPreviewSpeed(ms) { this.previewSpeed = Math.max(2, ms); }
  setReplaySpeed(mult) { this.replaySpeedMul = Math.max(0.25, mult); }
  skip(deltaMeters) {
    this.distance = Math.max(0, Math.min(this.total, this.distance + deltaMeters));
    this.previewAtEnd = this.distance >= this.total;
  }
  seekFraction(f) {
    this.distance = Math.max(0, Math.min(1, f)) * this.total;
    this.previewAtEnd = this.distance >= this.total;
    if (this.mode === 'replay') this.replayTime = timeAtDistance(this.replayActivity.samples, this.distance) ?? this.replayTime;
  }
  progressFraction() { return this.total ? Math.min(1, this.distance / this.total) : 0; }

  _tick(dt) {
    if (this.mode === 'preview') this._tickPreview(dt);
    else if (this.mode === 'replay') this._tickReplay(dt);
    else this._tickRide(dt);
    this._updateGhost();
  }

  _tickRide(dt) {
    const power = Math.max(0, this.sensors.power || 0);
    const st = profileAt(this.profile, this.distance);
    const crr = surfaceCrr(st.surfaceId);

    const res = this.physics.step(this.speed, power, st.gradient, crr, dt);
    this.speed = res.v;
    this.smoothSpeed += (this.speed - this.smoothSpeed) * Math.min(1, dt / 4);
    this.distance += this.speed * dt;
    this.time += dt;

    this.curPower = power;
    this.curSpeed = this.speed;
    this.curCadence = this.sensors.cadence;
    this.curHR = this.sensors.heartRate;

    this.energyJ += (power * dt) / HUMAN_EFFICIENCY;
    this.sumPowerTime += power * dt;
    this.maxPower = Math.max(this.maxPower, power);
    this.maxSpeed = Math.max(this.maxSpeed, this.speed);
    this.power3s += (power - this.power3s) * Math.min(1, dt / 3);
    this.roll30 += (power - this.roll30) * Math.min(1, dt / 30);
    this.np4Sum += Math.pow(this.roll30, 4) * dt;
    this.np4Time += dt;

    const dy = st.y - this.prevY;
    if (dy > 0) this.ascent += dy; else this.descent += -dy;
    this.prevY = st.y;

    // record ~1 Hz
    this._recAccum += dt;
    if (this._recAccum >= 1) {
      this._recAccum -= 1;
      this.samples.push({ t: this.time, d: this.distance, p: Math.round(power), s: this.speed, hr: this.curHR, c: this.curCadence });
    }

    this._handleTerminus();
  }

  _tickPreview(dt) {
    if (this.previewAtEnd) { this.curSpeed = 0; return; }
    this.distance += this.previewSpeed * dt;
    this.time += dt;
    this.curSpeed = this.previewSpeed;
    if (this.distance >= this.total) { this.distance = this.total; this.previewAtEnd = true; }
  }

  _tickReplay(dt) {
    const act = this.replayActivity;
    this.replayTime += dt * this.replaySpeedMul;
    if (this.replayTime >= act.durationS) {
      this.replayTime = act.durationS;
      this.finished = true;
      this.stop();
      this.onEnd({ ...this.summary(), replay: true });
      return;
    }
    const smp = sampleAtTime(act.samples, this.replayTime);
    this.distance = smp.d;
    this.time = this.replayTime;
    this.curPower = smp.p || 0;
    this.curSpeed = smp.s || 0;
    this.speed = this.curSpeed;
    this.curCadence = smp.c;
    this.curHR = smp.hr;
    this.maxPower = Math.max(this.maxPower, this.curPower);
    this.maxSpeed = Math.max(this.maxSpeed, this.curSpeed);
  }

  _updateGhost() {
    if (!this.ghost || this.mode === 'preview') { this.ghostDistance = null; this.ghostDelta = null; return; }
    const clock = this.mode === 'replay' ? this.replayTime : this.time;
    this.ghostDistance = distanceAtTime(this.ghost.samples, clock);
    const gt = timeAtDistance(this.ghost.samples, this.distance);
    this.ghostDelta = gt == null ? null : clock - gt; // +ve => player is behind PB
  }

  _handleTerminus() {
    const mode = this.settings.sessionEndMode;
    if (this.distance < this.total) return;
    if (mode === 'teleport') {
      this.distance -= this.total;
    } else if (mode === 'turnaround') {
      this.reverse = !this.reverse;
      this._buildProfile();
      this.distance = 0;
      this.prevY = profileAt(this.profile, 0).y;
    } else {
      this.finished = true;
      this.distance = this.total;
      this.stop();
      this.onEnd(this.summary());
    }
  }

  _finalizeRecording() {
    if (this.mode !== 'ride' || this._recorded || this.distance < 30) return;
    this._recorded = true;
    this.samples.push({ t: this.time, d: this.distance, p: Math.round(this.curPower), s: this.speed, hr: this.curHR, c: this.curCadence });
    const activity = createActivity({
      route: this.route, reverse: this.startReverse,
      samples: this.samples, summary: this.summary(), total: this.routeTotal
    });
    this.onRecord(activity);
  }

  _telemetry() {
    const st = profileAt(this.profile, this.distance);
    const remaining = Math.max(0, this.total - this.distance);
    const weight = this.player.weightKg;
    const isReplay = this.mode === 'replay';
    const isPreview = this.mode === 'preview';

    const avgPower = isReplay ? this.replayActivity.avgPower : (this.time > 1 ? this.sumPowerTime / this.time : 0);
    const avgSpeed = isReplay ? this.replayActivity.avgSpeed : (this.time > 1 ? this.distance / this.time : 0);
    const usableSpeed = Math.max(this.smoothSpeed, this.curSpeed, 0.1);

    return {
      mode: this.mode,
      power: isPreview ? null : Math.round(this.curPower || 0),
      power3s: this.power3s,
      avgPower,
      normPower: this.np4Time > 1 ? Math.pow(this.np4Sum / this.np4Time, 0.25) : 0,
      maxPower: this.maxPower,
      wkg: isPreview ? null : (this.curPower || 0) / weight,
      speed: this.curSpeed,
      avgSpeed,
      maxSpeed: this.maxSpeed,
      cadence: isPreview ? null : this.curCadence,
      heartRate: isPreview ? null : this.curHR,
      distance: this.distance,
      distanceRemaining: remaining,
      time: this.time,
      timeRemaining: usableSpeed > 0.3 ? remaining / usableSpeed : null,
      gradient: st.gradient,
      altitude: st.y,
      ascent: this.ascent,
      descent: this.descent,
      energy: isReplay ? this.replayActivity.energyJ * (this.replayTime / (this.replayActivity.durationS || 1)) : this.energyJ,
      surface: surfaceLabel(st.surfaceId),
      temperature: this.temperatureC,
      progressText: `${(this.progressFraction() * 100).toFixed(1)}%`,
      nextTurn: nextTurn(this.profile, this.distance),
      // ghost extras (consumed by the ride screen, not the HUD tiles)
      ghostActive: !!this.ghost && !isPreview,
      ghostDelta: this.ghostDelta
    };
  }

  _render(dt) {
    const telem = this._telemetry();
    this.hud.render(telem, this.settings);
    this.world.update(dt, this.distance, { speed: this.curSpeed || 0, cadence: this.curCadence || 0 });
    this.minimap.render(this.distance, this.ghostDistance);
    this.onFrame(telem);
  }

  summary() {
    return {
      routeName: this.route.name,
      distance: this.distance,
      time: this.time,
      avgPower: this.mode === 'replay' ? this.replayActivity.avgPower : (this.time > 1 ? this.sumPowerTime / this.time : 0),
      avgSpeed: this.mode === 'replay' ? this.replayActivity.avgSpeed : (this.time > 1 ? this.distance / this.time : 0),
      energy: this.mode === 'replay' ? this.replayActivity.energyJ : this.energyJ,
      ascent: this.ascent
    };
  }
}

function nextTurn(profile, distance) {
  const pts = profile.points;
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m].s < distance) lo = m + 1; else hi = m; }
  const h0 = pts[lo].heading;
  for (let j = lo + 1; j < pts.length; j++) {
    const dist = pts[j].s - distance;
    if (dist > 600) break;
    const dh = pts[j].heading - h0;
    if (Math.abs(dh) > 0.14) return `${dh > 0 ? 'Bear right' : 'Bear left'} in ${Math.round(dist)} m`;
  }
  return 'Continue straight';
}

export { totalDistance };
