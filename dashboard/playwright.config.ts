/**
 * End-to-end configuration for the teacher dashboard.
 *
 * **Driven against intercepted RPCs rather than a live server, deliberately.**
 * The backend lives in a different repository with its own Docker stack, and
 * coupling this repo's CI to it would mean the dashboard could not be tested
 * without standing up Nakama and Postgres — which on a pull request is minutes
 * of setup to answer a question about a React route.
 *
 * What that trades away is stated rather than hidden: these tests cannot catch
 * a contract drifting between the dashboard and the server. That is what the
 * backend's integration suite is for, and it exercises the same RPCs against a
 * real Nakama. What these tests *can* catch is the half nothing else covers —
 * whether a teacher can get from signing in to a named student's evidence, and
 * whether the pages they pass through are usable with a keyboard and a screen
 * reader.
 *
 * Chromium only. The dashboard's audience is a school laptop, and running three
 * engines to learn the same thing three times is time a pull request spends
 * waiting.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Generous, because CI runners are slow and a flaky timeout teaches people to
  // rerun the job rather than read it.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // The built bundle, not the dev server: what a teacher loads is the build,
    // and a dev-only transform that breaks in production would pass otherwise.
    command: 'npm run build && npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Placeholders. Nothing here reaches a network — every request is
      // intercepted — and a real endpoint in a test config is a real endpoint
      // in a public repository.
      VITE_NAKAMA_HOST: 'e2e.invalid',
      VITE_NAKAMA_SERVER_KEY: 'e2e',
      VITE_VERIFIER_URL: 'https://e2e.invalid',
    },
  },
});
