import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTask,
  updateTask,
  cancelTask,
  getTasks,
  getTask,
  getTaskOverview,
} from './tasks-api';
import type {
  TaskFilters,
  CareTask,
  CreateTask,
  UpdateTask,
} from '../domain/tasks';
export const taskKeys = {
  lists: ['tasks', 'lists'] as const,
  patient: (id: string) => ['tasks', 'patients', id] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  overview: ['tasks', 'overview'] as const,
};
export function useTasks(filters: TaskFilters, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...taskKeys.lists, filters],
    queryFn: ({ signal }) => getTasks(filters, signal),
  });
}
export function usePatientTasks(
  id: string,
  filters: Partial<TaskFilters> & Pick<TaskFilters, 'today'>,
) {
  return useQuery({
    queryKey: [...taskKeys.patient(id), filters],
    queryFn: ({ signal }) => getTasks(filters, signal, id),
    enabled: !!id,
  });
}
export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: ({ signal }) => getTask(id, signal),
    enabled: !!id,
  });
}
export function useTaskOverview(today: string) {
  return useQuery({
    queryKey: [...taskKeys.overview, today],
    queryFn: ({ signal }) => getTaskOverview(today, signal),
  });
}
function useTaskSync() {
  const client = useQueryClient();
  return async (task: CareTask) => {
    await client.cancelQueries({ queryKey: taskKeys.detail(task.id) });
    client.setQueryData(taskKeys.detail(task.id), task);
    await Promise.all([
      client.invalidateQueries({ queryKey: taskKeys.lists }),
      client.invalidateQueries({ queryKey: taskKeys.patient(task.patientId) }),
      client.invalidateQueries({ queryKey: taskKeys.overview }),
    ]);
  };
}
export function useCreateTask() {
  const onSuccess = useTaskSync();
  return useMutation({
    mutationFn: ({
      value,
      requestId,
    }: {
      value: CreateTask;
      requestId: string;
    }) => createTask(value, requestId),
    onSuccess,
  });
}
export function useUpdateTask() {
  const onSuccess = useTaskSync();
  return useMutation({
    mutationFn: ({
      id,
      patch,
      expectedUpdatedAt,
    }: {
      id: string;
      patch: UpdateTask;
      expectedUpdatedAt: string;
    }) => updateTask(id, patch, expectedUpdatedAt),
    onSuccess,
  });
}
export function useCancelTask() {
  const onSuccess = useTaskSync();
  return useMutation({
    mutationFn: ({
      id,
      expectedUpdatedAt,
    }: {
      id: string;
      expectedUpdatedAt: string;
    }) => cancelTask(id, expectedUpdatedAt),
    onSuccess,
  });
}
