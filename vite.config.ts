import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { resolveDemoMode } from './src/app/demo/demo-mode.ts';
export default defineConfig(({ mode }) => {
  const flag = loadEnv(mode, process.cwd(), 'VITE_DEMO_MODE').VITE_DEMO_MODE;
  resolveDemoMode(flag, mode === 'development');
  if (mode === 'demo' && flag !== 'true')
    throw new Error('The demo build requires VITE_DEMO_MODE=true.');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
      maxWorkers: 4,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: [
          'src/features/eligibility/{components,pages,ui}/**/*.{ts,tsx}',
        ],
        exclude: ['**/*.test.{ts,tsx}', '**/*.bench.ts'],
        reportsDirectory: './coverage/screening',
        reporter: ['text', 'html', 'json-summary'],
      },
    },
  };
});
