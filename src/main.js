import './style.css';
import { Router } from './ui/router.js';
import { applyTheme } from './ui/themes.js';
import { toast } from './ui/dom.js';
import { getState, mergeBundledRoutes, addActivity } from './state.js';
import { loadBundledRoutes } from './routes/bundled.js';
import { autoSync } from './cloud/sync.js';
import { pushCoworkFolder } from './cloud/coworkFolder.js';
import { createActivity } from './game/activity.js';
import { formatTime } from './game/units.js';
import { renderMenu } from './ui/menuScreen.js';
import { renderRoutes } from './ui/routesScreen.js';
import { renderVirtualBuilder } from './ui/builderScreen.js';
import { renderGpxImport } from './ui/gpxScreen.js';
import { renderGarage } from './ui/garageScreen.js';
import { renderSettings } from './ui/settingsScreen.js';
import { renderHistory } from './ui/historyScreen.js';
import { renderSkyboxes } from './ui/skyboxScreen.js';
import { renderWorkouts } from './ui/workoutsScreen.js';
import { renderRide, AUTOSAVE_KEY } from './ui/rideScreen.js';

applyTheme(getState().settings.theme);

const app = document.getElementById('app');
const router = new Router(app);

router
  .register('menu', renderMenu)
  .register('routes', renderRoutes)
  .register('builder', renderVirtualBuilder)
  .register('real', renderGpxImport)
  .register('garage', renderGarage)
  .register('settings', renderSettings)
  .register('history', renderHistory)
  .register('skyboxes', renderSkyboxes)
  .register('workouts', renderWorkouts)
  .register('ride', renderRide);

router.go('menu');

// A ride snapshot left behind means the last session never got to finish
// (crash, killed tab, dead battery). Land it in History rather than lose it.
try {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (raw) {
    localStorage.removeItem(AUTOSAVE_KEY);
    const snap = JSON.parse(raw);
    if (snap?.samples?.length > 5) {
      const act = createActivity({ route: { id: snap.routeId, name: snap.routeName }, reverse: snap.reverse, samples: snap.samples, summary: snap.summary, total: snap.total });
      act.date = new Date(snap.savedAt || Date.now()).toISOString();
      addActivity(act);
      toast(`Recovered an unfinished ride on ${snap.routeName} (${formatTime(snap.summary?.time || 0)}) into History.`);
      router.go('menu');
    }
  }
} catch { /* nothing usable */ }

// Merge routes shipped with the app (public/routes/). Refresh passive screens
// only — never re-render mid-ride.
loadBundledRoutes().then((routes) => {
  if (mergeBundledRoutes(routes) && ['menu', 'routes'].includes(router.current)) router.go(router.current);
});

// Pull anything ridden on another device (silent — never prompts; opt-in via Settings).
autoSync().then((r) => {
  if (r?.pulled && ['menu', 'routes', 'history'].includes(router.current)) router.go(router.current);
  // The cowork folder (if one was ever connected) should reflect today's state
  // every time the app opens, whether or not History gets visited.
  pushCoworkFolder();
});

// Service worker: makes the app installable and usable offline. Production only,
// so dev never serves a stale bundle from cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

// Tell the maker's app portal (adervec.github.io — same origin, so it shares this
// localStorage) that the app is installed here. Installed launches only; a plain
// browser tab never registers.
try {
  const modes = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'];
  if (navigator.standalone || modes.some((m) => window.matchMedia(`(display-mode: ${m})`).matches)) {
    const key = 'portal-installed';
    const registry = JSON.parse(localStorage.getItem(key) || '{}');
    registry['BlackMirrorBikeRide'] = Date.now();
    localStorage.setItem(key, JSON.stringify(registry));
  }
} catch {}

// Expose for quick debugging in the console.
window.__bmbr = { router };
