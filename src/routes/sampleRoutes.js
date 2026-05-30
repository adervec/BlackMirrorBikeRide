// Built-in routes shipped with the game so there is something to ride on first
// launch. Mojave Desert is the starter biome called out in the spec.
import { ONTARIO_AIR_DENSITY } from './virtualRoute.js';

export function sampleRoutes() {
  return [
    {
      id: 'mojave-warmup',
      type: 'virtual',
      name: 'Mojave Warm-Up',
      skybox: 'clear-day',
      airDensity: ONTARIO_AIR_DENSITY,
      segments: [
        { surface: 'asphalt',        gradient: 0.00, length: 600, biome: 'mojave', turn: 0 },
        { surface: 'asphalt',        gradient: 0.02, length: 400, biome: 'mojave', turn: 15 },
        { surface: 'chipseal',       gradient: 0.04, length: 500, biome: 'mojave', turn: -25 },
        { surface: 'asphalt',        gradient: -0.03, length: 700, biome: 'mojave', turn: 30 },
        { surface: 'smooth-asphalt', gradient: 0.00, length: 800, biome: 'mojave', turn: -10 }
      ]
    },
    {
      id: 'mojave-grind',
      type: 'virtual',
      name: 'Mojave Climb & Gravel Grind',
      skybox: 'golden-hour',
      airDensity: ONTARIO_AIR_DENSITY,
      segments: [
        { surface: 'asphalt',  gradient: 0.00, length: 500, biome: 'mojave', turn: 0 },
        { surface: 'asphalt',  gradient: 0.06, length: 900, biome: 'mojave', turn: 40 },
        { surface: 'gravel',   gradient: 0.08, length: 600, biome: 'mojave', turn: -35 },
        { surface: 'hardpack', gradient: 0.03, length: 500, biome: 'mojave', turn: 20 },
        { surface: 'sand',     gradient: -0.02, length: 300, biome: 'mojave', turn: -15 },
        { surface: 'asphalt',  gradient: -0.07, length: 1200, biome: 'mojave', turn: 60 }
      ]
    },
    {
      id: 'the-long-dark-loop',
      type: 'virtual',
      name: 'The Long Dark Loop',
      skybox: 'the-eye',
      airDensity: ONTARIO_AIR_DENSITY,
      segments: [
        { surface: 'smooth-asphalt', gradient: 0.00, length: 1000, biome: 'neongrid', turn: 90 },
        { surface: 'smooth-asphalt', gradient: 0.01, length: 1000, biome: 'neongrid', turn: 90 },
        { surface: 'smooth-asphalt', gradient: -0.01, length: 1000, biome: 'neongrid', turn: 90 },
        { surface: 'smooth-asphalt', gradient: 0.00, length: 1000, biome: 'neongrid', turn: 90 }
      ]
    }
  ];
}
