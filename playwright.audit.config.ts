import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testDir: './audit',
  testMatch: process.env.PRODUCTION_PREVIEW
    ? '**/production.spec.ts'
    : ['**/performance.spec.ts', '**/accessibility.spec.ts'],
  fullyParallel: false,
  workers: 1,
  projects: [
    { name: 'audit', use: { viewport: { width: 1440, height: 900 } } },
  ],
  timeout: 120_000,
  ...(process.env.PRODUCTION_PREVIEW
    ? {
        use: { ...base.use, baseURL: 'http://127.0.0.1:4174' },
        webServer: {
          command:
            'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
          url: 'http://127.0.0.1:4174',
          reuseExistingServer: !process.env.CI,
        },
      }
    : {}),
});
