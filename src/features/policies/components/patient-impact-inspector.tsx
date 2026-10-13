import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RuleComparison } from '../../eligibility/components/rule-comparison';
import { DecisionStatus } from '../../eligibility/components/decision-status';
import { decisionSummary } from '../../eligibility/ui/decision-presentation';
import type { DeepReadonly } from '../../eligibility/domain/types';
import type { AnalysisSnapshot } from '../hooks/use-population-impact';
import type { PatientImpact } from '../domain/population';
export function PatientImpactInspector({
  patient,
  snapshot,
  onClose,
  returnSearch,
  outdated,
}: {
  patient: DeepReadonly<PatientImpact>;
  snapshot: DeepReadonly<AnalysisSnapshot>;
  onClose: () => void;
  returnSearch: string;
  outdated: boolean;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const changed = patient.rules.filter((rule) => rule.outcomeChanged);
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
            previousFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (previousFocus.current?.isConnected
              ? previousFocus.current
              : document.getElementById('population-analysis-action')
            )?.focus();
          }}
        >
          <div className="shrink-0 border-b p-5">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="break-words text-xl font-semibold">
                Patient policy impact
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close patient impact inspector"
                >
                  <X size={20} aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 text-xs leading-6 text-muted-foreground">
              Fictional counterfactual analysis of one captured context. This is
              not an official benefit determination.
            </Dialog.Description>
          </div>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
            {outdated && (
              <p role="alert" className="rounded-md border p-3 text-sm">
                Analysis outdated. This inspector retains the original captured
                results. Close and rerun to use current selections and records.
              </p>
            )}
            <p className="break-words font-medium">
              {snapshot.names[patient.patientId] ?? patient.patientId} ·{' '}
              {patient.patientId}
            </p>
            <p className="break-words text-xs text-muted-foreground">
              {snapshot.snapshotId} · Date {snapshot.evaluationDate}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['baseline', 'comparison'] as const).map((side) => (
                <section key={side} className="rounded-lg border p-4">
                  <h2 className="mb-2 text-sm font-semibold">
                    {side === 'baseline' ? 'Baseline' : 'Comparison'}{' '}
                    {patient[side].policyVersion}
                  </h2>
                  <DecisionStatus status={patient[side].status} />
                  <p className="mt-3 text-xs leading-6">
                    {decisionSummary(
                      patient[side],
                      snapshot[side].evaluationStrategy,
                    )}
                  </p>
                </section>
              ))}
            </div>
            <p className="text-sm">
              Strategy: {snapshot.baseline.evaluationStrategy} →{' '}
              {snapshot.comparison.evaluationStrategy}. Multiple rules may
              contribute; these traces do not attribute the decision to one
              cause.
            </p>
            <section>
              <h2 className="mb-3 font-semibold">Changed rule outcomes</h2>
              {!changed.length && (
                <p className="text-sm text-muted-foreground">
                  No rule outcomes changed. A strategy change can still change
                  the final decision.
                </p>
              )}
              <div className="space-y-4">
                {changed.map((impact) => {
                  const oldRule = snapshot.baseline.rules.find(
                      (rule) => rule.id === impact.ruleId,
                    ),
                    newRule = snapshot.comparison.rules.find(
                      (rule) => rule.id === impact.ruleId,
                    );
                  return (
                    <section
                      key={impact.ruleId}
                      aria-label={
                        impact.comparison?.ruleName ?? impact.baseline?.ruleName
                      }
                      className="rounded-lg border p-4"
                    >
                      <h3 className="break-words text-sm font-semibold">
                        {impact.comparison?.ruleName ??
                          impact.baseline?.ruleName}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {impact.ruleId}
                      </p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {(['baseline', 'comparison'] as const).map((side) => {
                          const result = impact[side],
                            rule = side === 'baseline' ? oldRule : newRule;
                          return (
                            <div key={side} className="min-w-0">
                              <h4 className="mb-2 text-xs font-semibold uppercase">
                                {side} {snapshot[side].policyVersion}
                              </h4>
                              {result && rule ? (
                                <>
                                  <DecisionStatus status={result.status} />
                                  <div className="mt-3">
                                    <RuleComparison
                                      rule={rule}
                                      result={result}
                                    />
                                  </div>
                                  <p className="mt-3 break-words text-xs leading-6">
                                    {result.explanation}
                                  </p>
                                  <p className="mt-2 break-words text-xs text-muted-foreground">
                                    {result.policyReference.documentId} /{' '}
                                    {result.policyReference.section} /{' '}
                                    {result.policyReference.policyVersion}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Rule not present — this is not a failed or
                                  unknown evaluation.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
            <Button asChild variant="outline">
              <Link
                to={'/patients/' + encodeURIComponent(patient.patientId)}
                state={{ policyReturnSearch: returnSearch }}
              >
                View patient profile
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Profile navigation leaves this in-memory analysis. Rerun after
              returning to evaluate current records.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
