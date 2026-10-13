import { z } from 'zod';
import { isCalendarDate, todayUtc } from './dates';
import { calculateHouseholdAnnualIncome, incomeFrequencies } from './income';
export const usStates = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
] as const;
export const patientStatuses = [
  'active',
  'pending_review',
  'inactive',
] as const;
const id = z.string().trim().min(1).max(100);
const name = z.string().trim().min(1).max(100);
export const calendarDateSchema = z.iso
  .date()
  .refine(isCalendarDate, 'Invalid calendar date');
export const birthDateSchema = calendarDateSchema.refine(
  (value) => value <= todayUtc(),
  'Date of birth cannot be in the future',
);
const timestamp = z.iso.datetime();
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const incomeInformationStatuses = [
  'complete',
  'incomplete',
  'unknown',
] as const;
export const addressSchema = z.strictObject({
  street: z.string().trim().min(1).max(200),
  city: name,
  state: z.enum(usStates),
  postalCode: z
    .string()
    .regex(/^[0-9]{5}(-[0-9]{4})?$/, 'Expected a U.S. ZIP code'),
  country: z.literal('US'),
});
export const patientSchema = z
  .strictObject({
    id,
    firstName: name,
    lastName: name,
    dateOfBirth: birthDateSchema,
    gender: z
      .enum(['female', 'male', 'nonbinary', 'other', 'prefer_not_to_say'])
      .optional(),
    email: z.email().max(254).optional(),
    // U.S. ten-digit numbers with optional +1, spaces, parentheses, periods, or hyphens.
    phone: z
      .string()
      .max(30)
      .regex(
        /^(?:[+]?1[- .]?)?(?:[(][2-9][0-9]{2}[)]|[2-9][0-9]{2})[- .]?[2-9][0-9]{2}[- .]?[0-9]{4}$/,
        'Invalid U.S. phone number',
      )
      .optional(),
    address: addressSchema,
    householdId: id,
    assignedCoordinatorId: id,
    status: z.enum(patientStatuses),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine(
    (patient) => Date.parse(patient.updatedAt) >= Date.parse(patient.createdAt),
    'updatedAt must not precede createdAt',
  );
export const householdMemberSchema = z.strictObject({
  id,
  firstName: name,
  lastName: name,
  relationship: z.enum(['self', 'spouse', 'child', 'parent', 'other']),
  dateOfBirth: birthDateSchema,
  income: cents,
  employmentStatus: z.enum([
    'employed',
    'self_employed',
    'unemployed',
    'retired',
    'student',
    'unable_to_work',
    'other',
  ]),
});
export const incomeSourceSchema = z.strictObject({
  id,
  type: z.enum([
    'employment',
    'self_employment',
    'unemployment',
    'disability',
    'pension',
    'other',
  ]),
  amount: cents,
  frequency: z.enum(incomeFrequencies),
});
export const householdSchema = z
  .strictObject({
    id,
    patientId: id,
    members: z.array(householdMemberSchema).min(1).max(50),
    totalAnnualIncome: cents,
    incomeSources: z.array(incomeSourceSchema).max(100),
    // Absence is legacy/unknown, never a confirmation of zero income.
    incomeInformationStatus: z.enum(incomeInformationStatuses).optional(),
    householdSize: z.number().int().min(1).max(50),
    updatedAt: timestamp,
  })
  .superRefine((household, ctx) => {
    if (
      household.members.filter((member) => member.relationship === 'self')
        .length !== 1
    )
      ctx.addIssue({
        code: 'custom',
        path: ['members'],
        message: 'Keep exactly one primary patient.',
      });
    if (household.householdSize !== household.members.length)
      ctx.addIssue({
        code: 'custom',
        path: ['householdSize'],
        message: 'Household size must equal the number of members',
      });
    if (
      new Set(household.members.map((member) => member.id)).size !==
      household.members.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['members'],
        message: 'Household member IDs must be unique',
      });
    if (
      new Set(household.incomeSources.map((source) => source.id)).size !==
      household.incomeSources.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['incomeSources'],
        message: 'Income source IDs must be unique',
      });
    try {
      if (
        household.totalAnnualIncome !==
        calculateHouseholdAnnualIncome(household.incomeSources)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['totalAnnualIncome'],
          message: 'Annual income must be derived from income sources',
        });
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['incomeSources'],
        message: 'Annual income exceeds safe integer cents',
      });
    }
  });
export const coordinatorSchema = z.strictObject({
  id,
  firstName: name,
  lastName: name,
  email: z.email(),
  role: z.enum(['care_coordinator', 'lead_coordinator']),
});
export const patientSummarySchema = z.strictObject({
  id,
  fullName: z.string().trim().min(1).max(201),
  age: z.number().int().min(0),
  state: z.enum(usStates),
  status: z.enum(patientStatuses),
  assignedCoordinator: z.strictObject({
    id,
    fullName: z.string().trim().min(1).max(201),
  }),
  lastUpdated: timestamp,
});
// Explicit allowlist: relationships, IDs, and timestamps cannot be patched.
export const patientPatchSchema = z
  .strictObject({
    firstName: name.optional(),
    lastName: name.optional(),
    dateOfBirth: birthDateSchema.optional(),
    gender: patientSchema.shape.gender.nullable(),
    email: patientSchema.shape.email.nullable(),
    phone: patientSchema.shape.phone.nullable(),
    address: addressSchema.optional(),
    status: z.enum(patientStatuses).optional(),
    assignedCoordinatorId: id.optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'At least one permitted field is required',
  );
export const patientListParamsSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(''),
  status: z.enum(patientStatuses).optional(),
  state: z.enum(usStates).optional(),
  coordinatorId: id.optional(),
  sortBy: z
    .enum([
      'fullName',
      'age',
      'state',
      'status',
      'assignedCoordinator',
      'lastUpdated',
    ])
    .default('fullName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export const patientListResponseSchema = z
  .strictObject({
    data: z.array(patientSummarySchema),
    pagination: z.strictObject({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      totalItems: z.number().int().min(0),
      totalPages: z.number().int().min(0),
    }),
  })
  .superRefine((response, ctx) => {
    const { pageSize, totalItems, totalPages } = response.pagination;
    if (
      totalPages !== Math.ceil(totalItems / pageSize) ||
      response.data.length > pageSize
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid pagination metadata' });
  });
export const coordinatorsResponseSchema = z.array(coordinatorSchema);
export const patientStatsSchema = z
  .strictObject({
    totalPatients: z.number().int().nonnegative(),
    activePatients: z.number().int().nonnegative(),
    pendingReview: z.number().int().nonnegative(),
  })
  .refine(
    (value) =>
      value.activePatients + value.pendingReview <= value.totalPatients,
    'Status counts cannot exceed the total',
  );
/* eslint-disable @typescript-eslint/no-empty-object-type -- Domain interfaces derive from runtime schemas to prevent drift. */
export interface Address extends z.infer<typeof addressSchema> {}
export interface Patient extends z.infer<typeof patientSchema> {}
export interface HouseholdMember extends z.infer<
  typeof householdMemberSchema
> {}
export interface IncomeSource extends z.infer<typeof incomeSourceSchema> {}
export interface Household extends z.infer<typeof householdSchema> {}
export interface CareCoordinator extends z.infer<typeof coordinatorSchema> {}
export interface PatientSummary extends z.infer<typeof patientSummarySchema> {}
export type PatientPatch = z.infer<typeof patientPatchSchema>;
export const householdPatchSchema = z
  .strictObject({
    members: z.array(householdMemberSchema).min(1).max(50).optional(),
    incomeSources: z.array(incomeSourceSchema).max(100).optional(),
    incomeInformationStatus: z.enum(incomeInformationStatuses).optional(),
  })
  .refine(
    (value) =>
      value.members !== undefined ||
      value.incomeSources !== undefined ||
      value.incomeInformationStatus !== undefined,
    'Provide household members or income sources',
  );
export type HouseholdPatch = z.infer<typeof householdPatchSchema>;
export type PatientListParams = Partial<
  z.output<typeof patientListParamsSchema>
>;
export type PatientListQuery = z.output<typeof patientListParamsSchema>;
export type PatientListResponse = z.infer<typeof patientListResponseSchema>;
