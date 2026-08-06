// Bundled route library checks. Run: node scripts/routestest.mjs
//
// loadBundledRoutes() swallows every fetch/parse error so a bad file can't break
// the app — which also means a malformed route just silently never appears. The
// library is checked here instead, along with whether the routes are actually
// rideable: a 30% wall or 4000 m of climbing in 10 km is valid JSON and a
// terrible ride.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { validateRoute, buildProfile, totalDistance } from '../src/routes/virtualRoute.js';
import { BIOMES } from '../src/routes/biomes.js';
import { SURFACES } from '../src/physics/surfaces.js';
import { SKYBOXES } from '../src/routes/skyboxes.js';

const dir = join(fileURLToPath(new URL('..', import.meta.url)), 'public', 'routes');
let fails = 0;
const assert = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

// ---- the index must match what's actually on disk ----
const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
const onDisk = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
const listed = [...index.routes].sort();
assert(Array.isArray(index.routes) && index.routes.length > 0, 'index.json lists routes');
assert(JSON.stringify(listed) === JSON.stringify(onDisk),
  `index matches the directory (${listed.length} listed, ${onDisk.length} on disk)`);

// ---- each route ----
const ids = new Set();
const names = new Set();
const bad = [];
const stats = [];
for (const file of index.routes) {
  let r;
  try { r = JSON.parse(readFileSync(join(dir, file), 'utf8')); }
  catch (e) { bad.push(`${file}: unparseable (${e.message})`); continue; }

  const errs = validateRoute(r);
  if (errs.length) bad.push(`${file}: ${errs.join('; ')}`);
  if (!r.id || !r.id.startsWith('bundled-')) bad.push(`${file}: id "${r.id}" should start with "bundled-"`);
  if (ids.has(r.id)) bad.push(`${file}: duplicate id ${r.id}`);
  ids.add(r.id);
  if (names.has(r.name)) bad.push(`${file}: duplicate name "${r.name}"`);
  names.add(r.name);
  if (!SKYBOXES[r.skybox]) bad.push(`${file}: unknown skybox "${r.skybox}"`);
  for (const s of r.segments) {
    if (!BIOMES[s.biome]) bad.push(`${file}: unknown biome "${s.biome}"`);
    if (!SURFACES[s.surface]) bad.push(`${file}: unknown surface "${s.surface}"`);
  }

  const len = totalDistance(r);
  const profile = buildProfile(r);
  let ascent = 0, maxGrade = 0;
  for (const s of r.segments) {
    if (s.gradient > 0) ascent += s.gradient * s.length;
    maxGrade = Math.max(maxGrade, Math.abs(s.gradient));
  }
  // Rideable-shape checks: real roads top out around 20% and even an alpine
  // pass rarely exceeds ~90 m of climbing per km averaged over a whole route.
  if (maxGrade > 0.2) bad.push(`${file}: max gradient ${(maxGrade * 100).toFixed(0)}% is beyond a real road`);
  if (ascent / (len / 1000) > 95) bad.push(`${file}: ${Math.round(ascent / (len / 1000))} m/km of climbing is not rideable`);
  if (!Number.isFinite(profile.totalLength) || profile.totalLength < 1000) bad.push(`${file}: profile length ${profile.totalLength}`);

  for (const lm of r.landmarks || []) {
    if (!lm.label) bad.push(`${file}: landmark with no label`);
    if (!(lm.at >= 0 && lm.at <= len)) bad.push(`${file}: landmark "${lm.label}" at ${lm.at} outside 0-${Math.round(len)}`);
  }
  stats.push({ file, km: len / 1000, ascent, segs: r.segments.length, biomes: new Set(r.segments.map((s) => s.biome)).size });
}
assert(bad.length === 0, `every bundled route is valid and rideable${bad.length ? '\n   ' + bad.join('\n   ') : ''}`);

// ---- the library is actually varied ----
const all = index.routes.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const usedBiomes = new Set(all.flatMap((r) => r.segments.map((s) => s.biome)));
const usedSurfaces = new Set(all.flatMap((r) => r.segments.map((s) => s.surface)));
const usedSkies = new Set(all.map((r) => r.skybox));
const kms = stats.map((s) => s.km);

assert(all.length >= 34, `at least 34 routes (${all.length})`);
// Everything except `satellite`, which is the deliberately neutral fallback for
// un-enriched GPX imports and has no business in an authored route.
assert(usedBiomes.size >= Object.keys(BIOMES).length - 1,
  `routes span every biome but the neutral one (${usedBiomes.size} of ${Object.keys(BIOMES).length})`);
assert(usedSurfaces.size === Object.keys(SURFACES).length,
  `every surface is ridden by some route (${usedSurfaces.size} of ${Object.keys(SURFACES).length})`);
assert(usedSkies.size === Object.keys(SKYBOXES).length,
  `every built-in skybox is used by some route (${usedSkies.size} of ${Object.keys(SKYBOXES).length})`);
assert(Math.min(...kms) < 10, `there is a short route (shortest ${Math.min(...kms).toFixed(1)} km)`);
assert(Math.max(...kms) > 60, `there is a long route (longest ${Math.max(...kms).toFixed(1)} km)`);
assert(stats.some((s) => s.ascent / s.km > 45), 'there is a genuinely climby route');
assert(stats.some((s) => s.ascent / s.km < 8), 'there is a genuinely flat route');

console.log(`\n${all.length} routes · ${Math.round(stats.reduce((t, s) => t + s.km, 0))} km · ` +
  `${usedBiomes.size} biomes · ${usedSurfaces.size} surfaces · ${usedSkies.size} skyboxes`);
console.log(`\n${fails === 0 ? '✅ ALL ROUTE CHECKS PASSED' : '❌ ' + fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
