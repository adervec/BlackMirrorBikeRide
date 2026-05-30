// Tiny DOM helper so screens stay declarative without a framework.

export function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled') { if (v) e.setAttribute(k, ''); e[k] = !!v; }
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export const div = (p, c) => el('div', p, c);
export const span = (p, c) => el('span', p, c);
export const h = (level, text, p = {}) => el('h' + level, p, text);
export const btn = (text, onClick, cls = 'btn') => el('button', { class: cls, onclick: onClick }, text);

export function field(labelText, control) {
  return div({ class: 'field' }, [el('label', {}, labelText), control]);
}

export function select(options, value, onChange) {
  const s = el('select', { onchange: (e) => onChange(e.target.value) },
    options.map((o) => el('option', { value: o.value, selected: o.value === value }, o.label)));
  s.value = value;
  return s;
}

export function numberInput(value, onChange, { step = 'any', min, max } = {}) {
  return el('input', {
    type: 'number', value, step, min, max,
    oninput: (e) => onChange(parseFloat(e.target.value))
  });
}

export function textInput(value, onChange, placeholder = '') {
  return el('input', { type: 'text', value, placeholder, oninput: (e) => onChange(e.target.value) });
}

export function colorInput(value, onChange) {
  return el('input', { type: 'color', value, oninput: (e) => onChange(e.target.value) });
}

// Standard screen scaffold with a title bar + back button.
export function screen(title, ctx, bodyChildren, { backTo = 'menu' } = {}) {
  const root = div({ class: 'screen' });
  const bar = div({ class: 'topbar' }, [
    backTo ? btn('‹ Back', () => ctx.router.go(backTo), 'btn ghost') : null,
    h(1, title, { class: 'screen-title' })
  ]);
  root.append(bar, div({ class: 'screen-body' }, bodyChildren));
  return root;
}
