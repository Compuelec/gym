import { defineConfig } from 'vitest/config';

// Unit and integration tests for every package and app; e2e lives in Playwright.
export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'apps/api',
      {
        extends: './apps/web/vite.config.ts',
        test: { name: 'web', root: './apps/web', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
      },
    ],
  },
});
