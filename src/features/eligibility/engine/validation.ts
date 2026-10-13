import {
  eligibilityContextSchema,
  eligibilityProgramSchema,
  eligibilityRuleSchema,
  operators,
} from '../domain/schemas';
import type {
  EligibilityContext,
  EligibilityProgram,
  EligibilityRule,
} from '../domain/types';
import { EligibilityEngineError } from './errors';
function checkOperators(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  if (
    'operator' in value &&
    !operators.some((operator) => operator === value.operator)
  )
    throw new EligibilityEngineError(
      'UNSUPPORTED_OPERATOR',
      'The policy contains an unsupported operator.',
    );
  if ('rules' in value && Array.isArray(value.rules))
    value.rules.forEach(checkOperators);
}
export function validateRule(value: unknown): EligibilityRule {
  checkOperators(value);
  const result = eligibilityRuleSchema.safeParse(value);
  if (!result.success)
    throw new EligibilityEngineError(
      'MALFORMED_POLICY',
      'Invalid rule definition: ' +
        result.error.issues
          .map((issue) => issue.path.join('.') + ': ' + issue.message)
          .join('; '),
    );
  return result.data;
}
export function validateProgram(value: unknown): EligibilityProgram {
  checkOperators(value);
  const result = eligibilityProgramSchema.safeParse(value);
  if (!result.success)
    throw new EligibilityEngineError(
      'MALFORMED_POLICY',
      'Invalid program definition: ' +
        result.error.issues
          .map((issue) => issue.path.join('.') + ': ' + issue.message)
          .join('; '),
    );
  return result.data;
}
export function validateContext(value: unknown): EligibilityContext {
  const result = eligibilityContextSchema.safeParse(value);
  if (!result.success)
    throw new EligibilityEngineError(
      'INVALID_CONTEXT',
      'Invalid evaluation context: ' +
        result.error.issues
          .map((issue) => issue.path.join('.') + ': ' + issue.message)
          .join('; '),
    );
  return result.data;
}
