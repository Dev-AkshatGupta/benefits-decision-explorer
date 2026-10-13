import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vite.config.ts';
export default defineConfig((env) =>
  mergeConfig(
    base(env),
    defineConfig({
      test: {
        coverage: {
          include: ['src/**/*.{ts,tsx}'],
          exclude: [
            '**/*.test.{ts,tsx}',
            '**/*.bench.ts',
            'src/mocks/**',
            'src/test/**',
          ],
          reportsDirectory: './coverage/all',
        },
      },
    }),
  ),
);
