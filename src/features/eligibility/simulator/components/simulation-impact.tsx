import type { ScreeningSnapshot } from '../../ui/screening-snapshot';
import type { EligibilityContext } from '../../domain/types';
import { DecisionStatus } from '../../components/decision-status';
import {
  fieldLabels,
  formatRuleValue,
  operatorLabels,
  programStatusLabels,
} from '../../ui/decision-presentation';
import {
  incomeDifferenceCents,
  inputDifferences,
  type ProgramDifference,
} from '../domain/simulation';
export function SimulationImpact({
  baseline,
  comparisons,
  context,
}: {
  baseline: ScreeningSnapshot;
  comparisons: readonly ProgramDifference[] | null;
  context: EligibilityContext | null;
}) {
  if (!comparisons || !context)
    return (
      <section
        aria-labelledby="simulation-impact-title"
        className="rounded-xl border bg-card p-6"
      >
        <h2 id="simulation-impact-title" className="text-lg font-semibold">
          Eligibility impact
        </h2>
        <p role="status" className="mt-4 text-sm leading-6 text-warning">
          Simulation paused. Correct the invalid scenario inputs to view current
          comparisons. No results are shown for invalid values.
        </p>
      </section>
    );
  const changedPrograms = comparisons.filter(
    (program) => program.statusChanged,
  ).length;
  const changedRules = comparisons.reduce(
    (sum, program) =>
      sum + program.rules.filter((rule) => rule.outcomeChanged).length,
    0,
  );
  const changes = inputDifferences(baseline.context, context);
  return (
    <section aria-labelledby="simulation-impact-title" className="space-y-5">
      <div className="rounded-xl border bg-card p-5">
        <h2 id="simulation-impact-title" className="text-lg font-semibold">
          Eligibility impact
        </h2>
        <p role="status" aria-live="polite" className="mt-3 text-sm">
          {comparisons.length} programs evaluated · {changedPrograms} changed
          programs · {comparisons.length - changedPrograms} unchanged programs ·{' '}
          {changedRules} changed rules
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Changed rules count outcome transitions only, not movement in input
          values.
        </p>
      </div>
      <section
        aria-labelledby="scenario-changes-title"
        className="rounded-xl border bg-card p-5"
      >
        <h3 id="scenario-changes-title" className="font-semibold">
          Scenario changes
        </h3>
        {!changes.length ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No input changes. Simulation matches the original screening.
          </p>
        ) : (
          <dl className="mt-3 space-y-3">
            {changes.map((change) => (
              <div key={change.field}>
                <dt className="text-xs text-muted-foreground">
                  {fieldLabels[change.field]}
                </dt>
                <dd className="mt-1 break-words text-sm">
                  {formatRuleValue(change.before ?? null, change.field)} →{' '}
                  {formatRuleValue(change.after ?? null, change.field)}
                  {change.field === 'annualHouseholdIncomeCents' && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {typeof change.before === 'number' &&
                      typeof change.after === 'number'
                        ? 'Difference from baseline: ' +
                          (change.after > change.before ? '+' : '') +
                          formatRuleValue(
                            incomeDifferenceCents(change.before, change.after),
                            change.field,
                          )
                        : 'Baseline income is unknown; a numeric difference is unavailable.'}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      {comparisons.map((comparison) => {
        const program = baseline.programs.find(
          (item) => item.id === comparison.baseline.programId,
        )!;
        return (
          <article
            aria-label={program.name}
            key={program.id}
            className="rounded-xl border bg-card p-5"
          >
            <h3 className="break-words text-lg font-semibold">
              {program.name}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Fixed policy {comparison.baseline.policyVersion} ·{' '}
              {baseline.context.evaluationDate}
            </p>
            <div className="my-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-background p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide">
                  Baseline
                </p>
                <DecisionStatus status={comparison.baseline.status} />
                <p className="mt-2 text-xs leading-5">
                  {comparison.baseline.passedRules} pass ·{' '}
                  {comparison.baseline.failedRules} fail ·{' '}
                  {comparison.baseline.unknownRules} unknown
                </p>
              </div>
              <div className="rounded-lg border bg-accent/30 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide">
                  Simulation
                </p>
                <DecisionStatus status={comparison.simulated.status} />
                <p className="mt-2 text-xs leading-5">
                  {comparison.simulated.passedRules} pass ·{' '}
                  {comparison.simulated.failedRules} fail ·{' '}
                  {comparison.simulated.unknownRules} unknown
                </p>
              </div>
            </div>
            <p className="text-sm font-medium">
              {comparison.statusChanged
                ? `Status changed: ${programStatusLabels[comparison.baseline.status]} → ${programStatusLabels[comparison.simulated.status]}`
                : 'No status change'}
            </p>
            <details className="mt-4 rounded-lg border">
              <summary className="min-h-11 cursor-pointer rounded-lg p-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
                Inspect rule differences (
                {comparison.rules.filter((rule) => rule.outcomeChanged).length}{' '}
                changed outcomes)
              </summary>
              <div className="space-y-4 border-t p-3">
                {comparison.rules.map((difference) => {
                  const rule = program.rules.find(
                    (item) => item.id === difference.baseline.ruleId,
                  )!;
                  return (
                    <section
                      aria-label={difference.baseline.ruleName}
                      key={rule.id}
                      className="rounded-lg bg-background p-3"
                    >
                      <h4 className="break-words text-sm font-semibold">
                        {difference.baseline.ruleName}
                      </h4>
                      <p className="mt-1 text-xs font-medium text-primary">
                        {difference.outcomeChanged
                          ? 'Rule outcome changed'
                          : difference.valueChanged
                            ? 'Input value changed; rule outcome unchanged'
                            : 'Rule unchanged'}
                      </p>
                      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            Baseline value and outcome
                          </dt>
                          <dd className="mt-1 break-words">
                            {formatRuleValue(
                              difference.baseline.actualValue,
                              rule.field,
                            )}
                            <span className="mt-1 block">
                              <DecisionStatus
                                status={difference.baseline.status}
                              />
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            Simulated value and outcome
                          </dt>
                          <dd className="mt-1 break-words">
                            {formatRuleValue(
                              difference.simulated.actualValue,
                              rule.field,
                            )}
                            <span className="mt-1 block">
                              <DecisionStatus
                                status={difference.simulated.status}
                              />
                            </span>
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-muted-foreground">
                            Configured condition (unchanged)
                          </dt>
                          <dd className="mt-1 break-words">
                            {operatorLabels[rule.operator]} ·{' '}
                            {formatRuleValue(
                              difference.baseline.expectedValue,
                              rule.field,
                            )}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-3 break-words text-xs leading-6">
                        {difference.outcomeChanged
                          ? 'Why the outcome changed: '
                          : 'Simulated rule explanation: '}
                        {difference.simulated.explanation}
                      </p>
                      <p className="mt-2 break-words text-xs text-muted-foreground">
                        {difference.baseline.policyReference.documentId} /{' '}
                        {difference.baseline.policyReference.section}
                      </p>
                    </section>
                  );
                })}
              </div>
            </details>
          </article>
        );
      })}
    </section>
  );
}
