import { describe, expect, it } from 'vitest';
import {
  demoHealth2025,
  demoHealth2026,
  demoNutrition2025,
  demoNutrition,
  demoFamily2025,
  demoFamily,
} from '../../eligibility/policies/demo-programs';
import type {
  EligibilityContext,
  EligibilityProgram,
  EligibilityRule,
} from '../../eligibility/domain/types';
import { evaluateProgram } from '../../eligibility/engine/evaluate-program';
import { comparePolicyVersions, equivalentOperand } from './policy-diff';
import {
  analyzePolicyImpact,
  normalizePopulation,
  populationFingerprint,
  statuses,
  populationResponseSchema,
} from './population';
import { capturePolicyPopulation } from '@/mocks/data/policy-population';
import { mockDatabase } from '@/mocks/data/database';
import { getPolicyPopulation } from '../api/population-api';
function rulesPolicy(
  rules: readonly EligibilityRule[],
  extra: Partial<EligibilityProgram> = {},
): EligibilityProgram {
  return { ...demoHealth2025, rules, ...extra };
}
const rule = demoHealth2025.rules[0]!;
describe('structural policy comparison', () => {
  it('matches stable IDs instead of order and identifies unchanged rules', () => {
    const result = comparePolicyVersions(demoHealth2025, {
      ...demoHealth2025,
      rules: [...demoHealth2025.rules].reverse(),
    });
    expect(result.rules.every((item) => item.type === 'unchanged')).toBe(true);
  });
  it('detects added and removed rules and reverses the direction', () => {
    const next = rulesPolicy([{ ...rule, id: 'added' }]);
    const diff = comparePolicyVersions(demoHealth2025, next);
    expect(diff.rules.filter((item) => item.type === 'removed')).toHaveLength(
      demoHealth2025.rules.length,
    );
    expect(diff.rules.find((item) => item.ruleId === 'added')?.type).toBe(
      'added',
    );
    const reversed = comparePolicyVersions(next, demoHealth2025);
    expect(reversed.rules.filter((item) => item.type === 'added')).toHaveLength(
      demoHealth2025.rules.length,
    );
    expect(reversed.rules[0]?.type).toBe('removed');
  });
  it('detects thresholds and operators as semantic properties', () => {
    const next: EligibilityRule = {
      ...rule,
      field: 'annualHouseholdIncomeCents',
      fieldType: 'number',
      operator: 'less_than',
      expectedValue: 4200000,
    };
    const diff = comparePolicyVersions(
      rulesPolicy([rule]),
      rulesPolicy([next]),
    );
    expect(diff.rules[0]).toMatchObject({ type: 'modified', semantic: true });
    expect(diff.rules[0]?.properties).toEqual(
      expect.arrayContaining(['operator', 'expectedValue']),
    );
  });
  it.each(['name', 'description'] as const)(
    '%s-only changes are presentation changes',
    (property) => {
      const diff = comparePolicyVersions(
        rulesPolicy([rule]),
        rulesPolicy([{ ...rule, [property]: 'Reworded presentation' }]),
      );
      expect(diff.rules[0]).toMatchObject({
        type: 'modified',
        semantic: false,
        properties: [property],
      });
    },
  );
  it('detects field changes; missing data remains unknown by schema', () => {
    const next: EligibilityRule = {
      ...rule,
      field: 'age',
      fieldType: 'number',
      operator: 'less_than_or_equal',
      expectedValue: 35,
      missingDataBehavior: 'unknown',
    };
    expect(
      comparePolicyVersions(rulesPolicy([rule]), rulesPolicy([next])).rules[0]
        ?.properties,
    ).toEqual(expect.arrayContaining(['field', 'expectedValue']));
  });
  it('keeps reference changes separate from logic and detects policy metadata/strategy', () => {
    const next = rulesPolicy(
      [
        {
          ...rule,
          policyReference: { ...rule.policyReference, section: 'reworded' },
        },
      ],
      { evaluationStrategy: 'ANY', description: 'Reworded' },
    );
    const diff = comparePolicyVersions(rulesPolicy([rule]), next);
    expect(diff.rules[0]).toMatchObject({
      semantic: false,
      properties: ['policyReference'],
    });
    expect(diff.strategyChanged).toBe(true);
    expect(diff.metadataChanged).toContain('description');
  });
  it('normalizes categorical sets without stringifying semantic data', () => {
    expect(equivalentOperand(['CO', 'AZ', 'CO'], ['AZ', 'CO'])).toBe(true);
    expect(equivalentOperand(['CO'], ['AZ'])).toBe(false);
    expect(equivalentOperand([1, 2], [2, 1])).toBe(true);
    expect(equivalentOperand([1], ['1'])).toBe(false);
    expect(equivalentOperand(1, 1)).toBe(true);
    expect(equivalentOperand(1, 2)).toBe(false);
  });
  it('rejects different programs and invalid configuration', () => {
    expect(() => comparePolicyVersions(demoHealth2025, demoNutrition)).toThrow(
      /same/,
    );
    expect(() =>
      comparePolicyVersions(demoHealth2025, { ...demoHealth2025, rules: [] }),
    ).toThrow();
  });
  it('historical additions provide meaningful changes without altering current definitions', () => {
    expect(
      comparePolicyVersions(demoNutrition2025, demoNutrition).rules.some(
        (item) => item.type === 'removed',
      ),
    ).toBe(true);
    expect(
      comparePolicyVersions(demoFamily2025, demoFamily).rules.filter(
        (item) => item.semantic,
      ),
    ).toHaveLength(2);
    expect(
      demoFamily.rules.find((item) => item.field === 'householdSize')
        ?.expectedValue,
    ).toBe(2);
  });
});
function transitionPolicies(): [EligibilityProgram, EligibilityProgram] {
  const baseline = rulesPolicy([
    {
      ...rule,
      field: 'age',
      fieldType: 'number',
      operator: 'greater_than_or_equal',
      expectedValue: 18,
    },
  ]);
  const comparison: EligibilityProgram = {
    ...demoHealth2026,
    rules: [
      {
        ...baseline.rules[0]!,
        field: 'householdSize',
        fieldType: 'number',
        operator: 'greater_than_or_equal',
        expectedValue: 2,
        policyReference: {
          ...rule.policyReference,
          policyVersion: demoHealth2026.policyVersion,
        },
      },
    ],
  };
  return [baseline, comparison];
}
const nine: EligibilityContext[] = [18, 10, null].flatMap((age, i) =>
  [2, 1, null].map((householdSize, j) => ({
    patientId: `case-${i}-${j}`,
    evaluationDate: '2026-06-15',
    age,
    householdSize,
  })),
);
describe('population impact', () => {
  it('keeps differently dated contexts out of a single-date population comparison', () => {
    const result = analyzePolicyImpact(
      [nine[0]!, { ...nine[1]!, evaluationDate: '2026-07-01' }],
      ...transitionPolicies(),
    );
    expect(result.evaluated).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
  it('explains strategy-driven changes even when rule outcomes are identical', () => {
    const old = { ...demoFamily2025, rules: demoFamily2025.rules.slice(0, 2) };
    const next: EligibilityProgram = {
      ...demoFamily,
      evaluationStrategy: 'ANY',
      rules: old.rules.map((rule) => ({
        ...rule,
        policyReference: {
          ...rule.policyReference,
          policyVersion: demoFamily.policyVersion,
        },
      })),
    };
    const result = analyzePolicyImpact(
      [
        {
          patientId: 'strategy-case',
          evaluationDate: '2026-06-15',
          householdSize: 2,
          annualHouseholdIncomeCents: 0,
          incomeInformationStatus: 'complete',
        },
      ],
      old,
      next,
    );
    expect(result.patients[0]?.transition).toBe('ineligible->eligible');
    expect(
      result.patients[0]?.rules.every((rule) => !rule.outcomeChanged),
    ).toBe(true);
  });
  it('supports all nine transitions and reconciles every aggregate, row, and column', () => {
    const result = analyzePolicyImpact(nine, ...transitionPolicies());
    expect(result).toMatchObject({
      total: 9,
      evaluated: 9,
      changed: 6,
      unchanged: 3,
      becameEligible: 2,
      becameIneligible: 2,
      intoNeedsInformation: 2,
      outOfNeedsInformation: 2,
      errors: [],
    });
    for (const before of statuses) {
      expect(
        statuses.reduce((n, after) => n + result.matrix[before][after], 0),
      ).toBe(3);
      for (const after of statuses)
        expect(result.matrix[before][after]).toBe(1);
    }
    for (const after of statuses)
      expect(
        statuses.reduce((n, before) => n + result.matrix[before][after], 0),
      ).toBe(3);
    expect(
      new Set(result.patients.map((patient) => patient.transition)).size,
    ).toBe(9);
  });
  it('evaluates one unchanged context/date under both explicit policies and preserves input ordering', () => {
    const result = analyzePolicyImpact(nine, ...transitionPolicies());
    expect(result.patients.map((patient) => patient.patientId)).toEqual(
      nine.map((context) => context.patientId),
    );
    result.patients.forEach((patient, i) => {
      expect(patient.context).toEqual(nine[i]);
      expect(patient.baseline.evaluatedAt).toBe('2026-06-15');
      expect(patient.comparison.evaluatedAt).toBe('2026-06-15');
      expect(patient.baseline.ruleResults[0]?.actualValue).toBe(nine[i]?.age);
      expect(patient.comparison.ruleResults[0]?.actualValue).toBe(
        nine[i]?.householdSize,
      );
    });
  });
  it('normal screening still enforces effective dates while counterfactual comparison explicitly bypasses them', () => {
    expect(() => evaluateProgram(demoHealth2025, nine[0]!)).toThrow();
    expect(
      analyzePolicyImpact(nine, demoHealth2025, demoHealth2026).evaluated,
    ).toBe(9);
  });
  it('records changed rule outcomes and preserves both explanations', () => {
    const patient = analyzePolicyImpact(
      nine,
      ...transitionPolicies(),
    ).patients.find(
      (patient) => patient.transition === 'ineligible->eligible',
    )!;
    expect(patient.rules[0]).toMatchObject({
      outcomeChanged: true,
      baseline: { status: 'fail', expectedValue: 18 },
      comparison: { status: 'pass', expectedValue: 2 },
    });
    expect(patient.rules[0]?.baseline?.explanation).toBeTruthy();
    expect(patient.rules[0]?.comparison?.explanation).toBeTruthy();
  });
  it('added and removed rules are represented as absent rather than failed evaluations', () => {
    const result = analyzePolicyImpact(
      [
        {
          patientId: 'one',
          evaluationDate: '2026-06-15',
          age: 30,
          state: 'CO',
          householdSize: 2,
          annualHouseholdIncomeCents: 3000000,
          incomeInformationStatus: 'complete',
        },
      ],
      demoNutrition2025,
      demoNutrition,
    );
    expect(
      result.patients[0]?.rules.find((rule) =>
        rule.ruleId.includes('SIZE-MAX'),
      ),
    ).toMatchObject({
      baseline: { status: 'pass' },
      comparison: null,
      outcomeChanged: true,
    });
  });
  it('malformed and duplicate contexts are errors separate from Needs Information', () => {
    const result = analyzePolicyImpact(
      [nine[0]!, { ...nine[1]!, age: -1 }, nine[0]!],
      ...transitionPolicies(),
    );
    expect(result).toMatchObject({ total: 3, evaluated: 1 });
    expect(result.errors).toHaveLength(2);
    expect(result.matrix.needs_information.needs_information).toBe(0);
  });
  it('does not mutate inputs and produces deterministic results', () => {
    const population = structuredClone(nine),
      policies = transitionPolicies(),
      before = structuredClone({ population, policies });
    Object.freeze(population);
    population.forEach(Object.freeze);
    const one = analyzePolicyImpact(population, ...policies),
      two = analyzePolicyImpact(population, ...policies);
    expect(one).toEqual(two);
    expect({ population, policies }).toEqual(before);
  });
  it('reports an empty population and rejects ambiguous selections', () => {
    expect(analyzePolicyImpact([], ...transitionPolicies())).toMatchObject({
      total: 0,
      evaluated: 0,
      errors: [],
    });
    expect(() =>
      analyzePolicyImpact([], demoHealth2025, demoHealth2025),
    ).toThrow(/distinct/);
    expect(() => analyzePolicyImpact([], demoHealth2025, demoFamily)).toThrow(
      /same/,
    );
  });
});
describe('full synthetic population snapshot', () => {
  it('loads all 150 records through one validated batch request without contact fields', async () => {
    const response = await getPolicyPopulation();
    expect(response.records).toHaveLength(150);
    expect(populationResponseSchema.safeParse(response).success).toBe(true);
    const first = response.records[0]!;
    expect(first.kind).toBe('record');
    if (first.kind === 'record') {
      expect(first.patient).not.toHaveProperty('email');
      expect(first.patient).not.toHaveProperty('phone');
    }
  });
  it('fingerprints deterministic snapshots and recognizes changed records', () => {
    const before = capturePolicyPopulation();
    expect(capturePolicyPopulation().snapshotId).toBe(before.snapshotId);
    mockDatabase.patients[0]!.updatedAt = '2026-10-09T00:00:00.000Z';
    expect(capturePolicyPopulation().snapshotId).not.toBe(before.snapshotId);
    expect(populationFingerprint({ b: 2, a: 1 })).toBe(
      populationFingerprint({ a: 1, b: 2 }),
    );
  });
  it('reports malformed source records without silently dropping them', () => {
    mockDatabase.patients[0]!.dateOfBirth = 'bad-date';
    const snapshot = capturePolicyPopulation();
    expect(snapshot.records).toHaveLength(150);
    expect(snapshot.records[0]?.kind).toBe('error');
    const normalized = normalizePopulation(snapshot.records, '2026-06-15');
    expect(normalized.errors).toHaveLength(1);
    expect(normalized.contexts).toHaveLength(149);
  });
  it('ordinary missing households yield unknown fields through the same engine', () => {
    mockDatabase.households = mockDatabase.households.filter(
      (household) => household.patientId !== mockDatabase.patients[0]!.id,
    );
    const record = capturePolicyPopulation().records[0]!;
    expect(record.kind).toBe('record');
    const normalized = normalizePopulation([record], '2026-06-15');
    expect(normalized.errors).toHaveLength(0);
    expect(normalized.contexts[0]?.householdSize).toBeNull();
  });
  it('analyzes the actual fixture with reconciliation and preserves the database', () => {
    const before = structuredClone(mockDatabase),
      snapshot = capturePolicyPopulation();
    const normalized = normalizePopulation(snapshot.records, '2026-06-15'),
      result = analyzePolicyImpact(
        normalized.contexts,
        demoFamily2025,
        demoFamily,
      );
    expect(result.total).toBe(150);
    expect(result.errors).toHaveLength(0);
    expect(normalized.errors).toHaveLength(0);
    expect(result.changed + result.unchanged).toBe(150);
    expect(result.changed).toBeGreaterThan(0);
    expect(mockDatabase).toEqual(before);
  });
});
