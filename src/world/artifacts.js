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
  }
};

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
