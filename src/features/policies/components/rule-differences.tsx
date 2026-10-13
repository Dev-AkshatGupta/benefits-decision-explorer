import { useState } from 'react';
import type { EligibilityRule } from '../../eligibility/domain/types';
import {
  fieldLabels,
  formatRuleValue,
  operatorLabels,
} from '../../eligibility/ui/decision-presentation';
import type {
  PolicyComparisonResult,
  RuleChangeType,
} from '../domain/policy-diff';
function Definition({ rule }: { rule: EligibilityRule | null }) {
  if (!rule)
    return (
      <p className="text-sm text-muted-foreground">
        Not present in this version
      </p>
    );
  return (
    <div className="min-w-0 text-sm">
      <p className="break-words">
        {fieldLabels[rule.field]} ·{' '}
        {rule.fieldType === 'string_array' &&
        (rule.operator === 'in' || rule.operator === 'not_in')
          ? rule.operator === 'in'
            ? 'Has any overlap with'
            : 'Has no overlap with'
          : operatorLabels[rule.operator]}{' '}
        · {formatRuleValue(rule.expectedValue, rule.field)}
      </p>
      <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">
        {rule.description}
      </p>
      <p className="mt-2 break-words text-xs text-muted-foreground">
        {rule.policyReference.documentId} / {rule.policyReference.section} /{' '}
        {rule.policyReference.policyVersion}
      </p>
    </div>
  );
}
export function RuleDifferences({ diff }: { diff: PolicyComparisonResult }) {
  const [filter, setFilter] = useState<'all' | RuleChangeType>('all');
  return (
    <section
      aria-labelledby="policy-changes-title"
      className="mt-6 rounded-xl border bg-card p-5 sm:p-6"
    >
      <h2 id="policy-changes-title" className="text-lg font-semibold">
        Policy changes
      </h2>
      <p className="mt-3 text-sm">
        {(['added', 'removed', 'modified', 'unchanged'] as const)
          .map(
            (type) =>
              `${type[0]?.toUpperCase()}${type.slice(1)}: ${diff.rules.filter((rule) => rule.type === type).length}`,
          )
          .join(' · ')}
      </p>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        {diff.rules.filter((rule) => rule.semantic).length} rules with
        eligibility-logic changes. Version references, names and descriptions
        are metadata, not eligibility conditions. All rules are required.
      </p>
      <p className="mt-2 text-sm">
        Evaluation-strategy changes: {Number(diff.strategyChanged)} · Strategy:{' '}
        {diff.baseline.evaluationStrategy} →{' '}
        {diff.comparison.evaluationStrategy} ·{' '}
        {diff.strategyChanged ? 'Changed' : 'Unchanged'}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Policy metadata changed: {diff.metadataChanged.join(', ') || 'None'}.
      </p>
      <label
        htmlFor="rule-change-filter"
        className="mb-2 mt-4 block text-sm font-medium"
      >
        Filter rule changes
      </label>
      <select
        id="rule-change-filter"
        className="form-control"
        value={filter}
        onChange={(event) => setFilter(event.target.value as typeof filter)}
      >
        {['all', 'added', 'removed', 'modified', 'unchanged'].map((type) => (
          <option key={type} value={type}>
            {type === 'all' ? 'All rule changes' : type}
          </option>
        ))}
      </select>
      <div className="mt-5 space-y-3">
        {diff.rules
          .filter((rule) => filter === 'all' || rule.type === filter)
          .map((change) => (
            <details
              key={change.ruleId}
              open={change.semantic}
              className="rounded-lg border"
            >
              <summary className="min-h-11 cursor-pointer p-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
                {change.comparison?.name ?? change.baseline?.name} ·{' '}
                {change.type[0]?.toUpperCase()}
                {change.type.slice(1)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {change.semantic
                    ? 'Logic change'
                    : 'Metadata only / unchanged logic'}
                </span>
              </summary>
              <div className="border-t p-4">
                <p className="mb-4 break-words text-xs text-muted-foreground">
                  Rule {change.ruleId} · Changed properties:{' '}
                  {change.properties.join(', ') ||
                    (change.type === 'added' || change.type === 'removed'
                      ? 'Entire rule'
                      : 'None')}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide">
                      Baseline {diff.baseline.policyVersion}
                    </h3>
                    <Definition rule={change.baseline} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide">
                      Comparison {diff.comparison.policyVersion}
                    </h3>
                    <Definition rule={change.comparison} />
                  </div>
                </div>
                {change.baseline?.field === change.comparison?.field &&
                  change.baseline?.fieldType === 'number' &&
                  change.comparison?.fieldType === 'number' &&
                  typeof change.baseline.expectedValue === 'number' &&
                  typeof change.comparison.expectedValue === 'number' &&
                  change.baseline.expectedValue !==
                    change.comparison.expectedValue && (
                    <p className="mt-4 text-sm font-medium">
                      Configured value{' '}
                      {change.comparison.expectedValue >
                      change.baseline.expectedValue
                        ? 'increased'
                        : 'decreased'}{' '}
                      by{' '}
                      {formatRuleValue(
                        Math.abs(
                          change.comparison.expectedValue -
                            change.baseline.expectedValue,
                        ),
                        change.baseline.field,
                      )}
                      . Operator changes, if any, are shown separately.
                    </p>
                  )}
              </div>
            </details>
          ))}
        {diff.rules.filter((rule) => filter === 'all' || rule.type === filter)
          .length === 0 && (
          <p className="text-sm text-muted-foreground">
            No rules match this change type.
          </p>
        )}
      </div>
    </section>
  );
}
