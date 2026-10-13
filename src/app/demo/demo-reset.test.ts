import { it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { mockDatabase } from '@/mocks/data/database';
import { resetDemoData } from './demo-api';
import {
  finishDemoReset,
  isConfirmedDemoResetNavigation,
} from './reset-session';
it('restores every repository, including request-deduplication maps, deterministically', async () => {
  const before = structuredClone(mockDatabase);
  mockDatabase.patients[0]!.firstName = 'Changed';
  mockDatabase.households[0]!.householdSize = 49;
  mockDatabase.coordinators[0]!.firstName = 'Changed';
  mockDatabase.tasks.pop();
  mockDatabase.coverage.pop();
  mockDatabase.coverageEvents.pop();
  mockDatabase.taskRequests.set('test', {
    signature: 'changed',
    taskId: 'new',
  });
  mockDatabase.coverageRequests.set('test', {
    signature: 'changed',
    id: 'new',
  });
  const response = await resetDemoData();
  expect(response.status).toBe('reset');
  expect(mockDatabase).toEqual(before);
  expect(await resetDemoData()).toEqual(response);
});
it('requires explicit confirmation before touching fixtures', async () => {
  mockDatabase.patients[0]!.firstName = 'Preserved';
  const response = await fetch('/api/demo/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmReset: false }),
  });
  expect(response.status).toBe(400);
  expect(mockDatabase.patients[0]!.firstName).toBe('Preserved');
});
it('clears all query/mutation caches before navigation and bypasses draft guards only for the confirmed reload', async () => {
  const client = new QueryClient();
  client.setQueryData(['patients', 'detail', 'patient-001'], { stale: true });
  client.setQueryData(['policy-population'], { stale: true });
  client.getMutationCache().build(client, { mutationFn: async () => true });
  expect(client.getMutationCache().getAll()).toHaveLength(1);
  const draftGuard = vi.fn(() => {
    if (!isConfirmedDemoResetNavigation()) protectedDraft();
  });
  const protectedDraft = vi.fn();
  window.addEventListener('beforeunload', draftGuard);
  finishDemoReset(client, () => {
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    window.dispatchEvent(new Event('beforeunload'));
  });
  expect(protectedDraft).not.toHaveBeenCalled();
  await Promise.resolve();
  window.dispatchEvent(new Event('beforeunload'));
  expect(protectedDraft).toHaveBeenCalledTimes(1);
  window.removeEventListener('beforeunload', draftGuard);
  client.clear();
});
it('restores ordinary unload protection if navigation fails', () => {
  const client = new QueryClient(),
    draftGuard = vi.fn();
  window.addEventListener('beforeunload', draftGuard);
  expect(() =>
    finishDemoReset(client, () => {
      throw new Error('Cannot navigate');
    }),
  ).toThrow('Cannot navigate');
  window.dispatchEvent(new Event('beforeunload'));
  expect(draftGuard).toHaveBeenCalledTimes(1);
  window.removeEventListener('beforeunload', draftGuard);
  client.clear();
});
