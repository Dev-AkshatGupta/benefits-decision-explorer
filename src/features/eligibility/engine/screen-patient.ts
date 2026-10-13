import type {
  EligibilityContext,
  EligibilityProgram,
  ProgramEvaluationResult,
} from '../domain/types';
import { EligibilityEngineError } from './errors';
import { evaluateValidatedProgram } from './evaluate-program';
import { validateContext, validateProgram } from './validation';
export function screenPatient(
  programs: readonly EligibilityProgram[],
  context: EligibilityContext,
): ProgramEvaluationResult[] {
  const normalized = validateContext(context);
  const validated = programs.map(validateProgram);
  if (new Set(validated.map((program) => program.id)).size !== validated.length)
    throw new EligibilityEngineError(
      'AMBIGUOUS_POLICY_VERSION',
      'Screening requires one selected version per program ID.',
    );
  return validated.map((program) =>
    evaluateValidatedProgram(program, normalized),
  );
}
