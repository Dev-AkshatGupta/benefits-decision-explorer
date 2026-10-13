import { Button } from '@/components/ui/button';
import { usStates } from '../../../patients/domain/schemas';
import type { EligibilityContext } from '../../domain/types';
import { formatRuleValue } from '../../ui/decision-presentation';
import type { SimulationDraft, SimulationErrors } from '../domain/simulation';
const fields = [
  {
    draft: 'income',
    field: 'annualHouseholdIncomeCents',
    label: 'Hypothetical annual income (USD)',
    mode: 'decimal',
  },
  {
    draft: 'householdSize',
    field: 'householdSize',
    label: 'Hypothetical household size',
    mode: 'numeric',
  },
  {
    draft: 'age',
    field: 'age',
    label: 'Hypothetical patient age',
    mode: 'numeric',
  },
] as const;
export function SimulationInputs({
  baseline,
  draft,
  errors,
  onChange,
  onReset,
}: {
  baseline: EligibilityContext;
  draft: SimulationDraft;
  errors: SimulationErrors;
  onChange: (field: keyof SimulationDraft, value: string) => void;
  onReset: () => void;
}) {
  return (
    <section
      aria-labelledby="scenario-input-title"
      className="rounded-xl border bg-card p-5 sm:p-6"
    >
      <h2 id="scenario-input-title" className="text-lg font-semibold">
        Scenario inputs
      </h2>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        Blank inputs and “Use baseline” restore the original value, including
        unknown information. These are temporary context overrides, not edits to
        household members or income sources.
      </p>
      <div className="mt-5 space-y-5">
        {fields.map(({ draft: key, field, label, mode }) => (
          <div key={key}>
            <label
              htmlFor={'simulation-' + key}
              className="mb-2 block text-sm font-medium"
            >
              {label}
            </label>
            <div className="flex gap-2">
              <input
                id={'simulation-' + key}
                className="form-control w-full"
                value={draft[key]}
                inputMode={mode}
                autoComplete="off"
                maxLength={24}
                placeholder="Use baseline"
                onChange={(event) => onChange(key, event.target.value)}
                aria-invalid={Boolean(errors[key])}
                aria-describedby={
                  'simulation-' +
                  key +
                  '-description' +
                  (errors[key] ? ' simulation-' + key + '-error' : '')
                }
              />
              <Button
                variant="outline"
                aria-label={'Reset ' + label}
                onClick={() => onChange(key, '')}
                disabled={!draft[key]}
              >
                Reset
              </Button>
            </div>
            <p
              id={'simulation-' + key + '-description'}
              className="mt-2 text-xs leading-5 text-muted-foreground"
            >
              Baseline: {formatRuleValue(baseline[field] ?? null, field)}
              {key === 'householdSize'
                ? ' · Range 1–50'
                : key === 'age'
                  ? ' · Range 0–120; saved birth date is not changed.'
                  : ' · Supplying a value assumes complete hypothetical income.'}
            </p>
            {errors[key] && (
              <p
                id={'simulation-' + key + '-error'}
                role="alert"
                className="mt-2 text-sm text-warning"
              >
                {errors[key]}
              </p>
            )}
          </div>
        ))}
        <div>
          <label
            htmlFor="simulation-state"
            className="mb-2 block text-sm font-medium"
          >
            Hypothetical state of residence
          </label>
          <select
            id="simulation-state"
            className="form-control w-full"
            value={draft.state}
            onChange={(event) => onChange('state', event.target.value)}
          >
            <option value="">Use baseline</option>
            {usStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Baseline: {formatRuleValue(baseline.state ?? null, 'state')}
          </p>
        </div>
        <div>
          <label
            htmlFor="simulation-children"
            className="mb-2 block text-sm font-medium"
          >
            Hypothetical qualifying child present
          </label>
          <select
            id="simulation-children"
            className="form-control w-full"
            value={draft.children}
            onChange={(event) => onChange('children', event.target.value)}
            aria-describedby="simulation-child-description"
          >
            <option value="">Use baseline</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          <p
            id="simulation-child-description"
            className="mt-2 text-xs leading-5 text-muted-foreground"
          >
            Baseline:{' '}
            {formatRuleValue(
              baseline.hasQualifyingChild ?? null,
              'hasQualifyingChild',
            )}
            . A qualifying child is a dependent younger than 13. No hypothetical
            member records are created.
          </p>
          {errors.children && (
            <p role="alert" className="mt-2 text-sm text-warning">
              {errors.children}
            </p>
          )}
        </div>
      </div>
      <Button variant="outline" className="mt-6 min-h-11" onClick={onReset}>
        Reset All Changes
      </Button>
    </section>
  );
}
