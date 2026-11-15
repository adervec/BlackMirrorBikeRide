// Translation (house standard 20). English is written straight into the code and IS the key;
// font.js (window.appFont) loads locales/<lang>.json for the reader's language. Without font.js
// (offline first run, node tests) the English comes back with {placeholders} filled in.
const fill = (s, p) => (p ? String(s).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(p, k) ? String(p[k]) : m)) : String(s));
const af = () => globalThis.appFont;

export function t(key, params) { return af()?.t ? af().t(key, params) : fill(key, params); }
t.n = (one, other, n, params) => (af()?.t?.n ? af().t.n(one, other, n, params) : fill(n === 1 ? one : other, { n, ...params }));

// Resolves once the reader's language is loaded (immediately for English or without font.js).
export const i18nReady = () => Promise.resolve(af()?.ready).catch(() => {});

// Numbers and dates the reader sees go through the shared locale (appFont.fmt); plain fallbacks without font.js.
export const num = (n, digits = 0) => (af()?.fmt ? af().fmt.number(n, { min: digits, max: digits }) : Number(n).toFixed(digits));
export const signed = (n, digits = 1) => (n >= 0 ? '+' : '') + num(n, digits);
export const fmtDate = (d) => (af()?.fmt ? af().fmt.date(d) : new Date(d).toLocaleDateString());
export const fmtDateTime = (d) => (af()?.fmt ? af().fmt.dateTime(d) : new Date(d).toLocaleString());
