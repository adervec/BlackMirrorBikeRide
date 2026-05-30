// Catalogue of every stat the HUD can show, plus the default layout.
//
// Each reading maps to a field on the live telemetry object (see session.js)
// and a measurement `type` used by the units system. A few readings use
// special types handled directly by the HUD renderer:
//   'time'  -> hh:mm:ss formatting
//   'wkg'   -> watts per kilogram (no unit conversion)
//   'text'  -> raw string (e.g. surface name)

export const READINGS = {
  power:           { label: 'Power',          type: 'power',       field: 'power' },
  power3s:         { label: 'Power (3s)',      type: 'power',       field: 'power3s' },
  avgPower:        { label: 'Avg Power',       type: 'power',       field: 'avgPower' },
  normPower:       { label: 'Norm. Power',     type: 'power',       field: 'normPower' },
  maxPower:        { label: 'Max Power',       type: 'power',       field: 'maxPower' },
  wkg:             { label: 'W / kg',          type: 'wkg',         field: 'wkg' },
  speed:           { label: 'Speed',           type: 'speed',       field: 'speed' },
  avgSpeed:        { label: 'Avg Speed',       type: 'speed',       field: 'avgSpeed' },
  maxSpeed:        { label: 'Max Speed',       type: 'speed',       field: 'maxSpeed' },
  cadence:         { label: 'Cadence',         type: 'cadence',     field: 'cadence' },
  heartRate:       { label: 'Heart Rate',      type: 'heartRate',   field: 'heartRate' },
  distance:        { label: 'Distance',        type: 'distance',    field: 'distance' },
  distanceRemaining:{ label: 'Dist. Remaining', type: 'distance',   field: 'distanceRemaining' },
  time:            { label: 'Elapsed',         type: 'time',        field: 'time' },
  timeRemaining:   { label: 'Time Left (est)', type: 'time',        field: 'timeRemaining' },
  gradient:        { label: 'Gradient',        type: 'gradient',    field: 'gradient' },
  altitude:        { label: 'Altitude',        type: 'distance',    field: 'altitude' },
  ascent:          { label: 'Ascent',          type: 'distance',    field: 'ascent' },
  descent:         { label: 'Descent',         type: 'distance',    field: 'descent' },
  energy:          { label: 'Energy',          type: 'energy',      field: 'energy' },
  surface:         { label: 'Surface',         type: 'text',        field: 'surface' },
  temperature:     { label: 'Air Temp',        type: 'temperature', field: 'temperature' },
  progress:        { label: 'Progress',        type: 'text',        field: 'progressText' },
  nextTurn:        { label: 'Next Turn',       type: 'text',        field: 'nextTurn' }
};

// Ordered layout. `visible` toggles display; `unit` overrides the global
// per-measurement unit for just this reading (the "per reading" requirement).
export const DEFAULT_HUD_LAYOUT = [
  { id: 'power',             visible: true,  unit: null },
  { id: 'wkg',               visible: true,  unit: null },
  { id: 'speed',             visible: true,  unit: null },
  { id: 'cadence',           visible: true,  unit: null },
  { id: 'heartRate',         visible: true,  unit: null },
  { id: 'distance',          visible: true,  unit: null },
  { id: 'distanceRemaining', visible: true,  unit: null },
  { id: 'time',              visible: true,  unit: null },
  { id: 'timeRemaining',     visible: true,  unit: null },
  { id: 'gradient',          visible: true,  unit: null },
  { id: 'surface',           visible: true,  unit: null },
  { id: 'altitude',          visible: true,  unit: null },
  { id: 'ascent',            visible: false, unit: null },
  { id: 'descent',           visible: false, unit: null },
  { id: 'avgPower',          visible: false, unit: null },
  { id: 'power3s',           visible: false, unit: null },
  { id: 'normPower',         visible: false, unit: null },
  { id: 'maxPower',          visible: false, unit: null },
  { id: 'avgSpeed',          visible: true,  unit: null },
  { id: 'maxSpeed',          visible: false, unit: null },
  { id: 'energy',            visible: true,  unit: null },
  { id: 'temperature',       visible: false, unit: null },
  { id: 'nextTurn',          visible: true,  unit: null }
];
