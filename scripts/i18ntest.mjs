// Every language has every English key, with the same {placeholders}. Run: node scripts/i18ntest.mjs
// (The full pipeline is ../CoworkSyncHub/i18n.mjs; this is the part CI can run on its own.)
import { readFileSync, readdirSync } from 'node:fs';
import { t } from '../src/i18n.js';

let fails = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const dir = new URL('../public/locales/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const en = read('en.json');
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
const langs = readdirSync(dir).filter((f) => /^[a-z]{2}\.json$/.test(f) && f !== 'en.json');

assert(langs.length === 16, `16 translated languages (got ${langs.length})`);
for (const f of langs) {
  const d = read(f), bad = [];
  for (const [k, v] of Object.entries(en)) {
    const tr = d[k];
    if (typeof v === 'string') { if (typeof tr !== 'string' || !tr || ph(tr) !== ph(k)) bad.push(k); }
    else if (!tr || typeof tr !== 'object' || !tr.other || Object.values(tr).some((x) => ph(x) !== ph(v.other))) bad.push(k);
  }
  assert(!bad.length, `${f}: all ${Object.keys(en).length} keys, placeholders intact${bad.length ? ' — bad: ' + bad.slice(0, 3).join(' | ') : ''}`);
}
// keys held in variables so the extractor doesn't take these test strings for app text
const hi = 'Hello {name}', one = '{n} ride', many = '{n} rides';
assert(t(hi, { name: 'Ana' }) === 'Hello Ana' && t.n(one, many, 2) === '2 rides' && t.n(one, many, 1) === '1 ride', 'without font.js, t() returns the English with placeholders filled');

console.log(`\n${fails === 0 ? '✅ ALL I18N CHECKS PASSED' : '❌ ' + fails + ' I18N CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
