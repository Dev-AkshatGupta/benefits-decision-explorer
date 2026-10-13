import { http, HttpResponse } from 'msw';
import type { ZodError } from 'zod';
import {
  patientListParamsSchema,
  patientPatchSchema,
  patientSchema,
  householdSchema,
  patientSummarySchema,
  patientListResponseSchema,
  coordinatorsResponseSchema,
  patientStatsSchema,
  householdPatchSchema,
  type Patient,
  type PatientListQuery,
  type PatientSummary,
} from '@/features/patients/domain/schemas';
import { calculateAge } from '@/features/patients/domain/dates';
import { mockDatabase } from '../data/database';
import { calculateHouseholdAnnualIncome } from '@/features/patients/domain/income';
function conflict() {
  return HttpResponse.json(
    {
      error: {
        code: 'CONFLICT',
        message:
          'This record was updated by another request. Reload the current record before saving.',
      },
    },
    { status: 409 },
  );
}
function invalid(message: string, error?: ZodError) {
  return HttpResponse.json(
    {
      error: {
        code: 'INVALID_REQUEST',
        message,
        ...(error
          ? {
              issues: error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              })),
            }
          : {}),
      },
    },
    { status: 400 },
  );
}
function notFound() {
  return HttpResponse.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested record was not found.',
      },
    },
    { status: 404 },
  );
}
function summary(patient: Patient): PatientSummary {
  const coordinator = mockDatabase.coordinators.find(
    (item) => item.id === patient.assignedCoordinatorId,
  );
  if (!coordinator)
    throw new Error('Mock database contains an invalid coordinator reference.');
  return patientSummarySchema.parse({
    id: patient.id,
    fullName: patient.firstName + ' ' + patient.lastName,
    age: calculateAge(patient.dateOfBirth),
    state: patient.address.state,
    status: patient.status,
    assignedCoordinator: {
      id: coordinator.id,
      fullName: coordinator.firstName + ' ' + coordinator.lastName,
    },
    lastUpdated: patient.updatedAt,
  });
}
function compare(
  left: PatientSummary,
  right: PatientSummary,
  query: PatientListQuery,
): number {
  const key = query.sortBy;
  const a =
    key === 'assignedCoordinator'
      ? left.assignedCoordinator.fullName
      : key === 'lastUpdated'
        ? Date.parse(left.lastUpdated)
        : left[key];
  const b =
    key === 'assignedCoordinator'
      ? right.assignedCoordinator.fullName
      : key === 'lastUpdated'
        ? Date.parse(right.lastUpdated)
        : right[key];
  const order = a < b ? -1 : a > b ? 1 : 0;
  // IDs always ascend for equal primary values, regardless of sort order.
  return (
    order * (query.sortOrder === 'asc' ? 1 : -1) ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  );
}
export const patientHandlers = [
  http.get('/api/patients/summary', () =>
    HttpResponse.json(
      patientStatsSchema.parse({
        totalPatients: mockDatabase.patients.length,
        activePatients: mockDatabase.patients.filter(
          (patient) => patient.status === 'active',
        ).length,
        pendingReview: mockDatabase.patients.filter(
          (patient) => patient.status === 'pending_review',
        ).length,
      }),
    ),
  ),
  http.get('/api/patients', ({ request }) => {
    const url = new URL(request.url);
    for (const key of url.searchParams.keys())
      if (url.searchParams.getAll(key).length > 1)
        return invalid('Repeated query parameters are not supported.');
    const result = patientListParamsSchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!result.success)
      return invalid('Invalid patient query parameters.', result.error);
    const query = result.data;
    const filtered = mockDatabase.patients
      .filter(
        (patient) =>
          (!query.search ||
            (patient.firstName + ' ' + patient.lastName)
              .toLowerCase()
              .includes(query.search.toLowerCase())) &&
          (!query.status || patient.status === query.status) &&
          (!query.state || patient.address.state === query.state) &&
          (!query.coordinatorId ||
            patient.assignedCoordinatorId === query.coordinatorId),
      )
      .map(summary)
      .sort((left, right) => compare(left, right, query));
    const start = (query.page - 1) * query.pageSize;
    return HttpResponse.json(
      patientListResponseSchema.parse({
        data: filtered.slice(start, start + query.pageSize),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems: filtered.length,
          totalPages: Math.ceil(filtered.length / query.pageSize),
        },
      }),
    );
  }),
  http.get('/api/patients/:patientId/household', ({ params }) => {
    const patient = mockDatabase.patients.find(
      (item) => item.id === params.patientId,
    );
    if (!patient) return notFound();
    const household = mockDatabase.households.find(
      (item) =>
        item.id === patient.householdId && item.patientId === patient.id,
    );
    return household
      ? HttpResponse.json(householdSchema.parse(household))
      : notFound();
  }),
  http.get('/api/patients/:patientId', ({ params }) => {
    const patient = mockDatabase.patients.find(
      (item) => item.id === params.patientId,
    );
    return patient
      ? HttpResponse.json(patientSchema.parse(patient))
      : notFound();
  }),
  http.get('/api/coordinators', () =>
    HttpResponse.json(
      coordinatorsResponseSchema.parse(mockDatabase.coordinators),
    ),
  ),
  http.patch('/api/patients/:patientId', async ({ params, request }) => {
    const index = mockDatabase.patients.findIndex(
      (item) => item.id === params.patientId,
    );
    if (!mockDatabase.patients[index]) return notFound();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return HttpResponse.json(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'The request body must contain valid JSON.',
          },
        },
        { status: 400 },
      );
    }
    const result = patientPatchSchema.safeParse(body);
    if (!result.success)
      return invalid('Invalid patient update.', result.error);
    // Read after the asynchronous body parse so overlapping PATCH requests merge
    // with the latest record rather than overwriting unrelated changes.
    const current = mockDatabase.patients[index];
    if (!current) return notFound();
    const condition = request.headers.get('If-Match');
    if (condition && condition !== JSON.stringify(current.updatedAt))
      return conflict();
    if (
      result.data.assignedCoordinatorId &&
      !mockDatabase.coordinators.some(
        (item) => item.id === result.data.assignedCoordinatorId,
      )
    )
      return invalid('The assigned coordinator does not exist.');
    const updatedAt = new Date(
      Math.max(Date.now(), Date.parse(current.updatedAt) + 1),
    ).toISOString();
    const candidate = {
      ...current,
      ...result.data,
      updatedAt,
    };
    for (const field of ['gender', 'email', 'phone'] as const)
      if (candidate[field] === null) delete candidate[field];
    const updated = patientSchema.safeParse(candidate);
    if (!updated.success)
      return invalid('Invalid patient update.', updated.error);
    // Keep the household's self member aligned with its owning patient.
    const householdIndex = mockDatabase.households.findIndex(
      (item) => item.id === current.householdId,
    );
    const household = mockDatabase.households[householdIndex];
    if (household) {
      mockDatabase.households[householdIndex] = householdSchema.parse({
        ...household,
        updatedAt,
        members: household.members.map((member) =>
          member.relationship === 'self'
            ? {
                ...member,
                firstName: updated.data.firstName,
                lastName: updated.data.lastName,
                dateOfBirth: updated.data.dateOfBirth,
              }
            : member,
        ),
      });
    }
    mockDatabase.patients[index] = updated.data;
    return HttpResponse.json(updated.data);
  }),
  http.patch(
    '/api/patients/:patientId/household',
    async ({ params, request }) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_JSON',
              message: 'The request body must contain valid JSON.',
            },
          },
          { status: 400 },
        );
      }
      const result = householdPatchSchema.safeParse(body);
      if (!result.success)
        return invalid('Invalid household update.', result.error);
      const patientIndex = mockDatabase.patients.findIndex(
        (item) => item.id === params.patientId,
      );
      const patient = mockDatabase.patients[patientIndex];
      if (!patient) return notFound();
      const index = mockDatabase.households.findIndex(
        (item) =>
          item.id === patient.householdId && item.patientId === patient.id,
      );
      const current = mockDatabase.households[index];
      if (!current) return notFound();
      const condition = request.headers.get('If-Match');
      if (!condition)
        return invalid('A current household version is required.');
      if (condition !== JSON.stringify(current.updatedAt)) return conflict();
      const members = result.data.members ?? current.members;
      const self = members.filter((member) => member.relationship === 'self');
      const original = current.members.find(
        (member) => member.relationship === 'self',
      );
      if (
        self.length !== 1 ||
        !self[0] ||
        !original ||
        self[0].id !== original.id ||
        self[0].firstName !== patient.firstName ||
        self[0].lastName !== patient.lastName ||
        self[0].dateOfBirth !== patient.dateOfBirth
      )
        return invalid(
          'Keep the primary patient unchanged. Edit personal information through Edit Profile.',
        );
      const incomeSources = result.data.incomeSources ?? current.incomeSources;
      let totalAnnualIncome: number;
      try {
        totalAnnualIncome = calculateHouseholdAnnualIncome(incomeSources);
      } catch {
        return invalid('Annual income exceeds the supported range.');
      }
      const updatedAt = new Date(
        Math.max(
          Date.now(),
          Date.parse(current.updatedAt) + 1,
          Date.parse(patient.updatedAt) + 1,
        ),
      ).toISOString();
      const updated = householdSchema.safeParse({
        ...current,
        members,
        incomeSources,
        // Changing sources invalidates completeness unless explicitly reconfirmed.
        incomeInformationStatus:
          result.data.incomeInformationStatus ??
          (result.data.incomeSources !== undefined
            ? 'incomplete'
            : current.incomeInformationStatus),
        totalAnnualIncome,
        householdSize: members.length,
        updatedAt,
      });
      if (!updated.success)
        return invalid('Invalid household update.', updated.error);
      // Both linked records advance atomically. Source fixture generation is untouched.
      mockDatabase.households[index] = updated.data;
      mockDatabase.patients[patientIndex] = patientSchema.parse({
        ...patient,
        updatedAt,
      });
      return HttpResponse.json(updated.data);
    },
  ),
];
