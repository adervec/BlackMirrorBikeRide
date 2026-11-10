// What the app writes into its cowork folder (pure — no DOM, no I/O; see
// cloud/coworkFolder.js for the writing and ui/historyScreen.js for the panel).
//
//   cowork.json          discovery manifest (house cowork protocol v1)
//   BRIEF.md, brief.json the app's own conclusions, precomputed, so a daily /
//                        weekly brief reads one small file instead of
//                        re-deriving everything from forty rides of samples
//   README.md            what's in the folder and where to start
//   coach/request.json   the coach channel: recent rides in full detail
//   coach/INSTRUCTIONS.md
//
// All numbers are SI (seconds, metres, m/s, watts, kJ) unless the key says
// otherwise. Same content in BRIEF.md (for reading) and brief.json (for code).

import { pbForRoute, activityStats } from '../game/activity.js';

export const COWORK_APP = 'blackmirrorbikeride';
const DAY = 86400000;
const DEFAULT_FTP = 220;

export function coworkManifest() {
  return {
    protocol: 'cowork-manifest', protocolVersion: 1, app: COWORK_APP,
    channels: [{ name: 'coach', request: ['coach/request.json'], instructions: 'coach/INSTRUCTIONS.md', replyPath: 'coach/reply.json' }]
  };
}

export function coworkHash(text) { let h = 5381; for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0; return h.toString(16); }

function envelope(protocol, kind, payload) {
  return { protocol, protocolVersion: 1, kind, generatedAt: new Date().toISOString(), requestHash: coworkHash(JSON.stringify(payload)), payload };
}

// ---- helpers ----------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const mondayOf = (ms) => { const d = new Date(startOfDay(ms)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const round = (v, dp = 0) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp);
const sum = (list, f) => list.reduce((t, x) => t + (f(x) || 0), 0);
const hms = (s) => { if (s == null) return '—'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`; };
const km = (m) => (m == null ? '—' : (m / 1000).toFixed(1));
const num = (v, dp = 0) => (v == null ? '—' : v.toFixed(dp));

function tssOf(a, ftp) {
  const np = activityStats(a).normPower;
  if (!ftp || !np || !a.durationS) return null;
  return (a.durationS * np * (np / ftp)) / (ftp * 3600) * 100;
}

function totals(list, ftp) {
  const time = sum(list, (a) => a.durationS);
  return {
    rides: list.length,
    timeS: round(time),
    distanceM: round(sum(list, (a) => a.distanceM)),
    ascentM: round(sum(list, (a) => a.ascentM)),
    kJ: round(sum(list, (a) => a.energyJ) / 1000),
    avgPower: time ? round(sum(list, (a) => (a.avgPower || 0) * (a.durationS || 0)) / time) : null,
    tss: round(sum(list, (a) => tssOf(a, ftp)))
  };
}

const sortedActivities = (state) => (state.activities || [])
  .filter((a) => a && a.date && Number.isFinite(Date.parse(a.date)))
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

// One ride as the brief and the coach channel describe it. `acts` is the whole
// history (for the PB / first-ride flags), `ftp` the rider's current FTP.
export function rideRow(a, acts, ftp) {
  const st = activityStats(a);
  const same = acts.filter((x) => x.routeId === a.routeId && !!x.reverse === !!a.reverse);
  return {
    id: a.id, date: a.date, route: a.routeName, reverse: !!a.reverse, source: a.source || null, workout: a.workoutName || null,
    durationS: round(a.durationS), lapTimeS: round(a.lapTimeS), distanceM: round(a.distanceM), ascentM: round(a.ascentM),
    avgPower: round(a.avgPower), normPower: round(st.normPower), maxPower: round(st.maxPower), avgSpeedMs: round(a.avgSpeed, 2),
    avgHr: round(st.avgHr), kJ: round((a.energyJ || 0) / 1000), tss: round(tssOf(a, ftp)),
    pb: pbForRoute(acts, a.routeId, a.reverse)?.id === a.id, firstRide: same.length === 1,
    zoneTime: Array.isArray(a.zoneTime) ? a.zoneTime.map((z) => round(z)) : null,
    ftpEstimate: a.ftpEstimate || null
  };
}

// ---- the brief --------------------------------------------------------------
export function buildBrief(state, now = Date.now()) {
  const acts = sortedActivities(state);
  const player = (state.players || []).find((p) => p.id === state.activePlayerId) || (state.players || [])[0] || {};
  const ftp = player.ftpW || null;
  const age = (a) => (now - Date.parse(a.date)) / DAY;
  const within = (days) => acts.filter((a) => age(a) < days);
  const isPB = (a) => pbForRoute(acts, a.routeId, a.reverse)?.id === a.id;
  const ridesOn = (routeId, reverse) => acts.filter((a) => a.routeId === routeId && !!a.reverse === !!reverse);
  const row = (a) => rideRow(a, acts, ftp);

  const todayActs = acts.filter((a) => dayKey(Date.parse(a.date)) === dayKey(now));
  const last7 = within(7), last28 = within(28);
  const prev7 = acts.filter((a) => age(a) >= 7 && age(a) < 14);

  const days = Array.from({ length: 7 }, (_, i) => {
    const ms = startOfDay(now) - i * DAY, key = dayKey(ms);
    return { date: key, ...totals(acts.filter((a) => dayKey(Date.parse(a.date)) === key), ftp) };
  });
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = mondayOf(now) - i * 7 * DAY;
    return { weekStart: dayKey(start), ...totals(acts.filter((a) => { const t = Date.parse(a.date); return t >= start && t < start + 7 * DAY; }), ftp) };
  });

  // consistency
  const rideDays28 = [...new Set(last28.map((a) => dayKey(Date.parse(a.date))))].sort().reverse();
  let streak = 0;
  for (let d = startOfDay(now); ; d -= DAY) {
    const hit = rideDays28.includes(dayKey(d));
    if (hit) streak++;
    else if (d === startOfDay(now)) continue; // a rest day today doesn't break the streak yet
    else break;
    if (d < now - 28 * DAY) break;
  }
  let longestGap = null;
  if (rideDays28.length) {
    const ds = rideDays28.map((k) => Date.parse(k + 'T00:00:00')).sort((a, b) => a - b);
    longestGap = 0;
    for (let i = 1; i < ds.length; i++) longestGap = Math.max(longestGap, Math.round((ds[i] - ds[i - 1]) / DAY) - 1);
    longestGap = Math.max(longestGap, Math.floor((startOfDay(now) - ds[ds.length - 1]) / DAY));
  }
  const consistency = {
    daysRiddenLast7: new Set(last7.map((a) => dayKey(Date.parse(a.date)))).size,
    daysRiddenLast28: rideDays28.length,
    currentStreakDays: streak,
    daysSinceLastRide: acts.length ? Math.floor(age(acts[0])) : null,
    longestGapDaysLast28: longestGap
  };

  // routes ridden in the last 28 days
  const byRoute = new Map();
  for (const a of last28) {
    const k = `${a.routeId}|${a.reverse ? 1 : 0}`;
    const r = byRoute.get(k) || { route: a.routeName, reverse: !!a.reverse, rides: 0, bestLapS: null, allTimePbS: null, lastDate: a.date };
    r.rides++;
    if (a.lapTimeS != null) r.bestLapS = r.bestLapS == null ? round(a.lapTimeS) : Math.min(r.bestLapS, round(a.lapTimeS));
    r.allTimePbS = round(pbForRoute(acts, a.routeId, a.reverse)?.lapTimeS);
    if (Date.parse(a.date) > Date.parse(r.lastDate)) r.lastDate = a.date;
    byRoute.set(k, r);
  }
  const routes = [...byRoute.values()].sort((a, b) => b.rides - a.rides).slice(0, 8);
  const recentPBs = last7.filter((a) => isPB(a) && a.lapTimeS != null && ridesOn(a.routeId, a.reverse).length > 1)
    .map((a) => ({ date: a.date, route: a.routeName, reverse: !!a.reverse, lapTimeS: round(a.lapTimeS) }));

  // workouts & zones
  const workouts = last28.filter((a) => a.workoutName).map((a) => ({
    date: a.date, workout: a.workoutName, durationS: round(a.durationS), avgPower: round(a.avgPower), tss: round(tssOf(a, ftp)), ftpEstimate: a.ftpEstimate || null
  }));
  const zoned = last7.filter((a) => Array.isArray(a.zoneTime) && a.zoneTime.length === 7);
  let zones7 = null;
  if (zoned.length) {
    const z = zoned.reduce((acc, a) => acc.map((v, i) => v + (a.zoneTime[i] || 0)), [0, 0, 0, 0, 0, 0, 0]);
    const tot = z.reduce((a, b) => a + b, 0) || 1;
    zones7 = { secondsPerZone: z.map((v) => round(v)), percentPerZone: z.map((v) => round((v / tot) * 100)), ridesWithZones: zoned.length };
  }

  const lastTest = acts.find((a) => a.ftpEstimate);
  const ftpInfo = {
    watts: ftp, wkg: ftp && player.weightKg ? round(ftp / player.weightKg, 2) : null,
    lastTest: lastTest ? { date: lastTest.date, workout: lastTest.workoutName, estimate: lastTest.ftpEstimate, applied: lastTest.ftpEstimate === ftp } : null
  };

  // gaps the brief should know about rather than guess around
  const gaps = [];
  if (!acts.length) gaps.push('No recorded rides yet.');
  else if (consistency.daysSinceLastRide >= 14) gaps.push(`No ride in the last ${consistency.daysSinceLastRide} days.`);
  if (last28.length && last28.every((a) => activityStats(a).avgHr == null)) gaps.push('No heart-rate data in the last 28 days (no HR strap paired).');
  const simRides = last28.filter((a) => /^Simulator/i.test(a.source || '')).length;
  if (last28.length && simRides) gaps.push(`${simRides} of ${last28.length} rides in the last 28 days used the keyboard simulator, not a real power source.`);
  if (last28.length && last28.some((a) => !a.source)) gaps.push('Some older rides predate power-source tracking (sensor vs simulator unknown).');
  if (!lastTest) gaps.push(ftp === DEFAULT_FTP ? `FTP is the app default (${DEFAULT_FTP} W) — never tested or set; zones and TSS are only as good as that.` : 'FTP was set by hand, never tested in-app.');
  else if (age(lastTest) > 42) gaps.push(`Last FTP test was ${Math.floor(age(lastTest))} days ago.`);
  if (!player.weightKg) gaps.push('Rider weight is missing (no W/kg).');

  // sanity checks a brief should flag instead of trusting
  const anomalies = [];
  for (const a of last28) {
    const what = [];
    if (a.avgPower > 450) what.push(`avg ${Math.round(a.avgPower)} W`);
    if ((a.avgSpeed || 0) * 3.6 > 75) what.push(`avg ${Math.round(a.avgSpeed * 3.6)} km/h`);
    if (a.durationS > 8 * 3600) what.push(`${hms(a.durationS)} long`);
    if (a.distanceM > 400000) what.push(`${km(a.distanceM)} km`);
    if (what.length) anomalies.push({ date: a.date, route: a.routeName, what: what.join(', ') });
  }

  return {
    meta: {
      app: COWORK_APP, generatedAt: new Date(now).toISOString(), today: dayKey(now),
      units: 'SI unless the key says otherwise: seconds, metres, m/s, watts, kJ',
      rider: { name: player.name || null, weightKg: player.weightKg || null, heightCm: player.heightCm || null, ftpW: ftp, wkg: ftpInfo.wkg },
      gaps
    },
    atAGlance: { today: totals(todayActs, ftp), last7: totals(last7, ftp), prev7: totals(prev7, ftp), last28: totals(last28, ftp) },
    lastRide: acts[0] ? row(acts[0]) : null,
    days, weeks, consistency, routes, recentPBs, workouts, zones7, ftp: ftpInfo, anomalies,
    recent: acts.slice(0, 20).map(row)
  };
}

// ---- markdown rendering of the same -----------------------------------------
export function briefMarkdown(b) {
  const L = [];
  const date = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${dayKey(d.getTime())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const t = (x) => `${x.rides} · ${hms(x.timeS)} · ${km(x.distanceM)} km · ${x.ascentM ?? 0} m↑ · ${x.kJ ?? 0} kJ · TSS ${num(x.tss)}`;
  L.push('# Black Mirror Bike Ride — brief data', '',
    `Generated ${b.meta.generatedAt} · today ${b.meta.today} · ${b.meta.units}. Same content in \`brief.json\`. Full detail per ride lives in \`coach/request.json\`.`, '');
  L.push('## Data gaps', '');
  L.push(...(b.meta.gaps.length ? b.meta.gaps.map((g) => `- ${g}`) : ['- none']), '');
  L.push('## At a glance', '', '| | Rides | Time | km | Climb m | kJ | TSS |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const [label, x] of [['Today', b.atAGlance.today], ['Last 7 days', b.atAGlance.last7], ['Previous 7 days', b.atAGlance.prev7], ['Last 28 days', b.atAGlance.last28]]) {
    L.push(`| ${label} | ${x.rides} | ${hms(x.timeS)} | ${km(x.distanceM)} | ${x.ascentM ?? 0} | ${x.kJ ?? 0} | ${num(x.tss)} |`);
  }
  L.push('');
  L.push('## Last ride', '');
  if (b.lastRide) {
    const r = b.lastRide;
    L.push(`- **${r.route}${r.reverse ? ' (reverse)' : ''}** · ${date(r.date)} · source: ${r.source || 'unknown'}${r.workout ? ` · workout: ${r.workout}` : ''}${r.pb ? ' · ★ PB' : ''}${r.firstRide ? ' · first time on this route' : ''}`);
    L.push(`- ${hms(r.durationS)} (lap ${hms(r.lapTimeS)}) · ${km(r.distanceM)} km · ${r.ascentM ?? 0} m↑ · ${r.kJ} kJ`);
    L.push(`- avg ${num(r.avgPower)} W · NP ${num(r.normPower)} W · max ${num(r.maxPower)} W · TSS ${num(r.tss)} · avg HR ${num(r.avgHr)} · avg ${r.avgSpeedMs != null ? (r.avgSpeedMs * 3.6).toFixed(1) : '—'} km/h`);
    if (r.zoneTime) { const tot = r.zoneTime.reduce((a, c) => a + c, 0) || 1; L.push(`- zones: ${r.zoneTime.map((z, i) => `Z${i + 1} ${Math.round((z / tot) * 100)}%`).join(' · ')}`); }
    if (r.ftpEstimate) L.push(`- FTP test result: ${r.ftpEstimate} W`);
  } else L.push('- none yet');
  L.push('');
  L.push('## Last 7 days', '', '| Date | Rides | Time | km | Climb m | kJ | TSS |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const d of b.days) L.push(`| ${d.date} | ${d.rides} | ${hms(d.timeS)} | ${km(d.distanceM)} | ${d.ascentM ?? 0} | ${d.kJ ?? 0} | ${num(d.tss)} |`);
  L.push('');
  L.push('## Weekly trend (8 weeks, Monday start, newest first)', '', '| Week of | Rides | Time | km | Climb m | kJ | TSS | Avg W |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const w of b.weeks) L.push(`| ${w.weekStart} | ${w.rides} | ${hms(w.timeS)} | ${km(w.distanceM)} | ${w.ascentM ?? 0} | ${w.kJ ?? 0} | ${num(w.tss)} | ${num(w.avgPower)} |`);
  L.push('');
  const c = b.consistency;
  L.push('## Consistency', '',
    `- days ridden: ${c.daysRiddenLast7} of the last 7, ${c.daysRiddenLast28} of the last 28`,
    `- current streak: ${c.currentStreakDays} day(s) · days since last ride: ${c.daysSinceLastRide ?? '—'} · longest gap in 28 days: ${c.longestGapDaysLast28 ?? '—'} day(s)`, '');
  L.push('## Routes ridden in the last 28 days', '');
  if (b.routes.length) {
    L.push('| Route | Rides | Best lap (28 d) | All-time PB | Last ridden |', '|---|---:|---:|---:|---|');
    for (const r of b.routes) L.push(`| ${r.route}${r.reverse ? ' (reverse)' : ''} | ${r.rides} | ${hms(r.bestLapS)} | ${hms(r.allTimePbS)} | ${date(r.lastDate)} |`);
  } else L.push('- none');
  L.push('', `New PBs this week: ${b.recentPBs.length ? b.recentPBs.map((p) => `${p.route}${p.reverse ? ' (reverse)' : ''} ${hms(p.lapTimeS)} on ${date(p.date)}`).join('; ') : 'none'}`, '');
  L.push('## Workouts in the last 28 days', '');
  if (b.workouts.length) {
    L.push('| Date | Workout | Time | Avg W | TSS | FTP result |', '|---|---|---:|---:|---:|---:|');
    for (const w of b.workouts) L.push(`| ${date(w.date)} | ${w.workout} | ${hms(w.durationS)} | ${num(w.avgPower)} | ${num(w.tss)} | ${w.ftpEstimate ?? '—'} |`);
  } else L.push('- none (free rides only)');
  L.push('', `Zone split, last 7 days: ${b.zones7 ? b.zones7.percentPerZone.map((p, i) => `Z${i + 1} ${p}%`).join(' · ') + ` (${b.zones7.ridesWithZones} ride(s) with zone data)` : 'no zone data'}`, '');
  L.push('## Rider', '',
    `- ${b.meta.rider.name || 'Player'} · ${b.meta.rider.weightKg ?? '—'} kg · ${b.meta.rider.heightCm ?? '—'} cm · FTP ${b.ftp.watts ?? '—'} W (${b.ftp.wkg ?? '—'} W/kg)`,
    `- last FTP test: ${b.ftp.lastTest ? `${date(b.ftp.lastTest.date)} · ${b.ftp.lastTest.workout} → ${b.ftp.lastTest.estimate} W${b.ftp.lastTest.applied ? ' (applied)' : ' (not applied)'}` : 'never'}`, '');
  L.push('## Possible data errors', '');
  L.push(...(b.anomalies.length ? b.anomalies.map((a) => `- ${date(a.date)} ${a.route}: ${a.what}`) : ['- none spotted']), '');
  L.push('## Recent rides (newest first)', '', '| Date | Route | Time | km | Avg W | NP | HR | kJ | TSS | Source | Workout |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|');
  for (const r of b.recent) L.push(`| ${date(r.date)} | ${r.route}${r.reverse ? ' ↺' : ''}${r.pb ? ' ★' : ''} | ${hms(r.durationS)} | ${km(r.distanceM)} | ${num(r.avgPower)} | ${num(r.normPower)} | ${num(r.avgHr)} | ${r.kJ} | ${num(r.tss)} | ${r.source || '—'} | ${r.workout || '—'} |`);
  L.push('');
  return L.join('\n');
}

// ---- the coach channel + folder README ---------------------------------------
export const COACH_INSTRUCTIONS = `# Black Mirror Bike Ride — coach channel

Start with \`BRIEF.md\` (one page: totals, trend, last ride, consistency, routes & PBs, workouts,
zones, FTP, data gaps). Then read \`coach/request.json\`: \`payload.rider\` is the human (weight, FTP)
and \`payload.rides\` the last 40 rides — route, date, source (real trainer vs simulator), workout,
duration s, lap s, distance m, ascent m, avg / normalized / max power W, avg speed m/s, avg HR, kJ,
TSS, time-in-zone s (Z1–Z7), FTP test result, personal-best flag. Write \`coach/reply.json\`:

\`\`\`json
{ "requestHash": "<copy the request's requestHash verbatim>",
  "reply": "<short, specific training notes in markdown: what the numbers say is improving, one or two rides from the list worth repeating and why, a realistic week. Encouraging, no lectures. Treat simulator rides as practice, not fitness data.>" }
\`\`\`

If you cannot answer, write \`coach/reply-error.json\` containing \`{ "reason": "..." }\` instead.
`;

export function folderReadme() {
  return `# Black Mirror Bike Ride — AI cowork folder

Written by the Black Mirror Bike Ride web app (an indoor-cycling simulator) and read by an AI agent —
CoworkSyncHub, Claude Desktop, or a person. Model-agnostic: anything that can read and write this folder can do the work.

- \`cowork.json\` — the discovery manifest (\`cowork-manifest\` v1). A hub that speaks the house cowork protocol drives this folder from that file alone.
- \`BRIEF.md\` + \`brief.json\` — **start here for a daily or weekly brief.** The app's own conclusions, precomputed: today / last 7 / previous 7 / last 28 day totals (rides, time, distance, climbing, kJ, TSS), the last ride in full, a per-day table for the week and a per-week table for two months, consistency (streak, days since last ride, gaps), routes ridden with best laps and PBs, structured workouts and zone split, FTP and the last FTP test, data gaps, and possible data-entry errors. Same content in markdown and JSON.
- \`coach/request.json\` + \`coach/INSTRUCTIONS.md\` — the coach channel: the last 40 rides in full detail, for coaching notes. The agent answers in \`coach/reply.json\`; the app shows the reply on its History screen.

Refreshed after every ride, on app launch, and whenever the History screen opens — provided the folder was connected once from History → Coach and the browser kept the permission. Don't edit the app-written files by hand.

Two obligations: echo the request's \`requestHash\` in your reply, and on failure write \`coach/reply-error.json\` with \`{ "reason": "..." }\` so silence is distinguishable from an agent that never ran.
`;
}

// Everything the folder should contain, path -> content (string or JSON).
export function coworkFiles(state, now = Date.now()) {
  const brief = buildBrief(state, now);
  const rider = brief.meta.rider;
  const acts = sortedActivities(state);
  const rides = acts.slice(0, 40).map((a) => rideRow(a, acts, rider.ftpW));
  return {
    'BRIEF.md': briefMarkdown(brief),
    'brief.json': envelope(`${COWORK_APP}-brief`, 'brief', brief),
    'README.md': folderReadme(),
    'coach/request.json': envelope(`${COWORK_APP}-coach`, 'coach-request', { rider, rides }),
    'coach/INSTRUCTIONS.md': COACH_INSTRUCTIONS
  };
}
