// "Erase all data" must remove this app's keys and nothing else: every app on
// adervec.github.io shares one localStorage. Run: node scripts/erasetest.mjs
import { readFileSync } from 'node:fs';
import { eraseLocalKeys } from '../src/state.js';

let fails = 0;
const assert = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

const data = new Map(Object.entries({
  'bmbr.state.v1': '{}', 'bmbr.ride.inprogress': '{}', 'bmbr-coach-reply': 'hi',
  'maker-font': 'atkinson', 'gymtracker.state': '{}', 'bmbrother': 'x', 'portal-activity': '[]',
  'portal-installed': JSON.stringify({ BlackMirrorBikeRide: 1, GymTracker: 2 })
}));
const ls = {
  get length() { return data.size; }, key: (i) => [...data.keys()][i],
  getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k)
};

const gone = eraseLocalKeys(ls);
assert(gone.length === 3 && ![...data.keys()].some((k) => /^bmbr[.-]/.test(k)), `all three bmbr keys removed (got ${gone.join(', ')})`);
assert(data.get('maker-font') === 'atkinson' && data.has('gymtracker.state') && data.has('bmbrother') && data.has('portal-activity'), 'sibling apps and shared keys survive');
assert(data.get('portal-installed') === JSON.stringify({ GymTracker: 2 }), 'only this app leaves the portal install registry');

const ui = readFileSync(new URL('../src/ui/settingsScreen.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
assert(/Erase all/.test(ui) && /confirm\([^)]*Google Drive is not touched/.test(ui) && /signOut\(\);\s*eraseLocalKeys\(\)/.test(ui), 'settings control confirms, mentions Drive, disconnects sync');
assert(!/localStorage\.clear\(\)/.test(ui + readFileSync(new URL('../src/state.js', import.meta.url), 'utf8')), 'never localStorage.clear()');
assert(/startsWith\('bmbr-'\)/.test(sw), 'service worker only prunes its own caches');

console.log(`\n${fails === 0 ? '✅ ALL ERASE CHECKS PASSED' : '❌ ' + fails + ' ERASE CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
