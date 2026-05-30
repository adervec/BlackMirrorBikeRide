// Renders live telemetry into configurable stat tiles. Layout (which readings,
// order, visibility) and per-reading unit overrides come from settings; the
// units system does the conversion/formatting. Tiles are built once per layout
// change and only their values are updated each frame.

import { READINGS } from './hudConfig.js';
import { format, formatTime } from './units.js';

export class HUD {
  constructor(container) {
    this.container = container;
    this._sig = '';
    this._els = {};
  }

  _layoutSig(layout) {
    return layout.filter((l) => l.visible).map((l) => `${l.id}:${l.unit || ''}`).join('|');
  }

  render(telemetry, settings) {
    const layout = settings.hud;
    const prefs = settings.units;
    const sig = this._layoutSig(layout);
    if (sig !== this._sig) { this._build(layout); this._sig = sig; }

    for (const item of layout) {
      if (!item.visible) continue;
      const def = READINGS[item.id];
      const el = this._els[item.id];
      if (!def || !el) continue;
      const raw = telemetry[def.field];
      el.value.textContent = this._fmtValue(def, raw, prefs, item.unit);
      el.unit.textContent = this._fmtUnit(def, raw, prefs, item.unit);
    }
  }

  _fmtValue(def, raw, prefs, override) {
    if (def.type === 'time') return formatTime(raw);
    if (def.type === 'text') return raw == null || raw === '' ? '—' : String(raw);
    if (def.type === 'wkg') return raw == null || Number.isNaN(raw) ? '—' : raw.toFixed(2);
    const f = format(def.type, raw, prefs, override);
    return f.value;
  }

  _fmtUnit(def, raw, prefs, override) {
    if (def.type === 'time' || def.type === 'text') return '';
    if (def.type === 'wkg') return 'W/kg';
    const f = format(def.type, raw, prefs, override);
    return f.symbol;
  }

  _build(layout) {
    this.container.innerHTML = '';
    this._els = {};
    for (const item of layout) {
      if (!item.visible) continue;
      const def = READINGS[item.id];
      if (!def) continue;
      const tile = document.createElement('div');
      tile.className = 'hud-tile';
      const value = document.createElement('div');
      value.className = 'hud-value';
      const unit = document.createElement('span');
      unit.className = 'hud-unit';
      const label = document.createElement('div');
      label.className = 'hud-label';
      label.textContent = def.label;
      const row = document.createElement('div');
      row.className = 'hud-value-row';
      row.append(value, unit);
      tile.append(row, label);
      this.container.appendChild(tile);
      this._els[item.id] = { value, unit, tile };
    }
  }
}
