import { div, h, el, field, select, textInput, numberInput, btn, screen } from './dom.js';
import { getState, save, resetState } from '../state.js';
import { MEASUREMENTS, unitOptions, applyPreset } from '../game/units.js';
import { READINGS } from '../game/hudConfig.js';
import { themeList, applyTheme } from './themes.js';
import { qualityOptions } from '../world/quality.js';

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

  // ---- Session & API ----
  const sessionCard = div({ class: 'card' }, [
    h(2, 'Session'),
    field('On reaching the end', select([
      { value: 'complete', label: 'Finish the ride (show summary)' },
      { value: 'teleport', label: 'Teleport back to start (loop)' },
      { value: 'turnaround', label: 'Turn around at the terminus' }
    ], s.settings.sessionEndMode, (v) => { s.settings.sessionEndMode = v; save(); })),
    div({ class: 'hint' }, 'Applies to every route. Any route can also be ridden in reverse from the route list.')
  ]);

  const ghostCard = div({ class: 'card' }, [
    h(2, 'Ghost & Playback'),
    div({ class: 'field' }, [
      el('label', {}, 'Player ghost'),
      div({ class: 'row' }, [
        el('input', { type: 'checkbox', checked: s.settings.ghost.enabled, onchange: (e) => { s.settings.ghost.enabled = e.target.checked; save(); } }),
        el('span', {}, 'Show a ghost of my all-time PB on the overhead map (with time-behind)')
      ])
    ]),
    field('Preview speed (m/s)', numberInput(s.settings.previewSpeedMs, (v) => { s.settings.previewSpeedMs = Math.max(2, Number(v) || 40); save(); }, { min: 2, max: 300, step: 1 })),
    field('Replay speed (×)', numberInput(s.settings.replaySpeedMul, (v) => { s.settings.replaySpeedMul = Math.max(0.25, Number(v) || 4); save(); }, { min: 0.25, max: 30, step: 0.25 })),
    div({ class: 'hint' }, 'The ghost defaults to your fastest completed lap for that route & direction. Ghost shows on the map only — never as a second rider in the 3D world.')
  ]);

  const apiCard = div({ class: 'card' }, [
    h(2, 'Google Maps API key'),
    field('Key', textInput(s.settings.googleMapsApiKey, (v) => { s.settings.googleMapsApiKey = v.trim(); save(); }, 'AIza…')),
    div({ class: 'hint' }, 'Optional. Enables elevation + Street View for real routes. Without it, real routes fall back to the satellite-derived 3D world. Stored locally only.')
  ]);

  const dangerCard = div({ class: 'card' }, [
    h(2, 'Data'),
    btn('Reset everything to defaults', () => {
      if (confirm('Reset profile, garage, routes and settings to defaults?')) { resetState(); ctx.router.go('settings'); }
    }, 'btn danger')
  ]);

  const appearanceCard = div({ class: 'card' }, [
    h(2, 'Appearance'),
    field('Menu theme', select(themeList(), s.settings.theme, (v) => { s.settings.theme = v; applyTheme(v); save(); })),
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
      div({ class: 'hint' }, 'Show/hide, reorder, and override the unit for each reading.'),
      hudBody
    ]),
    sessionCard,
    ghostCard,
    apiCard,
    dangerCard
  ]);
}
