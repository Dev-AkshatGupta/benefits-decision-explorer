import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { usePatientTasks } from '../api/task-queries';
import { useLocalToday } from '../hooks/use-local-today';
import { TaskEditor } from './task-editor';
import { TaskDetails } from './task-details';
import { TaskBadge } from './task-list';
import { taskTiming } from '../domain/tasks';
export function PatientTasksSection({
  patientId,
  onDirty,
  onBusy,
}: {
  patientId: string;
  onDirty: (dirty: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const today = useLocalToday(),
    open = usePatientTasks(patientId, { today, status: 'open', pageSize: 5 }),
    done = usePatientTasks(patientId, {
      today,
      status: 'completed',
      sortBy: 'completedAt',
      sortOrder: 'desc',
      pageSize: 5,
    }),
    overdue = usePatientTasks(patientId, {
      today,
      status: 'open',
      timing: 'overdue',
      pageSize: 1,
    });
  const [creating, setCreating] = useState(false),
    [selected, setSelected] = useState(''),
    [message, setMessage] = useState('');
  return (
    <section
      aria-label="Patient care coordination tasks"
      className="mt-6 space-y-4 rounded-xl border bg-card p-5"
    >
      <h2 className="text-lg font-semibold">Care Coordination Tasks</h2>
      <p className="text-sm">
        {open.data?.pagination.totalItems ?? '…'} open ·{' '}
        {overdue.data?.pagination.totalItems ?? '…'} overdue
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setCreating(true)}>
          Create Task for This Patient
        </Button>
        <Button asChild variant="outline">
          <Link
            to={'/tasks?' + new URLSearchParams({ patientId, status: 'all' })}
          >
            View All Patient Tasks
          </Link>
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      {[open, done, overdue].some((query) => query.isError) && (
        <div role="alert">
          Patient tasks could not fully load.
          <Button
            variant="outline"
            onClick={() => {
              void open.refetch();
              void done.refetch();
              void overdue.refetch();
            }}
          >
            Retry patient tasks
          </Button>
        </div>
      )}
      {[open, done].map((query, index) => (
        <section key={index}>
          <h3 className="mb-2 text-sm font-semibold">
            {index === 0 ? 'Open tasks' : 'Recently completed tasks'}
          </h3>
          {query.isPending ? (
            <p role="status">Loading patient tasks…</p>
          ) : query.data?.data.length ? (
            <ul className="space-y-2">
              {query.data.data.map((task) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  key={task.id}
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">
                      {task.title}
                    </p>
                    <p className="my-2 text-xs">
                      Due {task.dueDate ?? 'not set'}
                      {taskTiming(task, today) === 'overdue'
                        ? ' · Overdue'
                        : ''}
                    </p>
                    <TaskBadge value={task.status} />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={'Open task ' + task.id}
                    onClick={() => setSelected(task.id)}
                  >
                    Details
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No {index === 0 ? 'open' : 'completed'} tasks.
            </p>
          )}
        </section>
      ))}
      {creating && (
        <TaskEditor
          onDirty={onDirty}
          onBusy={onBusy}
          draft={{ patientId }}
          onClose={() => setCreating(false)}
          onSaved={(task) => {
            setCreating(false);
            setMessage('Patient task saved.');
            setSelected(task.id);
          }}
        />
      )}
      {selected && !creating && (
        <TaskDetails
          onDirty={onDirty}
          onBusy={onBusy}
          id={selected}
          onClose={() => setSelected('')}
        />
      )}
    </section>
  );
}
