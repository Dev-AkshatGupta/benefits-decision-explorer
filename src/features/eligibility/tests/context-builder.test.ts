import { describe, expect, it, vi } from 'vitest';
import {
  buildEligibilityContext,
  type HouseholdContextInput,
  type PatientContextInput,
} from '../engine/context-builder';
import { deriveAge, deriveHasQualifyingChild } from '../engine/derived-fields';
import { createSyntheticPatientData } from '../../../mocks/data/patients';
const patient: PatientContextInput = {
  id: 'demo-person',
  householdId: 'demo-home',
  dateOfBirth: '1990-06-15',
  address: { state: 'CO' },
};
const household: HouseholdContextInput = {
  id: 'demo-home',
  patientId: 'demo-person',
  members: [
    { id: 'self', relationship: 'self', dateOfBirth: '1990-06-15' },
    { id: 'child', relationship: 'child', dateOfBirth: '2015-08-20' },
  ],
  householdSize: 2,
  incomeInformationStatus: 'complete',
  incomeSources: [
    { id: 'monthly', type: 'employment', amount: 200000, frequency: 'monthly' },
  ],
  totalAnnualIncome: 2400000,
};
describe('normalization and derived information', () => {
  it('derives all fields without mutation or double-counting member income', () => {
    const original = JSON.stringify({ patient, household });
    const result = buildEligibilityContext(patient, household, '2026-06-15');
    expect(result).toMatchObject({
      age: 36,
      state: 'CO',
      householdSize: 2,
      annualHouseholdIncomeCents: 2400000,
      hasQualifyingChild: true,
      incomeSourcesCount: 1,
      incomeSourceTypes: ['employment'],
    });
    expect(JSON.stringify({ patient, household })).toBe(original);
    const fixtures = createSyntheticPatientData();
    const p = fixtures.patients[1],
      h = fixtures.households[1];
    if (!p || !h) throw new Error('Missing fixture');
    expect(
      buildEligibilityContext(
        p,
        {
          ...h,
          members: h.members.map((member) => ({ ...member, income: 9999999 })),
        },
        '2026-06-15',
      ).annualHouseholdIncomeCents,
    ).toBe(h.totalAnnualIncome);
  });
  it.each([
    ['2026-06-14', 35],
    ['2026-06-15', 36],
    ['2026-06-16', 36],
  ] as const)('uses supplied birthday boundary %s', (date, age) =>
    expect(buildEligibilityContext(patient, household, date).age).toBe(age),
  );
  it('uses supplied dates even when the system clock changes', () => {
    const first = buildEligibilityContext(patient, household, '2026-06-15');
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2040-01-01T00:00:00Z'));
      expect(buildEligibilityContext(patient, household, '2026-06-15')).toEqual(
        first,
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([
    ['2025-02-28', 24],
    ['2025-03-01', 25],
    ['2024-02-29', 24],
  ] as const)('handles leap birthdays %s', (date, age) =>
    expect(deriveAge('2000-02-29', date)).toBe(age),
  );
  it('does not fabricate missing patient or household fields', () => {
    const result = buildEligibilityContext(
      { id: 'demo-person', householdId: 'demo-home' },
      null,
      '2026-01-01',
    );
    expect(result).toMatchObject({
      age: null,
      state: null,
      householdSize: null,
      annualHouseholdIncomeCents: null,
      incomeSourcesCount: null,
      hasQualifyingChild: null,
      incomeSourceTypes: null,
      incomeInformationStatus: 'unknown',
    });
    expect(
      buildEligibilityContext(
        patient,
        { id: 'demo-home', patientId: patient.id },
        '2026-06-15',
      ).householdSize,
    ).toBeNull();
  });
  it.each(['unknown', 'incomplete', undefined] as const)(
    'never treats %s income as known zero',
    (status) => {
      expect(
        buildEligibilityContext(
          patient,
          {
            ...household,
            incomeSources: [],
            totalAnnualIncome: 0,
            incomeInformationStatus: status,
          },
          '2026-06-15',
        ).annualHouseholdIncomeCents,
      ).toBeNull();
    },
  );
  it('distinguishes complete empty sources from absent sources', () => {
    expect(
      buildEligibilityContext(
        patient,
        { ...household, incomeSources: [], totalAnnualIncome: 0 },
        '2026-06-15',
      ).annualHouseholdIncomeCents,
    ).toBe(0);
    expect(
      buildEligibilityContext(
        patient,
        { ...household, incomeSources: null },
        '2026-06-15',
      ).annualHouseholdIncomeCents,
    ).toBeNull();
    expect(
      buildEligibilityContext(
        patient,
        { ...household, incomeInformationStatus: 'incomplete' },
        '2026-06-15',
      ).annualHouseholdIncomeCents,
    ).toBeNull();
  });
  it.each([
    { patientId: 'other' },
    { id: 'other' },
    { householdSize: 3 },
    { totalAnnualIncome: 42 },
    { members: [] },
    { members: [{ id: 'child', relationship: 'child' }] },
    {
      members: [
        { id: 'self', relationship: 'self', dateOfBirth: '1990-06-16' },
      ],
    },
    {
      incomeSources: [
        { id: 'bad', type: 'employment', amount: -1, frequency: 'monthly' },
      ],
    },
    {
      incomeSources: [
        {
          id: 'overflow',
          type: 'employment',
          amount: Number.MAX_SAFE_INTEGER,
          frequency: 'monthly',
        },
      ],
    },
    {
      incomeSources: [
        { id: 'bad', type: 'employment', amount: 1, frequency: 'daily' },
      ],
    },
  ])('rejects invalid relationships or sources %j', (patch) => {
    expect(() =>
      buildEligibilityContext(
        patient,
        { ...household, ...patch } as HouseholdContextInput,
        '2026-06-15',
      ),
    ).toThrow(expect.objectContaining({ code: 'INVALID_CONTEXT' }));
  });
  it('rejects duplicate IDs and mismatched primary identity', () => {
    const self = household.members?.[0];
    if (!self) throw new Error('Missing primary');
    expect(() =>
      buildEligibilityContext(
        patient,
        { ...household, members: [self, self] },
        '2026-06-15',
      ),
    ).toThrow();
    const source = household.incomeSources?.[0];
    if (!source) throw new Error('Missing source');
    expect(() =>
      buildEligibilityContext(
        patient,
        { ...household, incomeSources: [source, source] },
        '2026-06-15',
      ),
    ).toThrow();
    expect(() =>
      buildEligibilityContext(
        { ...patient, firstName: 'A' },
        {
          ...household,
          members: [{ ...self, firstName: 'B' }],
          householdSize: 1,
        },
        '2026-06-15',
      ),
    ).toThrow();
  });
  it.each(['2026-02-30', '1989-01-01'])(
    'rejects invalid dates and birth dates after evaluation %s',
    (date) => {
      expect(() => buildEligibilityContext(patient, household, date)).toThrow(
        expect.objectContaining({ code: 'INVALID_CONTEXT' }),
      );
    },
  );
  it('returns unknown only when child information cannot resolve the condition', () => {
    expect(
      deriveHasQualifyingChild([{ relationship: 'child' }], '2026-01-01'),
    ).toBeNull();
    expect(
      deriveHasQualifyingChild(
        [
          { relationship: 'child' },
          { relationship: 'child', dateOfBirth: '2020-01-01' },
        ],
        '2026-01-01',
      ),
    ).toBe(true);
    expect(
      deriveHasQualifyingChild(
        [{ relationship: 'child', dateOfBirth: '2013-01-01' }],
        '2026-01-01',
      ),
    ).toBe(false);
    expect(
      deriveHasQualifyingChild(
        [{ relationship: 'child', dateOfBirth: '2013-01-02' }],
        '2026-01-01',
      ),
    ).toBe(true);
    expect(
      deriveHasQualifyingChild([{ relationship: 'spouse' }], '2026-01-01'),
    ).toBe(false);
    expect(() =>
      deriveHasQualifyingChild(
        [{ relationship: 'child', dateOfBirth: '2027-01-01' }],
        '2026-01-01',
      ),
    ).toThrow();
  });
});
