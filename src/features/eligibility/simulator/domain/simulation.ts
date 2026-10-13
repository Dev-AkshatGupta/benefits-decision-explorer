import { z } from 'zod';
import { usStates } from '../../../patients/domain/schemas';
import { dollarsToCents } from '../../../patients/domain/profile-forms';
import { eligibilityContextSchema } from '../../domain/schemas';
import type {
  EligibilityContext,
  EligibilityField,
  ProgramEvaluationResult,
  RuleEvaluationResult,
} from '../../domain/types';
import type { ScreeningSnapshot } from '../../ui/screening-snapshot';

export const simulationFields = [
  'annualHouseholdIncomeCents',
  'householdSize',
  'state',
  'age',
  'hasQualifyingChild',
] as const;
export type SimulationField = (typeof simulationFields)[number];
export const simulationOverridesSchema = z.strictObject({
  annualHouseholdIncomeCents: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  householdSize: z.number().int().min(1).max(50).optional(),
  state: z.enum(usStates).optional(),
  age: z.number().int().min(0).max(120).optional(),
  hasQualifyingChild: z.boolean().optional(),
});
export type SimulationOverrides = Readonly<
  z.infer<typeof simulationOverridesSchema>
>;
export interface SimulationDraft {
  income: string;
  householdSize: string;
  state: string;
  age: string;
  children: string;
}
export const emptySimulationDraft: SimulationDraft = {
  income: '',
  householdSize: '',
  state: '',
  age: '',
  children: '',
};
export type SimulationErrors = Partial<Record<keyof SimulationDraft, string>>;

export function parseSimulationDraft(
  draft: SimulationDraft,
  baseline: ScreeningSnapshot,
): {
  overrides: SimulationOverrides;
  errors: SimulationErrors;
  context: EligibilityContext | null;
} {
  const errors: SimulationErrors = {};
  const values: {
    annualHouseholdIncomeCents?: number;
    householdSize?: number;
    state?: (typeof usStates)[number];
    age?: number;
    hasQualifyingChild?: boolean;
  } = {};
  if (draft.income.trim()) {
    try {
      values.annualHouseholdIncomeCents = dollarsToCents(draft.income);
    } catch {
      errors.income =
        'Enter a nonnegative USD amount with at most two decimal places, within safe integer cents.';
    }
  }
  const integer = (
    field: 'householdSize' | 'age',
    min: number,
    max: number,
  ) => {
    if (!draft[field].trim()) return;
    const value = draft[field].trim();
    if (
      !/^[0-9]+$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) < min ||
      Number(value) > max
    )
      errors[field] = `Enter a whole number from ${min} to ${max}.`;
    else values[field] = Number(value);
  };
  integer('householdSize', 1, 50);
  integer('age', 0, 120);
  if (draft.state) {
    const state = z.enum(usStates).safeParse(draft.state);
    if (state.success) values.state = state.data;
    else errors.state = 'Choose a supported U.S. state.';
  }
  if (draft.children) {
    if (draft.children === 'yes' || draft.children === 'no')
      values.hasQualifyingChild = draft.children === 'yes';
    else errors.children = 'Choose Yes, No, or Use baseline.';
  }
  const overrides = Object.fromEntries(
    Object.entries(values).filter(
      ([field, value]) => value !== baseline.context[field as SimulationField],
    ),
  ) as SimulationOverrides;
  if (Object.keys(errors).length) return { overrides, errors, context: null };
  const childPresent =
    overrides.hasQualifyingChild ?? baseline.context.hasQualifyingChild;
  const size = overrides.householdSize ?? baseline.context.householdSize;
  const childCount =
    childPresent === true
      ? baseline.context.hasQualifyingChild === true
        ? Math.max(baseline.qualifyingChildrenCount ?? 1, 1)
        : 1
      : 0;
  if (size != null && size < childCount + 1) {
    errors.householdSize = `A qualifying-child scenario needs at least ${childCount + 1} household members, including the primary patient. Adjust household size or child presence.`;
    return { overrides, errors, context: null };
  }
  return {
    overrides,
    errors,
    context: applySimulationOverrides(baseline.context, overrides),
  };
}
export function applySimulationOverrides(
  baseline: EligibilityContext,
  overrides: SimulationOverrides,
): EligibilityContext {
  const validated = simulationOverridesSchema.parse(overrides);
  return eligibilityContextSchema.parse({
    ...baseline,
    ...validated,
    ...(validated.age !== undefined && validated.age !== baseline.age
      ? { dateOfBirth: null }
      : {}),
    ...(validated.annualHouseholdIncomeCents !== undefined
      ? { incomeInformationStatus: 'complete' }
      : {}),
  });
}
export interface RuleDifference {
  baseline: RuleEvaluationResult;
  simulated: RuleEvaluationResult;
  outcomeChanged: boolean;
  valueChanged: boolean;
}
export interface ProgramDifference {
  baseline: ProgramEvaluationResult;
  simulated: ProgramEvaluationResult;
  statusChanged: boolean;
  rules: readonly RuleDifference[];
}
/** Compare identifiers and actual outcomes, never infer a decision from numeric movement. */
export function compareEligibilityResults(
  baseline: readonly ProgramEvaluationResult[],
  simulated: readonly ProgramEvaluationResult[],
): readonly ProgramDifference[] {
  if (
    baseline.length !== simulated.length ||
    new Set(baseline.map((result) => result.programId)).size !==
      baseline.length ||
    new Set(simulated.map((result) => result.programId)).size !==
      simulated.length
  )
    throw new Error(
      'Simulation programs must match the unique baseline programs.',
    );
  return baseline.map((before) => {
    const after = simulated.find(
      (result) =>
        result.programId === before.programId &&
        result.policyVersion === before.policyVersion,
    );
    if (
      !after ||
      after.patientId !== before.patientId ||
      after.evaluatedAt !== before.evaluatedAt ||
      after.ruleResults.length !== before.ruleResults.length
    )
      throw new Error(
        'Simulation must use the baseline patient, date, rules and policy versions.',
      );
    return {
      baseline: before,
      simulated: after,
      statusChanged: before.status !== after.status,
      rules: before.ruleResults.map((rule) => {
        const next = after.ruleResults.find(
          (item) => item.ruleId === rule.ruleId,
        );
        if (!next)
          throw new Error(
            'Simulation rule identifiers must match the baseline.',
          );
        if (
          next.operator !== rule.operator ||
          JSON.stringify(next.expectedValue) !==
            JSON.stringify(rule.expectedValue)
        )
          throw new Error('Simulation cannot change configured rule operands.');
        return {
          baseline: rule,
          simulated: next,
          outcomeChanged: rule.status !== next.status,
          valueChanged:
            JSON.stringify(rule.actualValue) !==
            JSON.stringify(next.actualValue),
        };
      }),
    };
  });
}
export function incomeDifferenceCents(before: number, after: number): number {
  if (
    !Number.isSafeInteger(before) ||
    !Number.isSafeInteger(after) ||
    before < 0 ||
    after < 0
  )
    throw new RangeError(
      'Income differences require safe nonnegative integer cents.',
    );
  return Number(BigInt(after) - BigInt(before));
}
export function inputDifferences(
  baseline: EligibilityContext,
  simulated: EligibilityContext,
): readonly {
  field: SimulationField;
  before: EligibilityContext[EligibilityField];
  after: EligibilityContext[EligibilityField];
}[] {
  return simulationFields
    .filter((field) => (baseline[field] ?? null) !== (simulated[field] ?? null))
    .map((field) => ({
      field,
      before: baseline[field] ?? null,
      after: simulated[field] ?? null,
    }));
}
