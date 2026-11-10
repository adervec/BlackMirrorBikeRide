// Keeps the cowork folder current without anyone pressing Sync.
//
// The shared panel (https://adervec.github.io/cowork.js) stores the folder's
// directory handle in IndexedDB (db "cowork-ui", store "dirs", key = app id)
// when the user connects it from the History screen. This module reuses that
// handle to rewrite the folder after every ride and on launch — but only while
// the browser still reports the permission as granted. It never prompts: the
// panel does that, when the user is actually looking at it.

import { getState } from '../state.js';
import { COWORK_APP, coworkManifest, coworkFiles } from './brief.js';

function idb(mode, fn) {
  return new Promise((res, rej) => {
    const open = indexedDB.open('cowork-ui', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('dirs');
    open.onerror = () => rej(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('dirs', mode), rq = fn(tx.objectStore('dirs'));
      tx.oncomplete = () => { db.close(); res(rq && rq.result); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
  });
}

async function writeFile(root, path, text) {
  const parts = path.split('/').filter(Boolean);
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i], { create: true });
  const h = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const w = await h.createWritable(); // atomic on close
  await w.write(text);
  await w.close();
}

let busy = false;
export let lastPush = { at: 0, ok: null, reason: '' };

// Resolves true when the folder was rewritten. Quiet on every failure path.
export async function pushCoworkFolder(state = getState()) {
  if (typeof indexedDB === 'undefined' || typeof window === 'undefined' || busy) return false;
  busy = true;
  try {
    const h = await idb('readonly', (s) => s.get(COWORK_APP)).catch(() => null);
    if (!h) { lastPush = { at: Date.now(), ok: false, reason: 'no folder connected' }; return false; }
    const perm = await h.queryPermission({ mode: 'readwrite' }).catch(() => 'denied');
    if (perm !== 'granted') { lastPush = { at: Date.now(), ok: false, reason: 'folder needs re-connecting' }; return false; }
    await writeFile(h, 'cowork.json', JSON.stringify(coworkManifest(), null, 2));
    for (const [path, v] of Object.entries(coworkFiles(state))) {
      await writeFile(h, path, typeof v === 'string' ? v : JSON.stringify(v, null, 2));
    }
    lastPush = { at: Date.now(), ok: true, reason: '' };
    return true;
  } catch (err) {
    lastPush = { at: Date.now(), ok: false, reason: String(err?.message || err) };
    return false;
  } finally { busy = false; }
}

// The shared panel script, loaded once.
export function loadCowork() {
  if (window.cowork) return Promise.resolve(window.cowork);
  const head = document.head || document.documentElement;
  if (!head || typeof head.appendChild !== 'function') return Promise.resolve(null);
  return new Promise((res) => {
    try {
      const s = document.createElement('script'); s.src = 'https://adervec.github.io/cowork.js'; s.async = true;
      s.onload = () => res(window.cowork || null); s.onerror = () => res(null);
      head.appendChild(s);
    } catch { res(null); }
  });
}
