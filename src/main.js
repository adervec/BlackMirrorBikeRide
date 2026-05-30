import './style.css';
import { Router } from './ui/router.js';
import { applyTheme } from './ui/themes.js';
import { getState } from './state.js';
import { renderMenu } from './ui/menuScreen.js';
import { renderRoutes } from './ui/routesScreen.js';
import { renderVirtualBuilder } from './ui/builderScreen.js';
import { renderRealBuilder } from './ui/realBuilderScreen.js';
import { renderGarage } from './ui/garageScreen.js';
import { renderSettings } from './ui/settingsScreen.js';
import { renderHistory } from './ui/historyScreen.js';
import { renderSkyboxes } from './ui/skyboxScreen.js';
import { renderRide } from './ui/rideScreen.js';

applyTheme(getState().settings.theme);

const app = document.getElementById('app');
const router = new Router(app);

router
  .register('menu', renderMenu)
  .register('routes', renderRoutes)
  .register('builder', renderVirtualBuilder)
  .register('real', renderRealBuilder)
  .register('garage', renderGarage)
  .register('settings', renderSettings)
  .register('history', renderHistory)
  .register('skyboxes', renderSkyboxes)
  .register('ride', renderRide);

router.go('menu');

// Expose for quick debugging in the console.
window.__bmbr = { router };
