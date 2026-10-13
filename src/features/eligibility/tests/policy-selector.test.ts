import { describe, expect, it } from 'vitest';
import {
  selectPolicyVersion,
  selectPoliciesForDate,
  validatePolicyRegistry,
} from '../engine/policy-selector';
import { demoPolicyRegistry } from '../policies/registry';
import { testProgram } from './helpers';
describe('effective calendar dates and registry validation', () => {
  it.each([
    ['2025-01-01', '2025.1'],
    ['2025-12-31', '2025.1'],
    ['2026-01-01', '2026.1'],
    ['2030-01-01', '2026.1'],
  ] as const)('selects %s => %s', (date, version) => {
    expect(
      selectPolicyVersion(demoPolicyRegistry, 'demo-health', date)
        .policyVersion,
    ).toBe(version);
  });
  it('selects five applicable programs and ordered subsets', () => {
    expect(
      selectPoliciesForDate(demoPolicyRegistry, '2026-06-15'),
    ).toHaveLength(5);
    expect(
      selectPoliciesForDate(demoPolicyRegistry, '2026-06-15', [
        'demo-family',
        'demo-health',
      ]).map((policy) => policy.id),
    ).toEqual(['demo-family', 'demo-health']);
    expect(selectPoliciesForDate(demoPolicyRegistry, '2026-06-15', [])).toEqual(
      [],
    );
  });
  it('handles gaps and unknown programs with an explicit non-applicable error', () => {
    const earlier = {
      ...testProgram(),
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-01-31',
    };
    const later = {
      ...testProgram(),
      effectiveFrom: '2026-03-01',
      policyVersion: '2026.2',
      rules: testProgram().rules.map((rule) => ({
        ...rule,
        policyReference: { ...rule.policyReference, policyVersion: '2026.2' },
      })),
    };
    expect(() =>
      selectPolicyVersion([earlier, later], earlier.id, '2026-02-15'),
    ).toThrow(expect.objectContaining({ code: 'POLICY_NOT_APPLICABLE' }));
    expect(
      selectPolicyVersion([later, earlier], earlier.id, '2026-03-01')
        .policyVersion,
    ).toBe('2026.2');
    expect(() =>
      selectPolicyVersion(demoPolicyRegistry, 'missing', '2026-01-01'),
    ).toThrow(expect.objectContaining({ code: 'POLICY_NOT_APPLICABLE' }));
    expect(() =>
      selectPoliciesForDate(demoPolicyRegistry, '2024-01-01'),
    ).toThrow(expect.objectContaining({ code: 'POLICY_NOT_APPLICABLE' }));
  });
  it.each(['2026-01-01', '2026-01-31'])(
    'rejects inclusive overlapping dates at %s',
    (start) => {
      const first = { ...testProgram(), effectiveTo: '2026-01-31' };
      const second = {
        ...testProgram(),
        effectiveFrom: start,
        policyVersion: '2026.2',
        rules: first.rules.map((rule) => ({
          ...rule,
          policyReference: { ...rule.policyReference, policyVersion: '2026.2' },
        })),
      };
      expect(() =>
        selectPolicyVersion([first, second], first.id, '2026-06-01'),
      ).toThrow(expect.objectContaining({ code: 'AMBIGUOUS_POLICY_VERSION' }));
    },
  );
  it('rejects duplicate versions, open-ended overlap, duplicate selections and inverted periods', () => {
    expect(() =>
      validatePolicyRegistry([testProgram(), testProgram()]),
    ).toThrow(expect.objectContaining({ code: 'AMBIGUOUS_POLICY_VERSION' }));
    const otherVersion = {
      ...testProgram(),
      policyVersion: '2027.1',
      effectiveFrom: '2027-01-01',
      rules: testProgram().rules.map((rule) => ({
        ...rule,
        policyReference: { ...rule.policyReference, policyVersion: '2027.1' },
      })),
    };
    expect(() => validatePolicyRegistry([testProgram(), otherVersion])).toThrow(
      expect.objectContaining({ code: 'AMBIGUOUS_POLICY_VERSION' }),
    );
    expect(() =>
      selectPoliciesForDate(demoPolicyRegistry, '2026-01-01', [
        'demo-health',
        'demo-health',
      ]),
    ).toThrow();
    expect(() =>
      validatePolicyRegistry([{ ...testProgram(), effectiveTo: '2025-01-01' }]),
    ).toThrow(expect.objectContaining({ code: 'MALFORMED_POLICY' }));
  });
  it.each(['2026-02-30', 'invalid', '2026-01-01T00:00:00Z'])(
    'rejects invalid evaluation date %s',
    (date) => {
      expect(() =>
        selectPolicyVersion(demoPolicyRegistry, 'demo-health', date),
      ).toThrow(expect.objectContaining({ code: 'INVALID_CONTEXT' }));
      expect(() => selectPoliciesForDate(demoPolicyRegistry, date)).toThrow(
        expect.objectContaining({ code: 'INVALID_CONTEXT' }),
      );
    },
  );
  it('freezes every registry level', () => {
    expect(Object.isFrozen(demoPolicyRegistry)).toBe(true);
    expect(
      Object.isFrozen(demoPolicyRegistry[0]?.rules[0]?.policyReference),
    ).toBe(true);
    expect(() => {
      Object.assign(demoPolicyRegistry[0] ?? {}, { policyVersion: 'tampered' });
    }).toThrow();
  });
});
