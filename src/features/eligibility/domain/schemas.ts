import { z } from 'zod';
import {
  calendarDateSchema,
  incomeInformationStatuses,
  usStates,
} from '../../patients/domain/schemas';
import { calculateAge, isCalendarDate } from '../../patients/domain/dates';

const text = z.string().min(1).max(500);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const strings = z
  .array(text)
  .max(100)
  .refine(
    (values) => new Set(values).size === values.length,
    'Values must be unique',
  );
export const numericFields = [
  'age',
  'householdSize',
  'annualHouseholdIncomeCents',
  'incomeSourcesCount',
] as const;
export const stringFields = ['state', 'incomeInformationStatus'] as const;
export const booleanFields = ['hasQualifyingChild'] as const;
export const dateFields = ['dateOfBirth', 'evaluationDate'] as const;
export const arrayFields = ['incomeSourceTypes'] as const;
export const fieldSchema = z.enum([
  ...numericFields,
  ...stringFields,
  ...booleanFields,
  ...dateFields,
  ...arrayFields,
]);
export const operators = [
  'equals',
  'not_equals',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
  'in',
  'not_in',
] as const;
const equality = z.enum(['equals', 'not_equals']);
const ordered = z.enum([
  'equals',
  'not_equals',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
]);
const membership = z.enum(['in', 'not_in']);
export const policyReferenceSchema = z.strictObject({
  documentId: text,
  section: text,
  policyVersion: text,
});
const base = {
  id: text,
  name: text,
  description: text,
  policyReference: policyReferenceSchema,
  missingDataBehavior: z.literal('unknown'),
};
// Field, type, operator and operand are one discriminated contract.
export const eligibilityRuleSchema = z.union([
  z.strictObject({
    ...base,
    field: z.enum(numericFields),
    fieldType: z.literal('number'),
    operator: ordered,
    expectedValue: integer,
  }),
  z.strictObject({
    ...base,
    field: z.enum(numericFields),
    fieldType: z.literal('number'),
    operator: membership,
    expectedValue: z.array(integer).min(1).max(100),
  }),
  z.strictObject({
    ...base,
    field: z.enum(stringFields),
    fieldType: z.literal('string'),
    operator: equality,
    expectedValue: text,
  }),
  z.strictObject({
    ...base,
    field: z.enum(stringFields),
    fieldType: z.literal('string'),
    operator: membership,
    expectedValue: strings.refine((values) => values.length > 0),
  }),
  z.strictObject({
    ...base,
    field: z.enum(booleanFields),
    fieldType: z.literal('boolean'),
    operator: equality,
    expectedValue: z.boolean(),
  }),
  z.strictObject({
    ...base,
    field: z.enum(dateFields),
    fieldType: z.literal('date'),
    operator: ordered,
    expectedValue: calendarDateSchema,
  }),
  z.strictObject({
    ...base,
    field: z.enum(dateFields),
    fieldType: z.literal('date'),
    operator: membership,
    expectedValue: z.array(calendarDateSchema).min(1).max(100),
  }),
  z.strictObject({
    ...base,
    field: z.enum(arrayFields),
    fieldType: z.literal('string_array'),
    operator: z.enum(['equals', 'not_equals', 'in', 'not_in']),
    expectedValue: strings,
  }),
]);
export const eligibilityProgramSchema = z
  .strictObject({
    id: text,
    name: text,
    description: text,
    category: z.enum([
      'healthcare',
      'food_assistance',
      'childcare',
      'housing',
      'other',
    ]),
    fictional: z.literal(true),
    disclaimer: text,
    policyVersion: text,
    effectiveFrom: calendarDateSchema,
    effectiveTo: calendarDateSchema.optional(),
    rules: z.array(eligibilityRuleSchema).min(1).max(100),
    evaluationStrategy: z.enum(['ALL', 'ANY']),
  })
  .superRefine((program, ctx) => {
    if (program.effectiveTo && program.effectiveTo < program.effectiveFrom)
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'Effective end precedes start',
      });
    if (
      new Set(program.rules.map((rule) => rule.id)).size !==
      program.rules.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['rules'],
        message: 'Rule IDs must be unique within a version',
      });
    if (
      program.rules.some(
        (rule) => rule.policyReference.policyVersion !== program.policyVersion,
      )
    )
      ctx.addIssue({
        code: 'custom',
        path: ['rules'],
        message: 'Rule references must match the policy version',
      });
  });
export const eligibilityContextSchema = z
  .strictObject({
    patientId: text,
    evaluationDate: calendarDateSchema,
    dateOfBirth: calendarDateSchema.nullish(),
    age: integer.nullish(),
    state: z.enum(usStates).nullish(),
    householdSize: integer.min(1).max(50).nullish(),
    annualHouseholdIncomeCents: integer.nullish(),
    incomeSourcesCount: integer.max(100).nullish(),
    incomeInformationStatus: z.enum(incomeInformationStatuses).nullish(),
    hasQualifyingChild: z.boolean().nullish(),
    incomeSourceTypes: strings.nullish(),
  })
  .superRefine((context, ctx) => {
    if (context.dateOfBirth && context.dateOfBirth > context.evaluationDate)
      ctx.addIssue({
        code: 'custom',
        path: ['dateOfBirth'],
        message: 'Birth date follows evaluation date',
      });
    else if (
      context.dateOfBirth &&
      context.age != null &&
      isCalendarDate(context.dateOfBirth) &&
      isCalendarDate(context.evaluationDate) &&
      context.age !== calculateAge(context.dateOfBirth, context.evaluationDate)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['age'],
        message: 'Age disagrees with the supplied birth and evaluation dates',
      });
    if (
      context.annualHouseholdIncomeCents != null &&
      context.incomeInformationStatus !== 'complete'
    )
      ctx.addIssue({
        code: 'custom',
        path: ['annualHouseholdIncomeCents'],
        message: 'Known income requires an explicitly complete income report',
      });
  });
