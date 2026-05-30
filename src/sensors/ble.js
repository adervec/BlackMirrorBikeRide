// Web Bluetooth readers for the standard fitness GATT services. This is exactly
// how a Schwinn 130 (and essentially every smart trainer / power meter / HR
// strap) advertises its data, so the same code Zwift relies on works here.
//
//   Cycling Power      0x1818  measurement char 0x2A63 (instantaneous W, cadence)
//   Fitness Machine    0x1826  Indoor Bike Data char 0x2AD2 (speed/cadence/power)
//   Heart Rate         0x180D  measurement char 0x2A37
//   Cycling Speed/Cad. 0x1816  measurement char 0x2A5B
//
// Each connect* function returns a handle { device, disconnect() } and pushes
// parsed values to the provided callback.

export const BLE_SUPPORTED = typeof navigator !== 'undefined' && !!navigator.bluetooth;

const UUID = {
  cyclingPower: 0x1818,
  cyclingPowerMeasurement: 0x2a63,
  ftms: 0x1826,
  indoorBikeData: 0x2ad2,
  heartRate: 0x180d,
  heartRateMeasurement: 0x2a37,
  csc: 0x1816,
  cscMeasurement: 0x2a5b
};

async function startNotify(server, serviceUuid, charUuid, handler) {
  const service = await server.getPrimaryService(serviceUuid);
  const char = await service.getCharacteristic(charUuid);
  char.addEventListener('characteristicvaluechanged', (e) => handler(e.target.value));
  await char.startNotifications();
  return char;
}

// --- Cycling Power Measurement (0x2A63) ---------------------------------------
function parseCyclingPower(dv, prev) {
  const flags = dv.getUint16(0, true);
  let offset = 2;
  const instantaneousPower = dv.getInt16(offset, true); // signed watts
  offset += 2;

  if (flags & 0x01) offset += 1;        // pedal power balance
  if (flags & 0x04) offset += 2;        // accumulated torque
  if (flags & 0x10) offset += 6;        // wheel revolution data

  let cadence = null;
  if (flags & 0x20) {                   // crank revolution data present
    const cumCranks = dv.getUint16(offset, true);
    const lastEvt = dv.getUint16(offset + 2, true); // 1/1024 s
    if (prev && prev.cumCranks !== undefined) {
      let dRev = cumCranks - prev.cumCranks;
      let dt = lastEvt - prev.lastEvt;
      if (dRev < 0) dRev += 0x10000;
      if (dt < 0) dt += 0x10000;
      if (dt > 0) cadence = (dRev * 1024 * 60) / dt;
    }
    prev.cumCranks = cumCranks;
    prev.lastEvt = lastEvt;
  }
  return { power: instantaneousPower, cadence };
}

// --- FTMS Indoor Bike Data (0x2AD2) -------------------------------------------
function parseIndoorBike(dv) {
  const flags = dv.getUint16(0, true);
  let offset = 2;
  const out = { power: null, cadence: null, speed: null, heartRate: null };

  if (!(flags & 0x0001)) { out.speed = dv.getUint16(offset, true) / 100 / 3.6; offset += 2; } // km/h ->m/s
  if (flags & 0x0002) offset += 2;                                  // average speed
  if (flags & 0x0004) { out.cadence = dv.getUint16(offset, true) / 2; offset += 2; } // 0.5 rpm
  if (flags & 0x0008) offset += 2;                                  // average cadence
  if (flags & 0x0010) offset += 3;                                  // total distance (u24)
  if (flags & 0x0020) offset += 2;                                  // resistance level
  if (flags & 0x0040) { out.power = dv.getInt16(offset, true); offset += 2; }       // instantaneous power
  if (flags & 0x0080) offset += 2;                                  // average power
  if (flags & 0x0100) offset += 2;                                  // expended energy (total)
  // (further conditional fields omitted; we have what we need)
  if (flags & 0x0200) { /* heart rate */ }
  return out;
}

// --- Heart Rate Measurement (0x2A37) ------------------------------------------
function parseHeartRate(dv) {
  const flags = dv.getUint8(0);
  return (flags & 0x01) ? dv.getUint16(1, true) : dv.getUint8(1);
}

async function requestAndConnect(filters, optionalServices) {
  if (!BLE_SUPPORTED) throw new Error('Web Bluetooth is not available in this browser. Use Chrome or Edge.');
  const device = await navigator.bluetooth.requestDevice({ filters, optionalServices });
  const server = await device.gatt.connect();
  return { device, server };
}

// Connect a power source. Tries Cycling Power first, falls back to FTMS.
export async function connectPower(onData, onStatus = () => {}) {
  const { device, server } = await requestAndConnect(
    [{ services: [UUID.cyclingPower] }, { services: [UUID.ftms] }],
    [UUID.cyclingPower, UUID.ftms, UUID.csc]
  );
  device.addEventListener('gattserverdisconnected', () => onStatus('disconnected'));

  const prev = {};
  let char;
  try {
    char = await startNotify(server, UUID.cyclingPower, UUID.cyclingPowerMeasurement, (dv) => {
      onData(parseCyclingPower(dv, prev));
    });
    onStatus('connected', 'Cycling Power');
  } catch {
    char = await startNotify(server, UUID.ftms, UUID.indoorBikeData, (dv) => {
      onData(parseIndoorBike(dv));
    });
    onStatus('connected', 'FTMS Indoor Bike');
  }

  return {
    device,
    name: device.name || 'Power Source',
    disconnect: () => { try { char?.stopNotifications(); } catch {} device.gatt.disconnect(); }
  };
}

export async function connectHeartRate(onData, onStatus = () => {}) {
  const { device, server } = await requestAndConnect(
    [{ services: [UUID.heartRate] }],
    [UUID.heartRate]
  );
  device.addEventListener('gattserverdisconnected', () => onStatus('disconnected'));
  const char = await startNotify(server, UUID.heartRate, UUID.heartRateMeasurement, (dv) => {
    onData({ heartRate: parseHeartRate(dv) });
  });
  onStatus('connected', device.name || 'Heart Rate');
  return {
    device,
    name: device.name || 'Heart Rate',
    disconnect: () => { try { char?.stopNotifications(); } catch {} device.gatt.disconnect(); }
  };
}
