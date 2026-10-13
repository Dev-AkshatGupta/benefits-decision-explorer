import { requestJson } from '@/lib/api/client';
import {
  patientSchema,
  householdSchema,
  patientPatchSchema,
  patientListParamsSchema,
  patientListResponseSchema,
  coordinatorsResponseSchema,
  type PatientPatch,
  type PatientListParams,
  patientStatsSchema,
  householdPatchSchema,
  type HouseholdPatch,
} from '../domain/schemas';
export function getPatientStats(signal?: AbortSignal) {
  return requestJson(
    '/api/patients/summary',
    patientStatsSchema,
    signal ? { signal } : {},
  );
}
export function getPatients(
  params: PatientListParams = {},
  signal?: AbortSignal,
) {
  const normalized = patientListParamsSchema.parse(params);
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(normalized))
    if (value !== undefined && value !== '')
      searchParams.set(key, String(value));
  return requestJson(
    '/api/patients?' + searchParams.toString(),
    patientListResponseSchema,
    signal ? { signal } : {},
  );
}
export function getPatient(patientId: string, signal?: AbortSignal) {
  return requestJson(
    '/api/patients/' + encodeURIComponent(patientId),
    patientSchema,
    signal ? { signal } : {},
  );
}
export function getPatientHousehold(patientId: string, signal?: AbortSignal) {
  return requestJson(
    '/api/patients/' + encodeURIComponent(patientId) + '/household',
    householdSchema,
    signal ? { signal } : {},
  );
}
export function getCoordinators(signal?: AbortSignal) {
  return requestJson(
    '/api/coordinators',
    coordinatorsResponseSchema,
    signal ? { signal } : {},
  );
}
export function updatePatient(
  patientId: string,
  patch: PatientPatch,
  expectedUpdatedAt?: string,
) {
  return requestJson(
    '/api/patients/' + encodeURIComponent(patientId),
    patientSchema,
    {
      method: 'PATCH',
      body: JSON.stringify(patientPatchSchema.parse(patch)),
      ...(expectedUpdatedAt
        ? { headers: { 'If-Match': JSON.stringify(expectedUpdatedAt) } }
        : {}),
    },
  );
}
export function updateHousehold(
  patientId: string,
  patch: HouseholdPatch,
  expectedUpdatedAt: string,
) {
  return requestJson(
    '/api/patients/' + encodeURIComponent(patientId) + '/household',
    householdSchema,
    {
      method: 'PATCH',
      headers: { 'If-Match': JSON.stringify(expectedUpdatedAt) },
      body: JSON.stringify(householdPatchSchema.parse(patch)),
    },
  );
}
