import { Link } from 'react-router';
import type { PatientSummary } from '../domain/schemas';
import { PatientStatusBadge } from './patient-status-badge';
export function PatientCard({
  patient,
  worklistSearch,
}: {
  patient: PatientSummary;
  worklistSearch: string;
}) {
  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={'/patients/' + encodeURIComponent(patient.id)}
            state={{ worklistSearch }}
            className="break-words font-semibold hover:underline"
          >
            {patient.fullName}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">{patient.id}</p>
        </div>
        <PatientStatusBadge status={patient.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Age / State</dt>
          <dd className="mt-1">
            {patient.age} years · {patient.state}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Coordinator</dt>
          <dd className="mt-1">{patient.assignedCoordinator.fullName}</dd>
        </div>
      </dl>
      <Link
        to={'/patients/' + encodeURIComponent(patient.id)}
        state={{ worklistSearch }}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
        aria-label={'View ' + patient.fullName}
      >
        View patient →
      </Link>
    </li>
  );
}
