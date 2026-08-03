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
  farmland: {
    label: 'Farmland',
    ground: 0x8aa04f,
    groundLow: 0x6d8040,
    fog: 0xdfe8c8,
    fogDensity: 0.0020,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'fence',     density: 2.0 },
      { type: 'haybale',   density: 0.5 },
      { type: 'barn',      density: 0.06 },
      { type: 'deciduous', density: 0.4 },
      { type: 'shrub',     density: 0.8 }
    ]
  },
  forest: {
    label: 'Forest',
    ground: 0x4a6b3a,
    groundLow: 0x33502a,
    fog: 0xb8c9b0,
    fogDensity: 0.0028,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'pine',      density: 4.0 },
      { type: 'deciduous', density: 1.5 },
      { type: 'rock',      density: 0.8 },
      { type: 'shrub',     density: 1.2 }
    ]
  },
  urban: {
    label: 'Urban',
    ground: 0x777d82,
    groundLow: 0x5a6065,
    fog: 0xc5c9cd,
    fogDensity: 0.0024,
    defaultSurface: 'smooth-asphalt',
    artifacts: [
      { type: 'building',   density: 2.2 },
      { type: 'streetlamp', density: 1.0 },
      { type: 'roadsign',   density: 0.3 }
    ]
  },
  lakeside: {
    label: 'Lakeside',
    ground: 0x7fa88f,
    groundLow: 0x5d8570,
    fog: 0xd7e8ef,
    fogDensity: 0.0021,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'reeds',     density: 2.5 },
      { type: 'deciduous', density: 0.8 },
      { type: 'rock',      density: 0.6 }
    ]
  },
  // Neutral prop-free ground: the default for plain (un-enriched) GPX imports.
  satellite: {
    label: 'Real World (neutral)',
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
