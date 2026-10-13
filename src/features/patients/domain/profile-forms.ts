import { z } from 'zod';
import {
  patientSchema,
  householdMemberSchema,
  incomeSourceSchema,
  type Patient,
  type Household,
} from './schemas';
import { annualizeIncome, calculateHouseholdAnnualIncome } from './income';
export function dollarsToCents(value: string): number {
  const cleaned = value.trim();
  if (cleaned.length > 24)
    throw new RangeError('Amount exceeds the supported range.');
  if (!/^[0-9]+([.][0-9]{1,2})?$/.test(cleaned))
    throw new RangeError(
      'Enter a non-negative amount with up to two decimal places.',
    );
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError('Amount exceeds the supported range.');
  return Number(cents);
}
export function centsToDollars(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError('Invalid cents.');
  return (
    String(BigInt(value) / 100n) +
    '.' +
    String(BigInt(value) % 100n).padStart(2, '0')
  );
}
const dollars = z.string().superRefine((value, ctx) => {
  try {
    dollarsToCents(value);
  } catch {
    ctx.addIssue({
      code: 'custom',
      message:
        'Enter a non-negative dollar amount with up to two decimal places.',
    });
  }
});
export const profileFormSchema = z.object({
  firstName: patientSchema.shape.firstName,
  lastName: patientSchema.shape.lastName,
  dateOfBirth: patientSchema.shape.dateOfBirth,
  gender: z
    .union([patientSchema.shape.gender.unwrap(), z.literal('')])
    .transform((value) => value || null),
  email: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(patientSchema.shape.email.unwrap().nullable()),
  phone: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(patientSchema.shape.phone.unwrap().nullable()),
  status: patientSchema.shape.status,
  assignedCoordinatorId: patientSchema.shape.assignedCoordinatorId,
  address: patientSchema.shape.address,
});
export function profileToForm(
  patient: Patient,
): z.input<typeof profileFormSchema> {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender ?? '',
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    status: patient.status,
    assignedCoordinatorId: patient.assignedCoordinatorId,
    address: { ...patient.address },
  };
}
const memberInput = householdMemberSchema
  .omit({ income: true })
  .extend({ incomeDollars: dollars });
export const membersFormSchema = z
  .object({ members: z.array(memberInput).min(1).max(50) })
  .superRefine((value, ctx) => {
    if (
      new Set(value.members.map((member) => member.id)).size !==
      value.members.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['members'],
        message: 'Household member IDs must be unique.',
      });
    if (
      value.members.filter((member) => member.relationship === 'self')
        .length !== 1
    )
      ctx.addIssue({
        code: 'custom',
        path: ['members'],
        message: 'Keep exactly one primary patient.',
      });
  })
  .transform((value) => ({
    members: value.members.map(({ incomeDollars, ...member }) => ({
      ...member,
      income: dollarsToCents(incomeDollars),
    })),
  }));
export function membersToForm(
  household: Household,
): z.input<typeof membersFormSchema> {
  return {
    members: household.members.map(({ income, ...member }) => ({
      ...member,
      incomeDollars: centsToDollars(income),
    })),
  };
}
const sourceInput = incomeSourceSchema
  .omit({ amount: true })
  .extend({ amountDollars: dollars });
export const incomeFormSchema = z
  .object({
    incomeSources: z.array(sourceInput).max(100),
    confirmIncomeComplete: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.incomeSources.map((source) => source.id)).size !==
      value.incomeSources.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['incomeSources'],
        message: 'Income source IDs must be unique.',
      });
    try {
      calculateHouseholdAnnualIncome(
        value.incomeSources.map((source) => ({
          amount: dollarsToCents(source.amountDollars),
          frequency: source.frequency,
        })),
      );
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['incomeSources'],
        message:
          'Check the amounts. Annual income exceeds the supported range or is invalid.',
      });
    }
  })
  .transform((value) => ({
    ...(value.confirmIncomeComplete
      ? { incomeInformationStatus: 'complete' as const }
      : {}),
    incomeSources: value.incomeSources.map(({ amountDollars, ...source }) => ({
      ...source,
      amount: dollarsToCents(amountDollars),
    })),
  }));
export function incomeToForm(
  household: Household,
): z.input<typeof incomeFormSchema> {
  return {
    confirmIncomeComplete: false,
    incomeSources: household.incomeSources.map(({ amount, ...source }) => ({
      ...source,
      amountDollars: centsToDollars(amount),
    })),
  };
}
export function previewAnnualIncome(
  amount: string,
  frequency: z.infer<typeof incomeSourceSchema>['frequency'],
): number | undefined {
  try {
    return annualizeIncome(dollarsToCents(amount), frequency);
  } catch {
    return undefined;
  }
}
export type ProfileFormInput = z.input<typeof profileFormSchema>;
export type ProfileFormOutput = z.output<typeof profileFormSchema>;
export type MembersFormInput = z.input<typeof membersFormSchema>;
export type MembersFormOutput = z.output<typeof membersFormSchema>;
export type IncomeFormInput = z.input<typeof incomeFormSchema>;
export type IncomeFormOutput = z.output<typeof incomeFormSchema>;
