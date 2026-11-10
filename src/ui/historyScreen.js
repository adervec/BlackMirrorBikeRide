import { div, el, btn, screen, table } from './dom.js';
import { getState, getRoute, deleteActivity, getPB } from '../state.js';
import { formatTime, formatString } from '../game/units.js';
import { buildProfile } from '../routes/virtualRoute.js';
import { activityToTcx, tcxFilename } from '../game/tcx.js';
import { downloadText } from '../routes/io.js';
import { COWORK_APP, coworkManifest, coworkFiles } from '../cloud/brief.js';
import { loadCowork, pushCoworkFolder } from '../cloud/coworkFolder.js';

// Folder cowork through the maker's shared panel (https://adervec.github.io/cowork.js, fs mode):
// the panel drives a folder you pick; we hand it the brief digest + the ride history (see
// cloud/brief.js) and show whatever an agent writes to coach/reply.json. Nothing here talks to a
// network. The same files are rewritten headlessly after every ride (cloud/coworkFolder.js).
function coworkReplyText(reply) {
  return typeof reply === "string" ? reply : (reply && (reply.reply || (reply.payload && reply.payload.reply))) || JSON.stringify(reply, null, 2);
}
function coachSection(s) {
  const host = div({ class: 'coach-host' });
  const out = el('pre', { class: 'coach-reply hint', style: 'white-space:pre-wrap;display:none;margin-top:10px' });
  const show = (text) => { out.textContent = text; out.style.display = text ? '' : 'none'; };
  try { show(localStorage.getItem('bmbr-coach-reply') || ''); } catch { /* private mode */ }
  loadCowork().then((cw) => {
    if (!cw || host.childElementCount) return;
    cw.mount(host, {
      app: COWORK_APP, manifest: coworkManifest(),
      files: () => coworkFiles(s),
      apply: (_ch, reply) => { const text = coworkReplyText(reply); try { localStorage.setItem('bmbr-coach-reply', text); } catch { /* quota */ } show(text); }
    });
  });
  return div({ class: 'coach' }, [
    div({ class: 'hint' }, 'Coach · hand your rides to an agent through a folder (CoworkSyncHub, Claude Desktop, a person) — the reply shows here. Nothing is uploaded. ' +
      'The folder also gets BRIEF.md, a precomputed digest for daily/weekly briefs, refreshed after every ride.'),
    host, out
  ]);
}

// TCX with altitude when the route still exists; without it when it doesn't.
function exportTcx(a) {
  const r = getRoute(a.routeId);
  downloadText(tcxFilename(a), activityToTcx(a, r ? buildProfile(r, { reverse: a.reverse }) : null), 'application/vnd.garmin.tcx+xml');
}

export function renderHistory(ctx) {
  const s = getState();
  const routeId = ctx.params.routeId || null;
  const route = routeId ? getRoute(routeId) : null;
  const u = s.settings.units;
  pushCoworkFolder(s); // keep the folder current whenever someone looks at history

  const acts = s.activities.filter((a) => !routeId || a.routeId === routeId);
  const isPB = (a) => { const pb = getPB(a.routeId, a.reverse); return pb && pb.id === a.id; };

  const COLS = [
    { label: 'Ride', cell: (a) => div({ class: 't-name' }, [
      el('span', {}, a.routeName + (a.reverse ? ' ↺' : '')),
      isPB(a) ? el('span', { class: 'badge badge-pb' }, '★ PB') : null,
      a.workoutName ? el('span', { class: 'badge badge-virtual', title: 'Structured workout' }, a.workoutName) : null,
      div({ class: 't-sub' }, new Date(a.date).toLocaleString() + (a.source ? ` · ${a.source}` : ''))
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
        btn('⤓ TCX', () => exportTcx(a), 'btn small ghost'),
        btn('✕', () => { if (confirm('Delete this activity?')) { deleteActivity(a.id); pushCoworkFolder(); ctx.router.go('history', ctx.params); } }, 'btn small icon danger')
      ]);
    } }
  ];

  const rows = acts.map((a) => ({ ...a, _rowClass: isPB(a) ? 'is-pb' : null }));

  return screen(route ? `History — ${route.name}` : 'History & PBs', ctx, [
    route ? div({ class: 'hint' }, 'Personal bests are the fastest completed lap per direction. Replay any ride or set it as your ghost target in Settings.') : null,
    acts.length ? div({ class: 'table-note' }, `${acts.length} ride(s) · ${formatString('distance', acts.reduce((t, a) => t + a.distanceM, 0), u)} total · TCX files upload to Strava, Intervals.icu, Garmin Connect…`) : null,
    table(COLS, rows, { empty: 'No recorded activities yet. Go ride something!' }),
    route ? null : coachSection(s)
  ], { backTo: route ? 'routes' : 'menu' });
}
