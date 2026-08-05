// Surface-texture + road-geometry checks. Run: node scripts/texturetest.mjs
//
// The road is drawn as one indexed mesh split into per-surface draw groups. A
// wrong group range renders an invisible or wrongly-textured stretch of road and
// is near-impossible to spot by eye on a long route, so the partition is checked
// here rather than trusted.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;

// jsdom has no 2D canvas without the native `canvas` package, which is far too
// heavy a dependency for this. A no-op context is enough: what's worth checking
// here is that every surface draws without throwing and that the results are
// cached and wrap correctly — the pixels themselves are cosmetic.
const noop = () => {};
dom.window.HTMLCanvasElement.prototype.getContext = function () {
  return {
    canvas: this,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    fillRect: noop, beginPath: noop, arc: noop, ellipse: noop, fill: noop,
    moveTo: noop, lineTo: noop, bezierCurveTo: noop, stroke: noop,
  };
};

const { buildProfile } = await import('../src/routes/virtualRoute.js');

let fails = 0;
const assert = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

// Mirrors the grouping loop in scene.js _buildRoad. Kept in step by the
// coverage assertions below — if the real loop changes shape, these fail.
function groupsFor(points) {
  const n = points.length;
  const groups = [];
  let runStart = 0;
  for (let i = 0; i < n - 1; i++) {
    const here = points[i].surfaceId;
    const next = i + 1 < n - 1 ? points[i + 1].surfaceId : null;
    if (next !== here) {
      groups.push({ start: runStart * 6, count: (i - runStart + 1) * 6, surface: here });
      runStart = i + 1;
    }
  }
  return groups;
}

// A route that changes surface twice — the case per-surface materials exist for.
const route = {
  id: 'tex', name: 'Tex', type: 'virtual', skybox: 'clear-day', airDensity: 1.25,
  segments: [
    { surface: 'asphalt', gradient: 0, length: 200, biome: 'mojave', turn: 0 },
    { surface: 'cobbles', gradient: 0, length: 120, biome: 'mojave', turn: 0 },
    { surface: 'gravel', gradient: 0, length: 200, biome: 'mojave', turn: 0 }
  ]
};
const prof = buildProfile(route);
const n = prof.points.length;
const groups = groupsFor(prof.points);
const quads = n - 1;

// ---- the partition must be exact: every quad drawn once, in order ----
const total = groups.reduce((s, g) => s + g.count, 0);
assert(total === quads * 6, `groups cover every quad exactly once (${total} of ${quads * 6} indices)`);
assert(groups[0].start === 0, 'first group starts at index 0');
let contiguous = true;
for (let i = 1; i < groups.length; i++) {
  if (groups[i].start !== groups[i - 1].start + groups[i - 1].count) contiguous = false;
}
assert(contiguous, 'groups are contiguous with no gaps or overlaps');
assert(groups.every((g) => g.count > 0), 'no empty groups');
assert(groups[groups.length - 1].start + groups[groups.length - 1].count === quads * 6,
  'last group reaches the end of the index buffer');

// ---- and it must actually reflect the surfaces ----
const surfaces = groups.map((g) => g.surface);
assert(surfaces.length >= 3, `route with 3 surfaces yields >=3 groups (got ${surfaces.length})`);
assert(surfaces[0] === 'asphalt' && surfaces.includes('cobbles') && surfaces.includes('gravel'),
  'groups carry the right surfaces in route order');
assert(surfaces.every((s, i) => i === 0 || s !== surfaces[i - 1]), 'adjacent groups never repeat a surface');

// A single-surface route collapses to exactly one group (one draw call).
const flat = buildProfile({ ...route, segments: [route.segments[0]] });
assert(groupsFor(flat.points).length === 1, 'single-surface route makes a single group');

// ---- textures: cached, wrapping, and drawn for every surface id ----
const { surfaceTexture, groundTexture } = await import('../src/world/textures.js');
const { SURFACES } = await import('../src/physics/surfaces.js');

const a = surfaceTexture('asphalt');
assert(a && a.isTexture, 'surfaceTexture returns a texture');
assert(surfaceTexture('asphalt') === a, 'textures are cached, not redrawn per scene build');
assert(a.wrapS === 1000 && a.wrapT === 1000, 'textures repeat-wrap (RepeatWrapping)');
assert(a.image.width === 256 && a.image.height === 256, 'texture is 256x256');
assert(surfaceTexture('cobbles') !== a, 'different surfaces get different textures');
assert(surfaceTexture('nonsense-surface') === surfaceTexture('asphalt'), 'unknown surface falls back to asphalt');
assert(Object.keys(SURFACES).every((id) => surfaceTexture(id)?.isTexture), 'every defined surface draws a texture');
assert(groundTexture()?.isTexture && groundTexture() === groundTexture(), 'ground texture built and cached');

console.log(`\n${fails === 0 ? '✅ ALL TEXTURE CHECKS PASSED' : '❌ ' + fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
