import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/features/eligibility/tests/**/*.test.ts'],
    benchmark: { include: ['src/features/eligibility/tests/**/*.bench.ts'] },
    coverage: {
      provider: 'v8',
      include: ['src/features/eligibility/{engine,domain,policies}/**/*.ts'],
      exclude: ['src/features/eligibility/domain/types.ts'],
      reportsDirectory: './coverage/eligibility',
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
    restoreMocks: true,
  },
});
