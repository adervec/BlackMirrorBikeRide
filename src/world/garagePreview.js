// A small standalone 3D viewer for the garage: shows the active rider on the
// active bike, lit & shadowed, wheels spinning and legs pedalling as in-game.
// Drag to rotate; it auto-spins when idle.

import * as THREE from 'three';
import { buildAvatar } from './avatar.js';
import { getState } from '../state.js';
import { resolveQuality } from './quality.js';
import { gradientEnvironment, applyAnisotropy, maxAnisotropyFor } from './gfx.js';

export class GaragePreview {
  constructor(container) {
    this.container = container;
    this.q = resolveQuality(getState().settings.graphicsQuality);
    this.renderer = new THREE.WebGLRenderer({ antialias: this.q.antialias !== false, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatioCap));
    this.renderer.shadowMap.enabled = this.q.shadows !== false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this._size();
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Image-based lighting so metallic / clearcoat bike paint reflects its surroundings.
    if (this.q.env) {
      this.envTex = gradientEnvironment(this.renderer, 0xbfd4ff, 0x4a4030);
      this.scene.environment = this.envTex;
    }
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(2.5, 1.7, 3.0);
    this.camera.lookAt(0, 0.92, 0);
    this.lookY = 0.92;

    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x4a4030, 0.8));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.4);
    sun.position.set(4, 7, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(Math.min(this.q.shadowMapSize, 2048), Math.min(this.q.shadowMapSize, 2048));
    sun.shadow.camera.left = -3; sun.shadow.camera.right = 3;
    sun.shadow.camera.top = 3; sun.shadow.camera.bottom = -3;
    sun.shadow.bias = -0.0007;
    this.scene.add(sun);

    // turntable floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x1a1f2b, roughness: 0.9, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    this.scene.add(floor);

    this.turntable = new THREE.Group();
    this.scene.add(this.turntable);

    this.autoRotate = true;
    this.dragging = false;
    this._lastX = 0;
    this._yaw = -0.9; // start with the rider's face toward the camera
    this._bindDrag();

    this.clock = new THREE.Clock();
    this._raf = null;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  _size() {
    const w = this.container.clientWidth || 360;
    const h = this.container.clientHeight || 360;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
  }

  _bindDrag() {
    const el = this.renderer.domElement;
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', (e) => { this.dragging = true; this.autoRotate = false; this._lastX = e.clientX; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', (e) => { if (!this.dragging) return; this._yaw += (e.clientX - this._lastX) * 0.01; this._lastX = e.clientX; });
    const end = () => { this.dragging = false; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointerleave', end);
  }

  setSubject({ rider, bike, player, decals = [] }) {
    if (this.avatar) { this.turntable.remove(this.avatar.group); disposeTree(this.avatar.group); }
    this.avatar = buildAvatar({ rider, bike, player, decals });
    // center the model around origin-ish
    this.avatar.group.position.set(0, 0, 0);
    applyAnisotropy(this.avatar.group, maxAnisotropyFor(this.renderer, this.q));
    this.turntable.add(this.avatar.group);
  }

  start() {
    if (this._raf) return;
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (this.autoRotate && !this.dragging) this._yaw += dt * 0.5;
      this.turntable.rotation.y = this._yaw;
      if (this.avatar) this.avatar.update({ speed: 6, cadence: 75, dt });
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    if (this.avatar) disposeTree(this.avatar.group);
    if (this.envTex) { this.envTex.dispose?.(); this.envTex = null; }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose?.();
    if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); }
  });
}
