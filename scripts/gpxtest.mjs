// GPX parser / converter checks. Run: node scripts/gpxtest.mjs
import { JSDOM } from 'jsdom';
global.DOMParser = new JSDOM().window.DOMParser;

const { parseGpx, gpxToRoute } = await import('../src/routes/gpx.js');
const { buildProfile, totalDistance } = await import('../src/routes/virtualRoute.js');
const { haversine } = await import('../src/routes/geo.js');

let fails = 0;
const assert = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };
const approx = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg} (got ${a.toFixed ? a.toFixed(2) : a}, want ~${b}±${tol})`);

// ~2 km straight line north along a meridian, point every ~50 m, jittered elevation.
const pts = [];
for (let i = 0; i <= 40; i++) {
  const ele = 100 + i * 0.5 + (i % 3 - 1) * 4; // gentle climb + ±4 m GPS noise
  pts.push(`<trkpt lat="${(43.65 + i * 0.00045).toFixed(6)}" lon="-79.38"><ele>${ele}</ele></trkpt>`);
}
const GPX = `<?xml version="1.0"?><gpx><trk><name>Test Climb</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`;

const parsed = parseGpx(GPX);
assert(parsed.name === 'Test Climb', 'name extracted from trk > name');
assert(parsed.points.length === 41, 'all trackpoints parsed');

const route = gpxToRoute(parsed);
assert(route.type === 'real' && route.segments.length >= 2, 'route builds segments');
const rawLen = parsed.points.slice(1).reduce((s, p, i) => s + haversine(parsed.points[i], p), 0);
approx(totalDistance(route), rawLen, rawLen * 0.02, 'route length matches haversine sum');
assert(route.segments.every((s) => Math.abs(s.gradient) <= 0.25), 'gradients clamped despite ele jitter');
assert(route.hasElevation, 'elevation detected');
const avgGrade = route.segments.reduce((s, x) => s + x.gradient * x.length, 0) / totalDistance(route);
approx(avgGrade, 20 / rawLen, 0.005, 'net climb survives smoothing (~1% avg grade)');

// Missing <ele> on one point -> flat route.
const flatGpx = GPX.replace(/<ele>[^<]*<\/ele>/, ''); // strip the first point's ele
const flat = gpxToRoute(parseGpx(flatGpx));
assert(!flat.hasElevation && flat.segments.every((s) => s.gradient === 0), 'missing ele -> flat route');

// Route files (rtept) parse too.
const RTE = `<gpx><rte><rtept lat="43.65" lon="-79.38"/><rtept lat="43.66" lon="-79.38"/><rtept lat="43.67" lon="-79.37"/></rte></gpx>`;
assert(parseGpx(RTE).points.length === 3, 'rtept fallback parses route files');

// Garbage rejected.
let threw = false;
try { parseGpx('not xml at all <<<'); } catch { threw = true; }
assert(threw, 'invalid GPX throws');

// Profile integrates cleanly, forward and reverse.
const prof = buildProfile(route);
assert(Number.isFinite(prof.totalLength) && prof.totalLength > 1000, 'profile builds with finite length');
const rev = buildProfile(route, { reverse: true });
approx(rev.totalLength, prof.totalLength, 1, 'reverse profile same length');

// Landmarks: distances mirror on reverse, out-of-range ones dropped.
route.landmarks = [{ at: 500, label: 'Halfway Barn', kind: 'town' }, { at: 99999, label: 'Beyond' }];
const fwd = buildProfile(route);
assert(fwd.landmarks.length === 1 && fwd.landmarks[0].at === 500, 'in-range landmark kept, out-of-range dropped');
const revLm = buildProfile(route, { reverse: true }).landmarks[0];
approx(revLm.at, prof.totalLength - 500, 1, 'reverse mirrors landmark distance');

console.log(`\n${fails === 0 ? '✅ ALL GPX CHECKS PASSED' : '❌ ' + fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
