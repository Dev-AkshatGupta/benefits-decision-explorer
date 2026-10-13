import { describe, expect, it } from 'vitest';
import { evaluateRule } from '../engine/evaluate-rule';
import type { EligibilityContext, EligibilityRule } from '../domain/types';
import { context, numberRule } from './helpers';
import { eligibilityRuleSchema } from '../domain/schemas';

describe('numeric operators and inclusive boundaries', () => {
  it.each([
    ['equals', 30, 'pass'],
    ['equals', 29, 'fail'],
    ['not_equals', 30, 'fail'],
    ['not_equals', 29, 'pass'],
    ['greater_than', 29, 'pass'],
    ['greater_than', 30, 'fail'],
    ['greater_than', 31, 'fail'],
    ['greater_than_or_equal', 30, 'pass'],
    ['greater_than_or_equal', 31, 'fail'],
    ['less_than', 31, 'pass'],
    ['less_than', 30, 'fail'],
    ['less_than', 29, 'fail'],
    ['less_than_or_equal', 30, 'pass'],
    ['less_than_or_equal', 29, 'fail'],
  ] as const)('%s %s returns %s', (operator, expectedValue, status) => {
    const result = evaluateRule(
      { ...numberRule, operator, expectedValue },
      context,
    );
    expect(result.status).toBe(status);
    expect(result.actualValue).toBe(30);
    expect(result.explanation).toContain(
      status === 'pass' ? 'is met' : 'is not met',
    );
    expect(result.policyReference).toEqual(numberRule.policyReference);
    expect(result.evaluatedAt).toBe(context.evaluationDate);
  });
  it.each([
    ['in', [29, 30], 'pass'],
    ['in', [31], 'fail'],
    ['not_in', [29, 30], 'fail'],
    ['not_in', [31], 'pass'],
  ] as const)('numeric membership %s', (operator, expectedValue, status) => {
    expect(
      evaluateRule({ ...numberRule, operator, expectedValue }, context).status,
    ).toBe(status);
  });
});
describe('typed scalar, date and array rules', () => {
  it.each([
    ['equals', 'CO', 'pass'],
    ['not_equals', 'CO', 'fail'],
    ['equals', 'AZ', 'fail'],
    ['not_equals', 'AZ', 'pass'],
    ['in', ['CO', 'AZ'], 'pass'],
    ['not_in', ['CO'], 'fail'],
    ['in', ['AZ'], 'fail'],
    ['not_in', ['AZ'], 'pass'],
  ] as const)('string %s', (operator, expectedValue, status) => {
    const rule = eligibilityRuleSchema.parse({
      ...numberRule,
      field: 'state',
      fieldType: 'string',
      operator,
      expectedValue,
    });
    expect(evaluateRule(rule, context).status).toBe(status);
  });
  it.each([
    ['equals', true, 'pass'],
    ['equals', false, 'fail'],
    ['not_equals', true, 'fail'],
    ['not_equals', false, 'pass'],
  ] as const)('boolean %s %s', (operator, expectedValue, status) => {
    expect(
      evaluateRule(
        {
          ...numberRule,
          field: 'hasQualifyingChild',
          fieldType: 'boolean',
          operator,
          expectedValue,
        },
        context,
      ).status,
    ).toBe(status);
  });
  it.each([
    ['equals', '2026-06-15', 'pass'],
    ['not_equals', '2026-06-15', 'fail'],
    ['greater_than', '2026-06-14', 'pass'],
    ['greater_than', '2026-06-15', 'fail'],
    ['greater_than_or_equal', '2026-06-15', 'pass'],
    ['less_than', '2026-06-16', 'pass'],
    ['less_than', '2026-06-15', 'fail'],
    ['less_than_or_equal', '2026-06-15', 'pass'],
    ['in', ['2026-06-15'], 'pass'],
    ['not_in', ['2026-06-15'], 'fail'],
  ] as const)('date %s', (operator, expectedValue, status) => {
    const rule = eligibilityRuleSchema.parse({
      ...numberRule,
      field: 'evaluationDate',
      fieldType: 'date',
      operator,
      expectedValue,
    });
    expect(evaluateRule(rule, context).status).toBe(status);
  });
  it.each([
    ['equals', ['employment', 'pension'], 'pass'],
    ['equals', ['employment'], 'fail'],
    ['not_equals', ['employment'], 'pass'],
    ['not_equals', ['pension', 'employment'], 'fail'],
    ['in', ['other', 'pension'], 'pass'],
    ['in', ['disability'], 'fail'],
    ['not_in', ['other'], 'pass'],
    ['not_in', ['employment'], 'fail'],
  ] as const)(
    'array %s uses set equality or intersection',
    (operator, expectedValue, status) => {
      expect(
        evaluateRule(
          {
            ...numberRule,
            field: 'incomeSourceTypes',
            fieldType: 'string_array',
            operator,
            expectedValue,
          },
          { ...context, incomeSourceTypes: ['pension', 'employment'] },
        ).status,
      ).toBe(status);
    },
  );
  it('preserves false, zero and an explicitly empty array as known values', () => {
    expect(
      evaluateRule(
        { ...numberRule, operator: 'equals', expectedValue: 0 },
        { ...context, age: 0 },
      ).status,
    ).toBe('pass');
    expect(
      evaluateRule(
        {
          ...numberRule,
          field: 'hasQualifyingChild',
          fieldType: 'boolean',
          operator: 'equals',
          expectedValue: false,
        },
        { ...context, hasQualifyingChild: false },
      ).status,
    ).toBe('pass');
    expect(
      evaluateRule(
        {
          ...numberRule,
          field: 'incomeSourceTypes',
          fieldType: 'string_array',
          operator: 'equals',
          expectedValue: [],
        },
        { ...context, incomeSourceTypes: [] },
      ).status,
    ).toBe('pass');
  });
});
describe('missing data and explicit errors', () => {
  it('treats an unknown completeness marker as missing information in completeness rules', () => {
    const rule: EligibilityRule = {
      ...numberRule,
      field: 'incomeInformationStatus',
      fieldType: 'string',
      operator: 'equals',
      expectedValue: 'complete',
    };
    const result = evaluateRule(rule, {
      ...context,
      annualHouseholdIncomeCents: null,
      incomeInformationStatus: 'unknown',
    });
    expect(result).toMatchObject({
      status: 'unknown',
      actualValue: null,
      missingFields: ['incomeInformationStatus'],
    });
  });
  it.each([null, undefined])('returns unknown for %s', (age) => {
    const result = evaluateRule(numberRule, { ...context, age });
    expect(result.status).toBe('unknown');
    expect(result.actualValue).toBeNull();
    expect(result.missingFields).toEqual(['age']);
    expect(result.explanation).toContain('Patient age');
  });
  it('handles absent properties and aggregates income completeness requirements', () => {
    const { age: _age, ...missingAge } = context;
    void _age;
    expect(evaluateRule(numberRule, missingAge).status).toBe('unknown');
    const incomeRule: EligibilityRule = {
      ...numberRule,
      field: 'annualHouseholdIncomeCents',
      operator: 'less_than_or_equal',
      expectedValue: 3500000,
    };
    const result = evaluateRule(incomeRule, {
      ...context,
      incomeInformationStatus: 'incomplete',
      annualHouseholdIncomeCents: null,
    });
    expect(result.missingFields).toEqual([
      'annualHouseholdIncomeCents',
      'incomeInformationStatus',
    ]);
    expect(
      evaluateRule(incomeRule, {
        ...context,
        annualHouseholdIncomeCents: 2400000,
      }).explanation,
    ).toContain('$24,000.00');
    expect(
      evaluateRule(incomeRule, {
        ...context,
        annualHouseholdIncomeCents: null,
        incomeSourcesCount: null,
      }).missingFields,
    ).toContain('incomeSourcesCount');
  });
  it.each([
    { operator: 'eval' },
    { field: '__proto__' },
    { expectedValue: '18' },
    { fieldType: 'string' },
    { expectedValue: NaN },
    { expectedValue: Infinity },
    { expectedValue: -1 },
    { expectedValue: 1.5 },
    { missingDataBehavior: 'fail' },
    {
      field: 'hasQualifyingChild',
      fieldType: 'boolean',
      operator: 'in',
      expectedValue: [true],
    },
    {
      field: 'state',
      fieldType: 'string',
      operator: 'greater_than',
      expectedValue: 'CO',
    },
    {
      field: 'evaluationDate',
      fieldType: 'date',
      operator: 'equals',
      expectedValue: '2026-02-30',
    },
    {
      field: 'incomeSourceTypes',
      fieldType: 'string_array',
      operator: 'equals',
      expectedValue: ['employment', 'employment'],
    },
  ])('rejects invalid policies %j', (patch) => {
    expect(() =>
      evaluateRule({ ...numberRule, ...patch } as EligibilityRule, context),
    ).toThrow();
    try {
      evaluateRule({ ...numberRule, ...patch } as EligibilityRule, context);
    } catch (error) {
      expect(error).toHaveProperty(
        'code',
        patch.operator === 'eval' ? 'UNSUPPORTED_OPERATOR' : 'MALFORMED_POLICY',
      );
    }
  });
  it.each([
    { age: '30' },
    { age: NaN },
    { age: -1 },
    { state: 7 },
    { householdSize: 0 },
    { incomeSourceTypes: [2] },
    { hasQualifyingChild: 'true' },
    { evaluationDate: '2026-02-30' },
    { incomeInformationStatus: 'unknown' },
    { dateOfBirth: '2027-01-01' },
    { dateOfBirth: '2026-02-30', age: 30 },
    { dateOfBirth: '2000-01-01', evaluationDate: '2026-02-30' },
    { dateOfBirth: '2000-06-15', age: 30 },
  ])('rejects malformed contexts without coercion %j', (patch) => {
    expect(() =>
      evaluateRule(numberRule, { ...context, ...patch } as EligibilityContext),
    ).toThrow(expect.objectContaining({ code: 'INVALID_CONTEXT' }));
  });
});
