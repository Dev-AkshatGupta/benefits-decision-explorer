import type { z } from 'zod';
import type {
  eligibilityContextSchema,
  eligibilityProgramSchema,
  eligibilityRuleSchema,
  fieldSchema,
  policyReferenceSchema,
} from './schemas';
export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
export type EligibilityRule = DeepReadonly<
  z.infer<typeof eligibilityRuleSchema>
>;
export type EligibilityProgram = DeepReadonly<
  z.infer<typeof eligibilityProgramSchema>
>;
export type EligibilityContext = DeepReadonly<
  z.infer<typeof eligibilityContextSchema>
>;
export type EligibilityField = z.infer<typeof fieldSchema>;
export type PolicyReference = DeepReadonly<
  z.infer<typeof policyReferenceSchema>
>;
export type RuleStatus = 'pass' | 'fail' | 'unknown';
export type ProgramStatus = 'eligible' | 'ineligible' | 'needs_information';
export type RuleValue =
  number | string | boolean | readonly string[] | readonly number[];
export interface RuleEvaluationResult {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly status: RuleStatus;
  readonly actualValue: RuleValue | null;
  readonly expectedValue: RuleValue;
  readonly operator: EligibilityRule['operator'];
  readonly explanation: string;
  readonly policyReference: PolicyReference;
  readonly missingFields: readonly EligibilityField[];
  /** Supplied calendar date, not a wall-clock timestamp. */
  readonly evaluatedAt: string;
}
export interface ProgramEvaluationResult {
  readonly patientId: string;
  readonly programId: string;
  readonly programName: string;
  readonly policyVersion: string;
  readonly status: ProgramStatus;
  readonly ruleResults: readonly RuleEvaluationResult[];
  readonly passedRules: number;
  readonly failedRules: number;
  readonly unknownRules: number;
  readonly missingFields: readonly EligibilityField[];
  readonly evaluatedAt: string;
}
