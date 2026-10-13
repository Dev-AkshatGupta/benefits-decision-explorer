import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  EligibilityProgram,
  DeepReadonly,
} from '../../eligibility/domain/types';
import { isCalendarDate } from '../../patients/domain/dates';
import {
  analyzePolicyImpact,
  normalizePopulation,
  type PopulationImpactResult,
} from '../domain/population';
import {
  getPolicyPopulation,
  populationKeys,
  usePopulationVersion,
} from '../api/population-api';
export interface AnalysisSnapshot {
  baseline: EligibilityProgram;
  comparison: EligibilityProgram;
  evaluationDate: string;
  snapshotId: string;
  analyzedAt: string;
  durationMs: number;
  result: PopulationImpactResult;
  names: Readonly<Record<string, string>>;
}
function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}
export function usePopulationImpact() {
  const [snapshot, setSnapshot] =
    useState<DeepReadonly<AnalysisSnapshot> | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const client = useQueryClient(),
    active = useRef(false),
    guard = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const freshness = usePopulationVersion(snapshot !== null);
  const run = async (
    baseline: EligibilityProgram,
    comparison: EligibilityProgram,
    evaluationDate: string,
  ) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError('');
    try {
      if (!isCalendarDate(evaluationDate))
        throw new Error('Choose a valid calendar date.');
      const response = await getPolicyPopulation();
      if (!active.current) return;
      const started = performance.now();
      const normalized = normalizePopulation(response.records, evaluationDate);
      const result = analyzePolicyImpact(
        normalized.contexts,
        baseline,
        comparison,
      );
      result.total = response.records.length;
      result.errors = [...normalized.errors, ...result.errors];
      const durationMs = performance.now() - started;
      setSnapshot(
        freeze({
          baseline,
          comparison,
          evaluationDate,
          snapshotId: response.snapshotId,
          analyzedAt: new Date().toISOString(),
          durationMs,
          result,
          names: Object.fromEntries(normalized.names),
        }),
      );
      client.setQueryData(populationKeys.version, {
        snapshotId: response.snapshotId,
        count: response.records.length,
      });
    } catch {
      if (active.current)
        setError(
          'Population analysis could not run. Check the selections and date, then retry. Previous results remain unchanged.',
        );
    } finally {
      guard.current = false;
      if (active.current) setBusy(false);
    }
  };
  return { snapshot, busy, error, run, freshness };
}
