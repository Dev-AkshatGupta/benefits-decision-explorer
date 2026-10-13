import { describe, it, expect } from 'vitest';
import { mockDatabase } from '@/mocks/data/database';
import {
  createTask,
  getTasks,
  getTask,
  getTaskOverview,
  updateTask,
  cancelTask,
} from './tasks-api';
import type { CreateTask } from '../domain/tasks';
const today = '2026-10-09';
const value: CreateTask = {
  patientId: 'patient-001',
  title: 'Review synthetic documents',
  description: 'Synthetic only',
  type: 'documentation',
  priority: 'urgent',
  assignedCoordinatorId: 'coordinator-001',
  dueDate: '2026-10-08',
};
describe('task API', () => {
  it('orders recent completion by completedAt instead of later edits to old completed tasks', async () => {
    const created = await createTask(value, 'recent-completion');
    const completed = await updateTask(
      created.id,
      { status: 'completed' },
      created.updatedAt,
    );
    const older = mockDatabase.tasks.find(
      (task) => task.status === 'completed' && task.id !== completed.id,
    )!;
    await updateTask(
      older.id,
      { title: 'Later edit to an older completion' },
      older.updatedAt,
    );
    const result = await getTasks({
      today,
      status: 'completed',
      sortBy: 'completedAt',
      sortOrder: 'desc',
    });
    expect(result.data[0]?.id).toBe(completed.id);
  });
  it('orders due dates in both directions, keeps undated tasks last, and sorts priority/updates', async () => {
    for (const sortOrder of ['asc', 'desc'] as const) {
      const response = await getTasks({
        today,
        status: 'all',
        sortBy: 'dueDate',
        sortOrder,
        pageSize: 100,
      });
      const dates = response.data
        .map((task) => task.dueDate)
        .filter((date): date is string => date !== null);
      expect(dates).toEqual(
        [...dates].sort((a, b) =>
          sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a),
        ),
      );
      expect(
        (
          await getTasks({
            today,
            status: 'all',
            sortBy: 'dueDate',
            sortOrder,
            page: 3,
            pageSize: 100,
          })
        ).data.at(-1)?.dueDate,
      ).toBeNull();
    }
    const priorities = (
      await getTasks({
        today,
        status: 'all',
        sortBy: 'priority',
        sortOrder: 'desc',
        pageSize: 100,
      })
    ).data.map((task) =>
      ['low', 'medium', 'high', 'urgent'].indexOf(task.priority),
    );
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
    const created = await createTask(
      {
        patientId: value.patientId,
        title: 'Most recently updated task',
        type: 'general',
        priority: 'low',
      },
      'newest-request',
    );
    expect(
      (
        await getTasks({
          today,
          status: 'all',
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        })
      ).data[0]?.id,
    ).toBe(created.id);
  });
  it('paginates and filters full server population with accurate aggregates', async () => {
    const result = await getTasks({ today });
    expect(result.data).toHaveLength(10);
    expect(result.pagination.totalItems).toBe(150);
    const stats = await getTaskOverview(today);
    expect(stats.open).toBe(150);
    expect(stats.completed).toBe(50);
    expect(stats.overdue).toBeGreaterThan(0);
    const second = await getTasks({ today, page: 2 });
    expect(second.data[0]?.id).not.toBe(result.data[0]?.id);
  });
  it('searches task titles and patient names, filters, and sorts', async () => {
    const name =
      mockDatabase.patients[0]!.firstName +
      ' ' +
      mockDatabase.patients[0]!.lastName;
    expect(
      (await getTasks({ today, search: name, status: 'all' })).data.every(
        (task) => task.patientName.includes(name),
      ),
    ).toBe(true);
    const list = await getTasks({
      today,
      priority: 'urgent',
      type: 'documentation',
      status: 'all',
      sortBy: 'priority',
      sortOrder: 'desc',
    });
    expect(
      list.data.every(
        (task) => task.priority === 'urgent' && task.type === 'documentation',
      ),
    ).toBe(true);
    const overdue = await getTasks({ today, timing: 'overdue' });
    expect(overdue.data.every((task) => task.dueDate! < today)).toBe(true);
  });
  it('rejects invalid patient/coordinator references and immutable updates', async () => {
    await expect(
      createTask({ ...value, patientId: 'no-patient' }, 'bad-patient'),
    ).rejects.toThrow(/Patient/);
    await expect(
      createTask(
        { ...value, assignedCoordinatorId: 'no-coordinator' },
        'bad-coordinator',
      ),
    ).rejects.toThrow(/Coordinator/);
    await expect(
      createTask(
        { ...value, source: { patientId: 'patient-002' } },
        'bad-source',
      ),
    ).rejects.toThrow(/match/);
  });
  it('creates, returns the same record on replay, rejects changed payload on the same request key', async () => {
    const task = await createTask(value, 'create-request');
    const replay = await createTask(value, 'create-request');
    expect(task.id).toBe(replay.id);
    expect(mockDatabase.tasks).toHaveLength(251);
    await expect(
      createTask({ ...value, title: 'Different' }, 'create-request'),
    ).rejects.toThrow(/different/);
  });
  it('edits and enforces concurrent-write protection', async () => {
    const task = await createTask(value, 'edit-request'),
      updated = await updateTask(
        task.id,
        { title: 'New title' },
        task.updatedAt,
      );
    expect(updated.title).toBe('New title');
    await expect(
      updateTask(task.id, { priority: 'low' }, task.updatedAt),
    ).rejects.toThrow(/changed/);
    expect((await getTask(task.id)).priority).toBe('urgent');
  });
  it('completes/reopens and synchronizes summary metrics without changing patients', async () => {
    const patients = structuredClone(mockDatabase.patients),
      task = await createTask(value, 'complete-request'),
      previous = await getTaskOverview(today);
    const completed = await updateTask(
      task.id,
      { status: 'completed', completionNote: 'Received fictional documents.' },
      task.updatedAt,
    );
    expect(completed.completedAt).not.toBeNull();
    const next = await getTaskOverview(today);
    expect(next.completed).toBe(previous.completed + 1);
    expect(next.open).toBe(previous.open - 1);
    expect(next.overdue).toBe(previous.overdue - 1);
    const reopened = await updateTask(
      task.id,
      { status: 'in_progress' },
      completed.updatedAt,
    );
    expect(reopened).toMatchObject({ completedAt: null, completionNote: '' });
    expect(mockDatabase.patients).toEqual(patients);
  });
  it('cancels softly and rejects invalid transitions', async () => {
    const task = await createTask(value, 'cancel-request');
    const cancelled = await cancelTask(task.id, task.updatedAt);
    expect(cancelled.status).toBe('cancelled');
    expect(await getTask(task.id)).toEqual(cancelled);
    await expect(
      updateTask(task.id, { status: 'completed' }, cancelled.updatedAt),
    ).rejects.toThrow(/not allowed/);
    const restored = await updateTask(
      task.id,
      { status: 'todo' },
      cancelled.updatedAt,
    );
    expect(restored.status).toBe('todo');
  });
  it('returns patient-specific tasks and missing record errors', async () => {
    const result = await getTasks(
      { today, status: 'all' },
      undefined,
      'patient-001',
    );
    expect(result.data.every((task) => task.patientId === 'patient-001')).toBe(
      true,
    );
    await expect(getTask('missing-task')).rejects.toThrow(/not found/);
    await expect(
      getTasks({ today }, undefined, 'missing-patient'),
    ).rejects.toThrow(/not found/);
  });
  it('deduplicates open eligibility follow-ups by real screening context', async () => {
    const input: CreateTask = {
      ...value,
      type: 'eligibility_follow_up',
      source: {
        patientId: value.patientId,
        programId: 'demo-health',
        missingField: 'annualHouseholdIncomeCents',
        screening: { policyVersion: '2026.1', evaluationDate: today },
      },
    };
    await createTask(input, 'screening-one');
    await expect(createTask(input, 'screening-two')).rejects.toThrow(
      /already exists/,
    );
    expect(mockDatabase.tasks).toHaveLength(251);
    await expect(
      createTask(
        { ...input, source: { programId: 'real-benefit' } },
        'real-program',
      ),
    ).rejects.toThrow(/does not exist/);
  });
});
