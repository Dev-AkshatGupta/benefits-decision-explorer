import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import {
  usePatients,
  usePatient,
  usePatientHousehold,
  useCoordinators,
  useUpdatePatient,
  patientKeys,
  usePatientStats,
} from './patient-queries';
const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  return function Provider({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
describe('patient queries', () => {
  it('normalizes equivalent list query keys', () =>
    expect(patientKeys.list()).toEqual(
      patientKeys.list({
        page: 1,
        pageSize: 20,
        search: '',
        sortBy: 'fullName',
        sortOrder: 'asc',
      }),
    ));
  it('shares cached patient reads and exposes error states without retrying 404s', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(
      () => ({
        first: usePatient('patient-001'),
        second: usePatient('patient-001'),
      }),
      { wrapper: wrapper() },
    );
    await waitFor(() =>
      expect(
        result.current.first.isSuccess && result.current.second.isSuccess,
      ).toBe(true),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const unknown = renderHook(() => usePatient('unknown'), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(unknown.result.current.isError).toBe(true));
    expect(unknown.result.current.error).toMatchObject({ status: 404 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
  it('disables detail and household reads without an ID', () => {
    const { result } = renderHook(
      () => ({ patient: usePatient(''), household: usePatientHousehold('') }),
      { wrapper: wrapper() },
    );
    expect(result.current.patient.fetchStatus).toBe('idle');
    expect(result.current.household.fetchStatus).toBe('idle');
  });
  it('refreshes live list and household data and caches mutation results', async () => {
    const { result } = renderHook(
      () => ({
        patient: usePatient('patient-001'),
        household: usePatientHousehold('patient-001'),
        list: usePatients({ search: 'Avery Alden' }),
        coordinators: useCoordinators(),
        update: useUpdatePatient(),
        summary: usePatientStats(),
      }),
      { wrapper: wrapper() },
    );
    await waitFor(() =>
      expect(
        result.current.patient.isSuccess &&
          result.current.household.isSuccess &&
          result.current.list.isSuccess &&
          result.current.coordinators.isSuccess &&
          result.current.summary.isSuccess,
      ).toBe(true),
    );
    expect(result.current.list.data?.pagination.totalItems).toBe(1);
    expect(result.current.coordinators.data).toHaveLength(5);
    await act(async () => {
      await result.current.update.mutateAsync({
        patientId: 'patient-001',
        patch: { firstName: 'Changed', status: 'inactive' },
      });
    });
    await waitFor(() => {
      expect(result.current.patient.data?.firstName).toBe('Changed');
      expect(
        result.current.household.data?.members.find(
          (value) => value.relationship === 'self',
        )?.firstName,
      ).toBe('Changed');
      expect(result.current.list.data?.pagination.totalItems).toBe(0);
      expect(result.current.summary.data?.activePatients).toBe(49);
    });
  });
  it('does not alter cached patient data after a rejected mutation', async () => {
    const { result } = renderHook(
      () => ({
        patient: usePatient('patient-001'),
        update: useUpdatePatient(),
      }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.patient.isSuccess).toBe(true));
    const original = result.current.patient.data;
    await act(async () => {
      await expect(
        result.current.update.mutateAsync({
          patientId: 'patient-001',
          patch: { assignedCoordinatorId: 'unknown' },
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
    expect(result.current.patient.data).toEqual(original);
  });
});
