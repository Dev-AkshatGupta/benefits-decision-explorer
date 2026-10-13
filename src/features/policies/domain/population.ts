import { z } from 'zod';
import {
  patientInputSchema,
  householdInputSchema,
  buildEligibilityContext,
} from '../../eligibility/engine/context-builder';
import { evaluateValidatedProgram } from '../../eligibility/engine/evaluate-program';
import {
  validateContext,
  validateProgram,
} from '../../eligibility/engine/validation';
import type {
  EligibilityContext,
  EligibilityProgram,
  ProgramEvaluationResult,
  ProgramStatus,
  RuleEvaluationResult,
} from '../../eligibility/domain/types';
export const statuses = [
  'eligible',
  'ineligible',
  'needs_information',
] as const;
export type Transition = `${ProgramStatus}->${ProgramStatus}`;
export const populationRecordSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('record'),
    recordKey: z.string().min(1),
    patientName: z.string(),
    patient: patientInputSchema,
    household: householdInputSchema.nullable(),
  }),
  z.object({
    kind: z.literal('error'),
    recordKey: z.string().min(1),
    patientName: z.string(),
    patientId: z.string().nullable(),
    message: z.string(),
  }),
]);
export const populationResponseSchema = z.object({
  snapshotId: z.string().min(1),
  records: z.array(populationRecordSchema).max(2000),
});
export const populationVersionSchema = z.object({
  snapshotId: z.string().min(1),
  count: z.number().int().nonnegative().max(2000),
});
export type PopulationResponse = z.infer<typeof populationResponseSchema>;
export type PopulationRecord = z.infer<typeof populationRecordSchema>;
export interface PopulationError {
  recordKey: string;
  patientId: string | null;
  patientName: string;
  message: string;
}
export interface RuleImpact {
  ruleId: string;
  baseline: RuleEvaluationResult | null;
  comparison: RuleEvaluationResult | null;
  outcomeChanged: boolean;
}
export interface PatientImpact {
  patientId: string;
  context: EligibilityContext;
  baseline: ProgramEvaluationResult;
  comparison: ProgramEvaluationResult;
  transition: Transition;
  changed: boolean;
  rules: readonly RuleImpact[];
}
export interface PopulationImpactResult {
  total: number;
  evaluated: number;
  changed: number;
  unchanged: number;
  becameEligible: number;
  becameIneligible: number;
  intoNeedsInformation: number;
  outOfNeedsInformation: number;
  matrix: Record<ProgramStatus, Record<ProgramStatus, number>>;
  patients: readonly PatientImpact[];
  errors: readonly PopulationError[];
}
/** Explicit stable content encoding for a noncryptographic snapshot identifier; never used for semantic policy diffs. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
      .join(',') +
    '}'
  );
}
export function populationFingerprint(value: unknown): string {
  let hash = 14695981039346656037n;
  const encoded = canonical(value);
  for (let index = 0; index < encoded.length; index++)
    hash = BigInt.asUintN(
      64,
      (hash ^ BigInt(encoded.charCodeAt(index))) * 1099511628211n,
    );
  return 'demo-population-' + hash.toString(16).padStart(16, '0');
}
export function normalizePopulation(
  records: readonly PopulationRecord[],
  evaluationDate: string,
) {
  const contexts: EligibilityContext[] = [],
    errors: PopulationError[] = [];
  const names = new Map<string, string>();
  for (const record of records) {
    if (record.kind === 'error') {
      errors.push(record);
      continue;
    }
    try {
      const context = buildEligibilityContext(
        record.patient,
        record.household,
        evaluationDate,
      );
      contexts.push(context);
      names.set(context.patientId, record.patientName);
    } catch {
      errors.push({
        recordKey: record.recordKey,
        patientId: record.patient.id,
        patientName: record.patientName,
        message:
          'Patient/household data cannot form a valid context on this evaluation date.',
      });
    }
  }
  return { contexts, errors, names };
}
export function analyzePolicyImpact(
  population: readonly EligibilityContext[],
  before: EligibilityProgram,
  after: EligibilityProgram,
): PopulationImpactResult {
  const baseline = validateProgram(before),
    comparison = validateProgram(after);
  if (
    baseline.id !== comparison.id ||
    baseline.policyVersion === comparison.policyVersion
  )
    throw new Error(
      'Choose two distinct versions of the same fictional program.',
    );
  const matrix: PopulationImpactResult['matrix'] = {
    eligible: { eligible: 0, ineligible: 0, needs_information: 0 },
    ineligible: { eligible: 0, ineligible: 0, needs_information: 0 },
    needs_information: { eligible: 0, ineligible: 0, needs_information: 0 },
  };
  const patients: PatientImpact[] = [],
    errors: PopulationError[] = [],
    seen = new Set<string>();
  let evaluationDate: string | undefined;
  for (const candidate of population) {
    try {
      const context = validateContext(candidate);
      if (evaluationDate && context.evaluationDate !== evaluationDate)
        throw new Error('All contexts must use one evaluation date.');
      evaluationDate = context.evaluationDate;
      if (seen.has(context.patientId))
        throw new Error('Duplicate patient identifier.');
      seen.add(context.patientId);
      // Both calls receive the same validated context. Only applicability-window checks are bypassed.
      const old = evaluateValidatedProgram(baseline, context, 'counterfactual'),
        next = evaluateValidatedProgram(comparison, context, 'counterfactual');
      const previousRules = new Map(
          old.ruleResults.map((rule) => [rule.ruleId, rule]),
        ),
        nextRules = new Map(
          next.ruleResults.map((rule) => [rule.ruleId, rule]),
        );
      const ids = [
        ...previousRules.keys(),
        ...[...nextRules.keys()].filter((id) => !previousRules.has(id)),
      ];
      const rules = ids.map((ruleId) => {
        const a = previousRules.get(ruleId) ?? null,
          b = nextRules.get(ruleId) ?? null;
        return {
          ruleId,
          baseline: a,
          comparison: b,
          outcomeChanged: a === null || b === null || a.status !== b.status,
        };
      });
      matrix[old.status][next.status]++;
      patients.push({
        patientId: context.patientId,
        context,
        baseline: old,
        comparison: next,
        transition: `${old.status}->${next.status}`,
        changed: old.status !== next.status,
        rules,
      });
    } catch {
      errors.push({
        recordKey: 'context-' + (patients.length + errors.length + 1),
        patientId:
          typeof candidate?.patientId === 'string' ? candidate.patientId : null,
        patientName:
          typeof candidate?.patientId === 'string'
            ? candidate.patientId
            : 'Invalid record',
        message:
          'Invalid, duplicate, or differently dated evaluation context; no eligibility transition assigned.',
      });
    }
  }
  const changed = patients.filter((patient) => patient.changed).length;
  return {
    total: population.length,
    evaluated: patients.length,
    changed,
    unchanged: patients.length - changed,
    becameEligible: patients.filter(
      (patient) => patient.changed && patient.comparison.status === 'eligible',
    ).length,
    becameIneligible: patients.filter(
      (patient) =>
        patient.changed && patient.comparison.status === 'ineligible',
    ).length,
    intoNeedsInformation: patients.filter(
      (patient) =>
        patient.changed && patient.comparison.status === 'needs_information',
    ).length,
    outOfNeedsInformation: patients.filter(
      (patient) =>
        patient.changed && patient.baseline.status === 'needs_information',
    ).length,
    matrix,
    patients,
    errors,
  };
}
