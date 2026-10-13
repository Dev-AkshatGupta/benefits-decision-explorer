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
import { StrictMode } from 'react';
import { http, HttpResponse } from 'msw';
import { appRoutes } from '@/app/router/routes';
import { server } from '@/mocks/server';
import {
  getPatient,
  getPatientHousehold,
  updatePatient,
  updateHousehold,
} from '../api/patients-api';
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
function renderProfile(path = '/patients/patient-001') {
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
async function ready(name = 'Avery Alden') {
  await screen.findByRole('heading', { level: 1, name }, { timeout: 5000 });
  await screen.findByRole('region', { name: 'Household Members' });
}
async function editProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Edit Profile' }));
  return screen.getByRole('dialog', { name: 'Edit patient profile' });
}
describe('patient profile and household editors', () => {
  it('preserves household drafts across external updates and reloads conflicts explicitly', async () => {
    const user = userEvent.setup();
    const { client } = renderProfile();
    await ready();
    await user.click(
      screen.getByRole('button', { name: 'Edit household income' }),
    );
    const section = screen.getByRole('region', { name: 'Household Income' });
    const amount = within(section).getAllByLabelText(/Amount per payment/)[0]!;
    await user.clear(amount);
    await user.type(amount, '500');
    const current = await getPatientHousehold('patient-001');
    await updateHousehold(
      'patient-001',
      { incomeSources: [] },
      current.updatedAt,
    );
    await act(async () =>
      client.invalidateQueries({
        queryKey: ['patients', 'household', 'patient-001'],
      }),
    );
    expect(amount).toHaveValue('500');
    await user.click(
      within(section).getByRole('button', { name: 'Save household income' }),
    );
    expect(
      await within(section).findByText('This record has changed'),
    ).toBeVisible();
    await user.click(
      within(section).getByRole('button', { name: 'Reload current data' }),
    );
    await waitFor(() =>
      expect(
        within(section).queryAllByLabelText(/Amount per payment/),
      ).toHaveLength(0),
    );
    await user.click(within(section).getByRole('button', { name: 'Cancel' }));
    expect(
      within(section).getByText('No income sources recorded.'),
    ).toBeVisible();
  });
  it('loads complete read-only sections and handles unknown/missing households independently', async () => {
    const { router } = renderProfile();
    await ready();
    for (const name of [
      'Personal Information',
      'Contact & Address',
      'Household Members',
      'Household Income',
      'Profile Summary',
    ])
      expect(screen.getByRole('region', { name })).toBeVisible();
    expect(
      within(
        screen.getByRole('region', { name: 'Personal Information' }),
      ).getByText('Not provided'),
    ).toBeVisible();
    await act(async () => router.navigate('/patients/unknown'));
    expect(
      await screen.findByRole('heading', { name: 'Patient not found' }),
    ).toBeVisible();
  });
  it('keeps the profile usable when household loading fails and supports retry', async () => {
    server.use(
      http.get('/api/patients/:patientId/household', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'missing' } },
          { status: 404 },
        ),
      ),
    );
    renderProfile();
    await screen.findByRole('heading', { level: 1, name: 'Avery Alden' });
    expect(
      await screen.findByText(
        'Household not found. The patient profile is still available.',
      ),
    ).toBeVisible();
    const user = userEvent.setup();
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Retry household' }));
    await screen.findByRole('region', { name: 'Household Members' });
  });
  it('edits personal information and synchronizes the household primary patient', async () => {
    const user = userEvent.setup();
    renderProfile();
    await ready();
    const dialog = await editProfile(user);
    const input = within(dialog).getByLabelText(/First name/);
    await user.clear(input);
    await user.type(input, 'Updated');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save profile' }),
    );
    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Updated Alden' }),
    ).toBeVisible();
    expect(
      (await getPatientHousehold('patient-001')).members[0]?.firstName,
    ).toBe('Updated');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit Profile' }),
      ).toHaveFocus(),
    );
  });
  it('rejects future birth dates and invalid optional contact fields before saving', async () => {
    const user = userEvent.setup();
    renderProfile();
    await ready();
    const dialog = await editProfile(user);
    fireEvent.change(within(dialog).getByLabelText(/Date of birth/), {
      target: { value: '2099-01-01' },
    });
    await user.type(within(dialog).getByLabelText(/Email/), 'invalid');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save profile' }),
    );
    expect(
      await within(dialog).findByText('Date of birth cannot be in the future'),
    ).toBeVisible();
    expect(within(dialog).getByLabelText(/Date of birth/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect((await getPatient('patient-001')).dateOfBirth).not.toBe(
      '2099-01-01',
    );
  });
  it('clears optional demographic/contact values and cancel discards a later draft', async () => {
    const user = userEvent.setup();
    renderProfile('/patients/patient-002');
    await ready('Jordan Alden');
    let dialog = await editProfile(user);
    await user.clear(within(dialog).getByLabelText(/Email/));
    await user.clear(within(dialog).getByLabelText(/Phone number/));
    await user.selectOptions(within(dialog).getByLabelText(/Gender/), '');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save profile' }),
    );
    await screen.findByText('Profile saved.');
    expect(await getPatient('patient-002')).toMatchObject({
      firstName: 'Jordan',
    });
    expect((await getPatient('patient-002')).email).toBeUndefined();
    dialog = await editProfile(user);
    await user.clear(within(dialog).getByLabelText(/First name/));
    await user.type(within(dialog).getByLabelText(/First name/), 'Discarded');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Jordan Alden' })).toBeVisible();
    dialog = await editProfile(user);
    expect(within(dialog).getByLabelText(/First name/)).toHaveValue('Jordan');
  });
  it('preserves the editable draft after a failed save and retries', async () => {
    server.use(
      http.patch('/api/patients/:patientId', () =>
        HttpResponse.json(
          { error: { code: 'INVALID_REQUEST', message: 'internal details' } },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderProfile();
    await ready();
    const dialog = await editProfile(user);
    await user.clear(within(dialog).getByLabelText(/First name/));
    await user.type(within(dialog).getByLabelText(/First name/), 'Preserved');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save profile' }),
    );
    expect(
      await within(dialog).findByText('Changes could not be saved'),
    ).toBeVisible();
    expect(within(dialog).getByLabelText(/First name/)).toHaveValue(
      'Preserved',
    );
    expect(screen.queryByText('internal details')).not.toBeInTheDocument();
    server.resetHandlers();
    await user.click(
      within(dialog).getByRole('button', { name: 'Save profile' }),
    );
    await screen.findByRole('heading', { name: 'Preserved Alden' });
  });
  it('adds, edits, and removes household members with a derived size and protected primary', async () => {
    const user = userEvent.setup();
    renderProfile();
    await ready();
    await user.click(
      screen.getByRole('button', { name: 'Edit household members' }),
    );
    const section = screen.getByRole('region', { name: 'Household Members' });
    expect(
      within(section).queryByRole('button', { name: 'Remove member 1' }),
    ).not.toBeInTheDocument();
    expect(within(section).getByLabelText(/First name/)).toHaveAttribute(
      'readonly',
    );
    await user.click(
      within(section).getByRole('button', { name: 'Add household member' }),
    );
    let member = within(section).getByRole('group', { name: 'Member 2' });
    await user.type(within(member).getByLabelText(/First name/), 'Fictional');
    await user.type(within(member).getByLabelText(/Last name/), 'Member');
    fireEvent.change(within(member).getByLabelText(/Date of birth/), {
      target: { value: '1980-01-01' },
    });
    await user.click(
      within(section).getByRole('button', { name: 'Save household members' }),
    );
    await screen.findByText('Household members saved.');
    let data = await getPatientHousehold('patient-001');
    expect(data.householdSize).toBe(2);
    const stableId = data.members[1]!.id;
    await user.click(
      screen.getByRole('button', { name: 'Edit household members' }),
    );
    member = within(section).getByRole('group', { name: 'Member 2' });
    await user.clear(within(member).getByLabelText(/First name/));
    await user.type(within(member).getByLabelText(/First name/), 'Changed');
    await user.click(
      within(section).getByRole('button', { name: 'Save household members' }),
    );
    await screen.findByText('Household members saved.');
    data = await getPatientHousehold('patient-001');
    expect(data.members[1]).toMatchObject({
      id: stableId,
      firstName: 'Changed',
    });
    await user.click(
      screen.getByRole('button', { name: 'Edit household members' }),
    );
    await user.click(
      within(section).getByRole('button', { name: 'Remove member 2' }),
    );
    await user.click(
      within(section).getByRole('button', { name: 'Save household members' }),
    );
    await screen.findByText('Household members saved.');
    expect((await getPatientHousehold('patient-001')).householdSize).toBe(1);
  });
  it('adds, edits, and removes income with exact annual previews and summary updates', async () => {
    const user = userEvent.setup();
    renderProfile();
    await ready();
    await user.click(
      screen.getByRole('button', { name: 'Edit household income' }),
    );
    const section = screen.getByRole('region', { name: 'Household Income' });
    await user.click(
      within(section).getByRole('button', { name: 'Add income source' }),
    );
    const source = within(section).getByRole('group', {
      name: 'Income source 3',
    });
    const amount = within(source).getByLabelText(/Amount per payment/);
    await user.clear(amount);
    await user.type(amount, '2000.00');
    expect(within(source).getByText('$24,000.00')).toBeVisible();
    expect(within(section).getByText('$25,500.00')).toBeVisible();
    await user.click(
      within(section).getByRole('button', { name: 'Save household income' }),
    );
    await screen.findByText('Household income saved.');
    expect(
      within(screen.getByRole('region', { name: 'Profile Summary' })).getByText(
        '$25,500.00',
      ),
    ).toBeVisible();
    const stableId = (await getPatientHousehold('patient-001'))
      .incomeSources[2]!.id;
    await user.click(
      screen.getByRole('button', { name: 'Edit household income' }),
    );
    const secondAmount = within(
      within(section).getByRole('group', { name: 'Income source 3' }),
    ).getByLabelText(/Amount per payment/);
    await user.clear(secondAmount);
    await user.type(secondAmount, '1000.00');
    await user.click(
      within(section).getByRole('button', { name: 'Save household income' }),
    );
    await screen.findByText('Household income saved.');
    expect(
      (await getPatientHousehold('patient-001')).incomeSources[2],
    ).toMatchObject({ id: stableId, amount: 100000 });
    await user.click(
      screen.getByRole('button', { name: 'Edit household income' }),
    );
    await user.click(
      within(section).getByRole('button', { name: 'Remove income source 3' }),
    );
    await user.click(
      within(section).getByRole('button', { name: 'Save household income' }),
    );
    await screen.findByText('Household income saved.');
    expect((await getPatientHousehold('patient-001')).totalAnnualIncome).toBe(
      150000,
    );
  });
  it('rejects negative source amounts and cancels income changes', async () => {
    const user = userEvent.setup();
    renderProfile();
    await ready();
    await user.click(
      screen.getByRole('button', { name: 'Edit household income' }),
    );
    const section = screen.getByRole('region', { name: 'Household Income' });
    const amount = within(section).getAllByLabelText(/Amount per payment/)[0]!;
    await user.clear(amount);
    await user.type(amount, '-1');
    await user.click(
      within(section).getByRole('button', { name: 'Save household income' }),
    );
    expect(
      await within(section).findByText(
        'Enter a non-negative dollar amount with up to two decimal places.',
      ),
    ).toBeVisible();
    await user.click(within(section).getByRole('button', { name: 'Cancel' }));
    expect((await getPatientHousehold('patient-001')).totalAnnualIncome).toBe(
      150000,
    );
  });
  it('preserves a draft across refetch and detects conflict before explicit reload', async () => {
    const user = userEvent.setup();
    const { client } = renderProfile();
    await ready();
    const dialog = await editProfile(user);
    await user.clear(within(dialog).getByLabelText(/First name/));
    await user.type(within(dialog).getByLabelText(/First name/), 'Draft');
    const current = await getPatient('patient-001');
    await updatePatient(
      current.id,
      { firstName: 'External' },
      current.updatedAt,
    );
    await act(async () =>
      client.invalidateQueries({
        queryKey: ['patients', 'detail', 'patient-001'],
      }),
    );
    expect(within(dialog).getByLabelText(/First name/)).toHaveValue('Draft');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save profile' }),
    );
    expect(
      await within(dialog).findByText('This record has changed'),
    ).toBeVisible();
    expect((await getPatient('patient-001')).firstName).toBe('External');
    await user.click(
      within(dialog).getByRole('button', { name: 'Reload current data' }),
    );
    await waitFor(() =>
      expect(within(dialog).getByLabelText(/First name/)).toHaveValue(
        'External',
      ),
    );
  });
  it('warns for unsaved route and browser navigation, and preserves worklist return context', async () => {
    const user = userEvent.setup();
    const { router } = renderProfile();
    await ready();
    await user.click(
      screen.getByRole('button', { name: 'Edit household income' }),
    );
    const section = screen.getByRole('region', { name: 'Household Income' });
    const amount = within(section).getAllByLabelText(/Amount per payment/)[0]!;
    await user.clear(amount);
    await user.type(amount, '100');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('link', { name: /Back to patients/ }));
    const warning = await screen.findByRole('dialog', {
      name: 'Discard unsaved changes?',
    });
    await user.click(
      within(warning).getByRole('button', { name: 'Keep editing' }),
    );
    expect(router.state.location.pathname).toBe('/patients/patient-001');
    await user.click(screen.getByRole('link', { name: /Back to patients/ }));
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Discard unsaved changes?' }),
      ).getByRole('button', { name: 'Discard changes' }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/patients'),
    );
    expect((await getPatientHousehold('patient-001')).totalAnnualIncome).toBe(
      150000,
    );
  });
  it('warns before dismissing a dirty profile dialog and preserves focus when kept', async () => {
    const user = userEvent.setup();
    renderProfile();
    await ready();
    const dialog = await editProfile(user);
    await user.clear(within(dialog).getByLabelText(/First name/));
    await user.type(within(dialog).getByLabelText(/First name/), 'Draft');
    await user.click(
      within(dialog).getByRole('button', { name: 'Close profile editor' }),
    );
    const warning = await screen.findByRole('dialog', {
      name: 'Discard unsaved changes?',
    });
    await user.click(
      within(warning).getByRole('button', { name: 'Keep editing' }),
    );
    expect(within(dialog).getByLabelText(/First name/)).toHaveValue('Draft');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit Profile' })).toHaveFocus();
  });
});
