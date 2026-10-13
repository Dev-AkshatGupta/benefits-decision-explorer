import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { appRoutes } from '@/app/router/routes';
import {
  getPatient,
  getPatientHousehold,
} from '../../../patients/api/patients-api';
import * as engine from '../../engine/screen-patient';
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
function mount(path = '/eligibility?patientId=patient-011&date=2026-06-15') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: 30000, retry: false } },
  });
  clients.push(client);
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return router;
}
async function openSimulator(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', {
    name: 'Eligibility Screening',
    level: 1,
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Run screening' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Run screening' }));
  await user.click(
    await screen.findByRole('link', { name: 'Explore What-if Scenarios' }),
  );
  await screen.findByRole('heading', {
    name: 'What-if Eligibility Simulator',
    level: 1,
  });
}
describe('temporary what-if workspace', () => {
  it('recalculates income, explains differences, resets and exits without any requests or saved edits', async () => {
    const originalPatient = await getPatient('patient-011'),
      originalHousehold = await getPatientHousehold('patient-011');
    const spy = vi.spyOn(engine, 'screenPatient'),
      fetchSpy = vi.spyOn(globalThis, 'fetch'),
      user = userEvent.setup();
    mount();
    await openSimulator(user);
    const baselineResults = JSON.stringify(spy.mock.results[0]?.value),
      requests = fetchSpy.mock.calls.length;
    expect(
      screen.getByText(
        /5 programs evaluated · 0 changed programs · 5 unchanged programs · 0 changed rules/,
      ),
    ).toBeVisible();
    fireEvent.change(
      screen.getByLabelText('Hypothetical annual income (USD)'),
      { target: { value: '60000.00' } },
    );
    expect(
      screen.getByText(
        /3 changed programs · 2 unchanged programs · 5 changed rules/,
      ),
    ).toBeVisible();
    const card = screen.getByRole('article', {
      name: 'Demo Health Coverage (Fictional)',
    });
    expect(
      within(card).getByText('Status changed: Eligible → Ineligible'),
    ).toBeVisible();
    await user.click(within(card).getByText(/Inspect rule differences/));
    const rule = within(card).getByRole('region', {
      name: 'Household income requirement',
    });
    expect(
      within(rule).getByText(/\$60,000.00/, { selector: 'dd' }),
    ).toBeVisible();
    expect(
      within(rule).getByText(/\$35,000.00/, { selector: 'dd' }),
    ).toBeVisible();
    expect(
      screen.getByText('Difference from baseline: +$60,000.00'),
    ).toBeVisible();
    expect(fetchSpy.mock.calls).toHaveLength(requests);
    const calls = spy.mock.calls.length;
    fireEvent.change(
      screen.getByLabelText('Hypothetical annual income (USD)'),
      { target: { value: '60000' } },
    );
    expect(spy.mock.calls).toHaveLength(calls);
    await user.click(screen.getByRole('button', { name: 'Reset All Changes' }));
    expect(
      screen.getByLabelText('Hypothetical annual income (USD)'),
    ).toHaveValue('');
    expect(
      screen.getByText(
        /0 changed programs · 5 unchanged programs · 0 changed rules/,
      ),
    ).toBeVisible();
    expect(spy.mock.calls).toHaveLength(calls);
    expect(JSON.stringify(spy.mock.results[0]?.value)).toBe(baselineResults);
    await user.click(screen.getByRole('link', { name: 'Exit Simulation' }));
    await screen.findByRole('heading', {
      name: 'Eligibility Screening',
      level: 1,
    });
    expect(screen.queryByText(/Outdated results\./)).not.toBeInTheDocument();
    expect(await getPatient('patient-011')).toEqual(originalPatient);
    expect(await getPatientHousehold('patient-011')).toEqual(originalHousehold);
    expect(
      fetchSpy.mock.calls.filter(
        ([url, options]) =>
          String(url).includes('/api/patients') && options?.method === 'PATCH',
      ),
    ).toHaveLength(0);
  });
  it('recalculates household size, child presence, state and age without birth-date conflicts', async () => {
    const user = userEvent.setup();
    mount();
    await openSimulator(user);
    fireEvent.change(screen.getByLabelText('Hypothetical household size'), {
      target: { value: '2' },
    });
    expect(
      screen.getByText(
        /1 changed programs · 4 unchanged programs · 1 changed rules/,
      ),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText('Hypothetical qualifying child present'),
      'yes',
    );
    expect(
      screen.getByText(
        /2 changed programs · 3 unchanged programs · 2 changed rules/,
      ),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText('Hypothetical patient age'), {
      target: { value: '65' },
    });
    expect(
      within(
        screen.getByRole('article', {
          name: 'Demo Health Coverage (Fictional)',
        }),
      ).getByText('Status changed: Eligible → Ineligible'),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText('Hypothetical state of residence'),
      'TX',
    );
    expect(screen.getByText(/3 changed programs/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reset All Changes' }));
    expect(
      screen.getByText(
        'No input changes. Simulation matches the original screening.',
      ),
    ).toBeVisible();
  });
  it('pauses for invalid and inconsistent intermediate inputs and evaluates no invalid values', async () => {
    const spy = vi.spyOn(engine, 'screenPatient'),
      user = userEvent.setup();
    mount();
    await openSimulator(user);
    const calls = spy.mock.calls.length;
    for (const value of ['-', '-100', '1.005', 'abc']) {
      fireEvent.change(
        screen.getByLabelText('Hypothetical annual income (USD)'),
        { target: { value } },
      );
      expect(screen.getByText(/Simulation paused/)).toBeVisible();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      expect(spy.mock.calls).toHaveLength(calls);
    }
    await user.click(
      screen.getByRole('button', {
        name: 'Reset Hypothetical annual income (USD)',
      }),
    );
    await user.selectOptions(
      screen.getByLabelText('Hypothetical qualifying child present'),
      'yes',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('at least 2');
    expect(screen.getByText(/Simulation paused/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Hypothetical household size'), {
      target: { value: '2' },
    });
    expect(screen.queryByText(/Simulation paused/)).not.toBeInTheDocument();
  });
  it('keeps unknown income until explicitly supplied, and clearing restores unknown', async () => {
    const user = userEvent.setup();
    mount('/eligibility?patientId=patient-001&date=2026-06-15');
    await openSimulator(user);
    const card = screen.getByRole('article', {
      name: 'Demo Nutrition Assistance (Fictional)',
    });
    expect(within(card).getByText('No status change')).toBeVisible();
    fireEvent.change(
      screen.getByLabelText('Hypothetical annual income (USD)'),
      { target: { value: '0' } },
    );
    expect(
      within(card).getByText('Status changed: Needs information → Eligible'),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Baseline income is unknown; a numeric difference is unavailable.',
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', {
        name: 'Reset Hypothetical annual income (USD)',
      }),
    );
    expect(within(card).getByText('No status change')).toBeVisible();
  });
  it('loads selected records but explicitly asks for a baseline on direct navigation', async () => {
    const spy = vi.spyOn(engine, 'screenPatient'),
      user = userEvent.setup();
    mount('/eligibility/simulator?patientId=patient-011&date=2026-06-15');
    await screen.findByRole('heading', {
      name: 'A baseline screening is required',
    });
    await screen.findByText(/Reese Alden · patient-011/);
    expect(spy).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText('Hypothetical annual income (USD)'),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('link', { name: 'Run a baseline screening' }),
    );
    await screen.findByRole('heading', {
      name: 'Eligibility Screening',
      level: 1,
    });
    expect(spy).not.toHaveBeenCalled();
  });
  it('does not show another patient’s baseline and discards drafts on route exit', async () => {
    const user = userEvent.setup(),
      router = mount();
    await openSimulator(user);
    fireEvent.change(
      screen.getByLabelText('Hypothetical annual income (USD)'),
      { target: { value: '60000' } },
    );
    await act(async () =>
      router.navigate('/eligibility/simulator?patientId=patient-002'),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'A baseline screening is required',
      }),
    ).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    await act(async () =>
      router.navigate('/eligibility/simulator?patientId=patient-011'),
    );
    expect(
      await screen.findByLabelText('Hypothetical annual income (USD)'),
    ).toHaveValue('');
    expect(
      screen.getByText(
        /0 changed programs · 5 unchanged programs · 0 changed rules/,
      ),
    ).toBeVisible();
  });
});
