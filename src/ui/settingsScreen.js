import { div, h, el, field, select, textInput, numberInput, checkbox, btn, screen } from './dom.js';
import { getState, save, resetState, eraseLocalKeys } from '../state.js';
import { forgetCoworkFolder } from '../cloud/coworkFolder.js';
import { MEASUREMENTS, unitOptions, applyPreset } from '../game/units.js';
import { READINGS } from '../game/hudConfig.js';
import { themeList, applyTheme, themeFor } from './themes.js';
import { qualityOptions } from '../world/quality.js';
import { originAllowed } from '../cloud/config.js';
import { syncConfigured, isSignedIn, account, lastSync, signIn, signOut, syncNow } from '../cloud/sync.js';

export function renderSettings(ctx) {
  const s = getState();

  // ---- Units ----
  const unitsBody = div();
  function renderUnits() {
    unitsBody.innerHTML = '';
    unitsBody.append(div({ class: 'row' }, [
      btn('Metric', () => { s.settings.units = applyPreset(s.settings.units, 'metric'); save(); renderUnits(); }, 'btn ghost'),
      btn('Imperial', () => { s.settings.units = applyPreset(s.settings.units, 'imperial'); save(); renderUnits(); }, 'btn ghost'),
      btn('Deeply Obscure', () => { s.settings.units = applyPreset(s.settings.units, 'bizarre'); save(); renderUnits(); }, 'btn ghost')
    ]));
    const grid = div({ class: 'units-grid' });
    for (const [type, def] of Object.entries(MEASUREMENTS)) {
      const opts = unitOptions(type).map((u) => ({ value: u.id, label: `${u.label} (${u.symbol || '—'})` }));
      grid.append(field(def.label, select(opts, s.settings.units[type], (v) => { s.settings.units[type] = v; save(); })));
    }
    unitsBody.append(grid);
  }
  renderUnits();

  // ---- HUD layout ----
  const hudBody = div({ class: 'hud-layout' });
  function renderHud() {
    hudBody.innerHTML = '';
    s.settings.hud.forEach((item, i) => {
      const def = READINGS[item.id];
      if (!def) return;
      const convertible = !['time', 'text', 'wkg'].includes(def.type);
      const unitSel = convertible
        ? select([{ value: '', label: 'Global default' }, ...unitOptions(def.type).map((u) => ({ value: u.id, label: u.symbol || u.label }))],
            item.unit || '', (v) => { item.unit = v || null; save(); })
        : el('span', { class: 'dim' }, '—');

      hudBody.append(div({ class: 'hud-row' }, [
        el('input', { type: 'checkbox', checked: item.visible, onchange: (e) => { item.visible = e.target.checked; save(); } }),
        div({ class: 'hud-row-label' }, def.label),
        div({ class: 'hud-row-unit' }, unitSel),
        div({ class: 'seg-actions' }, [
          btn('↑', () => moveHud(i, -1), 'btn icon'),
          btn('↓', () => moveHud(i, 1), 'btn icon')
        ])
      ]));
    });
  }
  function moveHud(i, d) {
    const j = i + d;
    if (j < 0 || j >= s.settings.hud.length) return;
    [s.settings.hud[i], s.settings.hud[j]] = [s.settings.hud[j], s.settings.hud[i]];
    save(); renderHud();
  }
  renderHud();

  // ---- Session ----
  const sessionCard = div({ class: 'card' }, [
    h(2, 'Session'),
    field('On reaching the end', select([
      { value: 'complete', label: 'Finish the ride (show summary)' },
      { value: 'teleport', label: 'Teleport back to start (loop)' },
      { value: 'turnaround', label: 'Turn around at the terminus' }
    ], s.settings.sessionEndMode, (v) => { s.settings.sessionEndMode = v; save(); })),
    div({ class: 'hint' }, 'Applies to every route. Any route can also be ridden in reverse from the route list.')
  ]);

  // ---- Trainer control & ride behaviour ----
  const diffLabel = el('label', {}, `Trainer difficulty — ${Math.round(s.settings.trainerDifficulty * 100)}% of the road gradient`);
  const trainerCard = div({ class: 'card' }, [
    h(2, 'Trainer & Ride'),
    div({ class: 'field' }, [
      diffLabel,
      el('input', { type: 'range', min: 0, max: 150, step: 5, value: Math.round(s.settings.trainerDifficulty * 100),
        oninput: (e) => { s.settings.trainerDifficulty = +e.target.value / 100; diffLabel.textContent = `Trainer difficulty — ${e.target.value}% of the road gradient`; save(); } })
    ]),
    div({ class: 'hint' }, 'On an FTMS smart trainer the road gradient (scaled by this) is sent as resistance, and a workout target overrides it with ERG mode. ' +
      'Your speed in the world always uses the real gradient. Read-only trainers and power meters are unaffected.'),
    div({ class: 'field' }, [
      el('label', {}, 'Auto-pause'),
      checkbox('Stop the clock when a real trainer goes quiet at a standstill; pedal to resume', s.settings.autoPause, (v) => { s.settings.autoPause = v; save(); })
    ]),
    div({ class: 'hint' }, 'Rides also autosave every few seconds — a crash or a dead battery still leaves the ride in History. The screen stays awake while riding, and you get a chime at 20 / 10 / 5 % battery.')
  ]);

  // ---- Sound ----
  const volLabel = el('label', {}, `Volume — ${Math.round((s.settings.audio.volume ?? 0.5) * 100)}%`);
  const soundCard = div({ class: 'card' }, [
    h(2, 'Sound'),
    div({ class: 'field' }, [
      el('label', {}, 'Ride sounds'),
      checkbox('Tyre & wind hiss, chain hum, freewheel clicks, and cues for zones, workout blocks and climbs', s.settings.audio.enabled, (v) => { s.settings.audio.enabled = v; save(); })
    ]),
    div({ class: 'field' }, [
      volLabel,
      el('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round((s.settings.audio.volume ?? 0.5) * 100),
        oninput: (e) => { s.settings.audio.volume = +e.target.value / 100; volLabel.textContent = `Volume — ${e.target.value}%`; save(); } })
    ]),
    div({ class: 'hint' }, 'Everything is synthesised in the browser — no audio files. Press M during a ride to mute.')
  ]);

  // ---- Font (house standard: shared picker from adervec.github.io/font.js) ----
  const fontCard = div({ class: 'card' }, [
    h(2, 'Font'),
    el('app-font-picker'),
    div({ class: 'hint' }, 'Shared with the other apps from this maker. Needs a connection the first time; the HUD numbers keep their own face.')
  ]);

  const ghostCard = div({ class: 'card' }, [
    h(2, 'Ghost & Playback'),
    div({ class: 'field' }, [
      el('label', {}, 'Player ghost'),
      checkbox('Show a ghost of my all-time PB on the overhead map (with time-behind)', s.settings.ghost.enabled, (v) => { s.settings.ghost.enabled = v; save(); })
    ]),
    field('Preview speed (m/s)', numberInput(s.settings.previewSpeedMs, (v) => { s.settings.previewSpeedMs = Math.max(2, Number(v) || 40); save(); }, { min: 2, max: 300, step: 1 })),
    field('Replay speed (×)', numberInput(s.settings.replaySpeedMul, (v) => { s.settings.replaySpeedMul = Math.max(0.25, Number(v) || 4); save(); }, { min: 0.25, max: 30, step: 0.25 })),
    div({ class: 'hint' }, 'The ghost defaults to your fastest completed lap for that route & direction. Ghost shows on the map only — never as a second rider in the 3D world. Categorised climbs on a route are timed against it too.')
  ]);

  // ---- Cloud sync (Google Drive appData) ----
  const syncCard = div({ class: 'card' });
  function renderSync(msg = '', msgCls = 'hint') {
    syncCard.innerHTML = '';
    const cfg = s.settings.sync;
    const configured = syncConfigured(cfg.driveClientId);
    const acct = account();

    const rows = [
      h(2, 'Cloud Sync'),
      div({ class: 'hint' }, 'Syncs rides, PBs, routes, workouts, riders, bikes and decals to a private folder in ' +
        'your own Google Drive — visible to this app only, never to anyone else. Units, HUD layout, theme ' +
        'and graphics quality stay local to each device.')
    ];

    if (!configured) {
      rows.push(div({ class: 'warn' }, 'Cloud sync isn’t enabled on this deployment. Create a Google OAuth ' +
        'client ID (Web application), add this page’s origin to its authorized JavaScript origins, enable ' +
        'the Drive API, and paste the ID below.'));
    } else if (!isSignedIn()) {
      rows.push(div({ class: 'row' }, [
        btn('Connect Google Drive', async () => {
          renderSync('Connecting…');
          try { const r = await signIn(); renderSync(summarize(r), 'ok'); }
          catch (e) { renderSync(e.message, 'err'); }
        })
      ]));
    } else {
      rows.push(div({ class: 'row' }, [
        acct?.picture ? el('img', { src: acct.picture, alt: '', referrerpolicy: 'no-referrer', width: 28, height: 28, style: { borderRadius: '50%' } }) : null,
        el('strong', {}, acct?.name || 'Google account'),
        acct?.email ? el('span', { class: 'dim small' }, acct.email) : null
      ]));
      rows.push(div({ class: 'row' }, [
        btn('Sync now', async () => {
          renderSync('Syncing…');
          try { const r = await syncNow(); renderSync(summarize(r), r.stored ? 'ok' : 'warn'); }
          catch (e) { renderSync(e.message, 'err'); }
        }),
        btn('Sign out', () => { signOut(); renderSync('Signed out. Your data stays on this device.'); }, 'btn ghost')
      ]));
      rows.push(div({ class: 'field' }, [
        el('label', {}, 'Automatic sync'),
        checkbox('Sync on startup and after each ride', cfg.auto, (v) => { cfg.auto = v; save(); })
      ]));
    }

    if (lastSync()) rows.push(div({ class: 'hint small' }, `Last synced: ${new Date(lastSync()).toLocaleString()}`));
    if (msg) rows.push(div({ class: msgCls }, msg));

    // Fork escape hatch: only worth showing where the built-in ID can't be used.
    if (!originAllowed()) {
      rows.push(field('Your Google OAuth client ID', textInput(cfg.driveClientId, (v) => {
        cfg.driveClientId = v.trim(); save(); renderSync();
      }, 'xxxxx.apps.googleusercontent.com')));
    }

    syncCard.append(...rows.filter(Boolean));
  }
  function summarize(r) {
    const base = `${r.pulled ? 'Merged with' : 'Uploaded to'} Drive — ${r.activities} activities, ${r.routes} routes.`;
    return r.stored ? base : base + ' NOTE: too big to save locally — delete some old activities.';
  }
  renderSync();

  const dangerCard = div({ class: 'card' }, [
    h(2, 'Data'),
    btn('Reset everything to defaults', () => {
      if (confirm('Reset profile, garage, routes and settings to defaults?')) { resetState(); ctx.router.go('settings'); }
    }, 'btn danger'),
    btn('Erase all of this app’s data on this device', async () => {
      if (!confirm('Erase every ride, route, workout, profile and setting stored on this device, and disconnect cloud sync? This cannot be undone. The copy in Google Drive is not touched.')) return;
      signOut();
      eraseLocalKeys();
      await forgetCoworkFolder();
      try { for (const k of await caches.keys()) if (k.startsWith('bmbr-')) await caches.delete(k); } catch { /* no Cache API */ }
      location.reload();
    }, 'btn danger'),
    div({ class: 'hint' }, 'Erase removes only Black Mirror Bike Ride’s data. Other apps from this maker, files already written to a cowork folder, and the Google Drive copy are left alone.')
  ]);

  const appearanceCard = div({ class: 'card' }, [
    h(2, 'Appearance'),
    field('Menu theme', select(themeList(), themeFor(s.settings.theme), (v) => { s.settings.theme = v; applyTheme(v); save(); })),
    div({ class: 'hint' }, 'Themes restyle the whole UI. Applied instantly and remembered.'),
    field('Graphics quality', select(qualityOptions(), s.settings.graphicsQuality, (v) => { s.settings.graphicsQuality = v; save(); })),
    div({ class: 'hint' }, 'Controls resolution, shadow detail, image-based lighting and bloom in the 3D world & garage. Higher looks richer but needs more GPU. Applies next time you open a ride or the garage.'),
    btn('Manage skyboxes →', () => ctx.router.go('skyboxes'), 'btn ghost')
  ]);

  return screen('Settings', ctx, [
    appearanceCard,
    div({ class: 'card' }, [
      h(2, 'Units'),
      div({ class: 'hint' }, 'Pick a preset, or set each measurement individually. Per-reading overrides live in the HUD layout below.'),
      unitsBody
    ]),
    div({ class: 'card' }, [
      h(2, 'In-Ride HUD Layout'),
      div({ class: 'hint' }, 'Show/hide, reorder, and override the unit for each reading. Live power tiles take the colour of your current zone (from your FTP).'),
      hudBody
    ]),
    sessionCard,
    trainerCard,
    soundCard,
    fontCard,
    ghostCard,
    syncCard,
    dangerCard
  ]);
}
