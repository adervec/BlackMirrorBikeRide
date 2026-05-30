// Real-world routes built from a Google Maps route (pasted waypoints or an
// encoded polyline). The route is reduced to the SAME segment model virtual
// routes use, so the physics, 3D world and minimap render it unchanged:
//   - length/heading/turn come from the lat-lng path
//   - gradient comes from the Elevation API when a key is available, else flat
//   - surface is a best-guess (default asphalt; overridable)
//   - biome is 'satellite' (neutral, no random props)
//
// Ground-level imagery is acquired by a CHECKPOINTED, RESUMABLE pipeline so a
// long route can survive interruption. Acquisition order matches the spec:
//   Street View  ->  (user/Places photos)  ->  3D-satellite spoof.

import { ONTARIO_AIR_DENSITY } from './virtualRoute.js';
import {
  hasKey, haversine, bearing, fetchElevations,
  streetViewStatus, streetViewImageUrl, staticSatelliteUrl
} from './googleMaps.js';

let _id = 0;
const uid = () => `rroute-${Date.now().toString(36)}-${(_id++).toString(36)}`;
const normDeg = (d) => ((d + 540) % 360) - 180;

// Best-guess surface from an optional road name / tag.
export function guessSurface(name = '') {
  const n = name.toLowerCase();
  if (/(trail|path|track|towpath)/.test(n)) return 'hardpack';
  if (/(gravel|unpaved)/.test(n)) return 'gravel';
  if (/(cobble|setts|pavé)/.test(n)) return 'cobbles';
  return 'asphalt'; // the overwhelming default for roads
}

// Build a ridable route object from a lat-lng path.
export async function buildRealRoute({ name, path, surface = 'asphalt', apiKey = '', skybox = 'clear-day' }) {
  if (!path || path.length < 2) throw new Error('A real route needs at least 2 waypoints.');

  // Optional elevation profile (batched; Google caps locations per request).
  let elevations = null;
  if (hasKey(apiKey)) {
    elevations = await fetchElevations(path.slice(0, 400), apiKey).catch(() => null);
  }

  const segments = [];
  let prevBrg = null;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const len = haversine(a, b);
    if (len < 1) continue;
    const brg = bearing(a, b);
    const turn = prevBrg === null ? 0 : normDeg(brg - prevBrg);
    prevBrg = brg;
    let grade = 0;
    if (elevations && elevations[i] != null && elevations[i + 1] != null) {
      grade = (elevations[i + 1] - elevations[i]) / len;
      grade = Math.max(-0.25, Math.min(0.25, grade));
    }
    segments.push({ surface, gradient: grade, length: len, biome: 'satellite', turn });
  }

  return {
    id: uid(),
    type: 'real',
    name: name || 'Real Route',
    skybox,
    airDensity: ONTARIO_AIR_DENSITY,
    segments,
    real: {
      path,
      surface,
      hasElevation: !!elevations,
      nodes: sampleNodes(path, 40),
      imageryComplete: false
    }
  };
}

// Sample imagery capture nodes every ~spacing metres along the path.
export function sampleNodes(path, spacing = 40) {
  const nodes = [];
  let acc = 0;
  let cumulative = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const len = haversine(a, b);
    const brg = bearing(a, b);
    let d = 0;
    while (d < len) {
      if (acc <= 0) {
        const t = len === 0 ? 0 : d / len;
        nodes.push({
          lat: a.lat + (b.lat - a.lat) * t,
          lng: a.lng + (b.lng - a.lng) * t,
          heading: brg,
          distance: cumulative + d,
          status: 'pending',
          source: null,
          url: null
        });
        acc = spacing;
      }
      const adv = Math.min(spacing, len - d);
      d += adv; acc -= adv;
    }
    cumulative += len;
  }
  return nodes;
}

// ---- Checkpointed imagery acquisition --------------------------------------
const ckKey = (routeId) => `bmbr.imagery.${routeId}`;

export function loadCheckpoint(route) {
  try {
    const raw = localStorage.getItem(ckKey(route.id));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { cursor: 0, nodes: route.real.nodes.map((n) => ({ ...n })), total: route.real.nodes.length };
}

function saveCheckpoint(route, ck) {
  try { localStorage.setItem(ckKey(route.id), JSON.stringify(ck)); } catch {}
}

// Public persist for the guided (human-in-the-loop) crawl UI.
export function persistCheckpoint(route, ck) { saveCheckpoint(route, ck); }

// Acquire ground imagery node-by-node. Safe to call repeatedly: it resumes from
// the saved cursor, so an interrupted run picks up where it left off.
export async function acquireImagery(route, { apiKey = '', onProgress = () => {}, signal } = {}) {
  const ck = loadCheckpoint(route);
  const usingKey = hasKey(apiKey);

  for (; ck.cursor < ck.nodes.length; ck.cursor++) {
    if (signal?.aborted) { saveCheckpoint(route, ck); return { ...ck, interrupted: true }; }
    const node = ck.nodes[ck.cursor];

    if (usingKey) {
      // 1) Street View
      const status = await streetViewStatus(node, apiKey);
      if (status === 'OK') {
        node.source = 'streetview';
        node.url = streetViewImageUrl(node, node.heading, apiKey);
        node.status = 'have';
      } else {
        // 2) (user-submitted Places photos would go here)
        // 3) 3D-satellite spoof fallback
        node.source = 'satellite-spoof';
        node.url = staticSatelliteUrl(node, apiKey);
        node.status = 'fallback';
      }
    } else {
      // No key at all: ride on the satellite-derived 3D world; mark as spoof.
      node.source = 'satellite-spoof';
      node.url = null;
      node.status = 'fallback';
    }

    saveCheckpoint(route, ck); // checkpoint after EVERY node -> resumable
    onProgress((ck.cursor + 1) / ck.nodes.length, node);
    // be polite to the API / let the UI breathe
    await new Promise((r) => setTimeout(r, usingKey ? 60 : 0));
  }

  route.real.imageryComplete = true;
  route.real.nodes = ck.nodes;
  saveCheckpoint(route, ck);
  return ck;
}

// Nearest captured ground image for a distance along the route (for an optional
// real-world ground panel during the ride).
export function groundImageAt(route, distance) {
  const nodes = route.real?.nodes;
  if (!nodes?.length) return null;
  let best = nodes[0], bestD = Infinity;
  for (const n of nodes) {
    const d = Math.abs(n.distance - distance);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best?.url || null;
}
