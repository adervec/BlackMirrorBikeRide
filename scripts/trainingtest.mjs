// Workouts (ZWO parse, targets, FTP estimates, zones), timed climbs, TCX export,
// FTMS control-point encoding and the Session's ERG/zone/autosave wiring.
// Run: node scripts/trainingtest.mjs
import { JSDOM } from 'jsdom';
globalThis.DOMParser = new JSDOM('').window.DOMParser;

import { parseZwo, BUILTIN_WORKOUTS, stepAt, targetWatts, totalDuration, bestAvgPower, estimateFtp, zoneOf } from '../src/game/workouts.js';
import { detectClimbs } from '../src/routes/climbs.js';
import { activityToTcx } from '../src/game/tcx.js';
import { encodeTargetPower, encodeSimulation } from '../src/sensors/ble.js';
import { Session } from '../src/game/session.js';
import { sampleRoutes } from '../src/routes/sampleRoutes.js';
import { defaultPlayer } from '../src/profile/player.js';
import { defaultBike } from '../src/profile/garage.js';
import { defaultRider } from '../src/profile/customize.js';

let fails = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const approx = (a, b, tol, m) => assert(Math.abs(a - b) <= tol, `${m} (got ${a}, want ~${b}±${tol})`);

// ---- ZWO ----
const zwo = `<workout_file><name>Test WO</name><description>d</description><workout>
  <Warmup Duration="300" PowerLow="0.5" PowerHigh="0.75"/>
  <SteadyState Duration="600" Power="0.9" Cadence="90"><textevent timeoffset="0" message="Settle in"/></SteadyState>
  <IntervalsT Repeat="3" OnDuration="60" OffDuration="60" OnPower="1.2" OffPower="0.5"/>
  <FreeRide Duration="120"/>
  <Cooldown Duration="300" PowerLow="0.75" PowerHigh="0.5"/>
</workout></workout_file>`;
const w = parseZwo(zwo);
assert(w.name === 'Test WO', 'zwo name parsed');
assert(w.steps.length === 10, `zwo expands to 10 steps (got ${w.steps.length})`);
assert(totalDuration(w) === 1680, `zwo total duration 1680 s (got ${totalDuration(w)})`);
approx(stepAt(w, 0).frac, 0.5, 1e-9, 'warmup starts at PowerLow');
approx(stepAt(w, 150).frac, 0.625, 1e-9, 'warmup ramps linearly');
assert(stepAt(w, 300).idx === 1 && stepAt(w, 300).step.text === 'Settle in', 'step 2 begins at 300 s with its text cue');
assert(stepAt(w, 900 + 60).step.lo === 0.5, 'interval off-block after on-block');
assert(stepAt(w, 1260).frac === null, 'free ride has no target');
assert(stepAt(w, 1680) === null, 'past the end -> null');
assert(targetWatts(stepAt(w, 300), 200) === 180, 'target = frac × FTP');
assert(targetWatts(stepAt(w, 300), 200, 1.05) === 189, 'intensity scales the target');
let threw = false; try { parseZwo('<nope/>'); } catch { threw = true; } assert(threw, 'non-workout XML is rejected');

// ---- built-ins ----
const rampWo = BUILTIN_WORKOUTS.find((x) => x.id === 'ramp-test');
assert(targetWatts(stepAt(rampWo, 0), 999) === 100 && targetWatts(stepAt(rampWo, 61), 999) === 120, 'ramp test steps are absolute watts');
for (const b of BUILTIN_WORKOUTS) assert(b.steps.every((s) => s.dur > 0), `built-in "${b.name}" has positive durations`);

// ---- FTP estimators ----
const samples = [];
for (let t = 0; t <= 700; t++) samples.push({ t, d: t * 8, p: t >= 600 && t < 660 ? 300 : 100, s: 8, hr: null, c: null });
approx(bestAvgPower(samples, 60), 300, 2, 'best 60 s power finds the 300 W minute');
approx(estimateFtp(rampWo, samples), 225, 2, 'ramp FTP = 75% of best minute');
const twenty = BUILTIN_WORKOUTS.find((x) => x.id === 'ftp-20');
const flat = []; for (let t = 0; t <= 3400; t++) flat.push({ t, d: t * 8, p: 250, s: 8 });
assert(estimateFtp(twenty, flat) === 238, `20-min FTP = 95% of test avg (got ${estimateFtp(twenty, flat)})`);
assert(estimateFtp(BUILTIN_WORKOUTS.find((x) => x.id === 'endurance-60'), flat) === null, 'non-test workouts give no FTP estimate');

// ---- zones ----
assert(zoneOf(100, 200) === 1 && zoneOf(150, 200) === 2 && zoneOf(160, 200) === 3, 'zones 1-3 boundaries');
assert(zoneOf(200, 200) === 4 && zoneOf(250, 200) === 6 && zoneOf(400, 200) === 7, 'zones 4-7 boundaries');

// ---- climbs ----
const segs = [
  { length: 1000, gradient: 0 }, { length: 2000, gradient: 0.06 }, { length: 100, gradient: 0 },
  { length: 1500, gradient: 0.05 }, { length: 3000, gradient: -0.03 }, { length: 500, gradient: 0.03 }
];
const climbs = detectClimbs(segs);
assert(climbs.length === 1, `one categorised climb detected (got ${climbs.length})`);
assert(climbs[0]?.start === 1000 && climbs[0]?.end === 4600, `climb spans the short easing (start ${climbs[0]?.start}, end ${climbs[0]?.end})`);
assert(climbs[0]?.cat === '3', `3.6 km @ 5.4% is Cat 3 (got ${climbs[0]?.cat})`);
const rev = detectClimbs([...segs].reverse().map((s) => ({ ...s, gradient: -s.gradient })));
assert(rev.length === 1 && rev[0].cat === '4' && rev[0].start === 500, `ridden backwards the 3 km descent is a Cat 4 climb (got ${rev.length}, ${rev[0]?.cat}, start ${rev[0]?.start})`);

// ---- TCX ----
const act = { routeName: 'Test & Co', reverse: false, date: '2026-11-08T12:00:00.000Z', durationS: 2, distanceM: 20, avgPower: 150, energyJ: 1000,
  samples: [{ t: 0, d: 0, p: 100, s: 0, hr: 120, c: 80 }, { t: 1, d: 10, p: 150, s: 10, hr: 125, c: 85 }, { t: 2, d: 20, p: 200, s: 10, hr: null, c: null }] };
const tcx = activityToTcx(act);
const doc = new DOMParser().parseFromString(tcx, 'application/xml');
assert(!doc.querySelector('parsererror'), 'TCX is well-formed XML');
assert(doc.getElementsByTagName('Trackpoint').length === 3, 'TCX has one Trackpoint per sample');
assert(tcx.includes('<ns3:Watts>150</ns3:Watts>') && tcx.includes('Test &amp; Co'), 'TCX carries power and escapes the name');
assert(doc.querySelector('Id')?.textContent === '2026-11-08T11:59:58.000Z', 'TCX start = end − duration');

// ---- FTMS control point encoding ----
const tp = new Uint8Array(encodeTargetPower(250));
assert(tp[0] === 0x05 && tp[1] === 0xfa && tp[2] === 0x00, 'Set Target Power 250 W -> 05 FA 00');
const sim = new Uint8Array(encodeSimulation(5.5, 0.004, 0.51));
assert(sim[0] === 0x11 && sim[3] === 0x26 && sim[4] === 0x02 && sim[5] === 40 && sim[6] === 51, 'Simulation 5.5% / Crr .004 / Cw .51 encodes little-endian');
assert(new Uint8Array(encodeSimulation(-3))[4] === 0xfe, 'negative grade is a signed int16');

// ---- Session: ERG target, zones, autosave ----
const stubWorld = () => ({ build() {}, setHideAvatar() {}, update() {}, setCameraMode() {}, cycleCamera() {}, resize() {}, dispose() {} });
const calls = [], sims = [], cues = [], saves = [];
const sensors = { power: 200, cadence: 85, heartRate: 150, simulatorActive: false, powerSource: 'Stub', stopSimulator() {},
  setTargetPower: (w) => calls.push(w), setSimulation: (g, crr) => sims.push([g, crr]) };
const settings = { sessionEndMode: 'teleport', previewSpeedMs: 100, replaySpeedMul: 5, ghost: { enabled: false }, trainerDifficulty: 1, autoPause: true };
const sess = new Session({ route: sampleRoutes()[0], reverse: false, player: defaultPlayer(), bike: defaultBike(), rider: defaultRider(), decals: [],
  world: stubWorld(), minimap: { setProfile() {}, render() {} }, hud: { render() {} }, settings, sensors, mode: 'ride',
  workout: BUILTIN_WORKOUTS.find((x) => x.id === 'sweet-spot-3x12'), ftp: 220,
  onCue: (k) => cues.push(k), onAutosave: (s) => saves.push(s) });
for (let i = 0; i < 70; i++) sess._tick(0.1);                 // 7 s
approx(sess.targetW, 220 * (0.5 + 0.25 * 7 / 600), 1, 'warm-up target at 7 s follows the ramp from 50% FTP');
assert(calls.length >= 1 && calls[calls.length - 1] === sess.targetW, 'ERG target pushed to the trainer');
assert(sims.length === 0, 'no grade simulation while a target is held');
approx(sess.zoneTime.reduce((a, b) => a + b, 0), sess.time, 0.01, 'zone time sums to ride time');
for (let i = 0; i < 130; i++) sess._tick(0.1);                // 20 s in: past 30 m and a 5 s save tick
assert(saves.length >= 1 && saves[0].samples.length > 3 && saves[0].routeId === sess.route.id, 'autosave snapshot after 5 s');
sess.skipStep();
sess._tick(0.1);
assert(sess.stepInfo.idx === 1 && sess.targetW === 198, `skip moves to block 2 (90% = 198 W, got ${sess.targetW})`);
assert(cues.includes('step'), 'step cue fired');
sess.workout = null; sess.targetW = null;
for (let i = 0; i < 12; i++) sess._tick(0.1);
assert(sims.length >= 1 && Number.isFinite(sims[0][0]), 'without a target the road grade goes to the trainer');
// auto-pause: silent real sensor at standstill
sensors.power = 0; sess.speed = 0;
for (let i = 0; i < 40; i++) sess._autoPause(0.1);
assert(sess.autoPaused && sess.paused, 'auto-paused after 3 s of nothing');
sensors.power = 150; sess._autoPause(0.1);
assert(!sess.autoPaused && !sess.paused, 'pedalling resumes an auto-pause');
sess.stop();
assert(saves[saves.length - 1] === null, 'autosave cleared on stop');

console.log(`\n${fails === 0 ? '✅ ALL TRAINING CHECKS PASSED' : '❌ ' + fails + ' TRAINING CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
