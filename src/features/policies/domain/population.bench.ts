import { bench, describe } from 'vitest';
import { capturePolicyPopulation } from '@/mocks/data/policy-population';
import {
  demoFamily2025,
  demoFamily,
} from '../../eligibility/policies/demo-programs';
import { analyzePolicyImpact, normalizePopulation } from './population';
const source = capturePolicyPopulation();
const population = normalizePopulation(source.records, '2026-06-15').contexts;
const result = analyzePolicyImpact(population, demoFamily2025, demoFamily);
console.log('Synthetic Family 2025.1 → 2026.1, evaluation date 2026-06-15:', {
  snapshotId: source.snapshotId,
  evaluated: result.evaluated,
  changed: result.changed,
  unchanged: result.unchanged,
  becameEligible: result.becameEligible,
  becameIneligible: result.becameIneligible,
  intoNeedsInformation: result.intoNeedsInformation,
  outOfNeedsInformation: result.outOfNeedsInformation,
  errors: result.errors.length,
  matrix: result.matrix,
});
describe('150 synthetic patients, two policies', () => {
  bench(
    'pure analysis with contexts normalized once',
    () => {
      analyzePolicyImpact(population, demoFamily2025, demoFamily);
    },
    { time: 1000, warmupTime: 250 },
  );
  bench(
    'normalization plus analysis (excluding fetch/fingerprint)',
    () => {
      const input = normalizePopulation(source.records, '2026-06-15');
      analyzePolicyImpact(input.contexts, demoFamily2025, demoFamily);
    },
    { time: 1000, warmupTime: 250 },
  );
});
