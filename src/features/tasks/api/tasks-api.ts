import { requestJson } from '@/lib/api/client';
import {
  taskSchema,
  taskListSchema,
  taskOverviewSchema,
  taskFiltersSchema,
  createTaskSchema,
  updateTaskSchema,
  type TaskFilters,
  type CreateTask,
  type UpdateTask,
} from '../domain/tasks';
export function getTasks(
  filters: Partial<TaskFilters> & Pick<TaskFilters, 'today'>,
  signal?: AbortSignal,
  patientId?: string,
) {
  const query = new URLSearchParams();
  Object.entries(taskFiltersSchema.parse(filters)).forEach(([key, value]) =>
    query.set(key, String(value)),
  );
  return requestJson(
    (patientId
      ? '/api/patients/' + encodeURIComponent(patientId) + '/tasks'
      : '/api/tasks') +
      '?' +
      query,
    taskListSchema,
    signal ? { signal } : {},
  );
}
export function getTask(id: string, signal?: AbortSignal) {
  return requestJson(
    '/api/tasks/' + encodeURIComponent(id),
    taskSchema,
    signal ? { signal } : {},
  );
}
export function getTaskOverview(today: string, signal?: AbortSignal) {
  return requestJson(
    '/api/tasks/summary?today=' + encodeURIComponent(today),
    taskOverviewSchema,
    signal ? { signal } : {},
  );
}
export function createTask(value: CreateTask, requestId: string) {
  return requestJson('/api/tasks', taskSchema, {
    method: 'POST',
    headers: { 'Idempotency-Key': requestId },
    body: JSON.stringify(createTaskSchema.parse(value)),
  });
}
export function updateTask(
  id: string,
  patch: UpdateTask,
  expectedUpdatedAt: string,
) {
  return requestJson('/api/tasks/' + encodeURIComponent(id), taskSchema, {
    method: 'PATCH',
    headers: { 'If-Match': JSON.stringify(expectedUpdatedAt) },
    body: JSON.stringify(updateTaskSchema.parse(patch)),
  });
}
export function cancelTask(id: string, expectedUpdatedAt: string) {
  return requestJson('/api/tasks/' + encodeURIComponent(id), taskSchema, {
    method: 'DELETE',
    headers: { 'If-Match': JSON.stringify(expectedUpdatedAt) },
  });
}
