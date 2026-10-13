import { describe, expect, it } from 'vitest';
import {
  decisionSummary,
  formatRuleValue,
  numericComparisonScale,
  valueSource,
} from './decision-presentation';
import { screenPatient } from '../engine/screen-patient';
import { context, numberRule, testProgram } from '../tests/helpers';
import { readScreeningParams, screeningReturnPath } from './screening-url';
import {
  createScreeningSnapshot,
  isSnapshotOutdated,
} from './screening-snapshot';
import { createSyntheticPatientData } from '../../../mocks/data/patients';
import { buildEligibilityContext } from '../engine/context-builder';
describe('decision presentation without reimplementing outcomes', () => {
  it.each([
    ['ALL', 18, 30, 'eligible', 'Every required rule passed'],
    ['ALL', 50, 30, 'ineligible', 'any failed rule'],
    ['ALL', 18, null, 'needs_information', 'No required rule failed'],
    ['ANY', 18, 30, 'eligible', 'At least one required rule passed'],
    ['ANY', 50, 30, 'ineligible', 'Every required rule failed'],
    ['ANY', 18, null, 'needs_information', 'No required rule passed'],
  ] as const)(
    'summarizes %s using engine counts',
    (strategy, expectedValue, age, status, text) => {
      const result = screenPatient(
        [testProgram([{ ...numberRule, expectedValue }], strategy)],
        { ...context, age },
      )[0];
      if (!result) throw new Error('Missing result');
      expect(result.status).toBe(status);
      expect(decisionSummary(result, strategy)).toContain(text);
    },
  );
  it('keeps unknowns visible when ALL fails or ANY passes', () => {
    const rules = [
      { ...numberRule, id: 'age' },
      { ...numberRule, id: 'size', field: 'householdSize' as const },
    ];
    const all = screenPatient([testProgram(rules)], {
      ...context,
      age: 10,
      householdSize: null,
    })[0]!;
    const any = screenPatient([testProgram(rules, 'ANY')], {
      ...context,
      householdSize: null,
    })[0]!;
    expect(decisionSummary(all, 'ALL')).toContain(
      'Unknown rules remain unresolved',
    );
    expect(decisionSummary(any, 'ANY')).toContain('do not override');
  });
  it('formats money, date, boolean, sets and missing values explicitly', () => {
    expect(formatRuleValue(0, 'annualHouseholdIncomeCents')).toBe('$0.00');
    expect(
      formatRuleValue(Number.MAX_SAFE_INTEGER, 'annualHouseholdIncomeCents'),
    ).toBe('$90,071,992,547,409.91');
    expect(formatRuleValue(-100, 'annualHouseholdIncomeCents')).toBe('−$1.00');
    expect(formatRuleValue(true, 'hasQualifyingChild')).toBe('Yes');
    expect(formatRuleValue(false, 'hasQualifyingChild')).toBe('No');
    expect(formatRuleValue(null, 'age')).toContain('Unknown');
    expect(formatRuleValue([], 'incomeSourceTypes')).toBe('Empty set');
    expect(formatRuleValue(['CO', 'AZ'], 'state')).toBe('CO, AZ');
    expect(formatRuleValue('2026-01-01', 'evaluationDate')).toBe('Jan 1, 2026');
    expect(formatRuleValue(12, 'age')).toBe('12');
  });
  it.each([
    [0, 0],
    [-42, 35],
    [0, 3500000],
    [Number.MAX_SAFE_INTEGER, 1],
    [-Number.MAX_VALUE, Number.MAX_VALUE],
    [42, 35],
    [35, 42],
  ])('uses finite scale coordinates for %s and %s', (actual, expected) => {
    const scale = numericComparisonScale(actual, expected)!;
    expect(scale.actualX).toBeGreaterThanOrEqual(18);
    expect(scale.actualX).toBeLessThanOrEqual(282);
    expect(scale.expectedX).toBeGreaterThanOrEqual(18);
    expect(scale.expectedX).toBeLessThanOrEqual(282);
    if (actual < expected) expect(scale.actualX).toBeLessThan(scale.expectedX);
    if (actual === expected) expect(scale.actualX).toBe(scale.expectedX);
  });
  it('rejects non-finite chart input and describes derived/input value sources', () => {
    expect(numericComparisonScale(Infinity, 1)).toBeNull();
    expect(valueSource('age')).toContain('birth date');
    expect(valueSource('annualHouseholdIncomeCents')).toContain('complete');
    expect(valueSource('state')).toContain('input');
    expect(valueSource('householdSize')).toContain('member count');
    expect(valueSource('hasQualifyingChild')).toContain('younger than 13');
    expect(valueSource('incomeSourceTypes')).toContain('sources');
    expect(valueSource('incomeSourcesCount')).toContain('sources');
    expect(valueSource('evaluationDate')).toContain('Coordinator');
  });
});
describe('session snapshots and safe return links', () => {
  it('captures minimal immutable values and detects changed inputs/versions', () => {
    const data = createSyntheticPatientData(),
      patient = data.patients[1]!,
      household = data.households[1]!;
    const date = context.evaluationDate,
      programs = [testProgram()];
    const normalized = buildEligibilityContext(patient, household, date);
    const snapshot = createScreeningSnapshot(
      patient,
      household,
      normalized,
      programs,
      screenPatient(programs, normalized),
    );
    expect(Object.isFrozen(snapshot.context)).toBe(true);
    expect(Object.isFrozen(snapshot.results)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain(patient.email);
    expect(snapshot.incomeSources?.[0]).not.toHaveProperty('id');
    expect(
      isSnapshotOutdated(snapshot, patient, household, false, date, [
        programs[0]!.id,
      ]),
    ).toBe(false);
    expect(
      isSnapshotOutdated(
        snapshot,
        { ...patient, updatedAt: '2027-01-01T00:00:00Z' },
        household,
        false,
        date,
        [programs[0]!.id],
      ),
    ).toBe(true);
    expect(
      isSnapshotOutdated(
        snapshot,
        patient,
        { ...household, updatedAt: '2027-01-01T00:00:00Z' },
        false,
        date,
        [programs[0]!.id],
      ),
    ).toBe(true);
    expect(
      isSnapshotOutdated(snapshot, patient, undefined, true, date, [
        programs[0]!.id,
      ]),
    ).toBe(true);
    expect(
      isSnapshotOutdated(snapshot, patient, household, false, '2026-06-16', [
        programs[0]!.id,
      ]),
    ).toBe(true);
    expect(
      isSnapshotOutdated(snapshot, patient, household, false, date, []),
    ).toBe(true);
    const empty = createScreeningSnapshot(
      patient,
      null,
      buildEligibilityContext(patient, null, date),
      programs,
      [],
    );
    expect(empty.incomeSources).toBeNull();
  });
  it('preserves only safe screening parameters for profile navigation', () => {
    expect(
      screeningReturnPath({
        screeningReturnSearch:
          'patientId=patient-001&date=2026-06-15&programId=demo-health&programs=demo-health&redirect=https://evil.example',
      }),
    ).toBe(
      '/eligibility?patientId=patient-001&date=2026-06-15&programId=demo-health&programs=demo-health',
    );
    expect(screeningReturnPath(null)).toBeNull();
    expect(
      screeningReturnPath({ screeningReturnSearch: 'patientId=../../evil' }),
    ).toBeNull();
    expect(
      readScreeningParams(
        new URLSearchParams(
          'patientId=patient-001&programs=demo-health,demo-health',
        ),
      ).programs,
    ).toEqual(['demo-health']);
  });
});
