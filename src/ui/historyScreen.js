import { div, el, btn, screen, table } from './dom.js';
import { getState, getRoute, deleteActivity, getPB } from '../state.js';
import { formatTime, formatString } from '../game/units.js';

// Folder cowork through the maker's shared panel (https://adervec.github.io/cowork.js, fs mode):
// the panel drives a folder you pick; we hand it the ride history as coach/request.json and show
// whatever an agent writes to coach/reply.json. Nothing here talks to a network.
function loadCowork() {
  if (window.cowork) return Promise.resolve(window.cowork);
  const head = document.head || document.documentElement;
  if (!head || typeof head.appendChild !== "function") return Promise.resolve(null);
  return new Promise((res) => {
    try {
      const s = document.createElement("script"); s.src = "https://adervec.github.io/cowork.js"; s.async = true;
      s.onload = () => res(window.cowork || null); s.onerror = () => res(null);
      head.appendChild(s);
    } catch { res(null); }
  });
}
function coworkHash(text) { let h = 5381; for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0; return h.toString(16); }
function coworkManifest(app) {
  return { protocol: "cowork-manifest", protocolVersion: 1, app,
    channels: [{ name: "coach", request: ["coach/request.json"], instructions: "coach/INSTRUCTIONS.md", replyPath: "coach/reply.json" }] };
}
function coworkEnvelope(protocol, payload) {
  return { protocol, protocolVersion: 1, kind: "coach-request", generatedAt: new Date().toISOString(),
    requestHash: coworkHash(JSON.stringify(payload)), payload };
}
function coworkReplyText(reply) {
  return typeof reply === "string" ? reply : (reply && (reply.reply || (reply.payload && reply.payload.reply))) || JSON.stringify(reply, null, 2);
}
const COACH_INSTRUCTIONS = `# Black Mirror Bike Ride — coach channel

Read \`coach/request.json\`: \`payload.rides\` is the ride history (route, date, duration s, distance m,
avg power W, avg speed m/s, ascent m, lap time s, personal best flag). Write \`coach/reply.json\`:

\`\`\`json
{ "requestHash": "<copy the request's requestHash verbatim>",
  "reply": "<short, specific training notes in markdown: what the numbers say is improving, one or two rides from the list worth repeating and why, a realistic week. Encouraging, no lectures.>" }
\`\`\`
`;
function coachSection(acts, isPB) {
  const host = div({ class: 'coach-host' });
  const out = el('pre', { class: 'coach-reply hint', style: 'white-space:pre-wrap;display:none;margin-top:10px' });
  const show = (text) => { out.textContent = text; out.style.display = text ? '' : 'none'; };
  try { show(localStorage.getItem('bmbr-coach-reply') || ''); } catch { /* private mode */ }
  loadCowork().then((cw) => {
    if (!cw || host.childElementCount) return;
    cw.mount(host, {
      app: 'blackmirrorbikeride', manifest: coworkManifest('blackmirrorbikeride'),
      files: () => ({
        'coach/request.json': coworkEnvelope('blackmirrorbikeride-coach', { rides: acts.slice(0, 40).map((a) => ({
          route: a.routeName, reverse: !!a.reverse, date: a.date, durationS: a.durationS, distanceM: a.distanceM, avgPower: a.avgPower,
          avgSpeed: a.avgSpeed, ascentM: a.ascentM, lapTimeS: a.lapTimeS, pb: isPB(a) })) }),
        'coach/INSTRUCTIONS.md': COACH_INSTRUCTIONS
      }),
      apply: (_ch, reply) => { const text = coworkReplyText(reply); try { localStorage.setItem('bmbr-coach-reply', text); } catch { /* quota */ } show(text); }
    });
  });
  return div({ class: 'coach' }, [
    div({ class: 'hint' }, 'Coach · hand your rides to an agent through a folder (CoworkSyncHub, Claude Desktop, a person) — the reply shows here. Nothing is uploaded.'),
    host, out
  ]);
}

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
    table(COLS, rows, { empty: 'No recorded activities yet. Go ride something!' }),
    route ? null : coachSection(acts, isPB)
  ], { backTo: route ? 'routes' : 'menu' });
}
