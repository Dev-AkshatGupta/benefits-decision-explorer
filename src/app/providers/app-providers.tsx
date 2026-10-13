import { useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { retryApiRead } from '@/lib/api/query-retry';
import { DemoModeContext } from '../demo/demo-context';
import { resolveDemoMode } from '../demo/demo-mode';
export function AppProviders({
  children,
  demoMode = resolveDemoMode(
    import.meta.env.VITE_DEMO_MODE,
    import.meta.env.DEV,
  ),
}: PropsWithChildren<{ demoMode?: boolean }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, gcTime: 300_000, retry: retryApiRead },
        },
      }),
  );
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DemoModeContext.Provider value={demoMode}>
          {children}
        </DemoModeContext.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
