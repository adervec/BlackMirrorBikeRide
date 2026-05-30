// Headless sanity checks for the non-DOM simulation core. Run: node scripts/selftest.mjs
import { buildProfile, profileAt, createEmptyVirtualRoute } from '../src/routes/virtualRoute.js';
import { sampleRoutes } from '../src/routes/sampleRoutes.js';
import { createPhysics, computeCdA, totalMass } from '../src/physics/engine.js';
import { computeBikeSpec, defaultBike } from '../src/profile/garage.js';
import { defaultProfile } from '../src/profile/rider.js';
import { surfaceCrr } from '../src/physics/surfaces.js';
import { format, formatString, toUnit, applyPreset, DEFAULT_UNIT_PREFS } from '../src/game/units.js';
import { buildRealRoute, sampleNodes } from '../src/routes/realRoute.js';
import { lapTime, distanceAtTime, timeAtDistance, sampleAtTime, pbForRoute } from '../src/game/activity.js';

let fails = 0;
const approx = (a, b, tol, msg) => {
  const ok = Math.abs(a - b) <= tol;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}  (got ${a.toFixed ? a.toFixed(3) : a}, want ~${b}±${tol})`);
  if (!ok) fails++;
};
const assert = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

// ---- route profile ----
const route = sampleRoutes()[0];
const prof = buildProfile(route);
const declaredLen = route.segments.reduce((s, x) => s + x.length, 0);
approx(prof.totalLength, declaredLen, 5, 'profile length matches declared segment sum');
const mid = profileAt(prof, prof.totalLength / 2);
assert(Number.isFinite(mid.x) && Number.isFinite(mid.y), 'profileAt returns finite position');

// ---- physics: equilibrium speed ----
const profile = defaultProfile();
const bike = defaultBike();
const spec = computeBikeSpec(bike);
const cda = computeCdA(profile, spec);
const mass = totalMass(profile, spec);
approx(cda, 0.29, 0.12, 'CdA in a realistic road range');
approx(mass, 75 + spec.massKg, 0.01, 'total mass = rider + bike');

const phys = createPhysics({ massKg: mass, cda, airDensity: 1.25, drivetrainEfficiency: 0.975 });
let v = 0;
for (let i = 0; i < 6000; i++) v = phys.step(v, 200, 0.0, surfaceCrr('asphalt'), 1 / 30).v; // ~200s @200W flat
approx(v * 3.6, 36, 8, '200 W on flat asphalt settles near ~32-40 km/h');

// climbing slows you down
let vc = v;
for (let i = 0; i < 6000; i++) vc = phys.step(vc, 200, 0.08, surfaceCrr('asphalt'), 1 / 30).v; // 8% climb
assert(vc < v && vc > 0, '8% climb is much slower than flat but still moving');
console.log(`     climb speed @200W on 8% = ${(vc * 3.6).toFixed(1)} km/h`);

// zero power coasts to a stop on flat (rolling decel ~0.047 m/s² -> ~210 s from 10 m/s)
let vz = 10;
for (let i = 0; i < 9000; i++) vz = phys.step(vz, 0, 0.0, surfaceCrr('asphalt'), 1 / 30).v; // 300 s
approx(vz, 0, 0.3, 'zero power coasts to a full stop on the flat');

// ---- units ----
approx(toUnit('speed', 10, 'kmh'), 36, 0.01, '10 m/s == 36 km/h');
approx(toUnit('speed', 10, 'mph'), 22.369, 0.01, '10 m/s == 22.37 mph');
approx(toUnit('mass', 75, 'lb'), 165.35, 0.1, '75 kg == 165.35 lb');
assert(format('gradient', 0.08, DEFAULT_UNIT_PREFS).value === '8.0', 'gradient 0.08 -> 8.0%');
const bizarre = applyPreset({ ...DEFAULT_UNIT_PREFS }, 'bizarre');
assert(formatString('speed', 10, bizarre).includes('fur/ftn'), 'bizarre preset shows furlongs/fortnight');

// ---- real route ----
const realPath = [
  { lat: 43.6532, lng: -79.3832 },
  { lat: 43.6601, lng: -79.3790 },
  { lat: 43.6650, lng: -79.3700 }
];
const real = await buildRealRoute({ name: 'Test', path: realPath, surface: 'asphalt', apiKey: '' });
assert(real.type === 'real' && real.segments.length >= 2, 'real route builds segments from waypoints');
assert(sampleNodes(realPath, 40).length > 0, 'imagery nodes sampled along real path');
const rprof = buildProfile(real);
assert(Number.isFinite(rprof.totalLength) && rprof.totalLength > 500, 'real route has a sensible total length');
console.log(`     real route length = ${(rprof.totalLength / 1000).toFixed(2)} km, ${real.real.nodes.length} imagery nodes`);

// ---- activities / ghost / PB math ----
const samples = [
  { t: 0, d: 0, p: 0, s: 0 },
  { t: 10, d: 100, p: 200, s: 10 },
  { t: 20, d: 300, p: 240, s: 20 },
  { t: 30, d: 600, p: 260, s: 30 }
];
approx(lapTime(samples, 300), 20, 0.01, 'lapTime: reaches 300 m at t=20 s');
approx(distanceAtTime(samples, 15), 200, 0.01, 'distanceAtTime: t=15 s -> 200 m (interp)');
approx(timeAtDistance(samples, 200), 15, 0.01, 'timeAtDistance: 200 m -> t=15 s (interp)');
approx(sampleAtTime(samples, 15).p, 220, 0.01, 'sampleAtTime: power interpolated at t=15');

// ghost time-behind: player at 200 m at t=18 s vs ghost above -> behind by 3 s
const clock = 18, playerDist = 200;
const behind = clock - timeAtDistance(samples, playerDist);
approx(behind, 3, 0.01, 'ghost delta: +3 s behind at 200 m / t=18');

const activities = [
  { id: 'a', routeId: 'r1', reverse: false, lapTimeS: 320 },
  { id: 'b', routeId: 'r1', reverse: false, lapTimeS: 295 },
  { id: 'c', routeId: 'r1', reverse: true, lapTimeS: 250 },
  { id: 'd', routeId: 'r2', reverse: false, lapTimeS: 100 }
];
assert(pbForRoute(activities, 'r1', false).id === 'b', 'PB picks fastest lap for route+direction');
assert(pbForRoute(activities, 'r1', true).id === 'c', 'PB respects direction (reverse)');
assert(pbForRoute(activities, 'rX', false) === null, 'PB null when no completed rides');

console.log(`\n${fails === 0 ? '✅ ALL CHECKS PASSED' : '❌ ' + fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
