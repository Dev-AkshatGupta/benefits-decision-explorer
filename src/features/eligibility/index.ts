export type * from './domain/types';
export {
  eligibilityRuleSchema,
  eligibilityProgramSchema,
  eligibilityContextSchema,
} from './domain/schemas';
export { evaluateRule } from './engine/evaluate-rule';
export {
  evaluateProgram,
  aggregateRuleStatuses,
} from './engine/evaluate-program';
export { screenPatient } from './engine/screen-patient';
export { buildEligibilityContext } from './engine/context-builder';
export type {
  PatientContextInput,
  HouseholdContextInput,
} from './engine/context-builder';
export {
  selectPolicyVersion,
  selectPoliciesForDate,
  validatePolicyRegistry,
} from './engine/policy-selector';
export { EligibilityEngineError } from './engine/errors';
export { demoPolicyRegistry } from './policies/registry';
