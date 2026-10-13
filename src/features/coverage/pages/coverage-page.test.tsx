import { StrictMode } from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import {
  render,
  screen,
  within,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { appRoutes } from '@/app/router/routes';
import { server } from '@/mocks/server';
import { mockDatabase } from '@/mocks/data/database';
const clients: QueryClient[] = [];
beforeEach(() =>
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  }),
);
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
function mount(path = '/coverage?date=2026-10-09') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] }),
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return { router, client };
}
async function ready() {
  await screen.findByRole('heading', { name: 'Coverage & Renewals', level: 1 });
  await waitFor(() =>
    expect(
      screen.getByRole('region', { name: 'Coverage records' }),
    ).toHaveTextContent('260 matching coverage records'),
  );
}
it('protects an unsaved event draft during route navigation and preserves it after keeping edits', async () => {
  const user = userEvent.setup();
  const { router } = mount('/coverage?record=coverage-004&date=2026-10-09');
  const detail = await screen.findByRole('dialog', {
    name: 'Coverage details',
  });
  await user.click(
    await within(detail).findByRole('button', { name: 'Add Event' }),
  );
  const input = within(detail).getByLabelText('Event description');
  await user.type(input, 'Unsaved synthetic review');
  await user.click(
    within(detail).getByRole('link', { name: 'View Patient Profile' }),
  );
  const confirm = await screen.findByRole('dialog', {
    name: 'Discard unsaved changes?',
  });
  await user.click(
    within(confirm).getByRole('button', { name: 'Keep editing' }),
  );
  expect(router.state.location.pathname).toBe('/coverage');
  expect(input).toHaveValue('Unsaved synthetic review');
  await user.click(
    within(detail).getByRole('button', { name: 'Cancel event' }),
  );
  await user.click(
    within(
      await screen.findByRole('dialog', { name: 'Discard unsaved changes?' }),
    ).getByRole('button', { name: 'Discard changes' }),
  );
  expect(
    screen.queryByRole('form', { name: 'Add coverage event' }),
  ).not.toBeInTheDocument();
});
it('does not request event history for a missing coverage record', async () => {
  let requests = 0;
  server.use(
    http.get('/api/coverage/missing/events', () => {
      requests++;
      return HttpResponse.json([], { status: 200 });
    }),
  );
  mount('/coverage?record=missing&date=2026-10-09');
  const detail = await screen.findByRole('dialog', {
    name: 'Coverage details',
  });
  await within(detail).findByText(
    'Coverage record not found or could not load.',
  );
  expect(requests).toBe(0);
});
it('shows global metrics, defaults to urgent renewals and supports search, pagination and sorting', async () => {
  const user = userEvent.setup(),
    { router } = mount();
  await ready();
  expect(screen.getByLabelText('Coverage overview')).toHaveTextContent(
    'Patients with active records',
  );
  expect(screen.getByLabelText('Renewal urgency')).toHaveValue('urgent');
  await user.click(screen.getByRole('button', { name: 'Next coverage page' }));
  await waitFor(() => expect(router.state.location.search).toContain('page=2'));
  await user.selectOptions(
    screen.getByLabelText('Renewal sort direction'),
    'desc',
  );
  expect(router.state.location.search).toContain('rSortOrder=desc');
  await user.type(
    screen.getByLabelText('Search coverage patients'),
    'Avery Alden',
  );
  await waitFor(() =>
    expect(
      screen.getByRole('region', { name: 'Coverage records' }),
    ).toHaveTextContent('2 matching coverage records'),
  );
  expect(router.state.location.search).toContain('search=Avery');
});
it('loads no event history initially, renders scaled timeline and provides keyboard inspection', async () => {
  const requestedIds: string[] = [];
  server.use(
    http.get('/api/coverage/:id/events', ({ params }) => {
      requestedIds.push(String(params.id));
      return HttpResponse.json(
        mockDatabase.coverageEvents.filter(
          (event) => event.coverageId === params.id,
        ),
      );
    }),
  );
  const user = userEvent.setup();
  mount();
  await ready();
  expect(requestedIds).toHaveLength(0);
  await user.type(
    screen.getByLabelText('Search coverage patients'),
    'Avery Alden',
  );
  await waitFor(() =>
    expect(
      screen.getByRole('region', { name: 'Coverage records' }),
    ).toHaveTextContent('2 matching coverage records'),
  );
  await user.click(
    within(
      screen.getByRole('region', { name: 'Coverage records' }),
    ).getAllByRole('button', { name: 'Timeline for patient-001' })[0]!,
  );
  const timeline = await screen.findByRole('region', {
    name: 'Patient coverage timeline',
  });
  expect(
    within(timeline).getByRole('list', {
      name: 'Chronological coverage alternative',
    }),
  ).toBeInTheDocument();
  expect(within(timeline).getByText(/2026-07-01 – 2026-07-31/)).toBeVisible();
  const choice = within(timeline).getByRole('button', {
    name: /Select period 2/,
  });
  choice.focus();
  await user.keyboard('{Enter}');
  const detail = await screen.findByRole('dialog', {
    name: 'Coverage details',
  });
  expect(
    await within(detail).findByText('Active', { exact: true }),
  ).toBeVisible();
  expect(new Set(requestedIds)).toEqual(new Set(['coverage-002']));
});
it('validates creation, saves explicit synthetic coverage and does not fabricate events', async () => {
  const user = userEvent.setup();
  mount('/coverage?patientId=patient-149&date=2026-10-09');
  await screen.findByRole('heading', { name: 'Coverage & Renewals', level: 1 });
  await user.click(screen.getByRole('button', { name: 'Create Coverage' }));
  const editor = await screen.findByRole('dialog', { name: 'Create coverage' });
  await user.click(
    within(editor).getByRole('button', { name: 'Save coverage' }),
  );
  expect(within(editor).getAllByRole('alert').length).toBeGreaterThan(0);
  await user.selectOptions(
    within(editor).getByLabelText(/Fictional program/),
    'demo-health',
  );
  fireEvent.change(within(editor).getByLabelText(/Coverage start/), {
    target: { value: '2026-10-01' },
  });
  fireEvent.change(within(editor).getByLabelText(/Coverage end/), {
    target: { value: '2026-09-30' },
  });
  await user.click(
    within(editor).getByRole('button', { name: 'Save coverage' }),
  );
  expect(within(editor).getByRole('alert')).toHaveTextContent(
    'End must not precede start',
  );
  fireEvent.change(within(editor).getByLabelText(/Coverage end/), {
    target: { value: '2027-01-01' },
  });
  await user.dblClick(
    within(editor).getByRole('button', { name: 'Save coverage' }),
  );
  const detail = await screen.findByRole('dialog', {
    name: 'Coverage details',
  });
  expect(await within(detail).findByText(/No recorded events/)).toBeVisible();
  expect(mockDatabase.coverage).toHaveLength(261);
});
it('preserves a failed coverage draft and allows retry', async () => {
  server.use(
    http.post('/api/coverage', () =>
      HttpResponse.json(
        { error: { code: 'CONFLICT', message: 'Temporary coverage failure' } },
        { status: 409 },
      ),
    ),
  );
  const user = userEvent.setup();
  mount('/coverage?patientId=patient-149&date=2026-10-09');
  await screen.findByRole('heading', { name: 'Coverage & Renewals', level: 1 });
  await user.click(screen.getByRole('button', { name: 'Create Coverage' }));
  const editor = await screen.findByRole('dialog', { name: 'Create coverage' });
  await user.selectOptions(
    within(editor).getByLabelText(/Fictional program/),
    'demo-health',
  );
  fireEvent.change(within(editor).getByLabelText(/Coverage start/), {
    target: { value: '2026-10-01' },
  });
  await user.click(
    within(editor).getByRole('button', { name: 'Save coverage' }),
  );
  expect(await within(editor).findByRole('alert')).toHaveTextContent(
    'Temporary coverage failure',
  );
  expect(within(editor).getByLabelText(/Coverage start/)).toHaveValue(
    '2026-10-01',
  );
  server.resetHandlers();
  await user.click(
    within(editor).getByRole('button', { name: 'Save coverage' }),
  );
  await screen.findByRole('dialog', { name: 'Coverage details' });
});
it('updates renewal stages and records events without extending dates', async () => {
  const user = userEvent.setup();
  mount('/coverage?record=coverage-004&date=2026-10-09');
  const detail = await screen.findByRole('dialog', {
    name: 'Coverage details',
  });
  await within(detail).findByText('In progress', { exact: true });
  await user.click(
    within(detail).getByRole('button', { name: 'Set renewal Submitted' }),
  );
  expect(
    await within(detail).findByText('Submitted', { exact: true }),
  ).toBeVisible();
  await user.click(within(detail).getByRole('button', { name: 'Add Event' }));
  const form = within(detail).getByRole('form', { name: 'Add coverage event' });
  await user.type(
    within(form).getByLabelText('Event description'),
    'Synthetic coordinator review recorded.',
  );
  await user.click(within(form).getByRole('button', { name: 'Save event' }));
  expect(
    await within(detail).findByText('Synthetic coordinator review recorded.'),
  ).toBeVisible();
  expect(mockDatabase.coverage[3]?.endDate).toBe('2027-03-31');
  expect(mockDatabase.coverage[3]?.renewalStatus).toBe('submitted');
});
it('prepopulates reviewed renewal tasks, prevents duplicates and links back to coverage', async () => {
  const user = userEvent.setup();
  mount('/coverage?record=coverage-004&date=2026-10-09');
  const detail = await screen.findByRole('dialog', {
    name: 'Coverage details',
  });
  await waitFor(() =>
    expect(
      within(detail).getByRole('button', {
        name: 'Create Renewal Follow-up Task',
      }),
    ).toBeEnabled(),
  );
  await user.click(
    within(detail).getByRole('button', {
      name: 'Create Renewal Follow-up Task',
    }),
  );
  const editor = await screen.findByRole('dialog', { name: 'Create task' });
  expect(within(editor).getByLabelText(/Task type/)).toHaveValue(
    'coverage_renewal',
  );
  expect(within(editor).getByLabelText(/Due date/)).toHaveValue('2026-09-20');
  await waitFor(() =>
    expect(within(editor).getByLabelText(/Assigned coordinator/)).toHaveValue(
      mockDatabase.patients[1]?.assignedCoordinatorId,
    ),
  );
  expect(mockDatabase.tasks).toHaveLength(250);
  await user.click(within(editor).getByRole('button', { name: 'Save task' }));
  await user.click(
    await within(detail).findByRole('link', { name: 'View renewal task' }),
  );
  const task = await screen.findByRole('dialog', { name: 'Task details' });
  expect(
    await within(task).findByRole('link', { name: 'Open source coverage' }),
  ).toHaveAttribute('href', '/coverage?record=coverage-004');
  expect(mockDatabase.tasks.at(-1)?.source?.coverageId).toBe('coverage-004');
});
it('distinguishes no records, no active periods, invalid filters and API failures', async () => {
  const { router } = mount('/patients/patient-150');
  const section = await screen.findByRole('region', {
    name: 'Patient coverage history',
  });
  expect(
    await within(section).findByText(
      /No recorded coverage. This does not prove/,
    ),
  ).toBeVisible();
  await act(() => router.navigate('/coverage?date=bad'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid coverage filters',
  );
  server.use(
    http.get('/api/coverage', () => new HttpResponse(null, { status: 503 })),
  );
  await act(() => router.navigate('/coverage?date=2026-10-09'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Coverage records could not load',
  );
});
it('patient profile shows bounded gaps and navigates to its timeline', async () => {
  const user = userEvent.setup(),
    { router } = mount('/patients/patient-001');
  const section = await screen.findByRole('region', {
    name: 'Patient coverage history',
  });
  expect(
    await within(section).findByText(/Recorded gap for demo-health/),
  ).toBeVisible();
  await user.click(
    within(section).getByRole('link', { name: 'View Coverage Timeline' }),
  );
  await screen.findByRole('region', { name: 'Patient coverage timeline' });
  expect(router.state.location.search).toContain('timeline=patient-001');
});
it('starts reviewed renewal task creation directly from a worklist row and never saves automatically', async () => {
  const user = userEvent.setup();
  mount('/coverage?patientId=patient-002&date=2026-10-09');
  const worklist = await screen.findByRole('region', {
    name: 'Upcoming and overdue renewals',
  });
  await user.click(
    (
      await within(worklist).findAllByRole('button', {
        name: 'Create Renewal Follow-up Task',
      })
    )[0]!,
  );
  const editor = await screen.findByRole('dialog', { name: 'Create task' });
  expect(within(editor).getByLabelText(/Task type/)).toHaveValue(
    'coverage_renewal',
  );
  expect(
    within(editor).getByText(/Coverage source: coverage-004/),
  ).toBeVisible();
  expect(mockDatabase.tasks).toHaveLength(250);
  await waitFor(() =>
    expect(
      within(editor).getByRole('button', { name: 'Save task' }),
    ).toBeEnabled(),
  );
  await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Create task' }),
    ).not.toBeInTheDocument(),
  );
  expect(mockDatabase.tasks).toHaveLength(250);
});
