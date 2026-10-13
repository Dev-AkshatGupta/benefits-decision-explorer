import { describe, expect, it, vi } from 'vitest';
import { screenPatient } from '../engine/screen-patient';
import { buildEligibilityContext } from '../engine/context-builder';
import { selectPoliciesForDate } from '../engine/policy-selector';
import { demoPolicyRegistry } from '../policies/registry';
import { createSyntheticPatientData } from '../../../mocks/data/patients';
import { context, deepFreeze, testProgram } from './helpers';
describe('multiple fictional program screening', () => {
  const programs = selectPoliciesForDate(
    demoPolicyRegistry,
    context.evaluationDate,
  );
  it('screens five programs with complete ordered traces and references', () => {
    const results = screenPatient(programs, context);
    expect(results.map((result) => result.status)).toEqual([
      'eligible',
      'eligible',
      'eligible',
      'eligible',
      'eligible',
    ]);
    expect(results.map((result) => result.programId)).toEqual(
      programs.map((program) => program.id),
    );
    results.forEach((result, index) => {
      expect(result.ruleResults).toHaveLength(
        programs[index]?.rules.length ?? 0,
      );
      expect(
        result.passedRules + result.failedRules + result.unknownRules,
      ).toBe(result.ruleResults.length);
      expect(
        result.ruleResults.every(
          (rule) =>
            rule.explanation &&
            rule.policyReference.documentId.startsWith('DEMO-') &&
            rule.policyReference.policyVersion === result.policyVersion,
        ),
      ).toBe(true);
    });
  });
  it('aggregates missing information without changing fail/unknown semantics', () => {
    const results = screenPatient(programs, {
      patientId: 'missing-patient',
      evaluationDate: context.evaluationDate,
    });
    expect(
      results.every((result) => result.status === 'needs_information'),
    ).toBe(true);
    expect(results[0]?.missingFields).toEqual([
      'state',
      'age',
      'annualHouseholdIncomeCents',
      'incomeInformationStatus',
    ]);
    expect(results[2]?.missingFields).toContain('hasQualifyingChild');
    expect(results[0]?.unknownRules).toBe(4);
    expect(
      screenPatient(programs, {
        ...context,
        state: 'TX',
        annualHouseholdIncomeCents: null,
        incomeInformationStatus: 'incomplete',
      }).every((result) => result.status === 'ineligible'),
    ).toBe(true);
  });
  it('supports selected subsets, empty selections and rejects unselected versions', () => {
    expect(screenPatient([programs[2] ?? testProgram()], context)).toHaveLength(
      1,
    );
    expect(screenPatient([], context)).toEqual([]);
    expect(() => screenPatient(demoPolicyRegistry, context)).toThrow(
      expect.objectContaining({ code: 'AMBIGUOUS_POLICY_VERSION' }),
    );
  });
  it('is deterministic and does not mutate or retain mutable input references', () => {
    const frozenPrograms = deepFreeze(structuredClone(programs));
    const frozenContext = deepFreeze(structuredClone(context));
    const before = JSON.stringify({ frozenPrograms, frozenContext });
    const first = screenPatient(frozenPrograms, frozenContext);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2040-01-01T00:00:00Z'));
      expect(screenPatient(frozenPrograms, frozenContext)).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
    expect(JSON.stringify({ frozenPrograms, frozenContext })).toBe(before);
    const ref = first[0]?.ruleResults[0]?.policyReference;
    if (!ref) throw new Error('Missing reference');
    Object.assign(ref, { documentId: 'changed-result' });
    expect(
      screenPatient(frozenPrograms, frozenContext)[0]?.ruleResults[0]
        ?.policyReference.documentId,
    ).not.toBe('changed-result');
  });
  it('screens all 150 synthetic patients with bounded full traces and no fixture mutation', () => {
    const data = createSyntheticPatientData();
    const before = JSON.stringify(data);
    const statuses = new Set<string>();
    data.patients.forEach((patient, index) => {
      const household = data.households[index];
      if (!household) throw new Error('Missing household');
      const normalized = buildEligibilityContext(
        patient,
        household,
        context.evaluationDate,
      );
      const results = screenPatient(programs, normalized);
      expect(results).toHaveLength(5);
      results.forEach((result) => statuses.add(result.status));
      if (household.incomeInformationStatus === 'incomplete')
        expect(results.every((result) => result.unknownRules > 0)).toBe(true);
    });
    expect(statuses).toEqual(
      new Set(['eligible', 'ineligible', 'needs_information']),
    );
    expect(JSON.stringify(data)).toBe(before);
  });
  it('demonstrates an explicit version threshold change', () => {
    const sample = { ...context, age: 30, annualHouseholdIncomeCents: 3400000 };
    const old = selectPoliciesForDate(demoPolicyRegistry, '2025-06-15', [
      'demo-health',
    ]);
    const current = selectPoliciesForDate(demoPolicyRegistry, '2026-06-15', [
      'demo-health',
    ]);
    expect(
      screenPatient(old, { ...sample, evaluationDate: '2025-06-15' })[0]
        ?.status,
    ).toBe('ineligible');
    expect(screenPatient(current, sample)[0]?.status).toBe('eligible');
  });
});
