/**
 * Build configuration.
 *
 * Two things here are requirements rather than preferences.
 *
 * `base` is `/dashboard/` because the bundle is served from a subpath of the
 * GitHub Pages site, alongside the public landing site (20-12). Assets resolved
 * from the root would 404 in production and work perfectly in dev, which is the
 * worst possible failure mode.
 *
 * The browser target covers roughly the last three years (TRD-TCH-004). School
 * laptops run browsers several versions behind, and a blank white page from an
 * unsupported syntax is indistinguishable from "this product does not work" —
 * with no way for a teacher to tell the difference.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/dashboard/',
  plugins: [react()],
  build: {
    target: ['chrome109', 'edge109', 'firefox115', 'safari16'],
    // The budget in TRD-TCH-003 is 200 KB gzipped for the initial bundle; this
    // warns well before that, since the reported figure here is uncompressed.
    chunkSizeWarningLimit: 400,
    sourcemap: true,
  },
});
