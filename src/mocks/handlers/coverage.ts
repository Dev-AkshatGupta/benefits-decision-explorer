import { http, HttpResponse } from 'msw';
import { mockDatabase } from '../data/database';
import { demoPolicyRegistry } from '@/features/eligibility/policies/registry';
import {
  coverageSchema,
  createCoverageSchema,
  updateCoverageSchema,
  createEventSchema,
  eventSchema,
  coverageFiltersSchema,
  coverageStatus,
  renewalUrgency,
  detectCoverageGaps,
  validateRenewalTransition,
  type CoverageFilters,
  type CoverageRecord,
} from '@/features/coverage/domain/coverage';
import {
  localCalendarDate,
  addCalendarDays,
} from '@/features/tasks/domain/tasks';
function error(
  status: number,
  code: 'NOT_FOUND' | 'INVALID_REQUEST' | 'CONFLICT',
  message: string,
) {
  return HttpResponse.json({ error: { code, message } }, { status });
}
function program(id: string) {
  return demoPolicyRegistry.find((program) => program.id === id);
}
function now(record?: CoverageRecord) {
  return new Date(
    Math.max(Date.now(), record ? Date.parse(record.updatedAt) + 1 : 0),
  ).toISOString();
}
export function queryCoverage(filters: CoverageFilters, renewals = false) {
  const patients = new Map(
      mockDatabase.patients.map((patient) => [patient.id, patient]),
    ),
    coordinators = new Map(
      mockDatabase.coordinators.map((person) => [
        person.id,
        person.firstName + ' ' + person.lastName,
      ]),
    );
  const rows = mockDatabase.coverage
    .filter((record) => {
      const person = patients.get(record.patientId),
        urgency = renewalUrgency(record, filters.date),
        rangeValue = renewals ? record.renewalDueDate : record.startDate;
      return (
        (!renewals || !!record.renewalDueDate || filters.urgency === 'none') &&
        (!filters.patientId || filters.patientId === record.patientId) &&
        (!filters.programId || filters.programId === record.programId) &&
        (filters.status === 'all' ||
          coverageStatus(record, filters.date) === filters.status) &&
        (filters.renewalStatus === 'all' ||
          record.renewalStatus === filters.renewalStatus) &&
        (filters.urgency === 'all' ||
          (filters.urgency === 'urgent'
            ? ['overdue', 'due_today', 'due_soon'].includes(urgency)
            : urgency === filters.urgency)) &&
        (!filters.from || (!!rangeValue && rangeValue >= filters.from)) &&
        (!filters.to || (!!rangeValue && rangeValue <= filters.to)) &&
        (
          record.programName +
          ' ' +
          person?.firstName +
          ' ' +
          person?.lastName +
          ' ' +
          record.patientId
        )
          .toLowerCase()
          .includes(filters.search.toLowerCase())
      );
    })
    .sort((a, b) => {
      const x = a[filters.sortBy],
        y = b[filters.sortBy];
      if (x === null || y === null)
        return x === y ? a.id.localeCompare(b.id) : x === null ? 1 : -1;
      return (
        x.localeCompare(y) * (filters.sortOrder === 'asc' ? 1 : -1) ||
        a.id.localeCompare(b.id)
      );
    });
  return {
    data: rows
      .slice(
        (filters.page - 1) * filters.pageSize,
        filters.page * filters.pageSize,
      )
      .map((record) => {
        const person = patients.get(record.patientId);
        return {
          ...record,
          patientName: person
            ? person.firstName + ' ' + person.lastName
            : record.patientId,
          coordinatorName: person
            ? (coordinators.get(person.assignedCoordinatorId) ?? null)
            : null,
        };
      }),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems: rows.length,
      totalPages: Math.ceil(rows.length / filters.pageSize),
    },
  };
}
function list(request: Request, patientId?: string, renewals = false) {
  const raw = Object.fromEntries(new URL(request.url).searchParams);
  const filters = coverageFiltersSchema.safeParse({
    ...(renewals
      ? { urgency: 'urgent', sortBy: 'renewalDueDate', sortOrder: 'asc' }
      : {}),
    ...raw,
    date: raw.date ?? localCalendarDate(),
    ...(patientId ? { patientId } : {}),
  });
  if (!filters.success)
    return error(
      400,
      'INVALID_REQUEST',
      'Invalid coverage filters or date range.',
    );
  if (
    patientId &&
    !mockDatabase.patients.some((patient) => patient.id === patientId)
  )
    return error(404, 'NOT_FOUND', 'Patient not found.');
  return HttpResponse.json(queryCoverage(filters.data, renewals));
}
export const coverageHandlers = [
  http.get('/api/coverage/summary', ({ request }) => {
    const raw =
        new URL(request.url).searchParams.get('date') ?? localCalendarDate(),
      parsed = coverageFiltersSchema.safeParse({ date: raw });
    if (!parsed.success)
      return error(400, 'INVALID_REQUEST', 'Invalid evaluation date.');
    const date = parsed.data.date,
      records = mockDatabase.coverage;
    return HttpResponse.json({
      activePatients: new Set(
        records
          .filter((record) => coverageStatus(record, date) === 'active')
          .map((record) => record.patientId),
      ).size,
      expiringRecords: records.filter(
        (record) =>
          coverageStatus(record, date) === 'active' &&
          record.endDate &&
          record.endDate <= addCalendarDays(date, 30),
      ).length,
      dueRenewals: records.filter((record) =>
        ['due_today', 'due_soon'].includes(renewalUrgency(record, date)),
      ).length,
      overdueRenewals: records.filter(
        (record) => renewalUrgency(record, date) === 'overdue',
      ).length,
      gapPatients: new Set(
        detectCoverageGaps(records, date).map((gap) => gap.patientId),
      ).size,
    });
  }),
  http.get('/api/coverage/renewals', ({ request }) =>
    list(request, undefined, true),
  ),
  http.get('/api/coverage', ({ request }) => list(request)),
  http.get('/api/patients/:patientId/coverage/timeline', ({ params }) => {
    const id = String(params.patientId);
    if (!mockDatabase.patients.some((patient) => patient.id === id))
      return error(404, 'NOT_FOUND', 'Patient not found.');
    return HttpResponse.json(
      mockDatabase.coverage
        .filter((record) => record.patientId === id)
        .sort(
          (a, b) =>
            a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
        ),
    );
  }),
  http.get('/api/patients/:patientId/coverage/events', ({ params }) => {
    const id = String(params.patientId);
    if (!mockDatabase.patients.some((patient) => patient.id === id))
      return error(404, 'NOT_FOUND', 'Patient not found.');
    return HttpResponse.json(
      mockDatabase.coverageEvents
        .filter((event) => event.patientId === id)
        .sort(
          (a, b) =>
            a.eventDate.localeCompare(b.eventDate) ||
            a.createdAt.localeCompare(b.createdAt) ||
            a.id.localeCompare(b.id),
        ),
    );
  }),
  http.get('/api/patients/:patientId/coverage', ({ request, params }) =>
    list(request, String(params.patientId)),
  ),
  http.get('/api/coverage/:coverageId/events', ({ params }) => {
    if (
      !mockDatabase.coverage.some((record) => record.id === params.coverageId)
    )
      return error(404, 'NOT_FOUND', 'Coverage record not found.');
    return HttpResponse.json(
      mockDatabase.coverageEvents
        .filter((event) => event.coverageId === params.coverageId)
        .sort(
          (a, b) =>
            a.eventDate.localeCompare(b.eventDate) ||
            a.createdAt.localeCompare(b.createdAt) ||
            a.id.localeCompare(b.id),
        ),
    );
  }),
  http.get('/api/coverage/:coverageId', ({ params }) => {
    const record = mockDatabase.coverage.find(
      (record) => record.id === params.coverageId,
    );
    return record
      ? HttpResponse.json(record)
      : error(404, 'NOT_FOUND', 'Coverage record not found.');
  }),
  http.post('/api/coverage', async ({ request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error(400, 'INVALID_REQUEST', 'Invalid JSON body.');
    }
    const parsed = createCoverageSchema.safeParse(body);
    if (!parsed.success)
      return error(
        400,
        'INVALID_REQUEST',
        parsed.error.issues[0]?.message ?? 'Invalid coverage.',
      );
    const value = parsed.data,
      benefit = program(value.programId);
    if (
      !mockDatabase.patients.some(
        (patient) => patient.id === value.patientId,
      ) ||
      !benefit
    )
      return error(
        400,
        'INVALID_REQUEST',
        'Patient or fictional program does not exist.',
      );
    const key = request.headers.get('Idempotency-Key');
    if (!key || key.length > 100)
      return error(
        400,
        'INVALID_REQUEST',
        'A bounded request key is required.',
      );
    const signature = JSON.stringify(value),
      existing = mockDatabase.coverageRequests.get('record:' + key);
    if (existing)
      return existing.signature === signature
        ? HttpResponse.json(
            mockDatabase.coverage.find((record) => record.id === existing.id),
          )
        : error(409, 'CONFLICT', 'Request key belongs to different data.');
    if (
      mockDatabase.coverage.some(
        (record) =>
          record.patientId === value.patientId &&
          record.programId === value.programId &&
          record.startDate === value.startDate &&
          record.endDate === value.endDate &&
          record.terminatedAt === value.terminatedAt,
      )
    )
      return error(
        409,
        'CONFLICT',
        'This exact fictional coverage period is already recorded.',
      );
    const timestamp = now(),
      record = coverageSchema.parse({
        ...value,
        id: 'coverage-' + crypto.randomUUID(),
        programName: benefit.name,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    mockDatabase.coverage.push(record);
    mockDatabase.coverageRequests.set('record:' + key, {
      signature,
      id: record.id,
    });
    return HttpResponse.json(record, { status: 201 });
  }),
  http.patch('/api/coverage/:coverageId', async ({ request, params }) => {
    const index = mockDatabase.coverage.findIndex(
        (record) => record.id === params.coverageId,
      ),
      record = mockDatabase.coverage[index];
    if (!record) return error(404, 'NOT_FOUND', 'Coverage record not found.');
    if (request.headers.get('If-Match') !== JSON.stringify(record.updatedAt))
      return error(
        409,
        'CONFLICT',
        'Coverage changed. Your draft is preserved; close the editor and reload before editing again.',
      );
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error(400, 'INVALID_REQUEST', 'Invalid JSON body.');
    }
    const parsed = updateCoverageSchema.safeParse(body);
    if (!parsed.success)
      return error(400, 'INVALID_REQUEST', 'Invalid coverage update.');
    const merged = coverageSchema.safeParse({
      ...record,
      ...parsed.data,
      updatedAt: now(record),
    });
    if (!merged.success)
      return error(
        400,
        'INVALID_REQUEST',
        'End and termination dates must not precede coverage start.',
      );
    try {
      validateRenewalTransition(
        record.renewalStatus,
        merged.data.renewalStatus,
      );
    } catch {
      return error(
        400,
        'INVALID_REQUEST',
        'This renewal transition is not allowed.',
      );
    }
    mockDatabase.coverage[index] = merged.data;
    return HttpResponse.json(merged.data);
  }),
  http.post('/api/coverage/:coverageId/events', async ({ request, params }) => {
    const record = mockDatabase.coverage.find(
      (record) => record.id === params.coverageId,
    );
    if (!record) return error(404, 'NOT_FOUND', 'Coverage record not found.');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error(400, 'INVALID_REQUEST', 'Invalid JSON body.');
    }
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success)
      return error(
        400,
        'INVALID_REQUEST',
        parsed.error.issues[0]?.message ?? 'Invalid event.',
      );
    const key = request.headers.get('Idempotency-Key');
    if (!key || key.length > 100)
      return error(
        400,
        'INVALID_REQUEST',
        'A bounded event request key is required.',
      );
    const signature = JSON.stringify({ coverageId: record.id, ...parsed.data }),
      existing = mockDatabase.coverageRequests.get('event:' + key);
    if (existing)
      return existing.signature === signature
        ? HttpResponse.json(
            mockDatabase.coverageEvents.find(
              (event) => event.id === existing.id,
            ),
          )
        : error(
            409,
            'CONFLICT',
            'Event request key belongs to different data.',
          );
    const event = eventSchema.parse({
      ...parsed.data,
      id: 'coverage-event-' + crypto.randomUUID(),
      patientId: record.patientId,
      coverageId: record.id,
      createdAt: now(),
    });
    mockDatabase.coverageEvents.push(event);
    mockDatabase.coverageRequests.set('event:' + key, {
      signature,
      id: event.id,
    });
    return HttpResponse.json(event, { status: 201 });
  }),
];
