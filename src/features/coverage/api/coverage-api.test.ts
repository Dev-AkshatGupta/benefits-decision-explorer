import { describe, it, expect } from 'vitest';
import {
  getCoverage,
  getCoverageRecord,
  getPatientPeriods,
  getCoverageOverview,
  getCoverageEvents,
  createCoverage,
  updateCoverage,
  addCoverageEvent,
} from './coverage-api';
import {
  coverageFiltersSchema,
  coverageStatus,
  renewalUrgency,
  detectCoverageGaps,
  type CreateCoverage,
} from '../domain/coverage';
import { mockDatabase, resetMockDatabase } from '@/mocks/data/database';
import { createTask, updateTask } from '../../tasks/api/tasks-api';
const filters = coverageFiltersSchema.parse({ date: '2026-10-09' });
const value: CreateCoverage = {
  patientId: 'patient-149',
  programId: 'demo-health',
  startDate: '2026-10-01',
  endDate: '2027-01-01',
  renewalDueDate: '2026-10-20',
};
describe('coverage APIs', () => {
  it('exposes undated pending renewals explicitly when requesting missing deadlines', async () => {
    const result = await getCoverage(
      { ...filters, urgency: 'none' },
      undefined,
      undefined,
      true,
    );
    expect(result.data.length).toBeGreaterThan(0);
    expect(
      result.data.every(
        (record) =>
          record.renewalDueDate === null &&
          record.renewalStatus !== 'completed',
      ),
    ).toBe(true);
  });
  it('lists all 260 periods with server pagination and accurate full-population metrics', async () => {
    const list = await getCoverage(filters);
    expect(list.pagination.totalItems).toBe(260);
    expect(list.data).toHaveLength(10);
    const stats = await getCoverageOverview(filters.date);
    expect(stats.activePatients).toBe(
      new Set(
        mockDatabase.coverage
          .filter((record) => coverageStatus(record, filters.date) === 'active')
          .map((record) => record.patientId),
      ).size,
    );
    expect(stats.gapPatients).toBe(
      new Set(
        detectCoverageGaps(mockDatabase.coverage, filters.date).map(
          (gap) => gap.patientId,
        ),
      ).size,
    );
    expect(stats.expiringRecords).toBeGreaterThan(0);
  });
  it('searches patient names, filters programs/stages/urgency and sorts dates', async () => {
    const results = await getCoverage({ ...filters, search: 'Avery Alden' });
    expect(results.data).toHaveLength(2);
    expect(
      results.data.every((record) => record.patientId === 'patient-001'),
    ).toBe(true);
    const renewals = await getCoverage(
      {
        ...filters,
        urgency: 'urgent',
        sortBy: 'renewalDueDate',
        sortOrder: 'asc',
      },
      undefined,
      undefined,
      true,
    );
    expect(renewals.data.length).toBeGreaterThan(0);
    expect(
      renewals.data.every((record) =>
        ['overdue', 'due_today', 'due_soon'].includes(
          renewalUrgency(record, filters.date),
        ),
      ),
    ).toBe(true);
    const dates = renewals.data.map((record) => record.renewalDueDate!);
    expect(dates).toEqual([...dates].sort());
    const second = await getCoverage({ ...filters, page: 2 });
    expect(second.data[0]?.id).not.toBe(
      (await getCoverage(filters)).data[0]?.id,
    );
  });
  it('retrieves all patient periods, distinguishes no recorded coverage and missing patients', async () => {
    expect(await getPatientPeriods('patient-001')).toHaveLength(2);
    expect(await getPatientPeriods('patient-150')).toEqual([]);
    await expect(getPatientPeriods('missing')).rejects.toThrow(/not found/);
    await expect(getCoverageRecord('renewals')).rejects.toThrow();
  });
  it('creates explicitly and returns one record when replaying the same request', async () => {
    const created = await createCoverage(value, 'new-period'),
      replay = await createCoverage(value, 'new-period');
    expect(replay.id).toBe(created.id);
    expect(mockDatabase.coverage).toHaveLength(261);
    expect(await getCoverageEvents(created.id)).toEqual([]);
    await expect(createCoverage(value, 'another-key')).rejects.toThrow(
      /already recorded/,
    );
  });
  it('rejects unsupported program/patient references and conflicting or invalid date edits', async () => {
    await expect(
      createCoverage({ ...value, patientId: 'missing' }, 'missing'),
    ).rejects.toThrow(/does not exist/);
    await expect(
      createCoverage({ ...value, programId: 'real-program' }, 'real'),
    ).rejects.toThrow(/does not exist/);
    const created = await createCoverage(value, 'editing');
    await expect(
      updateCoverage(created.id, { endDate: '2025-01-01' }, created.updatedAt),
    ).rejects.toThrow(/precede/);
    const changed = await updateCoverage(
      created.id,
      { notes: 'Changed note' },
      created.updatedAt,
    );
    expect(changed.notes).toBe('Changed note');
    await expect(
      updateCoverage(created.id, { notes: 'Stale' }, created.updatedAt),
    ).rejects.toThrow(/changed/);
  });
  it('validates renewal transitions without extending coverage or inventing events', async () => {
    let record = await createCoverage(value, 'renewal');
    await expect(
      updateCoverage(
        record.id,
        { renewalStatus: 'completed' },
        record.updatedAt,
      ),
    ).rejects.toThrow(/not allowed/);
    for (const renewalStatus of [
      'in_progress',
      'submitted',
      'completed',
    ] as const)
      record = await updateCoverage(
        record.id,
        { renewalStatus },
        record.updatedAt,
      );
    expect(record.endDate).toBe(value.endDate);
    expect(await getCoverageEvents(record.id)).toEqual([]);
    expect(renewalUrgency(record, filters.date)).toBe('completed');
  });
  it('records ordered, idempotent events separately from coverage state', async () => {
    const record = await createCoverage(value, 'event-period');
    const event = await addCoverageEvent(
      record.id,
      {
        type: 'note_added',
        eventDate: '2026-10-09',
        description: 'Synthetic observation',
      },
      'event-key',
    );
    expect(
      await addCoverageEvent(
        record.id,
        {
          type: 'note_added',
          eventDate: '2026-10-09',
          description: 'Synthetic observation',
        },
        'event-key',
      ),
    ).toEqual(event);
    await addCoverageEvent(
      record.id,
      {
        type: 'renewal_submitted',
        eventDate: '2026-10-01',
        description: 'Recorded submission event only',
      },
      'earlier',
    );
    expect(
      (await getCoverageEvents(record.id)).map((event) => event.eventDate),
    ).toEqual(['2026-10-01', '2026-10-09']);
    expect(await getCoverageRecord(record.id)).toEqual(record);
  });
  it('links reviewed renewal tasks, deduplicates cycles, and keeps completion independent', async () => {
    const record = await createCoverage(value, 'task-period');
    const taskValue = {
      patientId: record.patientId,
      title: 'Review renewal',
      type: 'coverage_renewal' as const,
      priority: 'high' as const,
      dueDate: record.renewalDueDate,
      source: {
        patientId: record.patientId,
        programId: record.programId,
        coverageId: record.id,
        renewalDueDate: record.renewalDueDate!,
      },
    };
    const task = await createTask(taskValue, 'renewal-task');
    await expect(createTask(taskValue, 'duplicate-task')).rejects.toThrow(
      /already exists/,
    );
    await updateTask(task.id, { status: 'completed' }, task.updatedAt);
    expect(await getCoverageRecord(record.id)).toEqual(record);
    await expect(
      createTask(
        { ...taskValue, source: { coverageId: 'missing' } },
        'bad-source',
      ),
    ).rejects.toThrow(/does not match/);
  });
  it('resets coverage, events and request metadata with the repository', async () => {
    await createCoverage(value, 'reset');
    resetMockDatabase();
    expect(mockDatabase.coverage).toHaveLength(260);
    expect(mockDatabase.coverageRequests.size).toBe(0);
    expect(mockDatabase.coverageEvents.length).toBeGreaterThan(260);
  });
});
