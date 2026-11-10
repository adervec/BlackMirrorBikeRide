import { div, h, el, btn } from './dom.js';
import { getState, getRoute, activeBike, activePlayer, activeRider, getActivity, getPB, addActivity, getWorkout, upsertPlayer } from '../state.js';
import { resolveSkybox } from '../routes/skyboxes.js';
import { sensors } from '../sensors/sensorManager.js';
import { WorldScene } from '../world/scene.js';
import { Minimap } from '../world/minimap.js';
import { HUD } from '../game/hud.js';
import { Session } from '../game/session.js';
import { CAMERA_MODES, CAMERA_LABELS } from '../world/cameras.js';
import { formatString, formatTime } from '../game/units.js';
import { autoSync } from '../cloud/sync.js';
import { pushCoworkFolder } from '../cloud/coworkFolder.js';
import { RideAudio } from '../game/audio.js';
import { ZONES } from '../game/workouts.js';
import { activityToTcx, tcxFilename } from '../game/tcx.js';
import { downloadText } from '../routes/io.js';

// An in-progress ride is snapshotted here every few seconds; main.js turns a
// leftover snapshot (a crash, a killed tab) into a History entry on launch.
export const AUTOSAVE_KEY = 'bmbr.ride.inprogress';

export function renderRide(ctx) {
  const s = getState();
  const route = getRoute(ctx.params.routeId);
  if (!route) { ctx.router.go('routes'); return div(); }

  const mode = ctx.params.mode || 'ride';
  const reverse = !!ctx.params.reverse;
  const replayActivity = mode === 'replay' ? getActivity(ctx.params.activityId) : null;
  if (mode === 'replay' && !replayActivity) { ctx.router.go('history', { routeId: route.id }); return div(); }
  const workout = mode === 'ride' && ctx.params.workoutId ? getWorkout(ctx.params.workoutId) : null;

  // Ghost target: all-time PB for this route+direction (ride & replay only).
  let ghost = null;
  if (s.settings.ghost.enabled && mode !== 'preview') {
    const pb = getPB(route.id, reverse);
    if (pb && pb.id !== ctx.params.activityId) ghost = pb;
  }

  const sceneContainer = div({ class: 'scene-container' });
  const hudEl = div({ class: 'hud' });
  const minimapCanvas = el('canvas', { class: 'minimap' });
  const sensorPanel = div({ class: 'sensor-panel' });
  const camPanel = div({ class: 'cam-panel' });
  const ghostReadout = div({ class: 'ghost-readout', style: { display: 'none' } });
  const climbReadout = div({ class: 'climb-readout', style: { display: 'none' } });
  const overlay = div({ class: 'ride-overlay', style: { display: 'none' } });
  const banner = div({ class: 'ride-banner' });
  const controlsRegion = div({ class: 'ride-controls-region' });
  const workoutBar = workout ? buildWorkoutBar(workout) : null;

  const topRight = div({ class: 'ride-top-right' }, [
    div({ class: 'minimap-wrap' }, [minimapCanvas]),
    ghostReadout,
    climbReadout,
    mode === 'ride' ? sensorPanel : null
  ]);

  const root = div({ class: 'ride-root' }, [
    sceneContainer,
    div({ class: 'ride-top-left' }, [
      mode !== 'ride' ? div({ class: 'mode-badge ' + mode }, mode === 'preview' ? 'PREVIEW' : 'REPLAY') : null,
      hudEl
    ]),
    topRight,
    div({ class: 'ride-bottom' }, [camPanel, controlsRegion]),
    workoutBar?.root,
    banner,
    overlay
  ]);

  let world, minimap, hud, session, pauseBtn;
  let savedActivityId = null;
  const audio = mode === 'ride' && s.settings.audio?.enabled ? new RideAudio(s.settings.audio.volume) : null;

  // ---------- panels ----------
  function renderSensorPanel() {
    sensorPanel.innerHTML = '';
    const st = sensors.status();
    const control = st.controllable ? 'FTMS ✓ (ERG / grade)' : (st.powerSource && !st.simulator ? 'read-only' : '—');
    const rows = [
      div({ class: 'sensor-row' }, [el('span', {}, 'Power:'), el('strong', {}, st.powerSource || 'none')]),
      div({ class: 'sensor-row' }, [el('span', {}, 'Control:'), el('strong', {}, control)]),
      div({ class: 'sensor-row' }, [el('span', {}, 'HR:'), el('strong', {}, st.hrSource || 'none')])
    ];
    if (sensors.simulatorActive) {
      rows.push(div({ class: 'sensor-row sim-target' }, [el('span', {}, 'Target:'),
        el('strong', { id: 'sim-target' }, `${sensors.simulator.targetWatts} W`)]));
      rows.push(div({ class: 'sensor-buttons' }, [
        btn('−25 W', () => sensors.setSimulatorTarget(sensors.simulator.targetWatts - 25), 'btn small ghost'),
        btn('+25 W', () => sensors.setSimulatorTarget(sensors.simulator.targetWatts + 25), 'btn small ghost')
      ]));
      rows.push(div({ class: 'hint small' }, workout ? 'ERG: the simulator follows the workout target' : '▲ / ▼ also adjust watts'));
    }
    const buttons = div({ class: 'sensor-buttons' }, [
      btn('Connect Trainer', async () => { try { await sensors.connectPower(); } catch (e) { alert(e.message); } }, 'btn small'),
      btn('Connect HR', async () => { try { await sensors.connectHeartRate(); } catch (e) { alert(e.message); } }, 'btn small'),
      btn(sensors.simulatorActive ? 'Sim: Auto' : 'Use Simulator', () => {
        sensors.startSimulator(sensors.simulator && sensors.simulator.mode === 'manual' ? 'auto' : 'manual');
      }, 'btn small ghost')
    ]);
    sensorPanel.append(h(3, 'Sensors'), ...rows, buttons);
    if (!st.bleSupported) sensorPanel.append(div({ class: 'warn small' }, 'Web Bluetooth unavailable — use Chrome/Edge for real sensors.'));
  }

  function renderCamPanel() {
    camPanel.innerHTML = '';
    const cur = world ? world.cameraMode() : 'chase';
    camPanel.append(h(3, 'Camera (C to cycle)'),
      div({ class: 'cam-buttons' }, CAMERA_MODES.map((m, i) =>
        btn(`${i + 1}. ${CAMERA_LABELS[m]}`, () => { world.setCameraMode(m); renderCamPanel(); },
          'btn small' + (m === cur ? ' active' : '')))));
  }

  function renderControls() {
    controlsRegion.innerHTML = '';
    if (mode === 'preview') {
      const speed = el('input', { type: 'range', min: 5, max: 200, value: session.previewSpeed, oninput: (e) => session.setPreviewSpeed(+e.target.value) });
      const scrub = el('input', { type: 'range', min: 0, max: 1000, value: 0, class: 'scrub', oninput: (e) => session.seekFraction(+e.target.value / 1000) });
      scrub.id = 'scrub';
      controlsRegion.append(div({ class: 'ride-controls preview-controls' }, [
        h(3, 'Preview'),
        div({ class: 'pc-row' }, [el('label', {}, 'Speed'), speed]),
        div({ class: 'pc-row' }, [el('label', {}, 'Scrub'), scrub]),
        div({ class: 'row' }, [
          btn('⏪ -200m', () => session.skip(-200), 'btn small ghost'),
          btn('+200m ⏩', () => session.skip(200), 'btn small ghost'),
          btn('↺ Restart', () => { session.seekFraction(0); session.previewAtEnd = false; }, 'btn small ghost'),
          btn('‹ Exit', () => leaveRide(), 'btn small ghost')
        ])
      ]));
    } else if (mode === 'replay') {
      const mult = el('input', { type: 'range', min: 1, max: 30, step: 1, value: session.replaySpeedMul, oninput: (e) => { session.setReplaySpeed(+e.target.value); multLbl.textContent = `${e.target.value}×`; } });
      const multLbl = el('strong', {}, `${session.replaySpeedMul}×`);
      const scrub = el('input', { type: 'range', min: 0, max: 1000, value: 0, class: 'scrub', id: 'scrub', oninput: (e) => session.seekFraction(+e.target.value / 1000) });
      pauseBtn = btn('⏸ Pause', () => session.togglePause());
      controlsRegion.append(div({ class: 'ride-controls replay-controls' }, [
        h(3, `Replay · ${new Date(replayActivity.date).toLocaleDateString()}`),
        div({ class: 'pc-row' }, [el('label', {}, 'Speed'), mult, multLbl]),
        div({ class: 'pc-row' }, [el('label', {}, 'Scrub'), scrub]),
        div({ class: 'row' }, [pauseBtn, btn('‹ Exit', () => leaveRide(), 'btn small ghost')])
      ]));
    } else {
      pauseBtn = btn('⏸ Pause', () => session.togglePause());
      controlsRegion.append(div({ class: 'ride-controls' }, [
        pauseBtn,
        btn('🏁 Finish', () => { if (session) { session.stop(); showSummary(session.summary()); } }, 'btn ghost'),
        btn('‹ Exit', () => leaveRide(), 'btn ghost')
      ]));
    }
  }

  function showSummary(sum) {
    const u = s.settings.units;
    overlay.style.display = '';
    overlay.innerHTML = '';
    const isPB = !sum.replay && savedActivityId && getPB(route.id, reverse)?.id === savedActivityId;
    const zt = sum.zoneTime || [];
    const zMax = Math.max(1, ...zt);
    const zTotal = zt.reduce((a, b) => a + b, 0) || 1;
    const card = div({ class: 'summary-card' }, [
      h(1, sum.replay ? 'Replay Finished' : 'Ride Complete'),
      isPB ? div({ class: 'pb-flash' }, '★ NEW PERSONAL BEST ★') : null,
      h(2, sum.routeName + (sum.workoutName ? ` · ${sum.workoutName}` : '')),
      div({ class: 'summary-grid' }, [
        stat('Distance', formatString('distance', sum.distance, u)),
        stat('Time', formatTime(sum.time)),
        stat('Avg Power', formatString('power', sum.avgPower, u)),
        stat('Avg Speed', formatString('speed', sum.avgSpeed, u)),
        stat('Ascent', formatString('distance', sum.ascent, u)),
        stat('Energy', formatString('energy', sum.energy, u))
      ]),
      !sum.replay && zt.length ? div({ class: 'summary-sub' }, `Time in zone (FTP ${sum.ftp} W)`) : null,
      !sum.replay && zt.length ? div({ class: 'zone-bars' }, ZONES.map((z, i) =>
        div({ class: 'zone-bar', title: `${z.name}: ${formatTime(zt[i])}`, style: { background: z.color, height: `${Math.max(3, (zt[i] / zMax) * 100)}%` } },
          [el('span', {}, `Z${z.z} ${Math.round((zt[i] / zTotal) * 100)}%`)]))) : null
    ]);
    if (sum.ftpEstimate) {
      const ftpBox = div({ class: 'ftp-estimate' }, [
        div({}, ['Estimated FTP: ', el('strong', {}, `${sum.ftpEstimate} W`), el('span', { class: 'dim' }, ` (currently ${sum.ftp} W)`)]),
        btn('Set as my FTP', (e) => { upsertPlayer({ ...activePlayer(), ftpW: sum.ftpEstimate }); e.target.textContent = `FTP set to ${sum.ftpEstimate} W ✓`; e.target.disabled = true; }, 'btn small')
      ]);
      card.append(ftpBox);
    }
    card.append(div({ class: 'row' }, [
      !sum.replay ? btn('Ride Again', () => ctx.router.go('ride', { routeId: route.id, reverse, workoutId: workout?.id })) : null,
      savedActivityId ? btn('⤓ TCX', () => {
        const a = getActivity(savedActivityId);
        if (a) downloadText(tcxFilename(a), activityToTcx(a, session.profile), 'application/vnd.garmin.tcx+xml');
      }, 'btn ghost') : null,
      btn('History', () => ctx.router.go('history', { routeId: route.id }), 'btn ghost'),
      btn('Back to Routes', () => ctx.router.go('routes'), 'btn ghost')
    ]));
    overlay.append(card);
  }

  function flashBanner(text, ms = 2600) {
    banner.textContent = text; banner.style.opacity = '1';
    clearTimeout(flashBanner._t);
    flashBanner._t = setTimeout(() => { banner.style.opacity = '0'; }, ms);
  }

  // ---------- cues from the session (workout steps, zones, climbs, pauses) ----------
  function onCue(kind, payload) {
    audio?.cue(kind);
    switch (kind) {
      case 'step': flashBanner(`▶ ${payload.step.text || (payload.frac == null ? 'Free ride' : `${Math.round(payload.frac * 100)}% FTP for ${formatTime(payload.step.dur)}`)}`); break;
      case 'workoutDone': flashBanner('Workout complete 🎉', 4000); break;
      case 'climbStart': flashBanner(`⛰ ${payload.label}`, 3500); break;
      case 'climbEnd': {
        const d = payload.pb != null ? ` · vs PB ${payload.time - payload.pb >= 0 ? '+' : ''}${(payload.time - payload.pb).toFixed(1)} s` : '';
        flashBanner(`⛰ Climb done in ${formatTime(payload.time)}${d}`, 4000); break;
      }
      case 'autoPause': flashBanner('Auto-paused — pedal to resume', 4000); break;
      case 'resume': flashBanner('Resumed', 1200); break;
      default: break;
    }
  }

  // ---------- per-frame UI updates ----------
  const climbLabel = el('span'), climbTime = el('span', { class: 'dim' }), climbDelta = el('span');
  climbReadout.append(climbLabel, ' ', climbTime, ' ', climbDelta);

  function onFrame(telem, dt) {
    audio?.update({ speed: telem.speed, cadence: telem.cadence, dt });
    if (sensors.simulatorActive) {
      const t = document.getElementById('sim-target');
      if (t) t.textContent = `${sensors.simulator.targetWatts} W`;
    }
    if (pauseBtn) pauseBtn.textContent = telem.paused ? '▶ Resume' : '⏸ Pause';

    if (telem.ghostActive && telem.ghostDelta != null) {
      ghostReadout.style.display = '';
      const d = telem.ghostDelta;
      ghostReadout.textContent = `👻 vs PB: ${d >= 0 ? '+' : ''}${d.toFixed(1)} s ${d >= 0 ? 'behind' : 'ahead'}`;
      ghostReadout.className = 'ghost-readout ' + (d > 0 ? 'behind' : 'ahead');
    } else {
      ghostReadout.style.display = 'none';
    }

    if (telem.climb) {
      climbReadout.style.display = '';
      climbLabel.textContent = `⛰ ${telem.climb.label}`;
      climbTime.textContent = formatTime(telem.climbElapsed);
      const d = telem.climbDelta;
      climbDelta.textContent = d == null ? '' : `${d >= 0 ? '+' : ''}${d.toFixed(1)} s`;
      climbDelta.className = d == null ? '' : (d > 0 ? 'behind' : 'ahead');
    } else climbReadout.style.display = 'none';

    workoutBar?.update(telem);

    if (mode !== 'ride') {
      const scrub = document.getElementById('scrub');
      if (scrub && document.activeElement !== scrub) scrub.value = Math.round(session.progressFraction() * 1000);
    }
  }

  // ---------- don't lose a ride by accident ----------
  // Leaving through the app is already safe: cleanup calls session.stop(), which
  // records the activity. Closing or reloading the tab never runs cleanup at
  // all, though, so the whole ride would vanish — hence the unload guards, plus
  // the periodic autosave for the cases nothing can intercept (a crash).
  const rideInProgress = () => mode === 'ride' && session && !session.finished && session.distance >= 30;

  const onBeforeUnload = (e) => {
    if (!rideInProgress()) return;
    e.preventDefault();
    e.returnValue = ''; // some browsers still require this to show the prompt
  };
  const onPageHide = (e) => { if (!e.persisted && rideInProgress()) session.stop(); };

  function leaveRide(to = 'routes', params = {}) {
    if (rideInProgress() && !confirm('End this ride now? Everything so far is saved to History.')) return;
    ctx.router.go(to, params);
  }

  const autosave = (snap) => {
    try { if (snap) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snap)); else localStorage.removeItem(AUTOSAVE_KEY); }
    catch { /* quota — the pagehide path still records the ride */ }
  };

  // ---------- keep the screen on; warn when the battery is going ----------
  let wakeLock = null;
  const lockScreen = async () => { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* denied / unsupported */ } };
  const onVisibility = () => { if (document.visibilityState === 'visible' && mode === 'ride') lockScreen(); };
  const warned = new Set();
  const onBattery = (b) => () => {
    if (b.charging) return;
    for (const lvl of [0.2, 0.1, 0.05]) {
      if (b.level <= lvl && !warned.has(lvl)) { warned.add(lvl); flashBanner(`🔋 Battery at ${Math.round(b.level * 100)}%`, 4000); audio?.cue('battery'); }
    }
  };
  let battery = null;
  if (mode === 'ride') {
    lockScreen();
    document.addEventListener('visibilitychange', onVisibility);
    navigator.getBattery?.().then((b) => { battery = b; b._bmbr = onBattery(b); b.addEventListener('levelchange', b._bmbr); b._bmbr(); }).catch(() => {});
  }

  // ---------- keyboard ----------
  const keyHandler = (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (!world || !session) return;
    const k = e.key;
    if (k === 'c' || k === 'C') { const m = world.cycleCamera(1); renderCamPanel(); flashBanner('Camera: ' + CAMERA_LABELS[m], 1200); }
    else if (k === ' ') { e.preventDefault(); session.togglePause(); }
    else if (k === 'Escape') leaveRide();
    else if (k >= '1' && k <= '5') { const m = CAMERA_MODES[+k - 1]; if (m) { world.setCameraMode(m); renderCamPanel(); } }
    else if (mode === 'preview' && k === 'ArrowLeft') session.skip(-200);
    else if (mode === 'preview' && k === 'ArrowRight') session.skip(200);
    else if (workout && k === '[') flashBanner(`Intensity ${Math.round(session.adjustIntensity(-0.05) * 100)}%`, 1200);
    else if (workout && k === ']') flashBanner(`Intensity ${Math.round(session.adjustIntensity(0.05) * 100)}%`, 1200);
    else if (workout && (k === 'n' || k === 'N')) session.skipStep();
    else if (audio && (k === 'm' || k === 'M')) { audio.setVolume(audio.volume ? 0 : s.settings.audio.volume || 0.5); flashBanner(audio.volume ? '🔊 Sound on' : '🔇 Muted', 1200); }
  };

  // ---------- deferred init (needs layout for canvas sizing) ----------
  requestAnimationFrame(() => {
    world = new WorldScene(sceneContainer);
    minimap = new Minimap(minimapCanvas);
    hud = new HUD(hudEl);
    const rider = activeRider();
    const player = activePlayer();
    session = new Session({
      route, reverse, player, bike: activeBike(), rider,
      decals: s.decals, skyboxDef: resolveSkybox(route.skybox, s.customSkyboxes),
      sensors, world, minimap, hud, settings: s.settings,
      mode, replayActivity, ghost,
      workout, ftp: player.ftpW,
      onEnd: (sum) => showSummary(sum),
      onFrame,
      onCue,
      onAutosave: mode === 'ride' ? autosave : null,
      onRecord: (act) => { addActivity(act); savedActivityId = act.id; autoSync(); pushCoworkFolder(); }
    });
    session.start();
    audio?.start();

    if (mode === 'ride' && !sensors.powerSource) {
      sensors.startSimulator('manual');
      flashBanner(workout ? 'Simulator active — it will follow the workout targets.' : 'Simulator active — pedal with ▲ / ▼, or connect a trainer.', 3500);
    }
    if (ghost) flashBanner(`Ghost: your PB (${formatTime(ghost.lapTimeS)})`, 3000);
    if (workout) workoutBar.bind(session);

    renderControls();
    renderCamPanel();
    if (mode === 'ride') renderSensorPanel();
    world.resize();
    minimap.setProfile(session.profile, rider.mapIconColor, s.settings.sessionEndMode);
  });

  const unsub = sensors.onStatus(() => { if (mode === 'ride') renderSensorPanel(); });
  window.addEventListener('keydown', keyHandler);
  window.addEventListener('beforeunload', onBeforeUnload);
  window.addEventListener('pagehide', onPageHide);

  ctx.onCleanup(() => {
    window.removeEventListener('keydown', keyHandler);
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
    if (battery?._bmbr) battery.removeEventListener('levelchange', battery._bmbr);
    try { wakeLock?.release(); } catch {}
    unsub();
    if (session) session.stop();
    sensors.stopSimulator();
    audio?.stop();
    if (world) world.dispose();
  });

  return root;
}

function stat(label, value) { return div({ class: 'summary-stat' }, [div({ class: 'summary-val' }, value), div({ class: 'summary-lab' }, label)]); }

// The workout strip: block graph, live target, countdown, intensity & skip.
function buildWorkoutBar(workout) {
  const total = workout.steps.reduce((t, x) => t + x.dur, 0);
  const peak = Math.max(1.2, ...workout.steps.map((x) => (x.lo == null || x.abs ? 0 : Math.max(x.lo, x.hi))));
  const blocks = workout.steps.map((x) => {
    const frac = x.lo == null ? 0.5 : (x.abs ? Math.min(1, Math.max(x.lo, x.hi) / 500) : Math.max(x.lo, x.hi) / peak);
    return div({ class: 'wo-block' + (x.lo == null ? ' free' : ''), style: { flexBasis: `${(x.dur / total) * 100}%`, height: `${Math.max(8, frac * 100)}%` } });
  });
  const text = el('span', { class: 'wo-text' }, workout.name);
  const remaining = el('span', {}, formatTime(total));
  const target = div({ class: 'wo-target' }, '—');
  const fill = div();
  const intensity = el('span', { class: 'dim small' }, '100%');
  let session = null;
  const row = div({ class: 'wo-row' }, [
    btn('−5%', () => session && (intensity.textContent = `${Math.round(session.adjustIntensity(-0.05) * 100)}%`), 'btn small ghost'),
    intensity,
    btn('+5%', () => session && (intensity.textContent = `${Math.round(session.adjustIntensity(0.05) * 100)}%`), 'btn small ghost'),
    btn('Skip ▸', () => session?.skipStep(), 'btn small ghost')
  ]);
  const root = div({ class: 'workout-bar' }, [
    div({ class: 'wo-head' }, [text, remaining]),
    target,
    div({ class: 'wo-graph' }, blocks),
    div({ class: 'wo-progress' }, [fill]),
    row
  ]);
  let lastIdx = -2;
  return {
    root,
    bind(sess) { session = sess; },
    update(telem) {
      const si = telem.stepInfo;
      if (telem.workoutDone) {
        if (lastIdx !== -1) { lastIdx = -1; blocks.forEach((b) => b.classList.add('done')); blocks.forEach((b) => b.classList.remove('cur')); text.textContent = 'Workout complete'; text.className = 'wo-text wo-done'; target.textContent = '—'; remaining.textContent = ''; fill.style.width = '100%'; row.style.display = 'none'; }
        return;
      }
      if (!si) return;
      if (si.idx !== lastIdx) {
        lastIdx = si.idx;
        blocks.forEach((b, i) => { b.classList.toggle('done', i < si.idx); b.classList.toggle('cur', i === si.idx); });
        text.textContent = si.step.text || (si.frac == null ? 'Free ride' : `Block ${si.idx + 1} of ${workout.steps.length}`);
      }
      const pct = si.frac == null ? '' : (si.step.abs ? '' : `${Math.round(si.frac * telem.intensity * 100)}%`);
      target.innerHTML = telem.targetPower == null ? 'Free ride' : `${telem.targetPower} W${pct ? `<small>${pct} FTP</small>` : ''}`;
      remaining.textContent = `${formatTime(si.remaining)} left · ${formatTime(Math.max(0, total - telem.workoutTime))} total`;
      fill.style.width = `${Math.min(100, (si.elapsed / si.step.dur) * 100)}%`;
    }
  };
}
