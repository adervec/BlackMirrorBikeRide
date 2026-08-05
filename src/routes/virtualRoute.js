// Virtual route model + geometry.
//
// A virtual route is a list of segments, each: a surface material, a gradient
// (rise/run ratio), a length (m), a biome, and an optional `turn` (total heading
// change in degrees across the segment, so routes can bend). buildProfile()
// integrates the segments into a dense 3D centreline (for the road ribbon and
// minimap) carrying per-point gradient/surface/biome for fast in-ride lookups.

import { DEFAULT_SURFACE } from '../physics/surfaces.js';
import { DEFAULT_BIOME, BIOMES } from './biomes.js';
import { DEFAULT_SKYBOX } from './skyboxes.js';

let _id = 0;
const uid = (p) => `${p}-${Date.now().toString(36)}-${(_id++).toString(36)}`;

// Typical southern-Ontario annual mean air density (~8 °C, low elevation).
export const ONTARIO_AIR_DENSITY = 1.25; // kg/m³

export function createEmptyVirtualRoute(name = 'New Virtual Route') {
  return {
    id: uid('vroute'),
    name,
    type: 'virtual',
    skybox: DEFAULT_SKYBOX,
    airDensity: ONTARIO_AIR_DENSITY,
    segments: [defaultSegment()]
  };
}

export function defaultSegment() {
  return {
    surface: DEFAULT_SURFACE,
    gradient: 0,            // rise/run ratio (0.05 = 5%)
    length: 500,            // metres
    biome: DEFAULT_BIOME,
    turn: 0                 // total heading change over the segment, degrees
  };
}

export function totalDistance(route) {
  return route.segments.reduce((sum, s) => sum + (s.length || 0), 0);
}

// Build a dense centreline. Returns geometry + metadata used everywhere.
export function buildProfile(route, { reverse = false } = {}) {
  let segs = route.segments.map((s) => ({ ...s }));
  if (reverse) {
    segs = segs.reverse().map((s) => ({
      ...s,
      gradient: -(s.gradient || 0),
      turn: -(s.turn || 0)
    }));
  }

  const STEP = 4; // metres between samples
  const points = [];
  let s = 0, x = 0, y = 0, z = 0, heading = 0;

  const first = segs[0] || defaultSegment();
  points.push({ s: 0, x, y, z, heading, gradient: first.gradient || 0, surfaceId: first.surface, biomeId: first.biome });

  let minX = 0, maxX = 0, minZ = 0, maxZ = 0, minY = 0, maxY = 0;
  const bump = () => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };

  for (const seg of segs) {
    const len = Math.max(1, seg.length || 0);
    const grade = seg.gradient || 0;
    const nSteps = Math.max(1, Math.ceil(len / STEP));
    const ds = len / nSteps;
    const dHeading = ((seg.turn || 0) * Math.PI) / 180 / nSteps;
    for (let i = 0; i < nSteps; i++) {
      heading += dHeading;
      x += Math.cos(heading) * ds;
      z += Math.sin(heading) * ds;
      y += grade * ds;
      s += ds;
      points.push({ s, x, y, z, heading, gradient: grade, surfaceId: seg.surface, biomeId: seg.biome });
      bump();
    }
  }

  return {
    points,
    totalLength: s,
    bounds: { minX, maxX, minZ, maxZ, minY, maxY },
    skybox: route.skybox || DEFAULT_SKYBOX,
    airDensity: route.airDensity || ONTARIO_AIR_DENSITY,
    segments: segs,
    // Landmark distances are authored from the forward start; mirror for reverse.
    landmarks: (route.landmarks || [])
      .map((l) => ({ ...l, at: reverse ? s - l.at : l.at }))
      .filter((l) => Number.isFinite(l.at) && l.at >= 0 && l.at <= s)
  };
}

// Interpolate state at distance `s` along the dense profile.
export function profileAt(profile, s) {
  const pts = profile.points;
  const total = profile.totalLength;
  const clamped = Math.max(0, Math.min(total, s));
  // Linear scan is fine: points are ~total/4 entries and we advance forward,
  // but we binary-search to stay O(log n) for arbitrary queries.
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].s < clamped) lo = mid + 1;
    else hi = mid;
  }
  const i1 = lo;
  const i0 = Math.max(0, i1 - 1);
  const a = pts[i0], b = pts[i1];
  const span = b.s - a.s || 1;
  const t = (clamped - a.s) / span;
  return {
    s: clamped,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    heading: a.heading + (b.heading - a.heading) * t,
    gradient: a.gradient + (b.gradient - a.gradient) * t,
    surfaceId: b.surfaceId,
    biomeId: b.biomeId
  };
}

// Validate a route enough to ride it.
export function validateRoute(route) {
  const errs = [];
  if (!route.segments || route.segments.length === 0) errs.push('Route has no segments.');
  route.segments?.forEach((seg, i) => {
    if (!seg.length || seg.length <= 0) errs.push(`Segment ${i + 1}: length must be > 0.`);
    if (!BIOMES[seg.biome]) errs.push(`Segment ${i + 1}: unknown biome.`);
  });
  route.landmarks?.forEach((lm, i) => {
    if (typeof lm.label !== 'string' || !lm.label) errs.push(`Landmark ${i + 1}: needs a label.`);
    if (!Number.isFinite(lm.at) || lm.at < 0) errs.push(`Landmark ${i + 1}: "at" must be a distance in metres ≥ 0.`);
  });
  return errs;
}
