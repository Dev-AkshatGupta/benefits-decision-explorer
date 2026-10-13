import type {
  EligibilityProgram,
  ProgramEvaluationResult,
} from '../domain/types';
import { programStatusLabels } from '../ui/decision-presentation';
export function DecisionFlow({
  program,
  result,
}: {
  program: EligibilityProgram;
  result: ProgramEvaluationResult;
}) {
  return (
    <section aria-labelledby="decision-flow-title">
      <h3 id="decision-flow-title" className="mb-3 font-semibold">
        Decision flow
      </h3>
      <ol aria-label="Decision flow" className="space-y-2 text-center text-sm">
        <li className="rounded-lg border bg-background p-3">
          Evaluated patient &amp; household context
        </li>
        <li>
          <span aria-hidden="true" className="block text-muted-foreground">
            ↓
          </span>
          <div className="rounded-lg border p-3">
            Policy version {result.policyVersion} · {result.ruleResults.length}{' '}
            required rules evaluated
          </div>
        </li>
        <li>
          <span aria-hidden="true" className="block text-muted-foreground">
            ↓
          </span>
          <div className="grid grid-cols-3 gap-2">
            <span className="rounded-lg bg-success-muted p-3 text-success">
              Pass
              <br />
              <strong>{result.passedRules}</strong>
            </span>
            <span className="rounded-lg bg-warning-muted p-3 text-warning">
              Fail
              <br />
              <strong>{result.failedRules}</strong>
            </span>
            <span className="rounded-lg bg-accent p-3 text-primary">
              Unknown
              <br />
              <strong>{result.unknownRules}</strong>
            </span>
          </div>
        </li>
        <li>
          <span aria-hidden="true" className="block text-muted-foreground">
            ↓
          </span>
          <div className="rounded-lg border p-3">
            Apply {program.evaluationStrategy} strategy
          </div>
        </li>
        <li>
          <span aria-hidden="true" className="block text-muted-foreground">
            ↓
          </span>
          <div className="rounded-lg border bg-background p-3 font-semibold">
            Final demonstration outcome: {programStatusLabels[result.status]}
          </div>
        </li>
      </ol>
    </section>
  );
}
