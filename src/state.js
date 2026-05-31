// Central persistent application state. Everything that should survive a reload
// (players, riders, garage, routes, activities, decals, skyboxes, settings)
// lives here and is mirrored to localStorage. Transient ride state does not.

import { DEFAULT_UNIT_PREFS } from './game/units.js';
import { DEFAULT_HUD_LAYOUT } from './game/hudConfig.js';
import { defaultPlayer } from './profile/player.js';
import { defaultBike } from './profile/garage.js';
import { defaultRider } from './profile/customize.js';
import { defaultDecalLibrary } from './profile/decals.js';
import { sampleRoutes } from './routes/sampleRoutes.js';
import { pbForRoute } from './game/activity.js';

const MAX_ACTIVITIES = 200;
const STORAGE_KEY = 'bmbr.state.v1';

function freshState() {
  return {
    players: [defaultPlayer()],
    activePlayerId: 'player-1',
    riders: [defaultRider()],
    activeRiderId: 'rider-1',
    garage: { bikes: [defaultBike()], activeBikeId: 'default-road' },
    routes: sampleRoutes(),
    activities: [],
    decals: defaultDecalLibrary(),
    customSkyboxes: [],
    settings: {
      units: structuredClone(DEFAULT_UNIT_PREFS),
      hud: structuredClone(DEFAULT_HUD_LAYOUT),
      sessionEndMode: 'complete',
      googleMapsApiKey: '',
      ghost: { enabled: true, source: 'pb' },
      previewSpeedMs: 40,
      replaySpeedMul: 4,
      theme: 'midnight',
      graphicsQuality: 'high'
    }
  };
}

let state = load();

// Convert an old single `avatar` blob into a rider.
function riderFromAvatar(av) {
  const r = defaultRider();
  if (av) {
    r.face.skinTone = av.skinTone || r.face.skinTone;
    r.clothing.jersey.color = av.jerseyColor || r.clothing.jersey.color;
    r.clothing.jersey.accent = av.jerseyAccent || r.clothing.jersey.accent;
    r.clothing.jersey.pattern = av.jerseyPattern || r.clothing.jersey.pattern;
    r.clothing.shorts.color = av.shortsColor || r.clothing.shorts.color;
    r.clothing.helmet.color = av.helmetColor || r.clothing.helmet.color;
    r.body.build = av.build || r.body.build;
    r.mapIconColor = av.mapIconColor || r.mapIconColor;
  }
  return r;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    const base = freshState();

    // Migrate v1 (single profile/avatar) -> players/riders.
    const players = parsed.players || [{ ...defaultPlayer(), ...(parsed.profile || {}), id: 'player-1' }];
    const riders = parsed.riders || [riderFromAvatar(parsed.avatar)];

    return {
      ...base,
      ...parsed,
      players,
      activePlayerId: parsed.activePlayerId || players[0].id,
      riders,
      activeRiderId: parsed.activeRiderId || riders[0].id,
      garage: { ...base.garage, ...parsed.garage },
      routes: parsed.routes || base.routes,
      activities: parsed.activities || [],
      decals: parsed.decals && parsed.decals.length ? parsed.decals : base.decals,
      customSkyboxes: parsed.customSkyboxes || [],
      settings: {
        ...base.settings,
        ...parsed.settings,
        units: { ...base.settings.units, ...(parsed.settings?.units || {}) },
        hud: parsed.settings?.hud || base.settings.hud,
        ghost: { ...base.settings.ghost, ...(parsed.settings?.ghost || {}) }
      }
    };
  } catch (err) {
    console.warn('Failed to load saved state, starting fresh:', err);
    return freshState();
  }
}

export function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (err) { console.warn('Failed to persist state:', err); }
}

export function getState() { return state; }
export function resetState() { state = freshState(); save(); return state; }

export const STORAGE_LOCATION = `localStorage["${STORAGE_KEY}"] (this browser profile)`;

// ---- players ----
export function activePlayer() {
  return state.players.find((p) => p.id === state.activePlayerId) || state.players[0];
}
export function setActivePlayer(id) { state.activePlayerId = id; save(); }
export function upsertPlayer(p) {
  const i = state.players.findIndex((x) => x.id === p.id);
  if (i >= 0) state.players[i] = p; else state.players.push(p);
  save();
}
export function deletePlayer(id) {
  if (state.players.length <= 1) return;
  state.players = state.players.filter((p) => p.id !== id);
  if (state.activePlayerId === id) state.activePlayerId = state.players[0].id;
  save();
}

// ---- riders ----
export function activeRider() {
  return state.riders.find((r) => r.id === state.activeRiderId) || state.riders[0];
}
export function setActiveRider(id) { state.activeRiderId = id; save(); }
export function upsertRider(r) {
  const i = state.riders.findIndex((x) => x.id === r.id);
  if (i >= 0) state.riders[i] = r; else state.riders.push(r);
  save();
}
export function deleteRider(id) {
  if (state.riders.length <= 1) return;
  state.riders = state.riders.filter((r) => r.id !== id);
  if (state.activeRiderId === id) state.activeRiderId = state.riders[0].id;
  save();
}

// ---- garage ----
export function activeBike() {
  return state.garage.bikes.find((b) => b.id === state.garage.activeBikeId) || state.garage.bikes[0];
}
export function upsertBike(bike) {
  const i = state.garage.bikes.findIndex((b) => b.id === bike.id);
  if (i >= 0) state.garage.bikes[i] = bike; else state.garage.bikes.push(bike);
  save();
}
export function deleteBike(id) {
  if (state.garage.bikes.length <= 1) return;
  state.garage.bikes = state.garage.bikes.filter((b) => b.id !== id);
  if (state.garage.activeBikeId === id) state.garage.activeBikeId = state.garage.bikes[0].id;
  save();
}

// ---- routes ----
export function getRoute(id) { return state.routes.find((r) => r.id === id); }
export function upsertRoute(route) {
  const i = state.routes.findIndex((r) => r.id === route.id);
  if (i >= 0) state.routes[i] = route; else state.routes.push(route);
  save();
}
export function deleteRoute(id) {
  state.routes = state.routes.filter((r) => r.id !== id);
  save();
}

// ---- activities / history / PBs ----
export function addActivity(activity) {
  state.activities.unshift(activity);
  if (state.activities.length > MAX_ACTIVITIES) state.activities.length = MAX_ACTIVITIES;
  save();
  return activity;
}
export function deleteActivity(id) { state.activities = state.activities.filter((a) => a.id !== id); save(); }
export function getActivity(id) { return state.activities.find((a) => a.id === id); }
export function getActivitiesForRoute(routeId, reverse) {
  return state.activities.filter((a) => a.routeId === routeId && (reverse === undefined || a.reverse === !!reverse));
}
export function activityCountForRoute(routeId) { return state.activities.filter((a) => a.routeId === routeId).length; }
export function getPB(routeId, reverse) { return pbForRoute(state.activities, routeId, reverse); }

// ---- decals ----
export function addDecal(decal) { state.decals.push(decal); save(); }
export function deleteDecal(id) {
  const d = state.decals.find((x) => x.id === id);
  if (!d || d.removable === false) return;
  state.decals = state.decals.filter((x) => x.id !== id);
  save();
}

// ---- custom skyboxes ----
export function addCustomSkybox(sky) { state.customSkyboxes.push(sky); save(); }
export function deleteCustomSkybox(id) { state.customSkyboxes = state.customSkyboxes.filter((s) => s.id !== id); save(); }
