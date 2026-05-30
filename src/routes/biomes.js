// Biomes describe the look of the ground level and what artifacts scatter along
// the roadside. The renderer (world/scene.js, world/artifacts.js) consumes
// these. Artifact `density` is roughly items per 100 m per side.

export const BIOMES = {
  mojave: {
    label: 'Mojave Desert',
    ground: 0xc2a26b,
    groundLow: 0x9c7b46,
    fog: 0xe6d7a8,
    fogDensity: 0.0026,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'cactus',     density: 1.4 },
      { type: 'rock',       density: 1.1 },
      { type: 'skull',      density: 0.15 },
      { type: 'tumbleweed', density: 0.5 },
      { type: 'roadsign',   density: 0.12 },
      { type: 'shrub',      density: 1.8 }
    ]
  },
  alpine: {
    label: 'Alpine Pass',
    ground: 0x6f8f55,
    groundLow: 0x4f6b3c,
    fog: 0xcfe0ea,
    fogDensity: 0.0022,
    defaultSurface: 'smooth-asphalt',
    artifacts: [
      { type: 'pine',  density: 2.6 },
      { type: 'rock',  density: 1.4 },
      { type: 'shrub', density: 1.0 }
    ]
  },
  neongrid: {
    label: 'Neon Grid',
    ground: 0x0a0a18,
    groundLow: 0x06060f,
    fog: 0x14002a,
    fogDensity: 0.0030,
    defaultSurface: 'smooth-asphalt',
    grid: true,
    artifacts: [
      { type: 'pylon',  density: 1.2 },
      { type: 'crystal', density: 0.8 }
    ]
  },
  // Used by real-world routes: neutral satellite-derived ground, no random props.
  satellite: {
    label: 'Real World (satellite-derived)',
    ground: 0x7c8a6a,
    groundLow: 0x5c6a4a,
    fog: 0xc9d3d9,
    fogDensity: 0.0020,
    defaultSurface: 'asphalt',
    artifacts: []
  }
};

export const DEFAULT_BIOME = 'mojave';

export function biomeList() {
  return Object.entries(BIOMES).map(([id, b]) => ({ id, label: b.label }));
}
