import { useMemo, useState } from 'react';
import { screenPatient } from '../../engine/screen-patient';
import type { ScreeningSnapshot } from '../../ui/screening-snapshot';
import {
  applySimulationOverrides,
  compareEligibilityResults,
  emptySimulationDraft,
  inputDifferences,
  parseSimulationDraft,
  simulationOverridesSchema,
  type SimulationDraft,
} from '../domain/simulation';
export function useEligibilitySimulation(baseline: ScreeningSnapshot) {
  const [draft, setDraft] = useState<SimulationDraft>(emptySimulationDraft);
  const parsed = useMemo(
    () => parseSimulationDraft(draft, baseline),
    [draft, baseline],
  );
  const key = parsed.context ? JSON.stringify(parsed.overrides) : 'null';
  const calculation = useMemo(() => {
    if (key === 'null')
      return { context: null, results: null, comparisons: null, changes: [] };
    const overrides = simulationOverridesSchema.parse(JSON.parse(key));
    const context = applySimulationOverrides(baseline.context, overrides);
    // Reset/unmodified scenarios reuse the exact original results; changed valid inputs use the original policies.
    const results = Object.keys(overrides).length
      ? screenPatient(baseline.programs, context)
      : baseline.results;
    return {
      context,
      results,
      comparisons: compareEligibilityResults(baseline.results, results),
      changes: inputDifferences(baseline.context, context),
    };
  }, [key, baseline]);
  const update = (field: keyof SimulationDraft, value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));
  const reset = () => setDraft({ ...emptySimulationDraft });
  return {
    draft,
    update,
    reset,
    errors: parsed.errors,
    overrides: parsed.overrides,
    ...calculation,
  };
}
