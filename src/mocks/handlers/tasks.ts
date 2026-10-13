import { http, HttpResponse } from 'msw';
import {
  createTaskSchema,
  updateTaskSchema,
  taskFiltersSchema,
  taskSchema,
  transitions,
  transitionTask,
  taskTiming,
  isOpenTask,
  taskPriorities,
  localCalendarDate,
  type TaskFilters,
  type CareTask,
} from '@/features/tasks/domain/tasks';
import { demoPolicyRegistry } from '@/features/eligibility/policies/registry';
import { mockDatabase } from '../data/database';
function error(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}
function references(value: {
  patientId: string;
  assignedCoordinatorId: string | null;
  source?: CareTask['source'];
}) {
  if (!mockDatabase.patients.some((patient) => patient.id === value.patientId))
    return 'Patient does not exist.';
  if (
    value.assignedCoordinatorId !== null &&
    !mockDatabase.coordinators.some(
      (coordinator) => coordinator.id === value.assignedCoordinatorId,
    )
  )
    return 'Coordinator does not exist.';
  const source = value.source;
  if (source?.coverageId || source?.coverageEventId)
    return 'Coverage records are not available.';
  if (source?.patientId && source.patientId !== value.patientId)
    return 'Source patient does not match task patient.';
  if (
    source?.programId &&
    !demoPolicyRegistry.some(
      (policy) =>
        policy.id === source.programId &&
        (!source.screening ||
          policy.policyVersion === source.screening.policyVersion),
    )
  )
    return 'Fictional program or policy version does not exist.';
  return null;
}
export function queryTasks(query: TaskFilters) {
  const patients = new Map(
    mockDatabase.patients.map((patient) => [
      patient.id,
      patient.firstName + ' ' + patient.lastName,
    ]),
  );
  const coordinators = new Map(
    mockDatabase.coordinators.map((coordinator) => [
      coordinator.id,
      coordinator.firstName + ' ' + coordinator.lastName,
    ]),
  );
  const data = mockDatabase.tasks
    .filter(
      (task) =>
        (query.status === 'all' ||
          (query.status === 'open'
            ? isOpenTask(task)
            : task.status === query.status)) &&
        (query.priority === 'all' || task.priority === query.priority) &&
        (query.type === 'all' || task.type === query.type) &&
        (!query.patientId || task.patientId === query.patientId) &&
        (!query.coverageId || task.source?.coverageId === query.coverageId) &&
        (!query.coordinatorId ||
          (query.coordinatorId === 'unassigned'
            ? !task.assignedCoordinatorId
            : task.assignedCoordinatorId === query.coordinatorId)) &&
        (!query.dueFrom || (!!task.dueDate && task.dueDate >= query.dueFrom)) &&
        (!query.dueTo || (!!task.dueDate && task.dueDate <= query.dueTo)) &&
        (query.timing === 'all' ||
          taskTiming(task, query.today) === query.timing) &&
        (task.title + ' ' + (patients.get(task.patientId) ?? ''))
          .toLowerCase()
          .includes(query.search.toLowerCase()),
    )
    .sort((a, b) => {
      if (
        (query.sortBy === 'dueDate' || query.sortBy === 'completedAt') &&
        (a[query.sortBy] === null || b[query.sortBy] === null)
      )
        return a[query.sortBy] === b[query.sortBy]
          ? a.id.localeCompare(b.id)
          : a[query.sortBy] === null
            ? 1
            : -1;
      const x =
          query.sortBy === 'priority'
            ? taskPriorities.indexOf(a.priority)
            : (a[query.sortBy] ?? ''),
        y =
          query.sortBy === 'priority'
            ? taskPriorities.indexOf(b.priority)
            : (b[query.sortBy] ?? '');
      return (
        (x < y ? -1 : x > y ? 1 : 0) * (query.sortOrder === 'asc' ? 1 : -1) ||
        a.id.localeCompare(b.id)
      );
    });
  return {
    data: data
      .slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
      .map((task) => ({
        ...task,
        patientName: patients.get(task.patientId) ?? task.patientId,
        coordinatorName: task.assignedCoordinatorId
          ? (coordinators.get(task.assignedCoordinatorId) ?? null)
          : null,
      })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: data.length,
      totalPages: Math.ceil(data.length / query.pageSize),
    },
  };
}
function list(request: Request, patientId?: string) {
  const raw = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = taskFiltersSchema.safeParse({
    ...raw,
    today: raw.today ?? localCalendarDate(),
    ...(patientId ? { patientId } : {}),
  });
  if (!parsed.success)
    return error(
      400,
      'INVALID_REQUEST',
      'Invalid task filters or due-date range.',
    );
  if (
    patientId &&
    !mockDatabase.patients.some((patient) => patient.id === patientId)
  )
    return error(404, 'NOT_FOUND', 'Patient not found.');
  return HttpResponse.json(queryTasks(parsed.data));
}
function nextTimestamp(task?: CareTask) {
  return new Date(
    Math.max(Date.now(), task ? Date.parse(task.updatedAt) + 1 : 0),
  ).toISOString();
}
export const taskHandlers = [
  http.get('/api/tasks/summary', ({ request }) => {
    const today =
      new URL(request.url).searchParams.get('today') ?? localCalendarDate();
    const parsed = taskFiltersSchema.safeParse({ today });
    if (!parsed.success)
      return error(400, 'INVALID_REQUEST', 'Invalid local calendar date.');
    const open = mockDatabase.tasks.filter(isOpenTask);
    return HttpResponse.json({
      open: open.length,
      overdue: open.filter((task) => taskTiming(task, today) === 'overdue')
        .length,
      upcoming: open.filter((task) => taskTiming(task, today) === 'upcoming')
        .length,
      highPriority: open.filter(
        (task) => task.priority === 'high' || task.priority === 'urgent',
      ).length,
      completed: mockDatabase.tasks.filter(
        (task) => task.status === 'completed',
      ).length,
    });
  }),
  http.get('/api/tasks', ({ request }) => list(request)),
  http.get('/api/patients/:patientId/tasks', ({ request, params }) =>
    list(request, String(params.patientId)),
  ),
  http.get('/api/tasks/:taskId', ({ params }) => {
    const task = mockDatabase.tasks.find((task) => task.id === params.taskId);
    return task
      ? HttpResponse.json(task)
      : error(404, 'NOT_FOUND', 'Task not found.');
  }),
  http.post('/api/tasks', async ({ request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error(400, 'INVALID_REQUEST', 'Invalid JSON body.');
    }
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success)
      return error(
        400,
        'INVALID_REQUEST',
        parsed.error.issues[0]?.message ?? 'Invalid task.',
      );
    const value = parsed.data,
      invalid = references(value);
    if (invalid) return error(400, 'INVALID_REQUEST', invalid);
    const requestId = request.headers.get('Idempotency-Key');
    if (!requestId || requestId.length > 100)
      return error(
        400,
        'INVALID_REQUEST',
        'A bounded idempotency key is required.',
      );
    const signature = JSON.stringify(value),
      previous = mockDatabase.taskRequests.get(requestId);
    if (previous) {
      if (previous.signature !== signature)
        return error(
          409,
          'CONFLICT',
          'This request key already belongs to different task data.',
        );
      return HttpResponse.json(
        mockDatabase.tasks.find((task) => task.id === previous.taskId),
      );
    }
    if (
      value.source?.screening &&
      mockDatabase.tasks.some(
        (task) =>
          isOpenTask(task) &&
          task.patientId === value.patientId &&
          task.source?.programId === value.source?.programId &&
          task.source?.missingField === value.source?.missingField &&
          task.source?.screening?.policyVersion ===
            value.source?.screening?.policyVersion &&
          task.source?.screening?.evaluationDate ===
            value.source?.screening?.evaluationDate,
      )
    )
      return error(
        409,
        'CONFLICT',
        'An open follow-up already exists for this patient, program, field and screening context. Review their tasks before creating another.',
      );
    const now = nextTimestamp();
    if (
      value.source?.coverageId &&
      mockDatabase.tasks.some(
        (task) =>
          isOpenTask(task) &&
          task.patientId === value.patientId &&
          task.source?.coverageId === value.source?.coverageId &&
          task.source?.renewalDueDate === value.source?.renewalDueDate,
      )
    )
      return error(
        409,
        'CONFLICT',
        'An open renewal follow-up already exists for this coverage record and deadline.',
      );
    const task = taskSchema.parse({
      ...value,
      id: 'task-' + crypto.randomUUID(),
      status: 'todo',
      completedAt: null,
      completionNote: '',
      createdAt: now,
      updatedAt: now,
    });
    mockDatabase.tasks.push(task);
    mockDatabase.taskRequests.set(requestId, { signature, taskId: task.id });
    return HttpResponse.json(task, { status: 201 });
  }),
  http.patch('/api/tasks/:taskId', async ({ request, params }) => {
    const index = mockDatabase.tasks.findIndex(
        (task) => task.id === params.taskId,
      ),
      task = mockDatabase.tasks[index];
    if (!task) return error(404, 'NOT_FOUND', 'Task not found.');
    if (request.headers.get('If-Match') !== JSON.stringify(task.updatedAt))
      return error(
        409,
        'CONFLICT',
        'This task changed. Close the editor and reload the task before saving. Your draft is preserved.',
      );
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error(400, 'INVALID_REQUEST', 'Invalid JSON body.');
    }
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success)
      return error(
        400,
        'INVALID_REQUEST',
        parsed.error.issues[0]?.message ?? 'Invalid update.',
      );
    const { status, completionNote, ...fields } = parsed.data;
    const base = taskSchema.parse({ ...task, ...fields });
    const invalid = references(base);
    if (invalid) return error(400, 'INVALID_REQUEST', invalid);
    if (status === task.status && completionNote !== undefined)
      return error(
        400,
        'INVALID_REQUEST',
        'Completion must be a new transition.',
      );
    if (
      status &&
      status !== task.status &&
      !transitions[task.status].includes(status)
    )
      return error(
        400,
        'INVALID_REQUEST',
        'This task status transition is not allowed.',
      );
    const now = nextTimestamp(task),
      updated =
        status && status !== task.status
          ? transitionTask(base, status, now, completionNote)
          : taskSchema.parse({ ...task, ...fields, updatedAt: now });
    mockDatabase.tasks[index] = updated;
    return HttpResponse.json(updated);
  }),
  http.delete('/api/tasks/:taskId', ({ request, params }) => {
    const index = mockDatabase.tasks.findIndex(
        (task) => task.id === params.taskId,
      ),
      task = mockDatabase.tasks[index];
    if (!task) return error(404, 'NOT_FOUND', 'Task not found.');
    if (request.headers.get('If-Match') !== JSON.stringify(task.updatedAt))
      return error(
        409,
        'CONFLICT',
        'This task changed. Reload before cancelling.',
      );
    if (!transitions[task.status].includes('cancelled'))
      return error(400, 'INVALID_REQUEST', 'Only open tasks can be cancelled.');
    const updated = transitionTask(task, 'cancelled', nextTimestamp(task));
    mockDatabase.tasks[index] = updated;
    return HttpResponse.json(updated);
  }),
];
