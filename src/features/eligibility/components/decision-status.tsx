import { CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import type { ProgramStatus, RuleStatus } from '../domain/types';
import {
  programStatusLabels,
  ruleStatusLabels,
} from '../ui/decision-presentation';
export function DecisionStatus({
  status,
}: {
  status: ProgramStatus | RuleStatus;
}) {
  const good = status === 'pass' || status === 'eligible';
  const unknown = status === 'unknown' || status === 'needs_information';
  const Icon = good ? CheckCircle2 : unknown ? CircleHelp : XCircle;
  const label =
    status in programStatusLabels
      ? programStatusLabels[status as ProgramStatus]
      : ruleStatusLabels[status as RuleStatus];
  return (
    <span
      className={
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ' +
        (good
          ? 'bg-success-muted text-success'
          : unknown
            ? 'bg-accent text-primary'
            : 'bg-warning-muted text-warning')
      }
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
