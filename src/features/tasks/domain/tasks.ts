import { z } from 'zod';
import { isCalendarDate } from '../../patients/domain/dates';
import { fieldSchema } from '../../eligibility/domain/schemas';
export const taskTypes = [
  'documentation',
  'eligibility_follow_up',
  'patient_outreach',
  'coverage_renewal',
  'general',
] as const;
export const taskStatuses = [
  'todo',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
] as const;
export const taskPriorities = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export const taskLabels: Record<string, string> = {
  documentation: 'Documentation',
  eligibility_follow_up: 'Eligibility follow-up',
  patient_outreach: 'Patient outreach',
  coverage_renewal: 'Coverage renewal',
  general: 'General',
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};
const id = z.string().trim().min(1).max(100);
export const dateSchema = z
  .string()
  .refine(isCalendarDate, 'Enter a valid calendar date');
const timestamp = z.iso.datetime({ offset: false });
export const completionNoteSchema = z.string().trim().max(2000);
export const taskSourceSchema = z
  .strictObject({
    patientId: id.optional(),
    programId: id.optional(),
    coverageEventId: id.optional(),
    coverageId: id.optional(),
    renewalDueDate: dateSchema.optional(),
    missingField: fieldSchema.optional(),
    screening: z
      .strictObject({ policyVersion: id, evaluationDate: dateSchema })
      .optional(),
  })
  .refine(
    (source) => Object.keys(source).length > 0,
    'Provide a source reference',
  )
  .refine(
    (source) =>
      (!source.screening && !source.missingField) || !!source.programId,
    'Screening and missing fields require a program',
  )
  .refine(
    (source) => !source.renewalDueDate || !!source.coverageId,
    'Renewal deadline references require coverage',
  );
const editable = {
  title: z.string().trim().min(1, 'Task title is required').max(160),
  description: z.string().trim().max(3000),
  type: z.enum(taskTypes),
  priority: z.enum(taskPriorities),
  assignedCoordinatorId: id.nullable(),
  dueDate: dateSchema.nullable(),
};
export const createTaskSchema = z.strictObject({
  ...editable,
  description: editable.description.default(''),
  assignedCoordinatorId: editable.assignedCoordinatorId.default(null),
  dueDate: editable.dueDate.default(null),
  patientId: id,
  source: taskSourceSchema.optional(),
});
export const updateTaskSchema = z
  .strictObject({
    title: editable.title.optional(),
    description: editable.description.optional(),
    type: editable.type.optional(),
    priority: editable.priority.optional(),
    assignedCoordinatorId: editable.assignedCoordinatorId.optional(),
    dueDate: editable.dueDate.optional(),
    status: z.enum(taskStatuses).optional(),
    completionNote: completionNoteSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide a task update')
  .refine(
    (value) =>
      value.completionNote === undefined || value.status === 'completed',
    'Completion notes require completion',
  );
export const taskSchema = z
  .strictObject({
    ...editable,
    id,
    patientId: id,
    status: z.enum(taskStatuses),
    source: taskSourceSchema.optional(),
    completedAt: timestamp.nullable(),
    completionNote: completionNoteSchema,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine(
    (task) =>
      task.status === 'completed'
        ? task.completedAt !== null
        : task.completedAt === null && task.completionNote === '',
    'Completion data must match task status',
  );
export type CareTask = z.infer<typeof taskSchema>;
export type CreateTask = z.input<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['in_progress', 'blocked', 'completed', 'cancelled'],
  in_progress: ['blocked', 'completed', 'cancelled'],
  blocked: ['in_progress', 'completed', 'cancelled'],
  completed: ['in_progress'],
  cancelled: ['todo'],
};
export function transitionTask(
  task: CareTask,
  status: TaskStatus,
  now: string,
  completionNote = '',
): CareTask {
  if (!transitions[task.status].includes(status))
    throw new Error(
      `Cannot change ${taskLabels[task.status]} to ${taskLabels[status]}.`,
    );
  return taskSchema.parse({
    ...task,
    status,
    updatedAt: now,
    completedAt: status === 'completed' ? now : null,
    completionNote: status === 'completed' ? completionNote : '',
  });
}
export function localCalendarDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function addCalendarDays(date: string, days: number) {
  dateSchema.parse(date);
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function isOpenTask(task: Pick<CareTask, 'status'>) {
  return task.status !== 'completed' && task.status !== 'cancelled';
}
export function taskTiming(
  task: Pick<CareTask, 'status' | 'dueDate'>,
  today: string,
) {
  dateSchema.parse(today);
  return !isOpenTask(task) || !task.dueDate
    ? 'none'
    : task.dueDate < today
      ? 'overdue'
      : task.dueDate <= addCalendarDays(today, 7)
        ? 'upcoming'
        : 'later';
}
export const taskFiltersSchema = z
  .strictObject({
    search: z.string().trim().max(160).default(''),
    status: z.enum(['open', 'all', ...taskStatuses]).default('open'),
    priority: z.enum(['all', ...taskPriorities]).default('all'),
    type: z.enum(['all', ...taskTypes]).default('all'),
    coordinatorId: z.string().max(100).default(''),
    patientId: z.string().max(100).default(''),
    coverageId: z.string().max(100).default(''),
    dueFrom: dateSchema.optional(),
    dueTo: dateSchema.optional(),
    timing: z.enum(['all', 'overdue', 'upcoming']).default('all'),
    today: dateSchema,
    sortBy: z
      .enum(['dueDate', 'priority', 'updatedAt', 'completedAt'])
      .default('dueDate'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .refine(
    (filter) =>
      !filter.dueFrom || !filter.dueTo || filter.dueFrom <= filter.dueTo,
    'Due-date range is reversed',
  );
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export const taskListSchema = z.strictObject({
  data: z.array(
    taskSchema.safeExtend({
      patientName: z.string(),
      coordinatorName: z.string().nullable(),
    }),
  ),
  pagination: z.strictObject({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export const taskOverviewSchema = z.strictObject({
  open: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  upcoming: z.number().int().nonnegative(),
  highPriority: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});
