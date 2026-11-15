import { div, h, el, field, select, numberInput, textInput, colorInput, btn, screen } from './dom.js';
import {
  getState, save, activePlayer, setActivePlayer, upsertPlayer, deletePlayer,
  activeRider, setActiveRider, upsertRider, deleteRider,
  activeBike, upsertBike, deleteBike, addDecal, deleteDecal
} from '../state.js';
import { makePlayer, computeFrontalArea, ftpWkg } from '../profile/player.js';
import { makeRider, BUILDS } from '../profile/customize.js';
import { CLOTHING, clothingItemList, JERSEY_PATTERNS, OUTFITS, applyOutfit } from '../profile/clothing.js';
import { faceOptionLists } from '../profile/face.js';
import { FRAMES, WHEELS, TIRES, POSITIONS, VEHICLE_TYPES, computeBikeSpec, makeBike, partsByTheme } from '../profile/garage.js';
import { makeDecal } from '../profile/decals.js';
import { computeCdA, totalMass } from '../physics/engine.js';
import { GaragePreview } from '../world/garagePreview.js';
import { t, num } from '../i18n.js';

const optObj = (obj) => Object.entries(obj).map(([value, v]) => ({ value, label: t(v.label) }));
// Option lists whose English labels live in the profile modules (keys listed there).
const tr = (opts) => opts.map((o) => ({ ...o, label: t(o.label) }));

export function renderGarage(ctx) {
  const s = getState();
  let tab = ctx.params.tab || 'players';
  let preview = null;
  let themeFilter = '';

  const previewBox = div({ class: 'preview-box' });
  const tabContent = div({ class: 'tab-content' });
  const specLine = div({ class: 'spec-line' });

  function refreshPreview() {
    if (preview) preview.setSubject({ rider: activeRider(), bike: activeBike(), player: activePlayer(), decals: s.decals });
    refreshSpec();
  }
  function refreshSpec() {
    const spec = computeBikeSpec(activeBike());
    const cda = computeCdA(activePlayer(), spec);
    const mass = totalMass(activePlayer(), spec);
    specLine.innerHTML = '';
    specLine.append(t.n('CdA {cda} m² · system {mass} kg · Crr {crr} · {n} wheel', 'CdA {cda} m² · system {mass} kg · Crr {crr} · {n} wheels', spec.wheelCount,
      { cda: num(cda, 3), mass: num(mass, 1), crr: num(spec.crr, 4) }));
  }

  const tabs = ['players', 'riders', 'bikes', 'decals'];
  const tabLabels = { players: t('Players'), riders: t('Riders'), bikes: t('Bikes'), decals: t('Decals') };
  const tabBar = div({ class: 'tab-bar' }, tabs.map((id) =>
    btn(tabLabels[id], () => { tab = id; renderTab(); }, 'btn small tab-btn')));

  function setActiveTabHighlight() {
    [...tabBar.children].forEach((b, i) => b.classList.toggle('active', tabs[i] === tab));
  }

  function renderTab() {
    setActiveTabHighlight();
    tabContent.innerHTML = '';
    if (tab === 'players') tabContent.append(playersTab());
    else if (tab === 'riders') tabContent.append(ridersTab());
    else if (tab === 'bikes') tabContent.append(bikesTab());
    else tabContent.append(decalsTab());
    refreshPreview();
  }

  // ---------------- PLAYERS ----------------
  function playersTab() {
    const p = activePlayer();
    const bind = (k, parse = (v) => v) => (v) => { p[k] = parse(v); upsertPlayer(p); refreshSpec(); };
    const card = div({ class: 'card' }, [
      h(2, t('Players (the real human)')),
      div({ class: 'hint' }, t('The player pedals: weight & body size drive the physics. Separate from the in-game rider/avatar.')),
      field(t('Active player'), select(s.players.map((x) => ({ value: x.id, label: x.name })), s.activePlayerId, (id) => { setActivePlayer(id); renderTab(); })),
      field(t('Name'), textInput(p.name, bind('name'))),
      field(t('Weight (kg)'), numberInput(p.weightKg, bind('weightKg', Number), { min: 30, max: 200, step: 0.5 })),
      field(t('Height (cm)'), numberInput(p.heightCm, bind('heightCm', Number), { min: 120, max: 230 })),
      field(t('Age'), numberInput(p.age, bind('age', Number), { min: 10, max: 100 })),
      field(t('Shoulder width (cm)'), numberInput(p.shoulderWidthCm, bind('shoulderWidthCm', Number), { min: 30, max: 70 })),
      field(t('Inseam (cm)'), numberInput(p.inseamCm, bind('inseamCm', Number), { min: 50, max: 110 })),
      field(t('FTP (W)'), numberInput(p.ftpW, bind('ftpW', Number), { min: 50, max: 600 })),
      div({ class: 'spec-row' }, [el('span', {}, t('Frontal area')), el('strong', {}, `${num(computeFrontalArea(p), 3)} m²`)]),
      div({ class: 'spec-row' }, [el('span', {}, t('FTP W/kg')), el('strong', {}, num(ftpWkg(p), 2))]),
      div({ class: 'row' }, [
        btn(t('+ New player'), () => { const np = makePlayer(t('Player {n}', { n: s.players.length + 1 })); upsertPlayer(np); setActivePlayer(np.id); renderTab(); }),
        s.players.length > 1 ? btn(t('Delete'), () => { deletePlayer(p.id); renderTab(); }, 'btn danger') : null
      ])
    ]);
    return card;
  }

  // ---------------- RIDERS ----------------
  function ridersTab() {
    const r = activeRider();
    const player = activePlayer();
    const rb = () => { upsertRider(r); refreshPreview(); };
    const faceBind = (k) => (v) => { r.face[k] = v; rb(); };
    const wrap = div({ class: 'rider-tab' });

    wrap.append(div({ class: 'card' }, [
      h(2, t('Riders (the avatar)')),
      div({ class: 'hint' }, t('Riders are cosmetic — they never affect speed. Snap a rider to the active player to mirror their proportions.')),
      field(t('Active rider'), select(s.riders.map((x) => ({ value: x.id, label: x.name })), s.activeRiderId, (id) => { setActiveRider(id); renderTab(); })),
      field(t('Name'), textInput(r.name, (v) => { r.name = v; rb(); })),
      div({ class: 'field' }, [el('label', {}, t('Body')), div({ class: 'row' }, [
        el('input', { type: 'checkbox', checked: r.snapToPlayer, onchange: (e) => { r.snapToPlayer = e.target.checked; rb(); renderTab(); } }),
        el('span', {}, t('Snap proportions to {name}', { name: player.name }))
      ])]),
      r.snapToPlayer ? null : field(t('Height (cm)'), numberInput(r.body.heightCm, (v) => { r.body.heightCm = Number(v); rb(); }, { min: 120, max: 230 })),
      field(t('Build'), select(optObj(BUILDS), r.body.build, (v) => { r.body.build = v; rb(); })),
      field(t('Map icon colour'), colorInput(r.mapIconColor, (v) => { r.mapIconColor = v; rb(); })),
      div({ class: 'row' }, [
        btn(t('+ New rider'), () => { const nr = makeRider(t('Rider {n}', { n: s.riders.length + 1 })); upsertRider(nr); setActiveRider(nr.id); renderTab(); }),
        s.riders.length > 1 ? btn(t('Delete'), () => { deleteRider(r.id); renderTab(); }, 'btn danger') : null
      ])
    ]));

    // face
    wrap.append(div({ class: 'card' }, [
      h(3, t('Face')),
      field(t('Skin tone'), colorInput(r.face.skinTone, faceBind('skinTone'))),
      field(t('Face shape'), select(tr(faceOptionLists.faceShape), r.face.faceShape, faceBind('faceShape'))),
      field(t('Eye colour'), colorInput(r.face.eyeColor, faceBind('eyeColor'))),
      field(t('Brows'), select(tr(faceOptionLists.browType), r.face.browType, faceBind('browType'))),
      field(t('Brow colour'), colorInput(r.face.browColor, faceBind('browColor'))),
      field(t('Nose'), select(tr(faceOptionLists.noseType), r.face.noseType, faceBind('noseType'))),
      field(t('Mouth'), select(tr(faceOptionLists.mouthType), r.face.mouthType, faceBind('mouthType'))),
      field(t('Facial hair'), select(tr(faceOptionLists.facialHair), r.face.facialHair, faceBind('facialHair'))),
      field(t('Facial hair colour'), colorInput(r.face.facialHairColor, faceBind('facialHairColor'))),
      field(t('Hair'), select(tr(faceOptionLists.hairStyle), r.face.hairStyle, faceBind('hairStyle'))),
      field(t('Hair colour'), colorInput(r.face.hairColor, faceBind('hairColor')))
    ]));

    // clothing
    const cloCard = div({ class: 'card' }, [h(3, t('Clothing'))]);
    cloCard.append(field(t('Apply outfit'), select(
      [{ value: '', label: t('— pick an outfit —') }, ...optObj(OUTFITS)], '',
      (v) => { if (v) { r.clothing = applyOutfit(v); rb(); renderTab(); } })));
    for (const slot of Object.keys(CLOTHING)) {
      const c = r.clothing[slot];
      const row = div({ class: 'clo-row' }, [
        el('label', {}, t(CLOTHING[slot].label)),
        select(tr(clothingItemList(slot)), c.item, (v) => { c.item = v; rb(); }),
        colorInput(c.color, (v) => { c.color = v; rb(); })
      ]);
      cloCard.append(row);
      if (slot === 'jersey') {
        cloCard.append(div({ class: 'clo-row' }, [
          el('label', {}, t('Jersey accent / pattern')),
          colorInput(c.accent, (v) => { c.accent = v; rb(); }),
          select(Object.entries(JERSEY_PATTERNS).map(([value, label]) => ({ value, label: t(label) })), c.pattern, (v) => { c.pattern = v; rb(); })
        ]));
      }
    }
    wrap.append(cloCard);

    // tattoos
    const tatCard = div({ class: 'card' }, [h(3, t('Tattoos')), div({ class: 'hint' }, t('Decals flagged for tattoos. Cosmetic only.'))]);
    const tats = s.decals.filter((d) => d.kinds.includes('tattoo'));
    tatCard.append(div({ class: 'decal-grid' }, tats.map((d) =>
      btn(`${d.glyph} ${d.label}`, () => {
        r.tattoos = r.tattoos.includes(d.id) ? r.tattoos.filter((x) => x !== d.id) : [...r.tattoos, d.id];
        rb(); renderTab();
      }, 'btn small' + (r.tattoos.includes(d.id) ? ' active' : '')))));
    wrap.append(tatCard);

    return wrap;
  }

  // ---------------- BIKES ----------------
  function bikesTab() {
    const b = activeBike();
    const bb = (k, parse = (v) => v) => (v) => { b[k] = parse(v); upsertBike(b); refreshPreview(); };
    const themeOpts = [{ value: '', label: t('All themes') }, { value: 'real', label: t('Real') }, { value: 'madmax', label: t('Mad Max') }, { value: 'scifi', label: t('Sci-Fi') }];
    const wrap = div({ class: 'bikes-tab' });

    wrap.append(div({ class: 'card' }, [
      h(2, t('Vehicle Garage')),
      div({ class: 'hint' }, t('Build bikes, trikes, quads, unicycles… parts snap together with cheerful Ork logic. Parts have real physics; clothing/decals do not.')),
      field(t('Active vehicle'), select(s.garage.bikes.map((x) => ({ value: x.id, label: x.name })), s.garage.activeBikeId, (id) => { s.garage.activeBikeId = id; save(); renderTab(); })),
      field(t('Name'), textInput(b.name, bb('name'))),
      field(t('Vehicle type'), select(optObj(VEHICLE_TYPES), b.vehicleType, bb('vehicleType'))),
      field(t('Parts theme filter'), select(themeOpts, themeFilter, (v) => { themeFilter = v; renderTab(); })),
      field(t('Frame'), select(partsByTheme(FRAMES, themeFilter), b.frame, bb('frame'))),
      field(t('Wheels'), select(partsByTheme(WHEELS, themeFilter), b.wheels, bb('wheels'))),
      field(t('Tyres'), select(partsByTheme(TIRES, themeFilter), b.tires, bb('tires'))),
      field(t('Riding position'), select(optObj(POSITIONS), b.position, bb('position'))),
      field(t('Frame colour'), colorInput(b.color, bb('color'))),
      field(t('Accent colour'), colorInput(b.accentColor, bb('accentColor'))),
      div({ class: 'row' }, [
        btn(t('+ New vehicle'), () => { const nb = makeBike(t('Build {n}', { n: s.garage.bikes.length + 1 })); upsertBike(nb); s.garage.activeBikeId = nb.id; save(); renderTab(); }),
        s.garage.bikes.length > 1 ? btn(t('Delete'), () => { deleteBike(b.id); renderTab(); }, 'btn danger') : null
      ])
    ]));

    // sprays
    const sprayCard = div({ class: 'card' }, [h(3, t('Vehicle Sprays')), div({ class: 'hint' }, t('Decals flagged for vehicles. Cosmetic only.'))]);
    const sprays = s.decals.filter((d) => d.kinds.includes('vehicle'));
    sprayCard.append(div({ class: 'decal-grid' }, sprays.map((d) =>
      btn(`${d.glyph} ${d.label}`, () => {
        b.sprays = (b.sprays || []).includes(d.id) ? b.sprays.filter((x) => x !== d.id) : [...(b.sprays || []), d.id];
        upsertBike(b); refreshPreview(); renderTab();
      }, 'btn small' + ((b.sprays || []).includes(d.id) ? ' active' : '')))));
    wrap.append(sprayCard);

    return wrap;
  }

  // ---------------- DECALS ----------------
  function decalsTab() {
    const wrap = div({ class: 'decals-tab' });
    const list = div({ class: 'card' }, [h(2, t('Decal Library')), div({ class: 'hint' }, t('Glyph badges usable as vehicle sprays and/or tattoos. Defaults are wholesome & permanent. No speed impact.'))]);
    list.append(div({ class: 'decal-list' }, s.decals.map((d) =>
      div({ class: 'decal-item' }, [
        el('span', { class: 'decal-glyph', style: { color: d.color } }, d.glyph),
        div({}, [div({}, d.label), div({ class: 'dim small' }, [d.kinds.map((k) => (k === 'vehicle' ? t('vehicle') : k === 'tattoo' ? t('tattoo') : k)).join(' + '), d.removable ? '' : ' · ', d.removable ? '' : t('default')])]),
        d.removable ? btn('✕', () => { deleteDecal(d.id); renderTab(); }, 'btn icon danger') : el('span', { class: 'dim small' }, '🔒')
      ]))));
    wrap.append(list);

    // create custom
    const draft = { label: t('My Decal'), glyph: '✦', color: '#ffd24a', vehicle: true, tattoo: true };
    wrap.append(div({ class: 'card' }, [
      h(3, t('Create Decal')),
      field(t('Label'), textInput(draft.label, (v) => { draft.label = v; })),
      field(t('Glyph / emoji'), textInput(draft.glyph, (v) => { draft.glyph = v; })),
      field(t('Colour'), colorInput(draft.color, (v) => { draft.color = v; })),
      div({ class: 'row' }, [
        el('label', {}, [el('input', { type: 'checkbox', checked: true, onchange: (e) => { draft.vehicle = e.target.checked; } }), ' ', t('Vehicle spray')]),
        el('label', {}, [el('input', { type: 'checkbox', checked: true, onchange: (e) => { draft.tattoo = e.target.checked; } }), ' ', t('Tattoo')])
      ]),
      btn(t('+ Add decal'), () => {
        const kinds = [draft.vehicle && 'vehicle', draft.tattoo && 'tattoo'].filter(Boolean);
        if (!kinds.length) { alert(t('Pick at least one kind.')); return; }
        addDecal(makeDecal({ label: draft.label, glyph: draft.glyph, color: draft.color, kinds }));
        renderTab();
      })
    ]));
    return wrap;
  }

  // mount
  requestAnimationFrame(() => {
    preview = new GaragePreview(previewBox);
    preview.start();
    refreshPreview();
  });
  ctx.onCleanup(() => { if (preview) preview.dispose(); });

  renderTab();

  return screen(t('Garage & Rider'), ctx, [
    div({ class: 'garage-layout' }, [
      div({ class: 'garage-preview-col' }, [previewBox, div({ class: 'preview-caption' }, [t('Drag to rotate'), ' · ', specLine])]),
      div({ class: 'garage-tabs-col' }, [tabBar, tabContent])
    ])
  ]);
}
