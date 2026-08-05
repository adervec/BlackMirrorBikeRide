// tools/make-icons.mjs — generate the PWA icons from one geometric bike glyph.
//   node tools/make-icons.mjs
//
// Deliberately dependency-free: the glyph is rasterised here with a small
// signed-distance renderer and written out as PNG via node:zlib, so generating
// icons needs no headless browser and no image library (the sibling apps use
// Playwright/Puppeteer for this; this repo has neither, on purpose).
//
// The same geometry also emits favicon.svg, so the vector and raster icons can
// never drift apart. Re-run after changing the design.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(fileURLToPath(new URL('..', import.meta.url)), 'public');

const BG = [0x0b, 0x0d, 0x14];      // --bg, matches the app's page background
const FG = [0x4c, 0xc2, 0xff];      // --accent

// ---- the glyph, in a 512x512 design box ------------------------------------
// Everything sits inside the maskable safe zone (the central 80%: 51..461).
const R = 92, TUBE = 11, RING = 15;
const WHEEL_Y = 285;
const HUB_REAR = [150, WHEEL_Y], HUB_FRONT = [362, WHEEL_Y];
const BB = [256, WHEEL_Y];          // bottom bracket
const SEAT = [226, 169], HEAD = [330, 165];

const WHEELS = [HUB_REAR, HUB_FRONT];
const TUBES = [
  [BB, SEAT],        // seat tube
  [BB, HEAD],        // down tube
  [SEAT, HEAD],      // top tube
  [SEAT, HUB_REAR],  // seat stay
  [BB, HUB_REAR],    // chain stay
  [HEAD, HUB_FRONT], // fork
  [[206, 156], [248, 156]],  // saddle
  [[300, 150], [344, 150]],  // handlebar
];

// ---- tiny SDF rasteriser ----------------------------------------------------
function segDistance(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const dx = px - (ax + vx * t), dy = py - (ay + vy * t);
  return Math.hypot(dx, dy);
}

// Coverage of the glyph at a design-space point: distance turned into a 1px
// antialiased edge.
function glyphCoverage(x, y) {
  let cov = 0;
  const edge = (d, half) => Math.max(0, Math.min(1, half - d + 0.5));
  for (const [cx, cy] of WHEELS) {
    cov = Math.max(cov, edge(Math.abs(Math.hypot(x - cx, y - cy) - R), RING / 2));
  }
  for (const [a, b] of TUBES) {
    cov = Math.max(cov, edge(segDistance(x, y, a, b), TUBE / 2));
  }
  return cov;
}

// Rounded-square mask for the normal icons; maskable ones stay full-bleed
// because the launcher applies its own shape.
function bgCoverage(x, y, maskable) {
  if (maskable) return 1;
  const r = 96, lo = r, hi = 512 - r;
  const qx = Math.max(lo - x, 0, x - hi);
  const qy = Math.max(lo - y, 0, y - hi);
  const d = Math.hypot(qx, qy) - r;
  return Math.max(0, Math.min(1, 0.5 - d));
}

function render(size, maskable) {
  const px = new Uint8Array(size * size * 4);
  const scale = 512 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // sample at the pixel centre, in design space
      const dx = (x + 0.5) * scale, dy = (y + 0.5) * scale;
      const bg = bgCoverage(dx, dy, maskable);
      const g = glyphCoverage(dx, dy) * bg;
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] * (1 - g) + FG[c] * g);
      px[i + 3] = Math.round(255 * bg);
    }
  }
  return px;
}

// ---- minimal PNG encoder ----------------------------------------------------
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(px.buffer, px.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- svg (same geometry, so the two can't drift) ----------------------------
function svg() {
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const wheels = WHEELS.map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${hex(FG)}" stroke-width="${RING}"/>`).join('\n  ');
  const tubes = TUBES.map(([[x1, y1], [x2, y2]]) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${hex(FG)}" stroke-width="${TUBE}" stroke-linecap="round"/>`).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img">
  <title>Black Mirror Bike Ride</title>
  <desc>A bicycle drawn as two wheels and a diamond frame, in cyan on a dark rounded square.</desc>
  <rect width="512" height="512" rx="96" fill="${hex(BG)}"/>
  ${wheels}
  ${tubes}
</svg>
`;
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
];

mkdirSync(OUT, { recursive: true });
for (const t of TARGETS) {
  writeFileSync(join(OUT, t.file), encodePng(t.size, render(t.size, t.maskable)));
  console.log(`wrote ${t.file} (${t.size}x${t.size}${t.maskable ? ', maskable' : ''})`);
}
writeFileSync(join(OUT, 'favicon.svg'), svg());
console.log('wrote favicon.svg');
