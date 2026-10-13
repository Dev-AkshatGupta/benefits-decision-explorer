import { queryOptions, useQuery } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/client';
import { retryApiRead } from '@/lib/api/query-retry';
import {
  populationResponseSchema,
  populationVersionSchema,
} from '../domain/population';
export const populationKeys = {
  root: ['policy-population'] as const,
  version: ['policy-population', 'version'] as const,
};
export function getPolicyPopulation(signal?: AbortSignal) {
  return requestJson(
    '/api/policy-population',
    populationResponseSchema,
    signal ? { signal } : {},
  );
}
export const populationVersionOptions = () =>
  queryOptions({
    queryKey: populationKeys.version,
    queryFn: ({ signal }) =>
      requestJson('/api/policy-population/version', populationVersionSchema, {
        signal,
      }),
    staleTime: 5000,
    retry: retryApiRead,
  });
export function usePopulationVersion(enabled: boolean) {
  return useQuery({
    ...populationVersionOptions(),
    enabled,
    refetchInterval: enabled ? 15000 : false,
  });
}
