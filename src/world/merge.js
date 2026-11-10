// Collapse a forest of little prop meshes into a handful of big ones.
//
// Triangles are cheap; draw calls are not. A route's props are ~3800 separate
// meshes, which is the real mobile ceiling — the GPU spends its time on state
// changes, not geometry. Merging by material would normally be defeated by the
// fact that nearly every prop picks its own colour, so the colour is baked into
// a vertex attribute and the merged material goes white: everything sharing a
// shader flavour (opaque / transparent / basic / wireframe) merges into one.
//
// Merging is per spatial chunk rather than route-wide, so frustum culling still
// throws away the scenery behind you instead of drawing the whole route.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const CHUNK = 200; // metres

// Everything that makes two materials genuinely different to the GPU. Colour is
// deliberately absent — that's what the vertex colours are for.
const materialKey = (m) => [
  m.type, m.transparent, m.opacity, m.side, !!m.wireframe, m.flatShading,
  m.map?.uuid ?? '', m.emissive?.getHex() ?? '', m.roughness ?? '', m.metalness ?? '',
].join('|');

const _v = new THREE.Vector3();

export function mergeProps(root, chunk = CHUNK) {
  root.updateMatrixWorld(true);

  const buckets = new Map(); // key -> { material, geos: [] }
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && o.geometry && o.material && !Array.isArray(o.material)) meshes.push(o); });

  for (const mesh of meshes) {
    const mat = mesh.material;
    _v.setFromMatrixPosition(mesh.matrixWorld);
    const key = `${Math.floor(_v.x / chunk)},${Math.floor(_v.z / chunk)}|${materialKey(mat)}`;

    // Non-indexed throughout: polyhedra (dodeca/icosa/octa) are non-indexed and
    // the rest are indexed, and mergeGeometries needs one or the other. Every
    // prop material is flat-shaded, so splitting shared vertices changes nothing
    // you can see.
    // ponytail: costs ~2x vertex memory; index-preserving merge if that bites.
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal' && !(name === 'uv' && mat.map)) geo.deleteAttribute(name);
    }
    const n = geo.attributes.position.count;
    const colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colours.set([mat.color.r, mat.color.g, mat.color.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geo.clearGroups();

    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = { material: mat, geos: [] }));
    bucket.geos.push(geo);
  }

  const merged = new THREE.Group();
  for (const { material, geos } of buckets.values()) {
    const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos);
    if (!geo) continue; // mergeGeometries logs and returns null on a mismatch we missed
    const mat = material.clone();
    mat.color.setRGB(1, 1, 1);
    mat.vertexColors = true;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    merged.add(mesh);
  }

  // Nothing merged (or nothing to merge) — leave the tree alone rather than
  // silently emptying the scene.
  if (merged.children.length === 0) return root;

  for (const mesh of meshes) mesh.geometry.dispose();
  root.clear();
  root.add(...merged.children);
  return root;
}
