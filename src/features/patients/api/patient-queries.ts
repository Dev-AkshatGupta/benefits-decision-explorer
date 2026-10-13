import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { retryApiRead as retry } from '@/lib/api/query-retry';
import {
  patientListParamsSchema,
  type PatientListParams,
  type PatientPatch,
  type HouseholdPatch,
} from '../domain/schemas';
import {
  getPatients,
  getPatient,
  getPatientHousehold,
  getCoordinators,
  updatePatient,
  getPatientStats,
  updateHousehold,
} from './patients-api';
export const patientKeys = {
  all: ['patients'] as const,
  lists: ['patients', 'list'] as const,
  summary: ['patients', 'summary'] as const,
  list: (params: PatientListParams = {}) =>
    ['patients', 'list', patientListParamsSchema.parse(params)] as const,
  detail: (id: string) => ['patients', 'detail', id] as const,
  household: (id: string) => ['patients', 'household', id] as const,
};
export const patientsQueryOptions = (params: PatientListParams = {}) => {
  const normalized = patientListParamsSchema.parse(params);
  return queryOptions({
    queryKey: patientKeys.list(params),
    queryFn: ({ signal }) => getPatients(params, signal),
    retry,
    placeholderData: (previous, previousQuery) => {
      const before = patientListParamsSchema.safeParse(
        previousQuery?.queryKey[2],
      );
      // Only retain rows across pagination changes, never across changed filters/sort.
      return before.success &&
        JSON.stringify({ ...before.data, page: 1, pageSize: 20 }) ===
          JSON.stringify({ ...normalized, page: 1, pageSize: 20 })
        ? previous
        : undefined;
    },
  });
};
export function usePatientStats() {
  return useQuery({
    queryKey: patientKeys.summary,
    queryFn: ({ signal }) => getPatientStats(signal),
    retry,
  });
}
export const patientQueryOptions = (id: string) =>
  queryOptions({
    queryKey: patientKeys.detail(id),
    queryFn: ({ signal }) => getPatient(id, signal),
    enabled: id.length > 0,
    retry,
  });
export const householdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: patientKeys.household(id),
    queryFn: ({ signal }) => getPatientHousehold(id, signal),
    enabled: id.length > 0,
    retry,
  });
export const coordinatorsQueryOptions = () =>
  queryOptions({
    queryKey: ['coordinators'] as const,
    queryFn: ({ signal }) => getCoordinators(signal),
    staleTime: 300_000,
    retry,
  });
export function usePatients(params: PatientListParams = {}) {
  return useQuery(patientsQueryOptions(params));
}
export function usePatient(id: string) {
  return useQuery(patientQueryOptions(id));
}
export function usePatientHousehold(id: string) {
  return useQuery(householdQueryOptions(id));
}
export function useCoordinators() {
  return useQuery(coordinatorsQueryOptions());
}
export function useUpdatePatient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      patch,
      expectedUpdatedAt,
    }: {
      patientId: string;
      patch: PatientPatch;
      expectedUpdatedAt?: string;
    }) => updatePatient(patientId, patch, expectedUpdatedAt),
    onSuccess: async (patient, variables) => {
      // Cancel older reads before writing the authoritative mutation response.
      await client.cancelQueries({ queryKey: patientKeys.detail(patient.id) });
      client.setQueryData(patientKeys.detail(patient.id), patient);
      await Promise.all([
        client.invalidateQueries({ queryKey: patientKeys.lists }),
        client.invalidateQueries({ queryKey: patientKeys.summary }),
        client.invalidateQueries({ queryKey: ['policy-population'] }),
        ...(variables.patch.firstName !== undefined ||
        variables.patch.lastName !== undefined ||
        variables.patch.assignedCoordinatorId !== undefined
          ? [
              client.invalidateQueries({ queryKey: ['coverage', 'lists'] }),
              client.invalidateQueries({ queryKey: ['coverage', 'renewals'] }),
            ]
          : []),
        ...(variables.patch.firstName !== undefined ||
        variables.patch.lastName !== undefined
          ? [
              client.invalidateQueries({ queryKey: ['tasks', 'lists'] }),
              client.invalidateQueries({
                queryKey: ['tasks', 'patients', patient.id],
              }),
            ]
          : []),
        client.invalidateQueries({
          queryKey: patientKeys.household(patient.id),
        }),
      ]);
    },
  });
}
export function useUpdateHousehold() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      patch,
      expectedUpdatedAt,
    }: {
      patientId: string;
      patch: HouseholdPatch;
      expectedUpdatedAt: string;
    }) => updateHousehold(patientId, patch, expectedUpdatedAt),
    onSuccess: async (household) => {
      await client.cancelQueries({
        queryKey: patientKeys.household(household.patientId),
      });
      client.setQueryData(
        patientKeys.household(household.patientId),
        household,
      );
      await Promise.all([
        client.invalidateQueries({
          queryKey: patientKeys.detail(household.patientId),
        }),
        client.invalidateQueries({ queryKey: ['policy-population'] }),
        client.invalidateQueries({ queryKey: patientKeys.lists }),
      ]);
    },
  });
}
