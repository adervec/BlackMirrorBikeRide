import { defineConfig } from 'vite';

// Plain ESM app. The dev server must be reachable over https for Web Bluetooth
// on some setups, but http://localhost is treated as a secure context by Chrome,
// so the default dev server works for sensor pairing during development.
export default defineConfig({
  // Allow CI to set VITE_BASE=/BlackMirrorBikeRide/ for GitHub Pages deployments.
  // Local dev (and any other host) keeps the default '/'.
  base: process.env.VITE_BASE ?? '/',
  root: '.',
  server: {
    host: 'localhost',
    port: 5173,
    open: true
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true
  }
});
