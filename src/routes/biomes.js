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
      { type: 'roadsign',   density: 0.3 },
      { type: 'bollard',    density: 0.6 }
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
      { type: 'rock',      density: 0.6 },
      { type: 'boathouse', density: 0.25 }
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
  redwood: {
    label: 'Redwood Forest',
    ground: 0x4a5a38,
    groundLow: 0x35452a,
    fog: 0xb8c4a8,
    fogDensity: 0.0034,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'redwood', density: 2.4 },
      { type: 'fern',    density: 2.6 },
      { type: 'deadtree', density: 0.6 },
      { type: 'boulder', density: 0.7 }
    ]
  },
  badlands: {
    label: 'Badlands',
    ground: 0xa8794a,
    groundLow: 0x8a5c36,
    fog: 0xdcc09a,
    fogDensity: 0.0026,
    defaultSurface: 'gravel',
    artifacts: [
      { type: 'hoodoo',    density: 1.4 },
      { type: 'redrock',   density: 1.2 },
      { type: 'grasstuft', density: 1.2 },
      { type: 'deadtree',  density: 0.4 }
    ]
  },
  saltflat: {
    label: 'Salt Flat',
    ground: 0xeae6dc,
    groundLow: 0xcfc9bb,
    fog: 0xe8e4d8,
    fogDensity: 0.0016,
    defaultSurface: 'concrete',
    artifacts: [
      { type: 'saltcrust', density: 1.8 },
      { type: 'saltcairn', density: 0.5 },
      { type: 'deadtree',  density: 0.15 },
      { type: 'boulder',   density: 0.3 }
    ]
  },
  prairie: {
    label: 'Prairie',
    ground: 0xc4b264,
    groundLow: 0xa2934c,
    fog: 0xe6e0c0,
    fogDensity: 0.0020,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'wheat',     density: 3.4 },
      { type: 'fence',     density: 1.2 },
      { type: 'windpump',  density: 0.3 },
      { type: 'grainsilo', density: 0.15 }
    ]
  },
  orchard: {
    label: 'Orchard',
    ground: 0x88a552,
    groundLow: 0x6b8640,
    fog: 0xdfe8c4,
    fogDensity: 0.0022,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'fruittree',  density: 2.8 },
      { type: 'cratestack', density: 0.6 },
      { type: 'ladder',     density: 0.4 },
      { type: 'hedge',      density: 0.8 }
    ]
  },
  bamboo: {
    label: 'Bamboo Grove',
    ground: 0x5a7040,
    groundLow: 0x42552f,
    fog: 0xc0cfa8,
    fogDensity: 0.0036,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'bamboo',  density: 4.2 },
      { type: 'fern',    density: 2.0 },
      { type: 'lantern', density: 0.4 },
      { type: 'boulder', density: 0.4 }
    ]
  },
  mangrove: {
    label: 'Mangrove',
    ground: 0x4a5a48,
    groundLow: 0x34412f,
    fog: 0xa8bcae,
    fogDensity: 0.0040,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'mangrove',  density: 2.6 },
      { type: 'reeds',     density: 2.2 },
      { type: 'lilypad',   density: 1.2 },
      { type: 'driftwood', density: 0.5 }
    ]
  },
  glacier: {
    label: 'Glacier',
    ground: 0xdfeaf2,
    groundLow: 0xb4c8d8,
    fog: 0xe0ecf4,
    fogDensity: 0.0028,
    defaultSurface: 'concrete',
    artifacts: [
      { type: 'serac',     density: 1.2 },
      { type: 'icespike',  density: 1.4 },
      { type: 'snowdrift', density: 1.6 },
      { type: 'boulder',   density: 0.5 }
    ]
  },
  oldtown: {
    label: 'Old Town',
    ground: 0x8a8272,
    groundLow: 0x6b6355,
    fog: 0xd0cabc,
    fogDensity: 0.0026,
    defaultSurface: 'cobbles',
    artifacts: [
      { type: 'timberhouse', density: 1.6 },
      { type: 'lantern',     density: 1.0 },
      { type: 'stonewall',   density: 0.8 },
      { type: 'well',        density: 0.2 }
    ]
  },
  harbour: {
    label: 'Harbour',
    ground: 0x74797e,
    groundLow: 0x585d62,
    fog: 0xc4ccd2,
    fogDensity: 0.0026,
    defaultSurface: 'concrete',
    artifacts: [
      { type: 'bollard',    density: 1.8 },
      { type: 'container',  density: 1.0 },
      { type: 'cratestack', density: 0.8 },
      { type: 'crane',      density: 0.25 }
    ]
  },
  oasis: {
    label: 'Oasis',
    ground: 0xd6c088,
    groundLow: 0xb09a62,
    fog: 0xe8dcb8,
    fogDensity: 0.0020,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'palm',     density: 2.0 },
      { type: 'reeds',    density: 1.6 },
      { type: 'sanddune', density: 0.8 },
      { type: 'rock',     density: 0.6 }
    ]
  },
  dunes: {
    label: 'Sand Dunes',
    ground: 0xe0c68e,
    groundLow: 0xc0a468,
    fog: 0xf0e0b8,
    fogDensity: 0.0022,
    defaultSurface: 'sand',
    artifacts: [
      { type: 'sanddune',   density: 1.6 },
      { type: 'dunegrass',  density: 1.4 },
      { type: 'skull',      density: 0.2 },
      { type: 'tumbleweed', density: 0.3 }
    ]
  },
  karst: {
    label: 'Karst Towers',
    ground: 0x6b8a55,
    groundLow: 0x4d6a3c,
    fog: 0xc0d4c0,
    fogDensity: 0.0032,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'karsttower', density: 0.5 },
      { type: 'jungletree', density: 1.6 },
      { type: 'fern',       density: 2.0 },
      { type: 'boulder',    density: 0.6 }
    ]
  },
  autumnforest: {
    label: 'Autumn Forest',
    ground: 0x8a6a3a,
    groundLow: 0x6a4f2a,
    fog: 0xdcc09a,
    fogDensity: 0.0032,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'autumntree',   density: 3.0 },
      { type: 'fallenleaves', density: 2.4 },
      { type: 'deadtree',     density: 0.6 },
      { type: 'boulder',      density: 0.5 }
    ]
  },
  snowforest: {
    label: 'Winter Forest',
    ground: 0xdfe8ee,
    groundLow: 0xb8c6d0,
    fog: 0xdde8f0,
    fogDensity: 0.0034,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'snowpine',  density: 3.2 },
      { type: 'snowdrift', density: 1.6 },
      { type: 'deadtree',  density: 0.5 },
      { type: 'boulder',   density: 0.4 }
    ]
  },
  sakura: {
    label: 'Cherry Blossom',
    ground: 0x9aae70,
    groundLow: 0x7a8e52,
    fog: 0xf0dce4,
    fogDensity: 0.0026,
    defaultSurface: 'smooth-asphalt',
    artifacts: [
      { type: 'cherrytree', density: 2.6 },
      { type: 'lantern',    density: 0.8 },
      { type: 'hedge',      density: 0.8 },
      { type: 'boulder',    density: 0.3 }
    ]
  },
  lavender: {
    label: 'Lavender Fields',
    ground: 0x9a9a5e,
    groundLow: 0x7c7c46,
    fog: 0xe4dcec,
    fogDensity: 0.0020,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'lavenderrow', density: 3.0 },
      { type: 'cypress',     density: 0.6 },
      { type: 'villa',       density: 0.1 },
      { type: 'stonewall',   density: 0.5 }
    ]
  },
  sunflower: {
    label: 'Sunflower Fields',
    ground: 0x9caa50,
    groundLow: 0x7c8a3c,
    fog: 0xeee4b0,
    fogDensity: 0.0022,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'sunflower', density: 3.4 },
      { type: 'fence',     density: 0.8 },
      { type: 'haybale',   density: 0.3 },
      { type: 'grasstuft', density: 0.8 }
    ]
  },
  cornfield: {
    label: 'Cornfield',
    ground: 0xa8a054,
    groundLow: 0x86803e,
    fog: 0xe2dcb4,
    fogDensity: 0.0024,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'cornstalk', density: 3.6 },
      { type: 'fence',     density: 0.8 },
      { type: 'grainsilo', density: 0.12 },
      { type: 'windpump',  density: 0.2 }
    ]
  },
  olivegrove: {
    label: 'Olive Grove',
    ground: 0xa8a874,
    groundLow: 0x86865a,
    fog: 0xe4e0c4,
    fogDensity: 0.0022,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'olivetree', density: 2.4 },
      { type: 'stonewall', density: 1.0 },
      { type: 'grasstuft', density: 1.2 },
      { type: 'boulder',   density: 0.5 }
    ]
  },
  terraces: {
    label: 'Rice Terraces',
    ground: 0x7aa054,
    groundLow: 0x5c8040,
    fog: 0xc8dcc0,
    fogDensity: 0.0030,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'paddyterrace', density: 1.4 },
      { type: 'reeds',        density: 2.0 },
      { type: 'palm',         density: 0.5 },
      { type: 'boulder',      density: 0.4 }
    ]
  },
  quarry: {
    label: 'Quarry',
    ground: 0x9a958a,
    groundLow: 0x76726a,
    fog: 0xcfcac0,
    fogDensity: 0.0030,
    defaultSurface: 'gravel',
    artifacts: [
      { type: 'gravelpile', density: 1.4 },
      { type: 'quarryface', density: 0.5 },
      { type: 'excavator',  density: 0.25 },
      { type: 'container',  density: 0.4 }
    ]
  },
  windfarm: {
    label: 'Wind Farm',
    ground: 0x8aa858,
    groundLow: 0x6c8a42,
    fog: 0xdce8e4,
    fogDensity: 0.0020,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'windturbine', density: 0.4 },
      { type: 'grasstuft',   density: 2.4 },
      { type: 'fence',       density: 0.8 },
      { type: 'wheat',       density: 1.0 }
    ]
  },
  geothermal: {
    label: 'Geothermal',
    ground: 0x8a7e6a,
    groundLow: 0x685e4e,
    fog: 0xd0c4b4,
    fogDensity: 0.0036,
    defaultSurface: 'gravel',
    artifacts: [
      { type: 'hotspring', density: 0.9 },
      { type: 'mudpot',    density: 1.2 },
      { type: 'steamvent', density: 1.0 },
      { type: 'lavarock',  density: 1.0 }
    ]
  },
  fjord: {
    label: 'Fjord',
    ground: 0x5a6b52,
    groundLow: 0x3f4d3a,
    fog: 0xc0d0d8,
    fogDensity: 0.0026,
    defaultSurface: 'asphalt',
    artifacts: [
      { type: 'fjordcliff', density: 0.45 },
      { type: 'pine',       density: 1.8 },
      { type: 'waterfall',  density: 0.3 },
      { type: 'boathouse',  density: 0.3 }
    ]
  },
  ruins: {
    label: 'Ancient Ruins',
    ground: 0xa8a084,
    groundLow: 0x847c64,
    fog: 0xdcd4bc,
    fogDensity: 0.0024,
    defaultSurface: 'cobbles',
    artifacts: [
      { type: 'column',     density: 1.6 },
      { type: 'rubble',     density: 2.0 },
      { type: 'brokenarch', density: 0.4 },
      { type: 'grasstuft',  density: 1.2 }
    ]
  },
  temple: {
    label: 'Temple Road',
    ground: 0x7a9060,
    groundLow: 0x5c7048,
    fog: 0xd4dcc4,
    fogDensity: 0.0026,
    defaultSurface: 'cobbles',
    artifacts: [
      { type: 'torii',      density: 0.5 },
      { type: 'pagoda',     density: 0.3 },
      { type: 'lantern',    density: 1.6 },
      { type: 'cherrytree', density: 1.0 }
    ]
  },
  airfield: {
    label: 'Airfield',
    ground: 0x8a9464,
    groundLow: 0x6c744c,
    fog: 0xd8dcd4,
    fogDensity: 0.0022,
    defaultSurface: 'concrete',
    artifacts: [
      { type: 'runwaylight', density: 2.2 },
      { type: 'windsock',    density: 0.4 },
      { type: 'hangar',      density: 0.25 },
      { type: 'fence',       density: 1.0 }
    ]
  },
  // ---- the existentially bizarre end, to match the stranger skyboxes ----
  bonefield: {
    label: 'Bone Field',
    ground: 0xa89c84,
    groundLow: 0x847a64,
    fog: 0xd8ccb4,
    fogDensity: 0.0030,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'femur',   density: 2.2 },
      { type: 'skull',   density: 1.4 },
      { type: 'ribarch', density: 0.5 },
      { type: 'boulder', density: 0.4 }
    ]
  },
  origami: {
    label: 'Origami',
    ground: 0xe8e4dc,
    groundLow: 0xc8c4bc,
    fog: 0xf0ece4,
    fogDensity: 0.0022,
    defaultSurface: 'wood-boards',
    artifacts: [
      { type: 'papercrane', density: 1.8 },
      { type: 'paperfold',  density: 2.0 },
      { type: 'lantern',    density: 0.5 }
    ]
  },
  chessboard: {
    label: 'Chessboard',
    ground: 0xdcd8d0,
    groundLow: 0x3a3a3a,
    fog: 0xc8c8cc,
    fogDensity: 0.0024,
    defaultSurface: 'smooth-asphalt',
    artifacts: [
      { type: 'chesspawn', density: 1.8 },
      { type: 'chessrook', density: 0.8 },
      { type: 'monolith',  density: 0.3 }
    ]
  },
  mushroom: {
    label: 'Mushroom Wood',
    ground: 0x4a4438,
    groundLow: 0x332f26,
    fog: 0xb0a488,
    fogDensity: 0.0036,
    defaultSurface: 'hardpack',
    artifacts: [
      { type: 'giantmushroom', density: 1.8 },
      { type: 'toadstool',     density: 2.6 },
      { type: 'fern',          density: 1.6 },
      { type: 'deadtree',      density: 0.6 }
    ]
  },
  clockwork: {
    label: 'Clockwork',
    ground: 0x6a5a42,
    groundLow: 0x4a3e2c,
    fog: 0xc0aa84,
    fogDensity: 0.0030,
    defaultSurface: 'wood-boards',
    artifacts: [
      { type: 'gear',     density: 1.6 },
      { type: 'pendulum', density: 0.7 },
      { type: 'obelisk',  density: 0.3 }
    ]
  },
  servers: {
    label: 'Server Farm',
    ground: 0x2a2e34,
    groundLow: 0x1c1f24,
    fog: 0x3a4450,
    fogDensity: 0.0030,
    defaultSurface: 'concrete',
    artifacts: [
      { type: 'serverrack', density: 2.2 },
      { type: 'cablecoil',  density: 1.2 },
      { type: 'pylon',      density: 0.5 },
      { type: 'crt',        density: 0.8 }
    ]
  },
  staticfield: {
    label: 'Static',
    ground: 0x50525a,
    groundLow: 0x3a3c42,
    fog: 0x9a9ca4,
    fogDensity: 0.0034,
    defaultSurface: 'chipseal',
    artifacts: [
      { type: 'crt',        density: 2.0 },
      { type: 'antenna',    density: 0.8 },
      { type: 'deadtree',   density: 0.5 },
      { type: 'serverrack', density: 0.4 }
    ]
  },
  mirrorfield: {
    label: 'Black Mirrors',
    ground: 0x1a1c22,
    groundLow: 0x101218,
    fog: 0x2a2e38,
    fogDensity: 0.0024,
    defaultSurface: 'smooth-asphalt',
    artifacts: [
      { type: 'blackmirror', density: 1.4 },
      { type: 'monolith',    density: 0.5 },
      { type: 'obelisk',     density: 0.3 }
    ]
  },
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
      { type: 'monolith',    density: 0.8 },
      { type: 'floatcube',   density: 0.6 },
      { type: 'obelisk',     density: 0.5 },
      { type: 'blackmirror', density: 0.4 }
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
      { type: 'ribarch',     density: 0.3 },
      { type: 'femur',       density: 0.6 }
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
