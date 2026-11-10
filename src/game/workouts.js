// Structured workouts: Zwift .zwo import, a small built-in library, the target
// lookup the ride loop uses for ERG, FTP estimators, and power zones.
//
// Step shape: { dur, lo, hi, abs?, cadence?, text? }
//   dur    seconds
//   lo/hi  power at the start/end of the step as a FRACTION of FTP (a ramp
//          lerps lo -> hi; steady state has lo === hi); null = free ride
//   abs    true when lo/hi are absolute watts instead (the ramp test)

export function parseZwo(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const wo = doc.querySelector('workout');
  if (!wo) throw new Error('Not a Zwift workout file (no <workout> element).');
  const num = (e, k, d = null) => (e.hasAttribute(k) ? parseFloat(e.getAttribute(k)) : d);
  const steps = [];
  for (const e of wo.children) {
    const text = [...e.querySelectorAll('textevent')].map((t) => t.getAttribute('message')).filter(Boolean).join(' · ') || null;
    const cadence = num(e, 'Cadence');
    switch (e.tagName) {
      case 'Warmup': case 'Cooldown': case 'Ramp':
        steps.push({ dur: num(e, 'Duration', 300), lo: num(e, 'PowerLow', 0.5), hi: num(e, 'PowerHigh', 0.75), cadence, text });
        break;
      case 'SteadyState': {
        const p = num(e, 'Power', 0.7);
        steps.push({ dur: num(e, 'Duration', 300), lo: p, hi: p, cadence, text });
        break;
      }
      case 'IntervalsT': {
        const n = num(e, 'Repeat', 1), on = num(e, 'OnDuration', 60), off = num(e, 'OffDuration', 60);
        const pOn = num(e, 'OnPower', 1), pOff = num(e, 'OffPower', 0.5), cOff = num(e, 'CadenceResting');
        for (let i = 0; i < n; i++) {
          steps.push({ dur: on, lo: pOn, hi: pOn, cadence, text: i === 0 ? text : null });
          steps.push({ dur: off, lo: pOff, hi: pOff, cadence: cOff });
        }
        break;
      }
      case 'FreeRide': case 'MaxEffort':
        steps.push({ dur: num(e, 'Duration', 300), lo: null, hi: null, cadence, text });
        break;
      default: break; // unknown elements (e.g. SolidState) are skipped
    }
  }
  if (!steps.length) throw new Error('Workout has no steps.');
  const txt = (tag) => doc.querySelector(tag)?.textContent?.trim() || '';
  return { id: `wo-${Date.now().toString(36)}`, name: txt('name') || 'Imported workout', description: txt('description'), steps };
}

// ---- built-in library -------------------------------------------------------
const ramp = (dur, lo, hi) => ({ dur, lo, hi });
const steady = (dur, p, text = null) => ({ dur, lo: p, hi: p, text });
const repeat = (n, ...steps) => Array.from({ length: n }, () => steps.map((s) => ({ ...s }))).flat();

export const BUILTIN_WORKOUTS = [
  {
    id: 'ramp-test', name: 'Ramp Test (FTP)', test: 'ramp', builtin: true,
    description: '1-minute steps from 100 W, +20 W each. Ride until you can\'t hold the step, then Finish. FTP = 75% of your best minute.',
    steps: Array.from({ length: 25 }, (_, i) => ({ dur: 60, lo: 100 + i * 20, hi: 100 + i * 20, abs: true }))
  },
  {
    id: 'ftp-20', name: '20-min FTP Test', test: '20min', builtin: true,
    description: 'Classic protocol: warm-up with openers, then 20 minutes as hard as you can hold. FTP = 95% of the test average.',
    steps: [ramp(600, 0.5, 0.75), ...repeat(3, steady(60, 1.1), steady(60, 0.5)), steady(300, 0.6), { dur: 1200, lo: null, hi: null, text: 'TEST — 20 minutes, all you have' }, ramp(600, 0.5, 0.4)]
  },
  { id: 'sweet-spot-3x12', name: 'Sweet Spot 3×12', builtin: true, description: 'Three 12-minute blocks at 90% with 4-minute recoveries.',
    steps: [ramp(600, 0.5, 0.75), ...repeat(3, steady(720, 0.9), steady(240, 0.55)), ramp(480, 0.6, 0.4)] },
  { id: 'vo2-5x3', name: 'VO2max 5×3', builtin: true, description: 'Five 3-minute efforts at 118% with equal recovery.',
    steps: [ramp(600, 0.5, 0.8), ...repeat(5, steady(180, 1.18), steady(180, 0.5)), ramp(480, 0.6, 0.4)] },
  { id: 'over-unders-3x9', name: 'Over-Unders 3×9', builtin: true, description: 'Three 9-minute blocks alternating 2 min at 95% and 1 min at 105%.',
    steps: [ramp(600, 0.5, 0.8), ...repeat(3, ...repeat(3, steady(120, 0.95), steady(60, 1.05)), steady(240, 0.55)), ramp(480, 0.6, 0.4)] },
  { id: 'endurance-60', name: 'Endurance 60', builtin: true, description: 'An hour at a steady 68%.',
    steps: [ramp(300, 0.5, 0.65), steady(3000, 0.68), ramp(300, 0.6, 0.45)] },
  { id: 'recovery-30', name: 'Recovery Spin 30', builtin: true, description: 'Thirty easy minutes at 50%.',
    steps: [steady(1800, 0.5)] }
];

export const totalDuration = (w) => w.steps.reduce((t, s) => t + s.dur, 0);

// Average intensity (of FTP) across the non-free steps, for the library table.
export function avgIntensity(w) {
  let sum = 0, dur = 0;
  for (const s of w.steps) { if (s.lo == null || s.abs) continue; sum += ((s.lo + s.hi) / 2) * s.dur; dur += s.dur; }
  return dur ? sum / dur : 0;
}

// Where in the workout elapsed time t falls. Returns null once it's over.
export function stepAt(w, t) {
  let start = 0;
  for (let i = 0; i < w.steps.length; i++) {
    const s = w.steps[i];
    if (t < start + s.dur) {
      const f = (t - start) / s.dur;
      const frac = s.lo == null ? null : s.lo + (s.hi - s.lo) * f;
      return { idx: i, step: s, start, elapsed: t - start, remaining: s.dur - (t - start), frac, next: w.steps[i + 1] || null };
    }
    start += s.dur;
  }
  return null;
}

// ERG target in watts for a step lookup (null = free ride).
export function targetWatts(at, ftp, intensity = 1) {
  if (!at || at.frac == null) return null;
  return Math.round((at.step.abs ? at.frac : at.frac * ftp) * intensity);
}

// ---- FTP estimators ---------------------------------------------------------
// Best average power over any `windowS` seconds of a ~1 Hz sample series.
// Prefix-integrates power over time so uneven sampling is handled exactly.
export function bestAvgPower(samples, windowS) {
  if (!samples || samples.length < 2) return 0;
  const E = [0];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    E.push(E[i - 1] + ((a.p || 0) + (b.p || 0)) / 2 * (b.t - a.t));
  }
  let best = 0, j = 0;
  for (let i = 0; i < samples.length; i++) {
    while (j < samples.length - 1 && samples[j].t - samples[i].t < windowS) j++;
    const span = samples[j].t - samples[i].t;
    if (span >= windowS) best = Math.max(best, (E[j] - E[i]) / span);
  }
  return best;
}

export function avgPowerBetween(samples, t0, t1) {
  let sum = 0, dur = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (b.t <= t0 || a.t >= t1) continue;
    const dt = Math.min(b.t, t1) - Math.max(a.t, t0);
    sum += ((a.p || 0) + (b.p || 0)) / 2 * dt; dur += dt;
  }
  return dur ? sum / dur : 0;
}

// FTP estimate from a completed test workout, or null if not a test.
// `samples` are the ride's samples; the workout clock equals the ride clock.
export function estimateFtp(workout, samples) {
  if (!workout?.test) return null;
  if (workout.test === 'ramp') return Math.round(bestAvgPower(samples, 60) * 0.75) || null;
  if (workout.test === '20min') {
    let start = 0;
    for (const s of workout.steps) { if (s.lo == null && s.dur >= 1200) break; start += s.dur; }
    const avg = avgPowerBetween(samples, start, start + 1200);
    return avg ? Math.round(avg * 0.95) : null;
  }
  return null;
}

// ---- power zones (Coggan) ---------------------------------------------------
export const ZONES = [
  { z: 1, name: 'Recovery',   max: 0.55, color: '#8a93a8' },
  { z: 2, name: 'Endurance',  max: 0.75, color: '#4cc2ff' },
  { z: 3, name: 'Tempo',      max: 0.90, color: '#43d17a' },
  { z: 4, name: 'Threshold',  max: 1.05, color: '#ffd24a' },
  { z: 5, name: 'VO2max',     max: 1.20, color: '#ff9b3d' },
  { z: 6, name: 'Anaerobic',  max: 1.50, color: '#ff5b5b' },
  { z: 7, name: 'Neuro',      max: Infinity, color: '#d58bff' }
];

export function zoneOf(power, ftp) {
  if (!ftp || power == null) return 1;
  const r = power / ftp;
  return ZONES.find((z) => r <= z.max).z;
}
