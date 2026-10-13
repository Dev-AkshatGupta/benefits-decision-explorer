import { requestJson } from '@/lib/api/client';
import {
  coverageSchema,
  coverageListSchema,
  coverageOverviewSchema,
  eventListSchema,
  eventSchema,
  patientPeriodsSchema,
  coverageFiltersSchema,
  createCoverageSchema,
  updateCoverageSchema,
  createEventSchema,
  type CoverageFilters,
  type CreateCoverage,
  type UpdateCoverage,
  type CreateEvent,
} from '../domain/coverage';
export function getCoverage(
  filters: CoverageFilters,
  signal?: AbortSignal,
  patientId?: string,
  renewals = false,
) {
  const query = new URLSearchParams();
  Object.entries(coverageFiltersSchema.parse(filters)).forEach(([key, value]) =>
    query.set(key, String(value)),
  );
  return requestJson(
    (patientId
      ? '/api/patients/' + encodeURIComponent(patientId) + '/coverage'
      : renewals
        ? '/api/coverage/renewals'
        : '/api/coverage') +
      '?' +
      query,
    coverageListSchema,
    signal ? { signal } : {},
  );
}
export function getCoverageRecord(id: string, signal?: AbortSignal) {
  return requestJson(
    '/api/coverage/' + encodeURIComponent(id),
    coverageSchema,
    signal ? { signal } : {},
  );
}
export function getCoverageOverview(date: string, signal?: AbortSignal) {
  return requestJson(
    '/api/coverage/summary?date=' + encodeURIComponent(date),
    coverageOverviewSchema,
    signal ? { signal } : {},
  );
}
export function getPatientPeriods(id: string, signal?: AbortSignal) {
  return requestJson(
    '/api/patients/' + encodeURIComponent(id) + '/coverage/timeline',
    patientPeriodsSchema,
    signal ? { signal } : {},
  );
}
export function getCoverageEvents(id: string, signal?: AbortSignal) {
  return requestJson(
    '/api/coverage/' + encodeURIComponent(id) + '/events',
    eventListSchema,
    signal ? { signal } : {},
  );
}
export function getPatientCoverageEvents(id: string, signal?: AbortSignal) {
  return requestJson(
    '/api/patients/' + encodeURIComponent(id) + '/coverage/events',
    eventListSchema,
    signal ? { signal } : {},
  );
}
export function createCoverage(value: CreateCoverage, key: string) {
  return requestJson('/api/coverage', coverageSchema, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(createCoverageSchema.parse(value)),
  });
}
export function updateCoverage(
  id: string,
  value: UpdateCoverage,
  updatedAt: string,
) {
  return requestJson(
    '/api/coverage/' + encodeURIComponent(id),
    coverageSchema,
    {
      method: 'PATCH',
      headers: { 'If-Match': JSON.stringify(updatedAt) },
      body: JSON.stringify(updateCoverageSchema.parse(value)),
    },
  );
}
export function addCoverageEvent(id: string, value: CreateEvent, key: string) {
  return requestJson(
    '/api/coverage/' + encodeURIComponent(id) + '/events',
    eventSchema,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(createEventSchema.parse(value)),
    },
  );
}
