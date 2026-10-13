import { isCalendarDate } from '../../patients/domain/dates';
import type { EligibilityProgram } from '../domain/types';
import { EligibilityEngineError } from './errors';
import { validateProgram } from './validation';

export function validatePolicyRegistry(
  programs: readonly EligibilityProgram[],
): readonly EligibilityProgram[] {
  const validated = programs.map(validateProgram);
  const groups = new Map<string, EligibilityProgram[]>();
  for (const program of validated) {
    const group = groups.get(program.id) ?? [];
    group.push(program);
    groups.set(program.id, group);
  }
  for (const group of groups.values()) {
    if (
      new Set(group.map((program) => program.policyVersion)).size !==
      group.length
    )
      throw new EligibilityEngineError(
        'AMBIGUOUS_POLICY_VERSION',
        'Duplicate version identifiers for the same program.',
      );
    const sorted = [...group].sort((a, b) =>
      a.effectiveFrom < b.effectiveFrom
        ? -1
        : a.effectiveFrom > b.effectiveFrom
          ? 1
          : 0,
    );
    for (let index = 1; index < sorted.length; index++) {
      const previous = sorted[index - 1],
        current = sorted[index];
      if (
        previous &&
        current &&
        (!previous.effectiveTo || previous.effectiveTo >= current.effectiveFrom)
      )
        throw new EligibilityEngineError(
          'AMBIGUOUS_POLICY_VERSION',
          'Policy effective periods overlap; calendar-date endpoints are inclusive.',
        );
    }
  }
  return validated;
}
export function selectPolicyVersion(
  programs: readonly EligibilityProgram[],
  programId: string,
  evaluationDate: string,
): EligibilityProgram {
  if (!isCalendarDate(evaluationDate))
    throw new EligibilityEngineError(
      'INVALID_CONTEXT',
      'Policy selection requires a valid evaluation calendar date.',
    );
  const validated = validatePolicyRegistry(programs);
  const applicable = validated.find(
    (program) =>
      program.id === programId &&
      program.effectiveFrom <= evaluationDate &&
      (!program.effectiveTo || program.effectiveTo >= evaluationDate),
  );
  if (!applicable)
    throw new EligibilityEngineError(
      'POLICY_NOT_APPLICABLE',
      'No policy version is effective for the requested program and date.',
    );
  return applicable;
}
/** Select once per date before screening a batch; first-occurrence program ordering is retained. */
export function selectPoliciesForDate(
  programs: readonly EligibilityProgram[],
  evaluationDate: string,
  selectedIds?: readonly string[],
): readonly EligibilityProgram[] {
  if (!isCalendarDate(evaluationDate))
    throw new EligibilityEngineError(
      'INVALID_CONTEXT',
      'Policy selection requires a valid evaluation calendar date.',
    );
  const validated = validatePolicyRegistry(programs);
  const ids = selectedIds ?? [
    ...new Set(validated.map((program) => program.id)),
  ];
  if (new Set(ids).size !== ids.length)
    throw new EligibilityEngineError(
      'AMBIGUOUS_POLICY_VERSION',
      'Selected program IDs must be unique.',
    );
  return ids.map((id) => {
    const applicable = validated.find(
      (program) =>
        program.id === id &&
        program.effectiveFrom <= evaluationDate &&
        (!program.effectiveTo || program.effectiveTo >= evaluationDate),
    );
    if (!applicable)
      throw new EligibilityEngineError(
        'POLICY_NOT_APPLICABLE',
        `No policy version is effective for program ${id} on the requested date.`,
      );
    return applicable;
  });
}
