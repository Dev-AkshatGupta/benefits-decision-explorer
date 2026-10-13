import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { detectCoverageGaps } from '../domain/coverage';
import {
  getCoverage,
  getCoverageRecord,
  getCoverageOverview,
  getCoverageEvents,
  getPatientCoverageEvents,
  getPatientPeriods,
  createCoverage,
  updateCoverage,
  addCoverageEvent,
} from './coverage-api';
import type {
  CoverageFilters,
  CoverageRecord,
  CreateCoverage,
  UpdateCoverage,
  CreateEvent,
} from '../domain/coverage';
export const coverageKeys = {
  lists: ['coverage', 'lists'] as const,
  renewals: ['coverage', 'renewals'] as const,
  summary: ['coverage', 'summary'] as const,
  patient: (id: string) => ['coverage', 'patients', id] as const,
  detail: (id: string) => ['coverage', 'detail', id] as const,
  events: (id: string) => ['coverage', 'events', id] as const,
};
export function useCoverageRecords(filters: CoverageFilters, enabled = true) {
  return useQuery({
    queryKey: [...coverageKeys.lists, filters],
    queryFn: ({ signal }) => getCoverage(filters, signal),
    enabled,
  });
}
export function useUpcomingRenewals(filters: CoverageFilters, enabled = true) {
  return useQuery({
    queryKey: [...coverageKeys.renewals, filters],
    queryFn: ({ signal }) => getCoverage(filters, signal, undefined, true),
    enabled,
  });
}
export function usePatientCoverage(id: string, filters: CoverageFilters) {
  return useQuery({
    queryKey: [...coverageKeys.patient(id), 'list', filters],
    queryFn: ({ signal }) => getCoverage(filters, signal, id),
    enabled: !!id,
  });
}
export function usePatientPeriods(id: string) {
  return useQuery({
    queryKey: [...coverageKeys.patient(id), 'periods'],
    queryFn: ({ signal }) => getPatientPeriods(id, signal),
    enabled: !!id,
  });
}
export function usePatientCoverageHistory(id: string, date: string) {
  const select = useCallback(
    (records: CoverageRecord[]) => ({
      records,
      gaps: detectCoverageGaps(records, date),
    }),
    [date],
  );
  return useQuery({
    queryKey: [...coverageKeys.patient(id), 'periods'],
    queryFn: ({ signal }) => getPatientPeriods(id, signal),
    enabled: !!id,
    select,
  });
}
export function useCoverageRecord(id: string) {
  return useQuery({
    queryKey: coverageKeys.detail(id),
    queryFn: ({ signal }) => getCoverageRecord(id, signal),
    enabled: !!id,
  });
}
export function useCoverageEvents(id: string, enabled = true) {
  return useQuery({
    queryKey: coverageKeys.events(id),
    queryFn: ({ signal }) => getCoverageEvents(id, signal),
    enabled: !!id && enabled,
  });
}
export function usePatientTimelineEvents(id: string) {
  return useQuery({
    queryKey: [...coverageKeys.patient(id), 'events'],
    queryFn: ({ signal }) => getPatientCoverageEvents(id, signal),
    enabled: !!id,
  });
}
export function useCoverageOverview(date: string) {
  return useQuery({
    queryKey: [...coverageKeys.summary, date],
    queryFn: ({ signal }) => getCoverageOverview(date, signal),
  });
}
function useCoverageSync() {
  const client = useQueryClient();
  return async (record: CoverageRecord) => {
    await client.cancelQueries({ queryKey: coverageKeys.detail(record.id) });
    client.setQueryData(coverageKeys.detail(record.id), record);
    await Promise.all([
      client.invalidateQueries({ queryKey: coverageKeys.lists }),
      client.invalidateQueries({ queryKey: coverageKeys.renewals }),
      client.invalidateQueries({ queryKey: coverageKeys.summary }),
      client.invalidateQueries({
        queryKey: coverageKeys.patient(record.patientId),
      }),
    ]);
  };
}
export function useCreateCoverage() {
  const onSuccess = useCoverageSync();
  return useMutation({
    mutationFn: ({ value, key }: { value: CreateCoverage; key: string }) =>
      createCoverage(value, key),
    onSuccess,
  });
}
export function useUpdateCoverage() {
  const onSuccess = useCoverageSync();
  return useMutation({
    mutationFn: ({
      id,
      value,
      updatedAt,
    }: {
      id: string;
      value: UpdateCoverage;
      updatedAt: string;
    }) => updateCoverage(id, value, updatedAt),
    onSuccess,
  });
}
export function useAddCoverageEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      value,
      key,
    }: {
      id: string;
      value: CreateEvent;
      key: string;
    }) => addCoverageEvent(id, value, key),
    onSuccess: async (event) => {
      await client.invalidateQueries({
        queryKey: coverageKeys.events(event.coverageId),
      });
      await client.invalidateQueries({
        queryKey: [...coverageKeys.patient(event.patientId), 'events'],
      });
    },
  });
}
