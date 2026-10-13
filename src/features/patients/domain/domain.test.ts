import { describe, expect, it } from 'vitest';
import { calculateAge, formatDate, todayUtc } from './dates';
import {
  annualizeIncome,
  calculateHouseholdAnnualIncome,
  formatCurrency,
} from './income';
import {
  patientSchema,
  householdSchema,
  incomeSourceSchema,
  patientPatchSchema,
  calendarDateSchema,
} from './schemas';
import { createSyntheticPatientData } from '@/mocks/data/patients';
const fixture = createSyntheticPatientData();
const patient = fixture.patients[0]!;
const household = fixture.households[0]!;
describe('synthetic fixture integrity', () => {
  it('creates deterministic, validated, linked records with scenario variety', () => {
    expect(createSyntheticPatientData()).toEqual(fixture);
    expect(fixture.patients).toHaveLength(150);
    expect(fixture.households).toHaveLength(150);
    expect(fixture.coordinators).toHaveLength(5);
    expect(new Set(fixture.patients.map((value) => value.id)).size).toBe(150);
    for (const value of fixture.patients) {
      expect(patientSchema.safeParse(value).success).toBe(true);
      const linked = fixture.households.find(
        (item) => item.id === value.householdId,
      );
      expect(linked?.patientId).toBe(value.id);
      expect(
        linked?.members.find((item) => item.relationship === 'self')
          ?.dateOfBirth,
      ).toBe(value.dateOfBirth);
      expect(
        fixture.coordinators.some(
          (item) => item.id === value.assignedCoordinatorId,
        ),
      ).toBe(true);
      if (value.email) expect(value.email.endsWith('@example.com')).toBe(true);
      if (value.phone) expect(value.phone).toMatch(/^[+]1-202-555-01[0-9]{2}$/);
    }
    for (const value of fixture.households)
      expect(householdSchema.safeParse(value).success).toBe(true);
    expect(
      new Set(fixture.patients.map((value) => value.address.state)).size,
    ).toBeGreaterThan(5);
    expect(new Set(fixture.patients.map((value) => value.status)).size).toBe(3);
    expect(
      new Set(fixture.households.map((value) => value.householdSize)).size,
    ).toBe(5);
    expect(
      new Set(
        fixture.households.flatMap((value) =>
          value.incomeSources.map((source) => source.type),
        ),
      ).size,
    ).toBe(6);
    expect(
      new Set(
        fixture.households.flatMap((value) =>
          value.incomeSources.map((source) => source.frequency),
        ),
      ).size,
    ).toBe(4);
    expect(fixture.patients.some((value) => !value.email && !value.phone)).toBe(
      true,
    );
  });
});
describe('calendar dates and money', () => {
  it.each([
    ['2000-10-08', '2026-10-07', 25],
    ['2000-10-08', '2026-10-08', 26],
    ['2000-10-08', '2026-10-09', 26],
    ['2000-02-29', '2025-02-28', 24],
    ['2000-02-29', '2025-03-01', 25],
  ])('calculates age for %s as of %s', (birth, asOf, age) =>
    expect(calculateAge(birth, asOf)).toBe(age),
  );
  it('uses UTC and rejects invalid or future calendar dates', () => {
    expect(todayUtc(new Date('2026-10-08T00:30:00+05:30'))).toBe('2026-10-07');
    expect(formatDate('2000-01-01')).toBe('Jan 1, 2000');
    expect(formatDate('2026-10-08T00:00:00Z')).toBe('Oct 8, 2026');
    expect(calendarDateSchema.safeParse('2025-02-29').success).toBe(false);
    expect(calendarDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(calendarDateSchema.safeParse('2024-02-29').success).toBe(true);
    expect(() => calculateAge('2099-01-01', '2026-01-01')).toThrow(RangeError);
    expect(() => calculateAge('2026-02-30')).toThrow(RangeError);
  });
  it.each([
    ['weekly', 52],
    ['biweekly', 26],
    ['monthly', 12],
    ['annually', 1],
  ] as const)('annualizes %s using integer cents', (frequency, multiplier) =>
    expect(annualizeIncome(10001, frequency)).toBe(10001 * multiplier),
  );
  it('calculates income from sources exactly and guards unsafe cents', () => {
    expect(
      calculateHouseholdAnnualIncome([
        { amount: 10001, frequency: 'monthly' },
        { amount: 125, frequency: 'weekly' },
      ]),
    ).toBe(126512);
    expect(calculateHouseholdAnnualIncome([])).toBe(0);
    expect(formatCurrency(123456)).toBe('$1,234.56');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(Number.MAX_SAFE_INTEGER)).toBe(
      '$90,071,992,547,409.91',
    );
    for (const amount of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER])
      expect(() => annualizeIncome(amount, 'weekly')).toThrow(RangeError);
    expect(() =>
      calculateHouseholdAnnualIncome([
        { amount: Number.MAX_SAFE_INTEGER, frequency: 'annually' },
        { amount: 1, frequency: 'annually' },
      ]),
    ).toThrow(RangeError);
  });
});
describe('domain validation', () => {
  it.each([
    { dateOfBirth: '2099-01-01' },
    { dateOfBirth: '2026-02-30' },
    { email: 'invalid' },
    { phone: '1234' },
    { status: 'approved' },
    { firstName: '   ' },
  ])('rejects invalid patient input %j', (patch) =>
    expect(patientSchema.safeParse({ ...patient, ...patch }).success).toBe(
      false,
    ),
  );
  it('validates U.S. addresses and optional contact fields', () => {
    expect(
      patientSchema.safeParse({
        ...patient,
        createdAt: '2026-01-15T12:00:00Z',
        updatedAt: '2026-01-15T12:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(() => formatDate('2026-02-30T12:00:00Z')).toThrow(RangeError);
    expect(
      patientSchema.safeParse({
        ...patient,
        address: { ...patient.address, state: 'XX' },
      }).success,
    ).toBe(false);
    for (const phone of ['2025550100', '+1-202-555-0100', '(202) 555-0100'])
      expect(patientSchema.safeParse({ ...patient, phone }).success).toBe(true);
    expect(
      patientSchema.safeParse({
        ...patient,
        address: { ...patient.address, country: 'IN' },
      }).success,
    ).toBe(false);
  });
  it('rejects mismatched household size, duplicate members, and independently changed totals', () => {
    expect(
      householdSchema.safeParse({ ...household, householdSize: 99 }).success,
    ).toBe(false);
    expect(
      householdSchema.safeParse({
        ...household,
        members: [household.members[0], household.members[0]],
        householdSize: 2,
      }).success,
    ).toBe(false);
    expect(
      householdSchema.safeParse({
        ...household,
        totalAnnualIncome: household.totalAnnualIncome + 1,
      }).success,
    ).toBe(false);
    expect(
      incomeSourceSchema.safeParse({
        id: 'source',
        type: 'employment',
        amount: -1,
        frequency: 'weekly',
      }).success,
    ).toBe(false);
    expect(
      householdSchema.safeParse({
        ...household,
        incomeSources: [
          {
            id: 'huge',
            type: 'other',
            amount: Number.MAX_SAFE_INTEGER,
            frequency: 'weekly',
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('rejects empty patches and immutable or unknown fields', () => {
    for (const patch of [
      {},
      { id: 'new' },
      { createdAt: patient.createdAt },
      { updatedAt: patient.updatedAt },
      { householdId: 'new' },
      { unexpected: true },
    ])
      expect(patientPatchSchema.safeParse(patch).success).toBe(false);
    expect(patientPatchSchema.parse({ firstName: '  Avery  ' })).toEqual({
      firstName: 'Avery',
    });
  });
});
