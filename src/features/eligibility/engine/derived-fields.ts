import { calculateAge, isCalendarDate } from '../../patients/domain/dates';
import { calculateHouseholdAnnualIncome } from '../../patients/domain/income';
import type { IncomeSource } from '../../patients/domain/schemas';
import { EligibilityEngineError } from './errors';

export function deriveAge(
  dateOfBirth: string | null | undefined,
  evaluationDate: string,
): number | null {
  if (!isCalendarDate(evaluationDate))
    throw new EligibilityEngineError(
      'INVALID_CONTEXT',
      'A valid evaluation date is required.',
    );
  if (dateOfBirth == null) return null;
  try {
    return calculateAge(dateOfBirth, evaluationDate);
  } catch {
    throw new EligibilityEngineError(
      'INVALID_CONTEXT',
      'Birth dates must be valid and cannot follow the evaluation date.',
    );
  }
}
export function deriveHouseholdSize(
  members: readonly unknown[] | null | undefined,
): number | null {
  return members == null ? null : members.length;
}
export function deriveAnnualIncome(
  sources: readonly IncomeSource[] | null | undefined,
  completeness: string | null | undefined,
): number | null {
  // Even an empty list becomes confirmed zero only with an explicit complete report.
  if (sources == null || completeness !== 'complete') return null;
  try {
    return calculateHouseholdAnnualIncome(sources);
  } catch {
    throw new EligibilityEngineError(
      'INVALID_CONTEXT',
      'Income sources must produce safe integer cents.',
    );
  }
}
/** Fictional definition: a member with relationship child and age 0–12. */
export function deriveHasQualifyingChild(
  members:
    | readonly {
        readonly relationship: string;
        readonly dateOfBirth?: string | null | undefined;
      }[]
    | null
    | undefined,
  evaluationDate: string,
): boolean | null {
  if (!isCalendarDate(evaluationDate))
    throw new EligibilityEngineError(
      'INVALID_CONTEXT',
      'A valid evaluation date is required.',
    );
  if (members == null) return null;
  let unknown = false;
  let qualifies = false;
  for (const member of members) {
    const age = deriveAge(member.dateOfBirth, evaluationDate);
    if (member.relationship !== 'child') continue;
    if (age === null) unknown = true;
    else if (age < 13) qualifies = true;
  }
  return qualifies ? true : unknown ? null : false;
}
