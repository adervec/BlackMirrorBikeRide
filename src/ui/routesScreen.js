import { div, h, el, btn, screen } from './dom.js';
import { getState, deleteRoute, upsertRoute, getActivitiesForRoute, getPB, activityCountForRoute, STORAGE_LOCATION } from '../state.js';
import { totalDistance } from '../routes/virtualRoute.js';
import { SKYBOXES } from '../routes/skyboxes.js';
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

  const list = div({ class: 'route-list' }, s.routes.map((r) => {
    const km = (totalDistance(r) / 1000).toFixed(2);
    const sky = SKYBOXES[r.skybox]?.label || (r.skybox?.startsWith('sky-') ? 'custom sky' : r.skybox);
    const nAct = activityCountForRoute(r.id);
    const pb = getPB(r.id, false) || getPB(r.id, true);
    const editable = nAct === 0;
    const editTarget = r.type === 'real' ? 'real' : 'builder';
    return div({ class: 'route-card' }, [
      div({ class: 'route-head' }, [
        h(2, r.name),
        el('span', { class: 'badge ' + (r.type === 'real' ? 'badge-real' : 'badge-virtual') }, r.type)
      ]),
      div({ class: 'route-meta' }, `${km} km · ${r.segments.length} segments · sky: ${sky} · ` +
        `${nAct} activity(ies)` + (pb ? ` · PB ${formatTime(pb.lapTimeS)}` : '')),
      div({ class: 'row' }, [
        btn('Ride ▷', () => ctx.router.go('ride', { routeId: r.id, reverse: false })),
        btn('Reverse ◁', () => ctx.router.go('ride', { routeId: r.id, reverse: true }), 'btn ghost'),
        btn('Preview ⏩', () => ctx.router.go('ride', { routeId: r.id, reverse: false, mode: 'preview' }), 'btn ghost'),
        btn('History', () => ctx.router.go('history', { routeId: r.id }), 'btn ghost'),
        editable
          ? btn('Edit', () => ctx.router.go(editTarget, { routeId: r.id }), 'btn ghost')
          : el('span', { class: 'lock-note', title: 'Routes with activities are locked to protect PBs/replays — clone to edit.' }, '🔒 locked'),
        btn('Clone', () => { const c = cloneRoute(r); upsertRoute(c); ctx.router.go('routes'); }, 'btn ghost'),
        btn('Export', () => exportRoute(r), 'btn ghost'),
        btn('Delete', () => { if (confirm(`Delete "${r.name}"?`)) { deleteRoute(r.id); ctx.router.go('routes'); } }, 'btn danger')
      ])
    ]);
  }));

  return screen('Ride — Choose a Route', ctx, [
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
