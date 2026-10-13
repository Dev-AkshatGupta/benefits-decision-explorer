import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  usePatient,
  useCoordinators,
} from '../../patients/api/patient-queries';
import { formatDate, formatTimestamp } from '../../patients/domain/dates';
import { useTask, useUpdateTask, useCancelTask } from '../api/task-queries';
import {
  taskLabels,
  transitions,
  type CareTask,
  type TaskStatus,
} from '../domain/tasks';
import { TaskEditor } from './task-editor';
import { useDialogFocus } from '../hooks/use-dialog-focus';
export function TaskDetails({
  id,
  onClose,
  onDirty,
  onBusy,
}: {
  id: string;
  onClose: () => void;
  onDirty?: ((dirty: boolean) => void) | undefined;
  onBusy?: ((busy: boolean) => void) | undefined;
}) {
  const query = useTask(id),
    [editing, setEditing] = useState<CareTask | null>(null),
    [action, setAction] = useState<TaskStatus | null>(null),
    [note, setNote] = useState(''),
    [message, setMessage] = useState('');
  const update = useUpdateTask(),
    cancel = useCancelTask(),
    coordinators = useCoordinators();
  const task = query.data,
    busy = update.isPending || cancel.isPending;
  const focus = useDialogFocus();
  const coordinator = coordinators.data?.find(
    (person) => person.id === task?.assignedCoordinatorId,
  );
  const coordinatorName = coordinator
    ? coordinator.firstName + ' ' + coordinator.lastName
    : task?.assignedCoordinatorId
      ? 'Coordinator unavailable'
      : 'Unassigned';
  if (editing)
    return (
      <TaskEditor
        task={editing}
        onDirty={onDirty}
        onBusy={onBusy}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setMessage('Task updated.');
        }}
      />
    );
  const names: Partial<Record<TaskStatus, string>> = {
    in_progress: task?.status === 'completed' ? 'Reopen task' : 'Start task',
    blocked: 'Mark blocked',
    completed: 'Complete task',
    cancelled: 'Cancel task',
    todo: 'Restore task',
  };
  async function apply(status: TaskStatus) {
    if (!task || busy) return;
    try {
      if (status === 'cancelled')
        await cancel.mutateAsync({
          id: task.id,
          expectedUpdatedAt: task.updatedAt,
        });
      else
        await update.mutateAsync({
          id: task.id,
          expectedUpdatedAt: task.updatedAt,
          patch: {
            status,
            ...(status === 'completed' ? { completionNote: note } : {}),
          },
        });
      setAction(null);
      setNote('');
      setMessage('Task status updated.');
    } catch (failure) {
      setMessage(
        failure instanceof Error ? failure.message : 'Task update failed.',
      );
    }
  }
  const sourceQuery =
    task?.source?.programId && task.source.screening
      ? new URLSearchParams({
          patientId: task.patientId,
          date: task.source.screening.evaluationDate,
          programs: task.source.programId,
          programId: task.source.programId,
        })
      : null;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/50" />
        <Dialog.Content
          {...focus}
          className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-card p-5 shadow-xl sm:p-7"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-xl font-semibold">
              Task details
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                disabled={busy}
                variant="ghost"
                aria-label="Close task details"
              >
                Close
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-xs text-muted-foreground">
            Synthetic task details. Status updates do not change patient
            eligibility or coverage.
          </Dialog.Description>
          {query.isPending ? (
            <p role="status" className="mt-5">
              Loading task…
            </p>
          ) : query.isError ? (
            <div role="alert" className="mt-5">
              Task could not load.
              <Button variant="outline" onClick={() => void query.refetch()}>
                Retry task
              </Button>
            </div>
          ) : (
            task && (
              <div className="mt-6 space-y-5">
                <h2 className="break-words text-lg font-semibold">
                  {task.title}
                </h2>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {task.description || 'No description provided.'}
                </p>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  {[
                    ['Task ID', task.id],
                    ['Type', taskLabels[task.type]],
                    ['Status', taskLabels[task.status]],
                    ['Priority', taskLabels[task.priority]],
                    ['Coordinator', coordinatorName],
                    [
                      'Due date',
                      task.dueDate ? formatDate(task.dueDate) : 'No due date',
                    ],
                    ['Created', formatTimestamp(task.createdAt)],
                    ['Last updated', formatTimestamp(task.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
                <PatientLink id={task.patientId} onClose={onClose} />
                {task.completedAt && (
                  <section className="rounded-lg border p-4">
                    <h3 className="font-semibold">Completion information</h3>
                    <p className="mt-2 text-sm">
                      {formatTimestamp(task.completedAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {task.completionNote || 'No completion note.'}
                    </p>
                  </section>
                )}
                {task.source && (
                  <section className="rounded-lg border p-4">
                    <h3 className="font-semibold">Source reference</h3>
                    <dl className="mt-2 space-y-2 text-xs">
                      {Object.entries(task.source)
                        .filter(([key]) => key !== 'screening')
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd className="break-words">{String(value)}</dd>
                          </div>
                        ))}
                    </dl>
                    {sourceQuery && (
                      <>
                        <p className="my-3 text-xs">
                          Policy {task.source.screening?.policyVersion} ·
                          Evaluation date{' '}
                          {task.source.screening?.evaluationDate}. A context
                          reference, not a saved historical result. Rerun
                          screening against current records.
                        </p>
                        <Button asChild variant="outline">
                          <Link
                            to={'/eligibility?' + sourceQuery}
                            onClick={onClose}
                          >
                            Open screening context
                          </Link>
                        </Button>
                      </>
                    )}
                    {task.source.coverageId && (
                      <Button asChild variant="outline">
                        <Link
                          to={
                            '/coverage?record=' +
                            encodeURIComponent(task.source.coverageId)
                          }
                        >
                          Open source coverage
                        </Link>
                      </Button>
                    )}
                  </section>
                )}
                {message && (
                  <p role="status" className="rounded-lg border p-3 text-sm">
                    {message}
                  </p>
                )}
                {action ? (
                  <section className="space-y-3 rounded-lg border p-4">
                    <h3 className="font-semibold">Confirm: {names[action]}</h3>
                    {action === 'completed' && (
                      <label className="block text-sm">
                        Completion note (optional)
                        <textarea
                          maxLength={2000}
                          className="form-control mt-2 w-full"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          disabled={busy}
                        />
                      </label>
                    )}
                    {task.status === 'completed' && (
                      <p className="text-xs">
                        Reopening clears the completion timestamp and note. No
                        historical audit trail is retained.
                      </p>
                    )}
                    <div className="flex gap-3">
                      <Button
                        disabled={busy}
                        onClick={() => void apply(action)}
                      >
                        {busy ? 'Updating task…' : 'Confirm status change'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setAction(null);
                          setNote('');
                        }}
                      >
                        Keep current status
                      </Button>
                    </div>
                  </section>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => setEditing(task)}>
                      Edit task
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void query.refetch()}
                    >
                      Reload task
                    </Button>
                    {transitions[task.status].map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        onClick={() => {
                          setAction(status);
                          setMessage('');
                        }}
                      >
                        {names[status]}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function PatientLink({ id, onClose }: { id: string; onClose: () => void }) {
  const patient = usePatient(id);
  return (
    <Button asChild variant="outline">
      <Link to={'/patients/' + encodeURIComponent(id)} onClick={onClose}>
        View patient:{' '}
        {patient.data
          ? patient.data.firstName + ' ' + patient.data.lastName
          : id}
      </Link>
    </Button>
  );
}
