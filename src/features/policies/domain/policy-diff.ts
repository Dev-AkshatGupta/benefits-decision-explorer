import type {
  EligibilityProgram,
  EligibilityRule,
  RuleValue,
} from '../../eligibility/domain/types';
import { validateProgram } from '../../eligibility/engine/validation';
export type RuleChangeType = 'added' | 'removed' | 'modified' | 'unchanged';
export type RuleProperty =
  | 'field'
  | 'fieldType'
  | 'operator'
  | 'expectedValue'
  | 'missingDataBehavior'
  | 'name'
  | 'description'
  | 'policyReference';
export interface RuleChange {
  readonly ruleId: string;
  readonly type: RuleChangeType;
  readonly baseline: EligibilityRule | null;
  readonly comparison: EligibilityRule | null;
  readonly properties: readonly RuleProperty[];
  readonly semantic: boolean;
}
export interface PolicyComparisonResult {
  readonly baseline: EligibilityProgram;
  readonly comparison: EligibilityProgram;
  readonly rules: readonly RuleChange[];
  readonly strategyChanged: boolean;
  readonly metadataChanged: readonly string[];
}
/** Engine array equality/membership uses sets, so operand order and duplicates carry no logic change. */
export function equivalentOperand(a: RuleValue, b: RuleValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    const left = new Set<string | number>(a),
      right = new Set<string | number>(b);
    return (
      left.size === right.size && [...left].every((value) => right.has(value))
    );
  }
  return a === b;
}
export function comparePolicyVersions(
  before: EligibilityProgram,
  after: EligibilityProgram,
): PolicyComparisonResult {
  const baseline = validateProgram(before),
    comparison = validateProgram(after);
  if (baseline.id !== comparison.id)
    throw new Error('Choose versions of the same logical program.');
  const old = new Map(baseline.rules.map((rule) => [rule.id, rule])),
    next = new Map(comparison.rules.map((rule) => [rule.id, rule]));
  const ids = [...old.keys(), ...[...next.keys()].filter((id) => !old.has(id))];
  const rules: RuleChange[] = ids.map((ruleId) => {
    const a = old.get(ruleId) ?? null,
      b = next.get(ruleId) ?? null;
    if (!a || !b)
      return {
        ruleId,
        baseline: a,
        comparison: b,
        type: a ? 'removed' : 'added',
        properties: [],
        semantic: true,
      };
    const properties: RuleProperty[] = [];
    for (const property of [
      'field',
      'fieldType',
      'operator',
      'missingDataBehavior',
      'name',
      'description',
    ] as const)
      if (a[property] !== b[property]) properties.push(property);
    if (!equivalentOperand(a.expectedValue, b.expectedValue))
      properties.push('expectedValue');
    if (
      a.policyReference.documentId !== b.policyReference.documentId ||
      a.policyReference.section !== b.policyReference.section ||
      a.policyReference.policyVersion !== b.policyReference.policyVersion
    )
      properties.push('policyReference');
    return {
      ruleId,
      baseline: a,
      comparison: b,
      properties,
      type: properties.length ? 'modified' : 'unchanged',
      semantic: properties.some(
        (property) =>
          !['name', 'description', 'policyReference'].includes(property),
      ),
    };
  });
  const metadataChanged = (
    [
      'name',
      'description',
      'category',
      'disclaimer',
      'effectiveFrom',
      'effectiveTo',
      'policyVersion',
    ] as const
  ).filter((key) => baseline[key] !== comparison[key]);
  return {
    baseline,
    comparison,
    rules,
    metadataChanged,
    strategyChanged:
      baseline.evaluationStrategy !== comparison.evaluationStrategy,
  };
}
