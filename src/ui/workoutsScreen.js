import { div, el, btn, screen, table, select, field } from './dom.js';
import { getState, activePlayer, addWorkout, deleteWorkout } from '../state.js';
import { BUILTIN_WORKOUTS, parseZwo, totalDuration, avgIntensity } from '../game/workouts.js';
import { formatTime } from '../game/units.js';

export function renderWorkouts(ctx) {
  const s = getState();
  let routeId = ctx.params.routeId || s.routes[0]?.id;
  const all = [...BUILTIN_WORKOUTS, ...s.workouts];

  const fileInput = el('input', {
    type: 'file', accept: '.zwo,.xml,application/xml,text/xml', multiple: true, style: { display: 'none' },
    onchange: async (e) => {
      for (const f of e.target.files) {
        try { addWorkout(parseZwo(await f.text())); }
        catch (err) { alert(`${f.name}: ${err.message}`); }
      }
      ctx.router.go('workouts', { routeId });
    }
  });

  const COLS = [
    { label: 'Workout', cell: (w) => div({ class: 't-name' }, [
      el('span', {}, w.name),
      w.test ? el('span', { class: 'badge badge-pb' }, 'FTP test') : null,
      !w.builtin ? el('span', { class: 'badge badge-real' }, 'zwo') : null,
      div({ class: 't-sub' }, w.description || '')
    ]) },
    { label: 'Duration', align: 'right', cell: (w) => formatTime(totalDuration(w)) },
    { label: 'Avg %FTP', align: 'right', cell: (w) => (w.test === 'ramp' ? '—' : `${Math.round(avgIntensity(w) * 100)}%`) },
    { label: 'Blocks', align: 'right', cell: (w) => String(w.steps.length) },
    { label: '', cell: (w) => div({ class: 't-actions' }, [
      btn('Ride ▷', () => ctx.router.go('ride', { routeId, reverse: false, workoutId: w.id }), 'btn small'),
      !w.builtin ? btn('✕', () => { if (confirm(`Delete "${w.name}"?`)) { deleteWorkout(w.id); ctx.router.go('workouts', { routeId }); } }, 'btn small icon danger') : null
    ]) }
  ];

  const ftp = activePlayer().ftpW;
  return screen('Workouts', ctx, [
    div({ class: 'card' }, [
      field('Ride it on', select(s.routes.map((r) => ({ value: r.id, label: r.name })), routeId, (v) => { routeId = v; })),
      div({ class: 'hint' }, `Targets scale from your FTP (${ftp} W — set it under Garage & Rider → Player). On an FTMS smart trainer the target is held in ERG mode; on a read-only trainer it shows on the HUD, and the simulator follows it.`)
    ]),
    table(COLS, all, { empty: 'No workouts.' }),
    div({ class: 'row' }, [btn('⤓ Import .zwo', () => fileInput.click(), 'btn ghost'), fileInput]),
    div({ class: 'hint' }, 'Zwift workout files import as-is: warm-ups, ramps, intervals, free-ride blocks and text cues. In the ride, [ and ] change intensity by 5% and N skips a block. Finish a test and the summary offers to set your FTP.')
  ]);
}
