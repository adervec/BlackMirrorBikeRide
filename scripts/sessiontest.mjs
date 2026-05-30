// Drives the Session class headlessly (stub world/minimap/hud) to verify ride
// recording, preview, replay and ghost logic without WebGL. Run: node scripts/sessiontest.mjs
import { Session } from '../src/game/session.js';
import { sampleRoutes } from '../src/routes/sampleRoutes.js';
import { defaultPlayer } from '../src/profile/player.js';
import { defaultBike } from '../src/profile/garage.js';
import { defaultRider } from '../src/profile/customize.js';

let fails = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

const stubWorld = () => ({ hidden: false, build() {}, setHideAvatar(v) { this.hidden = v; }, update() {}, setCameraMode() {}, cycleCamera() {}, resize() {}, dispose() {} });
const stubMap = () => ({ setProfile() {}, render() {} });
const stubHud = () => ({ render() {} });
const baseSettings = { sessionEndMode: 'complete', previewSpeedMs: 100, replaySpeedMul: 5, ghost: { enabled: true } };

const route = sampleRoutes()[0];
const player = defaultPlayer(), bike = defaultBike(), rider = defaultRider();
const common = (extra) => ({ route, reverse: false, player, bike, rider, decals: [], world: stubWorld(), minimap: stubMap(), hud: stubHud(), settings: baseSettings, ...extra });

const drive = (sess, steps, dt = 0.1) => { for (let i = 0; i < steps && !sess.finished; i++) sess._tick(dt); };

// ---- RIDE: records an activity, shows avatar ----
let recorded = null, ended = null;
const sensors = { power: 600, cadence: 85, heartRate: 150, simulatorActive: false, stopSimulator() {} };
const ride = new Session(common({ mode: 'ride', sensors, onRecord: (a) => { recorded = a; }, onEnd: (s) => { ended = s; } }));
assert(ride.world.hidden === false, 'ride mode shows the avatar');
drive(ride, 8000);                              // up to 800 s; 3 km should complete
assert(ride.finished, 'ride completes the route');
assert(ended && ended.distance > 2900, 'onEnd fired with full distance');
assert(recorded && recorded.samples.length > 5, 'ride recorded ~1 Hz samples');
assert(recorded.lapTimeS != null && recorded.lapTimeS > 0, 'recorded activity has a lap time');
console.log(`     recorded: ${recorded.samples.length} samples, lap ${recorded.lapTimeS.toFixed(1)} s, ${(recorded.distanceM/1000).toFixed(2)} km`);

// ---- PREVIEW: hides avatar, auto-advances, no recording ----
let prevRecorded = false;
const preview = new Session(common({ mode: 'preview', sensors: { power: 0, stopSimulator() {} }, onRecord: () => { prevRecorded = true; } }));
assert(preview.world.hidden === true, 'preview mode hides the avatar');
drive(preview, 50);
assert(preview.distance > 100, 'preview auto-advances along the route');
assert(Math.abs(preview.curSpeed - preview.previewSpeed) < 1e-6, 'preview speed = configured preview speed');
preview.stop();
assert(prevRecorded === false, 'preview does NOT record an activity');

// ---- REPLAY: plays the recorded ride back ----
const replay = new Session(common({ mode: 'replay', replayActivity: recorded, ghost: null, sensors: { stopSimulator() {} } }));
const d0 = replay.distance;
drive(replay, 40);
assert(replay.distance > d0, 'replay advances distance from recorded samples');
assert(replay.curSpeed >= 0, 'replay produces a speed from samples');

// ---- GHOST: compare a fresh ride against the recorded PB ----
const ghostRide = new Session(common({ mode: 'ride', sensors: { power: 300, cadence: 80, heartRate: 140, stopSimulator() {} }, ghost: recorded }));
drive(ghostRide, 100);
assert(ghostRide.ghostDistance != null && Number.isFinite(ghostRide.ghostDistance), 'ghost distance computed during ride');
assert(ghostRide.ghostDelta != null && Number.isFinite(ghostRide.ghostDelta), 'ghost time-behind computed during ride');
console.log(`     ghost @ ${ghostRide.time.toFixed(0)}s: player ${ghostRide.distance.toFixed(0)}m, ghost ${ghostRide.ghostDistance.toFixed(0)}m, delta ${ghostRide.ghostDelta.toFixed(1)}s`);
ghostRide.stop();

console.log(`\n${fails === 0 ? '✅ ALL SESSION CHECKS PASSED' : '❌ ' + fails + ' SESSION CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
