import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { annualizeIncome, formatCurrency } from '../../patients/domain/income';
import {
  incomeTypeLabels,
  frequencyLabels,
} from '../../patients/domain/profile-labels';
import type {
  EligibilityProgram,
  ProgramEvaluationResult,
} from '../domain/types';
import type { ScreeningSnapshot } from '../ui/screening-snapshot';
import { decisionSummary, fieldLabels } from '../ui/decision-presentation';
import { DecisionStatus } from './decision-status';
import { DecisionFlow } from './decision-flow';
import { RuleComparison } from './rule-comparison';
export function DecisionInspector({
  snapshot,
  program,
  result,
  outdated,
  onClose,
  onRerun,
  busy,
  canRerun,
  profilePath,
  returnSearch,
}: {
  snapshot: ScreeningSnapshot;
  program: EligibilityProgram;
  result: ProgramEvaluationResult;
  outdated: boolean;
  onClose: () => void;
  onRerun: () => void;
  busy: boolean;
  canRerun: boolean;
  profilePath: string;
  returnSearch: string;
}) {
  const restoreTarget = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/50" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l bg-card shadow-xl outline-none"
          onOpenAutoFocus={() => {
            restoreTarget.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const fallback =
              document.getElementById('inspect-' + result.programId) ??
              document.getElementById('screening-action');
            (restoreTarget.current?.isConnected
              ? restoreTarget.current
              : fallback
            )?.focus();
          }}
        >
          <div className="shrink-0 border-b px-5 py-4 sm:px-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  Decision inspector
                </p>
                <Dialog.Title className="break-words text-xl font-semibold">
                  {result.programName}
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label="Close decision inspector"
                >
                  <X size={20} aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-3 text-xs leading-5 text-muted-foreground">
              Fictional demonstration policies. This decision is not an official
              benefit eligibility determination.
            </Dialog.Description>
          </div>
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
            {outdated && (
              <div
                role="status"
                className="rounded-lg border bg-warning-muted p-4 text-sm text-warning"
              >
                <p className="font-semibold">Outdated results</p>
                <p className="mt-1">
                  Patient information or screening inputs have changed. This
                  trace retains the original evaluated values.
                </p>
                <Button
                  className="mt-3"
                  disabled={busy || !canRerun}
                  onClick={onRerun}
                >
                  {busy ? 'Screening…' : 'Rerun screening'}
                </Button>
                {!canRerun && !busy && (
                  <p className="mt-2 text-xs">
                    Close the inspector to review the screening inputs and
                    resolve loading errors before rerunning.
                  </p>
                )}
              </div>
            )}
            <section aria-label="Evaluated decision">
              <DecisionStatus status={result.status} />
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-muted-foreground">
                    Patient at evaluation
                  </dt>
                  <dd className="mt-1 break-words font-medium">
                    {snapshot.patientName} · {result.patientId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Evaluation date
                  </dt>
                  <dd className="mt-1">
                    <time dateTime={result.evaluatedAt}>
                      {result.evaluatedAt}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Policy version
                  </dt>
                  <dd className="mt-1">{result.policyVersion}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Rules evaluated
                  </dt>
                  <dd className="mt-1">{result.ruleResults.length}</dd>
                </div>
              </dl>
            </section>
            <section aria-labelledby="decision-summary-title">
              <h3 id="decision-summary-title" className="font-semibold">
                Decision summary
              </h3>
              <div className="my-3 flex flex-wrap gap-3 text-sm">
                <span>{result.passedRules} passed</span>
                <span>{result.failedRules} failed</span>
                <span>{result.unknownRules} unknown</span>
              </div>
              <p className="text-sm font-medium">
                {program.evaluationStrategy}:{' '}
                {program.evaluationStrategy === 'ALL'
                  ? 'Every required rule must pass.'
                  : 'At least one required rule must pass.'}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {decisionSummary(result, program.evaluationStrategy)}
              </p>
            </section>
            <section aria-labelledby="rule-trace-title">
              <h3 id="rule-trace-title" className="mb-3 font-semibold">
                Rule-by-rule trace
              </h3>
              <div className="space-y-3">
                {result.ruleResults.map((ruleResult) => {
                  const rule = program.rules.find(
                    (item) => item.id === ruleResult.ruleId,
                  );
                  return (
                    <details
                      key={ruleResult.ruleId}
                      className="rounded-lg border"
                    >
                      <summary className="min-h-14 cursor-pointer rounded-lg p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                        <span className="ml-1 break-words text-sm font-semibold">
                          {ruleResult.ruleName}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-2">
                          <DecisionStatus status={ruleResult.status} />
                          <span className="text-xs text-muted-foreground">
                            {ruleResult.ruleId}
                          </span>
                        </span>
                        <span className="mt-2 block line-clamp-2 text-xs font-normal leading-5 text-muted-foreground">
                          {ruleResult.explanation}
                        </span>
                      </summary>
                      <div className="space-y-4 border-t p-4">
                        <p className="break-words text-sm leading-6">
                          {ruleResult.explanation}
                        </p>
                        {rule && (
                          <RuleComparison rule={rule} result={ruleResult} />
                        )}
                        <p className="break-words text-xs text-muted-foreground">
                          <span className="font-medium">
                            Policy reference:{' '}
                          </span>
                          {ruleResult.policyReference.documentId} /{' '}
                          {ruleResult.policyReference.section} /{' '}
                          {ruleResult.policyReference.policyVersion}
                        </p>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
            {result.missingFields.length > 0 && (
              <section
                aria-labelledby="missing-information-title"
                className="rounded-lg border bg-accent p-4"
              >
                <h3 id="missing-information-title" className="font-semibold">
                  Missing information
                </h3>
                <ul className="mt-3 space-y-4">
                  {result.missingFields.map((field) => (
                    <li key={field} className="text-sm">
                      <p className="font-medium">{fieldLabels[field]}</p>
                      <p className="mt-1 text-xs leading-5">
                        Required to evaluate{' '}
                        {result.ruleResults
                          .filter((rule) => rule.missingFields.includes(field))
                          .map((rule) => rule.ruleName)
                          .join(', ')}{' '}
                        for {result.programName}.
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="my-3 text-xs leading-5">
                  Supplying missing information allows reevaluation; it does not
                  guarantee eligibility.
                </p>
                <Button asChild variant="outline">
                  <Link
                    to={profilePath}
                    state={{ screeningReturnSearch: returnSearch }}
                  >
                    Update Patient Information
                  </Link>
                </Button>
              </section>
            )}
            {snapshot.context.annualHouseholdIncomeCents !== null &&
              snapshot.context.annualHouseholdIncomeCents !== undefined &&
              snapshot.incomeSources && (
                <section aria-labelledby="income-breakdown-title">
                  <h3 id="income-breakdown-title" className="font-semibold">
                    Evaluated income breakdown
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Source amounts captured at screening time; member-reported
                    income is not added again.
                  </p>
                  <ul className="mt-3 space-y-3 text-sm">
                    {snapshot.incomeSources.map((source, index) => (
                      <li
                        key={index}
                        className="break-words rounded-lg bg-background p-3"
                      >
                        {incomeTypeLabels[source.type]}:{' '}
                        {formatCurrency(source.amount)} ·{' '}
                        {frequencyLabels[source.frequency]} →{' '}
                        {formatCurrency(
                          annualizeIncome(source.amount, source.frequency),
                        )}{' '}
                        annually
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm font-semibold">
                    Derived annual total:{' '}
                    {formatCurrency(
                      snapshot.context.annualHouseholdIncomeCents,
                    )}
                  </p>
                </section>
              )}
            <DecisionFlow result={result} program={program} />
            <section aria-labelledby="policy-info-title">
              <h3 id="policy-info-title" className="font-semibold">
                Policy information
              </h3>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Program</dt>
                  <dd className="break-words">{program.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Version and effective dates (inclusive)
                  </dt>
                  <dd>
                    {program.policyVersion} · {program.effectiveFrom} through{' '}
                    {program.effectiveTo ?? 'No end date specified'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Evaluation strategy
                  </dt>
                  <dd>{program.evaluationStrategy}</dd>
                </div>
              </dl>
              <ul
                aria-label="Policy references"
                className="mt-3 space-y-2 text-xs text-muted-foreground"
              >
                {result.ruleResults.map((rule) => (
                  <li key={rule.ruleId} className="break-words">
                    {rule.policyReference.documentId} /{' '}
                    {rule.policyReference.section} /{' '}
                    {rule.policyReference.policyVersion}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {program.disclaimer}
              </p>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
