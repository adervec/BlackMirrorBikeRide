// Camera rig. Modes cover the spec's required views:
//   chase   - third person behind the rider, looking forward (default)
//   rear    - ahead of the rider looking back at the oncoming bike avatar
//   left    - pan out to the left scenery (avatar hidden)
//   right   - pan out to the right scenery (avatar hidden)
//   cockpit - first person (avatar hidden)

import * as THREE from 'three';

export const CAMERA_MODES = ['chase', 'rear', 'left', 'right', 'cockpit'];
export const CAMERA_LABELS = {
  chase: 'Chase', rear: 'Oncoming (rear)', left: 'Left Pan', right: 'Right Pan', cockpit: 'Cockpit'
};

export class CameraRig {
  constructor() {
    this.mode = 'chase';
    this._pos = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._init = false;
  }

  setMode(m) { if (CAMERA_MODES.includes(m)) this.mode = m; }
  cycle(dir = 1) {
    const i = CAMERA_MODES.indexOf(this.mode);
    this.mode = CAMERA_MODES[(i + dir + CAMERA_MODES.length) % CAMERA_MODES.length];
    return this.mode;
  }

  avatarVisible() { return this.mode === 'chase' || this.mode === 'rear'; }

  // rider: { pos: Vector3-like, heading } ; updates `camera` in place.
  update(camera, rider, dt) {
    const p = rider.pos;
    const h = rider.heading;
    const fwd = new THREE.Vector3(Math.cos(h), 0, Math.sin(h));
    const lat = new THREE.Vector3(-Math.sin(h), 0, Math.cos(h));
    const up = new THREE.Vector3(0, 1, 0);
    const base = new THREE.Vector3(p.x, p.y, p.z);

    const desiredPos = new THREE.Vector3();
    const desiredTgt = new THREE.Vector3();

    switch (this.mode) {
      case 'rear':
        desiredPos.copy(base).addScaledVector(fwd, 7).addScaledVector(up, 2.2);
        desiredTgt.copy(base).addScaledVector(up, 1.0);
        break;
      case 'left':
        desiredPos.copy(base).addScaledVector(up, 1.6).addScaledVector(lat, 1.0);
        desiredTgt.copy(base).addScaledVector(lat, 12).addScaledVector(up, 0.8);
        break;
      case 'right':
        desiredPos.copy(base).addScaledVector(up, 1.6).addScaledVector(lat, -1.0);
        desiredTgt.copy(base).addScaledVector(lat, -12).addScaledVector(up, 0.8);
        break;
      case 'cockpit':
        desiredPos.copy(base).addScaledVector(up, 1.35).addScaledVector(fwd, 0.25);
        desiredTgt.copy(base).addScaledVector(fwd, 12).addScaledVector(up, 1.1);
        break;
      case 'chase':
      default:
        desiredPos.copy(base).addScaledVector(fwd, -6).addScaledVector(up, 2.7);
        desiredTgt.copy(base).addScaledVector(fwd, 5).addScaledVector(up, 0.8);
        break;
    }

    if (!this._init) {
      this._pos.copy(desiredPos); this._target.copy(desiredTgt); this._init = true;
    } else {
      // Smooth follow for chase/rear, snappier for side/cockpit.
      const k = (this.mode === 'chase' || this.mode === 'rear') ? 1 - Math.pow(0.001, dt) : 1 - Math.pow(1e-6, dt);
      this._pos.lerp(desiredPos, k);
      this._target.lerp(desiredTgt, k);
    }
    camera.position.copy(this._pos);
    camera.lookAt(this._target);
  }
}
