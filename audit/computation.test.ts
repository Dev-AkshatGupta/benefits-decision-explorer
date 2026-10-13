import { it, expect } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { capturePolicyPopulation } from '@/mocks/data/policy-population';
import { mockDatabase } from '@/mocks/data/database';
import {
  analyzePolicyImpact,
  normalizePopulation,
} from '@/features/policies/domain/population';
import {
  demoFamily2025,
  demoFamily,
} from '@/features/eligibility/policies/demo-programs';
import {
  demoPolicyRegistry,
  selectPoliciesForDate,
  screenPatient,
} from '@/features/eligibility';
import {
  applySimulationOverrides,
  compareEligibilityResults,
} from '@/features/eligibility/simulator/domain/simulation';
import { detectCoverageGaps } from '@/features/coverage/domain/coverage';
import { formatCurrency } from '@/features/patients/domain/income';
import { formatDate, formatTimestamp } from '@/features/patients/domain/dates';
it('records warmed median computational timings without timing gates', async () => {
  const source = capturePolicyPopulation();
  const contexts = normalizePopulation(source.records, '2026-06-15').contexts;
  const context = contexts[10]!;
  const programs = selectPoliciesForDate(demoPolicyRegistry, '2026-06-15');
  const baseline = screenPatient(programs, context);
  const measurements = [];
  for (const [name, operation, batchSize] of [
    [
      'formatTwentyRows',
      () => {
        for (let row = 0; row < 20; row++) {
          formatCurrency(3_500_000 + row);
          formatDate('2026-06-15');
          formatTimestamp('2026-10-09T00:00:00.000Z');
        }
      },
      10,
    ],
    [
      'screening150SourceOnePatientFivePrograms',
      () => screenPatient(programs, context),
      20,
    ],
    [
      'simulationOnePatientFivePrograms',
      () => {
        const next = applySimulationOverrides(context, {
          annualHouseholdIncomeCents: 6_000_000,
        });
        return compareEligibilityResults(
          baseline,
          screenPatient(programs, next),
        );
      },
      20,
    ],
    [
      'population150NormalizedTwoPolicies',
      () => analyzePolicyImpact(contexts, demoFamily2025, demoFamily),
      1,
    ],
    [
      'population150NormalizationAndAnalysis',
      () =>
        analyzePolicyImpact(
          normalizePopulation(source.records, '2026-06-15').contexts,
          demoFamily2025,
          demoFamily,
        ),
      1,
    ],
    [
      'coverageGaps260Records',
      () => detectCoverageGaps(mockDatabase.coverage, '2026-10-09'),
      10,
    ],
  ] as const) {
    for (let i = 0; i < 10; i++) operation();
    const samplesMs = [];
    for (let sample = 0; sample < 31; sample++) {
      const start = performance.now();
      for (let run = 0; run < batchSize; run++) operation();
      samplesMs.push((performance.now() - start) / batchSize);
    }
    measurements.push({
      name,
      warmupRuns: 10,
      sampleCount: 31,
      operationsPerSample: batchSize,
      medianMs: [...samplesMs].sort((a, b) => a - b)[15],
      samplesMs,
    });
  }
  const result = analyzePolicyImpact(contexts, demoFamily2025, demoFamily);
  expect(result.evaluated).toBe(150);
  expect(result.changed + result.unchanged).toBe(150);
  await mkdir('docs/measurements', { recursive: true });
  await writeFile(
    `docs/measurements/computation-${process.env.AUDIT_PHASE ?? 'current'}.json`,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        environment: {
          node: process.version,
          platform: process.platform,
          cpu: cpus()[0]?.model,
        },
        measurements,
        sampleAnalysis: {
          evaluated: result.evaluated,
          changed: result.changed,
          unchanged: result.unchanged,
          errors: result.errors.length,
          matrix: result.matrix,
        },
      },
      null,
      2,
    ) + '\n',
  );
});
