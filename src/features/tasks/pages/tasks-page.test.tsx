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
import { updateTask } from '../api/tasks-api';
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
function mount(path = '/tasks?patientId=patient-001') {
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
  await screen.findByRole('heading', {
    name: 'Care Coordination Tasks',
    level: 1,
    hidden: true,
  });
  await screen.findByRole('region', { name: 'Task worklist', hidden: true });
}
it('renders global overview, debounces search, changes URL filters and paginates on the server', async () => {
  const user = userEvent.setup(),
    { router } = mount('/tasks');
  await ready();
  expect(screen.getByLabelText('Task overview')).toHaveTextContent(
    'Open tasks150',
  );
  await user.click(screen.getByRole('button', { name: 'Next task page' }));
  await waitFor(() => expect(router.state.location.search).toContain('page=2'));
  await user.type(screen.getByLabelText('Search tasks'), 'income verification');
  await waitFor(() =>
    expect(router.state.location.search).toContain('search=income'),
  );
  await user.selectOptions(screen.getByLabelText('Status'), 'completed');
  await waitFor(() =>
    expect(router.state.location.search).toContain('status=completed'),
  );
  expect(router.state.location.search).toContain('page=1');
});
it('validates creation and saves one reviewed task, then completes/reopens with synchronized metrics', async () => {
  const user = userEvent.setup();
  mount();
  await ready();
  await user.click(screen.getByRole('button', { name: 'Create Task' }));
  const form = await screen.findByRole('dialog', { name: 'Create task' });
  await waitFor(() =>
    expect(
      within(form).getByRole('button', { name: 'Save task' }),
    ).toBeEnabled(),
  );
  await user.click(within(form).getByRole('button', { name: 'Save task' }));
  expect(await within(form).findByRole('alert')).toHaveTextContent(
    'Task title',
  );
  await user.type(
    within(form).getByLabelText(/Task title/),
    'Verify fictional income',
  );
  await user.selectOptions(within(form).getByLabelText(/Priority/), 'urgent');
  await user.selectOptions(
    within(form).getByLabelText(/Assigned coordinator/),
    'coordinator-001',
  );
  fireEvent.change(within(form).getByLabelText(/Due date/), {
    target: { value: '2026-10-08' },
  });
  await user.dblClick(within(form).getByRole('button', { name: 'Save task' }));
  const details = await screen.findByRole('dialog', { name: 'Task details' });
  expect(mockDatabase.tasks).toHaveLength(251);
  await user.click(
    within(details).getByRole('button', { name: 'Complete task' }),
  );
  await user.type(
    within(details).getByLabelText('Completion note (optional)'),
    'Received synthetic documentation.',
  );
  await user.click(
    within(details).getByRole('button', { name: 'Confirm status change' }),
  );
  await within(details).findByRole('heading', {
    name: 'Completion information',
  });
  expect(
    within(details).getByText('Received synthetic documentation.'),
  ).toBeVisible();
  await user.click(
    within(details).getByRole('button', { name: 'Reopen task' }),
  );
  await user.click(
    within(details).getByRole('button', { name: 'Confirm status change' }),
  );
  await waitFor(() =>
    expect(
      within(details).queryByRole('heading', {
        name: 'Completion information',
      }),
    ).not.toBeInTheDocument(),
  );
  expect(mockDatabase.tasks.at(-1)?.completionNote).toBe('');
});
it('preserves a failed creation draft and permits retry', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('/api/tasks', () =>
      HttpResponse.json(
        { error: { code: 'CONFLICT', message: 'Temporary creation failure' } },
        { status: 409 },
      ),
    ),
  );
  mount();
  await ready();
  await user.click(screen.getByRole('button', { name: 'Create Task' }));
  const dialog = await screen.findByRole('dialog', { name: 'Create task' });
  await user.type(
    within(dialog).getByLabelText(/Task title/),
    'Keep this draft',
  );
  await user.click(within(dialog).getByRole('button', { name: 'Save task' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Temporary creation failure',
  );
  expect(within(dialog).getByLabelText(/Task title/)).toHaveValue(
    'Keep this draft',
  );
  server.resetHandlers();
  await user.click(within(dialog).getByRole('button', { name: 'Save task' }));
  await screen.findByRole('dialog', { name: 'Task details' });
});
it('guards unsaved edits and rejects overwriting a concurrently changed task', async () => {
  const user = userEvent.setup();
  mount('/tasks?task=task-001');
  await ready();
  const details = await screen.findByRole('dialog', { name: 'Task details' });
  await within(details).findByText('Request household income verification');
  await user.click(within(details).getByRole('button', { name: 'Edit task' }));
  const editor = await screen.findByRole('dialog', { name: 'Edit task' });
  await user.clear(within(editor).getByLabelText(/Task title/));
  await user.type(within(editor).getByLabelText(/Task title/), 'My draft');
  await user.keyboard('{Escape}');
  const confirm = await screen.findByRole('dialog', {
    name: 'Discard unsaved changes?',
  });
  await user.click(
    within(confirm).getByRole('button', { name: 'Keep editing' }),
  );
  const task = mockDatabase.tasks[0]!;
  await act(() =>
    updateTask(task.id, { title: 'Concurrent title' }, task.updatedAt),
  );
  await user.click(within(editor).getByRole('button', { name: 'Save task' }));
  expect(await within(editor).findByRole('alert')).toHaveTextContent('changed');
  expect(within(editor).getByLabelText(/Task title/)).toHaveValue('My draft');
  expect(mockDatabase.tasks[0]?.title).toBe('Concurrent title');
});
it('shows patient tasks and preselects the patient for creation', async () => {
  const user = userEvent.setup();
  mount('/patients/patient-001');
  const section = await screen.findByRole('region', {
    name: 'Patient care coordination tasks',
  });
  await user.click(
    within(section).getByRole('button', {
      name: 'Create Task for This Patient',
    }),
  );
  const editor = await screen.findByRole('dialog', { name: 'Create task' });
  expect(within(editor).getByText(/Patient: patient-001/)).toBeVisible();
  await user.type(
    within(editor).getByLabelText(/Task title/),
    'Profile follow-up',
  );
  await user.click(within(editor).getByRole('button', { name: 'Save task' }));
  const details = await screen.findByRole('dialog', { name: 'Task details' });
  expect(
    await within(details).findByRole('heading', { name: 'Profile follow-up' }),
  ).toBeVisible();
  expect(mockDatabase.tasks.at(-1)?.patientId).toBe('patient-001');
});
it('prepopulates reviewed eligibility follow-ups and prevents duplicate creation', async () => {
  const user = userEvent.setup();
  mount('/eligibility?patientId=patient-012&date=2026-06-15');
  await screen.findByRole('heading', {
    name: 'Eligibility Screening',
    level: 1,
    hidden: true,
  });
  const run = screen.getByRole('button', { name: 'Run screening' });
  await waitFor(() => expect(run).toBeEnabled());
  await user.click(run);
  const follow = await screen.findAllByRole('button', {
    name: /^Create Follow-up Task for/,
  });
  await user.click(follow[0]!);
  const editor = await screen.findByRole('dialog', { name: 'Create task' });
  expect(within(editor).getByLabelText(/Task type/)).toHaveValue(
    'eligibility_follow_up',
  );
  expect(within(editor).getByText(/Patient: patient-012/)).toBeVisible();
  expect(mockDatabase.tasks).toHaveLength(250);
  await user.click(within(editor).getByRole('button', { name: 'Save task' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(mockDatabase.tasks.at(-1)?.source?.screening?.evaluationDate).toBe(
    '2026-06-15',
  );
  await user.click(follow[0]!);
  const duplicate = await screen.findByRole('dialog', { name: 'Create task' });
  await user.click(
    within(duplicate).getByRole('button', { name: 'Save task' }),
  );
  expect(await within(duplicate).findByRole('alert')).toHaveTextContent(
    'already exists',
  );
  expect(mockDatabase.tasks).toHaveLength(251);
});
it('handles empty, invalid filters and API errors', async () => {
  const { router } = mount('/tasks?search=no-such-task');
  await ready();
  expect(screen.getByText('No tasks match these filters.')).toBeVisible();
  await act(() =>
    router.navigate('/tasks?dueFrom=2026-10-20&dueTo=2026-10-01'),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid task filters',
  );
  server.use(
    http.get('/api/tasks', () => new HttpResponse(null, { status: 503 })),
  );
  await act(() => router.navigate('/tasks'));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Tasks could not load',
  );
});
it('selects patients by remote name search without submitting the task', async () => {
  const user = userEvent.setup();
  mount('/tasks');
  await ready();
  await user.click(screen.getByRole('button', { name: 'Create Task' }));
  const editor = await screen.findByRole('dialog', { name: 'Create task' });
  await user.type(
    within(editor).getByLabelText(/Task title/),
    'Explicitly reviewed task',
  );
  await user.type(
    within(editor).getByLabelText('Search by patient name'),
    'Avery Alden',
  );

  await waitFor(() =>
    expect(
      within(editor).getByRole('button', {
        name: 'Avery Alden, patient-001, CO',
      }),
    ).toBeEnabled(),
  );
  await user.click(
    within(editor).getByRole('button', {
      name: 'Avery Alden, patient-001, CO',
    }),
  );
  expect(mockDatabase.tasks).toHaveLength(250);
  expect(editor).toBeInTheDocument();
  await user.click(within(editor).getByRole('button', { name: 'Save task' }));
  await screen.findByRole('dialog', { name: 'Task details' });
  expect(mockDatabase.tasks).toHaveLength(251);
});
