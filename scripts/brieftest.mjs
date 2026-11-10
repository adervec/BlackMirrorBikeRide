// The cowork brief digest: totals, trend, consistency, routes/PBs, workouts,
// gaps and anomalies from synthetic history; the markdown leaks nothing; the
// folder file set matches the manifest. Run: node scripts/brieftest.mjs
import { buildBrief, briefMarkdown, coworkFiles, coworkManifest } from '../src/cloud/brief.js';
import { createActivity, statsFromSamples } from '../src/game/activity.js';

let fails = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

const DAY = 86400000;
const now = new Date('2026-11-08T18:00:00').getTime(); // a Sunday evening, local time

// A ride factory: constant power, 1 Hz, optional HR.
function ride({ daysAgo, route = 'Loop', id = 'r1', reverse = false, mins = 60, power = 200, hr = 140, lap = null, source = 'Kickr', workoutName = null, zoneTime = null, ftpEstimate = null, speed = 9 }) {
  const samples = [];
  for (let t = 0; t <= mins * 60; t++) samples.push({ t, d: t * speed, p: power, s: speed, hr, c: 85 });
  const a = createActivity({
    route: { id, name: route }, reverse, samples, total: lap ? lap * speed : mins * 60 * speed * 2,
    summary: { time: mins * 60, distance: mins * 60 * speed, avgPower: power, avgSpeed: speed, energy: power * mins * 60 / 0.24, ascent: 120, zoneTime, ftpEstimate },
    source, workoutName
  });
  a.date = new Date(now - daysAgo * DAY).toISOString();
  return a;
}

// ---- stats from samples ----
const st = statsFromSamples(ride({ daysAgo: 0 }).samples);
assert(st.normPower === 200 && st.maxPower === 200 && st.avgHr === 140, `constant 200 W ride: NP 200, max 200, HR 140 (got ${st.normPower}/${st.maxPower}/${st.avgHr})`);
const spiky = []; for (let t = 0; t <= 600; t++) spiky.push({ t, d: t * 8, p: t % 120 < 60 ? 300 : 100, s: 8, hr: null, c: 80 });
const sp = statsFromSamples(spiky);
assert(sp.normPower > 200 && sp.normPower < 300 && sp.maxPower === 300 && sp.avgHr === null, `on/off intervals: NP above the 200 W average (got ${sp.normPower}), no HR -> null`);

// ---- history ----
const acts = [
  ride({ daysAgo: 0.2, mins: 45, power: 230, lap: 2400, workoutName: 'Sweet Spot 3×12', zoneTime: [300, 600, 900, 800, 100, 0, 0] }), // today, PB on Loop
  ride({ daysAgo: 1.5, mins: 60, power: 190, lap: 2600 }),                                   // yesterday
  ride({ daysAgo: 3, mins: 30, power: 150, hr: null, source: 'Simulator (manual)', route: 'Alp', id: 'r2' }),
  ride({ daysAgo: 9, mins: 90, power: 180, lap: 2500 }),                                     // previous week
  ride({ daysAgo: 20, mins: 40, power: 210, workoutName: 'Ramp Test (FTP)', ftpEstimate: 236 }),
  ride({ daysAgo: 40, mins: 60, power: 170 })                                                 // outside 28 d
];
const state = { activities: acts, players: [{ id: 'p1', name: 'Rider', weightKg: 75, heightCm: 178, ftpW: 236 }], activePlayerId: 'p1' };
const b = buildBrief(state, now);

assert(b.meta.today === '2026-11-08' && b.meta.rider.wkg === 3.15, 'meta carries today + rider W/kg');
assert(b.atAGlance.today.rides === 1 && b.atAGlance.last7.rides === 3 && b.atAGlance.prev7.rides === 1 && b.atAGlance.last28.rides === 5,
  `glance counts today 1 / last7 3 / prev7 1 / last28 5 (got ${b.atAGlance.today.rides}/${b.atAGlance.last7.rides}/${b.atAGlance.prev7.rides}/${b.atAGlance.last28.rides})`);
assert(b.atAGlance.last7.timeS === 45 * 60 + 60 * 60 + 30 * 60, 'last-7 time sums the three rides');
assert(b.atAGlance.last7.tss > 0 && b.atAGlance.last7.avgPower > 150 && b.atAGlance.last7.avgPower < 230, `last-7 TSS and time-weighted avg power (${b.atAGlance.last7.tss}, ${b.atAGlance.last7.avgPower} W)`);
assert(b.days.length === 7 && b.days[0].date === '2026-11-08' && b.days[0].rides === 1 && b.days[1].rides === 1, 'per-day table: 7 rows, today first, yesterday has a ride');
assert(b.weeks.length === 8 && b.weeks[0].weekStart === '2026-11-02' && b.weeks[0].rides === 3 && b.weeks[1].rides === 1, `weekly trend: Monday-start weeks, newest first (got ${b.weeks[0].weekStart}: ${b.weeks[0].rides}, ${b.weeks[1].rides})`);
assert(b.consistency.daysRiddenLast7 === 3 && b.consistency.currentStreakDays === 2 && b.consistency.daysSinceLastRide === 0, `consistency: 3 days of 7, streak 2 (today+yesterday), 0 days since (got ${b.consistency.daysRiddenLast7}/${b.consistency.currentStreakDays}/${b.consistency.daysSinceLastRide})`);
assert(b.lastRide.route === 'Loop' && b.lastRide.pb === true && b.lastRide.workout === 'Sweet Spot 3×12' && b.lastRide.zoneTime.length === 7, 'last ride is today\'s PB workout with zones');
assert(b.routes[0].route === 'Loop' && b.routes[0].rides === 4 && b.routes[0].allTimePbS === 2400 && b.routes[0].bestLapS === 2400, `routes: Loop 4 rides, PB 2400 s (got ${b.routes[0]?.rides}, ${b.routes[0]?.allTimePbS})`);
assert(b.recentPBs.length === 1 && b.recentPBs[0].lapTimeS === 2400, 'new PB this week detected');
assert(b.workouts.length === 2 && b.workouts.some((w) => w.ftpEstimate === 236), 'workouts in 28 days incl. the FTP test result');
assert(b.zones7 && b.zones7.ridesWithZones === 1 && b.zones7.percentPerZone.reduce((a, c) => a + c, 0) >= 99, 'zone split from the ride that has zones');
assert(b.ftp.lastTest && b.ftp.lastTest.applied === true, 'last FTP test found and marked applied');
assert(b.meta.gaps.some((g) => /simulator/i.test(g)) && !b.meta.gaps.some((g) => /heart-rate/i.test(g)), `gaps flag the simulator ride but not HR (got: ${b.meta.gaps.join(' | ')})`);
assert(b.anomalies.length === 0, 'no anomalies in sane data');
assert(b.recent.length === 6 && b.recent[0].normPower === 230 && b.recent[0].tss > 0, 'recent rows carry NP and TSS');

// anomalies + gaps on bad / empty data
const weird = buildBrief({ ...state, activities: [ride({ daysAgo: 1, power: 700, speed: 30 })] }, now);
assert(weird.anomalies.length === 1 && /700 W/.test(weird.anomalies[0].what) && /km\/h/.test(weird.anomalies[0].what), 'absurd power and speed are flagged');
const empty = buildBrief({ activities: [], players: [{ id: 'p', ftpW: 220, weightKg: 75 }], activePlayerId: 'p' }, now);
assert(empty.lastRide === null && empty.meta.gaps[0] === 'No recorded rides yet.' && /default \(220 W\)/.test(empty.meta.gaps.join(' ')), 'empty history: no last ride, gaps explain it and the untested default FTP');
const stale = buildBrief({ ...state, activities: [ride({ daysAgo: 21 })] }, now);
assert(stale.meta.gaps.some((g) => /No ride in the last 21 days/.test(g)) && stale.consistency.currentStreakDays === 0, 'a three-week gap is called out');

// ---- markdown ----
const md = briefMarkdown(b);
for (const h of ['# Black Mirror Bike Ride — brief data', '## Data gaps', '## At a glance', '## Last ride', '## Last 7 days', '## Weekly trend', '## Consistency', '## Routes ridden', '## Workouts', '## Rider', '## Possible data errors', '## Recent rides']) {
  assert(md.includes(h), `markdown has "${h}"`);
}
assert(!/undefined|NaN|\[object/.test(md), 'markdown leaks no placeholders');
assert(/\| 2026-11-08 \d\d:\d\d \| Loop/.test(md), 'ride timestamps render as local YYYY-MM-DD HH:MM');
assert(!/undefined|NaN|\[object/.test(briefMarkdown(empty)), 'empty-history markdown leaks no placeholders');
assert(md.includes('★ PB') && md.includes('Sweet Spot 3×12') && md.includes('Simulator'), 'markdown mentions the PB, the workout and the simulator source');

// ---- folder file set ----
const files = coworkFiles(state, now);
const man = coworkManifest();
assert(['BRIEF.md', 'brief.json', 'README.md', 'coach/request.json', 'coach/INSTRUCTIONS.md'].every((p) => p in files), 'folder gets brief (md+json), README and the coach channel');
assert(man.channels.every((c) => c.request.every((p) => p in files) && c.instructions in files), 'every manifest request/instructions path is written');
assert(files['brief.json'].protocol === 'blackmirrorbikeride-brief' && files['brief.json'].requestHash && files['brief.json'].payload.meta.today === '2026-11-08', 'brief.json is an envelope around the brief');
assert(files['coach/request.json'].payload.rides.length === 6 && files['coach/request.json'].payload.rides[0].normPower === 230 && files['coach/request.json'].payload.rider.ftpW === 236, 'coach request carries enriched rides + rider');
assert(/BRIEF\.md/.test(files['README.md']) && /start here/i.test(files['README.md']) && /BRIEF\.md/.test(files['coach/INSTRUCTIONS.md']), 'README and instructions point the agent at BRIEF.md');
console.log(`     BRIEF.md is ${md.length} chars / ${md.split('\n').length} lines; brief.json ${JSON.stringify(files['brief.json']).length} chars`);

console.log(`\n${fails === 0 ? '✅ ALL BRIEF CHECKS PASSED' : '❌ ' + fails + ' BRIEF CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
