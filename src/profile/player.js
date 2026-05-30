// The PLAYER is the real human pedalling: their weight & body dimensions drive
// the physics (mass to haul, frontal area for drag). This is deliberately
// separate from the RIDER (the in-game avatar) — see profile/customize.js.
// A player can have many riders; a rider may "snap" its visual body to a player.

let _id = 0;
const uid = () => `player-${Date.now().toString(36)}-${(_id++).toString(36)}`;

export function defaultPlayer() {
  return {
    id: 'player-1',
    name: 'Player One',
    weightKg: 75,
    heightCm: 178,
    age: 35,
    sex: 'unspecified',
    shoulderWidthCm: 45,
    inseamCm: 83,
    ftpW: 220
  };
}

export function makePlayer(name = 'New Player') {
  return { ...defaultPlayer(), id: uid(), name };
}

// Projected frontal area of the rider's body (m²), Heil-style estimate.
export function computeFrontalArea(player) {
  const h = Math.max(1.2, player.heightCm / 100);
  const m = Math.max(35, player.weightKg);
  let area = 0.0293 * Math.pow(h, 0.725) * Math.pow(m, 0.425) + 0.0604;
  const shoulderScale = (player.shoulderWidthCm || 45) / 45;
  area *= 0.85 + 0.15 * shoulderScale;
  return area;
}

export function bodySurfaceArea(player) {
  return 0.007184 * Math.pow(player.heightCm, 0.725) * Math.pow(player.weightKg, 0.425);
}

export function ftpWkg(player) {
  return player.ftpW / player.weightKg;
}

// Back-compat alias (older code/imports referred to "profile").
export const defaultProfile = defaultPlayer;
