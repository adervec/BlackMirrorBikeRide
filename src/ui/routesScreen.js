import { div, h, el, btn, screen, table } from './dom.js';
import { getState, deleteRoute, upsertRoute, getActivitiesForRoute, getPB, activityCountForRoute, STORAGE_LOCATION } from '../state.js';
import { totalDistance } from '../routes/virtualRoute.js';
import { SKYBOXES } from '../routes/skyboxes.js';
import { BIOMES } from '../routes/biomes.js';
import { formatTime } from '../game/units.js';
import { exportRoute, exportAllRoutes, parseRoutesFile, cloneRoute } from '../routes/io.js';

export function renderRoutes(ctx) {
  const s = getState();

  // hidden file input for import
  const fileInput = el('input', {
    type: 'file', accept: '.json,application/json', style: { display: 'none' },
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const routes = parseRoutesFile(await file.text());
        if (!routes.length) throw new Error('No valid routes found in file.');
        routes.forEach((r) => upsertRoute(r));
        ctx.router.go('routes');
      } catch (err) { alert('Import failed: ' + err.message); }
    }
  });

  // Total climb and the terrain it crosses — the two things you actually pick a
  // route on, and neither was visible.
  const ascentOf = (r) => r.segments.reduce((m, seg) => m + (seg.gradient > 0 ? seg.gradient * seg.length : 0), 0);
  const terrainOf = (r) => [...new Set(r.segments.map((seg) => BIOMES[seg.biome]?.label || seg.biome))];

  const COLS = [
    // Type, terrain and sky live under the name rather than in columns of their
    // own — that keeps the action buttons on screen without sideways scrolling.
    { label: 'Route', cell: (r) => {
      const terrain = terrainOf(r);
      const sky = SKYBOXES[r.skybox]?.label || (r.skybox?.startsWith('sky-') ? 'custom' : r.skybox);
      return div({ class: 't-name' }, [
        el('span', {}, r.name),
        r.type === 'real' ? el('span', { class: 'badge badge-real' }, 'gpx') : null,
        r.bundled ? el('span', { class: 'badge badge-virtual', title: 'Ships with the app' }, 'built-in') : null,
        div({ class: 't-sub' }, terrain.slice(0, 3).join(', ') + (terrain.length > 3 ? '…' : '') + ' · ' + sky)
      ]);
    } },
    { label: 'Distance', align: 'right', cell: (r) => `${(totalDistance(r) / 1000).toFixed(1)} km` },
    { label: 'Climb', align: 'right', cell: (r) => `${Math.round(ascentOf(r))} m` },
    { label: 'Rides', align: 'right', cell: (r) => String(activityCountForRoute(r.id)) },
    { label: 'PB', align: 'right', cell: (r) => {
      const pb = getPB(r.id, false) || getPB(r.id, true);
      return pb ? formatTime(pb.lapTimeS) : '—';
    } },
    { label: '', cell: (r) => {
      const editable = activityCountForRoute(r.id) === 0;
      const editTarget = r.type === 'real' ? 'real' : 'builder';
      return div({ class: 't-actions' }, [
        btn('Ride ▷', () => ctx.router.go('ride', { routeId: r.id, reverse: false }), 'btn small'),
        btn('◁', () => ctx.router.go('ride', { routeId: r.id, reverse: true }), 'btn small ghost'),
        btn('⏩', () => ctx.router.go('ride', { routeId: r.id, reverse: false, mode: 'preview' }), 'btn small ghost'),
        btn('History', () => ctx.router.go('history', { routeId: r.id }), 'btn small ghost'),
        editable
          ? btn('Edit', () => ctx.router.go(editTarget, { routeId: r.id }), 'btn small ghost')
          : el('span', { class: 'lock-note', title: 'Routes with activities are locked to protect PBs/replays — clone to edit.' }, '🔒'),
        btn('Clone', () => { const c = cloneRoute(r); upsertRoute(c); ctx.router.go('routes'); }, 'btn small ghost'),
        btn('⤓', () => exportRoute(r), 'btn small ghost'),
        btn('✕', () => { if (confirm(`Delete "${r.name}"?`)) { deleteRoute(r.id); ctx.router.go('routes'); } }, 'btn small icon danger')
      ]);
    } }
  ];

  // The bundled library makes this list long, so filter it by name or terrain.
  const list = div();
  const count = div({ class: 'table-note' });
  function renderList(q = '') {
    const needle = q.trim().toLowerCase();
    const shown = s.routes.filter((r) => !needle ||
      r.name.toLowerCase().includes(needle) ||
      terrainOf(r).some((t) => t.toLowerCase().includes(needle)));
    list.innerHTML = '';
    list.append(table(COLS, shown, { empty: `No route matches “${q}”.` }));
    count.textContent = needle
      ? `${shown.length} of ${s.routes.length} routes`
      : `${s.routes.length} routes · ${Math.round(s.routes.reduce((t, r) => t + totalDistance(r), 0) / 1000)} km total`;
  }
  const search = el('input', {
    type: 'search', placeholder: 'Filter by name or terrain (e.g. gravel, alpine, void)…',
    oninput: (e) => renderList(e.target.value)
  });
  renderList();

  return screen('Ride — Choose a Route', ctx, [
    s.routes.length ? div({ class: 'field' }, [search, count]) : null,
    s.routes.length ? list : div({ class: 'empty' }, 'No routes yet. Build one below.'),
    div({ class: 'row' }, [
      btn('+ New Virtual Route', () => ctx.router.go('builder')),
      btn('+ Import GPX Route', () => ctx.router.go('real'), 'btn ghost'),
      btn('⤓ Import from file', () => fileInput.click(), 'btn ghost'),
      s.routes.length ? btn('⤒ Export all', () => exportAllRoutes(s.routes), 'btn ghost') : null,
      fileInput
    ]),
    div({ class: 'hint' }, `Routes are stored in ${STORAGE_LOCATION}. Edit is locked once a route has activities (clone it to make an editable copy). Export to back up or share.`)
  ]);
}
