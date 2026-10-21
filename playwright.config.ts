import { defineConfig } from '@playwright/test';

// End-to-end tests: a real browser clicks through the real site.
// The dev server runs in "this device only" mode (Firebase and Supabase switched off), so
// multiplayer works between tabs with no accounts or network. Run: pnpm e2e

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // On your own computer use the installed Chrome; CI downloads Playwright's Chromium.
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_DATABASE_URL: '',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_RECAPTCHA_SITE_KEY: '',
      VITE_SENTRY_DSN: '',
    },
  },
});
