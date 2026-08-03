// GPX → route JSON converter + route validator (used by the `gpx-route` skill).
//
//   node scripts/gpx2route.mjs input.gpx [output.json]   convert (stdout if no output)
//   node scripts/gpx2route.mjs --check route.json        validate a (possibly enriched) route

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { JSDOM } from 'jsdom';
global.DOMParser = new JSDOM().window.DOMParser;

const { parseGpx, gpxToRoute } = await import('../src/routes/gpx.js');
const { validateRoute, totalDistance } = await import('../src/routes/virtualRoute.js');

const LANDMARK_KINDS = ['town', 'peak', 'water', 'bridge', 'church'];
const args = process.argv.slice(2);

if (args[0] === '--check') {
  const route = JSON.parse(readFileSync(args[1], 'utf8'));
  const errs = validateRoute(route);
  const total = totalDistance(route);
  for (const lm of route.landmarks || []) {
    if (typeof lm.label !== 'string' || !lm.label) errs.push(`Landmark missing label: ${JSON.stringify(lm)}`);
    if (!Number.isFinite(lm.at) || lm.at < 0 || lm.at > total) errs.push(`Landmark "${lm.label}" at=${lm.at} outside route (0–${Math.round(total)} m).`);
    if (lm.kind && !LANDMARK_KINDS.includes(lm.kind)) console.warn(`warn: landmark "${lm.label}" has unknown kind "${lm.kind}" (renders as plain sign).`);
  }
  if (errs.length) { errs.forEach((e) => console.error('error: ' + e)); process.exit(1); }
  console.log(`OK — ${route.name}: ${(total / 1000).toFixed(2)} km, ${route.segments.length} segments, ${(route.landmarks || []).length} landmarks.`);
  process.exit(0);
}

const [input, output] = args;
if (!input) { console.error('usage: node scripts/gpx2route.mjs input.gpx [output.json] | --check route.json'); process.exit(1); }

const parsed = parseGpx(readFileSync(input, 'utf8'));
const route = gpxToRoute(parsed, { name: parsed.name || basename(input).replace(/\.gpx$/i, '') });
const json = JSON.stringify(route, null, 2);
if (output) { writeFileSync(output, json); console.error(`Wrote ${output}: ${route.name}, ${(totalDistance(route) / 1000).toFixed(2)} km, ${route.segments.length} segments, elevation: ${route.hasElevation ? 'yes' : 'no'}.`); }
else console.log(json);
