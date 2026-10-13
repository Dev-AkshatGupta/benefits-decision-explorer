import { z } from 'zod';
import {
  calendarDateSchema,
  householdMemberSchema,
  incomeSourceSchema,
  incomeInformationStatuses,
  patientSchema,
} from '../../patients/domain/schemas';
import { calculateHouseholdAnnualIncome } from '../../patients/domain/income';
import type { EligibilityContext } from '../domain/types';
import {
  deriveAge,
  deriveAnnualIncome,
  deriveHasQualifyingChild,
  deriveHouseholdSize,
} from './derived-fields';
import { EligibilityEngineError } from './errors';
import { validateContext } from './validation';

// Only engine-relevant fields are parsed. Birth dates use the supplied date, never today's schema.
export const patientInputSchema = z.object({
  id: patientSchema.shape.id,
  householdId: patientSchema.shape.householdId,
  firstName: patientSchema.shape.firstName.optional(),
  lastName: patientSchema.shape.lastName.optional(),
  dateOfBirth: calendarDateSchema.nullish(),
  address: z
    .object({ state: patientSchema.shape.address.shape.state.nullish() })
    .nullish(),
});
const memberInputSchema = z.object({
  id: householdMemberSchema.shape.id,
  relationship: householdMemberSchema.shape.relationship,
  firstName: householdMemberSchema.shape.firstName.optional(),
  lastName: householdMemberSchema.shape.lastName.optional(),
  dateOfBirth: calendarDateSchema.nullish(),
});
export const householdInputSchema = z.object({
  id: patientSchema.shape.householdId,
  patientId: patientSchema.shape.id,
  members: z.array(memberInputSchema).min(1).max(50).nullish(),
  householdSize: z.number().int().min(1).max(50).nullish(),
  incomeSources: z.array(incomeSourceSchema).max(100).nullish(),
  incomeInformationStatus: z.enum(incomeInformationStatuses).nullish(),
  totalAnnualIncome: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .nullish(),
});
export type PatientContextInput = z.input<typeof patientInputSchema>;
export type HouseholdContextInput = z.input<typeof householdInputSchema>;

export function buildEligibilityContext(
  patient: PatientContextInput,
  household: HouseholdContextInput | null | undefined,
  evaluationDate: string,
): EligibilityContext {
  const patientResult = patientInputSchema.safeParse(patient);
  const householdResult =
    household == null ? null : householdInputSchema.safeParse(household);
  if (!patientResult.success || (householdResult && !householdResult.success))
    throw new EligibilityEngineError(
      'INVALID_CONTEXT',
      'Patient or household contains invalid eligibility input fields.',
    );
  const person = patientResult.data;
  const home = householdResult?.data;
  if (home && (home.id !== person.householdId || home.patientId !== person.id))
    throw new EligibilityEngineError(
      'INVALID_CONTEXT',
      'Patient and household identifiers do not match.',
    );
  const members = home?.members;
  if (members) {
    if (new Set(members.map((member) => member.id)).size !== members.length)
      throw new EligibilityEngineError(
        'INVALID_CONTEXT',
        'Household member IDs must be unique.',
      );
    const primary = members.filter((member) => member.relationship === 'self');
    if (primary.length !== 1)
      throw new EligibilityEngineError(
        'INVALID_CONTEXT',
        'A household requires exactly one primary patient.',
      );
    const self = primary[0];
    if (
      self &&
      ((person.dateOfBirth != null &&
        self.dateOfBirth != null &&
        self.dateOfBirth !== person.dateOfBirth) ||
        (person.firstName !== undefined &&
          self.firstName !== undefined &&
          person.firstName !== self.firstName) ||
        (person.lastName !== undefined &&
          self.lastName !== undefined &&
          person.lastName !== self.lastName))
    )
      throw new EligibilityEngineError(
        'INVALID_CONTEXT',
        'Primary household member does not match the patient.',
      );
    if (home?.householdSize != null && home.householdSize !== members.length)
      throw new EligibilityEngineError(
        'INVALID_CONTEXT',
        'Stored household size disagrees with the member count.',
      );
  }
  const sources = home?.incomeSources;
  if (sources) {
    if (new Set(sources.map((source) => source.id)).size !== sources.length)
      throw new EligibilityEngineError(
        'INVALID_CONTEXT',
        'Income source IDs must be unique.',
      );
    let total: number;
    try {
      total = calculateHouseholdAnnualIncome(sources);
    } catch {
      throw new EligibilityEngineError(
        'INVALID_CONTEXT',
        'Income sources exceed safe integer cents.',
      );
    }
    if (home?.totalAnnualIncome != null && total !== home.totalAnnualIncome)
      throw new EligibilityEngineError(
        'INVALID_CONTEXT',
        'Stored income disagrees with its sources.',
      );
  }
  return validateContext({
    patientId: person.id,
    evaluationDate,
    dateOfBirth: person.dateOfBirth ?? null,
    age: deriveAge(person.dateOfBirth, evaluationDate),
    state: person.address?.state ?? null,
    householdSize: deriveHouseholdSize(members),
    annualHouseholdIncomeCents: deriveAnnualIncome(
      sources,
      home?.incomeInformationStatus,
    ),
    incomeInformationStatus: home?.incomeInformationStatus ?? 'unknown',
    incomeSourcesCount: sources == null ? null : sources.length,
    incomeSourceTypes:
      sources == null
        ? null
        : [...new Set(sources.map((source) => source.type))],
    hasQualifyingChild: deriveHasQualifyingChild(members, evaluationDate),
  });
}
