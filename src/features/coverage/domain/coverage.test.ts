import { describe, it, expect } from 'vitest';
import {
  coverageSchema,
  createCoverageSchema,
  coverageStatus,
  effectiveCoverageEnd,
  detectCoverageGaps,
  daysUntilRenewal,
  renewalUrgency,
  renewalStages,
  renewalTransitions,
  validateRenewalTransition,
  createEventSchema,
  type CoverageRecord,
} from './coverage';
const record = (fields: Partial<CoverageRecord> = {}): CoverageRecord =>
  coverageSchema.parse({
    id: 'period-1',
    patientId: 'patient-001',
    programId: 'demo-health',
    programName: 'Demo Health (Fictional)',
    startDate: '2026-01-01',
    endDate: '2026-10-09',
    terminatedAt: null,
    renewalDueDate: '2026-10-20',
    renewalStatus: 'not_started',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...fields,
  });
describe('coverage calendar semantics', () => {
  it('keeps punctuation-bearing patient/program tuples separate when detecting gaps', () => {
    const periods = [
      record({
        patientId: 'patient|one',
        programId: 'program',
        endDate: '2026-01-31',
      }),
      record({
        id: 'period-2',
        patientId: 'patient',
        programId: 'one|program',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      }),
    ];
    expect(detectCoverageGaps(periods, '2026-10-09')).toEqual([]);
  });
  it.each([
    ['2025-12-31', 'upcoming'],
    ['2026-01-01', 'active'],
    ['2026-10-09', 'active'],
    ['2026-10-10', 'expired'],
  ] as const)('classifies inclusive period on %s', (date, status) =>
    expect(coverageStatus(record(), date)).toBe(status),
  );
  it('handles open periods and excludes the day of termination', () => {
    expect(coverageStatus(record({ endDate: null }), '2027-01-01')).toBe(
      'active',
    );
    const ended = record({ terminatedAt: '2026-10-09' });
    expect(coverageStatus(ended, '2026-10-08')).toBe('active');
    expect(coverageStatus(ended, '2026-10-09')).toBe('terminated');
    expect(effectiveCoverageEnd(ended)).toBe('2026-10-08');
    expect(
      coverageStatus(record({ terminatedAt: '2026-12-01' }), '2026-12-02'),
    ).toBe('expired');
  });
  it('rejects invalid periods, dates and event references', () => {
    expect(() => record({ endDate: '2025-12-31' })).toThrow();
    expect(() => record({ terminatedAt: '2025-12-31' })).toThrow();
    expect(() => coverageStatus(record(), '2026-02-30')).toThrow();
    expect(
      createCoverageSchema.safeParse({
        patientId: 'patient-001',
        programId: 'demo-health',
        startDate: '2026-02-30',
      }).success,
    ).toBe(false);
    expect(
      createEventSchema.safeParse({
        type: 'invented',
        eventDate: '2026-01-01',
        description: 'Event',
      }).success,
    ).toBe(false);
  });
});
describe('bounded program-specific recorded gaps', () => {
  const one = record({
    id: 'a',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  });
  it('merges overlapping/adjacent intervals without mutating records', () => {
    const records = [
      record({ id: 'c', startDate: '2026-02-01', endDate: '2026-03-01' }),
      one,
      record({ id: 'b', startDate: '2026-01-10', endDate: '2026-01-15' }),
    ];
    const before = structuredClone(records);
    expect(detectCoverageGaps(records, '2026-10-09')).toEqual([]);
    expect(records).toEqual(before);
  });
  it('reports exact uncovered days bounded by two periods', () => {
    const two = record({
      id: 'b',
      startDate: '2026-02-03',
      endDate: '2026-03-01',
    });
    expect(detectCoverageGaps([two, one], '2026-10-09')).toEqual([
      {
        patientId: 'patient-001',
        programId: 'demo-health',
        startDate: '2026-02-01',
        endDate: '2026-02-02',
      },
    ]);
  });
  it('does not use another program/patient to eliminate or invent gaps', () => {
    const two = record({ id: 'b', startDate: '2026-02-03', endDate: null });
    const other = record({
      id: 'c',
      programId: 'demo-nutrition',
      startDate: '2026-02-01',
      endDate: null,
    });
    expect(detectCoverageGaps([one, two, other], '2026-10-09')).toHaveLength(1);
    expect(
      detectCoverageGaps(
        [one, { ...two, patientId: 'patient-002' }],
        '2026-10-09',
      ),
    ).toEqual([]);
  });
  it('respects termination, open ends and immediately terminated zero-day periods', () => {
    const terminated = record({ endDate: null, terminatedAt: '2026-01-20' }),
      resumed = record({ id: 'b', startDate: '2026-02-01', endDate: null });
    expect(
      detectCoverageGaps([terminated, resumed], '2026-10-09')[0],
    ).toMatchObject({ startDate: '2026-01-20', endDate: '2026-01-31' });
    expect(
      detectCoverageGaps([record({ endDate: null }), resumed], '2026-10-09'),
    ).toEqual([]);
    expect(
      detectCoverageGaps(
        [record({ terminatedAt: '2026-01-01' }), resumed],
        '2026-10-09',
      ),
    ).toEqual([]);
  });
  it('never asserts lack of coverage before/after known records or from future periods', () => {
    expect(detectCoverageGaps([], '2026-10-09')).toEqual([]);
    expect(detectCoverageGaps([one], '2026-10-09')).toEqual([]);
    expect(
      detectCoverageGaps(
        [one, record({ id: 'future', startDate: '2026-11-01', endDate: null })],
        '2026-10-09',
      ),
    ).toEqual([]);
  });
});
describe('renewals are independent of coverage', () => {
  it.each([
    ['2026-10-08', 'overdue'],
    ['2026-10-09', 'due_today'],
    ['2026-11-08', 'due_soon'],
    ['2026-11-09', 'later'],
    [null, 'none'],
  ] as const)('classifies deadline %s', (renewalDueDate, expected) =>
    expect(renewalUrgency(record({ renewalDueDate }), '2026-10-09')).toBe(
      expected,
    ),
  );
  it('excludes completed renewals even without a deadline and preserves active coverage when overdue', () => {
    expect(
      renewalUrgency(
        record({ renewalStatus: 'completed', renewalDueDate: '2025-01-01' }),
        '2026-10-09',
      ),
    ).toBe('completed');
    expect(
      renewalUrgency(
        record({ renewalStatus: 'completed', renewalDueDate: null }),
        '2026-10-09',
      ),
    ).toBe('completed');
    expect(
      coverageStatus(record({ renewalDueDate: '2025-01-01' }), '2026-10-09'),
    ).toBe('active');
  });
  it('counts calendar days through leap days and year/month boundaries', () => {
    expect(
      daysUntilRenewal(record({ renewalDueDate: '2024-03-01' }), '2024-02-28'),
    ).toBe(2);
    expect(
      daysUntilRenewal(record({ renewalDueDate: '2027-01-01' }), '2026-12-31'),
    ).toBe(1);
    expect(
      daysUntilRenewal(record({ renewalDueDate: null }), '2026-10-09'),
    ).toBeNull();
  });
  it.each(renewalStages)(
    'validates all renewal transitions from %s',
    (before) => {
      for (const after of renewalStages)
        if (before === after || renewalTransitions[before].includes(after))
          expect(() => validateRenewalTransition(before, after)).not.toThrow();
        else expect(() => validateRenewalTransition(before, after)).toThrow();
    },
  );
});
