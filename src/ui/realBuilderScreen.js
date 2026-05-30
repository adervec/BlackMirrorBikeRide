import { div, h, el, field, select, textInput, btn, screen } from './dom.js';
import { getState, getRoute, upsertRoute, save } from '../state.js';
import { totalDistance } from '../routes/virtualRoute.js';
import { surfaceList } from '../physics/surfaces.js';
import { allSkyboxOptions } from '../routes/skyboxes.js';
import {
  parseWaypointText, decodePolyline, hasKey,
  parseGoogleMapsUrl, mapsDirectionsUrl, streetViewEmbedUrl, streetViewImageUrl, staticSatelliteUrl
} from '../routes/googleMaps.js';
import { buildRealRoute, acquireImagery, loadCheckpoint, persistCheckpoint } from '../routes/realRoute.js';

export function renderRealBuilder(ctx) {
  const s = getState();
  const existing = ctx.params.routeId ? getRoute(ctx.params.routeId) : null;

  const state = {
    name: existing?.name || 'My Real Route',
    surface: existing?.real?.surface || 'asphalt',
    skybox: existing?.skybox || 'clear-day',
    inputMode: 'waypoints',
    rawWaypoints: existing ? (existing.real.path || []).map((p) => `${p.lat},${p.lng}`).join('\n') : '',
    rawPolyline: '',
    route: existing || null,
    abort: null
  };

  const status = div({ class: 'build-status' });
  const progressWrap = div({ class: 'progress-wrap', style: { display: 'none' } });
  const progressBar = div({ class: 'progress-bar' });
  progressWrap.append(progressBar);
  const crawlBox = div({ class: 'crawl-box', style: { display: 'none' } });
  const crawl = { open: false, idx: 0 };

  function setStatus(msg, cls = '') { status.innerHTML = ''; status.append(el('div', { class: cls }, msg)); }

  const surfaceOpts = surfaceList().map((x) => ({ value: x.id, label: x.label }));
  const skyOpts = allSkyboxOptions(s.customSkyboxes).map((x) => ({ value: x.id, label: x.label }));

  const keyState = hasKey(s.settings.googleMapsApiKey);

  function gatherPath() {
    if (state.inputMode === 'polyline') {
      const enc = state.rawPolyline.trim();
      if (!enc) throw new Error('Paste an encoded polyline.');
      return decodePolyline(enc);
    }
    const path = parseWaypointText(state.rawWaypoints);
    if (path.length < 2) throw new Error('Enter at least two "lat,lng" waypoints (one per line).');
    return path;
  }

  async function generate(thenRide = false) {
    try {
      setStatus('Building geometry…');
      const path = gatherPath();
      const route = await buildRealRoute({
        name: state.name, path, surface: state.surface,
        apiKey: s.settings.googleMapsApiKey, skybox: state.skybox
      });
      if (existing) route.id = existing.id;
      state.route = route;
      upsertRoute(route);
      const km = (totalDistance(route) / 1000).toFixed(2);
      setStatus(`Built: ${km} km, ${route.segments.length} segments, ${route.real.nodes.length} imagery nodes. ` +
        (route.real.hasElevation ? 'Elevation from Google.' : 'No elevation (flat-ish).'), 'ok');
      renderImageryControls();
      if (thenRide) ctx.router.go('ride', { routeId: route.id, reverse: false });
    } catch (e) {
      setStatus(e.message, 'err');
    }
  }

  const imageryControls = div({ class: 'card' });
  function renderImageryControls() {
    imageryControls.innerHTML = '';
    if (!state.route) { imageryControls.style.display = 'none'; return; }
    imageryControls.style.display = '';
    const ck = loadCheckpoint(state.route);
    const done = ck.cursor;
    const total = ck.nodes.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    progressBar.style.width = pct + '%';

    imageryControls.append(
      h(2, 'Ground Imagery Acquisition'),
      div({ class: 'hint' }, keyState
        ? 'With your Google key, the pipeline pulls Street View per node and falls back to a 3D-satellite spoof where Street View is missing.'
        : 'No Google API key set (Settings). The route still rides on the satellite-derived 3D world; imagery nodes are marked as satellite-spoof fallbacks.'),
      div({}, `Checkpoint: ${done}/${total} nodes (${pct}%). Resumable — safe to stop and continue later.`),
      progressWrap,
      div({ class: 'row' }, [
        btn(done >= total && total > 0 ? 'Re-run auto acquisition' : (done > 0 ? 'Resume auto acquisition' : 'Auto acquisition'), async () => {
          progressWrap.style.display = '';
          const controller = new AbortController();
          state.abort = controller;
          await acquireImagery(state.route, {
            apiKey: s.settings.googleMapsApiKey,
            signal: controller.signal,
            onProgress: (p) => { progressBar.style.width = Math.round(p * 100) + '%'; }
          });
          upsertRoute(state.route); save();
          renderImageryControls();
        }),
        btn('Stop', () => { state.abort?.abort(); }, 'btn ghost'),
        btn(crawl.open ? 'Close guided crawl' : 'Guided Street View crawl ▷', () => { crawl.open = !crawl.open; crawl.idx = loadCheckpoint(state.route).cursor; renderCrawl(); }, 'btn ghost')
      ]),
      crawlBox
    );
    renderCrawl();
  }

  // Human-in-the-loop crawl: step node-by-node through Street View, confirming
  // each. Cross-origin security means a web page can't auto-click inside Google's
  // map, so the human confirms; the stepping + checkpointing is automated here.
  function renderCrawl() {
    crawlBox.innerHTML = '';
    if (!crawl.open || !state.route) { crawlBox.style.display = 'none'; return; }
    crawlBox.style.display = '';
    const ck = loadCheckpoint(state.route);
    const nodes = ck.nodes;
    crawl.idx = Math.max(0, Math.min(nodes.length - 1, crawl.idx));
    const node = nodes[crawl.idx];
    const key = s.settings.googleMapsApiKey;

    const advance = (status, source, url) => {
      node.status = status; node.source = source; node.url = url;
      ck.cursor = Math.max(ck.cursor, crawl.idx + 1);
      if (ck.cursor >= nodes.length) { state.route.real.imageryComplete = true; state.route.real.nodes = nodes; upsertRoute(state.route); }
      persistCheckpoint(state.route, ck);
      crawl.idx = Math.min(nodes.length - 1, crawl.idx + 1);
      renderImageryControls();
    };

    crawlBox.append(
      h(3, `Node ${crawl.idx + 1} / ${nodes.length}  ·  ${node.lat.toFixed(5)}, ${node.lng.toFixed(5)}  ·  heading ${Math.round(node.heading)}°  ·  ${node.status}`),
      el('iframe', { class: 'sv-frame', src: streetViewEmbedUrl(node, node.heading, key), loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade' }),
      div({ class: 'row' }, [
        btn('◀ Prev', () => { crawl.idx = Math.max(0, crawl.idx - 1); renderCrawl(); }, 'btn small ghost'),
        btn('✓ Mark Captured', () => advance('have', 'manual', hasKey(key) ? streetViewImageUrl(node, node.heading, key) : null), 'btn small'),
        btn('⤳ Skip (satellite spoof)', () => advance('fallback', 'satellite-spoof', hasKey(key) ? staticSatelliteUrl(node, key) : null), 'btn small ghost'),
        btn('Next ▶', () => { crawl.idx = Math.min(nodes.length - 1, crawl.idx + 1); renderCrawl(); }, 'btn small ghost')
      ]),
      div({ class: 'hint small' }, 'Pan/zoom inside the Street View, then Mark Captured. Progress is checkpointed after every node — close and resume any time.')
    );
  }
  renderImageryControls();

  const inputArea = div();
  function renderInputArea() {
    inputArea.innerHTML = '';
    if (state.inputMode === 'waypoints') {
      const ta = el('textarea', {
        class: 'mono', rows: 8,
        placeholder: '43.6532,-79.3832\n43.6601,-79.3790\n43.6700,-79.3700',
        oninput: (e) => { state.rawWaypoints = e.target.value; }
      });
      ta.value = state.rawWaypoints;
      inputArea.append(field('Waypoints (lat,lng per line)', ta));
    } else {
      const ta = el('textarea', {
        class: 'mono', rows: 4, placeholder: 'Encoded polyline string…',
        oninput: (e) => { state.rawPolyline = e.target.value; }
      });
      ta.value = state.rawPolyline;
      inputArea.append(field('Encoded polyline', ta));
    }
  }
  renderInputArea();

  let mapsUrl = '';
  const captureCard = div({ class: 'card' }, [
    h(2, 'Capture from Google Maps (human-in-the-loop)'),
    div({ class: 'hint' }, 'Build your route in Google Maps, then paste its URL back here. ' +
      'Browser security prevents a web page from reading or clicking inside another site’s tab, so the human stays in the loop: ' +
      'you draw + paste the route, then step through Street View in the guided crawl below (checkpointed & resumable).'),
    div({ class: 'row' }, [
      btn('Open Google Maps ↗', () => window.open(mapsDirectionsUrl(), 'gmaps', 'width=1100,height=820')),
    ]),
    field('Paste Google Maps route URL', textInput('', (v) => { mapsUrl = v; }, 'https://www.google.com/maps/dir/...')),
    btn('Parse URL → waypoints', () => {
      const pts = parseGoogleMapsUrl(mapsUrl);
      if (pts.length < 2) { setStatus('Could not find ≥2 coordinates in that URL. Try the full /dir/ link.', 'err'); return; }
      state.inputMode = 'waypoints';
      state.rawWaypoints = pts.map((p) => `${p.lat},${p.lng}`).join('\n');
      renderInputArea();
      setStatus(`Parsed ${pts.length} waypoints from the URL.`, 'ok');
    }, 'btn ghost')
  ]);

  return screen(existing ? 'Edit Real Route' : 'Import Real Route', ctx, [
    captureCard,
    div({ class: 'card' }, [
      h(2, 'Source'),
      div({ class: 'hint' }, 'Paste waypoints from a Google Maps route, or an encoded polyline. ' +
        'Material is best-guessed from the path (default asphalt); override below.'),
      field('Name', textInput(state.name, (v) => { state.name = v; })),
      field('Input mode', select(
        [{ value: 'waypoints', label: 'Waypoints (lat,lng)' }, { value: 'polyline', label: 'Encoded polyline' }],
        state.inputMode, (v) => { state.inputMode = v; renderInputArea(); })),
      inputArea,
      field('Best-guess surface', select(surfaceOpts, state.surface, (v) => { state.surface = v; })),
      field('Skybox', select(skyOpts, state.skybox, (v) => { state.skybox = v; })),
      div({ class: keyState ? 'ok' : 'warn' }, keyState ? 'Google Maps API key detected.' : 'No Google Maps API key (Settings) — elevation & Street View disabled; satellite-spoof fallback used.'),
      div({ class: 'row' }, [
        btn('Build route', () => generate(false)),
        btn('Build & Ride', () => generate(true)),
        btn('Cancel', () => ctx.router.go('routes'), 'btn ghost')
      ]),
      status
    ]),
    imageryControls
  ], { backTo: 'routes' });
}
