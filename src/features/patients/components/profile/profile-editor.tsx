import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import type { Patient, CareCoordinator } from '../../domain/schemas';
import { usStates } from '../../domain/schemas';
import { todayUtc } from '../../domain/dates';
import { genderLabels } from '../../domain/profile-labels';
import { statusLabels } from '../../domain/patient-status';
import {
  profileFormSchema,
  profileToForm,
  type ProfileFormInput,
  type ProfileFormOutput,
} from '../../domain/profile-forms';
import { useUpdatePatient } from '../../api/patient-queries';
import { InputField, SelectField } from './form-fields';
import { SaveFeedback } from './save-feedback';
export function ProfileEditor({
  patient,
  coordinators,
  onDirty,
  onBusy,
  onCancel,
  onDone,
  onReload,
}: {
  patient: Patient;
  coordinators: CareCoordinator[];
  onDirty: (value: boolean) => void;
  onBusy: (value: boolean) => void;
  onCancel: () => void;
  onDone: (message: string) => void;
  onReload: () => Promise<Patient | undefined>;
}) {
  const version = useRef(patient.updatedAt);
  const guard = useRef(false);
  const form = useForm<ProfileFormInput, undefined, ProfileFormOutput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileToForm(patient),
  });
  const mutation = useUpdatePatient();
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
      form.reset(profileToForm(latest));
      mutation.reset();
    } finally {
      setReloading(false);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit(async (values) => {
          if (pending || guard.current) return;
          guard.current = true;
          try {
            await mutation.mutateAsync({
              patientId: patient.id,
              patch: values,
              expectedUpdatedAt: version.current,
            });
            onDone('Profile saved.');
          } catch {
            /* Feedback preserves the current draft. */
          } finally {
            guard.current = false;
          }
        })(event)
      }
      aria-busy={pending}
    >
      <fieldset disabled={pending} className="space-y-6">
        <legend className="sr-only">Patient profile information</legend>
        <section>
          <h3 className="mb-4 font-semibold">Personal Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="First name"
              registration={form.register('firstName')}
              error={errors.firstName?.message}
            />
            <InputField
              label="Last name"
              registration={form.register('lastName')}
              error={errors.lastName?.message}
            />
            <InputField
              label="Date of birth"
              type="date"
              max={todayUtc()}
              registration={form.register('dateOfBirth')}
              error={errors.dateOfBirth?.message}
            />
            <SelectField
              label="Gender"
              optional
              registration={form.register('gender')}
              error={errors.gender?.message}
            >
              <option value="">Not provided</option>
              {Object.entries(genderLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Patient status"
              registration={form.register('status')}
              error={errors.status?.message}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Assigned care coordinator"
              registration={form.register('assignedCoordinatorId')}
              error={errors.assignedCoordinatorId?.message}
            >
              {!coordinators.some(
                (item) => item.id === patient.assignedCoordinatorId,
              ) && (
                <option value={patient.assignedCoordinatorId}>
                  Current coordinator
                </option>
              )}
              {coordinators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.firstName} {item.lastName}
                </option>
              ))}
            </SelectField>
          </div>
        </section>
        <section>
          <h3 className="mb-4 font-semibold">Contact &amp; Address</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="Email"
              type="email"
              optional
              registration={form.register('email')}
              error={errors.email?.message}
            />
            <InputField
              label="Phone number"
              type="tel"
              optional
              registration={form.register('phone')}
              error={errors.phone?.message}
            />
            <div className="sm:col-span-2">
              <InputField
                label="Street address"
                registration={form.register('address.street')}
                error={errors.address?.street?.message}
              />
            </div>
            <InputField
              label="City"
              registration={form.register('address.city')}
              error={errors.address?.city?.message}
            />
            <SelectField
              label="State"
              registration={form.register('address.state')}
              error={errors.address?.state?.message}
            >
              {usStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </SelectField>
            <InputField
              label="Postal code"
              registration={form.register('address.postalCode')}
              error={errors.address?.postalCode?.message}
            />
            <SelectField
              label="Country"
              registration={form.register('address.country')}
            >
              <option value="US">United States</option>
            </SelectField>
          </div>
        </section>
      </fieldset>
      <SaveFeedback error={mutation.error} onReload={reload} busy={pending} />
      <div className="mt-6 flex flex-wrap gap-3 border-t pt-5">
        <Button type="submit" disabled={pending || !isDirty}>
          {isSubmitting ? 'Saving profile…' : 'Save profile'}
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
