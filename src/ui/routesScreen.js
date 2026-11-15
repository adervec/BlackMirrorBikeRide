import { div, h, el, btn, screen, table } from './dom.js';
import { getState, deleteRoute, upsertRoute, getActivitiesForRoute, getPB, activityCountForRoute, STORAGE_LOCATION } from '../state.js';
import { totalDistance } from '../routes/virtualRoute.js';
import { SKYBOXES } from '../routes/skyboxes.js';
import { BIOMES } from '../routes/biomes.js';
import { formatTime } from '../game/units.js';
import { exportRoute, exportAllRoutes, parseRoutesFile, cloneRoute } from '../routes/io.js';
import { t, num } from '../i18n.js';

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
        if (!routes.length) throw new Error(t('No valid routes found in file.'));
        routes.forEach((r) => upsertRoute(r));
        ctx.router.go('routes');
      } catch (err) { alert(t('Import failed: {error}', { error: err.message })); }
    }
  });

  // Total climb and the terrain it crosses — the two things you actually pick a
  // route on, and neither was visible.
  const ascentOf = (r) => r.segments.reduce((m, seg) => m + (seg.gradient > 0 ? seg.gradient * seg.length : 0), 0);
  const terrainOf = (r) => [...new Set(r.segments.map((seg) => BIOMES[seg.biome]?.label || seg.biome))];

  const COLS = [
    // Type, terrain and sky live under the name rather than in columns of their
    // own — that keeps the action buttons on screen without sideways scrolling.
    { label: t('Route'), cell: (r) => {
      const terrain = terrainOf(r);
      const sky = SKYBOXES[r.skybox]?.label || (r.skybox?.startsWith('sky-') ? t('custom') : r.skybox);
      return div({ class: 't-name' }, [
        el('span', {}, r.name),
        r.type === 'real' ? el('span', { class: 'badge badge-real' }, 'gpx') : null,
        r.bundled ? el('span', { class: 'badge badge-virtual', title: t('Ships with the app') }, t('built-in')) : null,
        div({ class: 't-sub' }, terrain.slice(0, 3).join(', ') + (terrain.length > 3 ? '…' : '') + ' · ' + sky)
      ]);
    } },
    { label: t('Distance'), align: 'right', cell: (r) => `${num(totalDistance(r) / 1000, 1)} km` },
    { label: t('Climb'), align: 'right', cell: (r) => `${Math.round(ascentOf(r))} m` },
    { label: t('Rides'), align: 'right', cell: (r) => String(activityCountForRoute(r.id)) },
    { label: t('PB'), align: 'right', cell: (r) => {
      const pb = getPB(r.id, false) || getPB(r.id, true);
      return pb ? formatTime(pb.lapTimeS) : '—';
    } },
    { label: '', cell: (r) => {
      const editable = activityCountForRoute(r.id) === 0;
      const editTarget = r.type === 'real' ? 'real' : 'builder';
      return div({ class: 't-actions' }, [
        btn(t('Ride ▷'), () => ctx.router.go('ride', { routeId: r.id, reverse: false }), 'btn small'),
        btn('◁', () => ctx.router.go('ride', { routeId: r.id, reverse: true }), 'btn small ghost'),
        btn('⏩', () => ctx.router.go('ride', { routeId: r.id, reverse: false, mode: 'preview' }), 'btn small ghost'),
        btn(t('History'), () => ctx.router.go('history', { routeId: r.id }), 'btn small ghost'),
        editable
          ? btn(t('Edit'), () => ctx.router.go(editTarget, { routeId: r.id }), 'btn small ghost')
          : el('span', { class: 'lock-note', title: t('Routes with activities are locked to protect PBs/replays — clone to edit.') }, '🔒'),
        btn(t('Clone'), () => { const c = cloneRoute(r); upsertRoute(c); ctx.router.go('routes'); }, 'btn small ghost'),
        btn('⤓', () => exportRoute(r), 'btn small ghost'),
        btn('✕', () => { if (confirm(t('Delete "{name}"?', { name: r.name }))) { deleteRoute(r.id); ctx.router.go('routes'); } }, 'btn small icon danger')
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
      terrainOf(r).some((name) => name.toLowerCase().includes(needle)));
    list.innerHTML = '';
    list.append(table(COLS, shown, { empty: t('No route matches “{q}”.', { q }) }));
    count.textContent = needle
      ? t.n('{shown} of {n} route', '{shown} of {n} routes', s.routes.length, { shown: shown.length })
      : t.n('{n} route · {km} km total', '{n} routes · {km} km total', s.routes.length, { km: Math.round(s.routes.reduce((sum, r) => sum + totalDistance(r), 0) / 1000) });
  }
  const search = el('input', {
    type: 'search', placeholder: t('Filter by name or terrain (e.g. gravel, alpine, void)…'),
    oninput: (e) => renderList(e.target.value)
  });
  renderList();

  return screen(t('Ride — Choose a Route'), ctx, [
    s.routes.length ? div({ class: 'field' }, [search, count]) : null,
    s.routes.length ? list : div({ class: 'empty' }, t('No routes yet. Build one below.')),
    div({ class: 'row' }, [
      btn(t('+ New Virtual Route'), () => ctx.router.go('builder')),
      btn(t('+ Import GPX Route'), () => ctx.router.go('real'), 'btn ghost'),
      btn(t('⤓ Import from file'), () => fileInput.click(), 'btn ghost'),
      s.routes.length ? btn(t('⤒ Export all'), () => exportAllRoutes(s.routes), 'btn ghost') : null,
      fileInput
    ]),
    div({ class: 'hint' }, t('Routes are stored in {where}. Edit is locked once a route has activities (clone it to make an editable copy). Export to back up or share.', { where: STORAGE_LOCATION }))
  ]);
}
