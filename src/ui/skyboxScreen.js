import { div, h, el, field, select, textInput, numberInput, colorInput, checkbox, btn, screen } from './dom.js';
import { getState, addCustomSkybox, deleteCustomSkybox, save } from '../state.js';
import { SKYBOXES, makeCustomSkybox, SKYBOX_SPECIALS, WEATHERS, colorCss } from '../routes/skyboxes.js';
import { downloadJSON } from '../routes/io.js';
import { t } from '../i18n.js';

// Option labels live in routes/skyboxes.js (keys listed there).
const tr = (opts) => opts.map((o) => ({ ...o, label: t(o.label) }));

export function renderSkyboxes(ctx) {
  const s = getState();

  const fileInput = el('input', {
    type: 'file', accept: '.json,application/json', style: { display: 'none' },
    onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const list = Array.isArray(data) ? data : data.skyboxes || (data.skybox ? [data.skybox] : [data]);
        list.filter((x) => x && x.top && x.bottom).forEach((x) => addCustomSkybox({ ...makeCustomSkybox(x.label || t('Imported')), ...x, id: makeCustomSkybox().id, custom: true }));
        ctx.router.go('skyboxes');
      } catch (err) { alert(t('Import failed: {error}', { error: err.message })); }
    }
  });

  function swatch(sky) {
    return div({ class: 'sky-swatch', style: { background: `linear-gradient(to top, ${colorCss(sky.bottom)}, ${colorCss(sky.top)})` } },
      [div({ class: 'sky-sun', style: { background: colorCss(sky.sun) } })]);
  }
  const tag = (sky) => [sky.weather && t(WEATHERS.find((w) => w.value === sky.weather)?.label || ''), sky.lamp && t('lamp')].filter(Boolean).join(' · ');

  // built-ins (read only)
  const builtins = div({ class: 'card' }, [
    h(2, t('Built-in Skyboxes')),
    div({ class: 'hint' }, t('These ship with the game and can be cloned into custom skyboxes.')),
    div({ class: 'sky-grid' }, Object.entries(SKYBOXES).map(([id, sky]) =>
      div({ class: 'sky-card' }, [
        swatch(sky), div({ class: 'sky-name' }, tag(sky) ? t('{name} ({tags})', { name: t(sky.label), tags: tag(sky) }) : t(sky.label)),
        btn(t('Clone'), () => {
          const c = { ...makeCustomSkybox(t('{name} copy', { name: t(sky.label) })), top: colorCss(sky.top), bottom: colorCss(sky.bottom), sun: colorCss(sky.sun), ambient: colorCss(sky.ambient),
            sunIntensity: sky.sunIntensity, ambientIntensity: sky.ambientIntensity, sunPos: [...(sky.sunPos || [0.5, 0.8, 0.2])],
            special: sky.special || '', weather: sky.weather || '', lamp: !!sky.lamp };
          addCustomSkybox(c); ctx.router.go('skyboxes');
        }, 'btn small ghost')
      ])
    ))
  ]);

  // custom (editable)
  const customCard = div({ class: 'card' }, [
    h(2, t('Custom Skyboxes')),
    s.customSkyboxes.length ? div({ class: 'sky-list' }, s.customSkyboxes.map((sky) => skyEditor(sky))) : div({ class: 'empty' }, t('No custom skyboxes yet.')),
    div({ class: 'row' }, [
      btn(t('+ New skybox'), () => { addCustomSkybox(makeCustomSkybox(t('My Sky {n}', { n: s.customSkyboxes.length + 1 }))); ctx.router.go('skyboxes'); }),
      btn(t('⤓ Import'), () => fileInput.click(), 'btn ghost'),
      s.customSkyboxes.length ? btn(t('⤒ Export all'), () => downloadJSON('skyboxes.bmbr.json', { tag: 'bmbr-skybox', skyboxes: s.customSkyboxes }), 'btn ghost') : null,
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
        field(t('Name'), textInput(sky.label, upd('label'))),
        div({ class: 'sky-colors' }, [
          colLabeled(t('Top'), colorInput(sky.top, (v) => { sky.top = v; save(); refresh(); })),
          colLabeled(t('Bottom'), colorInput(sky.bottom, (v) => { sky.bottom = v; save(); refresh(); })),
          colLabeled(t('Sun'), colorInput(sky.sun, (v) => { sky.sun = v; save(); refresh(); })),
          colLabeled(t('Ambient'), colorInput(sky.ambient, upd('ambient')))
        ]),
        field(t('Sun intensity'), numberInput(sky.sunIntensity, upd('sunIntensity', Number), { min: 0, max: 3, step: 0.05 })),
        field(t('Ambient intensity'), numberInput(sky.ambientIntensity, upd('ambientIntensity', Number), { min: 0, max: 2, step: 0.05 })),
        div({ class: 'sky-colors' }, [
          colLabeled(t('Sun X'), numberInput(sky.sunPos[0], updPos(0), { min: -1, max: 1, step: 0.1 })),
          colLabeled(t('Sun Y'), numberInput(sky.sunPos[1], updPos(1), { min: -1, max: 1, step: 0.1 })),
          colLabeled(t('Sun Z'), numberInput(sky.sunPos[2], updPos(2), { min: -1, max: 1, step: 0.1 }))
        ]),
        field(t('Special effect'), select(tr(SKYBOX_SPECIALS), sky.special || '', upd('special'))),
        field(t('Weather'), select(tr(WEATHERS), sky.weather || '', upd('weather'))),
        checkbox(t('Night: headlamp on the bike (drop the sun intensity for the full effect)'), !!sky.lamp, upd('lamp')),
        div({ class: 'row' }, [
          btn(t('Export'), () => downloadJSON(`${(sky.label || 'sky').replace(/\W+/g, '_')}.bmbr.json`, { tag: 'bmbr-skybox', skybox: sky }), 'btn small ghost'),
          btn(t('Delete'), () => { deleteCustomSkybox(sky.id); ctx.router.go('skyboxes'); }, 'btn small danger')
        ])
      ])
    ]);
  }

  return screen(t('Skyboxes'), ctx, [customCard, builtins], { backTo: 'settings' });
}

function colLabeled(label, control) { return div({ class: 'col-labeled' }, [el('label', {}, label), control]); }
