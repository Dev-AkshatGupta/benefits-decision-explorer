import type { EligibilityProgram, EligibilityRule } from '../domain/types';

const disclaimer =
  'Fictional demonstration policy. This is not an actual public-benefits determination.';
type RuleCondition =
  | {
      field: 'state';
      fieldType: 'string';
      operator: 'in';
      expectedValue: readonly string[];
    }
  | {
      field: 'age' | 'householdSize' | 'annualHouseholdIncomeCents';
      fieldType: 'number';
      operator: 'greater_than_or_equal' | 'less_than_or_equal' | 'less_than';
      expectedValue: number;
    }
  | {
      field: 'hasQualifyingChild';
      fieldType: 'boolean';
      operator: 'equals';
      expectedValue: boolean;
    };
function rule(
  documentId: string,
  version: string,
  id: string,
  name: string,
  condition: RuleCondition,
): EligibilityRule {
  return {
    id,
    name,
    description: `${name} for a fictional demonstration policy.`,
    ...condition,
    policyReference: { documentId, section: id, policyVersion: version },
    missingDataBehavior: 'unknown',
  };
}
const residency = (document: string, version: string) =>
  rule(document, version, 'RESIDENCY-01', 'Supported demonstration state', {
    field: 'state',
    fieldType: 'string',
    operator: 'in',
    expectedValue: ['CO', 'AZ', 'OR'],
  });
const income = (document: string, version: string, threshold: number) =>
  rule(document, version, 'INCOME-01', 'Household income requirement', {
    field: 'annualHouseholdIncomeCents',
    fieldType: 'number',
    operator: 'less_than_or_equal',
    expectedValue: threshold,
  });
function program(
  id: string,
  name: string,
  category: EligibilityProgram['category'],
  version: string,
  rules: readonly EligibilityRule[],
  effectiveFrom = '2026-01-01',
  effectiveTo?: string,
): EligibilityProgram {
  return {
    id,
    name,
    category,
    policyVersion: version,
    description: `${name} uses fictional residency and income requirements for portfolio demonstrations.`,
    fictional: true,
    disclaimer,
    effectiveFrom,
    ...(effectiveTo ? { effectiveTo } : {}),
    rules,
    evaluationStrategy: 'ALL',
  };
}
function health(version: string, threshold: number, from: string, to?: string) {
  const document = 'DEMO-HEALTH-' + version;
  return program(
    'demo-health',
    'Demo Health Coverage (Fictional)',
    'healthcare',
    version,
    [
      residency(document, version),
      rule(document, version, 'AGE-MIN-01', 'Minimum patient age', {
        field: 'age',
        fieldType: 'number',
        operator: 'greater_than_or_equal',
        expectedValue: 18,
      }),
      rule(document, version, 'AGE-MAX-01', 'Maximum patient age', {
        field: 'age',
        fieldType: 'number',
        operator: 'less_than_or_equal',
        expectedValue: 64,
      }),
      income(document, version, threshold),
    ],
    from,
    to,
  );
}
export const demoHealth2025 = health(
  '2025.1',
  3200000,
  '2025-01-01',
  '2025-12-31',
);
export const demoHealth2026 = health('2026.1', 3500000, '2026-01-01');
export const demoNutrition = program(
  'demo-nutrition',
  'Demo Nutrition Assistance (Fictional)',
  'food_assistance',
  '2026.1',
  [
    income('DEMO-NUTRITION-2026.1', '2026.1', 4200000),
    rule('DEMO-NUTRITION-2026.1', '2026.1', 'SIZE-01', 'Nonempty household', {
      field: 'householdSize',
      fieldType: 'number',
      operator: 'greater_than_or_equal',
      expectedValue: 1,
    }),
    residency('DEMO-NUTRITION-2026.1', '2026.1'),
  ],
);
export const demoNutrition2025 = program(
  'demo-nutrition',
  'Demo Nutrition Assistance (Fictional)',
  'food_assistance',
  '2025.1',
  [
    rule(
      'DEMO-NUTRITION-2025.1',
      '2025.1',
      'INCOME-01',
      'Household income requirement',
      {
        field: 'annualHouseholdIncomeCents',
        fieldType: 'number',
        operator: 'less_than',
        expectedValue: 3500000,
      },
    ),
    rule('DEMO-NUTRITION-2025.1', '2025.1', 'SIZE-01', 'Nonempty household', {
      field: 'householdSize',
      fieldType: 'number',
      operator: 'greater_than_or_equal',
      expectedValue: 1,
    }),
    rule(
      'DEMO-NUTRITION-2025.1',
      '2025.1',
      'SIZE-MAX-01',
      'Demonstration maximum household size',
      {
        field: 'householdSize',
        fieldType: 'number',
        operator: 'less_than_or_equal',
        expectedValue: 2,
      },
    ),
    rule(
      'DEMO-NUTRITION-2025.1',
      '2025.1',
      'RESIDENCY-01',
      'Supported demonstration state',
      {
        field: 'state',
        fieldType: 'string',
        operator: 'in',
        expectedValue: ['CO', 'AZ'],
      },
    ),
  ],
  '2025-01-01',
  '2025-12-31',
);
export const demoChildcare = program(
  'demo-childcare',
  'Demo Childcare Support (Fictional)',
  'childcare',
  '2026.1',
  [
    rule(
      'DEMO-CHILDCARE-2026.1',
      '2026.1',
      'CHILD-01',
      'Household child younger than 13',
      {
        field: 'hasQualifyingChild',
        fieldType: 'boolean',
        operator: 'equals',
        expectedValue: true,
      },
    ),
    income('DEMO-CHILDCARE-2026.1', '2026.1', 5500000),
    residency('DEMO-CHILDCARE-2026.1', '2026.1'),
  ],
);
export const demoHousing = program(
  'demo-housing',
  'Demo Housing Support (Fictional)',
  'housing',
  '2026.1',
  [
    income('DEMO-HOUSING-2026.1', '2026.1', 3000000),
    residency('DEMO-HOUSING-2026.1', '2026.1'),
  ],
);
export const demoFamily = program(
  'demo-family',
  'Demo Family Assistance (Fictional)',
  'other',
  '2026.1',
  [
    rule(
      'DEMO-FAMILY-2026.1',
      '2026.1',
      'SIZE-01',
      'Household of at least two',
      {
        field: 'householdSize',
        fieldType: 'number',
        operator: 'greater_than_or_equal',
        expectedValue: 2,
      },
    ),
    income('DEMO-FAMILY-2026.1', '2026.1', 4500000),
    residency('DEMO-FAMILY-2026.1', '2026.1'),
  ],
);
export const demoFamily2025 = program(
  'demo-family',
  'Demo Family Assistance (Fictional)',
  'other',
  '2025.1',
  [
    rule(
      'DEMO-FAMILY-2025.1',
      '2025.1',
      'SIZE-01',
      'Household of at least three',
      {
        field: 'householdSize',
        fieldType: 'number',
        operator: 'greater_than_or_equal',
        expectedValue: 3,
      },
    ),
    income('DEMO-FAMILY-2025.1', '2025.1', 4000000),
    residency('DEMO-FAMILY-2025.1', '2025.1'),
  ],
  '2025-01-01',
  '2025-12-31',
);
