// Road surface materials. Each has a rolling-resistance coefficient (Crr) that
// feeds the physics model and visual hints (colour, roughness) for the road
// ribbon. Crr values are representative real-world figures for ~good tyres.

export const SURFACES = {
  'wood-boards':    { label: 'Wooden Boards',  crr: 0.0025, color: 0xb5874a, rough: 0.05 },
  'smooth-asphalt': { label: 'Smooth Asphalt', crr: 0.0035, color: 0x3a3d44, rough: 0.10 },
  'asphalt':        { label: 'Asphalt',        crr: 0.0050, color: 0x44474e, rough: 0.20 },
  'concrete':       { label: 'Concrete',       crr: 0.0055, color: 0x8d8f93, rough: 0.18 },
  'chipseal':       { label: 'Chipseal',       crr: 0.0075, color: 0x55585f, rough: 0.35 },
  'cobbles':        { label: 'Cobblestone',    crr: 0.0150, color: 0x6e6a64, rough: 0.70 },
  'gravel':         { label: 'Gravel',         crr: 0.0110, color: 0x9a8f7d, rough: 0.55 },
  'hardpack':       { label: 'Hardpack Dirt',  crr: 0.0140, color: 0x9c7b50, rough: 0.50 },
  'sand':           { label: 'Sand',           crr: 0.0300, color: 0xd8c189, rough: 0.85 },
  'grass':          { label: 'Grass',          crr: 0.0450, color: 0x5b8a3a, rough: 0.65 }
};

export const DEFAULT_SURFACE = 'asphalt';

export function surfaceCrr(id) {
  return (SURFACES[id] || SURFACES[DEFAULT_SURFACE]).crr;
}

export function surfaceLabel(id) {
  return (SURFACES[id] || SURFACES[DEFAULT_SURFACE]).label;
}

export function surfaceList() {
  return Object.entries(SURFACES).map(([id, s]) => ({ id, ...s }));
}
