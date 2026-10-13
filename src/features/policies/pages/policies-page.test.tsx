import { StrictMode } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { appRoutes } from '@/app/router/routes';
import { server } from '@/mocks/server';
import { capturePolicyPopulation } from '@/mocks/data/policy-population';
import { mockDatabase } from '@/mocks/data/database';
import { populationKeys } from '../api/population-api';
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
const selected =
  '/policies?program=demo-family&baseline=2025.1&comparison=2026.1&date=2026-06-15';
function mount(path = selected) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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
  await screen.findByRole('heading', {
    name: 'Policy Comparison & Impact Analysis',
    level: 1,
  });
}
async function run(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: 'Run Population Impact Analysis' }),
  );
  await screen.findByRole('region', { name: 'Population impact results' });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Run Population Impact Analysis' }),
    ).toBeEnabled(),
  );
}
describe('policy comparison workflow', () => {
  it('announces loading and prevents conflicting policy selections during a batch request', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/policy-population', async () => {
        await gate;
        return HttpResponse.json(capturePolicyPopulation());
      }),
    );
    const user = userEvent.setup();
    mount();
    await ready();
    await user.click(
      screen.getByRole('button', { name: 'Run Population Impact Analysis' }),
    );
    expect(
      screen.getByRole('button', { name: 'Loading population and analyzing…' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Benefit program')).toBeDisabled();
    release();
    await screen.findByRole('region', { name: 'Population impact results' });
  });
  it('handles no changed outcomes independently of an empty population', async () => {
    const source = capturePolicyPopulation();
    const record = source.records.find(
      (record) =>
        record.kind === 'record' && record.patient.id === 'patient-001',
    )!;
    server.use(
      http.get('/api/policy-population', () =>
        HttpResponse.json({ snapshotId: 'unchanged', records: [record] }),
      ),
      http.get('/api/policy-population/version', () =>
        HttpResponse.json({ snapshotId: 'unchanged', count: 1 }),
      ),
    );
    const user = userEvent.setup();
    mount();
    await ready();
    await run(user);
    expect(
      screen.getByText(
        'No eligibility statuses changed between these versions.',
      ),
    ).toBeVisible();
  });
  it('retains original patient values after mutations while an inspector is open', async () => {
    const user = userEvent.setup(),
      { client } = mount();
    await ready();
    await run(user);
    const inspect = screen.getAllByRole('button', {
      name: /^Inspect patient-/,
    })[0]!;
    await user.click(inspect);
    const dialog = await screen.findByRole('dialog', {
      name: 'Patient policy impact',
    });
    const content = dialog.textContent;
    mockDatabase.households[1]!.updatedAt = '2026-10-09T00:00:00.000Z';
    await act(() =>
      client.invalidateQueries({ queryKey: populationKeys.version }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'original captured results',
    );
    expect(
      dialog.textContent?.replace(
        within(dialog).getByRole('alert').textContent ?? '',
        '',
      ),
    ).toBe(content);
  });
  it('reports unverified freshness and recovers when its metadata API is available', async () => {
    const user = userEvent.setup(),
      { client } = mount();
    await ready();
    await run(user);
    server.use(
      http.get(
        '/api/policy-population/version',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    await act(() =>
      client.invalidateQueries({ queryKey: populationKeys.version }),
    );
    await waitFor(
      () =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'freshness could not be verified',
        ),
      { timeout: 3000 },
    );
    server.resetHandlers();
    await user.click(
      screen.getByRole('button', { name: 'Retry freshness check' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });
  it('requires explicit selection, supports three versioned programs, and bookmarks effective dates', async () => {
    const user = userEvent.setup(),
      { router } = mount('/policies');
    await ready();
    expect(
      screen.getByRole('button', { name: 'Run Population Impact Analysis' }),
    ).toBeDisabled();
    for (const program of ['demo-health', 'demo-nutrition', 'demo-family']) {
      await user.selectOptions(
        screen.getByLabelText('Benefit program'),
        program,
      );
      expect(screen.getByLabelText('Baseline policy version')).toHaveValue('');
      expect(
        within(screen.getByLabelText('Baseline policy version')).getAllByRole(
          'option',
        ),
      ).toHaveLength(3);
    }
    expect(
      within(screen.getByLabelText('Baseline policy version')).getByRole(
        'option',
        { name: /2025.1.*2025-01-01/, hidden: true },
      ),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Baseline policy version'),
      '2025.1',
    );
    await user.selectOptions(
      screen.getByLabelText('Comparison policy version'),
      '2026.1',
    );
    expect(
      screen.getByRole('button', { name: 'Run Population Impact Analysis' }),
    ).toBeEnabled();
    expect(router.state.location.search).toContain('baseline=2025.1');
    await user.selectOptions(
      screen.getByLabelText('Benefit program'),
      'demo-housing',
    );
    expect(screen.getByText(/fewer than two versions/)).toBeVisible();
    expect(screen.getByLabelText('Baseline policy version')).toHaveValue('');
  });
  it('displays structured thresholds and filters semantic/metadata rule changes', async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    expect(screen.getByText(/Added: 0.*Removed: 0.*Modified: 3/)).toBeVisible();
    expect(
      screen.getByText(/Configured value increased by \$5,000/),
    ).toBeVisible();
    expect(
      screen.getByText(/2 rules with eligibility-logic changes/),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText('Filter rule changes'),
      'added',
    );
    expect(screen.getByText('No rules match this change type.')).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText('Filter rule changes'),
      'modified',
    );
    expect(screen.getByText(/Configured value decreased by 1/)).toBeVisible();
  });
  it('runs the full population, filters the matrix, paginates, sorts, and preserves filters when inspecting', async () => {
    const user = userEvent.setup(),
      { router } = mount();
    await ready();
    await run(user);
    expect(screen.getByRole('status')).toHaveTextContent(
      '150 patients evaluated',
    );
    await user.selectOptions(screen.getByLabelText('Transition filter'), 'all');
    expect(
      screen.getByText('150 matching patients · Page 1 of 15'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Next impact page' }));
    expect(
      screen.getByText('150 matching patients · Page 2 of 15'),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText('Patient sort'),
      'name_desc',
    );
    expect(
      screen.getByText('150 matching patients · Page 1 of 15'),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: /Ineligible to Eligible:/ }),
    );
    expect(screen.getByLabelText('Transition filter')).toHaveValue(
      'ineligible->eligible',
    );
    await user.click(
      screen.getAllByRole('button', { name: /^Inspect patient-/ })[0]!,
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Patient policy impact',
    });
    expect(
      within(dialog).getByRole('heading', { name: 'Baseline 2025.1' }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('heading', { name: 'Comparison 2026.1' }),
    ).toBeVisible();
    expect(
      within(dialog).getAllByText('Actual evaluated value').length,
    ).toBeGreaterThan(0);
    expect(router.state.location.search).toContain('transition=ineligible');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Transition filter')).toHaveValue(
      'ineligible->eligible',
    );
  });
  it('marks captured results outdated on changes, and swaps direction before rerunning', async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await run(user);
    fireEvent.change(screen.getByLabelText('Population evaluation date'), {
      target: { value: '2026-07-01' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Analysis outdated');
    expect(screen.getByText(/Evaluation date 2026-06-15/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Swap Versions' }));
    expect(screen.getByLabelText('Baseline policy version')).toHaveValue(
      '2026.1',
    );
    await run(user);
    expect(screen.queryByText(/Analysis outdated/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Baseline 2026.1 → Comparison 2025.1/),
    ).toBeVisible();
  });
  it('detects population mutations without relabeling or recomputing the stored snapshot', async () => {
    const user = userEvent.setup(),
      { client } = mount();
    await ready();
    await run(user);
    const original = capturePolicyPopulation().snapshotId;
    mockDatabase.patients[0]!.updatedAt = '2026-10-09T00:00:00.000Z';
    await act(() =>
      client.invalidateQueries({ queryKey: populationKeys.version }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Analysis outdated',
    );
    expect(screen.getByText(new RegExp(original))).toBeVisible();
  });
  it('rejects same versions, unknown selections, and invalid dates', async () => {
    const { router } = mount(
      selected.replace('comparison=2026.1', 'comparison=2025.1'),
    );
    await ready();
    expect(screen.getByRole('alert')).toHaveTextContent('distinct');
    await act(() =>
      router.navigate(
        '/policies?program=demo-family&baseline=bad&comparison=2026.1&date=bad',
      ),
    );
    expect(
      screen
        .getAllByRole('alert')
        .map((item) => item.textContent)
        .join(' '),
    ).toMatch(/valid versions.*valid evaluation date/);
    expect(
      screen.getByRole('button', { name: 'Run Population Impact Analysis' }),
    ).toBeDisabled();
  });
  it('handles an empty population and no changed statuses', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/policy-population', () =>
        HttpResponse.json({ snapshotId: 'empty', records: [] }),
      ),
      http.get('/api/policy-population/version', () =>
        HttpResponse.json({ snapshotId: 'empty', count: 0 }),
      ),
    );
    mount();
    await ready();
    await run(user);
    expect(
      screen.getByText('No synthetic patient records are available.'),
    ).toBeVisible();
    expect(
      screen.getByText('No patients match this transition filter.'),
    ).toBeVisible();
  });
  it('reports API failure and allows retrying', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        '/api/policy-population',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    mount();
    await ready();
    await user.click(
      screen.getByRole('button', { name: 'Run Population Impact Analysis' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('could not run');
    expect(
      screen.queryByRole('region', { name: 'Population impact results' }),
    ).not.toBeInTheDocument();
    server.resetHandlers();
    await run(user);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('tracks malformed and inconsistent source records separately from valid transitions', async () => {
    const snapshot = capturePolicyPopulation();
    const first = snapshot.records[0]!;
    if (first.kind !== 'record') throw new Error('Expected fixture');
    server.use(
      http.get('/api/policy-population', () =>
        HttpResponse.json({
          snapshotId: 'invalid',
          records: [
            {
              kind: 'error',
              recordKey: 'broken',
              patientName: 'Broken fixture',
              patientId: null,
              message: 'Malformed source',
            },
            {
              ...first,
              household: first.household
                ? { ...first.household, patientId: 'different' }
                : null,
            },
          ],
        }),
      ),
      http.get('/api/policy-population/version', () =>
        HttpResponse.json({ snapshotId: 'invalid', count: 2 }),
      ),
    );
    const user = userEvent.setup();
    mount();
    await ready();
    await run(user);
    expect(screen.getByRole('status')).toHaveTextContent(
      '0 patients evaluated',
    );
    expect(
      screen.getByRole('region', { name: 'Population evaluation errors' }),
    ).toHaveTextContent('Broken fixture');
    expect(screen.getByRole('status')).toHaveTextContent(
      '2 records reported separately as errors',
    );
  });
  it('supports returning from the patient profile with sanitized selections and filter', async () => {
    const user = userEvent.setup(),
      { router } = mount();
    await ready();
    await run(user);
    await user.click(
      screen.getAllByRole('button', { name: /^Inspect patient-/ })[0]!,
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('link', {
        name: 'View patient profile',
      }),
    );
    await user.click(
      await screen.findByRole('link', { name: /Back to policy comparison/ }),
    );
    await ready();
    expect(router.state.location.search).toContain('baseline=2025.1');
    expect(
      screen.queryByRole('region', { name: 'Population impact results' }),
    ).not.toBeInTheDocument();
  });
});
