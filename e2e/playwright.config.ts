import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production-like Docker stack (real Caddy + API + Postgres
// images, disposable data), never against production. Override with E2E_BASE_URL.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8088';

export default defineConfig({
  testDir: './tests',
  globalSetup: './fixtures/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'es-ES',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-android', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-ios', use: { ...devices['iPhone 15'] } },
  ],
});
