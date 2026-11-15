// GPX import screen: pick a .gpx file, get a ridable real-world route.
// Geometry (distance/turn/gradient) is computed deterministically here; for
// real-world scenery (per-segment biomes, landmarks) ask Claude to enrich the
// GPX with the `gpx-route` skill — see README.

import { div, h, el, field, select, textInput, btn, screen } from './dom.js';
import { getState, getRoute, upsertRoute } from '../state.js';
import { totalDistance } from '../routes/virtualRoute.js';
import { surfaceList } from '../physics/surfaces.js';
import { allSkyboxOptions } from '../routes/skyboxes.js';
import { biomeList } from '../routes/biomes.js';
import { parseGpx, gpxToRoute } from '../routes/gpx.js';
import { t, num } from '../i18n.js';

export function renderGpxImport(ctx) {
  const s = getState();
  const existing = ctx.params.routeId ? getRoute(ctx.params.routeId) : null;

  const state = {
    name: existing?.name || '',
    surface: 'asphalt',
    biome: 'satellite',
    skybox: existing?.skybox || 'clear-day',
    parsed: null
  };

  const status = div({ class: 'build-status' });
  function setStatus(msg, cls = '') { status.innerHTML = ''; status.append(el('div', { class: cls }, msg)); }

  const surfaceOpts = surfaceList().map((x) => ({ value: x.id, label: x.label }));
  const skyOpts = allSkyboxOptions(s.customSkyboxes).map((x) => ({ value: x.id, label: x.label }));
  const biomeOpts = biomeList().map((x) => ({ value: x.id, label: x.label }));

  const nameInput = textInput(state.name, (v) => { state.name = v; });

  const fileInput = el('input', {
    type: 'file', accept: '.gpx',
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        state.parsed = parseGpx(await file.text());
        if (!state.name) {
          state.name = state.parsed.name || file.name.replace(/\.gpx$/i, '');
          nameInput.value = state.name;
        }
        // Run the conversion once just for the stats line.
        const preview = gpxToRoute(state.parsed, state);
        const km = num(totalDistance(preview) / 1000, 2);
        setStatus(preview.hasElevation
          ? t.n('Parsed {n} trackpoint · {km} km · elevation data found.', 'Parsed {n} trackpoints · {km} km · elevation data found.', state.parsed.points.length, { km })
          : t.n('Parsed {n} trackpoint · {km} km · no elevation — riding flat.', 'Parsed {n} trackpoints · {km} km · no elevation — riding flat.', state.parsed.points.length, { km }), 'ok');
      } catch (err) {
        state.parsed = null;
        setStatus(err.message, 'err');
      }
    }
  });

  function saveRoute(thenRide) {
    try {
      if (existing && !state.parsed) {
        // Edit without new geometry: rename / reskybox only.
        existing.name = state.name || existing.name;
        existing.skybox = state.skybox;
        upsertRoute(existing);
        if (thenRide) ctx.router.go('ride', { routeId: existing.id, reverse: false });
        else ctx.router.go('routes');
        return;
      }
      if (!state.parsed) throw new Error(t('Choose a GPX file first.'));
      const route = gpxToRoute(state.parsed, { ...state, name: state.name || undefined });
      if (existing) { route.id = existing.id; route.landmarks = existing.landmarks || []; }
      upsertRoute(route);
      if (thenRide) ctx.router.go('ride', { routeId: route.id, reverse: false });
      else ctx.router.go('routes');
    } catch (e) {
      setStatus(e.message, 'err');
    }
  }

  const body = [
    field(existing ? t('Replace geometry from GPX file (optional)') : t('GPX file'), fileInput),
    field(t('Name'), nameInput),
    field(t('Skybox'), select(skyOpts, state.skybox, (v) => { state.skybox = v; }))
  ];
  if (!existing) {
    // Hidden in edit mode so re-saving never bulk-clobbers per-segment
    // biomes/surfaces on a Claude-enriched route.
    body.splice(2, 0,
      field(t('Surface'), select(surfaceOpts, state.surface, (v) => { state.surface = v; })),
      field(t('Biome'), select(biomeOpts, state.biome, (v) => { state.biome = v; }))
    );
  }

  return screen(existing ? t('Edit GPX Route') : t('Import GPX Route'), ctx, [
    div({ class: 'card' }, [
      h(2, existing ? t('Route') : t('GPX file')),
      div({ class: 'hint' }, t('Export a GPX from Strava, Komoot, RideWithGPS, Garmin… and ride it in 3D. Distance, turns and gradients come straight from the track.')),
      ...body,
      div({ class: 'row' }, [
        btn(t('Save route'), () => saveRoute(false)),
        btn(t('Save & Ride'), () => saveRoute(true)),
        btn(t('Cancel'), () => ctx.router.go('routes'), 'btn ghost')
      ]),
      status,
      div({ class: 'hint small' }, t('Want real-world scenery — biomes that change along the ride, named landmarks? Ask Claude to enrich this GPX with the gpx-route skill (see README).'))
    ])
  ], { backTo: 'routes' });
}
