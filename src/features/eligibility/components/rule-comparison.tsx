import type { EligibilityRule, RuleEvaluationResult } from '../domain/types';
import {
  fieldLabels,
  formatRuleValue,
  numericComparisonScale,
  operatorLabels,
  valueSource,
} from '../ui/decision-presentation';
export function RuleComparison({
  rule,
  result,
}: {
  rule: EligibilityRule;
  result: RuleEvaluationResult;
}) {
  const scale =
    rule.fieldType === 'number' &&
    typeof result.actualValue === 'number' &&
    typeof result.expectedValue === 'number'
      ? numericComparisonScale(result.actualValue, result.expectedValue)
      : null;
  return (
    <div className="space-y-4">
      <dl className="grid gap-4 rounded-lg bg-background p-4 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">
            Actual evaluated value
          </dt>
          <dd className="mt-1 break-words text-sm font-semibold">
            {formatRuleValue(result.actualValue, rule.field)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">
            Configured policy value
          </dt>
          <dd className="mt-1 break-words text-sm font-semibold">
            {formatRuleValue(result.expectedValue, rule.field)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">
            Condition
          </dt>
          <dd className="mt-1 break-words text-sm">
            {fieldLabels[rule.field]} ·{' '}
            {rule.fieldType === 'string_array' &&
            (result.operator === 'in' || result.operator === 'not_in')
              ? result.operator === 'in'
                ? 'Has any overlap with'
                : 'Has no overlap with'
              : operatorLabels[result.operator]}{' '}
            · {formatRuleValue(result.expectedValue, rule.field)}
          </dd>
        </div>
      </dl>
      {scale && (
        <figure
          aria-label="Numeric rule comparison"
          className="rounded-lg border p-3"
        >
          <figcaption className="flex flex-wrap justify-between gap-2 text-xs">
            <span>
              ● Actual: {formatRuleValue(result.actualValue, rule.field)}
            </span>
            <span className="text-primary">
              ┃ Threshold: {formatRuleValue(result.expectedValue, rule.field)}
            </span>
          </figcaption>
          <svg viewBox="0 0 300 55" className="mt-2 w-full" aria-hidden="true">
            <line
              x1="18"
              x2="282"
              y1="27"
              y2="27"
              stroke="currentColor"
              className="text-border"
              strokeWidth="3"
            />
            <line
              x1={scale.expectedX}
              x2={scale.expectedX}
              y1="13"
              y2="41"
              stroke="currentColor"
              className="text-primary"
              strokeWidth="3"
            />
            <circle
              cx={scale.actualX}
              cy="27"
              r="6"
              fill="currentColor"
              className="text-foreground"
              stroke="white"
              strokeWidth="2"
            />
          </svg>
          <div className="flex justify-between gap-4 text-xs text-muted-foreground">
            <span className="break-all">
              {formatRuleValue(scale.min, rule.field)}
            </span>
            <span className="break-all text-right">
              {formatRuleValue(scale.max, rule.field)}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Value scale only; this is not a probability or progress measure.
          </p>
        </figure>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        <span className="font-medium">Value source: </span>
        {valueSource(rule.field)}
      </p>
    </div>
  );
}
