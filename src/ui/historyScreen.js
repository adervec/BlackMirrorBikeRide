import { div, el, btn, screen, table } from './dom.js';
import { getState, getRoute, deleteActivity, getPB } from '../state.js';
import { formatTime, formatString } from '../game/units.js';

export function renderHistory(ctx) {
  const s = getState();
  const routeId = ctx.params.routeId || null;
  const route = routeId ? getRoute(routeId) : null;
  const u = s.settings.units;

  const acts = s.activities.filter((a) => !routeId || a.routeId === routeId);
  const isPB = (a) => { const pb = getPB(a.routeId, a.reverse); return pb && pb.id === a.id; };

  const COLS = [
    { label: 'Ride', cell: (a) => div({ class: 't-name' }, [
      el('span', {}, a.routeName + (a.reverse ? ' ↺' : '')),
      isPB(a) ? el('span', { class: 'badge badge-pb' }, '★ PB') : null,
      div({ class: 't-sub' }, new Date(a.date).toLocaleString())
    ]) },
    { label: 'Lap', align: 'right', cell: (a) => (a.lapTimeS != null ? formatTime(a.lapTimeS) : '—') },
    { label: 'Duration', align: 'right', cell: (a) => formatTime(a.durationS) },
    { label: 'Distance', align: 'right', cell: (a) => formatString('distance', a.distanceM, u) },
    { label: 'Avg Power', align: 'right', cell: (a) => formatString('power', a.avgPower, u) },
    { label: 'Avg Speed', align: 'right', cell: (a) => formatString('speed', a.avgSpeed, u) },
    { label: 'Ascent', align: 'right', cell: (a) => formatString('distance', a.ascentM, u) },
    { label: '', cell: (a) => {
      const missing = !getRoute(a.routeId);
      return div({ class: 't-actions' }, [
        missing ? el('span', { class: 'dim small' }, 'route deleted')
          : btn('Replay ⏩', () => ctx.router.go('ride', { routeId: a.routeId, reverse: a.reverse, mode: 'replay', activityId: a.id }), 'btn small'),
        !missing ? btn('Ride again', () => ctx.router.go('ride', { routeId: a.routeId, reverse: a.reverse }), 'btn small ghost') : null,
        btn('✕', () => { if (confirm('Delete this activity?')) { deleteActivity(a.id); ctx.router.go('history', ctx.params); } }, 'btn small icon danger')
      ]);
    } }
  ];

  const rows = acts.map((a) => ({ ...a, _rowClass: isPB(a) ? 'is-pb' : null }));

  return screen(route ? `History — ${route.name}` : 'History & PBs', ctx, [
    route ? div({ class: 'hint' }, 'Personal bests are the fastest completed lap per direction. Replay any ride or set it as your ghost target in Settings.') : null,
    acts.length ? div({ class: 'table-note' }, `${acts.length} ride(s) · ${formatString('distance', acts.reduce((t, a) => t + a.distanceM, 0), u)} total`) : null,
    table(COLS, rows, { empty: 'No recorded activities yet. Go ride something!' })
  ], { backTo: route ? 'routes' : 'menu' });
}
