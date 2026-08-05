// Roadside artifacts. Each biome lists artifact types + densities (items per
// 100 m per side); we scan the route and scatter low-poly props accordingly.

import * as THREE from 'three';
import { profileAt } from '../routes/virtualRoute.js';
import { BIOMES } from '../routes/biomes.js';

const MAX_ARTIFACTS = 700;
const _box = new THREE.Box3(); // reused while measuring props for placement

const M = (c, opts = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...opts });

// --- builders: each returns an Object3D whose base sits at y = 0 ---
const builders = {
  cactus() {
    const g = new THREE.Group();
    const body = M(0x4f7a3a);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 7), body);
    trunk.position.y = 1.1; g.add(trunk);
    for (const s of [1, -1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.9, 6), body);
      arm.position.set(s * 0.3, 1.3, 0); arm.rotation.z = s * 0.9; g.add(arm);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.5, 6), body);
      up.position.set(s * 0.5, 1.7, 0); g.add(up);
    }
    return g;
  },
  rock() {
    const r = 0.5 + Math.random() * 0.8;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M(0x7a736a));
    m.position.y = r * 0.6; return m;
  },
  skull() {
    const g = new THREE.Group();
    const s = M(0xe8e2d0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), s);
    skull.position.y = 0.18; g.add(skull);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 5), s);
    horn.position.set(0.18, 0.3, 0); horn.rotation.z = -1.1; g.add(horn);
    const horn2 = horn.clone(); horn2.position.x = -0.18; horn2.rotation.z = 1.1; g.add(horn2);
    return g;
  },
  tumbleweed() {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshLambertMaterial({ color: 0x9c7a3a, wireframe: true }));
    m.position.y = 0.45; return m;
  },
  roadsign() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), M(0x8a8a8a));
    post.position.y = 1.2; g.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), M(0xf2c14e));
    board.position.y = 2.0; g.add(board);
    return g;
  },
  shrub() {
    const g = new THREE.Group();
    const c = M(0x6f8a3a);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.15, 6, 5), c);
      b.position.set((Math.random() - 0.5) * 0.4, 0.25, (Math.random() - 0.5) * 0.4);
      g.add(b);
    }
    return g;
  },
  pine() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.0, 6), M(0x5a3a22));
    trunk.position.y = 0.5; g.add(trunk);
    const foliage = M(0x2f5a2a);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.25, 1.2, 7), foliage);
      cone.position.y = 1.2 + i * 0.7; g.add(cone);
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
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0xff3ce0 }));
    m.position.y = 0.9; return m;
  },
  neonring() {
    const r = 1.6 + Math.random() * 1.8;
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.11, 6, 16),
      new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x00ffd0 : 0xff2fb0 }));
    m.position.y = r + 0.3; m.rotation.y = Math.random() * Math.PI; return m;
  },
  deciduous() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6), M(0x6b4a2a));
    trunk.position.y = 0.8; g.add(trunk);
    const leaf = M(0x4d7a35);
    for (let i = 0; i < 2; i++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9 - i * 0.25, 7, 6), leaf);
      ball.position.set((Math.random() - 0.5) * 0.5, 1.9 + i * 0.6, (Math.random() - 0.5) * 0.5);
      g.add(ball);
    }
    return g;
  },
  haybale() {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10), M(0xd2b04a));
    m.rotation.z = Math.PI / 2; m.position.y = 0.6; return m;
  },
  barn() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 7), M(0x9c3a2e));
    body.position.y = 1.5; g.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 7.2, 3), M(0x5a3a30));
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
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 6), metal);
    pole.position.y = 2.25; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), metal);
    arm.position.set(0.45, 4.4, 0); g.add(arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
    lamp.position.set(0.85, 4.35, 0); g.add(lamp);
    return g;
  },
  reeds() {
    const g = new THREE.Group();
    const c = M(0x5f7a3f);
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 1.2 + Math.random() * 0.6, 4), c);
      blade.position.set((Math.random() - 0.5) * 0.5, 0.7, (Math.random() - 0.5) * 0.5);
      g.add(blade);
    }
    return g;
  },

  // ---- coastal ----
  palm() {
    const g = new THREE.Group();
    const lean = (Math.random() - 0.5) * 0.3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 5.5, 6), M(0x9c7b52));
    trunk.position.y = 2.75; trunk.rotation.z = lean; g.add(trunk);
    const frond = M(0x3f7a3a);
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.6, 4), frond);
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
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.7 + Math.random() * 0.5, 3), c);
      b.position.set((Math.random() - 0.5) * 0.7, 0.4, (Math.random() - 0.5) * 0.7);
      b.rotation.z = (Math.random() - 0.5) * 0.7;
      g.add(b);
    }
    return g;
  },
  driftwood() {
    const g = new THREE.Group();
    const w = M(0xb8ad98);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.4, 5), w);
    log.rotation.set(0, Math.random() * 3, Math.PI / 2 + (Math.random() - 0.5) * 0.3);
    log.position.y = 0.2; g.add(log);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 4), w);
    branch.position.set(0.5, 0.45, 0.2); branch.rotation.z = 0.9; g.add(branch);
    return g;
  },

  // ---- cold ----
  snowdrift() {
    const r = 0.7 + Math.random() * 1.1;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), M(0xf2f6fa));
    m.scale.y = 0.42; m.position.y = r * 0.2; return m;
  },
  icespike() {
    const g = new THREE.Group();
    const ice = new THREE.MeshLambertMaterial({ color: 0xbfe4f0, flatShading: true, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 3; i++) {
      const h = 1.2 + Math.random() * 1.8;
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.22, h, 5), ice);
      s.position.set((Math.random() - 0.5) * 0.8, h / 2, (Math.random() - 0.5) * 0.8);
      s.rotation.z = (Math.random() - 0.5) * 0.25;
      g.add(s);
    }
    return g;
  },
  deadtree() {
    const g = new THREE.Group();
    const w = M(0x6a5a4a);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 3.4, 5), w);
    trunk.position.y = 1.7; g.add(trunk);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 1.3, 4), w);
      const a = Math.random() * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.45, 2.2 + Math.random() * 0.9, Math.sin(a) * 0.45);
      b.rotation.set(0, -a, 0.9 + Math.random() * 0.3);
      g.add(b);
    }
    return g;
  },
  boulder() {
    const r = 0.9 + Math.random() * 1.4;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M(0x8a857c));
    m.rotation.set(Math.random(), Math.random(), Math.random());
    m.position.y = r * 0.55; return m;
  },

  // ---- tropical ----
  jungletree() {
    const g = new THREE.Group();
    const h = 5 + Math.random() * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, h, 6), M(0x5a4630));
    trunk.position.y = h / 2; g.add(trunk);
    const leaf = M(0x2f6b2a);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(1.5 - i * 0.3, 7, 5), leaf);
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
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.5, 3), c);
      f.position.set(Math.cos(a) * 0.35, 0.7, Math.sin(a) * 0.35);
      f.rotation.set(0.65, -a, 0);
      g.add(f);
    }
    return g;
  },
  acacia() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 3.2, 6), M(0x6b5334));
    trunk.position.y = 1.6; g.add(trunk);
    // the flat-topped umbrella crown
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.4, 0.7, 8), M(0x6b8a3a));
    crown.position.y = 3.6; g.add(crown);
    return g;
  },
  grasstuft() {
    const g = new THREE.Group();
    const c = M(0xc4b06a);
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9 + Math.random() * 0.7, 3), c);
      b.position.set((Math.random() - 0.5) * 0.8, 0.5, (Math.random() - 0.5) * 0.8);
      b.rotation.z = (Math.random() - 0.5) * 0.5;
      g.add(b);
    }
    return g;
  },
  termitemound() {
    const h = 1.6 + Math.random() * 1.4;
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.55, h, 6), M(0xa06a42));
    m.position.y = h / 2; return m;
  },

  // ---- volcanic ----
  lavarock() {
    const r = 0.4 + Math.random() * 0.7;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M(0x2b2422));
    m.rotation.set(Math.random(), Math.random(), Math.random());
    m.position.y = r * 0.5; return m;
  },
  steamvent() {
    const g = new THREE.Group();
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 0.6, 7), M(0x3a302e));
    vent.position.y = 0.3; g.add(vent);
    const steam = new THREE.MeshLambertMaterial({ color: 0xdcd6d0, flatShading: true, transparent: true, opacity: 0.4 });
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.42 + i * 0.16, 6, 5), steam);
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
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.14, 5, 4), c);
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
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.65, h, 7), M(0x2f4a2a));
    body.position.y = h / 2; g.add(body);
    return g;
  },
  villa() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 5), M(0xd8c8a0));
    body.position.y = 2; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 1.8, 4), M(0xa05a3a));
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
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 9, 7), M(0x9c5a4a));
      stack.position.set(i * 3 - 1.5, 7.5, -2.5); g.add(stack);
    }
    return g;
  },
  house() {
    const g = new THREE.Group();
    const w = 5 + Math.random() * 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 3, w * 0.8), M(0xcfc4b2));
    body.position.y = 1.5; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 1.9, 4), M(0x7a4a3a));
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
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7 + Math.random() * 0.5, 1.0 + Math.random() * 0.6, h, 6), M(0xa8552f));
    m.position.y = h / 2; m.rotation.y = Math.random() * 3; return m;
  },
  mesa() {
    const g = new THREE.Group();
    const h = 12 + Math.random() * 14;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, h, 7), M(0x9c4a2a));
    base.position.y = h / 2; g.add(base);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 1.6, 7), M(0xb06a42));
    cap.position.y = h + 0.8; g.add(cap);
    return g;
  },

  // ---- swamp ----
  cypresstree() {
    const g = new THREE.Group();
    const h = 4.5 + Math.random() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.75, h, 7), M(0x5f4f3a));
    trunk.position.y = h / 2; g.add(trunk);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.7, 7, 5), M(0x4a6b40));
    canopy.scale.y = 0.55; canopy.position.y = h + 0.5; g.add(canopy);
    // hanging moss
    const moss = new THREE.MeshLambertMaterial({ color: 0x8a9c70, flatShading: true, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.4, 4), moss);
      m.position.set(Math.cos(a) * 1.2, h - 0.2, Math.sin(a) * 1.2);
      g.add(m);
    }
    return g;
  },
  lilypad() {
    const g = new THREE.Group();
    const c = M(0x4a7a44);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.25, 7), c);
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
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.325, 0.325, 0.14, 8, 1, false, 0, Math.PI), s);
    top.rotation.set(Math.PI / 2, 0, 0); top.position.y = 0.95; g.add(top);
    g.rotation.z = (Math.random() - 0.5) * 0.16; // settled crooked
    return g;
  },
  crypt() {
    const g = new THREE.Group();
    const s = M(0x8f8b82);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.8, 3.6), s);
    body.position.y = 1.4; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), s);
    roof.position.y = 3.4; roof.rotation.y = Math.PI / 4; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.12), M(0x3a352f));
    door.position.set(0, 0.85, 1.82); g.add(door);
    return g;
  },
  ironfence() {
    const g = new THREE.Group();
    const iron = M(0x2f3238);
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 4), iron);
      bar.position.set(i * 0.38 - 0.95, 0.75, 0); g.add(bar);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 4), iron);
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
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.55, h, 4), mat);
    shaft.position.y = h / 2; g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 4), mat);
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
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, h, 7), mat);
    body.position.y = h / 2; g.add(body);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.62, 7, 5), mat);
    bulb.position.y = h; g.add(bulb);
    return g;
  },
  eyestalk() {
    const g = new THREE.Group();
    const h = 1.8 + Math.random() * 1.8;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, h, 6), M(0x8a4a48));
    stalk.position.y = h / 2; g.add(stalk);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), M(0xf0e6d8));
    ball.position.y = h + 0.2; g.add(ball);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 5), new THREE.MeshBasicMaterial({ color: 0x1a0a0a }));
    iris.position.set(0, h + 0.2, 0.28); g.add(iris);
    return g;
  },
  ribarch() {
    const g = new THREE.Group();
    const bone = M(0xe4d8c4);
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.35, 0.16, 5, 9, Math.PI), bone);
      rib.position.set(0, 0, i * 0.9 - 1.4);
      g.add(rib);
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
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, 1.6, 4), M(0x8a4a3a));
      roof.position.y = 3.4; roof.rotation.y = Math.PI / 4; house.add(roof);
      house.position.set((i - 1) * (w + 2), 0, (Math.random() - 0.5) * 6);
      g.add(house);
    }
    return g;
  },
  peak() {
    const m = new THREE.Mesh(new THREE.ConeGeometry(28, 45, 7), M(0x8a8a92));
    m.position.y = 22.5; return m;
  },
  water() {
    const m = new THREE.Mesh(new THREE.CircleGeometry(30, 24), M(0x3a6f9c));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05; return m;
  },
  church() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 7), M(0xd8d2c4));
    body.position.y = 2; g.add(body);
    const steeple = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4, 6), M(0x5a4a3a));
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
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), M(0x8a8a8a));
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
        obj.updateMatrixWorld(true);
        _box.setFromObject(obj);
        const height = Math.max(0.3, _box.max.y - _box.min.y);
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
