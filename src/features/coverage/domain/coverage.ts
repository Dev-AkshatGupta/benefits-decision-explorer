import { z } from 'zod';
import { dateSchema, addCalendarDays } from '../../tasks/domain/tasks';
export const coverageStatuses = [
  'upcoming',
  'active',
  'expired',
  'terminated',
] as const;
export const renewalStages = [
  'not_started',
  'in_progress',
  'submitted',
  'completed',
] as const;
export const eventTypes = [
  'coverage_started',
  'coverage_renewed',
  'renewal_due',
  'renewal_submitted',
  'renewal_completed',
  'coverage_expired',
  'coverage_terminated',
  'coverage_gap_detected',
  'note_added',
] as const;
export const urgencyTypes = [
  'overdue',
  'due_today',
  'due_soon',
  'later',
  'completed',
  'none',
] as const;
export const coverageLabels: Record<string, string> = Object.fromEntries(
  [...coverageStatuses, ...renewalStages, ...eventTypes, ...urgencyTypes].map(
    (value) => [
      value,
      value
        .replaceAll('_', ' ')
        .replace(/^./, (character) => character.toUpperCase()),
    ],
  ),
);
coverageLabels.none = 'Deadline not recorded';
const id = z.string().trim().min(1).max(100),
  instant = z.iso.datetime();
const fields = {
  patientId: id,
  programId: id,
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  terminatedAt: dateSchema.nullable(),
  renewalDueDate: dateSchema.nullable(),
  renewalStatus: z.enum(renewalStages),
  notes: z.string().trim().max(3000),
};
function validDates(record: {
  startDate: string;
  endDate: string | null;
  terminatedAt: string | null;
}) {
  return (
    (!record.endDate || record.endDate >= record.startDate) &&
    (!record.terminatedAt || record.terminatedAt >= record.startDate)
  );
}
export const coverageSchema = z
  .strictObject({
    ...fields,
    id,
    programName: z.string().min(1),
    createdAt: instant,
    updatedAt: instant,
  })
  .refine(
    validDates,
    'End and termination dates must not precede coverage start',
  );
export const createCoverageSchema = z
  .strictObject({
    ...fields,
    endDate: fields.endDate.default(null),
    terminatedAt: fields.terminatedAt.default(null),
    renewalDueDate: fields.renewalDueDate.default(null),
    renewalStatus: fields.renewalStatus.default('not_started'),
    notes: fields.notes.default(''),
  })
  .refine(
    validDates,
    'End and termination dates must not precede coverage start',
  );
export const updateCoverageSchema = z
  .strictObject({
    startDate: dateSchema.optional(),
    endDate: fields.endDate.optional(),
    terminatedAt: fields.terminatedAt.optional(),
    renewalDueDate: fields.renewalDueDate.optional(),
    renewalStatus: fields.renewalStatus.optional(),
    notes: fields.notes.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'Provide a coverage update',
  );
export const renewalUpdateSchema = z.strictObject({
  renewalStatus: fields.renewalStatus,
});
export const createEventSchema = z.strictObject({
  type: z.enum(eventTypes),
  eventDate: dateSchema,
  description: z
    .string()
    .trim()
    .min(1, 'Describe the recorded event')
    .max(2000),
});
export const eventSchema = createEventSchema.extend({
  id,
  coverageId: id,
  patientId: id,
  createdAt: instant,
});
export type CoverageRecord = z.infer<typeof coverageSchema>;
export type CoverageEvent = z.infer<typeof eventSchema>;
export type CreateCoverage = z.input<typeof createCoverageSchema>;
export type UpdateCoverage = z.infer<typeof updateCoverageSchema>;
export type CreateEvent = z.infer<typeof createEventSchema>;
export type RenewalStage = (typeof renewalStages)[number];
export const renewalTransitions: Record<RenewalStage, readonly RenewalStage[]> =
  {
    not_started: ['in_progress'],
    in_progress: ['submitted', 'not_started'],
    submitted: ['completed', 'in_progress'],
    completed: [],
  };
export function validateRenewalTransition(
  before: RenewalStage,
  after: RenewalStage,
) {
  if (before !== after && !renewalTransitions[before].includes(after))
    throw new Error('This renewal transition is not allowed.');
}
/** End dates include their day; termination excludes its day. Later termination never overrides an already expired period. */
export function coverageStatus(
  record: CoverageRecord,
  evaluationDate: string,
): (typeof coverageStatuses)[number] {
  dateSchema.parse(evaluationDate);
  if (
    record.terminatedAt &&
    record.terminatedAt <= evaluationDate &&
    (!record.endDate ||
      record.terminatedAt <= addCalendarDays(record.endDate, 1))
  )
    return 'terminated';
  if (record.startDate > evaluationDate) return 'upcoming';
  return record.endDate && record.endDate < evaluationDate
    ? 'expired'
    : 'active';
}
/** Calendar-day ordinals are arithmetic coordinates, not local instants. */
export function calendarOrdinal(date: string) {
  dateSchema.parse(date);
  return Date.parse(date + 'T12:00:00Z') / 86400000;
}
export function daysUntilRenewal(
  record: CoverageRecord,
  referenceDate: string,
): number | null {
  dateSchema.parse(referenceDate);
  return record.renewalDueDate
    ? calendarOrdinal(record.renewalDueDate) - calendarOrdinal(referenceDate)
    : null;
}
export function renewalUrgency(
  record: CoverageRecord,
  referenceDate: string,
): (typeof urgencyTypes)[number] {
  const days = daysUntilRenewal(record, referenceDate);
  return record.renewalStatus === 'completed'
    ? 'completed'
    : days === null
      ? 'none'
      : days < 0
        ? 'overdue'
        : days === 0
          ? 'due_today'
          : days <= 30
            ? 'due_soon'
            : 'later';
}
export function effectiveCoverageEnd(record: CoverageRecord): string | null {
  const terminationEnd = record.terminatedAt
    ? addCalendarDays(record.terminatedAt, -1)
    : null;
  return terminationEnd && (!record.endDate || terminationEnd < record.endDate)
    ? terminationEnd
    : record.endDate;
}
export interface CoverageGap {
  patientId: string;
  programId: string;
  startDate: string;
  endDate: string;
}
/** Only bounded historical gaps, grouped per patient/program. Future periods cannot confirm historical absence. */
export function detectCoverageGaps(
  records: readonly CoverageRecord[],
  evaluationDate: string,
): CoverageGap[] {
  dateSchema.parse(evaluationDate);
  const groups = new Map<string, CoverageRecord[]>();
  for (const candidate of records) {
    const record = coverageSchema.parse(candidate);
    if (record.startDate > evaluationDate) continue;
    // Identifiers allow punctuation: a tuple key cannot alias another patient/program pair.
    const key = JSON.stringify([record.patientId, record.programId]);
    const bucket = groups.get(key) ?? [];
    bucket.push(record);
    groups.set(key, bucket);
  }
  const gaps: CoverageGap[] = [];
  for (const group of groups.values()) {
    const periods = group
      .map((record) => ({
        record,
        start: record.startDate,
        end: effectiveCoverageEnd(record) ?? evaluationDate,
      }))
      .filter((period) => period.end >= period.start)
      .sort(
        (a, b) =>
          a.start.localeCompare(b.start) ||
          a.record.id.localeCompare(b.record.id),
      );
    let end: string | undefined;
    for (const period of periods) {
      const clippedEnd =
        period.end > evaluationDate ? evaluationDate : period.end;
      if (end && period.start > addCalendarDays(end, 1))
        gaps.push({
          patientId: period.record.patientId,
          programId: period.record.programId,
          startDate: addCalendarDays(end, 1),
          endDate: addCalendarDays(period.start, -1),
        });
      end = !end || clippedEnd > end ? clippedEnd : end;
    }
  }
  return gaps.sort(
    (a, b) =>
      a.patientId.localeCompare(b.patientId) ||
      a.programId.localeCompare(b.programId) ||
      a.startDate.localeCompare(b.startDate),
  );
}
export const coverageFiltersSchema = z
  .strictObject({
    date: dateSchema,
    search: z.string().trim().max(160).default(''),
    patientId: z.string().max(100).default(''),
    programId: z.string().max(100).default(''),
    status: z.enum(['all', ...coverageStatuses]).default('all'),
    renewalStatus: z.enum(['all', ...renewalStages]).default('all'),
    urgency: z.enum(['all', 'urgent', ...urgencyTypes]).default('all'),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    sortBy: z
      .enum(['startDate', 'endDate', 'renewalDueDate', 'updatedAt'])
      .default('startDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    'Date range is reversed',
  );
export type CoverageFilters = z.infer<typeof coverageFiltersSchema>;
export const coverageRowSchema = coverageSchema.safeExtend({
  patientName: z.string(),
  coordinatorName: z.string().nullable(),
});
export type CoverageRow = z.infer<typeof coverageRowSchema>;
export const coverageListSchema = z
  .strictObject({
    data: z.array(coverageRowSchema).max(100),
    pagination: z.strictObject({
      page: z.number().int().positive(),
      pageSize: z.number().int().min(1).max(100),
      totalItems: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  })
  .refine(
    (value) =>
      value.pagination.totalPages ===
        Math.ceil(value.pagination.totalItems / value.pagination.pageSize) &&
      value.data.length <= value.pagination.pageSize,
    'Invalid pagination metadata',
  );
export const coverageOverviewSchema = z.strictObject({
  activePatients: z.number().int().nonnegative(),
  expiringRecords: z.number().int().nonnegative(),
  dueRenewals: z.number().int().nonnegative(),
  overdueRenewals: z.number().int().nonnegative(),
  gapPatients: z.number().int().nonnegative(),
});
export const eventListSchema = z.array(eventSchema).max(2000);
export const patientPeriodsSchema = z.array(coverageSchema).max(1000);
