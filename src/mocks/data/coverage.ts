import {
  coverageSchema,
  eventSchema,
  type CoverageRecord,
  type CoverageEvent,
} from '@/features/coverage/domain/coverage';
import type { Patient } from '@/features/patients/domain/schemas';
import { demoPolicyRegistry } from '@/features/eligibility/policies/registry';
import { addCalendarDays } from '@/features/tasks/domain/tasks';
export function createSyntheticCoverage(patients: readonly Patient[]) {
  const programs = [
    ...new Map(
      demoPolicyRegistry.map((program) => [program.id, program]),
    ).values(),
  ];
  const coverage: CoverageRecord[] = [],
    coverageEvents: CoverageEvent[] = [];
  // 130 patients have two periods; 20 intentionally have no coverage recorded.
  patients.slice(0, 130).forEach((patient, index) => {
    const program = programs[index % programs.length]!;
    const periods = [
      {
        startDate: '2025-01-01',
        endDate: index % 3 === 0 ? '2026-06-30' : '2026-09-30',
        terminatedAt: null,
      },
      {
        startDate:
          index % 6 === 0
            ? '2026-08-01'
            : index % 6 === 1
              ? '2026-09-15'
              : index % 6 === 2
                ? '2026-10-01'
                : index % 6 === 3
                  ? '2026-11-01'
                  : '2026-01-01',
        endDate:
          index % 6 === 4
            ? '2026-08-31'
            : index % 9 === 0
              ? null
              : index % 6 < 3 && index % 4 === 0
                ? addCalendarDays('2026-10-09', 14 + (index % 10))
                : '2027-03-31',
        terminatedAt: index % 6 === 5 ? '2026-09-15' : null,
      },
    ];
    periods.forEach((period, position) => {
      const record = coverageSchema.parse({
        ...period,
        id: 'coverage-' + String(coverage.length + 1).padStart(3, '0'),
        patientId: patient.id,
        programId: program.id,
        programName: program.name,
        renewalDueDate:
          position === 0 || index % 11 === 0
            ? null
            : addCalendarDays('2026-10-09', (index % 71) - 20),
        renewalStatus:
          position === 0
            ? 'completed'
            : (
                [
                  'not_started',
                  'in_progress',
                  'submitted',
                  'completed',
                ] as const
              )[index % 4],
        notes:
          'Synthetic coverage record entered explicitly for demonstration. No insurance verification or enrollment has occurred.',
        createdAt: '2026-01-01T12:00:00.000Z',
        updatedAt: '2026-10-01T12:00:00.000Z',
      });
      coverage.push(record);
      coverageEvents.push(
        eventSchema.parse({
          id:
            'coverage-event-' +
            String(coverageEvents.length + 1).padStart(3, '0'),
          coverageId: record.id,
          patientId: patient.id,
          type: 'coverage_started',
          eventDate: record.startDate,
          description:
            'Fictional recorded period start; not verified enrollment.',
          createdAt: record.createdAt,
        }),
      );
      if (record.renewalDueDate)
        coverageEvents.push(
          eventSchema.parse({
            id:
              'coverage-event-' +
              String(coverageEvents.length + 1).padStart(3, '0'),
            coverageId: record.id,
            patientId: patient.id,
            type: 'renewal_due',
            eventDate: record.renewalDueDate,
            description:
              'Demonstration renewal deadline recorded for coordinator review.',
            createdAt: record.createdAt,
          }),
        );
    });
  });
  return { coverage, coverageEvents };
}
