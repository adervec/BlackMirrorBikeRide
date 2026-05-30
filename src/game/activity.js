// An "activity" is a recorded ride: a series of ~1 Hz samples plus summary
// stats. Activities power the History screen, route PBs, replays, and ghosts.
//
// Sample shape: { t, d, p, s, hr, c }
//   t  elapsed seconds
//   d  distance metres
//   p  power W
//   s  speed m/s
//   hr heart rate bpm (or null)
//   c  cadence rpm (or null)

let _id = 0;
const uid = () => `act-${Date.now().toString(36)}-${(_id++).toString(36)}`;

export function createActivity({ route, reverse, samples, summary, total }) {
  return {
    id: uid(),
    routeId: route.id,
    routeName: route.name,
    reverse: !!reverse,
    date: new Date().toISOString(),
    durationS: summary.time,
    distanceM: summary.distance,
    avgPower: summary.avgPower,
    avgSpeed: summary.avgSpeed,
    energyJ: summary.energy,
    ascentM: summary.ascent,
    total,                              // route length when recorded
    lapTimeS: lapTime(samples, total),  // time to first cover the full route
    samples
  };
}

// Time at which the ride first reached distance `target` (linear interp).
export function lapTime(samples, target) {
  if (!samples || samples.length < 2 || !target) return null;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].d >= target) {
      const a = samples[i - 1], b = samples[i];
      const span = b.d - a.d || 1;
      return a.t + (b.t - a.t) * ((target - a.d) / span);
    }
  }
  return null;
}

function bisectBy(samples, value, key) {
  let lo = 0, hi = samples.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (samples[m][key] < value) lo = m + 1; else hi = m; }
  return lo;
}

// Distance covered at elapsed time t (clamped, interpolated).
export function distanceAtTime(samples, t) {
  if (!samples || !samples.length) return 0;
  if (t <= samples[0].t) return samples[0].d;
  const last = samples[samples.length - 1];
  if (t >= last.t) return last.d;
  const i = bisectBy(samples, t, 't');
  const a = samples[Math.max(0, i - 1)], b = samples[i];
  const span = b.t - a.t || 1;
  return a.d + (b.d - a.d) * ((t - a.t) / span);
}

// Elapsed time at which the ride had covered distance d (for ghost time-behind).
export function timeAtDistance(samples, d) {
  if (!samples || !samples.length) return null;
  if (d <= samples[0].d) return samples[0].t;
  const last = samples[samples.length - 1];
  if (d >= last.d) return last.t;
  const i = bisectBy(samples, d, 'd');
  const a = samples[Math.max(0, i - 1)], b = samples[i];
  const span = b.d - a.d || 1;
  return a.t + (b.t - a.t) * ((d - a.d) / span);
}

// Interpolated telemetry sample at elapsed time t (for replay playback).
export function sampleAtTime(samples, t) {
  if (!samples || !samples.length) return { d: 0, p: 0, s: 0, hr: null, c: null };
  if (t <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (t >= last.t) return last;
  const i = bisectBy(samples, t, 't');
  const a = samples[Math.max(0, i - 1)], b = samples[i];
  const span = b.t - a.t || 1;
  const f = (t - a.t) / span;
  const lerp = (x, y) => (x == null || y == null ? (y ?? x) : x + (y - x) * f);
  return { d: lerp(a.d, b.d), p: lerp(a.p, b.p), s: lerp(a.s, b.s), hr: lerp(a.hr, b.hr), c: lerp(a.c, b.c) };
}

// Fastest completed activity for a route+direction (the PB).
export function pbForRoute(activities, routeId, reverse) {
  const cands = (activities || []).filter((a) => a.routeId === routeId && a.reverse === !!reverse && a.lapTimeS != null);
  if (!cands.length) return null;
  return cands.reduce((best, a) => (a.lapTimeS < best.lapTimeS ? a : best));
}
