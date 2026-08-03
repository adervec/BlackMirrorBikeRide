// Renders every non-WebGL screen under jsdom to catch DOM-level runtime errors.
// (The ride screen needs WebGL, so it's exercised separately by selftest.mjs.)
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body><div id="app"></div></body>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
// Node 24 ships a read-only built-in `navigator`; leave it (no .bluetooth -> BLE off).
global.localStorage = dom.window.localStorage;
global.HTMLElement = dom.window.HTMLElement;
global.devicePixelRatio = 1;
global.confirm = () => true;
global.alert = () => {};
// Stub rAF so screens that defer WebGL init (garage preview) render without it.
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};

let fails = 0;
const ctx = { router: { go: () => {} }, params: {}, onCleanup: () => {} };

const screens = [
  ['menuScreen', 'renderMenu'],
  ['routesScreen', 'renderRoutes'],
  ['builderScreen', 'renderVirtualBuilder'],
  ['gpxScreen', 'renderGpxImport'],
  ['garageScreen', 'renderGarage'],
  ['settingsScreen', 'renderSettings'],
  ['historyScreen', 'renderHistory'],
  ['skyboxScreen', 'renderSkyboxes']
];

for (const [mod, fn] of screens) {
  try {
    const m = await import(`../src/ui/${mod}.js`);
    const elem = m[fn](ctx);
    const ok = elem && elem.nodeType === 1 && elem.querySelectorAll('*').length > 0;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${fn} renders (${elem?.querySelectorAll('*').length ?? 0} nodes)`);
    if (!ok) fails++;
  } catch (e) {
    console.log(`FAIL  ${fn} threw: ${e.message}`);
    console.log(e.stack.split('\n').slice(1, 4).join('\n'));
    fails++;
  }
}

// exercise builder interactions (add/remove segment, surface change) via the live DOM
try {
  const m = await import('../src/ui/builderScreen.js');
  const elem = m.renderVirtualBuilder(ctx);
  const addBtn = [...elem.querySelectorAll('button')].find((b) => b.textContent.includes('Add segment'));
  const before = elem.querySelectorAll('.seg-row').length;
  addBtn.click();
  const after = elem.querySelectorAll('.seg-row').length;
  console.log(`${after === before + 1 ? 'PASS' : 'FAIL'}  builder "Add segment" adds a row (${before} -> ${after})`);
  if (after !== before + 1) fails++;
} catch (e) { console.log('FAIL  builder interaction threw: ' + e.message); fails++; }

console.log(`\n${fails === 0 ? '✅ ALL SCREENS OK' : '❌ ' + fails + ' SCREEN CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
