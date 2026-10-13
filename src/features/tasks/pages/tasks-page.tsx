import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/common/page-container';
import { PatientSearch } from '../../patients/components/patient-search';
import { useCoordinators } from '../../patients/api/patient-queries';
import { useTasks, useTaskOverview } from '../api/task-queries';
import {
  taskFiltersSchema,
  taskTypes,
  taskPriorities,
  taskStatuses,
  taskLabels,
} from '../domain/tasks';
import { useLocalToday } from '../hooks/use-local-today';
import { TaskList } from '../components/task-list';
import { TaskEditor } from '../components/task-editor';
import { TaskDetails } from '../components/task-details';
import { useTranslation } from 'react-i18next';
export function TasksPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useSearchParams(),
    today = useLocalToday();
  const raw = Object.fromEntries(search);
  delete raw.task;
  const parsed = taskFiltersSchema.safeParse({ ...raw, today }),
    filters = parsed.success ? parsed.data : taskFiltersSchema.parse({ today });
  const query = useTasks(filters, parsed.success),
    overview = useTaskOverview(today),
    coordinators = useCoordinators();
  const [creating, setCreating] = useState(false),
    [message, setMessage] = useState('');
  const open = search.get('task') ?? '';
  function change(patch: Record<string, string | null>) {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (!('task' in patch)) {
      next.set('page', '1');
      next.delete('task');
    }
    setSearch(next, { replace: true });
  }
  const select = (
    key: 'status' | 'type' | 'priority' | 'timing' | 'sortBy' | 'sortOrder',
    label: string,
    values: readonly string[],
  ) => (
    <label className="text-xs font-medium">
      {label}
      <select
        className="form-control mt-2 block w-full"
        value={filters[key]}
        onChange={(event) => change({ [key]: event.target.value })}
      >
        {values.map((value) => (
          <option value={value} key={value}>
            {taskLabels[value] ??
              (
                {
                  open: 'Open tasks',
                  all: 'All',
                  overdue: 'Overdue',
                  upcoming: 'Due within seven days',
                  dueDate: 'Due date',
                  updatedAt: 'Last updated',
                  completedAt: 'Completion date',
                  asc: 'Ascending',
                  desc: 'Descending',
                } as Record<string, string>
              )[value] ??
              value}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {t('careCoordinationTasks')}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('manageFollowups')}
            </p>
          </div>
          <Button
            onClick={() => {
              setCreating(true);
              setMessage('');
            }}
          >
            {t('createTask')}
          </Button>
        </header>
        <p className="text-xs text-muted-foreground">
          {t('taskDemoNotice', { date: today })}
        </p>
        {message && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Overview totals cover all patients. Worklist filters apply to the task
          list below.
        </p>
        {overview.isPending ? (
          <p role="status">Loading task overview…</p>
        ) : overview.isError ? (
          <div role="alert">
            Task overview could not load.
            <Button variant="outline" onClick={() => void overview.refetch()}>
              Retry overview
            </Button>
          </div>
        ) : (
          overview.data && (
            <dl
              aria-label="Task overview"
              className="grid grid-cols-2 gap-3 lg:grid-cols-5"
            >
              {(
                [
                  ['Open tasks', overview.data.open],
                  ['Overdue tasks', overview.data.overdue],
                  ['Due within seven days', overview.data.upcoming],
                  ['High / urgent open tasks', overview.data.highPriority],
                  ['Completed tasks', overview.data.completed],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-card p-4">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-2 text-2xl font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          )
        )}
        <section
          aria-label="Task filters"
          className="space-y-4 rounded-lg border bg-card p-4"
        >
          <PatientSearch
            search={filters.search}
            onSearch={(value) => change({ search: value })}
            label="Search tasks"
            placeholder="Task title or patient name"
          />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {select('status', 'Status', ['open', 'all', ...taskStatuses])}
            {select('priority', 'Priority', ['all', ...taskPriorities])}
            {select('type', 'Task type', ['all', ...taskTypes])}
            <label className="text-xs font-medium">
              Coordinator
              <select
                className="form-control mt-2 w-full"
                value={filters.coordinatorId}
                onChange={(event) =>
                  change({ coordinatorId: event.target.value })
                }
              >
                <option value="">All coordinators</option>
                <option value="unassigned">Unassigned</option>
                {coordinators.data?.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
            </label>
            {select('timing', 'Due timing', ['all', 'overdue', 'upcoming'])}
            <label className="text-xs font-medium">
              Due from
              <input
                className="form-control mt-2 w-full"
                type="date"
                value={filters.dueFrom ?? ''}
                onChange={(event) => change({ dueFrom: event.target.value })}
              />
            </label>
            <label className="text-xs font-medium">
              Due through
              <input
                className="form-control mt-2 w-full"
                type="date"
                value={filters.dueTo ?? ''}
                onChange={(event) => change({ dueTo: event.target.value })}
              />
            </label>
            <label className="text-xs font-medium">
              Patient ID
              <input
                className="form-control mt-2 w-full"
                maxLength={100}
                value={filters.patientId}
                onChange={(event) => change({ patientId: event.target.value })}
              />
            </label>
            {filters.coverageId && (
              <p className="text-xs">Coverage source: {filters.coverageId}</p>
            )}
            {select('sortBy', 'Sort by', [
              'dueDate',
              'priority',
              'updatedAt',
              'completedAt',
            ])}
            {select('sortOrder', 'Sort direction', ['asc', 'desc'])}
          </div>
          <Button variant="outline" onClick={() => setSearch({})}>
            Reset task filters
          </Button>
        </section>
        {!parsed.success ? (
          <p role="alert">
            Invalid task filters or reversed due-date range. Reset filters to
            continue.
          </p>
        ) : query.isPending ? (
          <p role="status">Loading tasks…</p>
        ) : query.isError ? (
          <div role="alert">
            Tasks could not load.
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry tasks
            </Button>
          </div>
        ) : (
          query.data && (
            <section aria-label="Task worklist" className="space-y-4">
              <p aria-live="polite" className="text-sm">
                {query.data.pagination.totalItems} matching tasks · Page{' '}
                {filters.page} of{' '}
                {Math.max(1, query.data.pagination.totalPages)}
              </p>
              {query.data.data.length ? (
                <TaskList
                  tasks={query.data.data}
                  today={today}
                  onOpen={(id) => change({ task: id })}
                />
              ) : (
                <p>No tasks match these filters.</p>
              )}
              <nav aria-label="Task pagination" className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={filters.page <= 1}
                  onClick={() =>
                    setSearch((previous) => {
                      const next = new URLSearchParams(previous);
                      next.set('page', String(filters.page - 1));
                      return next;
                    })
                  }
                >
                  Previous task page
                </Button>
                <Button
                  variant="outline"
                  disabled={filters.page >= query.data.pagination.totalPages}
                  onClick={() =>
                    setSearch((previous) => {
                      const next = new URLSearchParams(previous);
                      next.set('page', String(filters.page + 1));
                      return next;
                    })
                  }
                >
                  Next task page
                </Button>
              </nav>
            </section>
          )
        )}
        {creating && (
          <TaskEditor
            draft={filters.patientId ? { patientId: filters.patientId } : {}}
            onClose={() => setCreating(false)}
            onSaved={(task) => {
              setCreating(false);
              setMessage('Task saved.');
              change({ task: task.id });
            }}
          />
        )}
        {open && !creating && (
          <TaskDetails id={open} onClose={() => change({ task: null })} />
        )}
      </div>
    </PageContainer>
  );
}
