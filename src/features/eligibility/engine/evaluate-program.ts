import type {
  EligibilityContext,
  EligibilityProgram,
  ProgramEvaluationResult,
  ProgramStatus,
  RuleStatus,
} from '../domain/types';
import { EligibilityEngineError } from './errors';
import { evaluateValidatedRule } from './evaluate-rule';
import { validateContext, validateProgram } from './validation';

export function aggregateRuleStatuses(
  strategy: EligibilityProgram['evaluationStrategy'],
  statuses: readonly RuleStatus[],
): ProgramStatus {
  if (!statuses.length)
    throw new EligibilityEngineError(
      'MALFORMED_POLICY',
      'A program must have at least one required rule.',
    );
  if (
    statuses.some(
      (status) =>
        status !== 'pass' && status !== 'fail' && status !== 'unknown',
    )
  )
    throw new EligibilityEngineError(
      'MALFORMED_POLICY',
      'Unsupported rule outcome.',
    );
  switch (strategy) {
    case 'ALL':
      return statuses.includes('fail')
        ? 'ineligible'
        : statuses.includes('unknown')
          ? 'needs_information'
          : 'eligible';
    case 'ANY':
      return statuses.includes('pass')
        ? 'eligible'
        : statuses.includes('unknown')
          ? 'needs_information'
          : 'ineligible';
    default:
      throw new EligibilityEngineError(
        'MALFORMED_POLICY',
        'Unsupported decision strategy.',
      );
  }
}
export function evaluateValidatedProgram(
  program: EligibilityProgram,
  context: EligibilityContext,
  applicability: 'effective' | 'counterfactual' = 'effective',
): ProgramEvaluationResult {
  if (
    applicability === 'effective' &&
    (context.evaluationDate < program.effectiveFrom ||
      (program.effectiveTo && context.evaluationDate > program.effectiveTo))
  )
    throw new EligibilityEngineError(
      'POLICY_NOT_APPLICABLE',
      'The requested policy version is not effective on the evaluation date.',
    );
  const ruleResults = program.rules.map((rule) =>
    evaluateValidatedRule(rule, context),
  );
  return {
    patientId: context.patientId,
    programId: program.id,
    programName: program.name,
    policyVersion: program.policyVersion,
    status: aggregateRuleStatuses(
      program.evaluationStrategy,
      ruleResults.map((rule) => rule.status),
    ),
    ruleResults,
    passedRules: ruleResults.filter((rule) => rule.status === 'pass').length,
    failedRules: ruleResults.filter((rule) => rule.status === 'fail').length,
    unknownRules: ruleResults.filter((rule) => rule.status === 'unknown')
      .length,
    missingFields: [
      ...new Set(ruleResults.flatMap((rule) => rule.missingFields)),
    ],
    evaluatedAt: context.evaluationDate,
  };
}
export function evaluateProgram(
  program: EligibilityProgram,
  context: EligibilityContext,
): ProgramEvaluationResult {
  return evaluateValidatedProgram(
    validateProgram(program),
    validateContext(context),
  );
}
