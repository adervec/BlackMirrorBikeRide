// Biome + artifact integrity. Run: node scripts/biometest.mjs
//
// buildArtifacts skips an unknown artifact type silently (`if (!build) continue`),
// so a typo in a biome's artifact list costs you every prop of that type with no
// error anywhere — you just ride through an emptier world. Same for a builder
// that throws: it takes the whole scene build down. Both are checked here.
import { BIOMES, DEFAULT_BIOME, biomeList } from '../src/routes/biomes.js';
import { SURFACES } from '../src/physics/surfaces.js';
import { ARTIFACT_TYPES, buildArtifact, buildArtifacts } from '../src/world/artifacts.js';
import { buildProfile } from '../src/routes/virtualRoute.js';

let fails = 0;
const assert = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

const ids = Object.keys(BIOMES);
console.log(`${ids.length} biomes, ${ARTIFACT_TYPES.length} artifact types\n`);

// ---- biome data shape ----
let shapeOk = true, colourOk = true, surfaceOk = true, densityOk = true;
for (const [id, b] of Object.entries(BIOMES)) {
  if (!b.label || !Array.isArray(b.artifacts) || typeof b.fogDensity !== 'number') { shapeOk = false; console.log(`   ${id}: bad shape`); }
  for (const k of ['ground', 'groundLow', 'fog']) {
    if (typeof b[k] !== 'number') { colourOk = false; console.log(`   ${id}.${k} is not a colour`); }
  }
  if (!SURFACES[b.defaultSurface]) { surfaceOk = false; console.log(`   ${id}.defaultSurface "${b.defaultSurface}" is not a real surface`); }
  for (const a of b.artifacts) {
    if (!(a.density > 0 && a.density <= 10)) { densityOk = false; console.log(`   ${id}: ${a.type} density ${a.density} out of range`); }
  }
}
assert(shapeOk, 'every biome has label, artifacts[] and fogDensity');
assert(colourOk, 'every biome has numeric ground/groundLow/fog colours');
assert(surfaceOk, 'every biome defaultSurface exists in SURFACES');
assert(densityOk, 'every artifact density is in a sane range');

// ---- the silent failure: an artifact type with no builder ----
const missing = [];
for (const [id, b] of Object.entries(BIOMES)) {
  for (const a of b.artifacts) if (!ARTIFACT_TYPES.includes(a.type)) missing.push(`${id}:${a.type}`);
}
assert(missing.length === 0, `every biome artifact type has a builder${missing.length ? ' — missing ' + missing.join(', ') : ''}`);

// ---- every builder actually runs and returns something renderable ----
const broken = [];
for (const t of ARTIFACT_TYPES) {
  try {
    const o = buildArtifact(t);
    if (!o || !o.isObject3D) broken.push(`${t} (returned ${o ? typeof o : 'nothing'})`);
  } catch (e) { broken.push(`${t} threw: ${e.message}`); }
}
assert(broken.length === 0, `all ${ARTIFACT_TYPES.length} builders produce an Object3D${broken.length ? ' — ' + broken.join('; ') : ''}`);

// ---- unused builders are dead code (landmark props are separate) ----
const used = new Set(Object.values(BIOMES).flatMap((b) => b.artifacts.map((a) => a.type)));
const orphans = ARTIFACT_TYPES.filter((t) => !used.has(t));
assert(orphans.length === 0, `no builder is unreferenced by any biome${orphans.length ? ' — orphans: ' + orphans.join(', ') : ''}`);

// ---- diversity: the point of having many biomes ----
assert(ids.length >= 20, `at least 20 biomes (${ids.length})`);
assert(ARTIFACT_TYPES.length >= 45, `at least 45 artifact types (${ARTIFACT_TYPES.length})`);
const scenic = ids.filter((id) => BIOMES[id].artifacts.length > 0);
assert(scenic.every((id) => BIOMES[id].artifacts.length >= 3),
  'every scenic biome scatters at least 3 different props');
assert(BIOMES[DEFAULT_BIOME], 'DEFAULT_BIOME exists');
assert(biomeList().length === ids.length && biomeList().every((b) => b.id && b.label),
  'biomeList() exposes every biome with an id + label (route editor dropdowns)');

// ---- end to end: each biome actually scatters props into a scene ----
const barren = [];
for (const id of scenic) {
  const route = { segments: [{ surface: BIOMES[id].defaultSurface, gradient: 0, length: 1200, biome: id, turn: 0 }] };
  const group = buildArtifacts(buildProfile(route));
  if (group.children.length === 0) barren.push(id);
}
assert(barren.length === 0, `every scenic biome scatters props over 1.2 km${barren.length ? ' — barren: ' + barren.join(', ') : ''}`);

console.log(`\n${fails === 0 ? '✅ ALL BIOME CHECKS PASSED' : '❌ ' + fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
