// Tessellation helpers — one knob for how round everything in the world is.
//
// These wrap the three.js primitives and raise their segment counts, so the
// props, the avatar and the bike all get smoother in one place instead of via
// ~300 hand-tuned numbers.
//
// The important rule: a segment count of 4 or fewer is a deliberate SHAPE, not
// low detail. A 4-sided cone is a pyramid roof, a 3-sided cylinder is a
// triangular prism (the barn roof), a 4-sided box-ish cylinder is a chess base.
// Multiplying those would silently turn every pitched roof in the game into a
// cone, so anything at or below FACETED is left exactly as it was.

import * as THREE from 'three';

// Faces scale with the radial count on cylinders/cones, and with the product of
// both counts on spheres/tori — hence the different multipliers for ~3x faces.
export const DETAIL = 5;
const AREAL = Math.sqrt(DETAIL); // ≈1.73, applied to each axis of a 2D grid
const FACETED = 4;               // at or below this, the low count IS the design

// Capped: past ~32 sides a cylinder is indistinguishable from a smooth one at
// any distance you'd ever see it, so the extra triangles buy nothing.
const MAX_RADIAL = 32;
const MAX_GRID = 24;
const radial = (n) => (n <= FACETED ? n : Math.min(MAX_RADIAL, Math.max(3, Math.round(n * DETAIL))));
const grid = (n) => (n <= FACETED ? n : Math.min(MAX_GRID, Math.max(3, Math.round(n * AREAL))));

export const cylinder = (rt, rb, h, seg = 8, ...rest) =>
  new THREE.CylinderGeometry(rt, rb, h, radial(seg), ...rest);

export const cone = (r, h, seg = 8, ...rest) =>
  new THREE.ConeGeometry(r, h, radial(seg), ...rest);

export const sphere = (r, w = 8, h = 6, ...rest) =>
  new THREE.SphereGeometry(r, grid(w), grid(h), ...rest);

export const circle = (r, seg = 8, ...rest) =>
  new THREE.CircleGeometry(r, radial(seg), ...rest);

export const torus = (r, tube, rSeg = 6, tSeg = 8, ...rest) =>
  new THREE.TorusGeometry(r, tube, grid(rSeg), grid(tSeg), ...rest);

export const capsule = (r, len, cap = 4, seg = 8) =>
  new THREE.CapsuleGeometry(r, len, grid(cap), radial(seg));

// Platonic solids take a subdivision level rather than a segment count; one
// level up is ~4x the faces, which still reads as chunky under flat shading.
export const dodeca = (r, detail = 0) => new THREE.DodecahedronGeometry(r, detail + 1);
export const icosa = (r, detail = 0) => new THREE.IcosahedronGeometry(r, detail + 1);
export const octa = (r, detail = 0) => new THREE.OctahedronGeometry(r, detail + 1);
