// PWA installability checks. Run: node scripts/pwatest.mjs
//
// A browser silently declines to offer "Install" when any part of this contract
// is wrong — no error, no console warning, the prompt just never appears. So the
// manifest fields, the icon files behind them, and the HTML wiring are asserted
// here rather than discovered on a phone.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const pub = join(root, 'public');

let fails = 0;
const assert = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

// ---- manifest ----
const manifest = JSON.parse(readFileSync(join(pub, 'manifest.webmanifest'), 'utf8'));
assert(!!manifest.name && !!manifest.short_name, 'manifest has name + short_name');
assert(manifest.display === 'standalone', 'display is standalone (required for an install prompt)');
assert(!!manifest.start_url && !!manifest.scope, 'manifest has start_url + scope');
assert(/^#[0-9a-f]{6}$/i.test(manifest.background_color) && /^#[0-9a-f]{6}$/i.test(manifest.theme_color),
  'background_color + theme_color are hex colours');

// Relative paths matter: the app is served from /BlackMirrorBikeRide/ on Pages
// and / in dev, so anything root-absolute here would 404 on one of them.
const paths = [manifest.start_url, manifest.scope, ...manifest.icons.map((i) => i.src)];
assert(paths.every((p) => !p.startsWith('/')), 'all manifest paths are relative (works under the Pages subpath)');

// ---- icons actually exist, and are the PNGs they claim to be ----
function pngSize(file) {
  const b = readFileSync(file);
  const isPng = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return isPng ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
}
for (const icon of manifest.icons) {
  const file = join(pub, icon.src);
  assert(existsSync(file), `icon exists: ${icon.src}`);
  if (!existsSync(file) || icon.type !== 'image/png') continue;
  const size = pngSize(file);
  const [w, h] = icon.sizes.split('x').map(Number);
  assert(size && size.w === w && size.h === h,
    `${icon.src} is a real PNG at its declared ${icon.sizes} (got ${size ? size.w + 'x' + size.h : 'not a PNG'})`);
}
const purposes = manifest.icons.flatMap((i) => (i.purpose || 'any').split(' '));
assert(purposes.includes('maskable'), 'a maskable icon is declared (Android crops non-maskable ones)');
assert(manifest.icons.some((i) => i.sizes === '192x192') && manifest.icons.some((i) => i.sizes === '512x512'),
  'both 192px and 512px icons are declared');

// ---- service worker: installability needs a fetch handler, not just a file ----
const sw = readFileSync(join(pub, 'sw.js'), 'utf8');
assert(/addEventListener\(\s*['"]fetch['"]/.test(sw), 'service worker has a fetch handler');
assert(/addEventListener\(\s*['"]install['"]/.test(sw), 'service worker has an install handler');
assert(sw.includes("new URL('./', self.location)"), 'service worker derives its base (works under the Pages subpath)');

// ---- html wiring ----
const html = readFileSync(join(root, 'index.html'), 'utf8');
assert(/<link[^>]+rel="manifest"/.test(html), 'index.html links the manifest');
assert(html.includes('%BASE_URL%manifest.webmanifest'), 'manifest link uses %BASE_URL% so it resolves under the subpath');
assert(/name="theme-color"/.test(html), 'index.html sets theme-color');
assert(/rel="apple-touch-icon"/.test(html), 'index.html sets an apple-touch-icon (iOS ignores the manifest icons)');

// ---- registration ----
const main = readFileSync(join(root, 'src', 'main.js'), 'utf8');
assert(/serviceWorker/.test(main) && /register\(/.test(main), 'main.js registers the service worker');
assert(/import\.meta\.env\.BASE_URL\}sw\.js/.test(main), 'registration path is base-aware');
assert(/import\.meta\.env\.PROD/.test(main), 'registration is production-only (dev never serves a stale bundle)');

console.log(`\n${fails === 0 ? '✅ ALL PWA CHECKS PASSED' : '❌ ' + fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
