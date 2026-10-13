import { it, expect } from 'vitest';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { DemoModeContext } from './demo-context';
import { DemoBanner } from './demo-banner';
function setup(enabled = true, path = '/dashboard') {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <DemoModeContext.Provider value={enabled}>
        <MemoryRouter initialEntries={[path]}>
          <DemoBanner />
        </MemoryRouter>
      </DemoModeContext.Provider>
    </QueryClientProvider>,
  );
  return client;
}
it('hides reset controls outside demo mode', () => {
  const client = setup(false);
  expect(
    screen.queryByRole('button', { name: 'Reset demo data' }),
  ).not.toBeInTheDocument();
  client.clear();
});
it('cancels confirmation without sending a reset request', async () => {
  let requests = 0;
  server.use(
    http.post('/api/demo/reset', () => {
      requests++;
      return HttpResponse.json({});
    }),
  );
  const client = setup(),
    user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
  const dialog = screen.getByRole('dialog', {
    name: 'Reset demonstration data?',
  });
  await user.click(
    within(dialog).getByRole('button', { name: 'Keep current data' }),
  );
  expect(requests).toBe(0);
  client.clear();
});
it('reports a reset failure without clearing cached data or navigating', async () => {
  server.use(
    http.post('/api/demo/reset', () => HttpResponse.json({}, { status: 503 })),
  );
  const client = setup(),
    user = userEvent.setup();
  client.setQueryData(['sentinel'], { retained: true });
  await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
  await user.click(screen.getByRole('button', { name: 'Confirm reset' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Reset could not be confirmed',
  );
  expect(client.getQueryData(['sentinel'])).toEqual({ retained: true });
  client.clear();
});
it('announces completed restoration on the return route', () => {
  const client = setup(true, '/dashboard?demoReset=complete');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Demonstration data restored',
  );
  client.clear();
});
it('blocks resets while another save is pending and enables them after it settles', async () => {
  const client = setup();
  let finish: (() => void) | undefined;
  const mutation = client.getMutationCache().build(client, {
    mutationFn: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  });
  let pending: Promise<void> | undefined;
  act(() => {
    pending = mutation.execute(undefined);
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Reset demo data' }),
    ).toBeDisabled(),
  );
  await act(async () => {
    finish?.();
    await pending;
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Reset demo data' }),
    ).toBeEnabled(),
  );
  client.clear();
});
