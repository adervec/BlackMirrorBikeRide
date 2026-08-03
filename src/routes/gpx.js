// GPX → route conversion. Deterministic geometry only: distance/turn from the
// lat-lng track, gradient from <ele> (smoothed + clamped). Scenery enrichment
// (per-segment biomes, landmarks) is a separate, optional pass — see the
// `gpx-route` Claude skill.

import { haversine, bearing } from './geo.js';
import { ONTARIO_AIR_DENSITY } from './virtualRoute.js';

let _id = 0;
const uid = () => `gpx-${Date.now().toString(36)}-${(_id++).toString(36)}`;
const normDeg = (d) => ((d + 540) % 360) - 180;

const TARGET_SEG = 30;   // metres between kept trackpoints (one segment each)
const ELE_SMOOTH = 5;    // moving-average window over kept points (~150 m)
const MAX_GRADE = 0.25;  // clamp GPS-noise gradients to ±25%

// Parse GPX text into { name, points: [{lat, lng, ele|null}] }.
// Accepts track files (trkpt) and route files (rtept); multiple trk/trkseg
// concatenate in document order.
export function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Not a valid GPX file.');
  let nodes = doc.querySelectorAll('trkpt');
  if (!nodes.length) nodes = doc.querySelectorAll('rtept');
  const points = [];
  for (const n of nodes) {
    const lat = parseFloat(n.getAttribute('lat'));
    const lng = parseFloat(n.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const eleText = n.querySelector('ele')?.textContent;
    const ele = eleText != null && eleText !== '' ? parseFloat(eleText) : null;
    points.push({ lat, lng, ele: Number.isFinite(ele) ? ele : null });
  }
  if (points.length < 2) throw new Error('GPX contains fewer than 2 trackpoints.');
  const name = doc.querySelector('trk > name')?.textContent?.trim() ||
               doc.querySelector('metadata > name')?.textContent?.trim() || null;
  return { name, points };
}

// Downsample raw points to ~spacing metres apart, always keeping endpoints.
function downsample(points, spacing = TARGET_SEG) {
  const kept = [points[0]];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    acc += haversine(points[i - 1], points[i]);
    if (acc >= spacing) { kept.push(points[i]); acc = 0; }
  }
  const last = points[points.length - 1];
  if (kept[kept.length - 1] !== last && haversine(kept[kept.length - 1], last) >= 1) kept.push(last);
  return kept;
}

// Centred moving average over the kept points' elevations.
function smoothEle(pts, win = ELE_SMOOTH) {
  const half = Math.floor(win / 2);
  return pts.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(pts.length - 1, i + half); j++) { sum += pts[j].ele; n++; }
    return sum / n;
  });
}

// Convert parsed GPX into a ridable route (same segment model as virtual routes).
export function gpxToRoute(parsed, { name, surface = 'asphalt', skybox = 'clear-day', biome = 'satellite' } = {}) {
  const kept = downsample(parsed.points);
  const hasEle = kept.every((p) => p.ele != null);
  const ele = hasEle ? smoothEle(kept) : null;

  const segments = [];
  let prevBrg = null;
  for (let i = 0; i < kept.length - 1; i++) {
    const a = kept[i], b = kept[i + 1];
    const len = haversine(a, b);
    if (len < 1) continue;
    const brg = bearing(a, b);
    const turn = prevBrg === null ? 0 : normDeg(brg - prevBrg);
    prevBrg = brg;
    let gradient = 0;
    if (ele) gradient = Math.max(-MAX_GRADE, Math.min(MAX_GRADE, (ele[i + 1] - ele[i]) / len));
    segments.push({ surface, gradient, length: len, biome, turn });
  }
  if (!segments.length) throw new Error('GPX track is too short to ride.');

  return {
    id: uid(),
    name: name || parsed.name || 'GPX Route',
    type: 'real',
    skybox,
    airDensity: ONTARIO_AIR_DENSITY,
    segments,
    landmarks: [],
    hasElevation: hasEle
  };
}
