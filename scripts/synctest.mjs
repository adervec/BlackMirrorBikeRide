// Cloud-sync merge + config-gate checks. Run: node scripts/synctest.mjs
// The merge is what stands between two devices and a lost ride history, so it
// gets covered properly. No network, no DOM — mergeSyncable/config are pure.
import { mergeSyncable } from '../src/cloud/merge.js';
import { driveClientId, syncConfigured, originAllowed, BUILTIN_CLIENT_ID, SYNC_FILENAME } from '../src/cloud/config.js';

let fails = 0;
const assert = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

const act = (id, date) => ({ id, date, routeId: 'r1', reverse: false, lapTimeS: 100, samples: [] });

// ---- activities: the crown jewels — union, never lose one ----
const phone = { activities: [act('a', '2026-01-02T00:00:00Z'), act('b', '2026-01-01T00:00:00Z')] };
const desk = { activities: [act('c', '2026-01-03T00:00:00Z'), act('b', '2026-01-01T00:00:00Z')] };
const m = mergeSyncable(phone, desk);
assert(m.activities.length === 3, 'activities union across devices (no duplicates by id)');
assert(m.activities.map((a) => a.id).join('') === 'cab', 'activities sorted newest first');

// merging is commutative in membership and idempotent — sync twice, same set
const swapped = mergeSyncable(desk, phone);
assert(swapped.activities.length === 3, 'merge is symmetric in membership');
const twice = mergeSyncable(m, desk);
assert(twice.activities.length === 3, 'merging an already-merged payload adds nothing');

// ---- local wins on id collision ----
const localBike = { bikes: [{ id: 'b1', name: 'Local' }] };
const remoteBike = { bikes: [{ id: 'b1', name: 'Remote' }] };
assert(mergeSyncable(localBike, remoteBike).bikes[0].name === 'Local', 'local copy wins an id collision');

// ---- every content set unions ----
const L = { players: [{ id: 'p1' }], riders: [{ id: 'r1' }], routes: [{ id: 'rt1' }], decals: [{ id: 'd1' }], customSkyboxes: [{ id: 's1' }] };
const R = { players: [{ id: 'p2' }], riders: [{ id: 'r2' }], routes: [{ id: 'rt2' }], decals: [{ id: 'd2' }], customSkyboxes: [{ id: 's2' }] };
const u = mergeSyncable(L, R);
assert(['players', 'riders', 'routes', 'decals', 'customSkyboxes'].every((k) => u[k].length === 2),
  'players/riders/routes/decals/skyboxes all union');

// ---- dismissed bundled routes union (a delete on one device sticks on both) ----
const d = mergeSyncable({ dismissedRouteIds: ['x'] }, { dismissedRouteIds: ['y', 'x'] });
assert(d.dismissedRouteIds.length === 2 && d.dismissedRouteIds.includes('x') && d.dismissedRouteIds.includes('y'),
  'dismissedRouteIds union without duplicates');

// ---- empty / first-sync / junk inputs ----
assert(mergeSyncable(null, null).activities.length === 0, 'merging nothing yields an empty payload');
assert(mergeSyncable(phone, null).activities.length === 2, 'first sync (no remote) keeps local intact');
assert(mergeSyncable({ activities: [{ noId: 1 }] }, {}).activities.length === 0, 'items without an id are dropped');
assert(mergeSyncable({}, {}).app === 'bmbr' && mergeSyncable({}, {}).v === 1, 'payload carries its app tag + version');

// ---- config: the origin gate is the whole security model for a shared client ID ----
assert(BUILTIN_CLIENT_ID.endsWith('.apps.googleusercontent.com'), 'built-in client id looks like a client id');
assert(SYNC_FILENAME === 'bmbr-sync.json', 'sync filename is app-specific (the sibling apps share this Drive folder)');
assert(originAllowed(), 'no location (node) is treated as allowed — tests can run');
assert(driveClientId('  mine.apps.googleusercontent.com ') === 'mine.apps.googleusercontent.com',
  'a user-supplied client id overrides the built-in one (and is trimmed)');
assert(driveClientId('') === BUILTIN_CLIENT_ID, 'built-in id used when no override');
assert(syncConfigured('') === true, 'sync is configured on an allowed origin');

console.log(`\n${fails === 0 ? '✅ ALL SYNC CHECKS PASSED' : '❌ ' + fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
