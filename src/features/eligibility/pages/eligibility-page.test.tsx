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
import { http, HttpResponse } from 'msw';
import { appRoutes } from '@/app/router/routes';
import { server } from '@/mocks/server';
import {
  getPatient,
  getPatientHousehold,
  updatePatient,
  updateHousehold,
} from '../../patients/api/patients-api';
import { patientKeys } from '../../patients/api/patient-queries';
import * as engine from '../engine/screen-patient';
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
function mount(path = '/eligibility?patientId=patient-001&date=2026-06-15') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30000 } },
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
    name: 'Eligibility Screening',
    level: 1,
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Run screening' })).toBeEnabled(),
  );
}
async function run(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Run screening' }));
  await screen.findByRole('article', {
    name: 'Demo Health Coverage (Fictional)',
  });
}
async function inspect(
  user: ReturnType<typeof userEvent.setup>,
  name = 'Demo Health Coverage',
) {
  await user.click(
    screen.getByRole('button', {
      name: new RegExp('Inspect Decision for ' + name),
    }),
  );
  return screen.findByRole('dialog', { name: new RegExp(name) });
}
describe('screening and decision inspector integration', () => {
  it('screens once, inspects pass/fail/unknown rules, closes with Escape and restores focus', async () => {
    const spy = vi.spyOn(engine, 'screenPatient'),
      user = userEvent.setup();
    const { router } = mount();
    await ready();
    expect(spy).not.toHaveBeenCalled();
    await run(user);
    expect(spy).toHaveBeenCalledTimes(1);
    const trigger = screen.getByRole('button', {
      name: /Inspect Decision for Demo Health Coverage/,
    });
    const dialog = await inspect(user);
    expect(router.state.location.search).toContain('programId=demo-health');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(
      within(dialog).getByText('2026.1', { selector: 'dd' }),
    ).toBeVisible();
    expect(within(dialog).getByText('2 passed')).toBeVisible();
    expect(within(dialog).getByText('1 failed')).toBeVisible();
    expect(within(dialog).getByText('1 unknown')).toBeVisible();
    await user.click(
      within(dialog).getByText('Maximum patient age', {
        selector: 'summary span',
      }),
    );
    expect(
      within(dialog).getByText('91', { selector: 'details[open] dd' }),
    ).toBeVisible();
    expect(
      within(dialog).getByText('64', { selector: 'details[open] dd' }),
    ).toBeVisible();
    expect(
      within(dialog).getByText(/At most \(≤\)/, {
        selector: 'details[open] dd',
      }),
    ).toBeVisible();
    expect(
      within(dialog.querySelector('details[open]') as HTMLElement).getByRole(
        'figure',
        { name: 'Numeric rule comparison' },
      ),
    ).toBeVisible();
    await user.click(
      within(dialog).getByText('Household income requirement', {
        selector: 'summary span',
      }),
    );
    expect(
      within(dialog).getByText('Unknown — information unavailable'),
    ).toBeVisible();
    expect(
      within(dialog).getByText('$35,000.00', { selector: 'dd' }),
    ).toBeVisible();
    expect(
      within(dialog).getByText(/Unknown rules remain unresolved/),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('list', { name: 'Policy references' }),
    ).toHaveTextContent('DEMO-HEALTH-2026.1 / INCOME-01 / 2026.1');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
    expect(router.state.location.search).not.toContain('programId=');
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => router.navigate(-1));
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => router.navigate(1));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('retains the evaluated income breakdown after source changes until an explicit rerun', async () => {
    const user = userEvent.setup(),
      { client } = mount('/eligibility?patientId=patient-002&date=2026-06-15');
    await ready();
    await run(user);
    const dialog = await inspect(user);
    expect(
      within(dialog).getByText('Derived annual total: $14,300.00'),
    ).toBeVisible();
    const household = await getPatientHousehold('patient-002');
    await updateHousehold(
      'patient-002',
      {
        incomeSources: [
          {
            id: 'updated-source',
            type: 'employment',
            frequency: 'monthly',
            amount: 200000,
          },
        ],
        incomeInformationStatus: 'complete',
      },
      household.updatedAt,
    );
    await act(async () =>
      client.invalidateQueries({
        queryKey: patientKeys.household('patient-002'),
      }),
    );
    expect(await within(dialog).findByText('Outdated results')).toBeVisible();
    expect(
      within(dialog).getByText('Derived annual total: $14,300.00'),
    ).toBeVisible();
    expect(
      within(dialog).queryByText('Derived annual total: $24,000.00'),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Rerun screening' }),
      ).toBeEnabled(),
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Rerun screening' }),
    );
    expect(
      await within(dialog).findByText('Derived annual total: $24,000.00'),
    ).toBeVisible();
    expect(
      within(dialog).queryByText('Derived annual total: $14,300.00'),
    ).not.toBeInTheDocument();
  });
  it('keeps original values after updates and reruns inside the open inspector', async () => {
    const user = userEvent.setup(),
      { client } = mount('/eligibility?patientId=patient-002&date=2026-06-15');
    await ready();
    await run(user);
    const dialog = await inspect(user);
    await user.click(
      within(dialog).getByText('Minimum patient age', {
        selector: 'summary span',
      }),
    );
    expect(
      within(dialog).getByText('84', { selector: 'details[open] dd' }),
    ).toBeVisible();
    const patient = await getPatient('patient-002');
    await updatePatient(
      patient.id,
      { dateOfBirth: '1990-01-01' },
      patient.updatedAt,
    );
    await act(async () => {
      await client.invalidateQueries({
        queryKey: patientKeys.detail(patient.id),
      });
      await client.invalidateQueries({
        queryKey: patientKeys.household(patient.id),
      });
    });
    expect(await within(dialog).findByText('Outdated results')).toBeVisible();
    expect(
      within(dialog).getByText('84', { selector: 'details[open] dd' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Rerun screening' }),
      ).toBeEnabled(),
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Rerun screening' }),
    );
    await waitFor(() =>
      expect(
        within(dialog).queryByText('Outdated results'),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(dialog).getByText('36', { selector: 'details[open] dd' }),
    ).toBeVisible();
    expect(
      within(dialog).queryByText('84', { selector: 'details[open] dd' }),
    ).not.toBeInTheDocument();
  });
  it('preserves snapshot and inspector URL through profile correction', async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await run(user);
    const dialog = await inspect(user);
    await user.click(
      within(dialog).getByRole('link', { name: 'Update Patient Information' }),
    );
    await screen.findByRole('heading', { name: 'Avery Alden', level: 1 });
    await user.click(
      screen.getByRole('button', { name: 'Edit household income' }),
    );
    await user.click(
      screen.getByLabelText(
        /I confirm this demonstration income report is complete/,
      ),
    );
    await user.click(
      screen.getByRole('button', { name: 'Save household income' }),
    );
    await screen.findByText('Household income saved.');
    expect(
      (await getPatientHousehold('patient-001')).incomeInformationStatus,
    ).toBe('complete');
    await user.click(screen.getByRole('link', { name: '← Back to screening' }));
    const reopened = await screen.findByRole('dialog');
    expect(within(reopened).getByText('Outdated results')).toBeVisible();
    expect(
      within(reopened).getByRole('heading', { name: 'Missing information' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        within(reopened).getByRole('button', { name: 'Rerun screening' }),
      ).toBeEnabled(),
    );
    await user.click(
      within(reopened).getByRole('button', { name: 'Rerun screening' }),
    );
    await waitFor(() =>
      expect(
        within(reopened).queryByRole('heading', {
          name: 'Missing information',
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(reopened).getByRole('heading', {
        name: 'Evaluated income breakdown',
      }),
    ).toBeVisible();
    expect(
      within(reopened).getByText('Derived annual total: $1,500.00'),
    ).toBeVisible();
  });
  it('marks date/program changes outdated and never displays another patient’s result', async () => {
    const user = userEvent.setup(),
      { router } = mount();
    await ready();
    await run(user);
    fireEvent.change(screen.getByLabelText('Evaluation date'), {
      target: { value: '2026-06-16' },
    });
    expect(screen.getByText(/Outdated results\./)).toBeVisible();
    await user.click(
      screen.getByRole('checkbox', { name: /Demo Health Coverage/ }),
    );
    await inspect(user);
    await user.click(
      screen.getByRole('button', { name: 'Close decision inspector' }),
    );
    await act(async () =>
      router.navigate(
        '/eligibility?patientId=patient-002&date=2026-06-15&programId=demo-health',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('article')).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/No matching decision/)).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Clear selected patient' }),
    );
    expect(router.state.location.search).not.toContain('patientId=');
  });
  it('guides deep links without results and does not automatically screen after refresh', async () => {
    const spy = vi.spyOn(engine, 'screenPatient');
    mount(
      '/eligibility?patientId=patient-001&date=2026-06-15&programId=demo-health',
    );
    await ready();
    expect(screen.getByText(/No matching decision/)).toBeVisible();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('handles policy gaps and empty program selections without fabricated outcomes', async () => {
    const user = userEvent.setup();
    mount('/eligibility?patientId=patient-001&date=2024-06-15');
    await ready();
    await user.click(screen.getByRole('button', { name: 'Run screening' }));
    await screen.findByText(/no policy effective on this date/);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    for (const checkbox of screen.getAllByRole('checkbox'))
      await user.click(checkbox);
    expect(
      screen.getByRole('button', { name: 'Run screening' }),
    ).toBeDisabled();
    expect(screen.getByText('Select at least one program.')).toBeVisible();
  });
  it('debounces remote patient search, supports arrow-key selection and empty results', async () => {
    const user = userEvent.setup();
    mount('/eligibility?date=2026-06-15');
    await screen.findByRole('heading', {
      name: 'Eligibility Screening',
      level: 1,
    });
    const input = screen.getByLabelText('Search by patient name');
    await user.type(input, 'Avery Alden');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Avery Alden, patient-001/ }),
      ).toBeEnabled(),
    );
    input.focus();
    await user.keyboard('{ArrowDown}{Enter}');
    await ready();
    await user.clear(input);
    await user.type(input, 'NoSuchSyntheticPerson');
    await screen.findByText('No patients match this name. Try another search.');
  });
  it('allows missing household information but blocks failed household requests', async () => {
    server.use(
      http.get('/api/patients/patient-001/household', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Not found' } },
          { status: 404 },
        ),
      ),
    );
    const user = userEvent.setup();
    mount();
    await ready();
    await run(user);
    const dialog = await inspect(user);
    expect(
      within(dialog).getByText('Unknown — information unavailable'),
    ).not.toBeVisible(); // Details are collapsed.
    expect(
      within(dialog).getByRole('heading', { name: 'Missing information' }),
    ).toBeVisible();
  });
  it('blocks failed household loads, supports retry, and preserves results after a failed refresh', async () => {
    let unavailable = true;
    server.use(
      http.get('/api/patients/patient-001/household', () =>
        unavailable
          ? HttpResponse.json(
              { error: { code: 'INVALID_REQUEST', message: 'Unavailable' } },
              { status: 500 },
            )
          : undefined,
      ),
    );
    const user = userEvent.setup(),
      { client } = mount();
    await screen.findByText(
      'Household information could not be loaded. Retry before screening.',
      {},
      { timeout: 5000 },
    );
    expect(
      screen.getByRole('button', { name: 'Run screening' }),
    ).toBeDisabled();
    unavailable = false;
    await user.click(
      screen.getByRole('button', { name: 'Retry household data' }),
    );
    await ready();
    await run(user);
    unavailable = true;
    await user.click(screen.getByRole('button', { name: 'Rerun screening' }));
    await waitFor(
      () =>
        expect(
          screen.getByText(/Current patient information could not be loaded/),
        ).toBeVisible(),
      { timeout: 5000 },
    );
    expect(
      screen.getByRole('article', { name: 'Demo Health Coverage (Fictional)' }),
    ).toBeVisible();
    unavailable = false;
    await act(async () =>
      client.invalidateQueries({
        queryKey: patientKeys.household('patient-001'),
      }),
    );
  });
  it('handles patient/search errors with retry and patient-not-found deep links', async () => {
    let unavailable = true;
    server.use(
      http.get('/api/patients', () =>
        unavailable
          ? HttpResponse.json(
              { error: { code: 'INVALID_REQUEST', message: 'Unavailable' } },
              { status: 500 },
            )
          : undefined,
      ),
    );
    const user = userEvent.setup();
    mount('/eligibility?patientId=unknown&date=2026-06-15');
    await screen.findByText('Selected patient not found.');
    await screen.findByText(
      'Patient search could not be loaded.',
      {},
      { timeout: 5000 },
    );
    expect(
      screen.getByRole('button', { name: 'Run screening' }),
    ).toBeDisabled();
    unavailable = false;
    await user.click(
      screen.getByRole('button', { name: 'Retry patient search' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: 'Avery Alden, patient-001, CO',
      }),
    );
    await ready();
  });
  it('loads only a bounded page and supports pagination and all patient-option keys', async () => {
    const user = userEvent.setup();
    mount('/eligibility');
    const results = await screen.findByRole('list', {
      name: 'Patient search results',
    });
    await waitFor(() =>
      expect(within(results).getAllByRole('button')).toHaveLength(10),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 15');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('Page 1 of 15');
    const input = screen.getByLabelText('Search by patient name');
    input.focus();
    await user.keyboard('{ArrowUp}');
    const choices = within(results).getAllByRole('button');
    expect(choices[choices.length - 1]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(choices[0]).toHaveFocus();
    await user.keyboard('{End}');
    expect(choices[choices.length - 1]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(choices[0]).toHaveFocus();
  });
});
