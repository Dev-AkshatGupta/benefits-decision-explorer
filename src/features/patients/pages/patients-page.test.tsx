import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { appRoutes } from '@/app/router/routes';
import { server } from '@/mocks/server';
import { mockDatabase } from '@/mocks/data/database';
import { getPatients } from '../api/patients-api';
const clients: QueryClient[] = [];
beforeEach(() =>
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: 1280 >= Number(query.match(/[0-9]+/)?.[0] ?? 0),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  }),
);
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
function renderWorklist(path = '/patients') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
const table = () => screen.getByRole('table');
const rows = () => within(table()).getAllByRole('row').slice(1);
async function ready(text = 'Showing 1–20 of 150 patients') {
  await screen.findByText(text);
}
describe('patient worklist', () => {
  it('keeps a selected coordinator visible if metadata fails and supports retry', async () => {
    server.use(
      http.get('/api/coordinators', () =>
        HttpResponse.json(
          { error: { code: 'INVALID_REQUEST', message: 'internal details' } },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWorklist('/patients?coordinatorId=coordinator-001');
    await ready('Showing 1–20 of 30 patients');
    expect(
      await screen.findByText('Coordinator filters are unavailable.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Care coordinator')).toHaveDisplayValue(
      'Selected coordinator',
    );
    expect(screen.queryByText('internal details')).not.toBeInTheDocument();
    server.resetHandlers();
    await user.click(
      screen.getByRole('button', { name: 'Retry coordinators' }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Care coordinator')).toHaveDisplayValue(
        'Morgan Chen',
      ),
    );
  });
  it('navigates to opaque IDs safely without treating them as URL syntax', async () => {
    const patient = mockDatabase.patients[0]!;
    const household = mockDatabase.households[0]!;
    patient.id = 'opaque/patient?';
    household.patientId = patient.id;
    const user = userEvent.setup();
    const router = renderWorklist('/patients?search=Avery+Alden');
    await ready('Showing 1–1 of 1 patients');
    await user.click(
      within(table()).getByRole('link', { name: 'View Avery Alden' }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Avery Alden' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(
      '/patients/opaque%2Fpatient%3F',
    );
  });
  it('does not show a false empty state while correcting an out-of-range page', async () => {
    const lastPage = await getPatients({
      page: 3,
      status: 'active',
      sortBy: 'lastUpdated',
      sortOrder: 'desc',
    });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/patients', async ({ request }) => {
        if (new URL(request.url).searchParams.get('page') === '999')
          return HttpResponse.json({
            data: [],
            pagination: {
              page: 999,
              pageSize: 20,
              totalItems: 50,
              totalPages: 3,
            },
          });
        await gate;
        return HttpResponse.json(lastPage);
      }),
    );
    const router = renderWorklist('/patients?page=999&status=active');
    await waitFor(() =>
      expect(
        new URLSearchParams(router.state.location.search).get('page'),
      ).toBe('3'),
    );
    expect(
      screen.getByRole('status', { name: 'Loading patients' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'No patients match your current filters.',
      }),
    ).not.toBeInTheDocument();
    release();
    await ready('Showing 41–50 of 50 patients');
  });
  it('renders API data and dataset-wide counts without fetching coordinators repeatedly', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    renderWorklist();
    await ready();
    expect(rows()).toHaveLength(20);
    expect(rows()[0]).toHaveTextContent('patient-028');
    const metrics = screen.getByRole('region', { name: 'Patient summary' });
    expect(await within(metrics).findByText('150')).toBeVisible();
    expect(within(metrics).getAllByText('50')).toHaveLength(2);
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByLabelText('Patient status'),
      'pending_review',
    );
    await ready('Showing 1–20 of 50 patients');
    expect(within(metrics).getByText('150')).toBeVisible();
    expect(rows().every((row) => within(row).getByText('Pending Review'))).toBe(
      true,
    );
    expect(
      spy.mock.calls.filter(([url]) => String(url) === '/api/coordinators'),
    ).toHaveLength(1);
  });
  it('searches names through the API, resets pagination, and preserves filters', async () => {
    const user = userEvent.setup();
    const router = renderWorklist('/patients?page=2&status=active');
    await ready('Showing 21–40 of 50 patients');
    await user.type(
      screen.getByRole('textbox', { name: 'Search patients' }),
      'Avery',
    );
    await ready('Showing 1–10 of 10 patients');
    expect(
      new URLSearchParams(router.state.location.search).get('search'),
    ).toBe('Avery');
    expect(
      new URLSearchParams(router.state.location.search).get('status'),
    ).toBe('active');
    expect(new URLSearchParams(router.state.location.search).has('page')).toBe(
      false,
    );
    expect(rows().every((row) => row.textContent?.includes('Avery'))).toBe(
      true,
    );
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await ready('Showing 1–20 of 50 patients');
    expect(screen.getByLabelText('Patient status')).toHaveValue('active');
  });
  it.each([
    ['U.S. state', 'CO', 15],
    ['Care coordinator', 'coordinator-002', 30],
  ] as const)('filters by %s', async (label, value, count) => {
    const user = userEvent.setup();
    const router = renderWorklist();
    await ready();
    await user.selectOptions(screen.getByLabelText(label), value);
    await ready(
      'Showing 1–' + Math.min(20, count) + ' of ' + count + ' patients',
    );
    expect(router.state.location.search).toContain(
      label === 'U.S. state' ? 'state=CO' : 'coordinatorId=coordinator-002',
    );
  });
  it('combines filters and provides assigned-to-me and clear actions', async () => {
    const user = userEvent.setup();
    renderWorklist();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Assigned to me' }));
    await ready('Showing 1–20 of 30 patients');
    expect(screen.getByLabelText('Care coordinator')).toHaveValue(
      'coordinator-001',
    );
    await user.selectOptions(screen.getByLabelText('Patient status'), 'active');
    await user.selectOptions(screen.getByLabelText('U.S. state'), 'CO');
    await ready('Showing 1–5 of 5 patients');
    expect(
      rows().every(
        (row) =>
          row.textContent?.includes('Morgan Chen') &&
          row.textContent?.includes('CO') &&
          row.textContent?.includes('Active'),
      ),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await ready();
    expect(screen.getByLabelText('Care coordinator')).toHaveValue('');
  });
  it('sorts through API parameters with accessible direction and page reset', async () => {
    const user = userEvent.setup();
    const router = renderWorklist('/patients?page=2');
    await ready('Showing 21–40 of 150 patients');
    await user.click(
      within(table()).getByRole('button', { name: /Sort by patient/ }),
    );
    await ready();
    expect(
      within(rows()[0]!).getByRole('link', { name: 'Avery Alden' }),
    ).toBeVisible();
    expect(
      new URLSearchParams(router.state.location.search).get('sortBy'),
    ).toBe('fullName');
    expect(
      within(table())
        .getByRole('button', { name: /Sort by patient/ })
        .closest('th'),
    ).toHaveAttribute('aria-sort', 'ascending');
    await user.click(
      within(table()).getByRole('button', { name: /Sort by patient/ }),
    );
    await waitFor(() =>
      expect(
        within(table())
          .getByRole('button', { name: /Sort by patient/ })
          .closest('th'),
      ).toHaveAttribute('aria-sort', 'descending'),
    );
    await user.click(
      within(table()).getByRole('button', { name: /Sort by age/ }),
    );
    await waitFor(() =>
      expect(
        new URLSearchParams(router.state.location.search).get('sortBy'),
      ).toBe('age'),
    );
  });
  it('paginates, preserves controls, and resets page when size changes', async () => {
    const user = userEvent.setup();
    const router = renderWorklist(
      '/patients?status=active&sortBy=fullName&sortOrder=asc',
    );
    await ready('Showing 1–20 of 50 patients');
    expect(
      screen.getByRole('button', { name: 'Previous page' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await ready('Showing 21–40 of 50 patients');
    expect(router.state.location.search).toContain('page=2');
    expect(screen.getByLabelText('Patient status')).toHaveValue('active');
    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    await ready('Showing 1–50 of 50 patients');
    expect(rows()).toHaveLength(50);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Rows per page'), '10');
    await ready('Showing 1–10 of 50 patients');
    expect(rows()).toHaveLength(10);
  });
  it('restores URL state on browser back and forward', async () => {
    const user = userEvent.setup();
    const router = renderWorklist();
    await ready();
    await user.selectOptions(screen.getByLabelText('Patient status'), 'active');
    await ready('Showing 1–20 of 50 patients');
    await user.selectOptions(screen.getByLabelText('U.S. state'), 'CO');
    await ready('Showing 1–5 of 5 patients');
    await act(async () => router.navigate(-1));
    await ready('Showing 1–20 of 50 patients');
    expect(screen.getByLabelText('U.S. state')).toHaveValue('');
    await act(async () => router.navigate(1));
    await ready('Showing 1–5 of 5 patients');
    expect(screen.getByLabelText('U.S. state')).toHaveValue('CO');
  });
  it('normalizes invalid URL values without discarding a valid search', async () => {
    const router = renderWorklist(
      '/patients?page=-1&pageSize=25&status=bad&state=ZZ&coordinatorId=unknown&sortBy=email&sortOrder=bad&search=Avery',
    );
    await ready('Showing 1–10 of 10 patients');
    expect(router.state.location.search).toBe('?search=Avery');
    expect(screen.getByLabelText('Rows per page')).toHaveValue('20');
  });
  it('clamps out-of-range pages to the last valid page', async () => {
    const router = renderWorklist('/patients?page=999&status=active');
    await ready('Showing 41–50 of 50 patients');
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe(
      '3',
    );
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
  it('shows no matching results and clears search and filters', async () => {
    const user = userEvent.setup();
    renderWorklist('/patients?search=NoSuchPatient&status=active');
    expect(
      await screen.findByRole('heading', {
        name: 'No patients match your current filters.',
      }),
    ).toBeVisible();
    expect(screen.getByText('Showing 0–0 of 0 patients')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Clear search and filters' }),
    );
    await ready();
  });
  it('handles an empty dataset without inventing a creation action', async () => {
    mockDatabase.patients = [];
    renderWorklist();
    expect(
      await screen.findByRole('heading', { name: 'No patients yet' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /add patient/i }),
    ).not.toBeInTheDocument();
  });
  it('shows a safe API error and retries with the same URL context', async () => {
    server.use(
      http.get('/api/patients', () =>
        HttpResponse.json(
          {
            error: {
              code: 'INVALID_REQUEST',
              message: 'internal database details',
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    const router = renderWorklist('/patients?status=active');
    expect(
      await screen.findByRole('heading', { name: 'Unable to load patients' }),
    ).toBeVisible();
    expect(
      screen.queryByText('internal database details'),
    ).not.toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await ready('Showing 1–20 of 50 patients');
    expect(router.state.location.search).toBe('?status=active');
  });
  it('preserves page data during a delayed pagination fetch', async () => {
    const pageTwo = await getPatients({
      page: 2,
      sortBy: 'lastUpdated',
      sortOrder: 'desc',
    });
    const user = userEvent.setup();
    renderWorklist();
    await ready();
    const previousName = rows()[0]!.textContent;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/patients', async () => {
        await gate;
        return HttpResponse.json(pageTwo);
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Updating results…')).toBeVisible();
    expect(rows()[0]!.textContent).toBe(previousName);
    expect(
      screen.queryByRole('status', { name: 'Loading patients' }),
    ).not.toBeInTheDocument();
    release();
    await ready('Showing 21–40 of 150 patients');
  });
  it('navigates with the keyboard and restores worklist context', async () => {
    const user = userEvent.setup();
    const router = renderWorklist(
      '/patients?page=2&pageSize=10&status=active&sortBy=fullName&sortOrder=asc',
    );
    await ready('Showing 11–20 of 50 patients');
    const initial = router.state.location.search;
    const link = within(rows()[0]!).getAllByRole('link')[0]!;
    const name = link.textContent!;
    link.focus();
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('heading', { level: 1, name }),
    ).toBeVisible();
    expect(router.state.location.pathname).toMatch(/^[/]patients[/]patient-/);
    await user.click(screen.getByRole('link', { name: /Back to patients/ }));
    await ready('Showing 11–20 of 50 patients');
    expect(router.state.location.search).toBe(initial);
  });
  it('supports row click and direct unknown-patient routes', async () => {
    const user = userEvent.setup();
    const router = renderWorklist();
    await ready();
    await user.click(within(rows()[0]!).getByText('patient-028'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/patients/patient-028'),
    );
    await act(async () => router.navigate('/patients/unknown'));
    expect(
      await screen.findByRole('heading', { name: 'Patient not found' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Back to patients/ }),
    ).toHaveAttribute('href', '/patients');
  });
  it('provides mobile cards with the same query results and usable actions', async () => {
    renderWorklist('/patients?pageSize=10&state=CO');
    await ready('Showing 1–10 of 15 patients');
    const cards = screen.getByRole('list', { name: 'Patient cards' });
    expect(within(cards).getAllByRole('listitem')).toHaveLength(10);
    const first = within(cards).getAllByRole('listitem')[0]!;
    expect(first).toHaveTextContent('Age / State');
    expect(first).toHaveTextContent('Coordinator');
    expect(within(first).getByRole('link', { name: /View / })).toHaveAttribute(
      'href',
      expect.stringMatching(/^[/]patients[/]patient-/),
    );
  });
});
