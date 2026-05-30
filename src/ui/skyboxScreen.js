import { div, h, el, field, select, textInput, numberInput, colorInput, btn, screen } from './dom.js';
import { getState, addCustomSkybox, deleteCustomSkybox, save } from '../state.js';
import { SKYBOXES, makeCustomSkybox, SKYBOX_SPECIALS, colorCss } from '../routes/skyboxes.js';
import { downloadJSON } from '../routes/io.js';

export function renderSkyboxes(ctx) {
  const s = getState();

  const fileInput = el('input', {
    type: 'file', accept: '.json,application/json', style: { display: 'none' },
    onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const list = Array.isArray(data) ? data : data.skyboxes || (data.skybox ? [data.skybox] : [data]);
        list.filter((x) => x && x.top && x.bottom).forEach((x) => addCustomSkybox({ ...makeCustomSkybox(x.label || 'Imported'), ...x, id: makeCustomSkybox().id, custom: true }));
        ctx.router.go('skyboxes');
      } catch (err) { alert('Import failed: ' + err.message); }
    }
  });

  function swatch(sky) {
    return div({ class: 'sky-swatch', style: { background: `linear-gradient(to top, ${colorCss(sky.bottom)}, ${colorCss(sky.top)})` } },
      [div({ class: 'sky-sun', style: { background: colorCss(sky.sun) } })]);
  }

  // built-ins (read only)
  const builtins = div({ class: 'card' }, [
    h(2, 'Built-in Skyboxes'),
    div({ class: 'hint' }, 'These ship with the game and can be cloned into custom skyboxes.'),
    div({ class: 'sky-grid' }, Object.entries(SKYBOXES).map(([id, sky]) =>
      div({ class: 'sky-card' }, [
        swatch(sky), div({ class: 'sky-name' }, sky.label),
        btn('Clone', () => { const c = { ...makeCustomSkybox(sky.label + ' copy'), top: colorCss(sky.top), bottom: colorCss(sky.bottom), sun: colorCss(sky.sun), ambient: colorCss(sky.ambient), sunIntensity: sky.sunIntensity, ambientIntensity: sky.ambientIntensity, sunPos: [...(sky.sunPos || [0.5, 0.8, 0.2])], special: sky.special || '' }; addCustomSkybox(c); ctx.router.go('skyboxes'); }, 'btn small ghost')
      ])
    ))
  ]);

  // custom (editable)
  const customCard = div({ class: 'card' }, [
    h(2, 'Custom Skyboxes'),
    s.customSkyboxes.length ? div({ class: 'sky-list' }, s.customSkyboxes.map((sky) => skyEditor(sky))) : div({ class: 'empty' }, 'No custom skyboxes yet.'),
    div({ class: 'row' }, [
      btn('+ New skybox', () => { addCustomSkybox(makeCustomSkybox('My Sky ' + (s.customSkyboxes.length + 1))); ctx.router.go('skyboxes'); }),
      btn('⤓ Import', () => fileInput.click(), 'btn ghost'),
      s.customSkyboxes.length ? btn('⤒ Export all', () => downloadJSON('skyboxes.bmbr.json', { tag: 'bmbr-skybox', skyboxes: s.customSkyboxes }), 'btn ghost') : null,
      fileInput
    ])
  ]);

  function skyEditor(sky) {
    const upd = (k, parse = (v) => v) => (v) => { sky[k] = parse(v); save(); };
    const updPos = (i) => (v) => { sky.sunPos[i] = Number(v); save(); };
    const sw = swatch(sky);
    const refresh = () => { sw.style.background = `linear-gradient(to top, ${colorCss(sky.bottom)}, ${colorCss(sky.top)})`; sw.firstChild.style.background = colorCss(sky.sun); };
    return div({ class: 'sky-editor' }, [
      sw,
      div({ class: 'sky-fields' }, [
        field('Name', textInput(sky.label, upd('label'))),
        div({ class: 'sky-colors' }, [
          colLabeled('Top', colorInput(sky.top, (v) => { sky.top = v; save(); refresh(); })),
          colLabeled('Bottom', colorInput(sky.bottom, (v) => { sky.bottom = v; save(); refresh(); })),
          colLabeled('Sun', colorInput(sky.sun, (v) => { sky.sun = v; save(); refresh(); })),
          colLabeled('Ambient', colorInput(sky.ambient, upd('ambient')))
        ]),
        field('Sun intensity', numberInput(sky.sunIntensity, upd('sunIntensity', Number), { min: 0, max: 3, step: 0.05 })),
        field('Ambient intensity', numberInput(sky.ambientIntensity, upd('ambientIntensity', Number), { min: 0, max: 2, step: 0.05 })),
        div({ class: 'sky-colors' }, [
          colLabeled('Sun X', numberInput(sky.sunPos[0], updPos(0), { min: -1, max: 1, step: 0.1 })),
          colLabeled('Sun Y', numberInput(sky.sunPos[1], updPos(1), { min: -1, max: 1, step: 0.1 })),
          colLabeled('Sun Z', numberInput(sky.sunPos[2], updPos(2), { min: -1, max: 1, step: 0.1 }))
        ]),
        field('Special effect', select(SKYBOX_SPECIALS, sky.special || '', upd('special'))),
        div({ class: 'row' }, [
          btn('Export', () => downloadJSON(`${(sky.label || 'sky').replace(/\W+/g, '_')}.bmbr.json`, { tag: 'bmbr-skybox', skybox: sky }), 'btn small ghost'),
          btn('Delete', () => { deleteCustomSkybox(sky.id); ctx.router.go('skyboxes'); }, 'btn small danger')
        ])
      ])
    ]);
  }

  return screen('Skyboxes', ctx, [customCard, builtins], { backTo: 'settings' });
}

function colLabeled(label, control) { return div({ class: 'col-labeled' }, [el('label', {}, label), control]); }
