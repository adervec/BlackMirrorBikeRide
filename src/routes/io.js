// Route import / export / clone helpers. Routes live in localStorage; these let
// users move them in and out as .json files and duplicate them.

let _id = 0;
const uid = (p) => `${p}-${Date.now().toString(36)}-${(_id++).toString(36)}`;

const FILE_TAG = 'bmbr-route';

export function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeName = (s) => (s || 'route').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();

export function exportRoute(route) {
  downloadJSON(`${safeName(route.name)}.bmbr.json`, { tag: FILE_TAG, version: 1, route });
}

export function exportAllRoutes(routes) {
  downloadJSON('all-routes.bmbr.json', { tag: FILE_TAG, version: 1, routes });
}

// Accepts {route}, {routes:[]}, a bare route, or a bare array. Returns routes[]
// with FRESH ids so imports never clobber existing routes.
export function parseRoutesFile(text) {
  const data = JSON.parse(text);
  let routes = [];
  if (Array.isArray(data)) routes = data;
  else if (data.routes) routes = data.routes;
  else if (data.route) routes = [data.route];
  else if (data.segments) routes = [data];
  return routes
    .filter((r) => r && Array.isArray(r.segments))
    .map((r) => ({ ...r, id: uid('import'), name: r.name ? `${r.name} (imported)` : 'Imported Route' }));
}

export function cloneRoute(route) {
  const copy = structuredClone(route);
  copy.id = uid('clone');
  copy.name = `${route.name} (copy)`;
  delete copy.bundled; // a clone is a local route
  return copy;
}
