import { describe, expect, it } from 'vitest';
import {
  dollarsToCents,
  centsToDollars,
  profileFormSchema,
  profileToForm,
  membersFormSchema,
  membersToForm,
  incomeFormSchema,
  incomeToForm,
} from './profile-forms';
import { createSyntheticPatientData } from '@/mocks/data/patients';
import { calculateHouseholdAnnualIncome } from './income';
const fixture = createSyntheticPatientData();
describe('profile form contracts', () => {
  it('requires explicit confirmation before emitting a complete income report', () => {
    const form = incomeToForm(fixture.households[1]!);
    expect(form.confirmIncomeComplete).toBe(false);
    expect(incomeFormSchema.parse(form)).not.toHaveProperty(
      'incomeInformationStatus',
    );
    expect(
      incomeFormSchema.parse({ ...form, confirmIncomeComplete: true }),
    ).toHaveProperty('incomeInformationStatus', 'complete');
    expect(
      incomeFormSchema.parse({
        incomeSources: [],
        confirmIncomeComplete: true,
      }),
    ).toEqual({ incomeSources: [], incomeInformationStatus: 'complete' });
  });
  it('converts dollar strings exactly without float rounding', () => {
    expect(dollarsToCents('2000.10')).toBe(200010);
    expect(dollarsToCents('0.29')).toBe(29);
    expect(centsToDollars(29)).toBe('0.29');
    expect(dollarsToCents(centsToDollars(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    for (const invalid of [
      '-1',
      'abc',
      '1.001',
      '1e3',
      '9999999999999999999999999999999',
    ])
      expect(() => dollarsToCents(invalid)).toThrow(RangeError);
  });
  it('maps empty optional fields to explicit clears while validating dates and contacts', () => {
    const form = profileToForm(fixture.patients[1]!);
    expect(
      profileFormSchema.parse({ ...form, email: '', phone: '', gender: '' }),
    ).toMatchObject({ email: null, phone: null, gender: null });
    expect(
      profileFormSchema.safeParse({ ...form, dateOfBirth: '2099-01-01' })
        .success,
    ).toBe(false);
    expect(
      profileFormSchema.safeParse({ ...form, email: 'invalid' }).success,
    ).toBe(false);
    expect(
      profileFormSchema.safeParse({
        ...form,
        address: { ...form.address, postalCode: 'bad' },
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate member/source identities and protects the self relationship', () => {
    const form = membersToForm(fixture.households[0]!);
    expect(
      membersFormSchema.safeParse({
        members: [form.members[0], form.members[0]],
      }).success,
    ).toBe(false);
    expect(
      membersFormSchema.safeParse({
        members: [{ ...form.members[0], relationship: 'other' }],
      }).success,
    ).toBe(false);
    const income = incomeToForm(fixture.households[0]!);
    expect(
      incomeFormSchema.safeParse({
        incomeSources: [income.incomeSources[0], income.incomeSources[0]],
      }).success,
    ).toBe(false);
  });
  it('annualizes monthly amounts and does not double count reported member income', () => {
    const sources = incomeFormSchema.parse({
      incomeSources: [
        {
          id: 'source',
          type: 'employment',
          frequency: 'monthly',
          amountDollars: '2000.00',
        },
      ],
    }).incomeSources;
    expect(sources[0]?.amount).toBe(200000);
    expect(calculateHouseholdAnnualIncome(sources)).toBe(2400000);
    expect(
      incomeFormSchema.safeParse({
        incomeSources: [
          {
            id: 'source',
            type: 'employment',
            frequency: 'monthly',
            amountDollars: '-1',
          },
        ],
      }).success,
    ).toBe(false);
    const members = membersFormSchema.parse(
      membersToForm(fixture.households[0]!),
    );
    expect(members.members[0]?.income).toBe(
      fixture.households[0]?.members[0]?.income,
    );
  });
});
