// Thin helpers around Google Maps web APIs. Everything here degrades gracefully:
// with no API key the geometry math (haversine/bearing/polyline) still works,
// and image/elevation helpers simply return null so callers fall back.

export function hasKey(key) { return typeof key === 'string' && key.trim().length > 10; }

// --- geometry (no API needed) ------------------------------------------------
const R_EARTH = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
            Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// Decode an encoded polyline (Google's algorithm) into [{lat,lng}].
export function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0;
  const coords = [];
  const factor = Math.pow(10, precision);
  while (index < str.length) {
    let result = 1, shift = 0, b;
    do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 1; shift = 0;
    do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push({ lat: lat / factor, lng: lng / factor });
  }
  return coords;
}

// Pull waypoints out of a pasted Google Maps URL. Prefers the per-stop
// !3d<lat>!4d<lng> pairs in the data= blob; falls back to bare lat,lng in the
// /dir/ path. (A web page can't read the popup's URL cross-origin, so the user
// pastes it — this parses whatever they paste.)
export function parseGoogleMapsUrl(url) {
  const pts = [];
  let m;
  const re3d = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g;
  while ((m = re3d.exec(url))) pts.push({ lat: +m[1], lng: +m[2] });
  if (pts.length >= 2) return pts;
  const path = url.split('/dir/')[1] || url;
  const re = /(-?\d{1,3}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/g;
  const found = [];
  while ((m = re.exec(path))) found.push({ lat: +m[1], lng: +m[2] });
  return found;
}

export function mapsDirectionsUrl() { return 'https://www.google.com/maps/dir/'; }

// An embeddable Street View at a point/heading. With a key it uses the official
// Embed API; without one it uses the classic keyless `output=svembed` page,
// which is iframe-able for a human-in-the-loop "crawl & confirm" capture.
export function streetViewEmbedUrl(pt, headingDeg = 0, key = '') {
  if (hasKey(key)) {
    return `https://www.google.com/maps/embed/v1/streetview?key=${key}` +
      `&location=${pt.lat},${pt.lng}&heading=${Math.round(headingDeg)}&pitch=0&fov=90`;
  }
  return `https://maps.google.com/maps?q=&layer=c&cbll=${pt.lat},${pt.lng}` +
    `&cbp=11,${Math.round(headingDeg)},0,0,0&output=svembed`;
}

// Parse "lat,lng" lines into waypoints. Tolerant of whitespace/blank lines.
export function parseWaypointText(text) {
  return text.split(/[\n;]+/).map((line) => {
    const m = line.trim().match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
  }).filter(Boolean);
}

// --- image / data URLs (need a key) ------------------------------------------
export function streetViewMetaUrl(pt, key) {
  return `https://maps.googleapis.com/maps/api/streetview/metadata?location=${pt.lat},${pt.lng}&key=${key}`;
}

export function streetViewImageUrl(pt, headingDeg, key, { size = '640x400', fov = 90, pitch = 0 } = {}) {
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${pt.lat},${pt.lng}` +
         `&heading=${Math.round(headingDeg)}&fov=${fov}&pitch=${pitch}&key=${key}`;
}

export function staticSatelliteUrl(pt, key, { zoom = 18, size = '512x512' } = {}) {
  return `https://maps.googleapis.com/maps/api/staticmap?center=${pt.lat},${pt.lng}` +
         `&zoom=${zoom}&size=${size}&maptype=satellite&key=${key}`;
}

// Elevation for a batch of points. Returns array of metres, or null on failure.
export async function fetchElevations(points, key) {
  if (!hasKey(key) || points.length === 0) return null;
  try {
    const locs = points.map((p) => `${p.lat},${p.lng}`).join('|');
    const res = await fetch(`https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locs)}&key=${key}`);
    const json = await res.json();
    if (json.status !== 'OK') return null;
    return json.results.map((r) => r.elevation);
  } catch { return null; }
}

// Check whether Street View imagery exists at a point. 'OK' | 'ZERO_RESULTS' | null
export async function streetViewStatus(pt, key) {
  if (!hasKey(key)) return null;
  try {
    const res = await fetch(streetViewMetaUrl(pt, key));
    const json = await res.json();
    return json.status;
  } catch { return null; }
}
