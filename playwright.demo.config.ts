import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testDir: './deployment',
  workers: 1,
  timeout: 60_000,
  use: {
    ...base.use,
    baseURL: process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:4175',
  },
  webServer: process.env.DEMO_BASE_URL
    ? []
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
        url: 'http://127.0.0.1:4175',
        reuseExistingServer: !process.env.CI,
      },
});
