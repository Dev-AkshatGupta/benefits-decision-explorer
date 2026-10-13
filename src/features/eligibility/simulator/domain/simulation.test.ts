import { describe, expect, it } from 'vitest';
import { createSyntheticPatientData } from '../../../../mocks/data/patients';
import { buildEligibilityContext } from '../../engine/context-builder';
import { screenPatient } from '../../engine/screen-patient';
import { selectPoliciesForDate } from '../../engine/policy-selector';
import { demoPolicyRegistry } from '../../policies/registry';
import { createScreeningSnapshot } from '../../ui/screening-snapshot';
import {
  applySimulationOverrides,
  compareEligibilityResults,
  emptySimulationDraft,
  incomeDifferenceCents,
  inputDifferences,
  parseSimulationDraft,
  simulationOverridesSchema,
} from './simulation';
export function baselineAt(
  index = 10,
  date = '2026-06-15',
  selectedIds?: string[],
) {
  const data = createSyntheticPatientData(),
    patient = data.patients[index]!,
    household = data.households[index]!;
  const context = buildEligibilityContext(patient, household, date),
    programs = selectPoliciesForDate(demoPolicyRegistry, date, selectedIds);
  return createScreeningSnapshot(
    patient,
    household,
    context,
    programs,
    screenPatient(programs, context),
  );
}
describe('explicit scenario overrides', () => {
  it('preserves immutable baseline and fixed policies/date while changing each supported field', () => {
    const baseline = baselineAt(),
      before = JSON.stringify(baseline);
    const parsed = parseSimulationDraft(
      {
        income: '50000.29',
        householdSize: '2',
        state: 'AZ',
        age: '40',
        children: 'yes',
      },
      baseline,
    );
    expect(parsed.errors).toEqual({});
    expect(parsed.context).toMatchObject({
      annualHouseholdIncomeCents: 5000029,
      householdSize: 2,
      state: 'AZ',
      age: 40,
      hasQualifyingChild: true,
      dateOfBirth: null,
      incomeInformationStatus: 'complete',
      evaluationDate: baseline.context.evaluationDate,
    });
    expect(JSON.stringify(baseline)).toBe(before);
    expect(Object.isFrozen(baseline)).toBe(true);
    expect(inputDifferences(baseline.context, parsed.context!)).toHaveLength(5);
  });
  it.each([
    ['income', '-1'],
    ['income', '1.001'],
    ['income', '1e5'],
    ['income', 'abc'],
    ['income', '90071992547409.92'],
    ['householdSize', '0'],
    ['householdSize', '51'],
    ['householdSize', '1.2'],
    ['householdSize', '1e1'],
    ['age', '-1'],
    ['age', '121'],
    ['age', '2.2'],
    ['state', 'XX'],
    ['children', 'maybe'],
  ] as const)('rejects %s=%s without evaluation context', (field, value) => {
    const parsed = parseSimulationDraft(
      { ...emptySimulationDraft, [field]: value },
      baselineAt(),
    );
    expect(parsed.context).toBeNull();
    expect(parsed.errors[field]).toBeTruthy();
  });
  it('preserves unknowns on blank/reset and distinguishes explicit zero income', () => {
    const baseline = baselineAt(0);
    expect(
      parseSimulationDraft(emptySimulationDraft, baseline).context
        ?.annualHouseholdIncomeCents,
    ).toBeNull();
    const zero = parseSimulationDraft(
      { ...emptySimulationDraft, income: '0' },
      baseline,
    );
    expect(zero.context?.annualHouseholdIncomeCents).toBe(0);
    expect(zero.context?.incomeInformationStatus).toBe('complete');
    expect(
      parseSimulationDraft(emptySimulationDraft, baseline).context,
    ).toEqual(baseline.context);
    expect(incomeDifferenceCents(29, 100)).toBe(71);
    expect(incomeDifferenceCents(Number.MAX_SAFE_INTEGER, 0)).toBe(
      -Number.MAX_SAFE_INTEGER,
    );
    expect(() => incomeDifferenceCents(-1, 0)).toThrow();
  });
  it('removes birth-date coupling only for hypothetical age and rejects hidden context edits', () => {
    const baseline = baselineAt();
    expect(
      applySimulationOverrides(baseline.context, { age: 65 }).dateOfBirth,
    ).toBeNull();
    expect(
      applySimulationOverrides(baseline.context, { age: baseline.context.age! })
        .dateOfBirth,
    ).toBe(baseline.context.dateOfBirth);
    expect(
      simulationOverridesSchema.safeParse({ evaluationDate: '2027-01-01' })
        .success,
    ).toBe(false);
    expect(
      simulationOverridesSchema.safeParse({ dateOfBirth: '1990-01-01' })
        .success,
    ).toBe(false);
    expect(
      simulationOverridesSchema.safeParse({ annualHouseholdIncomeCents: NaN })
        .success,
    ).toBe(false);
  });
  it('requires room for the primary patient and known or hypothetical qualifying children', () => {
    const onePerson = baselineAt();
    expect(
      parseSimulationDraft(
        { ...emptySimulationDraft, children: 'yes' },
        onePerson,
      ).errors.householdSize,
    ).toContain('at least 2');
    expect(
      parseSimulationDraft(
        { ...emptySimulationDraft, children: 'yes', householdSize: '2' },
        onePerson,
      ).context?.hasQualifyingChild,
    ).toBe(true);
    const childBaseline = baselineAt(4); // Primary, spouse and three qualifying children.
    expect(childBaseline.qualifyingChildrenCount).toBe(3);
    expect(
      parseSimulationDraft(
        { ...emptySimulationDraft, householdSize: '3' },
        childBaseline,
      ).context,
    ).toBeNull();
    expect(
      parseSimulationDraft(
        { ...emptySimulationDraft, householdSize: '1', children: 'no' },
        childBaseline,
      ).context?.householdSize,
    ).toBe(1);
    const { qualifyingChildrenCount: omitted, ...legacy } = childBaseline;
    void omitted;
    // Optional metadata absence still enforces the known presence minimum.
    expect(
      parseSimulationDraft(
        { ...emptySimulationDraft, householdSize: '1' },
        legacy,
      ).context,
    ).toBeNull();
  });
  it('does not fabricate missing household members when baseline context is unknown', () => {
    const baseline = baselineAt();
    const unknown = {
      ...baseline,
      qualifyingChildrenCount: null,
      context: {
        ...baseline.context,
        householdSize: null,
        hasQualifyingChild: null,
      },
    };
    expect(
      parseSimulationDraft(emptySimulationDraft, unknown).context
        ?.householdSize,
    ).toBeNull();
    expect(
      parseSimulationDraft(
        { ...emptySimulationDraft, children: 'yes' },
        unknown,
      ).context?.householdSize,
    ).toBeNull();
  });
});
describe('engine-driven outcome comparison', () => {
  it.each([
    [{ annualHouseholdIncomeCents: 6000000 }, 3, 5],
    [{ householdSize: 2 }, 1, 1],
    [{ state: 'TX' }, 3, 5],
    [{ age: 65 }, 1, 1],
    [{ householdSize: 2, hasQualifyingChild: true }, 2, 2],
  ] as const)(
    'detects actual program/rule changes for %j',
    (overrides, programsChanged, rulesChanged) => {
      const baseline = baselineAt();
      const simulated = screenPatient(
        baseline.programs,
        applySimulationOverrides(baseline.context, overrides),
      );
      const comparisons = compareEligibilityResults(
        baseline.results,
        simulated,
      );
      expect(
        comparisons.filter((program) => program.statusChanged),
      ).toHaveLength(programsChanged);
      expect(
        comparisons
          .flatMap((program) => program.rules)
          .filter((rule) => rule.outcomeChanged),
      ).toHaveLength(rulesChanged);
      expect(simulated.map((result) => result.policyVersion)).toEqual(
        baseline.results.map((result) => result.policyVersion),
      );
    },
  );
  it('counts changed outcomes, not altered actual values, and preserves unknown transitions', () => {
    const baseline = baselineAt();
    const changes = compareEligibilityResults(
      baseline.results,
      screenPatient(
        baseline.programs,
        applySimulationOverrides(baseline.context, {
          annualHouseholdIncomeCents: 100,
        }),
      ),
    );
    expect(
      changes.every(
        (program) =>
          !program.statusChanged &&
          program.rules.every((rule) => !rule.outcomeChanged),
      ),
    ).toBe(true);
    expect(
      changes
        .flatMap((program) => program.rules)
        .some((rule) => rule.valueChanged),
    ).toBe(true);
    const unknown = baselineAt(0),
      supplied = screenPatient(
        unknown.programs,
        applySimulationOverrides(unknown.context, {
          annualHouseholdIncomeCents: 0,
        }),
      );
    expect(
      compareEligibilityResults(unknown.results, supplied).filter(
        (program) => program.statusChanged,
      ),
    ).toHaveLength(2);
    expect(
      compareEligibilityResults(unknown.results, supplied)
        .flatMap((program) => program.rules)
        .filter((rule) => rule.outcomeChanged),
    ).toHaveLength(5);
  });
  it('uses a captured historical version rather than today’s registry selection', () => {
    const baseline = baselineAt(10, '2025-06-15', ['demo-health']);
    expect(baseline.programs[0]?.policyVersion).toBe('2025.1');
    const result = screenPatient(
      baseline.programs,
      applySimulationOverrides(baseline.context, {
        annualHouseholdIncomeCents: 3400000,
      }),
    );
    expect(result[0]).toMatchObject({
      policyVersion: '2025.1',
      evaluatedAt: '2025-06-15',
      status: 'ineligible',
    });
  });
  it('rejects mismatched programs, versions, dates, rule sets and operands', () => {
    const baseline = baselineAt(),
      results = baseline.results;
    expect(() => compareEligibilityResults(results, [])).toThrow();
    expect(() =>
      compareEligibilityResults(results, [...results, results[0]!]),
    ).toThrow();
    for (const patch of [
      { policyVersion: 'other' },
      { evaluatedAt: '2027-01-01' },
      { patientId: 'other' },
      { ruleResults: [] },
    ])
      expect(() =>
        compareEligibilityResults(
          results,
          results.map((result, index) =>
            index === 0 ? { ...result, ...patch } : result,
          ),
        ),
      ).toThrow();
    const changed = results.map((result, index) =>
      index === 0
        ? {
            ...result,
            ruleResults: result.ruleResults.map((rule, position) =>
              position === 0 ? { ...rule, expectedValue: 'different' } : rule,
            ),
          }
        : result,
    );
    expect(() => compareEligibilityResults(results, changed)).toThrow();
  });
});
