import { Button } from '@/components/ui/button';
import {
  coverageStatus,
  renewalUrgency,
  daysUntilRenewal,
  coverageLabels,
  type CoverageRow,
} from '../domain/coverage';

export function CoverageTable({
  records,
  date,
  renewals = false,
  onOpen,
  onTimeline,
  onTask,
}: {
  records: readonly CoverageRow[];
  date: string;
  renewals?: boolean;
  onOpen: (id: string) => void;
  onTimeline: (id: string) => void;
  onTask: (id: string) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            {renewals ? 'Renewal worklist' : 'Recorded coverage'}
          </caption>
          <thead>
            <tr>
              {[
                'Patient',
                'Fictional program',
                renewals ? 'Coverage end' : 'Coverage period',
                'Coverage status',
                'Renewal deadline',
                'Renewal stage / urgency',
                ...(renewals ? ['Coordinator', 'Days until due'] : []),
                'Actions',
              ].map((label) => (
                <th scope="col" className="border-b p-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <th scope="row" className="border-b p-3 font-medium">
                  {record.patientName}
                  <p className="text-xs text-muted-foreground">
                    {record.patientId}
                  </p>
                </th>
                <td className="border-b p-3">{record.programName}</td>
                <td className="border-b p-3">
                  {renewals
                    ? (record.endDate ?? 'Open-ended')
                    : record.startDate +
                      ' – ' +
                      (record.endDate ?? 'open-ended')}
                </td>
                <td className="border-b p-3">
                  {coverageLabels[coverageStatus(record, date)]}
                </td>
                <td className="border-b p-3">
                  {record.renewalDueDate ?? 'Not recorded'}
                </td>
                <td className="border-b p-3">
                  {coverageLabels[record.renewalStatus]} ·{' '}
                  {coverageLabels[renewalUrgency(record, date)]}
                </td>
                {renewals && (
                  <>
                    <td className="border-b p-3">
                      {record.coordinatorName ?? 'Unassigned'}
                    </td>
                    <td className="border-b p-3">
                      {daysUntilRenewal(record, date) ?? 'Unknown'}
                    </td>
                  </>
                )}
                <td className="space-y-2 border-b p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={'Open coverage ' + record.id}
                    onClick={() => onOpen(record.id)}
                  >
                    Details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={'Timeline for ' + record.patientId}
                    onClick={() => onTimeline(record.patientId)}
                  >
                    Timeline
                  </Button>
                  {renewals && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTask(record.id)}
                    >
                      Create Renewal Follow-up Task
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {records.map((record) => (
          <article
            key={record.id}
            className="space-y-3 rounded-lg border bg-card p-4"
          >
            <h3 className="text-sm font-semibold">
              {record.patientName} · {record.patientId}
            </h3>
            <p className="text-sm">{record.programName}</p>
            <p className="text-xs">
              {record.startDate} – {record.endDate ?? 'open-ended'} ·{' '}
              {coverageLabels[coverageStatus(record, date)]}
            </p>
            <p className="text-xs">
              Renewal {record.renewalDueDate ?? 'not recorded'} ·{' '}
              {coverageLabels[record.renewalStatus]} ·{' '}
              {coverageLabels[renewalUrgency(record, date)]}
            </p>
            {renewals && (
              <p className="text-xs">
                {record.coordinatorName ?? 'Unassigned'} ·{' '}
                {daysUntilRenewal(record, date) ?? 'Unknown'} days until due
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                aria-label={'Open coverage ' + record.id}
                onClick={() => onOpen(record.id)}
              >
                Details
              </Button>
              <Button
                variant="outline"
                aria-label={'Timeline for ' + record.patientId}
                onClick={() => onTimeline(record.patientId)}
              >
                Timeline
              </Button>
              {renewals && (
                <Button variant="outline" onClick={() => onTask(record.id)}>
                  Create Renewal Follow-up Task
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
