// Timed climbs, detected from a route's segments in ride direction. A climb is
// a run of segments at >= 2% (short easings allowed) long and steep enough to
// earn a category. Categories use the familiar length × gradient score:
// Cat 4 from 8 000 up to HC at 80 000.

const MIN_GRADE = 0.02;
const EASING_MAX_M = 200;   // a flatter stretch this short doesn't end the climb
const CATS = [[80000, 'HC'], [64000, '1'], [32000, '2'], [16000, '3'], [8000, '4']];

export function climbCategory(score) {
  return (CATS.find(([min]) => score >= min) || [])[1] || null;
}

// segments: [{ length, gradient }] in the direction being ridden.
// Returns [{ start, end, length, ascent, avgGrade, score, cat, label }].
export function detectClimbs(segments) {
  const out = [];
  let s = 0, run = null, easing = 0;
  const close = () => {
    if (!run) return;
    // trim a trailing easing: the climb ends where the steep part did
    const len = run.end - run.start;
    const avg = run.ascent / len;
    const score = len * avg * 100;
    const cat = climbCategory(score);
    if (cat && len >= 300) out.push({ ...run, length: len, avgGrade: avg, score, cat, label: `Cat ${cat} · ${(len / 1000).toFixed(1)} km @ ${(avg * 100).toFixed(1)}%` });
    run = null; easing = 0;
  };
  for (const seg of segments) {
    const len = Math.max(0, seg.length || 0), g = seg.gradient || 0;
    if (g >= MIN_GRADE) {
      if (!run) run = { start: s, end: s, ascent: 0 };
      run.end = s + len; run.ascent += g * len; easing = 0;
    } else if (run && g > -0.01 && easing + len <= EASING_MAX_M) {
      easing += len; // tolerated; `end` stays at the last steep segment
      if (g > 0) run.ascent += g * len; // gentle rise still counts if the climb continues
    } else close();
    s += len;
  }
  close();
  return out;
}
