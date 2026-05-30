// Roadside artifacts. Each biome lists artifact types + densities (items per
// 100 m per side); we scan the route and scatter low-poly props accordingly.

import * as THREE from 'three';
import { profileAt } from '../routes/virtualRoute.js';
import { BIOMES } from '../routes/biomes.js';

const MAX_ARTIFACTS = 700;

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
  }
};

export function buildArtifacts(profile) {
  const root = new THREE.Group();
  const total = profile.totalLength;
  let count = 0;
  const STEP = 4;

  for (let s = 6; s < total && count < MAX_ARTIFACTS; s += STEP) {
    const st = profileAt(profile, s);
    const biome = BIOMES[st.biomeId] || BIOMES.mojave;
    const lateralX = -Math.sin(st.heading);
    const lateralZ = Math.cos(st.heading);
    for (const a of biome.artifacts) {
      const pPerWindow = a.density * (STEP / 100);
      for (const side of [1, -1]) {
        if (Math.random() >= pPerWindow || count >= MAX_ARTIFACTS) continue;
        const build = builders[a.type];
        if (!build) continue;
        const offset = 7 + Math.pow(Math.random(), 1.5) * 85;
        const obj = build();
        obj.position.set(
          st.x + lateralX * offset * side,
          st.y,
          st.z + lateralZ * offset * side
        );
        obj.rotation.y = Math.random() * Math.PI * 2;
        const sc = 0.8 + Math.random() * 0.7;
        obj.scale.setScalar(sc);
        obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        root.add(obj);
        count++;
      }
    }
  }
  return root;
}
