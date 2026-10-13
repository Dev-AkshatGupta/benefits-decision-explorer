import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/app/providers/app-providers';
import { App } from '@/app/app';
import '@/styles/globals.css';
async function bootstrap() {
  if (import.meta.env.DEV) {
    const { worker } = await import('@/mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  }
  const container = document.getElementById('root');
  if (!container) throw new Error('Application root element is missing.');
  createRoot(container).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  );
}
void bootstrap().catch(() => {
  const root = document.getElementById('root');
  if (root)
    root.textContent =
      'Unable to start Benefits Decision Explorer. Please reload the page.';
});
