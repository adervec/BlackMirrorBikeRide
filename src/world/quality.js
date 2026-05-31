// Graphics quality presets. These drive renderer resolution, shadow fidelity,
// image-based lighting (IBL) and bloom post-processing across the ride world and
// the garage preview. "high" is the sensible default: crisp, lit and bloomed, yet
// comfortably 60fps on a modern discrete GPU. "balanced" drops post-processing and
// resolution for integrated graphics; "ultra" pushes shadow + bloom fidelity.
//
// Quality is read when a renderer is built (entering a ride or the garage), so a
// change in Settings takes effect the next time you open one of those screens.

export const QUALITY_PRESETS = {
  balanced: {
    label: 'Balanced (integrated GPU)',
    pixelRatioCap: 1.5,
    shadowMapSize: 2048,
    env: true,
    anisotropy: 4,
    bloom: false,
  },
  high: {
    label: 'High (default)',
    pixelRatioCap: 2,
    shadowMapSize: 3072,
    env: true,
    anisotropy: 8,
    bloom: true,
    bloomStrength: 0.45,
    bloomRadius: 0.4,
    bloomThreshold: 0.75,
  },
  ultra: {
    label: 'Ultra (discrete GPU)',
    pixelRatioCap: 2,
    shadowMapSize: 4096,
    env: true,
    anisotropy: 16,
    bloom: true,
    bloomStrength: 0.7,
    bloomRadius: 0.5,
    bloomThreshold: 0.62,
  },
};

export const DEFAULT_QUALITY = 'high';

export function resolveQuality(id) {
  return QUALITY_PRESETS[id] || QUALITY_PRESETS[DEFAULT_QUALITY];
}

// [{ value, label }] for a <select>.
export function qualityOptions() {
  return Object.entries(QUALITY_PRESETS).map(([value, p]) => ({ value, label: p.label }));
}
