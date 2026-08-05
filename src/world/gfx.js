// Shared higher-end rendering helpers, reused by the ride world and the garage
// preview: image-based lighting, anisotropic texture filtering, and a bloom
// post-processing chain. Kept separate so both renderers stay consistent.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Image-based lighting from a vertical gradient (matching the sky dome), baked
// into a PMREM environment map. Gives PBR materials realistic ambient irradiance
// and — on metallic/clearcoat surfaces like bike paint — actual reflections.
// Returns the env texture; caller assigns it to `scene.environment` and disposes
// it on teardown.
export function gradientEnvironment(renderer, top = 0x9fc4ff, bottom = 0x2b3340) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      bottom: { value: new THREE.Color(bottom) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.25, 0.7, h)), 1.0); }',
  });
  scene.add(new THREE.Mesh(geo, mat));
  const target = pmrem.fromScene(scene);
  geo.dispose();
  mat.dispose();
  pmrem.dispose();
  return target.texture;
}

// Crank texture filtering to the hardware max (capped by the quality preset) so
// road / skin / decal textures stay sharp at grazing angles. Cheap, clear win.
export function applyAnisotropy(root, maxAniso) {
  if (!root || !maxAniso) return;
  const keys = ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'aoMap'];
  root.traverse((o) => {
    if (!o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      for (const k of keys) {
        const tex = m[k];
        // Only flag a re-upload when the value actually changes: surface textures
        // are cached and shared across scene rebuilds.
        if (tex && tex.isTexture && tex.anisotropy !== maxAniso) {
          tex.anisotropy = maxAniso;
          tex.needsUpdate = true;
        }
      }
    }
  });
}

// Resolve the effective max anisotropy for a renderer under a quality preset.
export function maxAnisotropyFor(renderer, preset) {
  return Math.min(preset.anisotropy || 1, renderer.capabilities.getMaxAnisotropy());
}

// Build a bloom post-processing chain: RenderPass -> UnrealBloomPass -> OutputPass.
// OutputPass applies the renderer's tone mapping + sRGB at the very end, so bloom
// operates in linear/HDR space and the glow on emissive / neon surfaces reads as
// real light rather than a washed-out overlay.
export function makeBloomComposer(renderer, scene, camera, preset, w, h) {
  const width = Math.max(2, w | 0);
  const height = Math.max(2, h | 0);
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(width, height),
    preset.bloomStrength ?? 0.5,
    preset.bloomRadius ?? 0.4,
    preset.bloomThreshold ?? 0.7,
  ));
  composer.addPass(new OutputPass());
  return composer;
}
