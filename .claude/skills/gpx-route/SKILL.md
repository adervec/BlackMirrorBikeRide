---
name: gpx-route
description: Convert a GPX ride file into an enriched bundled route for Black Mirror Bike Ride — real-world biomes, landmarks, name, skybox — registered in public/routes/. Use whenever the user shares a GPX file or asks to add/enrich a real-world route.
---

# GPX → enriched bundled route

Turn a GPX file into a 3D recreation of the real-world ride. Geometry is
deterministic (a script does it); your job is the scenery: figure out where the
ride actually goes and dress the route accordingly.

## Steps

1. **Convert the geometry** (never hand-compute it):

   ```
   node scripts/gpx2route.mjs <input.gpx> public/routes/<slug>.json
   ```

   `<slug>` = short kebab-case name of the ride (e.g. `niagara-lakeshore`).
   The script emits the route JSON: segments of `{surface, gradient, length,
   biome, turn}` at ~30 m resolution, gradients smoothed and clamped.

2. **Identify the real-world ride.** Use the GPX's lat/lon extent, track name,
   and anything the user tells you to work out where it is and what it passes:
   towns, forests, water, bridges, climbs, urban stretches. Web search if
   available; otherwise reason from the coordinates.

3. **Enrich the JSON** (edit the file from step 1):
   - `id`: `"bundled-<slug>"` — stable and unique. If meaningfully regenerating
     an existing route, bump the slug (devices skip ids they already have).
   - `name`: human title of the ride.
   - `skybox`: pick from the ids in `src/routes/skyboxes.js` (e.g. `clear-day`,
     `golden-hour`, `overcast`).
   - `segments[].biome`: assign **contiguous runs** matching the real terrain.
     Live list in `src/routes/biomes.js` — read it, don't trust this summary.
     Roughly:
     - farm & crop: `farmland`, `prairie`, `cornfield`, `orchard`, `vineyard`,
       `lavender`, `sunflower`, `olivegrove`, `terraces`
     - wooded: `forest`, `redwood`, `autumnforest`, `snowforest`, `sakura`,
       `jungle`, `bamboo`, `karst`
     - built-up: `urban`, `suburban`, `oldtown`, `industrial`, `harbour`,
       `quarry`, `airfield`, `windfarm`, `servers`
     - water: `lakeside`, `coastal`, `fjord`, `swamp`, `mangrove`
     - open/arid: `mojave`, `canyon`, `badlands`, `dunes`, `saltflat`, `oasis`,
       `savanna`, `moorland`
     - cold/high: `alpine`, `tundra`, `glacier`
     - other: `volcanic`, `geothermal`, `ruins`, `temple`
     - surreal (only if the user wants it): `neongrid`, `graveyard`, `void`,
       `flesh`, `mushroom`, `clockwork`, `staticfield`, `mirrorfield`,
       `bonefield`, `origami`, `chessboard`
     - `satellite` is the neutral, prop-free fallback.

     Pick the closest real match — a Dutch polder is `farmland`, a Cornish
     clifftop is `coastal`, a Utah canyon is `canyon` or `badlands`, a Norwegian
     shore road is `fjord`. Seasonal ones (`autumnforest`, `snowforest`,
     `sakura`) are fair game when the ride's date or the user says so. Don't
     alternate biome every segment; change it where the landscape changes.
   - `segments[].surface`: ids from `src/physics/surfaces.js` where you know
     better than the default (e.g. `gravel` for a rail trail, `cobbles`).
   - `landmarks`: `[{ "at": <metres from start>, "label": "...", "kind": ... }]`
     — kinds: `town`, `peak`, `water`, `bridge`, `church` (omit kind for a plain
     sign). Compute `at` from cumulative segment lengths; roughly one landmark
     per 1–3 km; never beyond the route's total length.

4. **Validate — must print OK:**

   ```
   node scripts/gpx2route.mjs --check public/routes/<slug>.json
   ```

5. **Register**: add `"<slug>.json"` to the `routes` array in
   `public/routes/index.json`.

6. **Sync**: commit both files. Pushing to `main` deploys via GitHub Pages CI;
   every device merges new bundled routes on next app load. (Routes the user
   deleted stay deleted — ids are remembered in `dismissedRouteIds`.)

Worked example: `public/routes/demo-countryside.json`.
