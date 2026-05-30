// Skyboxes range from the mundane to the existentially bizarre. The scene reads
// `top`/`bottom` to build a gradient dome, sun lighting params, and an optional
// `special` animator id handled in world/scene.js.

export const SKYBOXES = {
  'clear-day': {
    label: 'Clear Day',
    top: 0x3a7bd5, bottom: 0xbfe3ff,
    sun: 0xfff4e0, sunIntensity: 1.1, ambient: 0x8899aa, ambientIntensity: 0.55,
    sunPos: [0.5, 0.8, 0.2]
  },
  'golden-hour': {
    label: 'Golden Hour',
    top: 0x2a3a66, bottom: 0xffb56b,
    sun: 0xffd9a0, sunIntensity: 1.0, ambient: 0x6a5a4a, ambientIntensity: 0.5,
    sunPos: [-0.7, 0.25, 0.4]
  },
  'overcast': {
    label: 'Overcast',
    top: 0x9aa3ad, bottom: 0xc8ced3,
    sun: 0xdfe4e8, sunIntensity: 0.6, ambient: 0xaab0b6, ambientIntensity: 0.75,
    sunPos: [0.2, 0.9, 0.1]
  },
  'starfield': {
    label: 'Starfield',
    top: 0x05060f, bottom: 0x0c1230,
    sun: 0x9fb6ff, sunIntensity: 0.4, ambient: 0x20283f, ambientIntensity: 0.45,
    sunPos: [0.3, 0.7, -0.5], special: 'stars'
  },
  'vaporwave': {
    label: 'Vaporwave',
    top: 0x1b0033, bottom: 0xff2fb0,
    sun: 0xff8ad8, sunIntensity: 0.9, ambient: 0x4b1f6b, ambientIntensity: 0.7,
    sunPos: [0.0, 0.35, -0.9], special: 'gridSun'
  },
  'the-eye': {
    label: 'The Eye That Watches',
    top: 0x12010a, bottom: 0x3a0010,
    sun: 0xff3b3b, sunIntensity: 0.7, ambient: 0x2a0010, ambientIntensity: 0.4,
    sunPos: [0.0, 0.6, -0.8], special: 'eye'
  },
  'flesh-sky': {
    label: 'Sky of Quiet Flesh',
    top: 0x6b2b2b, bottom: 0xd99a8a,
    sun: 0xffcfc0, sunIntensity: 0.8, ambient: 0x5a3a3a, ambientIntensity: 0.6,
    sunPos: [0.4, 0.5, -0.3], special: 'breathe'
  }
};

export const DEFAULT_SKYBOX = 'clear-day';

export function skyboxList() {
  return Object.entries(SKYBOXES).map(([id, s]) => ({ id, label: s.label }));
}

// Resolve a skybox id against built-ins + the user's custom skyboxes.
export function resolveSkybox(id, customs = []) {
  return SKYBOXES[id] || (customs || []).find((c) => c.id === id) || SKYBOXES[DEFAULT_SKYBOX];
}

// Selectable options including custom skyboxes (for route builders).
export function allSkyboxOptions(customs = []) {
  return [
    ...skyboxList(),
    ...(customs || []).map((c) => ({ id: c.id, label: `★ ${c.label}` }))
  ];
}

// A fresh editable custom skybox (clone of clear-day). Colours are hex strings
// for easy editing; THREE.Color accepts both strings and numbers, so the scene
// renders built-ins (numbers) and customs (strings) identically.
let _sid = 0;
export function makeCustomSkybox(name = 'My Sky') {
  return {
    id: `sky-${Date.now().toString(36)}-${(_sid++).toString(36)}`,
    label: name,
    top: '#3a7bd5', bottom: '#bfe3ff',
    sun: '#fff4e0', sunIntensity: 1.1, ambient: '#8899aa', ambientIntensity: 0.55,
    sunPos: [0.5, 0.8, 0.2], special: '', custom: true
  };
}

export const SKYBOX_SPECIALS = [
  { value: '', label: 'None' },
  { value: 'stars', label: 'Starfield' },
  { value: 'gridSun', label: 'Grid Sun' },
  { value: 'eye', label: 'The Eye' },
  { value: 'breathe', label: 'Breathing Fog' }
];

// Convert a skybox colour (number or '#rrggbb') to a CSS string for swatches.
export function colorCss(v) {
  if (typeof v === 'number') return '#' + v.toString(16).padStart(6, '0');
  return v || '#000000';
}
