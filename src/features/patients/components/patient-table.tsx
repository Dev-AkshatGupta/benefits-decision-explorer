import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { formatDate } from '../domain/dates';
import type { PatientListQuery, PatientSummary } from '../domain/schemas';
import type { WorklistSort } from '../utils/worklist-params';
import { PatientStatusBadge } from './patient-status-badge';
export function PatientTable({
  patients,
  params,
  onSort,
  worklistSearch,
}: {
  patients: PatientSummary[];
  params: PatientListQuery;
  onSort: (field: WorklistSort) => void;
  worklistSearch: string;
}) {
  const navigate = useNavigate();
  function sortHeader(label: string, field: WorklistSort) {
    const active = params.sortBy === field;
    const Icon = active
      ? params.sortOrder === 'asc'
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;
    return (
      <th
        scope="col"
        aria-sort={
          active
            ? params.sortOrder === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
        className="px-2 py-2 text-left"
      >
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 text-left"
          onClick={() => onSort(field)}
          aria-label={
            'Sort by ' +
            label.toLowerCase() +
            (active
              ? ', currently ' +
                (params.sortOrder === 'asc' ? 'ascending' : 'descending')
              : '')
          }
        >
          <span>{label}</span>
          <Icon size={13} className="shrink-0" aria-hidden="true" />
        </button>
      </th>
    );
  }
  return (
    <div className="hidden md:block">
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">
          Patient worklist. Select a patient name or View to open their profile.
        </caption>
        <colgroup>
          {['24%', '8%', '6%', '19%', '18%', '16%', '9%'].map(
            (width, index) => (
              <col key={index} style={{ width }} />
            ),
          )}
        </colgroup>
        <thead className="border-y bg-background text-xs font-medium text-muted-foreground">
          <tr>
            {sortHeader('Patient', 'fullName')}
            {sortHeader('Age', 'age')}
            <th scope="col" className="px-2 text-left">
              State
            </th>
            <th scope="col" className="px-2 text-left">
              Status
            </th>
            <th scope="col" className="px-2 text-left">
              Care Coordinator
            </th>
            {sortHeader('Last updated', 'lastUpdated')}
            <th scope="col" className="px-2 text-left">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr
              key={patient.id}
              className="cursor-pointer border-b transition-colors hover:bg-background"
              onClick={(event) => {
                if (
                  event.target instanceof Element &&
                  !event.target.closest('a,button')
                )
                  navigate('/patients/' + encodeURIComponent(patient.id), {
                    state: { worklistSearch },
                  });
              }}
            >
              <td className="break-words px-2 py-4">
                <Link
                  to={'/patients/' + encodeURIComponent(patient.id)}
                  state={{ worklistSearch }}
                  className="font-semibold text-foreground hover:text-primary hover:underline"
                >
                  {patient.fullName}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {patient.id}
                </p>
              </td>
              <td className="px-2">{patient.age}</td>
              <td className="px-2">{patient.state}</td>
              <td className="px-2">
                <PatientStatusBadge status={patient.status} />
              </td>
              <td className="break-words px-2">
                {patient.assignedCoordinator.fullName}
              </td>
              <td className="px-2 text-xs text-muted-foreground">
                <time dateTime={patient.lastUpdated}>
                  {formatDate(patient.lastUpdated)}
                </time>
              </td>
              <td className="px-2">
                <Link
                  to={'/patients/' + encodeURIComponent(patient.id)}
                  state={{ worklistSearch }}
                  className="inline-flex min-h-11 min-w-11 items-center font-medium text-primary hover:underline"
                  aria-label={'View ' + patient.fullName}
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
