import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/app/providers/app-providers';
import { App } from '@/app/app';
import '@fontsource-variable/dm-sans';
import '@/styles/globals.css';
import { resolveDemoMode, DemoConfigurationError } from '@/app/demo/demo-mode';

async function bootstrap() {
  const demoMode = resolveDemoMode(
    import.meta.env.VITE_DEMO_MODE,
    import.meta.env.DEV,
  );
  // Keep this condition statically analyzable so non-demo builds exclude mock repositories.
  if (
    import.meta.env.VITE_DEMO_MODE === 'true' ||
    (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'false')
  ) {
    const { worker } = await import('@/mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: {
        url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
        options: { scope: import.meta.env.BASE_URL },
      },
    });
  }
  const container = document.getElementById('root');
  if (!container) throw new Error('Application root element is missing.');
  createRoot(container).render(
    <StrictMode>
      <AppProviders demoMode={demoMode}>
        <App />
      </AppProviders>
    </StrictMode>,
  );
}
void bootstrap().catch((error: unknown) => {
  const container = document.getElementById('root');
  if (container)
    container.textContent =
      error instanceof DemoConfigurationError
        ? error.message
        : 'Unable to start Benefits Decision Explorer. Please reload the page.';
});
