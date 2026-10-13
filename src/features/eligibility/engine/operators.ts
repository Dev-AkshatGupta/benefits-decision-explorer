import type { EligibilityRule, RuleValue } from '../domain/types';
function assertNever(value: never): never {
  throw new Error('Unreachable operator: ' + String(value));
}
export function compareRule(rule: EligibilityRule, actual: RuleValue): boolean {
  // Runtime contracts were validated at the engine boundary. Arrays use set semantics.
  const expected = rule.expectedValue;
  const equal =
    Array.isArray(actual) && Array.isArray(expected)
      ? actual.length === expected.length &&
        actual.every((value) => expected.some((item) => item === value))
      : actual === expected;
  switch (rule.operator) {
    case 'equals':
      return equal;
    case 'not_equals':
      return !equal;
    case 'in':
    case 'not_in': {
      const matches =
        Array.isArray(expected) &&
        (Array.isArray(actual)
          ? actual.some((value) => expected.some((item) => item === value))
          : expected.some((value) => value === actual));
      return rule.operator === 'in' ? matches : !matches;
    }
    case 'greater_than':
      return actual > expected;
    case 'greater_than_or_equal':
      return actual >= expected;
    case 'less_than':
      return actual < expected;
    case 'less_than_or_equal':
      return actual <= expected;
    default:
      return assertNever(rule);
  }
}
