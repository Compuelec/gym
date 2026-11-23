import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./tests/helpers/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://gym:gym@localhost:55432/gym_test',
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-0123',
      BETTER_AUTH_URL: 'http://localhost:5173',
      LOG_LEVEL: 'silent',
      // Test-only master key (32 bytes).
      PUSH_EXTRA_HOSTS: 'push.example',
      APP_ENCRYPTION_KEY: 'dGVzdC1tYXN0ZXIta2V5LTMyLWJ5dGVzLWxvbmctMDE=',
    },
    // Integration tests share one disposable database; keep files sequential for determinism.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
