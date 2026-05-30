// The RIDER is the in-game avatar. You can have many riders, each with its own
// look (face, clothing, decals/tattoos) and its own visual body proportions —
// which can optionally SNAP to a player's real biometrics. Riders never affect
// physics (that's the player's job).

import { defaultFace } from './face.js';
import { defaultClothing } from './clothing.js';

export const BUILDS = {
  slim:    { label: 'Slim',    torsoScale: 0.9,  limbScale: 0.92 },
  regular: { label: 'Regular', torsoScale: 1.0,  limbScale: 1.0 },
  stocky:  { label: 'Stocky',  torsoScale: 1.12, limbScale: 1.08 },
  hefty:   { label: 'Hefty',   torsoScale: 1.28, limbScale: 1.15 }
};

let _id = 0;
const uid = () => `rider-${Date.now().toString(36)}-${(_id++).toString(36)}`;

export function defaultRider() {
  return {
    id: 'rider-1',
    name: 'Rider One',
    snapToPlayer: true,
    body: { heightCm: 178, build: 'regular', shoulderWidthCm: 45 },
    mapIconColor: '#ffcc00',
    face: defaultFace(),
    clothing: defaultClothing(),
    tattoos: [] // decal ids applied to the avatar
  };
}

export function makeRider(name = 'New Rider') {
  const r = defaultRider();
  r.id = uid(); r.name = name;
  return r;
}

// Resolve the body the avatar should actually be drawn with.
export function resolveRiderBody(rider, player) {
  if (rider.snapToPlayer && player) {
    return {
      heightCm: player.heightCm,
      shoulderWidthCm: player.shoulderWidthCm,
      build: rider.body?.build || 'regular'
    };
  }
  return rider.body || { heightCm: 178, build: 'regular', shoulderWidthCm: 45 };
}

// Back-compat: old saves had a single `avatar`; map it onto a rider's fields.
export function defaultAvatar() {
  const r = defaultRider();
  return {
    skinTone: r.face.skinTone,
    jerseyColor: r.clothing.jersey.color,
    jerseyAccent: r.clothing.jersey.accent,
    jerseyPattern: r.clothing.jersey.pattern,
    shortsColor: r.clothing.shorts.color,
    helmetColor: r.clothing.helmet.color,
    build: r.body.build,
    mapIconColor: r.mapIconColor
  };
}
