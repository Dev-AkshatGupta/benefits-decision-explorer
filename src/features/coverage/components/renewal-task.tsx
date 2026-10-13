import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { TaskEditor } from '../../tasks/components/task-editor';
import { usePatient } from '../../patients/api/patient-queries';
import type { CoverageRecord } from '../domain/coverage';
export function RenewalTask({
  record,
  onDirty,
  onBusy,
  autoOpen = false,
  onConsumed,
}: {
  record: CoverageRecord;
  onDirty?: ((dirty: boolean) => void) | undefined;
  onBusy?: ((busy: boolean) => void) | undefined;
  autoOpen?: boolean;
  onConsumed?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(autoOpen),
    [saved, setSaved] = useState(''),
    patient = usePatient(record.patientId);
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        disabled={!patient.data}
        onClick={() => setOpen(true)}
      >
        Create Renewal Follow-up Task
      </Button>
      {saved && (
        <p role="status" className="text-sm">
          Renewal follow-up saved.{' '}
          <Link
            className="underline"
            to={'/tasks?status=all&task=' + encodeURIComponent(saved)}
          >
            View renewal task
          </Link>
        </p>
      )}
      {patient.isError && (
        <p role="alert">
          Patient information could not load for task assignment.
        </p>
      )}
      {open && patient.data && (
        <TaskEditor
          onDirty={onDirty}
          onBusy={onBusy}
          draft={{
            patientId: record.patientId,
            type: 'coverage_renewal',
            title: 'Review renewal for ' + record.programName,
            description:
              'Review the fictional coverage renewal for ' +
              record.id +
              '. Due ' +
              (record.renewalDueDate ?? 'date not recorded') +
              '. A task does not extend coverage or complete its renewal.',
            dueDate: record.renewalDueDate,
            assignedCoordinatorId: patient.data?.assignedCoordinatorId ?? null,
            source: {
              patientId: record.patientId,
              programId: record.programId,
              coverageId: record.id,
              ...(record.renewalDueDate
                ? { renewalDueDate: record.renewalDueDate }
                : {}),
            },
          }}
          onClose={() => {
            setOpen(false);
            onConsumed?.();
          }}
          onSaved={(task) => {
            setOpen(false);
            setSaved(task.id);
            onConsumed?.();
          }}
        />
      )}
    </div>
  );
}
