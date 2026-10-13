import {
  addCalendarDays,
  taskSchema,
  taskTypes,
  taskStatuses,
  taskPriorities,
  type CareTask,
} from '@/features/tasks/domain/tasks';
import type {
  Patient,
  CareCoordinator,
} from '@/features/patients/domain/schemas';
export function createSyntheticTasks(
  patients: readonly Patient[],
  coordinators: readonly CareCoordinator[],
): CareTask[] {
  const titles = [
    'Request household income verification',
    'Follow up on missing documentation',
    'Contact patient about screening information',
    'Review a demonstration coverage renewal',
    'Confirm household details',
  ];
  return Array.from({ length: 250 }, (_, index) => {
    const status = taskStatuses[Math.floor(index / 5) % 5]!;
    return taskSchema.parse({
      id: 'task-' + String(index + 1).padStart(3, '0'),
      patientId: patients[index % patients.length]!.id,
      title: titles[index % 5],
      description:
        'Synthetic care coordination task. No outreach or enrollment is performed by this demonstration.',
      type: taskTypes[index % 5],
      priority: taskPriorities[Math.floor(index / 5) % 4],
      status,
      assignedCoordinatorId:
        index % 7 === 0
          ? null
          : coordinators[Math.floor(index / 3) % coordinators.length]!.id,
      dueDate:
        index % 11 === 0
          ? null
          : addCalendarDays('2026-10-09', (index % 31) - 15),
      completedAt: status === 'completed' ? '2026-10-01T12:00:00.000Z' : null,
      completionNote:
        status === 'completed' ? 'Demonstration review completed.' : '',
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
      source: { patientId: patients[index % patients.length]!.id },
    });
  });
}
