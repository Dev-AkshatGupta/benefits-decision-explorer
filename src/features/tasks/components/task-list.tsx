import { Button } from '@/components/ui/button';
import { taskLabels, taskTiming, type CareTask } from '../domain/tasks';
import { formatDate } from '../../patients/domain/dates';
type Row = CareTask & { patientName: string; coordinatorName: string | null };
export function TaskBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium">
      {taskLabels[value] ?? value}
    </span>
  );
}
export function TaskList({
  tasks,
  today,
  onOpen,
}: {
  tasks: readonly Row[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const due = (task: CareTask) => (
    <>
      <span>{task.dueDate ? formatDate(task.dueDate) : 'No due date'}</span>
      {taskTiming(task, today) === 'overdue' && (
        <span className="ml-2 font-medium text-warning">Overdue</span>
      )}
      {taskTiming(task, today) === 'upcoming' && (
        <span className="ml-2 text-muted-foreground">Due soon</span>
      )}
    </>
  );
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Care coordination tasks</caption>
          <thead>
            <tr>
              {[
                'Task title',
                'Patient',
                'Type',
                'Priority',
                'Status',
                'Coordinator',
                'Due date',
                'Actions',
              ].map((label) => (
                <th scope="col" key={label} className="border-b p-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <th scope="row" className="max-w-60 border-b p-3 font-medium">
                  {task.title}
                </th>
                <td className="border-b p-3">
                  {task.patientName}
                  <p className="text-xs text-muted-foreground">
                    {task.patientId}
                  </p>
                </td>
                <td className="border-b p-3">{taskLabels[task.type]}</td>
                <td className="border-b p-3">
                  <TaskBadge value={task.priority} />
                </td>
                <td className="border-b p-3">
                  <TaskBadge value={task.status} />
                </td>
                <td className="border-b p-3">
                  {task.coordinatorName ?? 'Unassigned'}
                </td>
                <td className="border-b p-3">{due(task)}</td>
                <td className="border-b p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={'Open task ' + task.id}
                    onClick={() => onOpen(task.id)}
                  >
                    Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {tasks.map((task) => (
          <article className="rounded-lg border bg-card p-4" key={task.id}>
            <h3 className="break-words font-semibold">{task.title}</h3>
            <p className="my-3 text-sm">
              {task.patientName} · {task.patientId}
            </p>
            <div className="flex flex-wrap gap-2">
              <TaskBadge value={task.status} />
              <TaskBadge value={task.priority} />
            </div>
            <p className="my-3 text-xs">
              {taskLabels[task.type]} · {task.coordinatorName ?? 'Unassigned'}
            </p>
            <p className="mb-3 text-sm">{due(task)}</p>
            <Button
              variant="outline"
              aria-label={'Open task ' + task.id}
              onClick={() => onOpen(task.id)}
            >
              Details
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}
