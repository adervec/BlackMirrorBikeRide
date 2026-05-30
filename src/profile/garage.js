// The garage: assemble a vehicle from a vehicle TYPE (wheel count/layout) plus
// frame/wheels/tyres/position. Parts span real-life → Mad Max → sci-fi and snap
// together with cheerful "40K Ork" logic (any combo is allowed). The assembled
// choices resolve to mass / Crr / Cd / position for the physics.

// Wheel layout is in avatar-local space: +x is forward, z is lateral.
export const VEHICLE_TYPES = {
  unicycle: { label: 'Unicycle', extraMass: -2.5, wheels: [{ x: 0.0, z: 0 }] },
  bike:     { label: 'Bicycle',  extraMass: 0,    wheels: [{ x: 0.6, z: 0 }, { x: -0.6, z: 0 }] },
  trike:    { label: 'Tricycle', extraMass: 3.0,  wheels: [{ x: 0.62, z: 0 }, { x: -0.55, z: 0.4 }, { x: -0.55, z: -0.4 }] },
  quad:     { label: 'Quad Bike',extraMass: 6.5,  wheels: [{ x: 0.62, z: 0.38 }, { x: 0.62, z: -0.38 }, { x: -0.6, z: 0.4 }, { x: -0.6, z: -0.4 }] },
  tandem:   { label: 'Tandem',   extraMass: 4.0,  wheels: [{ x: 0.9, z: 0 }, { x: -0.9, z: 0 }] }
};

export const FRAMES = {
  // --- real ---
  'alu-road':    { label: 'Aluminium Road',   mass: 9.0,  cd: 0.90, kind: 'road',   theme: 'real' },
  'carbon-road': { label: 'Carbon Road',      mass: 7.6,  cd: 0.85, kind: 'road',   theme: 'real' },
  'aero-road':   { label: 'Aero Carbon Road', mass: 8.1,  cd: 0.78, kind: 'road',   theme: 'real' },
  'tt':          { label: 'Time-Trial / Tri', mass: 9.4,  cd: 0.70, kind: 'tt',     theme: 'real' },
  'gravel':      { label: 'Gravel',           mass: 9.8,  cd: 0.95, kind: 'gravel', theme: 'real' },
  'mtb':         { label: 'Mountain',         mass: 12.6, cd: 1.10, kind: 'mtb',    theme: 'real' },
  // --- mad max ---
  'scrap-chopper': { label: 'Scrap Chopper',  mass: 16.0, cd: 1.25, kind: 'mtb',    theme: 'madmax' },
  'war-rig':       { label: 'War Rig Frame',  mass: 22.0, cd: 1.40, kind: 'mtb',    theme: 'madmax' },
  'rebar-racer':   { label: 'Rebar Racer',    mass: 13.5, cd: 1.05, kind: 'road',   theme: 'madmax' },
  // --- sci-fi ---
  'hover-frame':   { label: 'Hover Frame',    mass: 5.2,  cd: 0.62, kind: 'road',   theme: 'scifi' },
  'plasma-racer':  { label: 'Plasma Racer',   mass: 6.0,  cd: 0.55, kind: 'tt',     theme: 'scifi' },
  'graviton':      { label: 'Graviton Trike', mass: 4.0,  cd: 0.70, kind: 'gravel', theme: 'scifi' }
};

export const WHEELS = {
  'alloy-training': { label: 'Alloy Training', mass: 1.8, cdMod: 0.00, theme: 'real',  tread: 'slick' },
  'carbon-50':      { label: 'Carbon 50 mm',   mass: 1.5, cdMod: -0.03, theme: 'real', tread: 'slick' },
  'carbon-disc':    { label: 'Disc + Deep',    mass: 1.7, cdMod: -0.05, theme: 'real', tread: 'slick' },
  'mtb-wheels':     { label: 'MTB Tubeless',   mass: 2.1, cdMod: 0.02, theme: 'real',  tread: 'knobby' },
  'spiked':         { label: 'Spiked Steel',   mass: 3.2, cdMod: 0.10, theme: 'madmax', tread: 'spike' },
  'buzzsaw':        { label: 'Buzzsaw Rims',   mass: 3.6, cdMod: 0.12, theme: 'madmax', tread: 'spike' },
  'maglev':         { label: 'Maglev Rings',   mass: 0.9, cdMod: -0.08, theme: 'scifi', tread: 'glow' },
  'plasma-ring':    { label: 'Plasma Rings',   mass: 0.6, cdMod: -0.06, theme: 'scifi', tread: 'glow' }
};

export const TIRES = {
  'race-25':    { label: 'Race Slick 25 mm', mass: 0.45, crr: 0.0040, theme: 'real', tread: 'slick' },
  'allroad-28': { label: 'All-Road 28 mm',   mass: 0.55, crr: 0.0048, theme: 'real', tread: 'file' },
  'gravel-40':  { label: 'Gravel 40 mm',     mass: 0.80, crr: 0.0090, theme: 'real', tread: 'file' },
  'mtb-knobby': { label: 'MTB Knobby 2.2"',  mass: 1.20, crr: 0.0160, theme: 'real', tread: 'knobby' },
  'studded':    { label: 'Studded War Tyre', mass: 1.8,  crr: 0.0200, theme: 'madmax', tread: 'spike' },
  'solid-rubber':{ label: 'Solid Rubber',    mass: 2.2,  crr: 0.0120, theme: 'madmax', tread: 'knobby' },
  'antigrav':   { label: 'Anti-Grav Skirt',  mass: 0.20, crr: 0.0025, theme: 'scifi', tread: 'glow' }
};

export const POSITIONS = {
  hoods:    { label: 'Hoods',     areaScale: 1.00 },
  drops:    { label: 'Drops',     areaScale: 0.90 },
  aerobars: { label: 'Aero Bars', areaScale: 0.80 },
  upright:  { label: 'Upright',   areaScale: 1.15 }
};

const FIXED_KIT_MASS = 1.4;
const DRIVETRAIN_EFFICIENCY = 0.975;

let _id = 0;
const uid = () => `bike-${Date.now().toString(36)}-${(_id++).toString(36)}`;

export function defaultBike() {
  return {
    id: 'default-road',
    name: 'My First Bike',
    vehicleType: 'bike',
    frame: 'carbon-road',
    wheels: 'alloy-training',
    tires: 'allroad-28',
    position: 'hoods',
    color: '#c0392b',
    accentColor: '#2c3e50',
    sprays: [] // decal ids applied to the vehicle
  };
}

export function makeBike(name = 'New Build') {
  return { ...defaultBike(), id: uid(), name, sprays: [] };
}

export function wheelCount(bike) {
  return (VEHICLE_TYPES[bike.vehicleType] || VEHICLE_TYPES.bike).wheels.length;
}

export function computeBikeSpec(bike) {
  const frame = FRAMES[bike.frame] || FRAMES['carbon-road'];
  const wheels = WHEELS[bike.wheels] || WHEELS['alloy-training'];
  const tires = TIRES[bike.tires] || TIRES['allroad-28'];
  const position = POSITIONS[bike.position] || POSITIONS.hoods;
  const vt = VEHICLE_TYPES[bike.vehicleType] || VEHICLE_TYPES.bike;
  const n = vt.wheels.length;

  // wheel & tyre masses are quoted per pair; scale to actual wheel count.
  const perWheel = (wheels.mass + tires.mass) / 2;
  const mass = frame.mass + perWheel * n + FIXED_KIT_MASS + vt.extraMass;
  const cd = Math.max(0.45, frame.cd + wheels.cdMod + (n - 2) * 0.04);

  return {
    massKg: Math.max(3, mass),
    crr: tires.crr,
    cd,
    areaScale: position.areaScale,
    drivetrainEfficiency: DRIVETRAIN_EFFICIENCY,
    kind: frame.kind,
    wheelCount: n
  };
}

export const partsByTheme = (catalog, theme) =>
  Object.entries(catalog).filter(([, v]) => !theme || v.theme === theme).map(([value, v]) => ({ value, label: v.label, theme: v.theme }));
