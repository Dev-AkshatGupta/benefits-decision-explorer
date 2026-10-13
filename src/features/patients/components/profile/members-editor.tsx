import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import type { Household } from '../../domain/schemas';
import {
  membersFormSchema,
  membersToForm,
  type MembersFormInput,
  type MembersFormOutput,
} from '../../domain/profile-forms';
import {
  relationshipLabels,
  employmentLabels,
} from '../../domain/profile-labels';
import { todayUtc } from '../../domain/dates';
import { useUpdateHousehold } from '../../api/patient-queries';
import { InputField, SelectField } from './form-fields';
import { SaveFeedback } from './save-feedback';
export function MembersEditor({
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
  const form = useForm<MembersFormInput, undefined, MembersFormOutput>({
    resolver: zodResolver(membersFormSchema),
    defaultValues: membersToForm(household),
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'members',
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
      form.reset(membersToForm(latest));
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
            onDone('Household members saved.');
          } catch {
            /* Preserve the draft. */
          } finally {
            guard.current = false;
          }
        })(event)
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Household size: {fields.length}. Individual income is reported
        separately; the household total comes from income sources.
      </p>
      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Household members</legend>
        {fields.map((field, index) => {
          const primary = field.relationship === 'self';
          const error = errors.members?.[index];
          return (
            <fieldset key={field.formKey} className="rounded-lg border p-4">
              <legend className="px-2 text-sm font-semibold">
                {primary ? 'Primary patient' : 'Member ' + (index + 1)}
              </legend>
              <input type="hidden" {...form.register(`members.${index}.id`)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label="First name"
                  readOnly={primary}
                  registration={form.register(`members.${index}.firstName`)}
                  error={error?.firstName?.message}
                />
                <InputField
                  label="Last name"
                  readOnly={primary}
                  registration={form.register(`members.${index}.lastName`)}
                  error={error?.lastName?.message}
                />
                <InputField
                  label="Date of birth"
                  readOnly={primary}
                  type="date"
                  max={todayUtc()}
                  registration={form.register(`members.${index}.dateOfBirth`)}
                  error={error?.dateOfBirth?.message}
                />
                {primary ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">Relationship</p>
                    <p className="text-sm">
                      Primary patient · Managed in Edit Profile
                    </p>
                    <input
                      type="hidden"
                      {...form.register(`members.${index}.relationship`)}
                    />
                  </div>
                ) : (
                  <SelectField
                    label="Relationship"
                    registration={form.register(
                      `members.${index}.relationship`,
                    )}
                    error={error?.relationship?.message}
                  >
                    {Object.entries(relationshipLabels)
                      .filter(([value]) => value !== 'self')
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </SelectField>
                )}
                <SelectField
                  label="Employment status"
                  registration={form.register(
                    `members.${index}.employmentStatus`,
                  )}
                  error={error?.employmentStatus?.message}
                >
                  {Object.entries(employmentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <InputField
                  label="Reported annual income (USD)"
                  inputMode="decimal"
                  registration={form.register(`members.${index}.incomeDollars`)}
                  error={error?.incomeDollars?.message}
                />
              </div>
              {!primary && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  aria-label={'Remove member ' + (index + 1)}
                  onClick={() => remove(index)}
                >
                  Remove member
                </Button>
              )}
            </fieldset>
          );
        })}
        <Button
          type="button"
          variant="outline"
          disabled={fields.length >= 50}
          onClick={() =>
            append({
              id: 'member-' + crypto.randomUUID(),
              firstName: '',
              lastName: '',
              relationship: 'other',
              dateOfBirth: '',
              incomeDollars: '0.00',
              employmentStatus: 'other',
            })
          }
        >
          Add household member
        </Button>
      </fieldset>
      {(errors.members?.message || errors.members?.root?.message) && (
        <p role="alert" className="mt-3 text-sm text-warning">
          {errors.members?.message || errors.members?.root?.message}
        </p>
      )}
      <SaveFeedback error={mutation.error} onReload={reload} busy={pending} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || !isDirty}>
          {isSubmitting ? 'Saving members…' : 'Save household members'}
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
