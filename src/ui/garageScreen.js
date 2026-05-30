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

const optObj = (obj) => Object.entries(obj).map(([value, v]) => ({ value, label: v.label }));

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
    specLine.append(`CdA ${cda.toFixed(3)} m² · system ${mass.toFixed(1)} kg · Crr ${spec.crr.toFixed(4)} · ${spec.wheelCount} wheel(s)`);
  }

  const tabs = ['players', 'riders', 'bikes', 'decals'];
  const tabBar = div({ class: 'tab-bar' }, tabs.map((t) =>
    btn(t[0].toUpperCase() + t.slice(1), () => { tab = t; renderTab(); }, 'btn small tab-btn')));

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
      h(2, 'Players (the real human)'),
      div({ class: 'hint' }, 'The player pedals: weight & body size drive the physics. Separate from the in-game rider/avatar.'),
      field('Active player', select(s.players.map((x) => ({ value: x.id, label: x.name })), s.activePlayerId, (id) => { setActivePlayer(id); renderTab(); })),
      field('Name', textInput(p.name, bind('name'))),
      field('Weight (kg)', numberInput(p.weightKg, bind('weightKg', Number), { min: 30, max: 200, step: 0.5 })),
      field('Height (cm)', numberInput(p.heightCm, bind('heightCm', Number), { min: 120, max: 230 })),
      field('Age', numberInput(p.age, bind('age', Number), { min: 10, max: 100 })),
      field('Shoulder width (cm)', numberInput(p.shoulderWidthCm, bind('shoulderWidthCm', Number), { min: 30, max: 70 })),
      field('Inseam (cm)', numberInput(p.inseamCm, bind('inseamCm', Number), { min: 50, max: 110 })),
      field('FTP (W)', numberInput(p.ftpW, bind('ftpW', Number), { min: 50, max: 600 })),
      div({ class: 'spec-row' }, [el('span', {}, 'Frontal area'), el('strong', {}, `${computeFrontalArea(p).toFixed(3)} m²`)]),
      div({ class: 'spec-row' }, [el('span', {}, 'FTP W/kg'), el('strong', {}, ftpWkg(p).toFixed(2))]),
      div({ class: 'row' }, [
        btn('+ New player', () => { const np = makePlayer('Player ' + (s.players.length + 1)); upsertPlayer(np); setActivePlayer(np.id); renderTab(); }),
        s.players.length > 1 ? btn('Delete', () => { deletePlayer(p.id); renderTab(); }, 'btn danger') : null
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
      h(2, 'Riders (the avatar)'),
      div({ class: 'hint' }, 'Riders are cosmetic — they never affect speed. Snap a rider to the active player to mirror their proportions.'),
      field('Active rider', select(s.riders.map((x) => ({ value: x.id, label: x.name })), s.activeRiderId, (id) => { setActiveRider(id); renderTab(); })),
      field('Name', textInput(r.name, (v) => { r.name = v; rb(); })),
      div({ class: 'field' }, [el('label', {}, 'Body'), div({ class: 'row' }, [
        el('input', { type: 'checkbox', checked: r.snapToPlayer, onchange: (e) => { r.snapToPlayer = e.target.checked; rb(); renderTab(); } }),
        el('span', {}, `Snap proportions to ${player.name}`)
      ])]),
      r.snapToPlayer ? null : field('Height (cm)', numberInput(r.body.heightCm, (v) => { r.body.heightCm = Number(v); rb(); }, { min: 120, max: 230 })),
      field('Build', select(optObj(BUILDS), r.body.build, (v) => { r.body.build = v; rb(); })),
      field('Map icon colour', colorInput(r.mapIconColor, (v) => { r.mapIconColor = v; rb(); })),
      div({ class: 'row' }, [
        btn('+ New rider', () => { const nr = makeRider('Rider ' + (s.riders.length + 1)); upsertRider(nr); setActiveRider(nr.id); renderTab(); }),
        s.riders.length > 1 ? btn('Delete', () => { deleteRider(r.id); renderTab(); }, 'btn danger') : null
      ])
    ]));

    // face
    wrap.append(div({ class: 'card' }, [
      h(3, 'Face'),
      field('Skin tone', colorInput(r.face.skinTone, faceBind('skinTone'))),
      field('Face shape', select(faceOptionLists.faceShape, r.face.faceShape, faceBind('faceShape'))),
      field('Eye colour', colorInput(r.face.eyeColor, faceBind('eyeColor'))),
      field('Brows', select(faceOptionLists.browType, r.face.browType, faceBind('browType'))),
      field('Brow colour', colorInput(r.face.browColor, faceBind('browColor'))),
      field('Nose', select(faceOptionLists.noseType, r.face.noseType, faceBind('noseType'))),
      field('Mouth', select(faceOptionLists.mouthType, r.face.mouthType, faceBind('mouthType'))),
      field('Facial hair', select(faceOptionLists.facialHair, r.face.facialHair, faceBind('facialHair'))),
      field('Facial hair colour', colorInput(r.face.facialHairColor, faceBind('facialHairColor'))),
      field('Hair', select(faceOptionLists.hairStyle, r.face.hairStyle, faceBind('hairStyle'))),
      field('Hair colour', colorInput(r.face.hairColor, faceBind('hairColor')))
    ]));

    // clothing
    const cloCard = div({ class: 'card' }, [h(3, 'Clothing')]);
    cloCard.append(field('Apply outfit', select(
      [{ value: '', label: '— pick an outfit —' }, ...optObj(OUTFITS)], '',
      (v) => { if (v) { r.clothing = applyOutfit(v); rb(); renderTab(); } })));
    for (const slot of Object.keys(CLOTHING)) {
      const c = r.clothing[slot];
      const row = div({ class: 'clo-row' }, [
        el('label', {}, CLOTHING[slot].label),
        select(clothingItemList(slot), c.item, (v) => { c.item = v; rb(); }),
        colorInput(c.color, (v) => { c.color = v; rb(); })
      ]);
      cloCard.append(row);
      if (slot === 'jersey') {
        cloCard.append(div({ class: 'clo-row' }, [
          el('label', {}, 'Jersey accent / pattern'),
          colorInput(c.accent, (v) => { c.accent = v; rb(); }),
          select(Object.entries(JERSEY_PATTERNS).map(([value, label]) => ({ value, label })), c.pattern, (v) => { c.pattern = v; rb(); })
        ]));
      }
    }
    wrap.append(cloCard);

    // tattoos
    const tatCard = div({ class: 'card' }, [h(3, 'Tattoos'), div({ class: 'hint' }, 'Decals flagged for tattoos. Cosmetic only.')]);
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
    const themeOpts = [{ value: '', label: 'All themes' }, { value: 'real', label: 'Real' }, { value: 'madmax', label: 'Mad Max' }, { value: 'scifi', label: 'Sci-Fi' }];
    const wrap = div({ class: 'bikes-tab' });

    wrap.append(div({ class: 'card' }, [
      h(2, 'Vehicle Garage'),
      div({ class: 'hint' }, 'Build bikes, trikes, quads, unicycles… parts snap together with cheerful Ork logic. Parts have real physics; clothing/decals do not.'),
      field('Active vehicle', select(s.garage.bikes.map((x) => ({ value: x.id, label: x.name })), s.garage.activeBikeId, (id) => { s.garage.activeBikeId = id; save(); renderTab(); })),
      field('Name', textInput(b.name, bb('name'))),
      field('Vehicle type', select(optObj(VEHICLE_TYPES), b.vehicleType, bb('vehicleType'))),
      field('Parts theme filter', select(themeOpts, themeFilter, (v) => { themeFilter = v; renderTab(); })),
      field('Frame', select(partsByTheme(FRAMES, themeFilter), b.frame, bb('frame'))),
      field('Wheels', select(partsByTheme(WHEELS, themeFilter), b.wheels, bb('wheels'))),
      field('Tyres', select(partsByTheme(TIRES, themeFilter), b.tires, bb('tires'))),
      field('Riding position', select(optObj(POSITIONS), b.position, bb('position'))),
      field('Frame colour', colorInput(b.color, bb('color'))),
      field('Accent colour', colorInput(b.accentColor, bb('accentColor'))),
      div({ class: 'row' }, [
        btn('+ New vehicle', () => { const nb = makeBike('Build ' + (s.garage.bikes.length + 1)); upsertBike(nb); s.garage.activeBikeId = nb.id; save(); renderTab(); }),
        s.garage.bikes.length > 1 ? btn('Delete', () => { deleteBike(b.id); renderTab(); }, 'btn danger') : null
      ])
    ]));

    // sprays
    const sprayCard = div({ class: 'card' }, [h(3, 'Vehicle Sprays'), div({ class: 'hint' }, 'Decals flagged for vehicles. Cosmetic only.')]);
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
    const list = div({ class: 'card' }, [h(2, 'Decal Library'), div({ class: 'hint' }, 'Glyph badges usable as vehicle sprays and/or tattoos. Defaults are wholesome & permanent. No speed impact.')]);
    list.append(div({ class: 'decal-list' }, s.decals.map((d) =>
      div({ class: 'decal-item' }, [
        el('span', { class: 'decal-glyph', style: { color: d.color } }, d.glyph),
        div({}, [div({}, d.label), div({ class: 'dim small' }, d.kinds.join(' + ') + (d.removable ? '' : ' · default'))]),
        d.removable ? btn('✕', () => { deleteDecal(d.id); renderTab(); }, 'btn icon danger') : el('span', { class: 'dim small' }, '🔒')
      ]))));
    wrap.append(list);

    // create custom
    const draft = { label: 'My Decal', glyph: '✦', color: '#ffd24a', vehicle: true, tattoo: true };
    wrap.append(div({ class: 'card' }, [
      h(3, 'Create Decal'),
      field('Label', textInput(draft.label, (v) => { draft.label = v; })),
      field('Glyph / emoji', textInput(draft.glyph, (v) => { draft.glyph = v; })),
      field('Colour', colorInput(draft.color, (v) => { draft.color = v; })),
      div({ class: 'row' }, [
        el('label', {}, [el('input', { type: 'checkbox', checked: true, onchange: (e) => { draft.vehicle = e.target.checked; } }), ' Vehicle spray']),
        el('label', {}, [el('input', { type: 'checkbox', checked: true, onchange: (e) => { draft.tattoo = e.target.checked; } }), ' Tattoo'])
      ]),
      btn('+ Add decal', () => {
        const kinds = [draft.vehicle && 'vehicle', draft.tattoo && 'tattoo'].filter(Boolean);
        if (!kinds.length) { alert('Pick at least one kind.'); return; }
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

  return screen('Garage & Rider', ctx, [
    div({ class: 'garage-layout' }, [
      div({ class: 'garage-preview-col' }, [previewBox, div({ class: 'preview-caption' }, ['Drag to rotate · ', specLine])]),
      div({ class: 'garage-tabs-col' }, [tabBar, tabContent])
    ])
  ]);
}
