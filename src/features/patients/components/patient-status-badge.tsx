import type { Patient } from '../domain/schemas';
import { statusLabels } from '../domain/patient-status';
const statusStyles = {
  active: 'bg-success-muted text-success',
  pending_review: 'bg-warning-muted text-warning',
  inactive: 'bg-muted text-muted-foreground',
} as const;
export function PatientStatusBadge({ status }: { status: Patient['status'] }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2.5 py-1 text-center text-xs font-medium ' +
        statusStyles[status]
      }
    >
      {statusLabels[status]}
    </span>
  );
}
