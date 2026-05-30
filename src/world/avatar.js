// Rider + vehicle model. Xbox-360-tier: smooth-shaded organic forms, a detailed
// customizable face (eyes with lids/pupils, brows, nose+bridge+nostrils, lips,
// ears, neck — Fallout-3 energy), articulated joints, shiny clear-coated kit,
// and vehicles with 1–4 wheels whose tyres show tread + a marker knob so the
// rotation always reads.
//
// IMPORTANT: the rider faces +X (the route's forward). Facial features are built
// pointing +Z and the whole head assembly is rotated +Z -> +X, so the face looks
// FORWARD (previously it pointed sideways, which is why it was never visible).
//
// buildAvatar({ rider, bike, player, decals }) -> { group, update({speed,cadence,dt}) }

import * as THREE from 'three';
import { VEHICLE_TYPES, WHEELS, TIRES } from '../profile/garage.js';
import { BUILDS, resolveRiderBody } from '../profile/customize.js';
import { FACE_SHAPES, BROW_TYPES, NOSE_TYPES, MOUTH_TYPES } from '../profile/face.js';
import { findDecal } from '../profile/decals.js';

const WHEEL_R = 0.34;

// Smooth, lit material for organic/cloth parts.
function mat(color, { rough = 0.8, metal = 0.0, emissive = null, flat = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: flat });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 0.85; }
  return m;
}
// Clear-coated shiny material for helmets / frame / shoes (360-era sheen).
function shiny(color, { rough = 0.35, metal = 0.2, clear = 0.7 } = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, clearcoat: clear, clearcoatRoughness: 0.25 });
}

// ---- a single wheel as a spinnable group (axle along z) ----
function buildWheel(treadStyle, rimColor, tireColor) {
  const g = new THREE.Group();
  const glow = treadStyle === 'glow';
  const tireMat = glow ? mat(0x10ffd0, { emissive: 0x10ffd0 }) : mat(tireColor, { rough: 0.95 });
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.055, 16, 40), tireMat);
  g.add(tire);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.06, 0.022, 12, 36), shiny(rimColor, { rough: 0.3, metal: 0.7 }));
  g.add(rim);
  // hub + brake disc
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 16), shiny(0x9a9a9a, { metal: 0.8, rough: 0.3 }));
  hub.rotation.x = Math.PI / 2; g.add(hub);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 24), shiny(0xbfc4cc, { metal: 0.85, rough: 0.35 }));
  disc.rotation.x = Math.PI / 2; disc.position.z = 0.07; g.add(disc);
  const spokeMat = shiny(0xc8ccd2, { metal: 0.6, rough: 0.35 });
  for (let k = 0; k < 8; k++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, WHEEL_R * 1.85, 6), spokeMat);
    sp.rotation.z = (k * Math.PI) / 8; g.add(sp);
  }
  // tread
  const knobCount = treadStyle === 'knobby' ? 18 : treadStyle === 'spike' ? 14 : treadStyle === 'slick' ? 28 : 22;
  for (let k = 0; k < knobCount; k++) {
    const a = (k / knobCount) * Math.PI * 2;
    let geo, depth;
    if (treadStyle === 'spike') { geo = new THREE.ConeGeometry(0.03, 0.13, 5); depth = 0.13; }
    else if (treadStyle === 'knobby') { geo = new THREE.BoxGeometry(0.06, 0.06, 0.17); depth = 0.05; }
    else { geo = new THREE.BoxGeometry(0.018, 0.03, 0.14); depth = 0.02; }
    const knob = new THREE.Mesh(geo, glow ? mat(0x10ffd0, { emissive: 0x10ffd0 }) : tireMat);
    knob.position.set(Math.cos(a) * (WHEEL_R + depth * 0.3), Math.sin(a) * (WHEEL_R + depth * 0.3), 0);
    knob.rotation.z = a + (treadStyle === 'spike' ? Math.PI / 2 : 0);
    g.add(knob);
  }
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.22), mat(0xffd24a, { emissive: 0xffaa00 }));
  marker.position.set(WHEEL_R, 0, 0); g.add(marker);
  return g;
}

// ---- decal glyph as a canvas texture plane ----
function decalTexture(glyph, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = color; ctx.font = '96px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 64, 70);
  }
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; return tex;
}
function decalPlane(decal, size = 0.18) {
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: decalTexture(decal.glyph, decal.color), transparent: true }));
}

// ---- detailed face, built facing +Z, centred on the head's origin ----
function buildFace(face) {
  const g = new THREE.Group();
  const shape = FACE_SHAPES[face.faceShape] || FACE_SHAPES.oval;
  const skin = mat(face.skinTone, { rough: 0.55 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 28, 22), skin);
  head.scale.set(shape.w, shape.h, 1.02);
  g.add(head);

  // neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 14), skin);
  neck.position.set(0, -0.16, 0); g.add(neck);

  // ears
  for (const sx of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(0.14 * sx * shape.w, -0.01, 0); g.add(ear);
  }

  // brow ridge / cheeks subtle
  const cheekMat = mat(face.skinTone, { rough: 0.6 });
  for (const sx of [1, -1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), cheekMat);
    cheek.position.set(0.06 * sx, -0.04, 0.105); cheek.scale.set(1, 0.8, 0.5); g.add(cheek);
  }

  // eyes: socket + sclera + iris + pupil + upper lid
  const eyeWhite = mat(0xf6f6f4, { rough: 0.25 });
  const irisMat = mat(face.eyeColor, { rough: 0.2 });
  const pupilMat = mat(0x07090c, { rough: 0.2 });
  const lidMat = skin;
  for (const sx of [1, -1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), mat(0x000000, { rough: 1 }));
    socket.position.set(0.056 * sx, 0.022, 0.108); socket.scale.set(1, 0.7, 0.5); socket.material.transparent = true; socket.material.opacity = 0.18; g.add(socket);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 12), eyeWhite);
    w.position.set(0.056 * sx, 0.022, 0.116); w.scale.set(1.1, 0.8, 0.7); g.add(w);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 12, 10), irisMat);
    ir.position.set(0.056 * sx, 0.02, 0.138); g.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), pupilMat);
    pu.position.set(0.056 * sx, 0.02, 0.146); g.add(pu);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lidMat);
    lid.position.set(0.056 * sx, 0.028, 0.114); lid.scale.set(1.1, 0.7, 0.7); g.add(lid);
  }

  // brows
  const brow = BROW_TYPES[face.browType] || BROW_TYPES.flat;
  const browMat = mat(face.browColor, { rough: 0.95 });
  for (const sx of [1, -1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014 * brow.thick, 0.022), browMat);
    b.position.set(0.056 * sx, 0.062, 0.128); b.rotation.z = brow.angle * sx; g.add(b);
  }

  // nose: bridge + tip + nostrils
  const nose = NOSE_TYPES[face.noseType] || NOSE_TYPES.straight;
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03 * nose.w, 0.07 * nose.len, 0.04), skin);
  bridge.position.set(0, 0.0, 0.135); bridge.rotation.x = -0.15; g.add(bridge);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.026 * nose.w, 12, 10), skin);
  tip.position.set(0, -0.032, 0.152); g.add(tip);
  for (const sx of [1, -1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), mat(0x3a2a22, { rough: 1 }));
    nostril.position.set(0.013 * sx, -0.042, 0.151); g.add(nostril);
  }

  // lips: upper + lower with curve
  const mouth = MOUTH_TYPES[face.mouthType] || MOUTH_TYPES.neutral;
  const lipMat = mat(0xb06a58, { rough: 0.55 });
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.014, 0.02), lipMat);
  upper.position.set(0, -0.072, 0.13); g.add(upper);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.018, 0.022), lipMat);
  lower.position.set(0, -0.09, 0.128); g.add(lower);
  for (const sx of [1, -1]) {
    const corner = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), lipMat);
    corner.position.set(0.034 * sx, -0.082 + mouth.curve * 0.02, 0.126); g.add(corner);
  }

  // facial hair
  if (face.facialHair && face.facialHair !== 'none') {
    const fh = mat(face.facialHairColor, { rough: 1.0 });
    if (face.facialHair === 'stubble' || face.facialHair === 'beard') {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), fh);
      beard.position.set(0, -0.02, 0.0); beard.scale.set(1, face.facialHair === 'beard' ? 1.2 : 0.7, 1.05); g.add(beard);
    }
    if (face.facialHair === 'mustache' || face.facialHair === 'beard' || face.facialHair === 'goatee') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.016, 0.03), fh); m.position.set(0, -0.058, 0.128); g.add(m);
    }
    if (face.facialHair === 'goatee') { const chin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.03), fh); chin.position.set(0, -0.11, 0.11); g.add(chin); }
  }
  return g;
}

function buildHair(style, color) {
  if (!style || style === 'bald') return null;
  const g = new THREE.Group();
  const hairMat = mat(color, { rough: 0.95 });
  if (style === 'short') { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.7), hairMat); cap.position.y = 0.02; g.add(cap); }
  else if (style === 'mohawk') { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.28), hairMat); strip.position.y = 0.13; g.add(strip); }
  else if (style === 'long') { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), hairMat); cap.position.y = 0.02; g.add(cap); const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.07), hairMat); back.position.set(0, -0.06, -0.11); g.add(back); }
  else if (style === 'afro') { const a = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), hairMat); a.position.y = 0.06; g.add(a); }
  else if (style === 'topknot') { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), hairMat); g.add(cap); const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), hairMat); bun.position.y = 0.15; g.add(bun); }
  return g;
}

function buildHeadwear(clothing) {
  const g = new THREE.Group();
  const helmet = clothing.helmet || { item: 'none' };
  const hat = clothing.hat || { item: 'none' };
  const hm = shiny(helmet.color || '#eee', { rough: 0.3, metal: 0.1 });
  if (helmet.item === 'road' || helmet.item === 'mtb') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 22, 14, 0, Math.PI * 2, 0, Math.PI / 1.9), hm);
    dome.position.y = 0.03; g.add(dome);
    // vents
    for (const vz of [0.05, -0.05, 0]) { const vent = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.08), mat(0x111418, { rough: 0.6 })); vent.position.set(0.02, 0.12, vz); g.add(vent); }
    if (helmet.item === 'mtb') { const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.09), hm); visor.position.set(0, 0.05, 0.13); g.add(visor); }
  } else if (helmet.item === 'aero' || helmet.item === 'tt') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.165, 22, 14, 0, Math.PI * 2, 0, Math.PI / 1.9), hm);
    dome.scale.set(1, 1, 1.5); dome.position.set(0, 0.03, -0.05); g.add(dome);
    if (helmet.item === 'tt') { const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 10), hm); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.0, -0.2); g.add(tail); }
  } else if (helmet.item === 'leather') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.9), shiny('#6b4a2a', { rough: 0.5, metal: 0 })); g.add(dome);
  }
  const htm = mat(hat.color || '#222', { rough: 0.85 });
  if (hat.item === 'cap') { const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), htm); brim.position.set(0, 0.03, 0.13); g.add(brim); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), htm); g.add(dome); }
  else if (hat.item === 'beanie') { const d = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.7), htm); g.add(d); }
  else if (hat.item === 'cowboy') { const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 24), htm); brim.position.y = 0.02; g.add(brim); const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.17, 16), htm); dome.position.y = 0.1; g.add(dome); }
  else if (hat.item === 'tophat') { const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 24), htm); brim.position.y = 0.02; g.add(brim); const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.28, 18), htm); cyl.position.y = 0.17; g.add(cyl); }
  else if (hat.item === 'viking') { const d = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), shiny('#9a9a9a', { metal: 0.7, rough: 0.35 })); g.add(d); for (const sx of [1, -1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 10), mat('#e8e0c8', { rough: 0.6 })); horn.position.set(0.14 * sx, 0.12, 0); horn.rotation.z = sx * 1.0; g.add(horn); } }
  return g;
}

export function buildAvatar({ rider, bike, player, decals = [] }) {
  const g = new THREE.Group();
  const vt = VEHICLE_TYPES[bike.vehicleType] || VEHICLE_TYPES.bike;
  const wheelDef = WHEELS[bike.wheels] || WHEELS['alloy-training'];
  const tireDef = TIRES[bike.tires] || TIRES['allroad-28'];
  const treadStyle = tireDef.tread || wheelDef.tread || 'file';
  const accent = new THREE.Color(bike.accentColor || '#2c3e50');
  const frameMat = shiny(new THREE.Color(bike.color || '#c0392b'), { rough: 0.3, metal: 0.35, clear: 0.8 });

  // wheels
  const wheels = [];
  for (const w of vt.wheels) {
    const wheel = buildWheel(treadStyle, accent.getHex(), 0x111418);
    wheel.position.set(w.x, WHEEL_R, w.z);
    g.add(wheel); wheels.push(wheel);
  }

  // frame (smooth tubes)
  const tube = (len, x, y, z, rotZ = 0, rotY = 0, thick = 0.045) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick, len, 14), frameMat);
    m.position.set(x, y, z); m.rotation.z = rotZ + Math.PI / 2; m.rotation.y = rotY; g.add(m); return m;
  };
  if (vt.wheels.length >= 2) {
    tube(1.0, 0.05, WHEEL_R + 0.18, 0, 0.2);
    tube(0.7, 0.35, WHEEL_R + 0.18, 0, 1.1);
    tube(0.6, -0.25, WHEEL_R + 0.2, 0, -0.7);
  } else {
    tube(0.5, 0, WHEEL_R + 0.25, 0, Math.PI / 2);
  }
  const seatX = vt.wheels.length >= 2 ? -0.25 : 0;
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.13), shiny(accent, { rough: 0.5 }));
  saddle.position.set(seatX, WHEEL_R + 0.48, 0); g.add(saddle);
  if (vt.wheels.length >= 2) {
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.36, 12), shiny(accent, { rough: 0.4, metal: 0.5 }));
    bars.rotation.x = Math.PI / 2; bars.position.set(0.45, WHEEL_R + 0.44, 0); g.add(bars);
  }

  // vehicle sprays
  (bike.sprays || []).slice(0, 3).forEach((id, i) => {
    const d = findDecal(decals, id); if (!d) return;
    const p = decalPlane(d, 0.16); p.position.set(0.0 - i * 0.18, WHEEL_R + 0.22, 0.06); p.rotation.y = Math.PI / 2; g.add(p);
  });

  // rider
  const body = resolveRiderBody(rider, player);
  const buildScale = (BUILDS[body.build] || BUILDS.regular);
  const heightScale = (body.heightCm || 178) / 178;
  const clo = rider.clothing;
  const skin = mat(rider.face.skinTone, { rough: 0.6 });

  const riderGrp = new THREE.Group();
  riderGrp.position.set(seatX + 0.1, WHEEL_R + 0.5, 0);
  riderGrp.scale.setScalar(heightScale);

  // torso (jersey) — smooth capsule
  const jerseyMat = mat(clo.jersey.color, { rough: 0.8 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17 * buildScale.torsoScale, 0.28, 8, 16), jerseyMat);
  torso.rotation.z = Math.PI / 2 + 0.55; torso.position.set(0.05, 0.18, 0); riderGrp.add(torso);
  addPattern(riderGrp, clo.jersey, buildScale);
  if (clo.gilet && clo.gilet.item !== 'none') {
    const gil = new THREE.Mesh(new THREE.CapsuleGeometry(0.19 * buildScale.torsoScale, 0.26, 6, 14), mat(clo.gilet.color, { rough: 0.7 }));
    gil.rotation.z = Math.PI / 2 + 0.55; gil.position.set(0.04, 0.2, 0); riderGrp.add(gil);
  }
  // shoulders
  for (const sz of [0.16, -0.16]) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), jerseyMat); sh.position.set(0.13, 0.3, sz); riderGrp.add(sh); }

  // head assembly — built facing +Z, rotated so it looks FORWARD (+X)
  const headAssembly = new THREE.Group();
  headAssembly.position.set(0.34, 0.42, 0);
  headAssembly.rotation.y = Math.PI / 2;
  headAssembly.add(buildFace(rider.face));
  const helmetCovers = clo.helmet?.item && clo.helmet.item !== 'none';
  const hatCovers = ['beanie', 'cowboy', 'tophat', 'viking'].includes(clo.hat?.item);
  if (!helmetCovers && !hatCovers) { const hair = buildHair(rider.face.hairStyle, rider.face.hairColor); if (hair) headAssembly.add(hair); }
  headAssembly.add(buildHeadwear(clo));
  riderGrp.add(headAssembly);

  // arms (smooth) + joints + hands
  const gloveMat = (clo.gloves && clo.gloves.item !== 'none') ? mat(clo.gloves.color, { rough: 0.8 }) : skin;
  for (const sz of [0.13, -0.13]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.34, 6, 12), mat(clo.jersey.color, { rough: 0.8 }));
    arm.position.set(0.3, 0.12, sz); arm.rotation.z = Math.PI / 2 - 0.6; riderGrp.add(arm);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), skin); elbow.position.set(0.36, 0.04, sz); riderGrp.add(elbow);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), gloveMat); hand.position.set(0.46, -0.02, sz); riderGrp.add(hand);
  }

  // legs (animated): thigh + shin capsules, knee joint, shoe
  const shortsLong = clo.shorts?.item === 'tights';
  const shortsMat = mat(clo.shorts?.color || '#111', { rough: 0.85 });
  const sockTall = clo.socks?.item === 'tall' || clo.socks?.item === 'wool' || clo.socks?.item === 'rainbow';
  const sockMat = (clo.socks && clo.socks.item !== 'none') ? mat(clo.socks.color, { rough: 0.9 }) : skin;
  const shoeMat = shiny(clo.shoes?.color || '#ddd', { rough: 0.4 });
  const legs = [];
  for (const dz of [0.11, -0.11]) {
    const hip = new THREE.Group(); hip.position.set(-0.05, 0.0, dz);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 6, 12), shortsMat);
    thigh.position.set(0, -0.135, 0); hip.add(thigh);
    const knee = new THREE.Group(); knee.position.set(0, -0.27, 0);
    const kball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), shortsLong ? shortsMat : skin); knee.add(kball);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.2, 6, 12), shortsLong ? shortsMat : (sockTall ? sockMat : skin));
    shin.position.set(0, -0.12, 0); knee.add(shin);
    if (!shortsLong) { const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, sockTall ? 0.16 : 0.06, 12), sockMat); sock.position.set(0, -0.2, 0); knee.add(sock); }
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.19), shoeMat); shoe.position.set(0.03, -0.25, 0); knee.add(shoe);
    hip.add(knee); riderGrp.add(hip); legs.push({ hip, knee });
  }

  // tattoos on upper arm
  (rider.tattoos || []).slice(0, 2).forEach((id, i) => {
    const d = findDecal(decals, id); if (!d) return;
    const p = decalPlane(d, 0.1); p.position.set(0.3, 0.18, 0.2 - i * 0.4); riderGrp.add(p);
  });

  g.add(riderGrp);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  let spin = 0, pedal = 0;
  return {
    group: g,
    update({ speed = 0, cadence = 0, dt = 0.016 }) {
      spin += (speed / WHEEL_R) * dt;
      for (const w of wheels) w.rotation.z = -spin;
      const rpm = cadence || (speed > 0.2 ? 80 : 0);
      pedal += (rpm / 60) * Math.PI * 2 * dt;
      legs.forEach((leg, i) => {
        const ph = pedal + i * Math.PI;
        leg.hip.rotation.z = 0.5 + Math.sin(ph) * 0.5;
        leg.knee.rotation.z = -0.6 - Math.cos(ph) * 0.6;
      });
    }
  };
}

function addPattern(parent, jersey, buildScale) {
  const accent = mat(jersey.accent || '#fff', { rough: 0.8 });
  if (jersey.pattern === 'stripes') {
    for (const off of [-0.12, 0, 0.12]) {
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.172 * buildScale.torsoScale, 0.05, 4, 12), accent);
      s.rotation.z = Math.PI / 2 + 0.55; s.position.set(0.05 + off * 0.4, 0.18 + off, 0); parent.add(s);
    }
  } else if (jersey.pattern === 'blocks') {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.175 * buildScale.torsoScale, 0.12, 4, 12), accent);
    b.rotation.z = Math.PI / 2 + 0.55; b.position.set(0.0, 0.1, 0); parent.add(b);
  } else if (jersey.pattern === 'dots') {
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), accent);
      d.position.set(0.05 + (Math.random() - 0.5) * 0.3, 0.1 + Math.random() * 0.2, (Math.random() - 0.5) * 0.34); parent.add(d);
    }
  }
}
