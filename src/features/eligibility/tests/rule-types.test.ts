import { expect, it } from 'vitest';
import type { EligibilityRule } from '../domain/types';
import { numberRule } from './helpers';
import { eligibilityRuleSchema } from '../domain/schemas';
// These declarations are checked by tsc, in addition to runtime schema tests.
// @ts-expect-error Numeric ordered rules require numeric operands.
const invalidNumeric: EligibilityRule = { ...numberRule, expectedValue: '18' };
// @ts-expect-error Boolean fields do not support numeric ordering.
const invalidBoolean: EligibilityRule = {
  ...numberRule,
  field: 'hasQualifyingChild',
  fieldType: 'boolean',
  operator: 'greater_than',
  expectedValue: true,
};
// @ts-expect-error Fields and declared field types must agree.
const invalidField: EligibilityRule = { ...numberRule, field: 'state' };
// @ts-expect-error Membership operators require an array operand.
const invalidMembership: EligibilityRule = {
  ...numberRule,
  operator: 'in',
  expectedValue: 18,
};
it.each([invalidNumeric, invalidBoolean, invalidField, invalidMembership])(
  'rejects the same invalid combinations at the type and runtime boundaries: %j',
  (rule) => {
    expect(eligibilityRuleSchema.safeParse(rule).success).toBe(false);
  },
);
