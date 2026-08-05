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
import { DEFAULT_QUALITY } from './world/quality.js';
import { mergeSyncable } from './cloud/merge.js';

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
      ghost: { enabled: true, source: 'pb' },
      previewSpeedMs: 40,
      replaySpeedMul: 4,
      theme: 'midnight',
      graphicsQuality: DEFAULT_QUALITY,
      dismissedRouteIds: [],  // bundled routes the user deleted; never re-merged
      sync: { driveClientId: '', auto: false, lastAt: 0 }
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
        ghost: { ...base.settings.ghost, ...(parsed.settings?.ghost || {}) },
        sync: { ...base.settings.sync, ...(parsed.settings?.sync || {}) }
      }
    };
  } catch (err) {
    console.warn('Failed to load saved state, starting fresh:', err);
    return freshState();
  }
}

// Returns false if the write failed (quota — localStorage caps around 5 MB, and
// ride telemetry is the thing that grows). Callers that merge in remote data
// check this so a failed persist is reported rather than silently lost.
export function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch (err) { console.warn('Failed to persist state:', err); return false; }
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
  const r = state.routes.find((x) => x.id === id);
  if (r?.bundled && !state.settings.dismissedRouteIds.includes(id)) {
    state.settings.dismissedRouteIds.push(id); // deletion sticks across reloads/redeploys
  }
  state.routes = state.routes.filter((r) => r.id !== id);
  save();
}

// Merge routes shipped in public/routes/ (see routes/bundled.js). Skips ids the
// user already has or has deleted. Returns how many were added.
export function mergeBundledRoutes(routes) {
  let added = 0;
  for (const r of routes) {
    if (!r || !r.id || !Array.isArray(r.segments)) continue;
    if (state.routes.some((x) => x.id === r.id)) continue;
    if (state.settings.dismissedRouteIds.includes(r.id)) continue;
    state.routes.push({ ...r, bundled: true });
    added++;
  }
  if (added) save();
  return added;
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

// ---- cloud sync (see cloud/sync.js) ----
// The syncable subset: content that should follow you between devices. Bundled
// routes are excluded — they ship with the app itself. Device preferences
// (units, HUD, theme, graphics quality) stay local on purpose.
export function exportSyncable() {
  return {
    app: 'bmbr',
    v: 1,
    savedAt: Date.now(),
    players: state.players,
    riders: state.riders,
    bikes: state.garage.bikes,
    routes: state.routes.filter((r) => !r.bundled),
    activities: state.activities,
    decals: state.decals,
    customSkyboxes: state.customSkyboxes,
    dismissedRouteIds: state.settings.dismissedRouteIds
  };
}

// Merge a remote payload into local state. Union semantics (see cloud/merge.js):
// nothing local is ever dropped. Returns a summary; `stored` is false when the
// merged result was too big for localStorage.
export function importSyncable(remote) {
  const merged = mergeSyncable(exportSyncable(), remote);
  state.players = merged.players;
  state.riders = merged.riders;
  state.garage.bikes = merged.bikes;
  state.decals = merged.decals;
  state.customSkyboxes = merged.customSkyboxes;
  state.settings.dismissedRouteIds = merged.dismissedRouteIds;

  // Bundled routes live outside the sync payload; keep the local ones in place.
  const bundled = state.routes.filter((r) => r.bundled);
  state.routes = [...bundled, ...merged.routes.filter((r) => !bundled.some((b) => b.id === r.id))];

  state.activities = merged.activities;
  if (state.activities.length > MAX_ACTIVITIES) state.activities.length = MAX_ACTIVITIES;

  // Active selections are device-local; make sure they still point at something.
  if (!state.players.some((p) => p.id === state.activePlayerId)) state.activePlayerId = state.players[0].id;
  if (!state.riders.some((r) => r.id === state.activeRiderId)) state.activeRiderId = state.riders[0].id;
  if (!state.garage.bikes.some((b) => b.id === state.garage.activeBikeId)) state.garage.activeBikeId = state.garage.bikes[0].id;

  const stored = save();
  return { stored, activities: state.activities.length, routes: state.routes.length };
}

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
