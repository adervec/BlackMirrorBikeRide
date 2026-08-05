// Pure merge of two cloud-sync payloads (no I/O — unit-testable).
//
// Everything synced is a content SET, so both sides are unioned: no device loses
// a ride, bike, rider or route because another device was offline. On an id
// collision the LOCAL copy wins (remote never overwrites something you have).
//
// Payload shape:
//   { app:'bmbr', v, savedAt, players[], riders[], bikes[], routes[],
//     activities[], decals[], customSkyboxes[], dismissedRouteIds[] }
//
// Device-local preferences (units, HUD layout, theme, graphics quality) are
// deliberately NOT synced — a phone wants the low graphics preset while the
// desktop wants high, and syncing them would make the two fight.

// ponytail: union-by-id, no tombstones — deleting an item on one device doesn't
// propagate, it reappears from any device that still has it. Add tombstones
// ({ id, deleted, at }) if that becomes annoying in practice. Deleted *bundled*
// routes are already handled properly via dismissedRouteIds.
function unionById(a = [], b = []) {
  const out = new Map();
  for (const item of [...(a || []), ...(b || [])]) {
    if (item && item.id && !out.has(item.id)) out.set(item.id, item);
  }
  return [...out.values()];
}

export function mergeSyncable(local, remote) {
  local = local || {}; remote = remote || {};
  return {
    app: 'bmbr',
    v: 1,
    savedAt: Math.max(local.savedAt || 0, remote.savedAt || 0),
    players: unionById(local.players, remote.players),
    riders: unionById(local.riders, remote.riders),
    bikes: unionById(local.bikes, remote.bikes),
    routes: unionById(local.routes, remote.routes),
    // Newest first, matching the local activity list; the caller applies the cap.
    activities: unionById(local.activities, remote.activities)
      .sort((x, y) => (Date.parse(y.date) || 0) - (Date.parse(x.date) || 0)),
    decals: unionById(local.decals, remote.decals),
    customSkyboxes: unionById(local.customSkyboxes, remote.customSkyboxes),
    dismissedRouteIds: [...new Set([
      ...(local.dismissedRouteIds || []),
      ...(remote.dismissedRouteIds || [])
    ])]
  };
}
