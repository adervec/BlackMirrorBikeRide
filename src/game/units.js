// Units system.
//
// Every physical quantity in the game is stored & computed in SI base units.
// This module converts a base value into whatever (possibly deeply obscure)
// unit the user has chosen, either globally per measurement-type, or overridden
// per individual HUD reading.
//
// A "unit" is a pair of pure functions to/from the base unit so we can express
// non-linear units (temperature, gradient as an angle) just as easily as scaled
// ones.

const linear = (factor, symbol, label, decimals = 1) => ({
  label,
  symbol,
  decimals,
  toBase: (v) => v / factor,
  fromBase: (v) => v * factor
});

// type -> { base, label, units: {id: unitDef}, presets }
export const MEASUREMENTS = {
  speed: {
    label: 'Speed',
    base: 'm/s',
    units: {
      kmh: linear(3.6, 'km/h', 'Kilometres / hour'),
      mph: linear(2.2369362920544, 'mph', 'Miles / hour'),
      ms: linear(1, 'm/s', 'Metres / second', 2),
      knot: linear(1.9438444924406, 'kn', 'Knots'),
      // 1 m/s ≈ 6012.885 furlongs per fortnight
      furlongFortnight: linear(6012.8848, 'fur/ftn', 'Furlongs / fortnight', 0)
    }
  },
  distance: {
    label: 'Distance',
    base: 'm',
    units: {
      km: linear(0.001, 'km', 'Kilometres', 2),
      mi: linear(0.00062137119224, 'mi', 'Miles', 2),
      m: linear(1, 'm', 'Metres', 0),
      ft: linear(3.280839895, 'ft', 'Feet', 0),
      furlong: linear(0.0049709695379, 'fur', 'Furlongs', 2),
      // 1 smoot = 1.7018 m (the Harvard Bridge unit)
      smoot: linear(0.587613, 'smoot', 'Smoots', 1)
    }
  },
  power: {
    label: 'Power',
    base: 'W',
    units: {
      w: linear(1, 'W', 'Watts', 0),
      kw: linear(0.001, 'kW', 'Kilowatts', 2),
      hp: linear(0.0013410220896, 'hp', 'Horsepower', 2),
      // playful obscure unit: ~250 W sustained equine-ish output
      donkeypower: linear(0.004, 'dkp', 'Donkeypower', 2)
    }
  },
  mass: {
    label: 'Weight',
    base: 'kg',
    units: {
      kg: linear(1, 'kg', 'Kilograms', 1),
      lb: linear(2.2046226218, 'lb', 'Pounds', 1),
      st: linear(0.15747304442, 'st', 'Stone', 2),
      g: linear(1000, 'g', 'Grams', 0)
    }
  },
  bodyLength: {
    label: 'Body length',
    base: 'm',
    units: {
      cm: linear(100, 'cm', 'Centimetres', 0),
      in: linear(39.3700787, 'in', 'Inches', 1),
      m: linear(1, 'm', 'Metres', 2),
      // 1 hand = 4 inches = 0.1016 m
      hand: linear(9.8425197, 'hh', 'Hands', 1)
    }
  },
  gradient: {
    label: 'Gradient',
    base: 'ratio', // rise / run
    units: {
      percent: { label: 'Percent', symbol: '%', decimals: 1, toBase: (v) => v / 100, fromBase: (v) => v * 100 },
      permille: { label: 'Per-mille', symbol: '‰', decimals: 1, toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      degrees: {
        label: 'Degrees',
        symbol: '°',
        decimals: 1,
        toBase: (v) => Math.tan((v * Math.PI) / 180),
        fromBase: (v) => (Math.atan(v) * 180) / Math.PI
      },
      ratio: { label: 'Ratio (1:x)', symbol: '', decimals: 3, toBase: (v) => v, fromBase: (v) => v }
    }
  },
  cadence: {
    label: 'Cadence',
    base: 'rpm',
    units: { rpm: linear(1, 'rpm', 'Revolutions / minute', 0) }
  },
  heartRate: {
    label: 'Heart rate',
    base: 'bpm',
    units: { bpm: linear(1, 'bpm', 'Beats / minute', 0) }
  },
  temperature: {
    label: 'Temperature',
    base: 'C',
    units: {
      c: linear(1, '°C', 'Celsius', 1),
      f: { label: 'Fahrenheit', symbol: '°F', decimals: 1, toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
      k: { label: 'Kelvin', symbol: 'K', decimals: 1, toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 }
    }
  },
  energy: {
    label: 'Energy',
    base: 'J',
    units: {
      kj: linear(0.001, 'kJ', 'Kilojoules', 0),
      kcal: linear(0.00023900573614, 'kcal', 'Kilocalories', 0),
      wh: linear(0.00027777778, 'Wh', 'Watt-hours', 1)
    }
  },
  area: {
    label: 'Area',
    base: 'm²',
    units: {
      m2: linear(1, 'm²', 'Square metres', 3),
      cm2: linear(10000, 'cm²', 'Square centimetres', 0),
      ft2: linear(10.763910417, 'ft²', 'Square feet', 2)
    }
  }
};

// Default per-measurement unit selection (sensible cycling-app defaults).
export const DEFAULT_UNIT_PREFS = {
  speed: 'kmh',
  distance: 'km',
  power: 'w',
  mass: 'kg',
  bodyLength: 'cm',
  gradient: 'percent',
  cadence: 'rpm',
  heartRate: 'bpm',
  temperature: 'c',
  energy: 'kcal',
  area: 'm2'
};

export const UNIT_PRESETS = {
  metric: {
    speed: 'kmh', distance: 'km', power: 'w', mass: 'kg', bodyLength: 'cm',
    gradient: 'percent', temperature: 'c', energy: 'kj', area: 'm2'
  },
  imperial: {
    speed: 'mph', distance: 'mi', power: 'w', mass: 'lb', bodyLength: 'in',
    gradient: 'percent', temperature: 'f', energy: 'kcal', area: 'ft2'
  },
  bizarre: {
    speed: 'furlongFortnight', distance: 'smoot', power: 'donkeypower', mass: 'st',
    bodyLength: 'hand', gradient: 'permille', temperature: 'k', energy: 'wh', area: 'cm2'
  }
};

export function applyPreset(prefs, presetName) {
  const preset = UNIT_PRESETS[presetName];
  if (!preset) return prefs;
  return { ...prefs, ...preset };
}

function unitDef(type, unitId) {
  const m = MEASUREMENTS[type];
  if (!m) return null;
  return m.units[unitId] || m.units[Object.keys(m.units)[0]];
}

// Convert an SI base value to the chosen unit's number (no formatting).
export function toUnit(type, baseValue, unitId) {
  const def = unitDef(type, unitId);
  return def ? def.fromBase(baseValue) : baseValue;
}

// Convert a displayed unit value back to SI base (for input fields).
export function fromUnit(type, displayValue, unitId) {
  const def = unitDef(type, unitId);
  return def ? def.toBase(displayValue) : displayValue;
}

export function unitSymbol(type, unitId) {
  const def = unitDef(type, unitId);
  return def ? def.symbol : '';
}

// Format a base value for display. `prefs` is the per-type selection map;
// `override` lets a single reading pick its own unit id.
export function format(type, baseValue, prefs, override = null) {
  if (baseValue === null || baseValue === undefined || Number.isNaN(baseValue)) {
    return { value: '—', symbol: '', unitId: override || prefs?.[type] };
  }
  const unitId = override || prefs?.[type] || DEFAULT_UNIT_PREFS[type];
  const def = unitDef(type, unitId);
  if (!def) return { value: String(baseValue), symbol: '', unitId };
  const n = def.fromBase(baseValue);
  return {
    value: n.toFixed(def.decimals),
    symbol: def.symbol,
    unitId,
    label: def.label
  };
}

// Convenience for HUD: "32.4 km/h"
export function formatString(type, baseValue, prefs, override = null) {
  const f = format(type, baseValue, prefs, override);
  return f.symbol ? `${f.value} ${f.symbol}` : f.value;
}

// Time is special: stored as seconds, displayed hh:mm:ss.
export function formatTime(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function unitOptions(type) {
  const m = MEASUREMENTS[type];
  if (!m) return [];
  return Object.entries(m.units).map(([id, def]) => ({ id, label: def.label, symbol: def.symbol }));
}
