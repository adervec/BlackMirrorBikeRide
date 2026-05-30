// Street View RPA capture — drives a real (headless) Chromium via Puppeteer to
// screenshot the keyless `output=svembed` Street View embed at each node along a
// route, saving frames + a resumable manifest to disk. This is the "spoof a human
// screenshotting" bypass the spec asks for (specs.txt:21,53): no Google API key,
// and — crucially — it runs in a THROWAWAY, SIGNED-OUT, INCOGNITO browser so it
// never touches your real Chrome profile or Google account.
//
// The in-app guided crawl (src/ui/realBuilderScreen.js) needs a human because a
// web page can't click inside Google's cross-origin iframe. Puppeteer drives the
// whole browser from outside that sandbox, so no human (and no cross-origin block).
//
// Run:  node scripts/svcapture.mjs --waypoints wp.txt --route-id demo --limit 3 --headful
//       node scripts/svcapture.mjs --route my-route.bmbr.json
// See:  node scripts/svcapture.mjs --help
//
// NOTE: keyless scraping of the embed is contrary to Google Maps ToS — personal,
// local, offline use only. Do not publish the captured tiles.

import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { streetViewEmbedUrl, parseWaypointText, decodePolyline } from '../src/routes/googleMaps.js';
import { sampleNodes } from '../src/routes/realRoute.js';

const USAGE = `
Street View capture (keyless svembed screenshots, incognito Puppeteer)

Input (exactly one):
  --route <path>        Exported route JSON (uses its id + real.nodes if present)
  --waypoints <path>    File of "lat,lng" lines (sampled into nodes)
  --polyline <str>      Encoded polyline (sampled into nodes)

Options:
  --route-id <id>       Output folder/manifest id (default: route id, or adhoc-XXXXXXXX)
  --out <dir>           Output base dir (default: public/imagery)
  --spacing <m>         Node spacing for waypoints/polyline (default: 40)
  --size <WxH>          Frame + viewport size (default: 640x400)
  --headful             Show the browser (recommended for the first run)
  --delay <ms>          Throttle between nodes (default: 1500)
  --jitter <ms>         Random extra 0..N ms added to delay (default: 750)
  --settle <ms>         Wait for tiles after the canvas appears (default: 3500)
  --limit <n>           Visit at most N nodes this run (smoke tests)
  --no-resume           Recapture everything, ignore existing frames
  --quality <1-100>     JPEG quality (default: 85)
  --help                Show this help
`;

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad4 = (i) => String(i).padStart(4, '0');

// Best-effort CSS to hide the embed's UI chrome. These elements live INSIDE the
// cross-origin embed iframe, so this is injected into that frame (not the page).
// Google-internal class names — may drift; capture still works if they do.
const HIDE_CSS = `
  .gmnoprint, .gm-style-cc, .gm-bundled-control, .gm-bundled-control-on-bottom,
  .gm-compass, .gm-iv-address, .gm-iv-short-address-description, .gm-iv-profile,
  img[alt="Google"], a[href*="ReportProblem"], a[href*="google.com/intl"],
  button[aria-label*="Keyboard shortcuts" i] { display: none !important; }
`;

// The keyless svembed page refuses to render as a top-level document ("must be used
// in an iframe"), so we host it in a tiny full-viewport iframe and screenshot that.
function shellHtml(url, W, H) {
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#000}
    iframe{border:0;width:${W}px;height:${H}px;display:block}
  </style></head><body><iframe src="${url}" referrerpolicy="no-referrer-when-downgrade"></iframe></body></html>`;
}

// Find the Street View embed's frame (Puppeteer sees cross-origin frames). Polls until present.
async function findEmbedFrame(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const f = page.frames().find((fr) => /\/maps\/embed|output=svembed/.test(fr.url()));
    if (f) return f;
    await sleep(200);
  }
  return null;
}

function recount(nodes) {
  const c = { total: nodes.length, have: 0, fallback: 0, pending: 0 };
  for (const n of nodes) c[n.status] = (c[n.status] || 0) + 1;
  return c;
}

function parseInput() {
  const { values } = parseArgs({
    options: {
      route: { type: 'string' },
      waypoints: { type: 'string' },
      polyline: { type: 'string' },
      'route-id': { type: 'string' },
      out: { type: 'string', default: 'public/imagery' },
      spacing: { type: 'string', default: '40' },
      size: { type: 'string', default: '640x400' },
      headful: { type: 'boolean', default: false },
      delay: { type: 'string', default: '1500' },
      jitter: { type: 'string', default: '750' },
      settle: { type: 'string', default: '3500' },
      limit: { type: 'string' },
      'no-resume': { type: 'boolean', default: false },
      quality: { type: 'string', default: '85' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  return values;
}

// Resolve the node list + route id from whichever input was given.
function resolveRoute(v) {
  const spacing = num(v.spacing, 40);
  let nodes = null;
  let routeId = v['route-id'] || null;
  let routeName = null;

  const sources = ['route', 'waypoints', 'polyline'].filter((k) => v[k]);
  if (sources.length !== 1) throw new Error('Provide exactly one of --route, --waypoints, --polyline.');

  if (v.route) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(v.route), 'utf8'));
    const route = raw && raw.route ? raw.route : raw; // tolerate {tag,version,route} or bare
    routeId = routeId || route.id;
    routeName = route.name || null;
    if (route.real?.nodes?.length) {
      nodes = route.real.nodes;
    } else if (route.real?.path?.length >= 2) {
      nodes = sampleNodes(route.real.path, spacing);
    } else {
      throw new Error('Route JSON has neither real.nodes nor a real.path of >=2 points.');
    }
  } else if (v.waypoints) {
    const text = fs.readFileSync(path.resolve(v.waypoints), 'utf8');
    const path_ = parseWaypointText(text);
    if (path_.length < 2) throw new Error('Waypoints file needs >=2 valid "lat,lng" lines.');
    nodes = sampleNodes(path_, spacing);
  } else {
    const path_ = decodePolyline(v.polyline.trim());
    if (path_.length < 2) throw new Error('Polyline decoded to <2 points.');
    nodes = sampleNodes(path_, spacing);
  }

  if (!routeId) routeId = 'adhoc-' + randomBytes(4).toString('hex');
  // Normalise to the manifest node shape (we only need geometry).
  const manifestNodes = nodes.map((n, i) => ({
    index: i,
    lat: n.lat, lng: n.lng,
    heading: Math.round(n.heading || 0),
    distance: Math.round(n.distance || 0),
    file: null, status: 'pending', source: null,
  }));
  return { routeId, routeName, nodes: manifestNodes, spacing };
}

// Click an "Accept all" / "Reject all" style button inside a frame, by text. Returns true if clicked.
async function clickConsentIn(frame) {
  try {
    return await frame.evaluate(() => {
      const wants = ['accept all', 'reject all', 'i agree', 'agree to all', 'accept', 'reject'];
      const els = [...document.querySelectorAll('button, [role="button"], input[type="submit"]')];
      for (const want of wants) {
        const el = els.find((e) => {
          const t = (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().toLowerCase();
          return t.includes(want);
        });
        if (el) { el.click(); return true; }
      }
      return false;
    });
  } catch { return false; }
}

// Dismiss Google's consent interstitial if present (region-dependent). The dialog,
// if any, is inside the embed frame, so a click navigates the frame (not the page) —
// we just settle briefly. No-op once consented. Safe to call every node.
async function ensureConsent(page) {
  let clicked = false;
  for (const frame of page.frames()) {
    if (await clickConsentIn(frame)) { clicked = true; break; }
  }
  if (clicked) await sleep(2000);
  return clicked;
}

async function main() {
  const v = parseInput();
  if (v.help) { console.log(USAGE); return; }

  const [W, H] = (v.size || '640x400').split('x').map((s) => parseInt(s, 10));
  if (!Number.isFinite(W) || !Number.isFinite(H)) throw new Error('--size must be WxH, e.g. 640x400.');
  const quality = Math.max(1, Math.min(100, num(v.quality, 85)));
  const settle = num(v.settle, 3500);
  const delay = num(v.delay, 1500);
  const jitter = num(v.jitter, 750);
  const limit = v.limit ? num(v.limit, Infinity) : Infinity;
  const noResume = !!v['no-resume'];
  const headful = !!v.headful;

  const { routeId, routeName, nodes, spacing } = resolveRoute(v);
  const frameDir = path.resolve(v.out, routeId);
  const manifestPath = path.join(frameDir, 'manifest.json');
  fs.mkdirSync(frameDir, { recursive: true });

  // Build or resume the manifest (it is both the checkpoint and the import artifact).
  let manifest;
  if (!noResume && fs.existsSync(manifestPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (prev?.nodes?.length === nodes.length) {
        manifest = prev;
        console.log(`Resuming from manifest (${recount(prev.nodes).have} already captured).`);
      } else {
        console.log('Existing manifest node count differs — starting fresh.');
      }
    } catch { /* fall through to fresh */ }
  }
  if (!manifest) {
    manifest = {
      tag: 'bmbr-imagery', version: 1, routeId, routeName,
      capturedAt: new Date().toISOString(),
      params: { spacing, size: `${W}x${H}`, quality, technique: 'svembed-screenshot' },
      counts: recount(nodes), nodes,
    };
  }

  const writeManifest = () => {
    manifest.counts = recount(manifest.nodes);
    const tmp = manifestPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
    fs.renameSync(tmp, manifestPath); // atomic — a crash never leaves a half-written manifest
  };

  let puppeteer;
  try { puppeteer = (await import('puppeteer')).default; }
  catch { console.error('Puppeteer is not installed. Run:  npm i -D puppeteer'); process.exit(1); }

  console.log(`Capturing "${routeId}" — ${nodes.length} nodes @ ${W}x${H} → ${frameDir}`);

  // --- launch: throwaway temp profile (NO userDataDir), then an isolated incognito context.
  // We never sign into Google; the keyless svembed endpoint needs no auth.
  const browser = await puppeteer.launch({
    headless: headful ? false : true,
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US', '--disable-blink-features=AutomationControlled'],
  });
  const makeCtx = browser.createBrowserContext?.bind(browser)        // Puppeteer >= 22
    || browser.createIncognitoBrowserContext?.bind(browser);          // older Puppeteer
  const context = makeCtx ? await makeCtx() : browser.defaultBrowserContext();
  const page = await context.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  // Best-effort consent pre-seed (values are opaque & rotate) — set on this incognito
  // context only, discarded when the run ends. Runtime click below is the reliable path.
  try {
    await page.setCookie(
      { name: 'CONSENT', value: 'YES+', domain: '.google.com', path: '/' },
      { name: 'SOCS', value: 'CAI', domain: '.google.com', path: '/' },
    );
  } catch { /* ignore */ }

  let stopping = false;
  const onStop = () => { if (!stopping) { stopping = true; console.log('\n⏹  Stopping after the current node…'); } };
  process.on('SIGINT', onStop);
  process.on('SIGTERM', onStop);

  let visited = 0;
  try {
    for (const entry of manifest.nodes) {
      if (stopping || visited >= limit) break;
      visited++;
      const tag = pad4(entry.index);

      // Skip rule: have + file present (recapture if file went missing); fallback skipped unless --no-resume.
      const have = entry.status === 'have' && entry.file && fs.existsSync(path.join(frameDir, entry.file));
      if (!noResume && (have || entry.status === 'fallback')) {
        console.log(`  ${tag} skip (${entry.status})`);
        continue;
      }

      try {
        const url = streetViewEmbedUrl({ lat: entry.lat, lng: entry.lng }, entry.heading, '');
        await page.setContent(shellHtml(url, W, H), { waitUntil: 'load', timeout: 30000 });

        const frame = await findEmbedFrame(page, 12000);
        let ok = false;
        if (frame) {
          await ensureConsent(page);
          // The panorama renders into a <canvas> inside the embed frame.
          try { await frame.waitForSelector('canvas', { timeout: 15000 }); ok = true; }
          catch { ok = false; }
        }

        if (!ok) {
          // No panorama here → satellite-spoof fallback (mirrors realRoute.js:146,152).
          entry.status = 'fallback'; entry.source = 'satellite-spoof'; entry.file = null;
          console.log(`  ${tag} fallback (no street view imagery)`);
        } else {
          await sleep(settle); // let WebGL tiles fill in (no reliable "done" event on the keyless embed)
          await frame.addStyleTag({ content: HIDE_CSS }).catch(() => {}); // hide chrome inside the embed frame
          const file = `${tag}.jpg`;
          const dest = path.join(frameDir, file);
          await page.screenshot({ path: dest, type: 'jpeg', quality, clip: { x: 0, y: 0, width: W, height: H } });
          entry.status = 'have'; entry.source = 'streetview-rpa'; entry.file = file;
          const size = fs.statSync(dest).size;
          if (size < 3000) console.log(`  ${tag} capture ⚠ (${size}B — may be blank/no-imagery)`);
          else console.log(`  ${tag} capture (${(size / 1024).toFixed(0)}KB)`);
        }
      } catch (e) {
        // Don't lose progress on a single bad node — record fallback and move on.
        entry.status = 'fallback'; entry.source = 'satellite-spoof'; entry.file = null;
        console.log(`  ${tag} error → fallback: ${e.message}`);
      }

      writeManifest(); // checkpoint after EVERY node → resumable
      if (!stopping) await sleep(delay + Math.random() * jitter); // be polite; jitter avoids a periodic signature
    }
  } finally {
    writeManifest();
    await context.close?.().catch(() => {});
    await browser.close().catch(() => {});
  }

  const c = manifest.counts;
  console.log(`\nDone. ${c.have} captured, ${c.fallback} fallback, ${c.pending} pending of ${c.total}.`);
  console.log(`Manifest: ${manifestPath}`);
  if (c.pending > 0) console.log('Re-run the same command to resume the remaining nodes.');
}

main().catch((e) => { console.error('\n✖ ' + (e?.stack || e?.message || e)); process.exit(1); });
