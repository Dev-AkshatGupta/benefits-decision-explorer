import type {
  EligibilityContext,
  EligibilityProgram,
  EligibilityRule,
} from '../domain/types';
export const context: EligibilityContext = {
  patientId: 'fictional-patient',
  evaluationDate: '2026-06-15',
  age: 30,
  state: 'CO',
  householdSize: 2,
  annualHouseholdIncomeCents: 2400000,
  incomeInformationStatus: 'complete',
  incomeSourcesCount: 1,
  hasQualifyingChild: true,
  incomeSourceTypes: ['employment'],
};
export const numberRule = {
  id: 'AGE-01',
  name: 'Patient age requirement',
  description: 'Fictional age requirement.',
  field: 'age',
  fieldType: 'number',
  operator: 'greater_than_or_equal',
  expectedValue: 18,
  missingDataBehavior: 'unknown',
  policyReference: {
    documentId: 'DEMO-TEST',
    section: 'AGE-01',
    policyVersion: '2026.1',
  },
} as const satisfies EligibilityRule;
export function testProgram(
  rules: readonly EligibilityRule[] = [numberRule],
  strategy: EligibilityProgram['evaluationStrategy'] = 'ALL',
): EligibilityProgram {
  return {
    id: 'demo-test',
    name: 'Demo Test (Fictional)',
    description: 'Fictional unit test policy.',
    category: 'other',
    fictional: true,
    disclaimer: 'Fictional demonstration only.',
    policyVersion: '2026.1',
    effectiveFrom: '2026-01-01',
    rules,
    evaluationStrategy: strategy,
  };
}
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
