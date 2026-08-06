// Roadside artifacts. Each biome lists artifact types + densities (items per
// 100 m per side); we scan the route and scatter low-poly props accordingly.

import * as THREE from 'three';
import { profileAt } from '../routes/virtualRoute.js';
import { BIOMES } from '../routes/biomes.js';
import { circle, cone, cylinder, dodeca, icosa, octa, sphere, torus } from './poly.js';

const MAX_ARTIFACTS = 700;
const _box = new THREE.Box3();      // reused while measuring props for placement
// Measured unscaled height per artifact type. Every instance of a type is the
// same rough size, so measuring one and scaling is enough — doing it per prop
// cost ~1s of scene build on a long route.
const _heightByType = new Map();

const M = (c, opts = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...opts });

// --- builders: each returns an Object3D whose base sits at y = 0 ---
const builders = {
  cactus() {
    const g = new THREE.Group();
    const body = M(0x4f7a3a);
    const trunk = new THREE.Mesh(cylinder(0.18, 0.22, 2.2, 7), body);
    trunk.position.y = 1.1; g.add(trunk);
    for (const s of [1, -1]) {
      const arm = new THREE.Mesh(cylinder(0.1, 0.12, 0.9, 6), body);
      arm.position.set(s * 0.3, 1.3, 0); arm.rotation.z = s * 0.9; g.add(arm);
      const up = new THREE.Mesh(cylinder(0.09, 0.1, 0.5, 6), body);
      up.position.set(s * 0.5, 1.7, 0); g.add(up);
    }
    return g;
  },
  rock() {
    const r = 0.5 + Math.random() * 0.8;
    const m = new THREE.Mesh(dodeca(r, 0), M(0x7a736a));
    m.position.y = r * 0.6; return m;
  },
  skull() {
    const g = new THREE.Group();
    const s = M(0xe8e2d0);
    const skull = new THREE.Mesh(sphere(0.18, 8, 6), s);
    skull.position.y = 0.18; g.add(skull);
    const horn = new THREE.Mesh(cone(0.05, 0.4, 5), s);
    horn.position.set(0.18, 0.3, 0); horn.rotation.z = -1.1; g.add(horn);
    const horn2 = horn.clone(); horn2.position.x = -0.18; horn2.rotation.z = 1.1; g.add(horn2);
    return g;
  },
  tumbleweed() {
    const m = new THREE.Mesh(icosa(0.45, 1), new THREE.MeshLambertMaterial({ color: 0x9c7a3a, wireframe: true }));
    m.position.y = 0.45; return m;
  },
  roadsign() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(cylinder(0.05, 0.05, 2.4, 6), M(0x8a8a8a));
    post.position.y = 1.2; g.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), M(0xf2c14e));
    board.position.y = 2.0; g.add(board);
    return g;
  },
  shrub() {
    const g = new THREE.Group();
    const c = M(0x6f8a3a);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(sphere(0.25 + Math.random() * 0.15, 6, 5), c);
      b.position.set((Math.random() - 0.5) * 0.4, 0.25, (Math.random() - 0.5) * 0.4);
      g.add(b);
    }
    return g;
  },
  pine() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(cylinder(0.12, 0.16, 1.0, 6), M(0x5a3a22));
    trunk.position.y = 0.5; g.add(trunk);
    const foliage = M(0x2f5a2a);
    for (let i = 0; i < 3; i++) {
      const tier = new THREE.Mesh(cone(1.0 - i * 0.25, 1.2, 7), foliage);
      tier.position.y = 1.2 + i * 0.7; g.add(tier);
    }
    return g;
  },
  pylon() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), new THREE.MeshBasicMaterial({ color: 0x00ffd0 }));
    m.position.y = 2; g.add(m);
    return g;
  },
  crystal() {
    const m = new THREE.Mesh(octa(0.7, 0), new THREE.MeshBasicMaterial({ color: 0xff3ce0 }));
    m.position.y = 0.9; return m;
  },
  neonring() {
    const r = 1.6 + Math.random() * 1.8;
    const m = new THREE.Mesh(torus(r, 0.11, 6, 16),
      new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x00ffd0 : 0xff2fb0 }));
    m.position.y = r + 0.3; m.rotation.y = Math.random() * Math.PI; return m;
  },
  deciduous() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(cylinder(0.14, 0.2, 1.6, 6), M(0x6b4a2a));
    trunk.position.y = 0.8; g.add(trunk);
    const leaf = M(0x4d7a35);
    for (let i = 0; i < 2; i++) {
      const ball = new THREE.Mesh(sphere(0.9 - i * 0.25, 7, 6), leaf);
      ball.position.set((Math.random() - 0.5) * 0.5, 1.9 + i * 0.6, (Math.random() - 0.5) * 0.5);
      g.add(ball);
    }
    return g;
  },
  haybale() {
    const m = new THREE.Mesh(cylinder(0.6, 0.6, 1.1, 10), M(0xd2b04a));
    m.rotation.z = Math.PI / 2; m.position.y = 0.6; return m;
  },
  barn() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 7), M(0x9c3a2e));
    body.position.y = 1.5; g.add(body);
    const roof = new THREE.Mesh(cylinder(2.6, 2.6, 7.2, 3), M(0x5a3a30));
    roof.rotation.set(Math.PI / 2, Math.PI, 0); // triangular prism, ridge up
    roof.position.y = 3.8; g.add(roof);
    return g;
  },
  fence() {
    const g = new THREE.Group();
    const wood = M(0x7a5c3a);
    for (let i = 0; i < 3; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), wood);
      post.position.set(i * 1.4 - 1.4, 0.55, 0); g.add(post);
    }
    for (const y of [0.5, 0.9]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.06), wood);
      rail.position.y = y; g.add(rail);
    }
    return g;
  },
  building() {
    const h = 6 + Math.random() * 9;
    const tint = 0.75 + Math.random() * 0.25;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(4 + Math.random() * 4, h, 4 + Math.random() * 4),
      M(new THREE.Color(0.45 * tint, 0.47 * tint, 0.5 * tint))
    );
    m.position.y = h / 2; return m;
  },
  streetlamp() {
    const g = new THREE.Group();
    const metal = M(0x4a4f55);
    const pole = new THREE.Mesh(cylinder(0.06, 0.08, 4.5, 6), metal);
    pole.position.y = 2.25; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), metal);
    arm.position.set(0.45, 4.4, 0); g.add(arm);
    const lamp = new THREE.Mesh(sphere(0.14, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
    lamp.position.set(0.85, 4.35, 0); g.add(lamp);
    return g;
  },
  reeds() {
    const g = new THREE.Group();
    const c = M(0x5f7a3f);
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const blade = new THREE.Mesh(cone(0.05, 1.2 + Math.random() * 0.6, 4), c);
      blade.position.set((Math.random() - 0.5) * 0.5, 0.7, (Math.random() - 0.5) * 0.5);
      g.add(blade);
    }
    return g;
  },

  // ---- coastal ----
  palm() {
    const g = new THREE.Group();
    const lean = (Math.random() - 0.5) * 0.3;
    const trunk = new THREE.Mesh(cylinder(0.14, 0.24, 5.5, 6), M(0x9c7b52));
    trunk.position.y = 2.75; trunk.rotation.z = lean; g.add(trunk);
    const frond = M(0x3f7a3a);
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(cone(0.42, 2.6, 4), frond);
      const a = (i / 7) * Math.PI * 2;
      f.position.set(Math.sin(lean) * 5.5 + Math.cos(a) * 1.0, 5.4, Math.sin(a) * 1.0);
      f.rotation.set(Math.PI / 2.3, 0, -a);
      g.add(f);
    }
    return g;
  },
  dunegrass() {
    const g = new THREE.Group();
    const c = M(0xa8b070);
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(cone(0.04, 0.7 + Math.random() * 0.5, 3), c);
      b.position.set((Math.random() - 0.5) * 0.7, 0.4, (Math.random() - 0.5) * 0.7);
      b.rotation.z = (Math.random() - 0.5) * 0.7;
      g.add(b);
    }
    return g;
  },
  driftwood() {
    const g = new THREE.Group();
    const w = M(0xb8ad98);
    const log = new THREE.Mesh(cylinder(0.16, 0.2, 2.4, 5), w);
    log.rotation.set(0, Math.random() * 3, Math.PI / 2 + (Math.random() - 0.5) * 0.3);
    log.position.y = 0.2; g.add(log);
    const branch = new THREE.Mesh(cylinder(0.07, 0.09, 1.1, 4), w);
    branch.position.set(0.5, 0.45, 0.2); branch.rotation.z = 0.9; g.add(branch);
    return g;
  },

  // ---- cold ----
  snowdrift() {
    const r = 0.7 + Math.random() * 1.1;
    const m = new THREE.Mesh(sphere(r, 7, 5), M(0xf2f6fa));
    m.scale.y = 0.42; m.position.y = r * 0.2; return m;
  },
  icespike() {
    const g = new THREE.Group();
    const ice = new THREE.MeshLambertMaterial({ color: 0xbfe4f0, flatShading: true, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 3; i++) {
      const h = 1.2 + Math.random() * 1.8;
      const s = new THREE.Mesh(cone(0.22, h, 5), ice);
      s.position.set((Math.random() - 0.5) * 0.8, h / 2, (Math.random() - 0.5) * 0.8);
      s.rotation.z = (Math.random() - 0.5) * 0.25;
      g.add(s);
    }
    return g;
  },
  deadtree() {
    const g = new THREE.Group();
    const w = M(0x6a5a4a);
    const trunk = new THREE.Mesh(cylinder(0.1, 0.22, 3.4, 5), w);
    trunk.position.y = 1.7; g.add(trunk);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(cylinder(0.04, 0.07, 1.3, 4), w);
      const a = Math.random() * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.45, 2.2 + Math.random() * 0.9, Math.sin(a) * 0.45);
      b.rotation.set(0, -a, 0.9 + Math.random() * 0.3);
      g.add(b);
    }
    return g;
  },
  boulder() {
    const r = 0.9 + Math.random() * 1.4;
    const m = new THREE.Mesh(dodeca(r, 0), M(0x8a857c));
    m.rotation.set(Math.random(), Math.random(), Math.random());
    m.position.y = r * 0.55; return m;
  },

  // ---- tropical ----
  jungletree() {
    const g = new THREE.Group();
    const h = 5 + Math.random() * 4;
    const trunk = new THREE.Mesh(cylinder(0.16, 0.3, h, 6), M(0x5a4630));
    trunk.position.y = h / 2; g.add(trunk);
    const leaf = M(0x2f6b2a);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(sphere(1.5 - i * 0.3, 7, 5), leaf);
      c.scale.y = 0.6;
      c.position.set((Math.random() - 0.5) * 1.2, h + i * 0.7, (Math.random() - 0.5) * 1.2);
      g.add(c);
    }
    return g;
  },
  fern() {
    const g = new THREE.Group();
    const c = M(0x3f8a3a);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const f = new THREE.Mesh(cone(0.24, 1.5, 3), c);
      f.position.set(Math.cos(a) * 0.35, 0.7, Math.sin(a) * 0.35);
      f.rotation.set(0.65, -a, 0);
      g.add(f);
    }
    return g;
  },
  acacia() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(cylinder(0.16, 0.3, 3.2, 6), M(0x6b5334));
    trunk.position.y = 1.6; g.add(trunk);
    // the flat-topped umbrella crown
    const crown = new THREE.Mesh(cylinder(2.6, 1.4, 0.7, 8), M(0x6b8a3a));
    crown.position.y = 3.6; g.add(crown);
    return g;
  },
  grasstuft() {
    const g = new THREE.Group();
    const c = M(0xc4b06a);
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(cone(0.05, 0.9 + Math.random() * 0.7, 3), c);
      b.position.set((Math.random() - 0.5) * 0.8, 0.5, (Math.random() - 0.5) * 0.8);
      b.rotation.z = (Math.random() - 0.5) * 0.5;
      g.add(b);
    }
    return g;
  },
  termitemound() {
    const h = 1.6 + Math.random() * 1.4;
    const m = new THREE.Mesh(cone(0.55, h, 6), M(0xa06a42));
    m.position.y = h / 2; return m;
  },

  // ---- volcanic ----
  lavarock() {
    const r = 0.4 + Math.random() * 0.7;
    const m = new THREE.Mesh(dodeca(r, 0), M(0x2b2422));
    m.rotation.set(Math.random(), Math.random(), Math.random());
    m.position.y = r * 0.5; return m;
  },
  steamvent() {
    const g = new THREE.Group();
    const vent = new THREE.Mesh(cylinder(0.5, 0.75, 0.6, 7), M(0x3a302e));
    vent.position.y = 0.3; g.add(vent);
    const steam = new THREE.MeshLambertMaterial({ color: 0xdcd6d0, flatShading: true, transparent: true, opacity: 0.4 });
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(sphere(0.42 + i * 0.16, 6, 5), steam);
      p.position.set((Math.random() - 0.5) * 0.5, 0.9 + i * 0.8, (Math.random() - 0.5) * 0.5);
      g.add(p);
    }
    return g;
  },

  // ---- moor / farm ----
  heather() {
    const g = new THREE.Group();
    const c = M(0x8a6a9c);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(sphere(0.22 + Math.random() * 0.14, 5, 4), c);
      b.position.set((Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6);
      b.scale.y = 0.7; g.add(b);
    }
    return g;
  },
  stonewall() {
    const g = new THREE.Group();
    const s = M(0x8f8b80);
    for (let i = 0; i < 8; i++) {
      const w = 0.34 + Math.random() * 0.16;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, 0.42), s);
      b.position.set((i % 4) * 0.46 - 0.7, 0.14 + Math.floor(i / 4) * 0.3, 0);
      b.rotation.y = (Math.random() - 0.5) * 0.2;
      g.add(b);
    }
    return g;
  },
  vinerow() {
    const g = new THREE.Group();
    const post = M(0x7a6244);
    const leaf = M(0x4f7a35);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.09), post);
      p.position.set(i * 1.5 - 2.2, 0.75, 0); g.add(p);
      const bush = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 0.55), leaf);
      bush.position.set(i * 1.5 - 1.5, 1.15, 0); g.add(bush);
    }
    return g;
  },
  cypress() {
    const g = new THREE.Group();
    const h = 4.5 + Math.random() * 2.5;
    const body = new THREE.Mesh(cone(0.65, h, 7), M(0x2f4a2a));
    body.position.y = h / 2; g.add(body);
    return g;
  },
  villa() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 5), M(0xd8c8a0));
    body.position.y = 2; g.add(body);
    const roof = new THREE.Mesh(cone(5.2, 1.8, 4), M(0xa05a3a));
    roof.position.y = 4.9; roof.rotation.y = Math.PI / 4; g.add(roof);
    return g;
  },

  // ---- built-up ----
  container() {
    const cols = [0xb4553a, 0x3a6bb4, 0x4a9c5a, 0xc4a03a];
    const g = new THREE.Group();
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), M(cols[Math.floor(Math.random() * cols.length)]));
      b.position.set((Math.random() - 0.5) * 0.6, 1.3 + i * 2.6, 0);
      g.add(b);
    }
    return g;
  },
  factory() {
    const g = new THREE.Group();
    const shed = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 9), M(0x7a7e82));
    shed.position.y = 3; g.add(shed);
    for (let i = 0; i < 2; i++) {
      const stack = new THREE.Mesh(cylinder(0.7, 0.9, 9, 7), M(0x9c5a4a));
      stack.position.set(i * 3 - 1.5, 7.5, -2.5); g.add(stack);
    }
    return g;
  },
  house() {
    const g = new THREE.Group();
    const w = 5 + Math.random() * 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 3, w * 0.8), M(0xcfc4b2));
    body.position.y = 1.5; g.add(body);
    const roof = new THREE.Mesh(cone(w * 0.78, 1.9, 4), M(0x7a4a3a));
    roof.position.y = 3.9; roof.rotation.y = Math.PI / 4; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.1), M(0x5a3a2a));
    door.position.set(0, 0.75, w * 0.41); g.add(door);
    return g;
  },
  hedge() {
    const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 0.8), M(0x3f6b34));
    m.position.y = 0.6; return m;
  },
  mailbox() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), M(0x6a5a4a));
    post.position.y = 0.55; g.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.26), M(0x4a5a7a));
    box.position.y = 1.2; g.add(box);
    return g;
  },

  // ---- canyon ----
  redrock() {
    const h = 1.4 + Math.random() * 2.6;
    const m = new THREE.Mesh(cylinder(0.7 + Math.random() * 0.5, 1.0 + Math.random() * 0.6, h, 6), M(0xa8552f));
    m.position.y = h / 2; m.rotation.y = Math.random() * 3; return m;
  },
  mesa() {
    const g = new THREE.Group();
    const h = 12 + Math.random() * 14;
    const base = new THREE.Mesh(cylinder(9, 12, h, 7), M(0x9c4a2a));
    base.position.y = h / 2; g.add(base);
    const cap = new THREE.Mesh(cylinder(9.4, 9.4, 1.6, 7), M(0xb06a42));
    cap.position.y = h + 0.8; g.add(cap);
    return g;
  },

  // ---- swamp ----
  cypresstree() {
    const g = new THREE.Group();
    const h = 4.5 + Math.random() * 3;
    const trunk = new THREE.Mesh(cylinder(0.22, 0.75, h, 7), M(0x5f4f3a));
    trunk.position.y = h / 2; g.add(trunk);
    const canopy = new THREE.Mesh(sphere(1.7, 7, 5), M(0x4a6b40));
    canopy.scale.y = 0.55; canopy.position.y = h + 0.5; g.add(canopy);
    // hanging moss
    const moss = new THREE.MeshLambertMaterial({ color: 0x8a9c70, flatShading: true, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const m = new THREE.Mesh(cone(0.18, 1.4, 4), moss);
      m.position.set(Math.cos(a) * 1.2, h - 0.2, Math.sin(a) * 1.2);
      g.add(m);
    }
    return g;
  },
  lilypad() {
    const g = new THREE.Group();
    const c = M(0x4a7a44);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(circle(0.3 + Math.random() * 0.25, 7), c);
      p.rotation.x = -Math.PI / 2;
      p.position.set((Math.random() - 0.5) * 1.6, 0.04, (Math.random() - 0.5) * 1.6);
      g.add(p);
    }
    return g;
  },

  // ---- graveyard ----
  headstone() {
    const g = new THREE.Group();
    const s = M(0x9a978e);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.95, 0.14), s);
    slab.position.y = 0.48; g.add(slab);
    const top = new THREE.Mesh(cylinder(0.325, 0.325, 0.14, 8, 1, false, 0, Math.PI), s);
    top.rotation.set(Math.PI / 2, 0, 0); top.position.y = 0.95; g.add(top);
    g.rotation.z = (Math.random() - 0.5) * 0.16; // settled crooked
    return g;
  },
  crypt() {
    const g = new THREE.Group();
    const s = M(0x8f8b82);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.8, 3.6), s);
    body.position.y = 1.4; g.add(body);
    const roof = new THREE.Mesh(cone(2.6, 1.2, 4), s);
    roof.position.y = 3.4; roof.rotation.y = Math.PI / 4; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.12), M(0x3a352f));
    door.position.set(0, 0.85, 1.82); g.add(door);
    return g;
  },
  ironfence() {
    const g = new THREE.Group();
    const iron = M(0x2f3238);
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(cylinder(0.045, 0.045, 1.5, 4), iron);
      bar.position.set(i * 0.38 - 0.95, 0.75, 0); g.add(bar);
      const tip = new THREE.Mesh(cone(0.075, 0.22, 4), iron);
      tip.position.set(i * 0.38 - 0.95, 1.6, 0); g.add(tip);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.07, 0.07), iron);
    rail.position.y = 1.25; g.add(rail);
    return g;
  },

  // ---- the void ----
  monolith() {
    const h = 5 + Math.random() * 7;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 0.4), new THREE.MeshBasicMaterial({ color: 0x05050a }));
    m.position.y = h / 2; m.rotation.y = Math.random() * 3; return m;
  },
  obelisk() {
    const h = 6 + Math.random() * 5;
    const g = new THREE.Group();
    const mat = M(0x1a1a24);
    const shaft = new THREE.Mesh(cylinder(0.28, 0.55, h, 4), mat);
    shaft.position.y = h / 2; g.add(shaft);
    const tip = new THREE.Mesh(cone(0.3, 0.9, 4), mat);
    tip.position.y = h + 0.45; g.add(tip);
    return g;
  },
  floatcube() {
    const s = 0.6 + Math.random() * 1.1;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial({ color: 0x6a5acd, wireframe: true }));
    m.position.y = 2 + Math.random() * 5;
    m.rotation.set(Math.random(), Math.random(), Math.random());
    return m;
  },

  // ---- flesh ----
  fleshpillar() {
    const g = new THREE.Group();
    const h = 2.5 + Math.random() * 3;
    const mat = M(0xa8544e);
    const body = new THREE.Mesh(cylinder(0.45, 0.7, h, 7), mat);
    body.position.y = h / 2; g.add(body);
    const bulb = new THREE.Mesh(sphere(0.62, 7, 5), mat);
    bulb.position.y = h; g.add(bulb);
    return g;
  },
  eyestalk() {
    const g = new THREE.Group();
    const h = 1.8 + Math.random() * 1.8;
    const stalk = new THREE.Mesh(cylinder(0.14, 0.22, h, 6), M(0x8a4a48));
    stalk.position.y = h / 2; g.add(stalk);
    const ball = new THREE.Mesh(sphere(0.36, 8, 6), M(0xf0e6d8));
    ball.position.y = h + 0.2; g.add(ball);
    const iris = new THREE.Mesh(sphere(0.17, 7, 5), new THREE.MeshBasicMaterial({ color: 0x1a0a0a }));
    iris.position.set(0, h + 0.2, 0.28); g.add(iris);
    return g;
  },
  ribarch() {
    const g = new THREE.Group();
    const bone = M(0xe4d8c4);
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(torus(2.2 + i * 0.35, 0.16, 5, 9, Math.PI), bone);
      rib.position.set(0, 0, i * 0.9 - 1.4);
      g.add(rib);
    }
    return g;
  },

  // ---- big timber ----
  redwood() {
    const g = new THREE.Group();
    const h = 22 + Math.random() * 14;
    const trunk = new THREE.Mesh(cylinder(0.9, 1.8, h, 8), M(0x7a4530));
    trunk.position.y = h / 2; g.add(trunk);
    const leaf = M(0x2a4a28);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(cone(4.2 - i * 0.9, 7, 7), leaf);
      c.position.y = h * 0.62 + i * 5; g.add(c);
    }
    return g;
  },
  bamboo() {
    const g = new THREE.Group();
    const cane = M(0x9cb04a);
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const h = 5 + Math.random() * 4;
      const c = new THREE.Mesh(cylinder(0.09, 0.11, h, 5), cane);
      c.position.set((Math.random() - 0.5) * 1.4, h / 2, (Math.random() - 0.5) * 1.4);
      c.rotation.z = (Math.random() - 0.5) * 0.12;
      g.add(c);
      const tuft = new THREE.Mesh(cone(0.5, 1.1, 4), M(0x6f8f36));
      tuft.position.set(c.position.x, h + 0.3, c.position.z); g.add(tuft);
    }
    return g;
  },
  mangrove() {
    const g = new THREE.Group();
    const wood = M(0x5a4a38);
    const h = 3.4 + Math.random() * 1.8;
    const trunk = new THREE.Mesh(cylinder(0.18, 0.26, h, 6), wood);
    trunk.position.y = 1.2 + h / 2; g.add(trunk);
    for (let i = 0; i < 6; i++) {           // the stilt roots
      const a = (i / 6) * Math.PI * 2;
      const r = new THREE.Mesh(cylinder(0.07, 0.11, 2.2, 4), wood);
      r.position.set(Math.cos(a) * 0.75, 0.9, Math.sin(a) * 0.75);
      r.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
      g.add(r);
    }
    const canopy = new THREE.Mesh(sphere(1.6, 7, 5), M(0x3f6b3a));
    canopy.scale.y = 0.6; canopy.position.y = 1.2 + h; g.add(canopy);
    return g;
  },
  fruittree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(cylinder(0.15, 0.22, 1.5, 6), M(0x6b5334));
    trunk.position.y = 0.75; g.add(trunk);
    const canopy = new THREE.Mesh(sphere(1.3, 8, 6), M(0x4f8a3a));
    canopy.scale.y = 0.8; canopy.position.y = 2.2; g.add(canopy);
    const fruit = new THREE.MeshLambertMaterial({ color: 0xd0483a, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(sphere(0.12, 5, 4), fruit);
      const a = Math.random() * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.0, 2.0 + Math.random() * 0.7, Math.sin(a) * 1.0);
      g.add(f);
    }
    return g;
  },

  // ---- arid ----
  hoodoo() {
    const g = new THREE.Group();
    const h = 3 + Math.random() * 5;
    const bands = [0xa8794a, 0xc09060, 0x8a5c36];
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const seg = h / 4;
      const r = 0.5 + (i === 2 ? 0.35 : 0) + Math.random() * 0.2;
      const b = new THREE.Mesh(cylinder(r * 0.85, r, seg, 7), M(bands[i % 3]));
      b.position.y = y + seg / 2; g.add(b);
      y += seg;
    }
    const cap = new THREE.Mesh(cylinder(1.0, 0.8, 0.5, 7), M(0x6f4a2e));
    cap.position.y = h + 0.25; g.add(cap);
    return g;
  },
  saltcrust() {
    const g = new THREE.Group();
    const s = M(0xf4f2ea);
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(cylinder(0.5 + Math.random() * 0.4, 0.5, 0.12, 6), s);
      p.position.set((Math.random() - 0.5) * 2, 0.06, (Math.random() - 0.5) * 2);
      g.add(p);
    }
    return g;
  },
  saltcairn() {
    const g = new THREE.Group();
    const s = M(0xe8e4d6);
    let y = 0;
    for (let i = 0; i < 5; i++) {
      const r = 0.42 - i * 0.06;
      const b = new THREE.Mesh(dodeca(r, 0), s);
      b.position.set((Math.random() - 0.5) * 0.12, y + r * 0.7, (Math.random() - 0.5) * 0.12);
      g.add(b); y += r * 1.3;
    }
    return g;
  },
  sanddune() {
    const r = 2.5 + Math.random() * 3.5;
    const m = new THREE.Mesh(sphere(r, 8, 5), M(0xe0c68e));
    m.scale.set(1.5, 0.32, 1); m.rotation.y = Math.random() * 3;
    m.position.y = -r * 0.05; return m;
  },
  karsttower() {
    const g = new THREE.Group();
    const h = 18 + Math.random() * 22;
    const rock = M(0x8a9c78);
    const body = new THREE.Mesh(cylinder(2.6, 5.5, h, 7), rock);
    body.position.y = h / 2; g.add(body);
    const cap = new THREE.Mesh(sphere(2.8, 7, 5), M(0x4d6a3c));
    cap.scale.y = 0.5; cap.position.y = h; g.add(cap);
    return g;
  },

  // ---- plains & farm ----
  wheat() {
    const g = new THREE.Group();
    const c = M(0xd8c268);
    for (let i = 0; i < 11; i++) {
      const h = 0.9 + Math.random() * 0.5;
      const stalk = new THREE.Mesh(cylinder(0.02, 0.03, h, 3), c);
      stalk.position.set((Math.random() - 0.5) * 1.1, h / 2, (Math.random() - 0.5) * 1.1);
      stalk.rotation.z = (Math.random() - 0.5) * 0.25;
      g.add(stalk);
      const ear = new THREE.Mesh(cone(0.06, 0.28, 4), M(0xc0a848));
      ear.position.set(stalk.position.x, h + 0.1, stalk.position.z); g.add(ear);
    }
    return g;
  },
  grainsilo() {
    const g = new THREE.Group();
    const h = 9 + Math.random() * 4;
    const body = new THREE.Mesh(cylinder(2.2, 2.2, h, 12), M(0xc4c8cc));
    body.position.y = h / 2; g.add(body);
    const roof = new THREE.Mesh(cone(2.5, 1.8, 12), M(0x8a8f94));
    roof.position.y = h + 0.9; g.add(roof);
    return g;
  },
  windpump() {
    const g = new THREE.Group();
    const metal = M(0x9aa0a6);
    const h = 6.5;
    for (const [dx, dz] of [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]) {
      const leg = new THREE.Mesh(cylinder(0.05, 0.08, h, 4), metal);
      leg.position.set(dx, h / 2, dz);
      leg.rotation.set(dz * 0.1, 0, -dx * 0.1);
      g.add(leg);
    }
    const hub = new THREE.Mesh(cylinder(0.22, 0.22, 0.2, 8), metal);
    hub.rotation.x = Math.PI / 2; hub.position.y = h + 0.3; g.add(hub);
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.4, 0.04), metal);
      const a = (i / 8) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.8, h + 0.3 + Math.sin(a) * 0.8, 0.14);
      b.rotation.z = a; g.add(b);
    }
    return g;
  },
  cratestack() {
    const g = new THREE.Group();
    const wood = M(0xb08a52);
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.8), wood);
      c.position.set((Math.random() - 0.5) * 0.25, 0.28 + i * 0.56, (Math.random() - 0.5) * 0.25);
      c.rotation.y = (Math.random() - 0.5) * 0.3;
      g.add(c);
    }
    return g;
  },
  ladder() {
    const g = new THREE.Group();
    const wood = M(0xc0a068);
    for (const dx of [-0.22, 0.22]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.2, 0.07), wood);
      rail.position.set(dx, 1.6, 0); g.add(rail);
    }
    for (let i = 0; i < 7; i++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), wood);
      rung.position.y = 0.35 + i * 0.42; g.add(rung);
    }
    g.rotation.z = 0.22; // leaning against something unseen
    return g;
  },

  // ---- cold ----
  serac() {
    const g = new THREE.Group();
    const ice = new THREE.MeshLambertMaterial({ color: 0xcfe8f4, flatShading: true, transparent: true, opacity: 0.9 });
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const h = 2.5 + Math.random() * 4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.4 + Math.random(), h, 1.2 + Math.random()), ice);
      b.position.set((Math.random() - 0.5) * 2.2, h / 2, (Math.random() - 0.5) * 2.2);
      b.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * 3, (Math.random() - 0.5) * 0.2);
      g.add(b);
    }
    return g;
  },

  // ---- old town / harbour ----
  timberhouse() {
    const g = new THREE.Group();
    const w = 4.5 + Math.random() * 2;
    const h = 5 + Math.random() * 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), M(0xe4dcc8));
    body.position.y = h / 2; g.add(body);
    const beam = M(0x5a4030);
    for (let i = 0; i < 3; i++) {           // exposed timber framing
      const b = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.22, 0.12), beam);
      b.position.set(0, 1.4 + i * 1.6, w * 0.4); g.add(b);
    }
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, 0.12), beam);
    post.position.set(0, h / 2, w * 0.4); g.add(post);
    const roof = new THREE.Mesh(cone(w * 0.8, 2.2, 4), M(0x8a4a3a));
    roof.position.y = h + 1.1; roof.rotation.y = Math.PI / 4; g.add(roof);
    return g;
  },
  well() {
    const g = new THREE.Group();
    const stone = M(0x9a958a);
    const ring = new THREE.Mesh(cylinder(0.9, 0.95, 1.0, 10), stone);
    ring.position.y = 0.5; g.add(ring);
    const wood = M(0x6b5334);
    for (const dx of [-0.8, 0.8]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), wood);
      p.position.set(dx, 1.9, 0); g.add(p);
    }
    const roof = new THREE.Mesh(cone(1.3, 0.8, 4), M(0x7a4a3a));
    roof.position.y = 3.1; roof.rotation.y = Math.PI / 4; g.add(roof);
    return g;
  },
  lantern() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(cylinder(0.06, 0.08, 2.8, 6), M(0x3a3a3a));
    post.position.y = 1.4; g.add(post);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.32), new THREE.MeshBasicMaterial({ color: 0xffdd99 }));
    glass.position.y = 3.0; g.add(glass);
    return g;
  },
  bollard() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(cylinder(0.22, 0.28, 0.7, 8), M(0x3a3f45));
    m.position.y = 0.35; g.add(m);
    const cap = new THREE.Mesh(sphere(0.24, 8, 5), M(0x3a3f45));
    cap.scale.y = 0.6; cap.position.y = 0.72; g.add(cap);
    return g;
  },
  crane() {
    const g = new THREE.Group();
    const steel = M(0xd4a03a);
    const h = 14 + Math.random() * 8;
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1), steel);
    mast.position.y = h / 2; g.add(mast);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(14, 0.7, 0.7), steel);
    jib.position.set(4, h, 0); g.add(jib);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), M(0x6a6f75));
    counter.position.set(-2.6, h, 0); g.add(counter);
    const cable = new THREE.Mesh(cylinder(0.05, 0.05, 6, 4), M(0x2a2a2a));
    cable.position.set(9, h - 3, 0); g.add(cable);
    return g;
  },

  // ---- fungal ----
  giantmushroom() {
    const g = new THREE.Group();
    const h = 2.5 + Math.random() * 3;
    const stem = new THREE.Mesh(cylinder(0.28, 0.45, h, 7), M(0xe8dcc0));
    stem.position.y = h / 2; g.add(stem);
    const capCol = [0xc04a3a, 0xa85ac0, 0xd08a3a][Math.floor(Math.random() * 3)];
    const cap = new THREE.Mesh(sphere(1.5, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(capCol));
    cap.scale.y = 0.7; cap.position.y = h; g.add(cap);
    return g;
  },
  toadstool() {
    const g = new THREE.Group();
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const h = 0.4 + Math.random() * 0.5;
      const x = (Math.random() - 0.5) * 0.9, z = (Math.random() - 0.5) * 0.9;
      const stem = new THREE.Mesh(cylinder(0.06, 0.09, h, 5), M(0xf0e8d8));
      stem.position.set(x, h / 2, z); g.add(stem);
      const cap = new THREE.Mesh(sphere(0.26, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), M(0xc03a34));
      cap.scale.y = 0.6; cap.position.set(x, h, z); g.add(cap);
    }
    return g;
  },

  // ---- machines & screens ----
  gear() {
    const g = new THREE.Group();
    const r = 1.2 + Math.random() * 1.8;
    const brass = M(0xb08a3a);
    const body = new THREE.Mesh(cylinder(r, r, 0.28, 14), brass);
    body.rotation.x = Math.PI / 2; body.position.y = r + 0.2; g.add(body);
    const teeth = 10;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.28), brass);
      t.position.set(Math.cos(a) * r, r + 0.2 + Math.sin(a) * r, 0);
      t.rotation.z = a; g.add(t);
    }
    const hub = new THREE.Mesh(cylinder(0.22, 0.22, 0.36, 8), M(0x6a5320));
    hub.rotation.x = Math.PI / 2; hub.position.y = r + 0.2; g.add(hub);
    return g;
  },
  pendulum() {
    const g = new THREE.Group();
    const brass = M(0xb08a3a);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5, 0.16), M(0x5a4a2a));
    frame.position.y = 2.5; g.add(frame);
    const arm = new THREE.Mesh(cylinder(0.05, 0.05, 3.4, 5), brass);
    arm.position.set(0, 2.9, 0); arm.rotation.z = 0.28; g.add(arm);
    const bob = new THREE.Mesh(cylinder(0.55, 0.55, 0.14, 12), brass);
    bob.rotation.x = Math.PI / 2; bob.position.set(0.95, 1.3, 0); g.add(bob);
    return g;
  },
  serverrack() {
    const g = new THREE.Group();
    const h = 2.2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 1.1), M(0x24272c));
    body.position.y = h / 2; g.add(body);
    const led = [0x35d17a, 0x4cc2ff, 0xffb648];
    for (let i = 0; i < 9; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.04),
        new THREE.MeshBasicMaterial({ color: led[Math.floor(Math.random() * led.length)] }));
      strip.position.set(0, 0.25 + i * 0.22, 0.57); g.add(strip);
    }
    return g;
  },
  cablecoil() {
    const g = new THREE.Group();
    const c = M(0x1e2126);
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(torus(0.55 - i * 0.11, 0.09, 5, 10), c);
      t.rotation.x = Math.PI / 2; t.position.y = 0.1 + i * 0.16; g.add(t);
    }
    return g;
  },
  crt() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 0.9), M(0xb8b2a0));
    shell.position.y = 0.42; g.add(shell);
    // the screen is emissive so it glows like a dead channel
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.56),
      new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x9aa6b0 : 0x6a7a88 }));
    screen.position.set(0, 0.46, 0.46); g.add(screen);
    const ant = new THREE.Mesh(cylinder(0.02, 0.02, 1.1, 4), M(0x8a8a8a));
    ant.position.set(0.2, 1.35, 0); ant.rotation.z = -0.4; g.add(ant);
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  },
  antenna() {
    const g = new THREE.Group();
    const metal = M(0x8f959b);
    const h = 7 + Math.random() * 5;
    const mast = new THREE.Mesh(cylinder(0.07, 0.12, h, 5), metal);
    mast.position.y = h / 2; g.add(mast);
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2 - i * 0.35, 0.05, 0.05), metal);
      bar.position.y = h * 0.55 + i * 0.7; g.add(bar);
    }
    return g;
  },
  blackmirror() {
    const g = new THREE.Group();
    const h = 2.6 + Math.random() * 3.4;
    const w = h * 0.62;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.16), M(0x0a0a0e));
    frame.position.y = h / 2; g.add(frame);
    // A near-black, highly reflective face: the sky and world show up in it.
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.06, metalness: 1.0 }));
    face.position.set(0, h / 2, 0.09); g.add(face);
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  },

  // ---- seasonal woodland ----
  autumntree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(cylinder(0.16, 0.24, 1.9, 6), M(0x5f4530));
    trunk.position.y = 0.95; g.add(trunk);
    const cols = [0xc4621f, 0xd89a28, 0xa8341f, 0xc48a2a];
    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(sphere(1.15 - i * 0.22, 7, 5),
        M(cols[Math.floor(Math.random() * cols.length)]));
      ball.position.set((Math.random() - 0.5) * 0.8, 2.3 + i * 0.55, (Math.random() - 0.5) * 0.8);
      g.add(ball);
    }
    return g;
  },
  fallenleaves() {
    const g = new THREE.Group();
    const cols = [0xc4621f, 0xd89a28, 0x8a4a1f];
    for (let i = 0; i < 9; i++) {
      const l = new THREE.Mesh(circle(0.16 + Math.random() * 0.12, 5),
        M(cols[Math.floor(Math.random() * cols.length)]));
      l.rotation.set(-Math.PI / 2, 0, Math.random() * 3);
      l.position.set((Math.random() - 0.5) * 2.4, 0.03, (Math.random() - 0.5) * 2.4);
      g.add(l);
    }
    return g;
  },
  snowpine() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(cylinder(0.12, 0.18, 1.1, 6), M(0x4a3a2a));
    trunk.position.y = 0.55; g.add(trunk);
    const needle = M(0x2a4a30);
    const snow = M(0xf0f6fa);
    for (let i = 0; i < 3; i++) {
      const tier = new THREE.Mesh(cone(1.1 - i * 0.26, 1.3, 7), needle);
      tier.position.y = 1.3 + i * 0.8; g.add(tier);
      const cap = new THREE.Mesh(cone(1.0 - i * 0.26, 0.45, 7), snow);
      cap.position.y = 1.75 + i * 0.8; g.add(cap);   // snow sitting on each tier
    }
    return g;
  },
  cherrytree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(cylinder(0.13, 0.2, 1.7, 6), M(0x5a4438));
    trunk.position.y = 0.85; g.add(trunk);
    const blossom = M(0xf2c2d4);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(sphere(0.85 + Math.random() * 0.3, 7, 5), blossom);
      b.scale.y = 0.75;
      const a = (i / 4) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.55, 2.1 + Math.random() * 0.5, Math.sin(a) * 0.55);
      g.add(b);
    }
    return g;
  },
  olivetree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(cylinder(0.2, 0.38, 1.4, 6), M(0x7a6a52));
    trunk.position.y = 0.7; trunk.rotation.z = (Math.random() - 0.5) * 0.25; g.add(trunk);
    const leaf = M(0x8a9c70);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(sphere(0.95, 7, 5), leaf);
      c.scale.y = 0.7;
      c.position.set((Math.random() - 0.5) * 1.1, 1.9 + Math.random() * 0.4, (Math.random() - 0.5) * 1.1);
      g.add(c);
    }
    return g;
  },

  // ---- field crops ----
  lavenderrow() {
    const g = new THREE.Group();
    const c = M(0x8a7ac4);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), c);
      b.position.set(i * 0.75 - 1.9, 0.25, 0);
      g.add(b);
    }
    return g;
  },
  sunflower() {
    const g = new THREE.Group();
    const stem = M(0x4a7a30);
    for (let i = 0; i < 5; i++) {
      const h = 1.5 + Math.random() * 0.6;
      const x = (Math.random() - 0.5) * 1.3, z = (Math.random() - 0.5) * 1.3;
      const s = new THREE.Mesh(cylinder(0.04, 0.05, h, 4), stem);
      s.position.set(x, h / 2, z); g.add(s);
      const head = new THREE.Mesh(cylinder(0.3, 0.3, 0.09, 9), M(0xe8c22a));
      head.rotation.x = Math.PI / 2.6; head.position.set(x, h + 0.1, z); g.add(head);
      const core = new THREE.Mesh(cylinder(0.14, 0.14, 0.11, 8), M(0x6a4a20));
      core.rotation.x = Math.PI / 2.6; core.position.set(x, h + 0.1, z + 0.04); g.add(core);
    }
    return g;
  },
  cornstalk() {
    const g = new THREE.Group();
    const c = M(0x7a9c3a);
    for (let i = 0; i < 6; i++) {
      const h = 1.9 + Math.random() * 0.6;
      const x = (Math.random() - 0.5) * 1.2, z = (Math.random() - 0.5) * 1.2;
      const s = new THREE.Mesh(cylinder(0.045, 0.06, h, 4), c);
      s.position.set(x, h / 2, z); g.add(s);
      for (let k = 0; k < 2; k++) {
        const leaf = new THREE.Mesh(cone(0.1, 0.9, 3), c);
        leaf.position.set(x, h * 0.6 + k * 0.35, z);
        leaf.rotation.set(0.5, k * 2.2, k ? 0.8 : -0.8);
        g.add(leaf);
      }
    }
    return g;
  },
  paddyterrace() {
    const g = new THREE.Group();
    const bund = M(0x6a5a3a);
    const water = new THREE.MeshLambertMaterial({ color: 0x8aa8b4, flatShading: true, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 3; i++) {
      const w = 7 - i * 1.2;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 3.4), water);
      pad.position.set(0, 0.5 + i * 0.7, i * 1.1); g.add(pad);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.28), bund);
      wall.position.set(0, 0.2 + i * 0.7, i * 1.1 - 1.7); g.add(wall);
    }
    return g;
  },

  // ---- works & machinery ----
  gravelpile() {
    const r = 1.2 + Math.random() * 1.6;
    const m = new THREE.Mesh(cone(r, r * 1.1, 8), M(0x9a958a));
    m.position.y = r * 0.55; return m;
  },
  quarryface() {
    const g = new THREE.Group();
    const rock = M(0xa8a396);
    for (let i = 0; i < 4; i++) {
      const h = 3 + i * 2.2;
      const step = new THREE.Mesh(new THREE.BoxGeometry(12 - i * 1.5, h, 3), rock);
      step.position.set(0, h / 2, i * 2.6); g.add(step);
    }
    return g;
  },
  excavator() {
    const g = new THREE.Group();
    const yellow = M(0xd8a82a);
    const dark = M(0x3a3f45);
    const tracks = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 1.6), dark);
    tracks.position.y = 0.4; g.add(tracks);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 1.5), yellow);
    cab.position.set(-0.4, 1.6, 0); g.add(cab);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 0.4), yellow);
    boom.position.set(1.4, 2.4, 0); boom.rotation.z = -0.5; g.add(boom);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 0.35), yellow);
    arm.position.set(3.0, 1.5, 0); arm.rotation.z = 0.7; g.add(arm);
    const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 1.0), dark);
    bucket.position.set(3.7, 0.5, 0); g.add(bucket);
    return g;
  },
  windturbine() {
    const g = new THREE.Group();
    const white = M(0xeef0f2);
    const h = 26 + Math.random() * 16;
    const tower = new THREE.Mesh(cylinder(0.5, 1.1, h, 9), white);
    tower.position.y = h / 2; g.add(tower);
    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.9), white);
    nacelle.position.y = h + 0.4; g.add(nacelle);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 13, 0.14), white);
      const a = (i / 3) * Math.PI * 2 + Math.random();
      blade.position.set(0.9, h + 0.4 + Math.sin(a) * 6.5, Math.cos(a) * 6.5);
      blade.rotation.x = -a;
      g.add(blade);
    }
    return g;
  },

  // ---- geothermal ----
  hotspring() {
    const g = new THREE.Group();
    const r = 1.6 + Math.random() * 1.6;
    const rim = new THREE.Mesh(torus(r, 0.28, 6, 12), M(0xc4a878));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.14; g.add(rim);
    const pool = new THREE.Mesh(circle(r, 14),
      new THREE.MeshLambertMaterial({ color: 0x4ac4d0, flatShading: true, transparent: true, opacity: 0.85 }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.16; g.add(pool);
    const steam = new THREE.MeshLambertMaterial({ color: 0xe4e8ea, flatShading: true, transparent: true, opacity: 0.3 });
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(sphere(0.5 + i * 0.2, 6, 5), steam);
      p.position.set((Math.random() - 0.5) * 0.8, 0.9 + i * 0.8, (Math.random() - 0.5) * 0.8);
      g.add(p);
    }
    return g;
  },
  mudpot() {
    const g = new THREE.Group();
    const mud = M(0x6a5a48);
    const bowl = new THREE.Mesh(cylinder(0.9, 0.6, 0.35, 9), mud);
    bowl.position.y = 0.18; g.add(bowl);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(sphere(0.18 + Math.random() * 0.14, 6, 5), M(0x7d6a52));
      b.position.set((Math.random() - 0.5) * 0.7, 0.4, (Math.random() - 0.5) * 0.7);
      g.add(b);
    }
    return g;
  },

  // ---- fjord ----
  fjordcliff() {
    const g = new THREE.Group();
    const h = 26 + Math.random() * 24;
    const rock = M(0x6a6f6a);
    const face = new THREE.Mesh(new THREE.BoxGeometry(16, h, 9), rock);
    face.position.y = h / 2; face.rotation.y = (Math.random() - 0.5) * 0.4; g.add(face);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(15, 1.2, 8), M(0x4f6b3c));
    cap.position.y = h; cap.rotation.y = face.rotation.y; g.add(cap);
    return g;
  },
  waterfall() {
    const g = new THREE.Group();
    const h = 14 + Math.random() * 14;
    const water = new THREE.MeshLambertMaterial({ color: 0xdcecf4, flatShading: true, transparent: true, opacity: 0.72 });
    const fall = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 0.35), water);
    fall.position.y = h / 2; g.add(fall);
    const pool = new THREE.Mesh(circle(2.2, 12), water);
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; g.add(pool);
    return g;
  },
  boathouse() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 4.4), M(0xa8422f));
    body.position.y = 1.2; g.add(body);
    const roof = new THREE.Mesh(cylinder(2.3, 2.3, 4.6, 3), M(0x5a4a3a));
    roof.rotation.set(Math.PI / 2, Math.PI, 0); roof.position.y = 3.0; g.add(roof);
    const jetty = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 3.4), M(0x8a7050));
    jetty.position.set(0, 0.5, 3.8); g.add(jetty);
    return g;
  },

  // ---- antiquity ----
  column() {
    const g = new THREE.Group();
    const h = 3 + Math.random() * 3.5;
    const stone = M(0xd8d0b8);
    const shaft = new THREE.Mesh(cylinder(0.34, 0.4, h, 10), stone);
    shaft.position.y = h / 2 + 0.2; g.add(shaft);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.1), stone);
    base.position.y = 0.2; g.add(base);
    if (Math.random() < 0.6) {                 // some still carry a capital
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 1.0), stone);
      cap.position.y = h + 0.55; g.add(cap);
    }
    g.rotation.z = (Math.random() - 0.5) * 0.1;
    return g;
  },
  rubble() {
    const g = new THREE.Group();
    const stone = M(0xc0b89c);
    for (let i = 0; i < 6; i++) {
      const s = 0.25 + Math.random() * 0.5;
      const b = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s * 0.9), stone);
      b.position.set((Math.random() - 0.5) * 2, s * 0.35, (Math.random() - 0.5) * 2);
      b.rotation.set(Math.random() * 0.4, Math.random() * 3, Math.random() * 0.4);
      g.add(b);
    }
    return g;
  },
  brokenarch() {
    const g = new THREE.Group();
    const stone = M(0xd0c8b0);
    for (const dx of [-1.8, 1.8]) {
      const h = dx < 0 ? 4.5 : 3.2;           // one side collapsed lower
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.9), stone);
      p.position.set(dx, h / 2, 0); g.add(p);
    }
    const span = new THREE.Mesh(torus(1.8, 0.42, 5, 9, Math.PI * 0.62), stone);
    span.position.set(-0.3, 4.5, 0); span.rotation.z = 0.4; g.add(span);
    return g;
  },
  torii() {
    const g = new THREE.Group();
    const red = M(0xc0392b);
    for (const dx of [-1.5, 1.5]) {
      const p = new THREE.Mesh(cylinder(0.18, 0.22, 4.2, 8), red);
      p.position.set(dx, 2.1, 0); g.add(p);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 0.4), red);
    lintel.position.y = 3.6; g.add(lintel);
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.34, 0.5), red);
    top.position.y = 4.25; g.add(top);
    return g;
  },
  pagoda() {
    const g = new THREE.Group();
    const wall = M(0xd8ccb4);
    const roof = M(0x8a3a30);
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const w = 3.4 - i * 0.6;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, w), wall);
      body.position.y = y + 0.8; g.add(body);
      const r = new THREE.Mesh(cone(w * 0.95, 0.8, 4), roof);
      r.position.y = y + 2.0; r.rotation.y = Math.PI / 4; g.add(r);
      y += 2.2;
    }
    return g;
  },

  // ---- airfield ----
  hangar() {
    const g = new THREE.Group();
    const shell = M(0xa8adb2);
    const body = new THREE.Mesh(cylinder(6, 6, 14, 12, 1, false, 0, Math.PI), shell);
    body.rotation.z = Math.PI / 2; body.rotation.y = Math.PI / 2; g.add(body);
    const back = new THREE.Mesh(circle(6, 12, 0, Math.PI), M(0x8a9096));
    back.position.z = -7; back.rotation.z = 0; g.add(back);
    return g;
  },
  windsock() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(cylinder(0.06, 0.09, 4.2, 6), M(0x9aa0a6));
    pole.position.y = 2.1; g.add(pole);
    const sock = new THREE.Mesh(cylinder(0.45, 0.22, 1.8, 8, 1, true), M(0xe86a1f));
    sock.rotation.z = Math.PI / 2; sock.position.set(1.0, 4.0, 0); g.add(sock);
    return g;
  },
  runwaylight() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(cylinder(0.05, 0.06, 0.5, 5), M(0x6a6f75));
    post.position.y = 0.25; g.add(post);
    const lamp = new THREE.Mesh(sphere(0.13, 6, 5),
      new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x4cc2ff : 0xffd24a }));
    lamp.position.y = 0.55; g.add(lamp);
    return g;
  },

  // ---- bone, paper, chess ----
  femur() {
    const g = new THREE.Group();
    const bone = M(0xe8dcc4);
    const shaft = new THREE.Mesh(cylinder(0.11, 0.11, 1.5, 6), bone);
    shaft.rotation.z = Math.PI / 2; shaft.position.y = 0.14; g.add(shaft);
    for (const dx of [-0.78, 0.78]) {
      const knob = new THREE.Mesh(sphere(0.2, 6, 5), bone);
      knob.position.set(dx, 0.16, 0); g.add(knob);
    }
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  },
  papercrane() {
    const g = new THREE.Group();
    const paper = new THREE.MeshLambertMaterial({ color: 0xf4f0e8, flatShading: true, side: THREE.DoubleSide });
    const body = new THREE.Mesh(cone(0.4, 0.9, 4), paper);
    body.rotation.z = Math.PI / 2; body.position.y = 0.5; g.add(body);
    for (const s of [1, -1]) {
      const wing = new THREE.Mesh(cone(0.34, 1.2, 3), paper);
      wing.position.set(0, 0.72, s * 0.32);
      wing.rotation.set(s * 1.1, 0, Math.PI / 2.2);
      g.add(wing);
    }
    const neck = new THREE.Mesh(cone(0.1, 0.7, 4), paper);
    neck.position.set(0.55, 0.85, 0); neck.rotation.z = -0.9; g.add(neck);
    return g;
  },
  paperfold() {
    const g = new THREE.Group();
    const paper = new THREE.MeshLambertMaterial({ color: 0xeae4d8, flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(cone(0.45 + Math.random() * 0.3, 0.9, 4), paper);
      p.position.set((Math.random() - 0.5) * 1.2, 0.45, (Math.random() - 0.5) * 1.2);
      p.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * 3, (Math.random() - 0.5) * 0.5);
      g.add(p);
    }
    return g;
  },
  chesspawn() {
    const g = new THREE.Group();
    const mat = M(Math.random() < 0.5 ? 0xf0ece4 : 0x24242a);
    const base = new THREE.Mesh(cylinder(0.55, 0.75, 0.3, 12), mat);
    base.position.y = 0.15; g.add(base);
    const body = new THREE.Mesh(cylinder(0.22, 0.45, 1.3, 12), mat);
    body.position.y = 1.0; g.add(body);
    const head = new THREE.Mesh(sphere(0.36, 10, 7), mat);
    head.position.y = 1.9; g.add(head);
    return g;
  },
  chessrook() {
    const g = new THREE.Group();
    const mat = M(Math.random() < 0.5 ? 0xf0ece4 : 0x24242a);
    const base = new THREE.Mesh(cylinder(0.7, 0.9, 0.35, 12), mat);
    base.position.y = 0.18; g.add(base);
    const body = new THREE.Mesh(cylinder(0.6, 0.7, 1.9, 12), mat);
    body.position.y = 1.3; g.add(body);
    for (let i = 0; i < 5; i++) {              // crenellations
      const a = (i / 5) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.4, 0.24), mat);
      c.position.set(Math.cos(a) * 0.46, 2.45, Math.sin(a) * 0.46);
      g.add(c);
    }
    return g;
  }
};

// Every prop type a biome may reference. buildArtifacts skips unknown types
// silently, so scripts/biometest.mjs checks biome data against this list.
export const ARTIFACT_TYPES = Object.keys(builders);
export function buildArtifact(type) { return builders[type] ? builders[type]() : null; }

// ---- landmarks: named points along a route (enriched GPX routes) ----------
// Every landmark gets a labelled signpost by the road; some kinds add a bigger
// prop further off-side so the real-world feature reads at riding speed.

function labelBoard(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1d3b2a'; ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34, 240); // maxWidth squeezes long labels to fit
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
}

const landmarkProps = {
  town() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const house = new THREE.Group();
      const w = 3 + Math.random() * 2;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, w), M(0xcbb8a0));
      body.position.y = 1.3; house.add(body);
      const roof = new THREE.Mesh(cone(w * 0.85, 1.6, 4), M(0x8a4a3a));
      roof.position.y = 3.4; roof.rotation.y = Math.PI / 4; house.add(roof);
      house.position.set((i - 1) * (w + 2), 0, (Math.random() - 0.5) * 6);
      g.add(house);
    }
    return g;
  },
  peak() {
    const m = new THREE.Mesh(cone(28, 45, 7), M(0x8a8a92));
    m.position.y = 22.5; return m;
  },
  water() {
    const m = new THREE.Mesh(circle(30, 24), M(0x3a6f9c));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05; return m;
  },
  church() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 7), M(0xd8d2c4));
    body.position.y = 2; g.add(body);
    const steeple = new THREE.Mesh(cone(1.4, 4, 6), M(0x5a4a3a));
    steeple.position.set(0, 6, 2.4); g.add(steeple);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), M(0xf2e8c8));
    crossV.position.set(0, 8.5, 2.4); g.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), M(0xf2e8c8));
    crossH.position.set(0, 8.7, 2.4); g.add(crossH);
    return g;
  },
  bridge() {
    // Portal frame over the road at the landmark itself (not off-side).
    const g = new THREE.Group();
    const grey = M(0x6f6a64);
    for (const s of [1, -1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8), grey);
      pillar.position.set(s * 3.4, 2.5, 0); g.add(pillar);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.7, 1.2), grey);
    beam.position.y = 5.1; g.add(beam);
    return g;
  }
};

export function buildLandmarks(profile) {
  const root = new THREE.Group();
  for (const lm of profile.landmarks || []) {
    const st = profileAt(profile, lm.at);
    const latX = -Math.sin(st.heading), latZ = Math.cos(st.heading);
    // Board normal faces back along the direction of travel, so it reads on
    // approach; the profile heading already flips for reverse rides.
    const faceRider = -(st.heading + Math.PI / 2);

    const sign = new THREE.Group();
    const post = new THREE.Mesh(cylinder(0.06, 0.06, 2.4, 6), M(0x8a8a8a));
    post.position.y = 1.2; sign.add(post);
    const board = labelBoard(lm.label);
    board.position.y = 2.1; sign.add(board);
    sign.position.set(st.x - latX * 6, st.y, st.z - latZ * 6);
    sign.rotation.y = faceRider;
    root.add(sign);

    const buildProp = landmarkProps[lm.kind];
    if (buildProp) {
      const prop = buildProp();
      const off = lm.kind === 'bridge' ? 0 : (lm.kind === 'peak' ? 60 : 25);
      prop.position.set(st.x - latX * off, st.y, st.z - latZ * off);
      prop.rotation.y = faceRider;
      prop.traverse((o) => { if (o.isMesh && lm.kind !== 'water') o.castShadow = true; });
      root.add(prop);
    }
  }
  return root;
}

export function buildArtifacts(profile) {
  const root = new THREE.Group();
  const total = profile.totalLength;
  let count = 0;
  const STEP = 4;

  // Scale densities so long routes scatter props evenly to the end instead of
  // exhausting the MAX_ARTIFACTS budget in the first kilometres.
  let expected = 0;
  for (const seg of profile.segments) {
    const b = BIOMES[seg.biome] || BIOMES.mojave;
    expected += (seg.length / 100) * 2 * b.artifacts.reduce((t, a) => t + a.density, 0);
  }
  const scale = Math.min(1, MAX_ARTIFACTS / Math.max(1, expected));

  for (let s = 6; s < total && count < MAX_ARTIFACTS; s += STEP) {
    const st = profileAt(profile, s);
    const biome = BIOMES[st.biomeId] || BIOMES.mojave;
    const lateralX = -Math.sin(st.heading);
    const lateralZ = Math.cos(st.heading);
    for (const a of biome.artifacts) {
      const pPerWindow = a.density * scale * (STEP / 100);
      for (const side of [1, -1]) {
        if (Math.random() >= pPerWindow || count >= MAX_ARTIFACTS) continue;
        const build = builders[a.type];
        if (!build) continue;
        const obj = build();
        obj.rotation.y = Math.random() * Math.PI * 2;
        obj.scale.setScalar(0.8 + Math.random() * 0.7);

        // Spread by size: a headstone or a fern scattered 90 m out is an
        // invisible speck, while a mesa needs the distance to read. Measuring
        // the built prop means new artifact types place themselves sensibly
        // without a per-type tuning table.
        let unit = _heightByType.get(a.type);
        if (unit === undefined) {
          obj.updateMatrixWorld(true);
          _box.setFromObject(obj);
          unit = Math.max(0.3, (_box.max.y - _box.min.y) / (obj.scale.y || 1));
          _heightByType.set(a.type, unit);
        }
        const height = unit * obj.scale.y;
        const maxOffset = Math.min(85, 8 + height * 9);
        const offset = 7 + Math.pow(Math.random(), 1.5) * maxOffset;

        obj.position.set(
          st.x + lateralX * offset * side,
          st.y,
          st.z + lateralZ * offset * side
        );
        obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        root.add(obj);
        count++;
      }
    }
  }
  return root;
}
