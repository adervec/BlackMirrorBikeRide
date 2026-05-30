import { div, h, el, btn, screen } from './dom.js';
import { getState, getRoute, deleteActivity, getPB } from '../state.js';
import { formatTime, formatString } from '../game/units.js';

export function renderHistory(ctx) {
  const s = getState();
  const routeId = ctx.params.routeId || null;
  const route = routeId ? getRoute(routeId) : null;
  const u = s.settings.units;

  const acts = s.activities.filter((a) => !routeId || a.routeId === routeId);

  const body = acts.length ? div({ class: 'history-list' }, acts.map((a) => {
    const pb = getPB(a.routeId, a.reverse);
    const isPB = pb && pb.id === a.id;
    const date = new Date(a.date);
    const routeMissing = !getRoute(a.routeId);
    return div({ class: 'history-card' + (isPB ? ' pb' : '') }, [
      div({ class: 'history-head' }, [
        h(3, a.routeName + (a.reverse ? ' (reverse)' : '')),
        isPB ? el('span', { class: 'badge badge-pb' }, '★ PB') : null
      ]),
      div({ class: 'history-meta' }, `${date.toLocaleString()}`),
      div({ class: 'history-stats' }, [
        stat('Lap', a.lapTimeS != null ? formatTime(a.lapTimeS) : '—'),
        stat('Duration', formatTime(a.durationS)),
        stat('Distance', formatString('distance', a.distanceM, u)),
        stat('Avg Power', formatString('power', a.avgPower, u)),
        stat('Avg Speed', formatString('speed', a.avgSpeed, u)),
        stat('Ascent', formatString('distance', a.ascentM, u))
      ]),
      div({ class: 'row' }, [
        routeMissing ? el('span', { class: 'dim' }, 'route deleted')
          : btn('Replay ⏩', () => ctx.router.go('ride', { routeId: a.routeId, reverse: a.reverse, mode: 'replay', activityId: a.id })),
        !routeMissing ? btn('Ride again', () => ctx.router.go('ride', { routeId: a.routeId, reverse: a.reverse }), 'btn ghost') : null,
        btn('Delete', () => { if (confirm('Delete this activity?')) { deleteActivity(a.id); ctx.router.go('history', ctx.params); } }, 'btn danger')
      ])
    ]);
  })) : div({ class: 'empty' }, 'No recorded activities yet. Go ride something!');

  return screen(route ? `History — ${route.name}` : 'History & PBs', ctx, [
    route ? div({ class: 'hint' }, 'Personal bests are the fastest completed lap per direction. Replay any ride or set it as your ghost target in Settings.') : null,
    body
  ], { backTo: route ? 'routes' : 'menu' });
}

function stat(label, value) {
  return div({ class: 'history-stat' }, [div({ class: 'hs-val' }, value), div({ class: 'hs-lab' }, label)]);
}
