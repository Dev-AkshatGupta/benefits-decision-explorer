import type {
  EligibilityContext,
  EligibilityField,
  EligibilityRule,
  RuleEvaluationResult,
  RuleStatus,
  RuleValue,
} from '../domain/types';
import { compareRule } from './operators';
import { explainRule } from './explanations';
import { validateContext, validateRule } from './validation';

/** Internal composition point: callers must validate both contracts first. */
export function evaluateValidatedRule(
  rule: EligibilityRule,
  context: EligibilityContext,
): RuleEvaluationResult {
  const value = context[rule.field];
  const actual: RuleValue | null =
    rule.field === 'incomeInformationStatus' && value === 'unknown'
      ? null
      : (value ?? null);
  const status: RuleStatus =
    actual === null ? 'unknown' : compareRule(rule, actual) ? 'pass' : 'fail';
  const missingFields: EligibilityField[] =
    status === 'unknown' ? [rule.field] : [];
  if (
    status === 'unknown' &&
    rule.field === 'annualHouseholdIncomeCents' &&
    context.incomeInformationStatus !== 'complete'
  )
    missingFields.push('incomeInformationStatus');
  if (
    status === 'unknown' &&
    rule.field === 'annualHouseholdIncomeCents' &&
    context.incomeInformationStatus === 'complete' &&
    context.incomeSourcesCount == null
  )
    missingFields.push('incomeSourcesCount');
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    status,
    // Copy arrays/references to keep returned traces independent of caller inputs.
    actualValue: Array.isArray(actual) ? [...actual] : actual,
    expectedValue: Array.isArray(rule.expectedValue)
      ? [...rule.expectedValue]
      : rule.expectedValue,
    operator: rule.operator,
    explanation: explainRule(rule, actual, status, missingFields),
    policyReference: { ...rule.policyReference },
    missingFields,
    evaluatedAt: context.evaluationDate,
  };
}
export function evaluateRule(
  rule: EligibilityRule,
  context: EligibilityContext,
): RuleEvaluationResult {
  return evaluateValidatedRule(validateRule(rule), validateContext(context));
}
