import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './deployment/pages',
  workers: 1,
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:4176/benefits-decision-explorer/',
  },
  webServer: {
    command: 'node scripts/serve-pages-preview.mjs',
    url: 'http://127.0.0.1:4176/benefits-decision-explorer/',
    reuseExistingServer: !process.env.CI,
  },
});
