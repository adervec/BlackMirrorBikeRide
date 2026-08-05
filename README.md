# Black Mirror Bike Ride

A homebrew alternative to Zwift — an indoor cycling simulator that reads your real
power (and heart rate) over Bluetooth, runs a proper physics model, and rides you
through low-poly 3D worlds you build yourself, or real-world routes imported from
GPX files.

Built as a web app so it can read sensors with **zero drivers** and run anywhere
Chrome/Edge does. Wraps cleanly into Electron/Tauri later for a desktop build.

> **Disclaimer** — This is a personal hobby project. I am a software developer, not a
> doctor, coach, physiologist, or fitness professional. Nothing this app displays
> (power, heart rate, calorie estimates, fitness metrics) constitutes medical advice
> or a training prescription. Consult a qualified healthcare provider before starting
> or changing an exercise programme. Stop exercising if you feel unwell. Use at your
> own risk.

## Stack & why

| Requirement | Choice |
|---|---|
| Read a Schwinn 130 / any trainer + HR strap | **Web Bluetooth API** (Cycling Power `0x1818`, FTMS `0x1826`, Heart Rate `0x180D`, CSC `0x1816`) |
| GameCube/PS1-tier 3D | **Three.js**, rendered slightly under-res for a retro look |
| Real routes | **GPX import** (native DOMParser) + optional Claude-authored scenery enrichment |
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

### Install it (PWA)

Live at **https://adervec.github.io/BlackMirrorBikeRide/** — installable from the
browser's *Install app* / *Add to Home Screen* prompt, then it runs in its own
window with no browser chrome. A service worker precaches the shell, so it opens
offline (rides, routes and history are local anyway). Icons are generated from a
single glyph by `node tools/make-icons.mjs` — no image files to hand-edit.

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
node scripts/selftest.mjs    # physics, units, route geometry, activity/PB math
node scripts/sessiontest.mjs # Session ride-recording / preview / replay / ghost (headless)
node scripts/gpxtest.mjs     # GPX parsing / downsampling / gradient clamping / landmarks
node scripts/synctest.mjs    # cloud-sync merge (union semantics) + OAuth origin gate
node scripts/texturetest.mjs # procedural surface textures + per-surface road draw groups
node scripts/pwatest.mjs     # manifest / icons / service worker installability contract
node scripts/biometest.mjs   # biome data + every artifact type has a working builder
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
  routes/                  virtualRoute.js · gpx.js · geo.js · biomes.js · skyboxes.js · bundled.js
  cloud/                   config.js (OAuth gate) · sync.js (Drive REST) · merge.js (pure merge)
  world/                   scene.js · avatar.js · artifacts.js · textures.js · cameras.js · minimap.js
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

### Real routes (GPX)

A GPX file (Strava, Komoot, RideWithGPS, Garmin…) is reduced to the *same* segment
model virtual routes use, so physics/world/minimap render it unchanged:

- length & turns from the lat-lng track; gradient from the GPX `<ele>` data,
  downsampled to ~30 m segments, smoothed over ~150 m and clamped to ±25% so GPS
  noise never produces absurd walls (no elevation data → the route rides flat)
- surface & biome default to asphalt / neutral ground, overridable at import

### Cloud sync (Google Drive)

Optional, opt-in, and identical in shape to the sibling apps (Tachyread, GuitarPicker,
GymTracker…): **Settings → Cloud Sync → Connect Google Drive**. Rides, PBs, routes,
riders, bikes, decals and custom skyboxes sync through a single JSON file in your own
Drive **`appDataFolder`** — a hidden, app-private space. Data goes browser → your Drive
and touches no server of ours; there is no backend and no bundled SDK.

- **Auth**: Google Identity Services implicit token flow, `drive.appdata` scope only
  (never sees the rest of your Drive, and needs no Google verification review). The
  access token lives in memory and is never persisted; a returning user is reconnected
  silently when a Google session exists.
- **Merge**: union by id, so two devices ridden offline both keep everything —
  see `src/cloud/merge.js` (pure, covered by `scripts/synctest.mjs`).
- **Not synced**: units, HUD layout, theme and graphics quality stay per-device, so a
  phone keeps its low-graphics preset while the desktop keeps *High*.
- **When**: manually from Settings, on startup, and after each ride (the latter two
  when "Automatic sync" is on).

The OAuth client ID in `src/cloud/config.js` is a public identifier, not a secret, and is
deliberately shared with the author's other apps. It is gated to the origins listed there
(plus localhost); a fork deployed elsewhere must supply its own ID in Settings.

### Bundled routes & Claude enrichment (`gpx-route` skill)

For a proper *recreation* of the real world, hand the GPX to Claude (Claude Code or
Cowork) — the repo's `gpx-route` skill converts it with `scripts/gpx2route.mjs`, then
enriches the JSON: real-world **biomes per segment** (farmland, forest, urban,
lakeside, alpine…), named **landmarks** (town, peak, water, bridge, church) rendered
as signposts + props at the right distances, a title and a skybox. Enriched routes
live in `public/routes/` and are fetched & merged into every device on app load
(deleting one sticks — its id is remembered). Validate any route file with
`node scripts/gpx2route.mjs --check <file>`.

## Spec coverage

✅ BLE power (Cycling Power/FTMS) + optional heart rate · ✅ biometric profile affecting
performance · ✅ bike garage · ✅ avatar + bike customization · ✅ 3D low-poly world +
top-down map icon · ✅ virtual routes (material/incline/length segments) · ✅ skyboxes
(normal → existentially bizarre) · ✅ **40 biomes / 83 roadside artifact types**,
from Mojave/redwood/karst/harbour to the outright bizarre (Void, Flesh, Clockwork,
Static, Black Mirrors) ·
✅ matching simplified overhead map · ✅ real routes from GPX files (distance / turns /
gradients straight from the track, Claude-enriched biomes & landmarks) · ✅ full stats
HUD · ✅ show/hide/reorder stats · ✅ units (metric/imperial/per-measurement/per-reading +
deeply obscure: furlongs/fortnight, smoots, donkeypower…) · ✅ current surface display ·
✅ next-turn info · ✅ rear/left/right/chase/cockpit cameras · ✅ constant Ontario air
resistance, no wind/drafting · ✅ reverse any route · ✅ session end modes
(complete / teleport to start / turn around at terminus) · ✅ **route preview** (scrub/
fast-forward, no avatar) · ✅ **replay past activities** (adjustable fast-forward) ·
✅ **history + PBs per route/direction** · ✅ **player ghost** of the all-time PB with
time-behind, ghost icon on the overhead map only · ✅ **bundled routes** synced to every
device via the repo (`public/routes/`).

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

### Known next steps
- Jersey *pattern* is modeled in data but the avatar currently uses solid colours.

---

## Legal & compliance

### License

MIT — see [LICENSE](LICENSE). Free to use, modify, and redistribute. No warranty of any kind.

### Dependencies

| Package | License |
|---|---|
| [three](https://github.com/mrdoob/three.js) | MIT |
| [vite](https://github.com/vitejs/vite) | MIT |
| [jsdom](https://github.com/jsdom/jsdom) | MIT *(dev / test only)* |

### Health & safety

This software is a hobbyist cycling simulator. The author is a software developer — not
a medical doctor, physiologist, personal trainer, or licensed coach. **Nothing the app
displays or calculates constitutes medical advice, a diagnosis, or a training
prescription.** Heart rate, power, and calorie figures are estimates based on simplified
models and may be inaccurate. Consult a qualified healthcare professional before starting,
modifying, or intensifying an exercise programme. Stop exercising immediately if you
experience pain, chest tightness, dizziness, or other symptoms and seek medical attention.

*Black Mirror Bike Ride is not affiliated with, endorsed by, or in any way connected to
Zwift, Google, or any other company mentioned in this readme.*
