import { useEffect, useRef, useState } from 'react';
import {
  useForm,
  useFieldArray,
  useWatch,
  type Control,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import type { Household } from '../../domain/schemas';
import {
  incomeFormSchema,
  incomeToForm,
  previewAnnualIncome,
  type IncomeFormInput,
  type IncomeFormOutput,
} from '../../domain/profile-forms';
import {
  calculateHouseholdAnnualIncome,
  formatCurrency,
} from '../../domain/income';
import { incomeTypeLabels, frequencyLabels } from '../../domain/profile-labels';
import { useUpdateHousehold } from '../../api/patient-queries';
import { InputField, SelectField } from './form-fields';
import { SaveFeedback } from './save-feedback';
function AnnualPreview({
  control,
  index,
}: {
  control: Control<IncomeFormInput, undefined, IncomeFormOutput>;
  index: number;
}) {
  const amount = useWatch({
    control,
    name: `incomeSources.${index}.amountDollars`,
  });
  const frequency = useWatch({
    control,
    name: `incomeSources.${index}.frequency`,
  });
  const annual = previewAnnualIncome(amount ?? '', frequency ?? 'monthly');
  return (
    <p className="mt-4 text-sm">
      <span className="text-muted-foreground">Annualized income: </span>
      <span>
        {annual === undefined ? 'Enter a valid amount' : formatCurrency(annual)}
      </span>
    </p>
  );
}
function IncomeTotal({
  control,
}: {
  control: Control<IncomeFormInput, undefined, IncomeFormOutput>;
}) {
  const sources = useWatch({ control, name: 'incomeSources' }) ?? [];
  const parsed = incomeFormSchema.safeParse({ incomeSources: sources });
  const total = parsed.success
    ? calculateHouseholdAnnualIncome(parsed.data.incomeSources)
    : undefined;
  return (
    <div className="my-4 rounded-lg bg-accent p-4">
      <p className="text-sm text-primary">Total annual household income</p>
      <p className="mt-1 text-2xl font-semibold text-primary">
        {total === undefined
          ? 'Complete valid amounts to calculate'
          : formatCurrency(total)}
      </p>
    </div>
  );
}
export function IncomeEditor({
  household,
  onDirty,
  onBusy,
  onCancel,
  onDone,
  onReload,
}: {
  household: Household;
  onDirty: (value: boolean) => void;
  onBusy: (value: boolean) => void;
  onCancel: () => void;
  onDone: (message: string) => void;
  onReload: () => Promise<Household | undefined>;
}) {
  const version = useRef(household.updatedAt),
    guard = useRef(false);
  const form = useForm<IncomeFormInput, undefined, IncomeFormOutput>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: incomeToForm(household),
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'incomeSources',
    keyName: 'formKey',
  });
  const mutation = useUpdateHousehold();
  const { errors, isDirty, isSubmitting } = form.formState;
  const [reloading, setReloading] = useState(false);
  const pending = isSubmitting || mutation.isPending || reloading;
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);
  useEffect(() => onBusy(pending), [pending, onBusy]);
  const reload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      const latest = await onReload();
      if (!latest) throw new Error('Reload failed');
      version.current = latest.updatedAt;
      form.reset(incomeToForm(latest));
      mutation.reset();
    } finally {
      setReloading(false);
    }
  };
  return (
    <form
      noValidate
      aria-busy={pending}
      onSubmit={(event) =>
        void form.handleSubmit(async (values) => {
          if (pending || guard.current) return;
          guard.current = true;
          try {
            await mutation.mutateAsync({
              patientId: household.patientId,
              patch: values,
              expectedUpdatedAt: version.current,
            });
            onDone('Household income saved.');
          } catch {
            /* Preserve the draft. */
          } finally {
            guard.current = false;
          }
        })(event)
      }
    >
      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Household income sources</legend>
        {fields.map((field, index) => {
          const error = errors.incomeSources?.[index];
          return (
            <fieldset key={field.formKey} className="rounded-lg border p-4">
              <legend className="px-2 text-sm font-semibold">
                Income source {index + 1}
              </legend>
              <input
                type="hidden"
                {...form.register(`incomeSources.${index}.id`)}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Income type"
                  registration={form.register(`incomeSources.${index}.type`)}
                  error={error?.type?.message}
                >
                  {Object.entries(incomeTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <InputField
                  label="Amount per payment (USD)"
                  inputMode="decimal"
                  registration={form.register(
                    `incomeSources.${index}.amountDollars`,
                  )}
                  error={error?.amountDollars?.message}
                />
                <SelectField
                  label="Payment frequency"
                  registration={form.register(
                    `incomeSources.${index}.frequency`,
                  )}
                  error={error?.frequency?.message}
                >
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              </div>
              <AnnualPreview control={form.control} index={index} />
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                aria-label={'Remove income source ' + (index + 1)}
                onClick={() => remove(index)}
              >
                Remove income source
              </Button>
            </fieldset>
          );
        })}
        <Button
          type="button"
          variant="outline"
          disabled={fields.length >= 100}
          onClick={() =>
            append({
              id: 'income-' + crypto.randomUUID(),
              type: 'employment',
              amountDollars: '0.00',
              frequency: 'monthly',
            })
          }
        >
          Add income source
        </Button>
      </fieldset>
      <IncomeTotal control={form.control} />
      <label className="my-4 flex items-start gap-3 rounded-lg border p-4 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-primary"
          disabled={pending}
          {...form.register('confirmIncomeComplete')}
        />
        <span>
          I confirm this demonstration income report is complete
          <span className="mt-2 block text-xs leading-5 text-muted-foreground">
            Review all sources before confirming. A complete empty report
            confirms zero income. This is a synthetic data completeness marker,
            not actual income verification.
          </span>
        </span>
      </label>
      {(errors.incomeSources?.message ||
        errors.incomeSources?.root?.message) && (
        <p role="alert" className="mt-3 text-sm text-warning">
          {errors.incomeSources?.message || errors.incomeSources?.root?.message}
        </p>
      )}
      <SaveFeedback error={mutation.error} onReload={reload} busy={pending} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || !isDirty}>
          {isSubmitting ? 'Saving income…' : 'Save household income'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
