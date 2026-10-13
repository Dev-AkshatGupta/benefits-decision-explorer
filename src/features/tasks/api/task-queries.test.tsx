import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { retryApiRead } from '@/lib/api/query-retry';
import { useTask, useCreateTask, taskKeys } from './task-queries';
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: retryApiRead, retryDelay: 0 } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
it('does not repeat a task 404', async () => {
  let requests = 0;
  server.use(
    http.get('/api/tasks/missing', () => {
      requests++;
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found.' } },
        { status: 404 },
      );
    }),
  );
  const { client, wrapper } = setup();
  const hook = renderHook(() => useTask('missing'), { wrapper });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(requests).toBe(1);
  hook.unmount();
  client.clear();
});
it('installs the server task and invalidates its worklists without touching patient/coverage state', async () => {
  const { client, wrapper } = setup();
  const list = [...taskKeys.lists, { page: 1 }],
    patient = [...taskKeys.patient('patient-001'), { page: 1 }];
  for (const key of [
    list,
    patient,
    taskKeys.overview,
    ['patients', 'detail', 'patient-001'],
    ['coverage', 'lists'],
  ])
    client.setQueryData(key, { sentinel: true });
  const hook = renderHook(useCreateTask, { wrapper });
  await act(async () => {
    await hook.result.current.mutateAsync({
      requestId: 'query-sync-test',
      value: {
        patientId: 'patient-001',
        title: 'Review fictional records',
        description: '',
        type: 'general',
        priority: 'medium',
        dueDate: null,
        assignedCoordinatorId: null,
      },
    });
  });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  const saved = hook.result.current.data!;
  expect(client.getQueryData(taskKeys.detail(saved.id))).toEqual(saved);
  for (const key of [list, patient, taskKeys.overview])
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  for (const key of [
    ['patients', 'detail', 'patient-001'],
    ['coverage', 'lists'],
  ])
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  hook.unmount();
  client.clear();
});
