/**
 * Test configuration.
 *
 * Separate from `vite.config.ts` so the build config stays free of test-only
 * settings, and so a change to the build target cannot silently alter what the
 * tests run against.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
