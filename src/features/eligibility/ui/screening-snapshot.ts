import type { Household, Patient } from '../../patients/domain/schemas';
import { calculateAge } from '../../patients/domain/dates';
import type {
  DeepReadonly,
  EligibilityContext,
  EligibilityProgram,
  ProgramEvaluationResult,
} from '../domain/types';
export interface ScreeningSnapshot {
  /** Optional supporting metadata for simulations; not an additional engine field. */
  readonly qualifyingChildrenCount?: number | null;
  readonly patientId: string;
  readonly patientName: string;
  readonly patientUpdatedAt: string;
  readonly householdUpdatedAt: string | null;
  readonly context: EligibilityContext;
  readonly programs: readonly EligibilityProgram[];
  readonly results: readonly ProgramEvaluationResult[];
  readonly incomeSources:
    | readonly DeepReadonly<
        Pick<
          Household['incomeSources'][number],
          'type' | 'amount' | 'frequency'
        >
      >[]
    | null;
}
function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}
export function createScreeningSnapshot(
  patient: Patient,
  household: Household | null,
  context: EligibilityContext,
  programs: readonly EligibilityProgram[],
  results: readonly ProgramEvaluationResult[],
): ScreeningSnapshot {
  return freeze({
    qualifyingChildrenCount: household
      ? household.members.filter(
          (member) =>
            member.relationship === 'child' &&
            calculateAge(member.dateOfBirth, context.evaluationDate) < 13,
        ).length
      : null,
    patientId: patient.id,
    patientName: patient.firstName + ' ' + patient.lastName,
    patientUpdatedAt: patient.updatedAt,
    householdUpdatedAt: household?.updatedAt ?? null,
    context,
    programs,
    results,
    incomeSources:
      household?.incomeSources.map(({ type, amount, frequency }) => ({
        type,
        amount,
        frequency,
      })) ?? null,
  });
}
export function isSnapshotOutdated(
  snapshot: ScreeningSnapshot,
  patient: Patient | undefined,
  household: Household | undefined,
  householdMissing: boolean,
  date: string,
  selectedIds: readonly string[],
): boolean {
  return (
    date !== snapshot.context.evaluationDate ||
    JSON.stringify([...selectedIds].sort()) !==
      JSON.stringify(snapshot.programs.map((program) => program.id).sort()) ||
    (patient !== undefined &&
      patient.updatedAt !== snapshot.patientUpdatedAt) ||
    (household !== undefined &&
      household.updatedAt !== snapshot.householdUpdatedAt) ||
    (householdMissing && snapshot.householdUpdatedAt !== null)
  );
}
