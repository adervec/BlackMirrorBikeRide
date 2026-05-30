import { div, h, el, field, select, numberInput, textInput, btn, screen } from './dom.js';
import { getState, getRoute, upsertRoute } from '../state.js';
import { createEmptyVirtualRoute, defaultSegment, buildProfile, totalDistance, ONTARIO_AIR_DENSITY } from '../routes/virtualRoute.js';
import { surfaceList } from '../physics/surfaces.js';
import { biomeList } from '../routes/biomes.js';
import { allSkyboxOptions } from '../routes/skyboxes.js';

export function renderVirtualBuilder(ctx) {
  const existing = ctx.params.routeId ? getRoute(ctx.params.routeId) : null;
  // Work on a deep copy so cancel is non-destructive; commit on Save.
  const route = existing ? structuredClone(existing) : createEmptyVirtualRoute();

  const surfaceOpts = surfaceList().map((s) => ({ value: s.id, label: s.label }));
  const biomeOpts = biomeList().map((b) => ({ value: b.id, label: b.label }));
  const skyOpts = allSkyboxOptions(getState().customSkyboxes).map((s) => ({ value: s.id, label: s.label }));

  const summary = div({ class: 'builder-summary' });
  const previewCanvas = el('canvas', { class: 'profile-canvas', width: 600, height: 120 });
  const segList = div({ class: 'seg-list' });

  function refreshSummary() {
    const prof = buildProfile(route);
    const km = (totalDistance(route) / 1000).toFixed(2);
    const climb = Math.round(prof.bounds.maxY - prof.bounds.minY);
    summary.innerHTML = '';
    summary.append(`${km} km · ${route.segments.length} segments · elevation span ${climb} m`);
    drawPreview(previewCanvas, prof);
  }

  function renderSegList() {
    segList.innerHTML = '';
    route.segments.forEach((seg, i) => {
      const upd = (key, parse = (v) => v) => (v) => { seg[key] = parse(v); refreshSummary(); };
      segList.append(div({ class: 'seg-row' }, [
        div({ class: 'seg-idx' }, '#' + (i + 1)),
        labeled('Surface', select(surfaceOpts, seg.surface, upd('surface'))),
        labeled('Gradient %', numberInput((seg.gradient * 100).toFixed(1), upd('gradient', (v) => (Number(v) || 0) / 100), { step: 0.1, min: -30, max: 30 })),
        labeled('Length m', numberInput(seg.length, upd('length', Number), { min: 10, step: 10 })),
        labeled('Biome', select(biomeOpts, seg.biome, upd('biome'))),
        labeled('Turn °', numberInput(seg.turn || 0, upd('turn', Number), { step: 5, min: -180, max: 180 })),
        div({ class: 'seg-actions' }, [
          btn('↑', () => move(i, -1), 'btn icon'),
          btn('↓', () => move(i, 1), 'btn icon'),
          btn('⧉', () => { route.segments.splice(i + 1, 0, structuredClone(seg)); renderSegList(); refreshSummary(); }, 'btn icon'),
          btn('✕', () => { route.segments.splice(i, 1); if (!route.segments.length) route.segments.push(defaultSegment()); renderSegList(); refreshSummary(); }, 'btn icon danger')
        ])
      ]));
    });
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= route.segments.length) return;
    [route.segments[i], route.segments[j]] = [route.segments[j], route.segments[i]];
    renderSegList(); refreshSummary();
  }

  const meta = div({ class: 'card' }, [
    h(2, 'Route Settings'),
    field('Name', textInput(route.name, (v) => { route.name = v; })),
    field('Skybox', select(skyOpts, route.skybox, (v) => { route.skybox = v; })),
    field('Air density (kg/m³)', numberInput(route.airDensity, (v) => { route.airDensity = Number(v) || ONTARIO_AIR_DENSITY; }, { step: 0.01, min: 0.5, max: 1.5 })),
    div({ class: 'hint' }, `Air resistance is a route constant (no wind/drafting). Ontario default ≈ ${ONTARIO_AIR_DENSITY}.`)
  ]);

  renderSegList();
  refreshSummary();

  return screen(existing ? 'Edit Virtual Route' : 'New Virtual Route', ctx, [
    meta,
    div({ class: 'card' }, [
      h(2, 'Segments'),
      div({ class: 'hint' }, 'Each segment = a surface material at an incline, for a length, in a biome. Turn bends the route.'),
      segList,
      btn('+ Add segment', () => { route.segments.push(defaultSegment()); renderSegList(); refreshSummary(); })
    ]),
    div({ class: 'card' }, [h(2, 'Elevation Profile'), previewCanvas, summary]),
    div({ class: 'row sticky-actions' }, [
      btn('Save', () => { upsertRoute(route); ctx.router.go('routes'); }),
      btn('Save & Ride', () => { upsertRoute(route); ctx.router.go('ride', { routeId: route.id, reverse: false }); }),
      btn('Cancel', () => ctx.router.go('routes'), 'btn ghost')
    ])
  ], { backTo: 'routes' });
}

function labeled(label, control) { return div({ class: 'seg-cell' }, [el('label', {}, label), control]); }

function drawPreview(canvas, profile) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // e.g. headless environments without a 2D canvas
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0e1118'; ctx.fillRect(0, 0, W, H);
  const pts = profile.points;
  const total = profile.totalLength || 1;
  const minY = profile.bounds.minY, maxY = profile.bounds.maxY;
  const span = Math.max(1, maxY - minY);
  const xOf = (s) => (s / total) * W;
  const yOf = (y) => H - 12 - ((y - minY) / span) * (H - 24);
  // filled area
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (const p of pts) ctx.lineTo(xOf(p.s), yOf(p.y));
  ctx.lineTo(W, H); ctx.closePath();
  ctx.fillStyle = 'rgba(80,160,220,0.35)'; ctx.fill();
  ctx.strokeStyle = '#7fc8ff'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  pts.forEach((p, i) => { const x = xOf(p.s), y = yOf(p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
}
