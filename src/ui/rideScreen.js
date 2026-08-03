import { div, h, el, btn } from './dom.js';
import { getState, getRoute, activeBike, activePlayer, activeRider, getActivity, getPB, addActivity } from '../state.js';
import { resolveSkybox } from '../routes/skyboxes.js';
import { sensors } from '../sensors/sensorManager.js';
import { WorldScene } from '../world/scene.js';
import { Minimap } from '../world/minimap.js';
import { HUD } from '../game/hud.js';
import { Session } from '../game/session.js';
import { CAMERA_MODES, CAMERA_LABELS } from '../world/cameras.js';
import { formatString, formatTime } from '../game/units.js';

export function renderRide(ctx) {
  const s = getState();
  const route = getRoute(ctx.params.routeId);
  if (!route) { ctx.router.go('routes'); return div(); }

  const mode = ctx.params.mode || 'ride';
  const reverse = !!ctx.params.reverse;
  const replayActivity = mode === 'replay' ? getActivity(ctx.params.activityId) : null;
  if (mode === 'replay' && !replayActivity) { ctx.router.go('history', { routeId: route.id }); return div(); }

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
  const overlay = div({ class: 'ride-overlay', style: { display: 'none' } });
  const banner = div({ class: 'ride-banner' });
  const controlsRegion = div({ class: 'ride-controls-region' });

  const topRight = div({ class: 'ride-top-right' }, [
    div({ class: 'minimap-wrap' }, [minimapCanvas]),
    ghostReadout,
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
    banner,
    overlay
  ]);

  let world, minimap, hud, session, pauseBtn;
  let savedActivityId = null;

  // ---------- panels ----------
  function renderSensorPanel() {
    sensorPanel.innerHTML = '';
    const st = sensors.status();
    const rows = [
      div({ class: 'sensor-row' }, [el('span', {}, 'Power:'), el('strong', {}, st.powerSource || 'none')]),
      div({ class: 'sensor-row' }, [el('span', {}, 'HR:'), el('strong', {}, st.hrSource || 'none')])
    ];
    if (sensors.simulatorActive) {
      rows.push(div({ class: 'sensor-row sim-target' }, [el('span', {}, 'Target:'),
        el('strong', { id: 'sim-target' }, `${sensors.simulator.targetWatts} W`)]));
      rows.push(div({ class: 'sensor-buttons' }, [
        btn('−25 W', () => sensors.setSimulatorTarget(sensors.simulator.targetWatts - 25), 'btn small ghost'),
        btn('+25 W', () => sensors.setSimulatorTarget(sensors.simulator.targetWatts + 25), 'btn small ghost')
      ]));
      rows.push(div({ class: 'hint small' }, '▲ / ▼ also adjust watts'));
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
          btn('‹ Exit', () => ctx.router.go('routes'), 'btn small ghost')
        ])
      ]));
    } else if (mode === 'replay') {
      const mult = el('input', { type: 'range', min: 1, max: 30, step: 1, value: session.replaySpeedMul, oninput: (e) => { session.setReplaySpeed(+e.target.value); multLbl.textContent = `${e.target.value}×`; } });
      const multLbl = el('strong', {}, `${session.replaySpeedMul}×`);
      const scrub = el('input', { type: 'range', min: 0, max: 1000, value: 0, class: 'scrub', id: 'scrub', oninput: (e) => session.seekFraction(+e.target.value / 1000) });
      pauseBtn = btn('⏸ Pause', () => { const p = session.togglePause(); pauseBtn.textContent = p ? '▶ Resume' : '⏸ Pause'; });
      controlsRegion.append(div({ class: 'ride-controls replay-controls' }, [
        h(3, `Replay · ${new Date(replayActivity.date).toLocaleDateString()}`),
        div({ class: 'pc-row' }, [el('label', {}, 'Speed'), mult, multLbl]),
        div({ class: 'pc-row' }, [el('label', {}, 'Scrub'), scrub]),
        div({ class: 'row' }, [pauseBtn, btn('‹ Exit', () => ctx.router.go('routes'), 'btn small ghost')])
      ]));
    } else {
      pauseBtn = btn('⏸ Pause', () => { const p = session.togglePause(); pauseBtn.textContent = p ? '▶ Resume' : '⏸ Pause'; });
      controlsRegion.append(div({ class: 'ride-controls' }, [
        pauseBtn,
        btn('🏁 Finish', () => { if (session) { session.stop(); showSummary(session.summary()); } }, 'btn ghost'),
        btn('‹ Exit', () => ctx.router.go('routes'), 'btn ghost')
      ]));
    }
  }

  function showSummary(sum) {
    const u = s.settings.units;
    overlay.style.display = '';
    overlay.innerHTML = '';
    const isPB = !sum.replay && savedActivityId && getPB(route.id, reverse)?.id === savedActivityId;
    overlay.append(div({ class: 'summary-card' }, [
      h(1, sum.replay ? 'Replay Finished' : 'Ride Complete'),
      isPB ? div({ class: 'pb-flash' }, '★ NEW PERSONAL BEST ★') : null,
      h(2, sum.routeName),
      div({ class: 'summary-grid' }, [
        stat('Distance', formatString('distance', sum.distance, u)),
        stat('Time', formatTime(sum.time)),
        stat('Avg Power', formatString('power', sum.avgPower, u)),
        stat('Avg Speed', formatString('speed', sum.avgSpeed, u)),
        stat('Ascent', formatString('distance', sum.ascent, u)),
        stat('Energy', formatString('energy', sum.energy, u))
      ]),
      div({ class: 'row' }, [
        !sum.replay ? btn('Ride Again', () => ctx.router.go('ride', { routeId: route.id, reverse })) : null,
        btn('History', () => ctx.router.go('history', { routeId: route.id }), 'btn ghost'),
        btn('Back to Routes', () => ctx.router.go('routes'), 'btn ghost')
      ])
    ]));
  }

  function flashBanner(text, ms = 2600) {
    banner.textContent = text; banner.style.opacity = '1';
    setTimeout(() => { banner.style.opacity = '0'; }, ms);
  }

  // ---------- per-frame UI updates (ghost readout + street view) ----------
  function onFrame(telem) {
    if (sensors.simulatorActive) {
      const t = document.getElementById('sim-target');
      if (t) t.textContent = `${sensors.simulator.targetWatts} W`;
    }
    if (telem.ghostActive && telem.ghostDelta != null) {
      ghostReadout.style.display = '';
      const d = telem.ghostDelta;
      ghostReadout.textContent = `👻 vs PB: ${d >= 0 ? '+' : ''}${d.toFixed(1)} s ${d >= 0 ? 'behind' : 'ahead'}`;
      ghostReadout.className = 'ghost-readout ' + (d > 0 ? 'behind' : 'ahead');
    } else {
      ghostReadout.style.display = 'none';
    }

    if (mode !== 'ride') {
      const scrub = document.getElementById('scrub');
      if (scrub && document.activeElement !== scrub) scrub.value = Math.round(session.progressFraction() * 1000);
    }
  }

  // ---------- keyboard ----------
  const keyHandler = (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (!world || !session) return;
    if (e.key === 'c' || e.key === 'C') { const m = world.cycleCamera(1); renderCamPanel(); flashBanner('Camera: ' + CAMERA_LABELS[m], 1200); }
    else if (e.key === ' ') { e.preventDefault(); const p = session.togglePause(); if (pauseBtn) pauseBtn.textContent = p ? '▶ Resume' : '⏸ Pause'; }
    else if (e.key === 'Escape') ctx.router.go('routes');
    else if (e.key >= '1' && e.key <= '5') { const m = CAMERA_MODES[+e.key - 1]; if (m) { world.setCameraMode(m); renderCamPanel(); } }
    else if (mode === 'preview' && e.key === 'ArrowLeft') session.skip(-200);
    else if (mode === 'preview' && e.key === 'ArrowRight') session.skip(200);
  };

  // ---------- deferred init (needs layout for canvas sizing) ----------
  requestAnimationFrame(() => {
    world = new WorldScene(sceneContainer);
    minimap = new Minimap(minimapCanvas);
    hud = new HUD(hudEl);
    const rider = activeRider();
    session = new Session({
      route, reverse, player: activePlayer(), bike: activeBike(), rider,
      decals: s.decals, skyboxDef: resolveSkybox(route.skybox, s.customSkyboxes),
      sensors, world, minimap, hud, settings: s.settings,
      mode, replayActivity, ghost,
      onEnd: (sum) => showSummary(sum),
      onFrame,
      onRecord: (act) => { addActivity(act); savedActivityId = act.id; }
    });
    session.start();

    if (mode === 'ride' && !sensors.powerSource) {
      sensors.startSimulator('manual');
      flashBanner('Simulator active — pedal with ▲ / ▼, or connect a trainer.', 3500);
    }
    if (ghost) flashBanner(`Ghost: your PB (${formatTime(ghost.lapTimeS)})`, 3000);

    renderControls();
    renderCamPanel();
    if (mode === 'ride') renderSensorPanel();
    world.resize();
    minimap.setProfile(session.profile, rider.mapIconColor, s.settings.sessionEndMode);
  });

  const unsub = sensors.onStatus(() => { if (mode === 'ride') renderSensorPanel(); });
  window.addEventListener('keydown', keyHandler);

  ctx.onCleanup(() => {
    window.removeEventListener('keydown', keyHandler);
    unsub();
    if (session) session.stop();
    sensors.stopSimulator();
    if (world) world.dispose();
  });

  return root;
}

function stat(label, value) { return div({ class: 'summary-stat' }, [div({ class: 'summary-val' }, value), div({ class: 'summary-lab' }, label)]); }
