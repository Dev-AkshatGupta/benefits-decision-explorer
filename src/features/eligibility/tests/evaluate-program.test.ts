import { describe, expect, it } from 'vitest';
import {
  aggregateRuleStatuses,
  evaluateProgram,
} from '../engine/evaluate-program';
import type { EligibilityRule } from '../domain/types';
import { context, numberRule, testProgram } from './helpers';
describe('three-valued decision semantics', () => {
  it.each([
    ['ALL', ['pass', 'pass'], 'eligible'],
    ['ALL', ['pass', 'fail'], 'ineligible'],
    ['ALL', ['fail', 'fail'], 'ineligible'],
    ['ALL', ['pass', 'unknown'], 'needs_information'],
    ['ALL', ['fail', 'unknown'], 'ineligible'],
    ['ALL', ['unknown', 'unknown'], 'needs_information'],
    ['ANY', ['fail', 'pass'], 'eligible'],
    ['ANY', ['unknown', 'pass'], 'eligible'],
    ['ANY', ['fail', 'unknown'], 'needs_information'],
    ['ANY', ['unknown', 'unknown'], 'needs_information'],
    ['ANY', ['fail', 'fail'], 'ineligible'],
    ['ANY', ['pass', 'pass'], 'eligible'],
  ] as const)('%s %j => %s', (strategy, statuses, expected) =>
    expect(aggregateRuleStatuses(strategy, statuses)).toBe(expected),
  );
  it('evaluates all rules in policy order even after a failure', () => {
    const rules: EligibilityRule[] = [
      { ...numberRule, id: 'fail', expectedValue: 50 },
      { ...numberRule, id: 'unknown', field: 'householdSize' },
      { ...numberRule, id: 'pass' },
      { ...numberRule, id: 'unknown-again', field: 'householdSize' },
    ];
    const result = evaluateProgram(testProgram(rules), {
      ...context,
      householdSize: null,
    });
    expect(result.status).toBe('ineligible');
    expect(result.ruleResults.map((rule) => rule.ruleId)).toEqual([
      'fail',
      'unknown',
      'pass',
      'unknown-again',
    ]);
    expect(result).toMatchObject({
      passedRules: 1,
      failedRules: 1,
      unknownRules: 2,
      missingFields: ['householdSize'],
      policyVersion: '2026.1',
    });
    expect(
      result.ruleResults.every(
        (rule) => rule.explanation && rule.policyReference,
      ),
    ).toBe(true);
  });
  it('rejects empty or duplicate rule sets, mismatched references and invalid strategies', () => {
    expect(() => evaluateProgram(testProgram([]), context)).toThrow(
      expect.objectContaining({ code: 'MALFORMED_POLICY' }),
    );
    expect(() => aggregateRuleStatuses('ALL', [])).toThrow();
    expect(() => aggregateRuleStatuses('ANY', [])).toThrow();
    expect(() => aggregateRuleStatuses('NONE' as never, ['pass'])).toThrow(
      expect.objectContaining({ code: 'MALFORMED_POLICY' }),
    );
    expect(() =>
      aggregateRuleStatuses('ALL', ['unsupported'] as never),
    ).toThrow(expect.objectContaining({ code: 'MALFORMED_POLICY' }));
    expect(() =>
      evaluateProgram(testProgram([numberRule, numberRule]), context),
    ).toThrow();
    expect(() =>
      evaluateProgram({ ...testProgram(), policyVersion: 'other' }, context),
    ).toThrow();
    expect(() =>
      evaluateProgram(
        { ...testProgram(), evaluationStrategy: 'NONE' } as never,
        context,
      ),
    ).toThrow();
  });
  it('enforces applicability when evaluating an explicitly chosen version', () => {
    expect(() =>
      evaluateProgram(testProgram(), {
        ...context,
        evaluationDate: '2025-12-31',
      }),
    ).toThrow(expect.objectContaining({ code: 'POLICY_NOT_APPLICABLE' }));
    expect(() =>
      evaluateProgram({ ...testProgram(), effectiveTo: '2026-06-14' }, context),
    ).toThrow(expect.objectContaining({ code: 'POLICY_NOT_APPLICABLE' }));
    expect(
      evaluateProgram(
        { ...testProgram(), effectiveTo: context.evaluationDate },
        context,
      ).status,
    ).toBe('eligible');
  });
});
