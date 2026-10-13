import { describe, it, expect } from 'vitest';
import {
  taskSchema,
  createTaskSchema,
  updateTaskSchema,
  taskSourceSchema,
  taskFiltersSchema,
  transitions,
  transitionTask,
  taskTiming,
  localCalendarDate,
  addCalendarDays,
  taskStatuses,
} from './tasks';
import { mockDatabase, resetMockDatabase } from '@/mocks/data/database';
const task = () => mockDatabase.tasks[0]!;
describe('task domain and lifecycle', () => {
  it('has 250 deterministic linked fixtures with all statuses and types', () => {
    expect(mockDatabase.tasks).toHaveLength(250);
    for (const value of mockDatabase.tasks) {
      expect(taskSchema.safeParse(value).success).toBe(true);
      expect(
        mockDatabase.patients.some((patient) => patient.id === value.patientId),
      ).toBe(true);
    }
    expect(new Set(mockDatabase.tasks.map((task) => task.status)).size).toBe(5);
  });
  it('validates creation, fields and completion notes', () => {
    const value = {
      patientId: task().patientId,
      title: 'Review household',
      description: '',
      type: 'general',
      priority: 'high',
      assignedCoordinatorId: null,
      dueDate: '2026-10-09',
    };
    expect(createTaskSchema.safeParse(value).success).toBe(true);
    expect(
      createTaskSchema.safeParse({
        ...value,
        title: ' ',
        dueDate: '2026-02-30',
      }).success,
    ).toBe(false);
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.safeParse({ completionNote: 'Done' }).success).toBe(
      false,
    );
    expect(
      updateTaskSchema.safeParse({
        status: 'completed',
        completionNote: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
  });
  it('rejects malformed source references and filters', () => {
    expect(taskSourceSchema.safeParse({}).success).toBe(false);
    expect(
      taskSourceSchema.safeParse({ missingField: 'arbitrary' }).success,
    ).toBe(false);
    expect(taskSourceSchema.safeParse({ missingField: 'age' }).success).toBe(
      false,
    );
    expect(
      taskSourceSchema.safeParse({
        programId: 'demo-health',
        screening: { policyVersion: '2026.1', evaluationDate: 'bad' },
      }).success,
    ).toBe(false);
    expect(
      taskFiltersSchema.safeParse({
        today: '2026-10-09',
        dueFrom: '2026-10-10',
        dueTo: '2026-10-01',
      }).success,
    ).toBe(false);
  });
  it.each(taskStatuses)('validates every transition from %s', (status) => {
    const initial = taskSchema.parse({
      ...task(),
      status,
      completedAt: status === 'completed' ? '2026-10-01T00:00:00.000Z' : null,
      completionNote: status === 'completed' ? 'Previous completion' : '',
    });
    for (const next of taskStatuses) {
      if (transitions[status].includes(next))
        expect(
          transitionTask(initial, next, '2026-10-09T00:00:00.000Z', 'Done')
            .status,
        ).toBe(next);
      else
        expect(() =>
          transitionTask(initial, next, '2026-10-09T00:00:00.000Z'),
        ).toThrow();
    }
  });
  it('completes, reopens and clears completion information without mutation', () => {
    const original = structuredClone(task()),
      completed = transitionTask(
        original,
        'completed',
        '2026-10-09T00:00:00.000Z',
        'Verified',
      );
    expect(completed.completedAt).toBe('2026-10-09T00:00:00.000Z');
    const reopened = transitionTask(
      completed,
      'in_progress',
      '2026-10-10T00:00:00.000Z',
    );
    expect(reopened).toMatchObject({ completedAt: null, completionNote: '' });
    expect(original).toEqual(task());
    expect(
      taskSchema.safeParse({ ...reopened, completedAt: completed.completedAt })
        .success,
    ).toBe(false);
  });
  it.each([
    ['2026-10-08', 'overdue'],
    ['2026-10-09', 'upcoming'],
    ['2026-10-16', 'upcoming'],
    ['2026-10-17', 'later'],
    [null, 'none'],
  ] as const)(
    'classifies due %s using date-only comparisons',
    (dueDate, expected) => {
      expect(taskTiming({ status: 'todo', dueDate }, '2026-10-09')).toBe(
        expected,
      );
    },
  );
  it('never classifies terminal tasks as overdue and handles calendar boundaries', () => {
    expect(
      taskTiming({ status: 'completed', dueDate: '2025-01-01' }, '2026-10-09'),
    ).toBe('none');
    expect(
      taskTiming({ status: 'cancelled', dueDate: '2025-01-01' }, '2026-10-09'),
    ).toBe('none');
    expect(addCalendarDays('2024-02-28', 2)).toBe('2024-03-01');
    expect(addCalendarDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(localCalendarDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
  it('resets task repository and idempotency metadata', () => {
    mockDatabase.tasks.pop();
    mockDatabase.taskRequests.set('example', {
      signature: 'signature',
      taskId: 'task-001',
    });
    resetMockDatabase();
    expect(mockDatabase.tasks).toHaveLength(250);
    expect(mockDatabase.taskRequests.size).toBe(0);
  });
});
