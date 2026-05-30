// Verifies the avatar geometry: the face must point FORWARD (+X), the head must
// be detailed, and wheels must spin on update. Run: node scripts/avatartest.mjs
import * as THREE from 'three';
import { buildAvatar } from '../src/world/avatar.js';
import { defaultRider } from '../src/profile/customize.js';
import { defaultBike } from '../src/profile/garage.js';
import { defaultPlayer } from '../src/profile/player.js';

let fails = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

const av = buildAvatar({ rider: defaultRider(), bike: defaultBike(), player: defaultPlayer(), decals: [] });

let meshCount = 0;
av.group.traverse((o) => { if (o.isMesh) meshCount++; });
assert(meshCount > 60, `avatar is high-detail (${meshCount} meshes)`);

// head assembly = the group rotated to face +X
let head = null;
av.group.traverse((o) => { if (o.isGroup && Math.abs(o.rotation.y - Math.PI / 2) < 1e-6 && !head) head = o; });
assert(!!head, 'head assembly exists and is oriented to face forward');

if (head) {
  let faceMeshes = 0;
  head.traverse((o) => { if (o.isMesh) faceMeshes++; });
  assert(faceMeshes > 15, `face has detailed features (${faceMeshes} sub-meshes: eyes/brows/nose/lips/ears…)`);
  av.group.updateWorldMatrix(true, true);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
  assert(fwd.x > 0.9, `face points forward (+X): forward.x = ${fwd.x.toFixed(3)} (was sideways before the fix)`);
}

// wheels (direct children at hub height) must spin when updated
const wheels = av.group.children.filter((o) => o.isGroup && Math.abs(o.position.y - 0.34) < 1e-3);
assert(wheels.length === 2, `default bicycle has 2 wheels (${wheels.length})`);
const z0 = wheels[0].rotation.z;
av.update({ speed: 10, cadence: 80, dt: 0.1 });
assert(Math.abs(wheels[0].rotation.z - z0) > 1e-4, 'wheels rotate on update (tread/marker make it visible)');

console.log(`\n${fails === 0 ? '✅ AVATAR CHECKS PASSED' : '❌ ' + fails + ' AVATAR CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
