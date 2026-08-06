// tools/make-routes.mjs — generate the bundled route library.
//   node tools/make-routes.mjs
//
// The routes in public/routes/ are authored here as a compact spec table rather
// than hand-written JSON: a 40 km route is ~130 segments, which is miserable to
// edit by hand and impossible to re-tune. Change a spec, re-run, commit.
//
// Generation is deterministic — the PRNG is seeded from each route's slug — so
// re-running without editing a spec produces byte-identical files and no diff
// churn. Every route is validated with the app's own validateRoute before it is
// written, and the index is rewritten to match whatever is on disk.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRoute, totalDistance, ONTARIO_AIR_DENSITY } from '../src/routes/virtualRoute.js';
import { BIOMES } from '../src/routes/biomes.js';
import { SURFACES } from '../src/physics/surfaces.js';
import { SKYBOXES } from '../src/routes/skyboxes.js';

const OUT = join(fileURLToPath(new URL('..', import.meta.url)), 'public', 'routes');
const HAND_WRITTEN = ['demo-countryside.json']; // the skill's worked example — not generated

// Deterministic PRNG (mulberry32) seeded from a string.
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gradient profile as a function of progress t (0..1). Values are rise/run.
const SHAPES = {
  flat: () => 0,
  false_flat: (t) => 0.005 + Math.sin(t * Math.PI * 4) * 0.004,
  rolling: (t) => Math.sin(t * Math.PI * 6) * 0.035 + Math.sin(t * Math.PI * 13) * 0.015,
  hilly: (t) => Math.sin(t * Math.PI * 8) * 0.06 + Math.sin(t * Math.PI * 3) * 0.02,
  // One sustained climb over the first ~60%, then the descent home.
  climb: (t) => (t < 0.62 ? 0.045 + Math.sin(t * Math.PI * 5) * 0.02 : -0.07 + Math.sin(t * Math.PI * 7) * 0.015),
  mountain: (t) => (t < 0.7 ? 0.07 + Math.sin(t * Math.PI * 9) * 0.03 : -0.09),
  wall: (t) => (t < 0.75 ? 0.10 + Math.sin(t * Math.PI * 11) * 0.035 : -0.11),
  descent: (t) => (t < 0.12 ? 0.02 : -0.05 + Math.sin(t * Math.PI * 6) * 0.012),
  valley: (t) => (t < 0.5 ? -0.045 : 0.045),
  // Repeated efforts: steep up / recover down, four times over the route.
  sawtooth: (t) => (Math.sin(t * Math.PI * 8) > 0 ? 0.065 : -0.05),
  repeats: (t) => (Math.sin(t * Math.PI * 8) > 0 ? 0.085 : -0.075),
};

// name, km, sky, shape, curve (deg of turn per km, 0 = arrow straight),
// loop (close the circle), biomes (contiguous runs, evenly split),
// surface (one, or one per biome run), landmarks [[fraction, label, kind]]
const SPECS = [
  // ---- training ----
  { slug: 'warmup-spin', name: 'Warm-Up Spin', km: 6, sky: 'clear-day', shape: 'flat', curve: 30, loop: true,
    biomes: ['farmland', 'orchard'], surface: 'smooth-asphalt',
    landmarks: [[0.5, 'Halfway Barn', 'town']] },
  { slug: 'recovery-lakeshore', name: 'Recovery Lakeshore', km: 12, sky: 'golden-hour', shape: 'flat', curve: 55, loop: true,
    biomes: ['lakeside', 'coastal', 'lakeside'], surface: 'smooth-asphalt',
    landmarks: [[0.28, 'Boathouse Point', 'water'], [0.74, 'Heron Bridge', 'bridge']] },
  { slug: 'sweetspot-rollers', name: 'Sweet Spot Rollers', km: 24, sky: 'overcast', shape: 'rolling', curve: 60, loop: true,
    biomes: ['farmland', 'forest', 'prairie', 'farmland'], surface: 'asphalt',
    landmarks: [[0.22, 'Mill Crossing', 'bridge'], [0.61, 'Elmswood', 'town']] },
  { slug: 'vo2-sawtooth', name: 'VO2 Sawtooth', km: 14, sky: 'clear-day', shape: 'sawtooth', curve: 40, loop: true,
    biomes: ['prairie', 'windfarm'], surface: 'asphalt',
    landmarks: [[0.5, 'Turbine Row', 'peak']] },
  { slug: 'hill-repeats', name: 'Hill Repeats', km: 10, sky: 'overcast', shape: 'repeats', curve: 95,
    biomes: ['moorland', 'alpine'], surface: 'asphalt',
    landmarks: [[0.25, 'The Wall', 'peak'], [0.75, 'Cairn Top', 'peak']] },
  { slug: 'endurance-century', name: 'The Long Haul', km: 82, sky: 'clear-day', shape: 'rolling', curve: 50, loop: true,
    biomes: ['farmland', 'forest', 'lakeside', 'suburban', 'orchard', 'prairie', 'farmland'], surface: 'asphalt',
    landmarks: [[0.14, 'Ashford', 'town'], [0.33, 'Long Water', 'water'], [0.52, 'St. Brendan\'s', 'church'],
                [0.71, 'Iron Bridge', 'bridge'], [0.88, 'Beacon Hill', 'peak']] },

  // ---- climbs ----
  { slug: 'alpine-hairpins', name: 'Alpine Hairpins', km: 18, sky: 'clear-day', shape: 'climb', curve: 190,
    biomes: ['forest', 'alpine', 'tundra', 'glacier'], surface: ['asphalt', 'asphalt', 'smooth-asphalt', 'concrete'],
    landmarks: [[0.2, 'Tree Line', 'peak'], [0.55, 'Refuge du Col', 'town'], [0.82, 'Glacier Rim', 'peak']] },
  { slug: 'volcano-ascent', name: 'Volcano Ascent', km: 15, sky: 'golden-hour', shape: 'mountain', curve: 130,
    biomes: ['jungle', 'geothermal', 'volcanic'], surface: ['asphalt', 'gravel', 'chipseal'],
    landmarks: [[0.4, 'Steam Terraces', 'water'], [0.85, 'Caldera Rim', 'peak']] },
  { slug: 'fjord-wall', name: 'The Fjord Wall', km: 9, sky: 'overcast', shape: 'wall', curve: 210,
    biomes: ['fjord', 'tundra'], surface: 'asphalt',
    landmarks: [[0.3, 'Seven Falls', 'water'], [0.8, 'Eagle Bend', 'peak']] },
  { slug: 'karst-switchbacks', name: 'Karst Switchbacks', km: 13, sky: 'overcast', shape: 'climb', curve: 175,
    biomes: ['terraces', 'karst', 'bamboo'], surface: ['hardpack', 'asphalt', 'asphalt'],
    landmarks: [[0.35, 'Paddy Steps', 'water'], [0.7, 'Tower Gap', 'peak']] },
  { slug: 'canyon-descent', name: 'Canyon Descent', km: 20, sky: 'golden-hour', shape: 'descent', curve: 120,
    biomes: ['badlands', 'canyon', 'mojave'], surface: ['gravel', 'asphalt', 'asphalt'],
    landmarks: [[0.24, 'Hoodoo Gate', 'peak'], [0.66, 'Dry Wash Bridge', 'bridge']] },

  // ---- surface & classics ----
  { slug: 'cobbled-classic', name: 'The Cobbled Classic', km: 28, sky: 'overcast', shape: 'hilly', curve: 85, loop: true,
    biomes: ['farmland', 'oldtown', 'farmland', 'oldtown'], surface: ['asphalt', 'cobbles', 'asphalt', 'cobbles'],
    landmarks: [[0.3, 'Market Square', 'town'], [0.55, 'The Kapelmuur', 'peak'], [0.82, 'Old Chapel', 'church']] },
  { slug: 'gravel-grinder', name: 'Gravel Grinder', km: 34, sky: 'overcast', shape: 'hilly', curve: 100, loop: true,
    biomes: ['moorland', 'badlands', 'quarry', 'moorland'], surface: ['gravel', 'gravel', 'hardpack', 'gravel'],
    landmarks: [[0.26, 'Peat Cutting', 'water'], [0.58, 'The Quarry', 'peak']] },
  { slug: 'velodrome-pursuit', name: 'Velodrome Pursuit', km: 4, sky: 'clear-day', shape: 'flat', curve: 340, loop: true,
    biomes: ['urban'], surface: 'wood-boards',
    landmarks: [[0.5, 'Back Straight', 'town']] },
  { slug: 'desert-time-trial', name: 'Desert Time Trial', km: 26, sky: 'clear-day', shape: 'false_flat', curve: 8,
    biomes: ['saltflat', 'dunes'], surface: ['concrete', 'asphalt'],
    landmarks: [[0.45, 'Salt Marker', 'peak'], [0.9, 'Dune Gate', 'peak']] },
  { slug: 'harbour-industrial', name: 'Harbour & Ironworks', km: 17, sky: 'overcast', shape: 'flat', curve: 130, loop: true,
    biomes: ['harbour', 'industrial', 'urban'], surface: ['concrete', 'concrete', 'smooth-asphalt'],
    landmarks: [[0.2, 'Dock Crane', 'peak'], [0.7, 'The Foundry', 'town']] },

  // ---- scenic ----
  { slug: 'redwood-run', name: 'Redwood Run', km: 21, sky: 'overcast', shape: 'rolling', curve: 110,
    biomes: ['forest', 'redwood', 'forest'], surface: 'asphalt',
    landmarks: [[0.35, 'Cathedral Grove', 'peak'], [0.8, 'Creek Bridge', 'bridge']] },
  { slug: 'coastal-cruise', name: 'Coastal Cruise', km: 30, sky: 'golden-hour', shape: 'rolling', curve: 140,
    biomes: ['coastal', 'fjord', 'harbour', 'coastal'], surface: 'asphalt',
    landmarks: [[0.18, 'Gull Rock', 'water'], [0.52, 'The Slipway', 'town'], [0.86, 'Lighthouse Head', 'peak']] },
  { slug: 'sakura-lane', name: 'Sakura Lane', km: 11, sky: 'clear-day', shape: 'false_flat', curve: 90, loop: true,
    biomes: ['sakura', 'temple', 'bamboo'], surface: ['smooth-asphalt', 'cobbles', 'hardpack'],
    landmarks: [[0.3, 'Torii Gate', 'church'], [0.66, 'Pagoda Hill', 'peak']] },
  { slug: 'tuscan-hills', name: 'Tuscan Hills', km: 27, sky: 'golden-hour', shape: 'hilly', curve: 120, loop: true,
    biomes: ['vineyard', 'olivegrove', 'lavender', 'vineyard'], surface: ['asphalt', 'hardpack', 'asphalt', 'gravel'],
    landmarks: [[0.24, 'Villa Bianca', 'town'], [0.58, 'Cypress Ridge', 'peak'], [0.85, 'Santa Chiara', 'church']] },
  { slug: 'savanna-crossing', name: 'Savanna Crossing', km: 44, sky: 'golden-hour', shape: 'false_flat', curve: 45,
    biomes: ['savanna', 'oasis', 'savanna', 'dunes'], surface: ['hardpack', 'hardpack', 'asphalt', 'sand'],
    landmarks: [[0.2, 'Acacia Water', 'water'], [0.5, 'The Oasis', 'town'], [0.85, 'Sand Sea', 'peak']] },
  { slug: 'swamp-passage', name: 'Swamp Passage', km: 16, sky: 'overcast', shape: 'flat', curve: 150,
    biomes: ['swamp', 'mangrove', 'terraces'], surface: ['hardpack', 'hardpack', 'gravel'],
    landmarks: [[0.3, 'Cypress Crossing', 'bridge'], [0.75, 'Paddy Village', 'town']] },
  { slug: 'autumn-loop', name: 'Autumn Loop', km: 19, sky: 'golden-hour', shape: 'rolling', curve: 105, loop: true,
    biomes: ['autumnforest', 'orchard', 'autumnforest'], surface: 'asphalt',
    landmarks: [[0.3, 'Cider Press', 'town'], [0.72, 'Copper Hill', 'peak']] },
  { slug: 'winter-pass', name: 'Winter Pass', km: 23, sky: 'overcast', shape: 'climb', curve: 145,
    biomes: ['snowforest', 'tundra', 'glacier', 'snowforest'], surface: ['hardpack', 'hardpack', 'concrete', 'asphalt'],
    landmarks: [[0.32, 'Snow Gate', 'town'], [0.68, 'Ice Field', 'water']] },
  { slug: 'ruins-of-antiquity', name: 'Ruins of Antiquity', km: 15, sky: 'clear-day', shape: 'hilly', curve: 95, loop: true,
    biomes: ['ruins', 'olivegrove', 'ruins'], surface: ['cobbles', 'hardpack', 'cobbles'],
    landmarks: [[0.3, 'Broken Arch', 'peak'], [0.7, 'Temple of Dust', 'church']] },
  { slug: 'airfield-circuit', name: 'Airfield Circuit', km: 8, sky: 'clear-day', shape: 'flat', curve: 180, loop: true,
    biomes: ['airfield', 'prairie'], surface: 'concrete',
    landmarks: [[0.5, 'Hangar Nine', 'town']] },
  { slug: 'sunflower-century', name: 'Sunflower & Maize', km: 38, sky: 'clear-day', shape: 'false_flat', curve: 55, loop: true,
    biomes: ['sunflower', 'cornfield', 'prairie', 'sunflower'], surface: ['asphalt', 'hardpack', 'asphalt', 'asphalt'],
    landmarks: [[0.2, 'Yellow Mile', 'peak'], [0.55, 'Maize Maze', 'town'], [0.86, 'Grain Co-op', 'town']] },
  { slug: 'cyclocross-circuit', name: 'Cyclocross Circuit', km: 5, sky: 'overcast', shape: 'hilly', curve: 300, loop: true,
    biomes: ['farmland', 'forest'], surface: ['grass', 'hardpack'],
    landmarks: [[0.5, 'The Pit', 'town']] },

  // ---- the bizarre ----
  { slug: 'the-void-run', name: 'The Void Run', km: 14, sky: 'starfield', shape: 'false_flat', curve: 70, loop: true,
    biomes: ['void', 'mirrorfield', 'void'], surface: 'smooth-asphalt',
    landmarks: [[0.33, 'First Monolith', 'peak'], [0.72, 'The Reflecting Line', 'water']] },
  { slug: 'flesh-corridor', name: 'Flesh Corridor', km: 8, sky: 'flesh-sky', shape: 'rolling', curve: 125,
    biomes: ['flesh', 'bonefield', 'mushroom'], surface: ['asphalt', 'hardpack', 'hardpack'],
    landmarks: [[0.35, 'The Ribcage', 'bridge'], [0.8, 'Spore Hollow', 'peak']] },
  { slug: 'arcade-grid', name: 'Arcade Grid', km: 12, sky: 'vaporwave', shape: 'false_flat', curve: 200, loop: true,
    biomes: ['neongrid', 'servers', 'neongrid'], surface: 'smooth-asphalt',
    landmarks: [[0.4, 'Cooling Aisle', 'town'], [0.8, 'Grid Horizon', 'peak']] },
  { slug: 'clockwork-circuit', name: 'Clockwork Circuit', km: 10, sky: 'the-eye', shape: 'hilly', curve: 160, loop: true,
    biomes: ['clockwork', 'origami', 'chessboard'], surface: ['wood-boards', 'wood-boards', 'smooth-asphalt'],
    landmarks: [[0.3, 'The Great Escapement', 'peak'], [0.75, 'Endgame Square', 'town']] },
  { slug: 'static-and-ash', name: 'Static & Ash', km: 17, sky: 'the-eye', shape: 'rolling', curve: 90,
    biomes: ['staticfield', 'graveyard', 'volcanic'], surface: ['chipseal', 'hardpack', 'chipseal'],
    landmarks: [[0.28, 'Dead Channel', 'town'], [0.62, 'The Boneyard', 'church'], [0.9, 'Ashfall', 'peak']] },
];

const SEG_M = 300; // nominal segment length

function build(spec) {
  const rand = rng(spec.slug);
  const totalM = spec.km * 1000;
  const n = Math.max(4, Math.round(totalM / SEG_M));
  const shape = SHAPES[spec.shape];
  if (!shape) throw new Error(`${spec.slug}: unknown shape "${spec.shape}"`);

  const runs = spec.biomes.length;
  const surfaces = Array.isArray(spec.surface) ? spec.surface : new Array(runs).fill(spec.surface);
  if (surfaces.length !== runs) throw new Error(`${spec.slug}: ${surfaces.length} surfaces for ${runs} biome runs`);

  // A loop should come back around, so bias the turns to sum near 360.
  const turnBias = spec.loop ? 360 / n : 0;
  const curvePerSeg = (spec.curve || 0) * (SEG_M / 1000);

  const segments = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const run = Math.min(runs - 1, Math.floor(t * runs));
    const gradient = Math.max(-0.22, Math.min(0.22, shape(t) + (rand() - 0.5) * 0.012));
    // Turn wanders, with the loop bias folded in; sign flips make it feel roadlike.
    const turn = turnBias + (rand() - 0.5) * 2 * curvePerSeg;
    segments.push({
      surface: surfaces[run],
      gradient: Math.round(gradient * 1e4) / 1e4,
      length: Math.round((SEG_M + (rand() - 0.5) * SEG_M * 0.3) * 10) / 10,
      biome: spec.biomes[run],
      turn: Math.round(turn * 10) / 10,
    });
  }

  const route = {
    id: `bundled-${spec.slug}`,
    name: spec.name,
    type: 'virtual',
    skybox: spec.sky,
    airDensity: ONTARIO_AIR_DENSITY,
    segments,
    landmarks: [],
  };
  const len = totalDistance(route);
  route.landmarks = (spec.landmarks || []).map(([frac, label, kind]) => ({
    at: Math.round(frac * len),
    label,
    ...(kind ? { kind } : {}),
  }));
  return route;
}

// ---- sanity-check the specs against the live vocabularies -------------------
let bad = 0;
for (const s of SPECS) {
  for (const b of s.biomes) if (!BIOMES[b]) { console.error(`${s.slug}: unknown biome "${b}"`); bad++; }
  for (const x of (Array.isArray(s.surface) ? s.surface : [s.surface])) {
    if (!SURFACES[x]) { console.error(`${s.slug}: unknown surface "${x}"`); bad++; }
  }
  if (!SKYBOXES[s.sky]) { console.error(`${s.slug}: unknown skybox "${s.sky}"`); bad++; }
}
if (bad) process.exit(1);

mkdirSync(OUT, { recursive: true });
const files = [...HAND_WRITTEN];
let totalKm = 0;
for (const spec of SPECS) {
  const route = build(spec);
  const errs = validateRoute(route);
  if (errs.length) { console.error(`${spec.slug}: ${errs.join('; ')}`); process.exit(1); }
  const file = `${spec.slug}.json`;
  writeFileSync(join(OUT, file), JSON.stringify(route, null, 1) + '\n');
  files.push(file);
  const km = totalDistance(route) / 1000;
  totalKm += km;
  console.log(`${file.padEnd(28)} ${km.toFixed(1).padStart(6)} km  ${String(route.segments.length).padStart(4)} seg  ${spec.biomes.join('/')}`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ routes: files }, null, 2) + '\n');
console.log(`\n${SPECS.length} routes generated, ${Math.round(totalKm)} km total (+${HAND_WRITTEN.length} hand-written)`);
