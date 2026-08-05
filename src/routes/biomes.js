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
      { type: 'pylon',     density: 1.2 },
      { type: 'crystal',   density: 0.8 },
      { type: 'floatcube', density: 0.7 },
      { type: 'neonring',  density: 0.5 }
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
  coastal: {
    label: 'Coastal',
    ground: 0xc9b98a,
    groundLow: 0x9fae7a,
    fog: 0xdfeaf2,
    fogDensity: 0.0018,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'dunegrass',  density: 3.0 },
      { type: 'palm',       density: 1.2 },
      { type: 'driftwood',  density: 0.5 },
      { type: 'rock',       density: 0.6 }
    ]
  },
  tundra: {
    label: 'Tundra',
    ground: 0xe8eef2,
    groundLow: 0xc3ced6,
    fog: 0xdfe9f0,
    fogDensity: 0.0030,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'snowdrift', density: 1.5 },
      { type: 'icespike',  density: 0.8 },
      { type: 'deadtree',  density: 0.7 },
      { type: 'boulder',   density: 0.9 }
    ]
  },
  jungle: {
    label: 'Jungle',
    ground: 0x3f6b32,
    groundLow: 0x2b4a24,
    fog: 0xa8c4a0,
    fogDensity: 0.0038,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'jungletree', density: 3.2 },
      { type: 'fern',       density: 3.0 },
      { type: 'palm',       density: 1.0 },
      { type: 'boulder',    density: 0.5 }
    ]
  },
  savanna: {
    label: 'Savanna',
    ground: 0xbfa860,
    groundLow: 0x9a8746,
    fog: 0xe4dcb8,
    fogDensity: 0.0022,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'grasstuft',    density: 3.5 },
      { type: 'acacia',       density: 0.9 },
      { type: 'termitemound', density: 0.5 },
      { type: 'boulder',      density: 0.6 }
    ]
  },
  volcanic: {
    label: 'Volcanic',
    ground: 0x4a3f3d,
    groundLow: 0x2e2726,
    fog: 0x8a6a60,
    fogDensity: 0.0034,
    defaultSurface: 'chipseal',
    artifacts: [
      { type: 'lavarock',  density: 2.2 },
      { type: 'boulder',   density: 1.0 },
      { type: 'steamvent', density: 0.5 },
      { type: 'deadtree',  density: 0.5 }
    ]
  },
  moorland: {
    label: 'Moorland',
    ground: 0x7d7a52,
    groundLow: 0x5c5c3e,
    fog: 0xcfd2c8,
    fogDensity: 0.0030,
    defaultSurface: 'gravel',
    artifacts: [
      { type: 'heather',   density: 3.0 },
      { type: 'stonewall', density: 1.2 },
      { type: 'boulder',   density: 1.0 },
      { type: 'deadtree',  density: 0.2 }
    ]
  },
  vineyard: {
    label: 'Vineyard',
    ground: 0x9aa85e,
    groundLow: 0x7a8848,
    fog: 0xe6e4c0,
    fogDensity: 0.0020,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'vinerow', density: 2.4 },
      { type: 'cypress', density: 0.8 },
      { type: 'haybale', density: 0.3 },
      { type: 'villa',   density: 0.08 }
    ]
  },
  industrial: {
    label: 'Industrial',
    ground: 0x6e6e6a,
    groundLow: 0x53534f,
    fog: 0xb8b4ac,
    fogDensity: 0.0032,
    defaultSurface: 'concrete',
    artifacts: [
      { type: 'container',  density: 1.2 },
      { type: 'pylon',      density: 0.8 },
      { type: 'streetlamp', density: 0.6 },
      { type: 'factory',    density: 0.5 }
    ]
  },
  suburban: {
    label: 'Suburban',
    ground: 0x7f9a5c,
    groundLow: 0x647c46,
    fog: 0xd6dfe2,
    fogDensity: 0.0022,
    defaultSurface: 'smooth-asphalt',
    artifacts: [
      { type: 'hedge',      density: 2.0 },
      { type: 'deciduous',  density: 1.2 },
      { type: 'house',      density: 1.0 },
      { type: 'streetlamp', density: 0.8 },
      { type: 'mailbox',    density: 0.5 }
    ]
  },
  canyon: {
    label: 'Canyon',
    ground: 0xb0653a,
    groundLow: 0x8a4a2a,
    fog: 0xe0b48a,
    fogDensity: 0.0024,
    defaultSurface: 'gravel',
    artifacts: [
      { type: 'redrock',    density: 1.8 },
      { type: 'cactus',     density: 0.6 },
      { type: 'tumbleweed', density: 0.4 },
      { type: 'mesa',       density: 0.35 }
    ]
  },
  swamp: {
    label: 'Swamp',
    ground: 0x54614a,
    groundLow: 0x3a4634,
    fog: 0xa8b8a0,
    fogDensity: 0.0040,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'reeds',       density: 3.0 },
      { type: 'cypresstree', density: 1.8 },
      { type: 'lilypad',     density: 1.5 },
      { type: 'deadtree',    density: 1.0 }
    ]
  },
  // ---- the existentially bizarre end, to match the stranger skyboxes ----
  graveyard: {
    label: 'Graveyard',
    ground: 0x5a5c52,
    groundLow: 0x42443c,
    fog: 0xa8aca0,
    fogDensity: 0.0034,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'headstone', density: 3.0 },
      { type: 'deadtree',  density: 1.2 },
      { type: 'ironfence', density: 1.0 },
      { type: 'crypt',     density: 0.25 }
    ]
  },
  void: {
    label: 'The Void',
    ground: 0x14141c,
    groundLow: 0x0a0a10,
    fog: 0x1a1a26,
    fogDensity: 0.0026,
    defaultSurface: 'smooth-asphalt',
    artifacts: [
      { type: 'monolith',  density: 0.8 },
      { type: 'floatcube', density: 0.6 },
      { type: 'obelisk',   density: 0.5 }
    ]
  },
  flesh: {
    label: 'Flesh',
    ground: 0x8a4a48,
    groundLow: 0x63322f,
    fog: 0xc08a80,
    fogDensity: 0.0034,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'fleshpillar', density: 1.2 },
      { type: 'eyestalk',    density: 0.9 },
      { type: 'ribarch',     density: 0.3 }
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
