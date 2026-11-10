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
//
// A ride can also carry a structured WORKOUT: the step target becomes an ERG
// target for the trainer (and the simulator), zones are tallied from FTP, and
// categorised climbs on the route are timed against the ghost.

import { buildProfile, profileAt, totalDistance } from '../routes/virtualRoute.js';
import { detectClimbs } from '../routes/climbs.js';
import { surfaceCrr, surfaceLabel } from '../physics/surfaces.js';
import { createPhysics, computeCdA, totalMass } from '../physics/engine.js';
import { computeBikeSpec } from '../profile/garage.js';
import { createActivity, distanceAtTime, timeAtDistance, sampleAtTime } from './activity.js';
import { stepAt, targetWatts, zoneOf, ZONES, estimateFtp } from './workouts.js';
import { formatTime } from './units.js';

const R_AIR = 287.05;
const P_STD = 101325;
const HUMAN_EFFICIENCY = 0.24;
const AUTOSAVE_S = 5;
const CONTROL_S = 1;      // trainer control-point writes, at most this often
const IDLE_PAUSE_S = 3;   // real sensor silent this long at a standstill -> auto-pause

export class Session {
  constructor(opts) {
    const {
      route, reverse, player, bike, rider, decals = [], skyboxDef = null,
      sensors, world, minimap, hud, settings,
      mode = 'ride', replayActivity = null, ghost = null,
      workout = null, ftp = null,
      onEnd, onFrame, onRecord, onCue, onAutosave
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
    this.workout = mode === 'ride' ? workout : null;
    this.ftp = ftp || player?.ftpW || 200;
    this.intensity = 1;
    this.onEnd = onEnd || (() => {});
    this.onFrame = onFrame || (() => {});
    this.onRecord = onRecord || (() => {});
    this.onCue = onCue || (() => {});
    this.onAutosave = onAutosave || null;

    this.paused = false;
    this.autoPaused = false;
    this.finished = false;
    this._raf = null;
    this._last = 0;
    this._recorded = false;
    this._idleFor = 0;

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
    this.climbs = detectClimbs(this.profile.segments);
    this.climb = null; this.climbDelta = null;
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
    this._saveAccum = 0;
    // ghost
    this.ghostDistance = null;
    this.ghostDelta = null;
    // workout / ERG
    this.workoutTime = 0;
    this.workoutDone = false;
    this.stepInfo = null;
    this.targetW = null;
    this._stepIdx = -1;
    this._ctlAccum = CONTROL_S;
    // zones
    this.zoneTime = ZONES.map(() => 0);
    this.zone = 1;
    this._zoneCueAt = -10;
    // climbs
    this.climb = null; this.climbStartT = 0; this.climbDelta = null; this.lastClimb = null;
  }

  start() {
    this._last = performance.now();
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.25) dt = 0.25;
      if (this.mode === 'ride') this._autoPause(dt);
      if (!this.paused && !this.finished) this._tick(dt);
      this._render(dt);
    };
    this._raf = requestAnimationFrame(loop);
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this._last = performance.now(); }
  togglePause() { this.autoPaused = false; this.paused ? this.resume() : this.pause(); return this.paused; }

  // Stop pedalling on a real trainer and the clock stops with you; pedal and it
  // resumes. Never for the simulator (its power starts at zero on purpose).
  _autoPause(dt) {
    if (!this.settings.autoPause || this.sensors.simulatorActive || !this.sensors.powerSource) return;
    const p = this.sensors.power || 0;
    if (this.autoPaused) {
      if (p > 10) { this.autoPaused = false; this.resume(); this.onCue('resume'); }
      return;
    }
    if (this.paused) return; // a manual pause is the rider's business
    if (p < 5 && this.speed < 0.5) {
      this._idleFor += dt;
      if (this._idleFor > IDLE_PAUSE_S) { this.autoPaused = true; this.pause(); this.onCue('autoPause'); }
    } else this._idleFor = 0;
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this.mode === 'ride') {
      this.sensors.stopSimulator();
      this.sensors.setSimulation?.(0, 0.004); // leave the trainer on a flat road, not holding 300 W
    }
    this._finalizeRecording();
    if (this.mode === 'ride') this.onAutosave?.(null);
  }

  setCameraMode(m) { this.world.setCameraMode(m); }
  cycleCamera(d) { return this.world.cycleCamera(d); }

  // ---- workout controls ----
  adjustIntensity(d) { this.intensity = Math.round(Math.max(0.5, Math.min(1.5, this.intensity + d)) * 100) / 100; return this.intensity; }
  skipStep() {
    if (!this.stepInfo) return;
    this.workoutTime = this.stepInfo.start + this.stepInfo.step.dur;
    this._ctlAccum = CONTROL_S; // push the new target at once
  }

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

    this._updateWorkout(dt);
    this._updateZone(dt);
    this._updateClimb();

    // trainer control: ERG target when a workout asks for one, else the road
    this._ctlAccum += dt;
    if (this._ctlAccum >= CONTROL_S) {
      this._ctlAccum = 0;
      if (this.targetW != null) this.sensors.setTargetPower?.(this.targetW);
      else this.sensors.setSimulation?.(st.gradient * 100 * (this.settings.trainerDifficulty ?? 1), crr);
    }

    // record ~1 Hz
    this._recAccum += dt;
    if (this._recAccum >= 1) {
      this._recAccum -= 1;
      this.samples.push({ t: this.time, d: this.distance, p: Math.round(power), s: this.speed, hr: this.curHR, c: this.curCadence });
    }
    // crash insurance
    if (this.onAutosave) {
      this._saveAccum += dt;
      if (this._saveAccum >= AUTOSAVE_S && this.distance >= 30) { this._saveAccum = 0; this.onAutosave(this._snapshot()); }
    }

    this._handleTerminus();
  }

  _updateWorkout(dt) {
    if (!this.workout || this.workoutDone) return;
    this.workoutTime += dt;
    const at = stepAt(this.workout, this.workoutTime);
    if (!at) {
      this.workoutDone = true; this.stepInfo = null; this.targetW = null;
      this._ctlAccum = CONTROL_S;
      this.onCue('workoutDone');
      return;
    }
    this.stepInfo = at;
    this.targetW = targetWatts(at, this.ftp, this.intensity);
    if (at.idx !== this._stepIdx) {
      if (this._stepIdx >= 0) this.onCue('step', at);
      this._stepIdx = at.idx;
      this._ctlAccum = CONTROL_S;
    }
  }

  // Zones from 3 s power so a single noisy sample doesn't flicker the tile;
  // a cue fires on a change, with a short hold-off at boundaries.
  _updateZone(dt) {
    const z = zoneOf(this.power3s, this.ftp);
    this.zoneTime[z - 1] += dt;
    if (z !== this.zone && this.time - this._zoneCueAt > 3) {
      this.onCue(z > this.zone ? 'zoneUp' : 'zoneDown', z);
      this._zoneCueAt = this.time;
      this.zone = z;
    }
  }

  _pbClimbTime(c) {
    if (!this.ghost) return null;
    const a = timeAtDistance(this.ghost.samples, c.start), b = timeAtDistance(this.ghost.samples, c.end);
    return a == null || b == null || b <= a ? null : b - a;
  }

  _updateClimb() {
    const d = this.distance;
    if (this.climb) {
      const c = this.climb;
      if (d >= c.end || d < c.start) {
        const finished = d >= c.end;
        this.lastClimb = { climb: c, time: this.time - this.climbStartT, pb: this._pbClimbTime(c), finished };
        if (finished) this.onCue('climbEnd', this.lastClimb);
        this.climb = null; this.climbDelta = null;
      } else if (this.ghost) {
        const g0 = timeAtDistance(this.ghost.samples, c.start), g1 = timeAtDistance(this.ghost.samples, d);
        this.climbDelta = g0 == null || g1 == null ? null : (this.time - this.climbStartT) - (g1 - g0);
      }
    }
    if (!this.climb) {
      // only pick a climb up near its foot — not when teleporting into the middle of one
      const c = this.climbs.find((x) => d >= x.start && d < x.end && d - x.start < 60);
      if (c) { this.climb = c; this.climbStartT = this.time; this.climbDelta = null; this.onCue('climbStart', c); }
    }
  }

  _snapshot() {
    return {
      routeId: this.route.id, routeName: this.route.name, reverse: this.startReverse,
      samples: this.samples, summary: this.summary(), total: this.routeTotal, savedAt: Date.now()
    };
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
      samples: this.samples, summary: this.summary(), total: this.routeTotal,
      source: this.sensors.powerSource || null, workoutName: this.workout?.name || null
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
    const si = this.stepInfo;

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
      // workout / zones
      targetPower: this.targetW,
      workoutStep: si ? `${si.idx + 1}/${this.workout.steps.length} · ${formatTime(si.remaining)} left` : (this.workoutDone ? 'Complete' : null),
      zone: isPreview ? null : `Z${this.zone} ${ZONES[this.zone - 1].name}`,
      zoneNum: isPreview ? null : this.zone,
      // extras consumed by the ride screen, not the HUD tiles
      ghostActive: !!this.ghost && !isPreview,
      ghostDelta: this.ghostDelta,
      stepInfo: si,
      workoutTime: this.workoutTime,
      workoutDone: this.workoutDone,
      intensity: this.intensity,
      climb: this.climb,
      climbElapsed: this.climb ? this.time - this.climbStartT : null,
      climbDelta: this.climbDelta,
      autoPaused: this.autoPaused,
      paused: this.paused
    };
  }

  _render(dt) {
    const telem = this._telemetry();
    this.hud.render(telem, this.settings);
    this.world.update(dt, this.distance, { speed: this.curSpeed || 0, cadence: this.curCadence || 0 });
    this.minimap.render(this.distance, this.ghostDistance);
    this.onFrame(telem, dt);
  }

  summary() {
    const isReplay = this.mode === 'replay';
    // ponytail: the FTP estimate assumes the workout clock stayed in step with
    // the ride clock, i.e. no blocks were skipped before the test window.
    const shift = this.workoutTime - this.time;
    const shifted = shift > 0.5 ? this.samples.map((x) => ({ ...x, t: x.t + shift })) : this.samples;
    return {
      routeName: this.route.name,
      distance: this.distance,
      time: this.time,
      avgPower: isReplay ? this.replayActivity.avgPower : (this.time > 1 ? this.sumPowerTime / this.time : 0),
      avgSpeed: isReplay ? this.replayActivity.avgSpeed : (this.time > 1 ? this.distance / this.time : 0),
      energy: isReplay ? this.replayActivity.energyJ : this.energyJ,
      ascent: this.ascent,
      zoneTime: this.zoneTime,
      ftp: this.ftp,
      workoutName: this.workout?.name || null,
      ftpEstimate: this.workout ? estimateFtp(this.workout, shifted) : null
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
