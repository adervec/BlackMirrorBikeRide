// Procedural surface textures, drawn once into an offscreen canvas and cached.
// No image files: the app stays a self-contained static bundle, and a route only
// pays for the surfaces it actually uses.
//
// These are deliberately near-WHITE detail maps. The road and terrain meshes
// already carry their surface/biome colour in vertex colours, and three.js
// multiplies map × vertexColor, so a light pattern adds grain and structure
// without shifting the palette. Anything mid-grey here would halve the
// brightness of the whole world.

import * as THREE from 'three';
import { DEFAULT_SURFACE } from '../physics/surfaces.js';

const SIZE = 256;
const cache = new Map();

function ctx2d() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c.getContext('2d');
}

function toTexture(ctx) {
  const t = new THREE.CanvasTexture(ctx.canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace; // it's a colour map, not data
  return t;
}

// Scatter soft dots. Drawing each near the edges again one tile over keeps the
// pattern seamless when the texture repeats.
function speckle(ctx, { n, r = 2, dark = 0.25, light = 0.15 }) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * SIZE;
    const y = Math.random() * SIZE;
    const rad = 0.4 + Math.random() * r;
    const isDark = Math.random() < 0.65;
    const a = Math.random() * (isDark ? dark : light);
    ctx.fillStyle = isDark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    blob(ctx, x, y, rad);
  }
}

// Draw a dot, repeating it across whichever seam it straddles so the tile wraps.
function blob(ctx, x, y, r) {
  const xs = [x];
  if (x < r) xs.push(x + SIZE); else if (x > SIZE - r) xs.push(x - SIZE);
  const ys = [y];
  if (y < r) ys.push(y + SIZE); else if (y > SIZE - r) ys.push(y - SIZE);
  for (const px of xs) {
    for (const py of ys) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function base(ctx, fill = '#f6f6f6') {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

// ---- per-surface patterns ---------------------------------------------------
const PATTERNS = {
  // Bituminous surfaces differ only in how coarse the aggregate reads.
  asphaltish(ctx, grain) {
    base(ctx, '#f4f4f4');
    speckle(ctx, { n: 2600 * grain, r: 1.6 * grain, dark: 0.3, light: 0.18 });
  },
  concrete(ctx) {
    base(ctx, '#fafafa');
    speckle(ctx, { n: 1200, r: 1.1, dark: 0.12, light: 0.1 });
    // expansion joints
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, SIZE / 2); ctx.lineTo(SIZE, SIZE / 2);
    ctx.moveTo(SIZE / 2, 0); ctx.lineTo(SIZE / 2, SIZE);
    ctx.stroke();
  },
  cobbles(ctx) {
    base(ctx, '#c9c9c9'); // mortar sits darker than the stones
    const cell = SIZE / 8;
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 9; col++) {
        const cx = col * cell + (row % 2 ? cell / 2 : 0) + cell / 2;
        const cy = row * cell + cell / 2;
        const rx = cell * (0.36 + Math.random() * 0.07);
        const ry = cell * (0.30 + Math.random() * 0.07);
        const shade = 236 + Math.floor(Math.random() * 19);
        for (const dx of [-SIZE, 0, SIZE]) {
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
          ctx.beginPath();
          ctx.ellipse(cx + dx, cy, rx, ry, Math.random() * 0.4 - 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    speckle(ctx, { n: 700, r: 1, dark: 0.14, light: 0.08 });
  },
  woodBoards(ctx) {
    base(ctx, '#f7f2ea');
    const planks = 6;
    const h = SIZE / planks;
    for (let i = 0; i < planks; i++) {
      const y = i * h;
      const shade = 240 + Math.floor(Math.random() * 15);
      ctx.fillStyle = `rgb(${shade},${shade - 3},${shade - 8})`;
      ctx.fillRect(0, y, SIZE, h);
      // grain
      ctx.strokeStyle = 'rgba(120,90,55,0.16)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 7; g++) {
        const gy = y + Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(SIZE / 3, gy + (Math.random() - 0.5) * 4, (2 * SIZE) / 3, gy + (Math.random() - 0.5) * 4, SIZE, gy);
        ctx.stroke();
      }
      // seam between boards
      ctx.strokeStyle = 'rgba(60,40,20,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
    }
  },
  gravel(ctx) {
    base(ctx, '#ededed');
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * SIZE, y = Math.random() * SIZE;
      const r = 1.5 + Math.random() * 3.2;
      const shade = 205 + Math.floor(Math.random() * 50);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      blob(ctx, x, y, r);
      ctx.fillStyle = 'rgba(0,0,0,0.13)'; // contact shadow
      blob(ctx, x + r * 0.35, y + r * 0.4, r * 0.75);
    }
  },
  hardpack(ctx) {
    base(ctx, '#f2efe9');
    for (let i = 0; i < 130; i++) {
      const x = Math.random() * SIZE, y = Math.random() * SIZE;
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
      blob(ctx, x, y, 6 + Math.random() * 16);
    }
    speckle(ctx, { n: 900, r: 1.3, dark: 0.16, light: 0.1 });
  },
  sand(ctx) {
    base(ctx, '#fbf7ee');
    // wind ripples — an integer number of periods so the tile wraps
    for (let y = 0; y < SIZE; y++) {
      const w = Math.sin((y / SIZE) * Math.PI * 2 * 6) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(0,0,0,${0.03 + w * 0.06})`;
      ctx.fillRect(0, y, SIZE, 1);
    }
    speckle(ctx, { n: 1800, r: 0.9, dark: 0.1, light: 0.14 });
  },
  grass(ctx) {
    base(ctx, '#f0f5ec');
    ctx.lineWidth = 1;
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * SIZE, y = Math.random() * SIZE;
      const len = 3 + Math.random() * 5;
      const dark = Math.random() < 0.6;
      ctx.strokeStyle = dark ? `rgba(0,0,0,${0.1 + Math.random() * 0.18})` : `rgba(255,255,255,${Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 2.5, y - len);
      ctx.stroke();
    }
  },
  // Open ground beside the road: soft mottling, no strong structure, so it
  // reads at a distance without tiling obviously.
  ground(ctx) {
    base(ctx, '#f4f4f0');
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * SIZE, y = Math.random() * SIZE;
      const dark = Math.random() < 0.6;
      ctx.fillStyle = dark ? `rgba(0,0,0,${Math.random() * 0.09})` : `rgba(255,255,255,${Math.random() * 0.12})`;
      blob(ctx, x, y, 8 + Math.random() * 22);
    }
    speckle(ctx, { n: 1400, r: 1.5, dark: 0.14, light: 0.12 });
  },
};

// Which pattern each surface id draws with. Unlisted ids fall back to asphalt.
const DRAW = {
  'wood-boards': (c) => PATTERNS.woodBoards(c),
  'smooth-asphalt': (c) => PATTERNS.asphaltish(c, 0.6),
  asphalt: (c) => PATTERNS.asphaltish(c, 1),
  concrete: (c) => PATTERNS.concrete(c),
  chipseal: (c) => PATTERNS.asphaltish(c, 1.7),
  cobbles: (c) => PATTERNS.cobbles(c),
  gravel: (c) => PATTERNS.gravel(c),
  hardpack: (c) => PATTERNS.hardpack(c),
  sand: (c) => PATTERNS.sand(c),
  grass: (c) => PATTERNS.grass(c),
};

function build(key, draw) {
  if (cache.has(key)) return cache.get(key);
  const ctx = ctx2d();
  draw(ctx);
  const tex = toTexture(ctx);
  cache.set(key, tex);
  return tex;
}

// Cached — textures outlive a scene teardown on purpose, so moving between
// routes doesn't redraw and re-upload the same few tiles.
export function surfaceTexture(surfaceId) {
  // Resolve before caching, so an unknown id shares the default's texture
  // instead of drawing an identical copy under its own key.
  const id = DRAW[surfaceId] ? surfaceId : DEFAULT_SURFACE;
  return build(`surface:${id}`, DRAW[id]);
}

export function groundTexture() {
  return build('ground', (c) => PATTERNS.ground(c));
}
