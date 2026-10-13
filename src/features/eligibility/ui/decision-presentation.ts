import { formatCurrency } from '../../patients/domain/income';
import { formatDate } from '../../patients/domain/dates';
import type {
  EligibilityField,
  EligibilityProgram,
  EligibilityRule,
  ProgramEvaluationResult,
  ProgramStatus,
  RuleStatus,
  RuleValue,
} from '../domain/types';
export { fieldLabels } from '../engine/explanations';
const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 20,
});
export const programStatusLabels: Record<ProgramStatus, string> = {
  eligible: 'Eligible',
  ineligible: 'Ineligible',
  needs_information: 'Needs information',
};
export const ruleStatusLabels: Record<RuleStatus, string> = {
  pass: 'Pass',
  fail: 'Fail',
  unknown: 'Unknown',
};
export const operatorLabels: Record<EligibilityRule['operator'], string> = {
  equals: 'Equals (=)',
  not_equals: 'Does not equal (≠)',
  greater_than: 'Greater than (>)',
  greater_than_or_equal: 'At least (≥)',
  less_than: 'Less than (<)',
  less_than_or_equal: 'At most (≤)',
  in: 'In the configured set',
  not_in: 'Not in the configured set',
};
export function formatRuleValue(
  value: RuleValue | null,
  field: EligibilityField,
): string {
  if (value === null) return 'Unknown — information unavailable';
  if (Array.isArray(value))
    return value.length
      ? value.map((item) => formatRuleValue(item, field)).join(', ')
      : 'Empty set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (field === 'annualHouseholdIncomeCents')
      return (value < 0 ? '−' : '') + formatCurrency(Math.abs(value));
    return numberFormatter.format(value);
  }
  if (
    (field === 'dateOfBirth' || field === 'evaluationDate') &&
    typeof value === 'string'
  )
    return formatDate(value);
  return String(value);
}
export function decisionSummary(
  result: ProgramEvaluationResult,
  strategy: EligibilityProgram['evaluationStrategy'],
): string {
  if (strategy === 'ALL') {
    if (result.failedRules > 0)
      return `${result.failedRules} required ${result.failedRules === 1 ? 'rule failed' : 'rules failed'}. Under ALL, any failed rule makes the demonstration outcome ineligible.${result.unknownRules ? ' Unknown rules remain unresolved; supplying information does not remove the existing failures.' : ''}`;
    if (result.unknownRules > 0)
      return 'No required rule failed, but information is missing. Under ALL, every required rule must pass, so the outcome needs information.';
    return 'Every required rule passed. Under ALL, the configured demonstration-policy requirements are met.';
  }
  if (result.passedRules > 0)
    return `At least one required rule passed. Under ANY, the configured demonstration-policy requirements are met.${result.unknownRules ? ' Unknown rules remain unresolved but do not override the passing rule.' : ''}`;
  if (result.unknownRules > 0)
    return 'No required rule passed, and information is missing. Under ANY, an unresolved rule could affect the outcome, so the decision needs information.';
  return 'Every required rule failed. Under ANY, at least one required rule must pass, so the demonstration outcome is ineligible.';
}
export function valueSource(field: EligibilityField): string {
  switch (field) {
    case 'age':
      return 'Derived from the saved birth date and evaluation date.';
    case 'annualHouseholdIncomeCents':
      return 'Derived from the evaluated income sources, only when the income report is complete.';
    case 'householdSize':
      return 'Derived from the evaluated household member count.';
    case 'hasQualifyingChild':
      return 'Derived from evaluated child relationships and birth dates; a qualifying child is younger than 13.';
    case 'incomeSourceTypes':
    case 'incomeSourcesCount':
      return 'Derived from recorded income sources in the evaluated snapshot.';
    case 'evaluationDate':
      return 'Coordinator-selected evaluation date.';
    default:
      return 'Patient or household input captured at screening time.';
  }
}
/** Presentation coordinates only; no eligibility or financial arithmetic. */
export function numericComparisonScale(actual: number, expected: number) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return null;
  const magnitude = Math.max(Math.abs(actual), Math.abs(expected), 1);
  const normalizedMin = Math.min(0, actual / magnitude, expected / magnitude);
  const normalizedMax = Math.max(0, actual / magnitude, expected / magnitude);
  const span = normalizedMax - normalizedMin || 1;
  const position = (value: number) =>
    18 + ((value / magnitude - normalizedMin) / span) * 264;
  return {
    actualX: position(actual),
    expectedX: position(expected),
    min: Math.min(0, actual, expected),
    max: Math.max(0, actual, expected) || 1,
  };
}
