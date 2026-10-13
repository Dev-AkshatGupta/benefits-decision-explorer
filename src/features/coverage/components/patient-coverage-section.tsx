import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useLocalToday } from '../../tasks/hooks/use-local-today';
import { usePatientCoverageHistory } from '../api/coverage-queries';
import {
  coverageStatus,
  renewalUrgency,
  coverageLabels,
} from '../domain/coverage';
import { RenewalTask } from './renewal-task';
export function PatientCoverageSection({
  patientId,
  onDirty,
  onBusy,
}: {
  patientId: string;
  onDirty: (dirty: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const date = useLocalToday(),
    query = usePatientCoverageHistory(patientId, date),
    records = query.data?.records ?? [],
    gaps = query.data?.gaps ?? [];
  const ordered = [...records].sort(
    (a, b) =>
      b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id),
  );
  return (
    <section
      aria-label="Patient coverage history"
      className="mt-6 space-y-4 rounded-xl border bg-card p-5"
    >
      <h2 className="text-lg font-semibold">Coverage History</h2>
      <p className="text-xs">
        Fictional recorded periods only; screening does not confirm coverage.
      </p>
      <Button asChild variant="outline">
        <Link
          to={
            '/coverage?' +
            new URLSearchParams({ patientId, timeline: patientId, date })
          }
        >
          View Coverage Timeline
        </Link>
      </Button>
      {query.isPending ? (
        <p role="status">Loading patient coverage…</p>
      ) : query.isError ? (
        <div role="alert">
          Patient coverage could not load.
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry patient coverage
          </Button>
        </div>
      ) : !records.length ? (
        <p className="text-sm">
          No recorded coverage. This does not prove the patient was uninsured.
        </p>
      ) : (
        <>
          <p className="text-sm">
            {
              records.filter(
                (record) => coverageStatus(record, date) === 'active',
              ).length
            }{' '}
            active recorded periods. {gaps.length} bounded program-specific
            gaps.
          </p>
          {!records.some(
            (record) => coverageStatus(record, date) === 'active',
          ) && (
            <p className="text-sm">
              No active recorded period on {date}; real-world coverage is
              unknown.
            </p>
          )}
          <ul className="space-y-3">
            {ordered.slice(0, 5).map((record) => (
              <li className="space-y-3 rounded-lg border p-4" key={record.id}>
                <h3 className="text-sm font-semibold">
                  {record.programName} ·{' '}
                  {coverageLabels[coverageStatus(record, date)]}
                </h3>
                <p className="text-xs">
                  {record.startDate} – {record.endDate ?? 'open-ended'} ·
                  Renewal {record.renewalDueDate ?? 'not recorded'} ·{' '}
                  {coverageLabels[renewalUrgency(record, date)]}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link
                    aria-label={'Open Coverage Details ' + record.id}
                    to={
                      '/coverage?' +
                      new URLSearchParams({
                        patientId,
                        record: record.id,
                        date,
                      })
                    }
                  >
                    Open Coverage Details
                  </Link>
                </Button>
                {record.renewalStatus !== 'completed' && (
                  <RenewalTask
                    record={record}
                    onDirty={onDirty}
                    onBusy={onBusy}
                  />
                )}
              </li>
            ))}
          </ul>
          {!!gaps.length && (
            <ul className="space-y-2 text-sm">
              {gaps.map((gap) => (
                <li key={gap.programId + gap.startDate}>
                  Recorded gap for {gap.programId}: {gap.startDate} –{' '}
                  {gap.endDate}. Only bounded gaps are reported.
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
