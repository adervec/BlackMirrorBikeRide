// The 3D world. Builds a road ribbon + rolling terrain from the route profile,
// a gradient sky dome with biome fog, scatters artifacts, places the rider
// avatar, and drives the camera rig. Chunky but lit — OG-Xbox tier: shadows,
// PBR-ish materials, tone-mapped, full-res.

import * as THREE from 'three';
import { profileAt } from '../routes/virtualRoute.js';
import { SURFACES, DEFAULT_SURFACE } from '../physics/surfaces.js';
import { BIOMES } from '../routes/biomes.js';
import { SKYBOXES, DEFAULT_SKYBOX } from '../routes/skyboxes.js';
import { buildAvatar } from './avatar.js';
import { buildArtifacts, buildLandmarks } from './artifacts.js';
import { CameraRig } from './cameras.js';
import { getState } from '../state.js';
import { resolveQuality } from './quality.js';
import { gradientEnvironment, applyAnisotropy, maxAnisotropyFor, makeBloomComposer } from './gfx.js';
import { surfaceTexture, groundTexture } from './textures.js';

const ROAD_HALF = 2.6;        // metres each side of centreline
// Lateral distances of the terrain strips, in metres each side of the road.
// Dense near the rider (where you actually look) and reaching far enough out
// that the outer edge is buried in fog — at the old 220 m limit the ground
// simply stopped in plain sight, showing sky through the gap.
const TERRAIN_OFFSETS = [
  -760, -500, -320, -205, -132, -84, -54, -34, -20, -9,
  9, 20, 34, 54, 84, 132, 205, 320, 500, 760,
];
const TERRAIN_FAR = 760;
// The profile carries a point every 4 m, which is what the road ribbon needs.
// The terrain does not: it is smooth undulation stretching 760 m out, so it
// samples every Nth point instead. At 20 strips the 4 m spacing meant ~2.3M
// indices on an 80 km route and a ~13 s scene build.
const TERRAIN_STEP = 3;
const TEX_M = 2.4;            // metres per road-texture tile
const TERRAIN_TEX_M = 9;      // metres per ground-texture tile

export class WorldScene {
  constructor(container) {
    this.container = container;
    this.q = resolveQuality(getState().settings.graphicsQuality);
    this.renderer = new THREE.WebGLRenderer({ antialias: this.q.antialias !== false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatioCap));
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);
    this.renderer.shadowMap.enabled = this.q.shadows !== false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);
    this.composer = null;   // bloom post-processing chain (when quality enables it)
    this.envTex = null;     // PMREM environment map (image-based lighting)

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 6000);
    this.rig = new CameraRig();
    this.clock = new THREE.Clock();

    this._dynamic = [];   // per-frame animated specials
    this.forceHideAvatar = false; // preview mode hides the rider entirely
    this.sun = null;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  setHideAvatar(v) { this.forceHideAvatar = !!v; }

  // view = { rider, bike, player, decals, skyboxDef }
  build(profile, route, view) {
    this.dispose(false);
    this.profile = profile;
    this.scene = new THREE.Scene();
    this._dynamic = [];

    const sky = view.skyboxDef || SKYBOXES[route.skybox] || SKYBOXES[DEFAULT_SKYBOX];
    this._buildSky(sky);
    // Image-based lighting from the sky gradient: PBR materials pick up realistic
    // ambient + reflections (especially metallic / clearcoat bike paint).
    if (this.q.env) {
      this.envTex = gradientEnvironment(this.renderer, sky.top, sky.bottom);
      this.scene.environment = this.envTex;
    }
    this._buildLights(sky);
    this.scene.fog = new THREE.FogExp2(this._biomeFog(profile), this._biomeFogDensity(profile));

    this._buildTerrain(profile);
    this._buildRoad(profile);
    this._maybeGrid(profile);

    this.scene.add(buildArtifacts(profile));
    if (profile.landmarks?.length) this.scene.add(buildLandmarks(profile));

    this.avatar = buildAvatar({ rider: view.rider, bike: view.bike, player: view.player, decals: view.decals || [] });
    this.scene.add(this.avatar.group);

    this._buildSkySpecials(sky);

    // Sharpen every texture in the freshly-built scene.
    applyAnisotropy(this.scene, maxAnisotropyFor(this.renderer, this.q));

    // Bloom post-processing. The scene is recreated each build(), so the composer
    // (which holds a RenderPass bound to scene+camera) is rebuilt alongside it.
    if (this.q.bloom) {
      this.composer = makeBloomComposer(
        this.renderer, this.scene, this.camera, this.q,
        this.container.clientWidth, this.container.clientHeight
      );
    }
  }

  _biomeFog(profile) {
    const b = BIOMES[profile.points[0]?.biomeId] || BIOMES.mojave;
    return b.fog;
  }
  _biomeFogDensity(profile) {
    const b = BIOMES[profile.points[0]?.biomeId] || BIOMES.mojave;
    return b.fogDensity;
  }

  _buildSky(sky) {
    const geo = new THREE.SphereGeometry(4000, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(sky.top) },
        bottom: { value: new THREE.Color(sky.bottom) }
      },
      vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 bottom;
        void main(){ float h = normalize(vPos).y; gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.15, 0.65, h)), 1.0); }`
    });
    this.scene.add(new THREE.Mesh(geo, mat));
    this.renderer.setClearColor(new THREE.Color(sky.bottom));
  }

  _buildLights(sky) {
    const hemi = new THREE.HemisphereLight(sky.top, 0x6b5a3a, (sky.ambientIntensity ?? 0.6));
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(sky.sun, sky.sunIntensity ?? 1.0);
    this._sunDir = new THREE.Vector3(...(sky.sunPos || [0.5, 0.8, 0.2])).normalize();
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.q.shadowMapSize, this.q.shadowMapSize);
    // Tight ortho frustum that we keep centred on the rider each frame, so we
    // get crisp contact shadows without trying to shadow the whole route.
    const d = 22;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.scene.add(new THREE.AmbientLight(sky.ambient ?? 0x404040, 0.35));
  }

  _moveSun(center) {
    if (!this.sun) return;
    const off = this._sunDir.clone().multiplyScalar(60);
    this.sun.position.set(center.x + off.x, center.y + off.y, center.z + off.z);
    this.sun.target.position.set(center.x, center.y, center.z);
  }

  _buildRoad(profile) {
    const pts = profile.points;
    const n = pts.length;
    const positions = new Float32Array(n * 2 * 3);
    const colors = new Float32Array(n * 2 * 3);
    const uvs = new Float32Array(n * 2 * 2);
    const tmp = new THREE.Color();
    // One texture tile every TEX_M metres, in both directions, so the grain is
    // the same physical size across the road as it is along it.
    const uRight = (ROAD_HALF * 2) / TEX_M;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const latX = -Math.sin(p.heading), latZ = Math.cos(p.heading);
      const lx = p.x + latX * ROAD_HALF, lz = p.z + latZ * ROAD_HALF;
      const rx = p.x - latX * ROAD_HALF, rz = p.z - latZ * ROAD_HALF;
      const y = p.y + 0.06;
      positions.set([lx, y, lz, rx, y, rz], i * 6);
      const v = p.s / TEX_M;
      uvs.set([0, v, uRight, v], i * 4);
      const surf = SURFACES[p.surfaceId] || SURFACES[DEFAULT_SURFACE];
      tmp.set(surf.color);
      // subtle per-vertex dither for the rough look
      const d = 1 + (Math.random() - 0.5) * surf.rough * 0.4;
      colors.set([tmp.r * d, tmp.g * d, tmp.b * d, tmp.r * d, tmp.g * d, tmp.b * d], i * 6);
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, dd = (i + 1) * 2 + 1;
      idx.push(a, c, b, b, c, dd);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    // Cobbles have to actually look like cobbles, so each run of a surface gets
    // its own draw group + material rather than one texture tinted per-vertex.
    // Runs are contiguous, so a typical route is a handful of groups.
    const mats = [];
    const matIndex = new Map();
    const materialFor = (surfaceId) => {
      if (matIndex.has(surfaceId)) return matIndex.get(surfaceId);
      const surf = SURFACES[surfaceId] || SURFACES[DEFAULT_SURFACE];
      mats.push(new THREE.MeshStandardMaterial({
        map: surfaceTexture(surfaceId),
        vertexColors: true,
        // Stay diffuse. The scene has an image-based-lighting environment map,
        // so anything glossy mirrors the sky and turns the road blue — keep this
        // near the original 0.95 and let the texture carry the detail instead.
        roughness: 0.88 + surf.rough * 0.1,
        metalness: 0.0,
        flatShading: true,
      }));
      matIndex.set(surfaceId, mats.length - 1);
      return mats.length - 1;
    };
    let runStart = 0;
    for (let i = 0; i < n - 1; i++) {
      const here = pts[i].surfaceId;
      const next = i + 1 < n - 1 ? pts[i + 1].surfaceId : null;
      if (next !== here) {
        geo.addGroup(runStart * 6, (i - runStart + 1) * 6, materialFor(here));
        runStart = i + 1;
      }
    }

    const mesh = new THREE.Mesh(geo, mats);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this._buildCenterLine(profile);
  }

  _buildCenterLine(profile) {
    const pts = profile.points;
    const n = pts.length;
    const positions = [];
    const idx = [];
    const W = 0.12;
    let v = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const latX = -Math.sin(p.heading), latZ = Math.cos(p.heading);
      const y = p.y + 0.09;
      positions.push(p.x + latX * W, y, p.z + latZ * W, p.x - latX * W, y, p.z - latZ * W);
      if (i < n - 1 && (i % 4 < 2)) { // dashes
        const a = v, b = v + 1, c = v + 2, d = v + 3;
        idx.push(a, c, b, b, c, d);
      }
      v += 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf0d24a }));
    this.scene.add(mesh);
  }

  _buildTerrain(profile) {
    const all = profile.points;
    // Subsampled rows, always keeping the last point so the strip reaches the end.
    const pts = [];
    for (let i = 0; i < all.length; i += TERRAIN_STEP) pts.push(all[i]);
    if (pts[pts.length - 1] !== all[all.length - 1]) pts.push(all[all.length - 1]);
    const n = pts.length;
    const K = TERRAIN_OFFSETS.length;
    const positions = new Float32Array(n * K * 3);
    const colors = new Float32Array(n * K * 3);
    const uvs = new Float32Array(n * K * 2);
    const cGround = new THREE.Color();
    const cLow = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const biome = BIOMES[p.biomeId] || BIOMES.mojave;
      cGround.set(biome.ground); cLow.set(biome.groundLow);
      const latX = -Math.sin(p.heading), latZ = Math.cos(p.heading);
      for (let k = 0; k < K; k++) {
        const off = TERRAIN_OFFSETS[k];
        const near = Math.abs(off) < 12;
        const amp = near ? 0 : Math.min(14, (Math.abs(off) / 220) * 9);
        const hnoise = (Math.sin(p.s * 0.012 + off * 0.05) + Math.cos(off * 0.021 + p.s * 0.008)) * 0.5;
        const y = p.y - 0.05 + hnoise * amp;
        const xx = p.x + latX * off;
        const zz = p.z + latZ * off;
        const ti = (i * K + k) * 3;
        positions[ti] = xx; positions[ti + 1] = y; positions[ti + 2] = zz;
        // Planar world-space UVs: ground detail stays put as the road bends.
        const ui = (i * K + k) * 2;
        uvs[ui] = xx / TERRAIN_TEX_M; uvs[ui + 1] = zz / TERRAIN_TEX_M;
        const t = 0.5 + hnoise * 0.5;
        colors[ti] = cLow.r + (cGround.r - cLow.r) * t;
        colors[ti + 1] = cLow.g + (cGround.g - cLow.g) * t;
        colors[ti + 2] = cLow.b + (cGround.b - cLow.b) * t;
      }
    }
    const idx = new Uint32Array((n - 1) * (K - 1) * 6);
    let w = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < K - 1; k++) {
        const a = i * K + k, b = i * K + k + 1, c = (i + 1) * K + k, d = (i + 1) * K + k + 1;
        idx[w++] = a; idx[w++] = c; idx[w++] = b; idx[w++] = b; idx[w++] = c; idx[w++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: groundTexture(), vertexColors: true, roughness: 1.0, metalness: 0.0, flatShading: true }));
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    this._buildGroundPlane(profile);
  }

  // A single huge quad well below the route, in the biome's ground colour. The
  // detailed strips can't cover every case — they end eventually, and on a tight
  // bend the far ones fold through themselves and cull — so this sits underneath
  // as a floor. It is only ever seen deep in fog, where it reads as more ground.
  _buildGroundPlane(profile) {
    const b = profile.bounds;
    const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + TERRAIN_FAR * 6;
    const biome = BIOMES[profile.points[0]?.biomeId] || BIOMES.mojave;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color: biome.groundLow, fog: true })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((b.maxX + b.minX) / 2, b.minY - 18, (b.maxZ + b.minZ) / 2);
    mesh.renderOrder = -1;
    this.scene.add(mesh);
  }

  _maybeGrid(profile) {
    const hasGrid = profile.points.some((p) => BIOMES[p.biomeId]?.grid);
    if (!hasGrid) return;
    const size = Math.max(profile.bounds.maxX - profile.bounds.minX, profile.bounds.maxZ - profile.bounds.minZ) + 600;
    const grid = new THREE.GridHelper(size, Math.floor(size / 10), 0x00ffd0, 0xff2fb0);
    grid.position.set((profile.bounds.maxX + profile.bounds.minX) / 2, 0.02, (profile.bounds.maxZ + profile.bounds.minZ) / 2);
    grid.material.transparent = true; grid.material.opacity = 0.35; grid.material.fog = true;
    this.scene.add(grid);
  }

  _buildSkySpecials(sky) {
    if (sky.special === 'stars') {
      const N = 1400;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(3500);
        if (v.y < 0) v.y = -v.y; // upper hemisphere mostly
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: 0xffffff, size: 14, sizeAttenuation: true, fog: false });
      const stars = new THREE.Points(g, m);
      this.scene.add(stars);
      this._dynamic.push((t) => { m.opacity = 0.7 + Math.sin(t * 2) * 0.3; m.transparent = true; });
    }
    if (sky.special === 'gridSun') {
      const sun = new THREE.Mesh(new THREE.CircleGeometry(600, 32), new THREE.MeshBasicMaterial({ color: 0xffd24a, fog: false }));
      sun.position.set(0, 500, -3000);
      this.scene.add(sun);
    }
    if (sky.special === 'eye') {
      const eye = new THREE.Group();
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf0e6d0, fog: false }));
      const iris = new THREE.Mesh(new THREE.CircleGeometry(320, 32), new THREE.MeshBasicMaterial({ color: 0x8a1010, fog: false }));
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(140, 24), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
      iris.position.z = 690; pupil.position.z = 700;
      eye.add(sclera, iris, pupil);
      eye.position.set(0, 1400, -3200);
      this.scene.add(eye);
      this._dynamic.push((t) => { const s = 1 + Math.sin(t * 0.7) * 0.04; eye.scale.set(s, 0.7 + Math.abs(Math.sin(t * 0.3)) * 0.3, s); });
    }
    if (sky.special === 'breathe') {
      this._dynamic.push((t) => { /* sky dome breathing handled via fog density pulse */
        if (this.scene.fog) this.scene.fog.density = this._biomeFogDensity(this.profile) * (1 + Math.sin(t * 0.5) * 0.25);
      });
    }
  }

  setCameraMode(m) { this.rig.setMode(m); }
  cycleCamera(dir = 1) { return this.rig.cycle(dir); }
  cameraMode() { return this.rig.mode; }

  // distance in metres along the route; telem provides speed/cadence for anim.
  update(dt, distance, telem = {}) {
    const st = profileAt(this.profile, distance);
    this._moveSun(st);
    if (this.avatar) {
      this.avatar.group.position.set(st.x, st.y, st.z);
      // Orient: yaw to heading, then pitch to gradient.
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -st.heading);
      const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(qYaw);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(localZ, Math.atan(st.gradient));
      this.avatar.group.quaternion.copy(qPitch.multiply(qYaw));
      this.avatar.group.visible = !this.forceHideAvatar && this.rig.avatarVisible();
      this.avatar.update({ speed: telem.speed || 0, cadence: telem.cadence || 0, dt });
    }
    this.rig.update(this.camera, { pos: st, heading: st.heading }, dt);

    const t = this.clock.getElapsedTime();
    for (const fn of this._dynamic) fn(t);

    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
  }

  dispose(full = true) {
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose?.());
        }
      });
      this.scene.environment = null;
    }
    if (this.envTex) { this.envTex.dispose?.(); this.envTex = null; }
    if (this.composer) { this.composer.dispose?.(); this.composer = null; }
    if (full) {
      window.removeEventListener('resize', this._onResize);
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
