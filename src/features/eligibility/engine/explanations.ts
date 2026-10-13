import { formatCurrency } from '../../patients/domain/income';
import type {
  EligibilityField,
  EligibilityRule,
  RuleStatus,
  RuleValue,
} from '../domain/types';
export const fieldLabels: Record<EligibilityField, string> = {
  age: 'Patient age',
  state: 'State of residence',
  householdSize: 'Household size',
  annualHouseholdIncomeCents: 'Annual household income',
  incomeSourcesCount: 'Recorded income source count',
  evaluationDate: 'Evaluation date',
  dateOfBirth: 'Patient date of birth',
  hasQualifyingChild: 'Presence of a household child younger than 13',
  incomeSourceTypes: 'Recorded income source types',
  incomeInformationStatus: 'Income information completeness',
};
const operatorLabels: Record<EligibilityRule['operator'], string> = {
  equals: 'equal to',
  not_equals: 'not equal to',
  greater_than: 'greater than',
  greater_than_or_equal: 'greater than or equal to',
  less_than: 'less than',
  less_than_or_equal: 'less than or equal to',
  in: 'in',
  not_in: 'not in',
};
function display(value: RuleValue, field: EligibilityField): string {
  if (Array.isArray(value))
    return '[' + value.map((item) => display(item, field)).join(', ') + ']';
  if (typeof value === 'number' && field === 'annualHouseholdIncomeCents')
    return formatCurrency(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
export function explainRule(
  rule: EligibilityRule,
  actual: RuleValue | null,
  status: RuleStatus,
  missing: readonly EligibilityField[],
): string {
  if (status === 'unknown')
    return `${fieldLabels[rule.field]} is unknown. Missing information: ${missing.map((field) => fieldLabels[field]).join(', ')}. This demonstration rule cannot be evaluated yet.`;
  const relation =
    rule.fieldType === 'string_array' &&
    (rule.operator === 'in' || rule.operator === 'not_in')
      ? rule.operator === 'in'
        ? 'overlap with'
        : 'have no overlap with'
      : operatorLabels[rule.operator];
  return `${fieldLabels[rule.field]}: ${display(actual ?? '', rule.field)}. Configured demonstration condition: ${relation} ${display(rule.expectedValue, rule.field)}. The condition ${status === 'pass' ? 'is met' : 'is not met'}.`;
}
