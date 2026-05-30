# Black Mirror Bike Ride

A homebrew alternative to Zwift — an indoor cycling simulator that reads your real
power (and heart rate) over Bluetooth, runs a proper physics model, and rides you
through low-poly 3D worlds you build yourself, or real-world routes imported from
Google Maps.

Built as a web app so it can read sensors with **zero drivers** and run anywhere
Chrome/Edge does. Wraps cleanly into Electron/Tauri later for a desktop build.

## Stack & why

| Requirement | Choice |
|---|---|
| Read a Schwinn 130 / any trainer + HR strap | **Web Bluetooth API** (Cycling Power `0x1818`, FTMS `0x1826`, Heart Rate `0x180D`, CSC `0x1816`) |
| GameCube/PS1-tier 3D | **Three.js**, rendered slightly under-res for a retro look |
| Real routes | **Google Maps** Elevation + Street View Static + Static Maps (satellite) |
| Build tooling | **Vite**, vanilla ES modules (no framework — keeps the render loop tight) |

## Run it

```bash
npm install
npm run dev      # opens http://localhost:5173 in your browser
```

> Use **Chrome or Edge** for real sensors — Web Bluetooth isn't in Firefox/Safari.
> `localhost` counts as a secure context, so pairing works in dev with no HTTPS setup.

**No trainer handy?** Every ride auto-starts a **sensor simulator**. Pedal with the
**▲ / ▼** keys (target watts), or switch it to auto mode. Click *Connect Trainer* /
*Connect HR* any time to use real hardware.

## In-ride controls

- **▲ / ▼** — adjust simulated watts
- **C** — cycle camera; **1–5** — pick a camera directly
- **Space** — pause/resume · **Esc** — exit to route list
- Cameras: Chase · Oncoming (rear view of the bike) · Left Pan · Right Pan · Cockpit

## Preview, replay, history & ghosts

- **Preview** a route (button on the route list): scrub/fast-forward through it with **no
  avatar** — speed slider, ±200 m skip, and a scrub bar.
- Every ride is **recorded to history** (~1 Hz samples). The **History & PBs** screen lists
  past rides, flags the **personal best** per route+direction, and lets you **replay** any
  activity at an adjustable speed multiplier.
- Turn on the **player ghost** (Settings → Ghost & Playback, on by default): your all-time
  PB rides alongside you as a **ghost icon on the overhead map only**, with a live
  **time-behind / time-ahead** readout. Never a second rider in the 3D world.

## Tests

```bash
node scripts/selftest.mjs    # physics, units, route geometry, real-route + activity/PB math
node scripts/sessiontest.mjs # Session ride-recording / preview / replay / ghost (headless)
node scripts/smoke.mjs       # renders every non-WebGL screen under jsdom
npm run build                # production build / import-resolution check
```

## Architecture

```
src/
  state.js                 persistent app state (localStorage)
  sensors/                 ble.js (Web Bluetooth) · simulator.js · sensorManager.js
  physics/                 engine.js (power→motion) · surfaces.js (Crr per material)
  profile/                 rider.js (biometrics→aero) · garage.js (bike build) · customize.js
  routes/                  virtualRoute.js · realRoute.js · biomes.js · skyboxes.js · googleMaps.js
  world/                   scene.js · avatar.js · artifacts.js · cameras.js · minimap.js
  game/                    session.js (game loop) · hud.js · hudConfig.js · units.js
  ui/                      router + one module per screen
```

### Physics model

Standard cycling force balance, integrated with inertia:

```
Fp = P·η / v         (propulsion, capped near standstill)
Fg = m·g·sinθ        (gravity / grade)
Fr = Crr·m·g·cosθ    (rolling resistance, per surface material)
Fa = ½·ρ·CdA·v²      (aero — ρ is a per-route constant; no wind/drafting)
a  = (Fp − Fg − Fr − Fa) / m_eff
```

- **Body dimensions matter**: frontal area is estimated from height & mass (Heil model),
  combined with the bike's frame Cd and riding position to get CdA.
- **Bike build matters**: frame/wheels/tyres/position resolve to mass, Crr, Cd, drivetrain loss.
- **Air resistance** is a constant per route, defaulting to a southern-Ontario average
  (ρ ≈ 1.25 kg/m³), exactly as the spec requests.

### Real routes

A pasted Google Maps route (waypoints or an encoded polyline) is reduced to the *same*
segment model virtual routes use, so physics/world/minimap render it unchanged:

- length & turns from the lat-lng path; gradient from the Elevation API (if a key is set)
- surface is **best-guessed** (default asphalt; overridable)
- **Ground imagery acquisition is checkpointed & resumable**: it walks the route node by
  node, saving progress after each one, so an interrupted capture continues where it left
  off. Acquisition falls back **Street View → (user photos) → 3D-satellite spoof**, per spec.
- With no API key the route still rides fully on the satellite-derived 3D world.

## Spec coverage

✅ BLE power (Cycling Power/FTMS) + optional heart rate · ✅ biometric profile affecting
performance · ✅ bike garage · ✅ avatar + bike customization · ✅ 3D low-poly world +
top-down map icon · ✅ virtual routes (material/incline/length segments) · ✅ skyboxes
(normal → existentially bizarre) · ✅ biomes with roadside artifacts (Mojave starter) ·
✅ matching simplified overhead map · ✅ real routes from Google Maps with material guess,
satellite + Street View, checkpointed resumable capture, graded fallbacks · ✅ full stats
HUD · ✅ show/hide/reorder stats · ✅ units (metric/imperial/per-measurement/per-reading +
deeply obscure: furlongs/fortnight, smoots, donkeypower…) · ✅ current surface display ·
✅ next-turn info · ✅ rear/left/right/chase/cockpit cameras · ✅ constant Ontario air
resistance, no wind/drafting · ✅ reverse any route · ✅ session end modes
(complete / teleport to start / turn around at terminus) · ✅ **route preview** (scrub/
fast-forward, no avatar) · ✅ **replay past activities** (adjustable fast-forward) ·
✅ **history + PBs per route/direction** · ✅ **player ghost** of the all-time PB with
time-behind, ghost icon on the overhead map only · ✅ **in-ride Street View ground panel**
for real routes (nearest captured frame, updates as you move).

### Players, riders, garage & customization
- **Players vs riders are separate**: a *player* is the real human (weight/height → physics);
  *riders* are avatars (have many, each with its own look and visual body, optionally **snapped**
  to a player's proportions). Physics always uses the player; riders/clothing/decals never affect speed.
- **OG-Xbox-tier graphics**: real-time shadows, PBR materials, ACES tone mapping, full-res.
- **Detailed avatar face** (Fallout-3 energy): face shape, eyes/iris, brows, nose, mouth, facial
  hair, hair — all customizable.
- **Vehicles**: bicycle / trike / quad / unicycle / tandem; a **parts shop** spanning real →
  Mad Max → sci-fi that snaps together with cheerful Ork logic. Wheels now roll correctly with
  visible tread + a marker knob.
- **Clothing** (helmets, hats, jerseys, gilets, gloves, shorts, socks, shoes) with one-click
  **outfits**; **decals** usable as vehicle sprays and/or tattoos (wholesome permanent defaults).
- **Garage 3D preview**: drag-to-rotate, in-game-animated view of the active rider on the active bike.
- **Menu themes**: Midnight, Arcade, CRT Terminal, Pastel, Vaporwave, Graphite, Wasteland.

### Routes & skyboxes
- **Import / export** routes as `.json`, **clone** routes, per-route **activity counts**, and
  **edit-locking** once a route has activities (clone to edit) — protects PBs/replays.
- The **upcoming end behaviour** (finish 🏁 / teleport ⊚ / U-turn ⟲) is marked on the overhead map.
- **Custom skyboxes**: create/edit (colours, sun, special FX), import/export, built-ins preserved.

### Real routes — human-in-the-loop Google Maps capture
- **Open Google Maps in a popup**, build your route, paste the URL back (browser cross-origin
  security prevents a page from clicking inside another site's tab — so the human stays in the loop;
  the parser extracts the waypoints).
- A **guided Street View crawl** steps node-by-node through an embedded Street View (keyless
  `svembed`, or the Embed API with a key), confirming each — **checkpointed after every node**, so
  it resumes cleanly if interrupted. Auto-acquisition (Static API) remains available with a key.

### Known next steps
- Street View frames show in the in-ride ground panel; rendering them as full in-world
  billboards/projected geometry is still possible future work (the 3D satellite world is
  the immersive ground for real routes).
- Jersey *pattern* is modeled in data but the avatar currently uses solid colours.
