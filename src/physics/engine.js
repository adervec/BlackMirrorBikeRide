// Cycling physics. Converts measured rider power into motion using a standard
// force balance, integrated with inertia so the bike accelerates, coasts and
// crawls up climbs realistically.
//
//   Propulsion:  Fp = P · η / v        (capped near standstill for stability)
//   Gravity:     Fg = m · g · sinθ
//   Rolling:     Fr = Crr · m · g · cosθ
//   Aero:        Fa = ½ · ρ · CdA · v²   (no wind/drafting per spec)
//
//   a = (Fp − Fg − Fr − Fa) / m_eff,  with m_eff including wheel rotation.
//
// Per spec: air resistance is a constant set per route (defaulted to an Ontario
// average) — there is no wind or drafting model.

import { computeFrontalArea } from '../profile/rider.js';

const G = 9.80665;

// Compose the rider's drag area from biometrics + bike (frame Cd + position).
export function computeCdA(profile, bikeSpec) {
  const area = computeFrontalArea(profile);
  return area * bikeSpec.cd * bikeSpec.areaScale;
}

export function totalMass(profile, bikeSpec) {
  return profile.weightKg + bikeSpec.massKg;
}

export function createPhysics({ massKg, cda, airDensity, drivetrainEfficiency, rotatingMassKg = 1.5 }) {
  const cfg = {
    massKg,
    cda,
    airDensity,
    eta: drivetrainEfficiency,
    mEff: massKg + rotatingMassKg
  };

  return {
    config: cfg,

    update(partial) {
      Object.assign(cfg, partial);
      cfg.mEff = cfg.massKg + rotatingMassKg;
    },

    // Advance speed by dt. Returns detailed force breakdown for debugging/telemetry.
    step(v, power, gradientRatio, crr, dt) {
      // Clamp dt and substep for numerical stability on big frames.
      const h = Math.min(0.1, Math.max(0.001, dt));
      const theta = Math.atan(gradientRatio || 0);
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      const subs = h > 0.05 ? 4 : 1;
      const sh = h / subs;
      let speed = Math.max(0, v);

      const m = cfg.massKg;
      const Fg = m * G * sinT;
      const Fr0 = crr * m * G * cosT;

      let Fp = 0, Fa = 0, Fr = 0, aLast = 0;
      for (let i = 0; i < subs; i++) {
        // Propulsive force. Near standstill v->0 makes P/v explode, so floor the
        // speed used for force and cap traction at ~0.55 g (can't launch harder).
        const vForForce = Math.max(speed, 1.2);
        Fp = (power * cfg.eta) / vForForce;
        const Fpmax = 0.55 * m * G;
        if (Fp > Fpmax) Fp = Fpmax;

        Fa = 0.5 * cfg.airDensity * cfg.cda * speed * speed;
        Fr = speed > 0.02 ? Fr0 : 0; // rolling resistance only when rolling

        const Fnet = Fp - Fg - Fr - Fa;
        const a = Fnet / cfg.mEff;
        aLast = a;
        speed += a * sh;
        if (speed < 0) speed = 0; // the sim never rolls backwards; rider stalls
      }

      return { v: speed, a: aLast, Fp, Fg, Fr, Fa };
    }
  };
}
