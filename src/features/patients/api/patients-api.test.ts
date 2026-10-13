import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { mockDatabase } from '@/mocks/data/database';
import { ApiError, ApiResponseError } from '@/lib/api/errors';
import { apiErrorSchema } from '@/lib/api/error-schema';
import {
  getPatients,
  getPatient,
  getPatientHousehold,
  getCoordinators,
  updatePatient,
  getPatientStats,
} from './patients-api';
const patientId = 'patient-001';
describe('patient mock API', () => {
  it('returns global counts independently of pagination and filters and reflects updates', async () => {
    expect(await getPatientStats()).toEqual({
      totalPatients: 150,
      activePatients: 50,
      pendingReview: 50,
    });
    await getPatients({ status: 'active', pageSize: 10, page: 2 });
    expect(await getPatientStats()).toEqual({
      totalPatients: 150,
      activePatients: 50,
      pendingReview: 50,
    });
    await updatePatient(patientId, { status: 'pending_review' });
    expect(await getPatientStats()).toEqual({
      totalPatients: 150,
      activePatients: 49,
      pendingReview: 51,
    });
  });
  it('returns only summary fields with correct pagination', async () => {
    const result = await getPatients();
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 150,
      totalPages: 8,
    });
    expect(result.data).toHaveLength(20);
    expect(Object.keys(result.data[0]!)).toEqual([
      'id',
      'fullName',
      'age',
      'state',
      'status',
      'assignedCoordinator',
      'lastUpdated',
    ]);
    const last = await getPatients({ page: 8 });
    expect(last.data).toHaveLength(10);
    expect((await getPatients({ page: 999 })).data).toEqual([]);
  });
  it('searches names case-insensitively and combines filters server-side', async () => {
    const result = await getPatients({
      search: 'AVERY',
      status: 'active',
      state: 'CO',
      coordinatorId: 'coordinator-001',
    });
    expect(result.pagination.totalItems).toBe(5);
    expect(
      result.data.every(
        (patient) =>
          patient.fullName.startsWith('Avery') &&
          patient.status === 'active' &&
          patient.state === 'CO' &&
          patient.assignedCoordinator.id === 'coordinator-001',
      ),
    ).toBe(true);
    const empty = await getPatients({ search: 'no-such-fictional-name' });
    expect(empty).toEqual({
      data: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
  });
  it('sorts deterministically with ascending ID tie-breaking before pagination', async () => {
    const result = await getPatients({
      sortBy: 'state',
      sortOrder: 'desc',
      pageSize: 100,
    });
    const repeated = await getPatients({
      sortBy: 'state',
      sortOrder: 'desc',
      pageSize: 100,
    });
    expect(result).toEqual(repeated);
    for (let i = 1; i < result.data.length; i++) {
      const previous = result.data[i - 1]!;
      const current = result.data[i]!;
      expect(previous.state >= current.state).toBe(true);
      if (previous.state === current.state)
        expect(previous.id < current.id).toBe(true);
    }
    const first = await getPatients({
      sortBy: 'age',
      sortOrder: 'asc',
      pageSize: 10,
    });
    const second = await getPatients({
      sortBy: 'age',
      sortOrder: 'asc',
      pageSize: 10,
      page: 2,
    });
    expect(
      new Set([...first.data, ...second.data].map((value) => value.id)).size,
    ).toBe(20);
    expect(first.data[9]!.age <= second.data[0]!.age).toBe(true);
  });
  it.each([
    'page=0',
    'page=abc',
    'pageSize=101',
    'pageSize=1.5',
    'status=approved',
    'state=XX',
    'sortBy=email',
    'sortOrder=invalid',
    'page=1&page=2',
    'unexpected=value',
    'coordinatorId=',
    'page=',
  ])('returns consistent 400 for invalid query %s', async (query) => {
    const response = await fetch('/api/patients?' + query);
    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe(
      'INVALID_REQUEST',
    );
  });
  it('returns detailed records, linked households, and all coordinators', async () => {
    const patient = await getPatient(patientId);
    const household = await getPatientHousehold(patientId);
    expect(household.id).toBe(patient.householdId);
    expect(household.patientId).toBe(patient.id);
    expect(await getCoordinators()).toHaveLength(5);
  });
  it('returns typed 404 errors for unknown patients and missing households', async () => {
    await expect(getPatient('unknown')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    await expect(getPatientHousehold('unknown')).rejects.toBeInstanceOf(
      ApiError,
    );
    mockDatabase.households = mockDatabase.households.filter(
      (value) => value.patientId !== patientId,
    );
    await expect(getPatientHousehold(patientId)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    await expect(
      updatePatient('unknown', { firstName: 'New' }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('patches allowed fields, advances timestamp, preserves identity, and synchronizes self member', async () => {
    const original = await getPatient(patientId);
    const updated = await updatePatient(patientId, {
      firstName: 'Updated',
      dateOfBirth: '1980-03-15',
      assignedCoordinatorId: 'coordinator-002',
      status: 'inactive',
    });
    expect(updated.firstName).toBe('Updated');
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.id).toBe(original.id);
    expect(updated.householdId).toBe(original.householdId);
    expect(updated.updatedAt > original.updatedAt).toBe(true);
    expect((await getPatient(patientId)).firstName).toBe('Updated');
    expect(
      (await getPatientHousehold(patientId)).members.find(
        (value) => value.relationship === 'self',
      ),
    ).toMatchObject({ firstName: 'Updated', dateOfBirth: '1980-03-15' });
    const result = await getPatients({ search: 'Updated' });
    expect(result.data[0]).toMatchObject({
      status: 'inactive',
      assignedCoordinator: { id: 'coordinator-002' },
    });
  });
  it.each([
    { id: 'new' },
    { createdAt: '2026-01-01T00:00:00Z' },
    { updatedAt: '2026-01-01T00:00:00Z' },
    { householdId: 'other' },
    { dateOfBirth: '2099-01-01' },
    { email: 'invalid' },
    { phone: '123' },
    { assignedCoordinatorId: 'missing' },
    { unknown: true },
    {},
    null,
  ])(
    'rejects invalid raw PATCH bodies without modifying data: %j',
    async (body) => {
      const original = await getPatient(patientId);
      const response = await fetch('/api/patients/' + patientId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
      expect(apiErrorSchema.parse(await response.json()).error.code).toBe(
        'INVALID_REQUEST',
      );
      expect(await getPatient(patientId)).toEqual(original);
    },
  );
  it('handles malformed JSON consistently', async () => {
    const response = await fetch('/api/patients/' + patientId, {
      method: 'PATCH',
      body: '{',
    });
    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe(
      'INVALID_JSON',
    );
  });
});
describe('Fetch API boundary', () => {
  it('keeps maximum-length valid names valid in list summaries', async () => {
    await updatePatient(patientId, {
      firstName: 'A'.repeat(100),
      lastName: 'B'.repeat(100),
    });
    const response = await getPatients({ search: 'A'.repeat(100) });
    expect(response.data[0]?.fullName).toHaveLength(201);
  });
  it('merges concurrent partial updates without losing unrelated fields', async () => {
    await Promise.all([
      updatePatient(patientId, { firstName: 'Concurrent' }),
      updatePatient(patientId, { lastName: 'Updates' }),
    ]);
    expect(await getPatient(patientId)).toMatchObject({
      firstName: 'Concurrent',
      lastName: 'Updates',
    });
  });
  it('rejects success responses that violate their schema', async () => {
    server.use(
      http.get('/api/patients/:patientId', () =>
        HttpResponse.json({ id: patientId }),
      ),
    );
    await expect(getPatient(patientId)).rejects.toBeInstanceOf(
      ApiResponseError,
    );
  });
  it('rejects malformed successful JSON', async () => {
    server.use(
      http.get(
        '/api/patients/:patientId',
        () =>
          new HttpResponse('bad JSON', {
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    await expect(getPatient(patientId)).rejects.toBeInstanceOf(
      ApiResponseError,
    );
  });
  it('provides safe typed errors for unrecognized error responses', async () => {
    server.use(
      http.get(
        '/api/patients/:patientId',
        () => new HttpResponse('unavailable', { status: 503 }),
      ),
    );
    await expect(getPatient(patientId)).rejects.toMatchObject({
      status: 503,
      code: 'HTTP_ERROR',
    });
  });
  it('passes through cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      getPatient(patientId, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
