import { isConfirmedDemoResetNavigation } from '@/app/demo/reset-session';
import { useState, useRef, useId } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  InputField,
  SelectField,
} from '../../patients/components/profile/form-fields';
import { PatientSelector } from '../../eligibility/components/patient-selector';
import { demoPolicyRegistry } from '../../eligibility/policies/registry';
import { isCalendarDate } from '../../patients/domain/dates';
import { UnsavedChangesDialog } from '../../patients/components/profile/unsaved-changes-dialog';
import { useBlocker, useBeforeUnload } from 'react-router';
import { useDialogFocus } from '../../tasks/hooks/use-dialog-focus';
import {
  renewalStages,
  renewalTransitions,
  coverageLabels,
  type CoverageRecord,
} from '../domain/coverage';
import { useCreateCoverage, useUpdateCoverage } from '../api/coverage-queries';
const dateInput = z
  .string()
  .refine(
    (value) => !value || isCalendarDate(value),
    'Enter a valid calendar date',
  );
const formSchema = z
  .object({
    patientId: z.string().min(1, 'Select a patient'),
    programId: z.string().min(1, 'Select a fictional program'),
    startDate: z.string().refine(isCalendarDate, 'Enter a valid start date'),
    endDate: dateInput,
    terminatedAt: dateInput,
    renewalDueDate: dateInput,
    renewalStatus: z.enum(renewalStages),
    notes: z.string().trim().max(3000),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End must not precede start',
  })
  .refine(
    (value) => !value.terminatedAt || value.terminatedAt >= value.startDate,
    { path: ['terminatedAt'], message: 'Termination must not precede start' },
  );
const programs = [
  ...new Map(
    demoPolicyRegistry.map((program) => [program.id, program.name]),
  ).entries(),
];
export function CoverageEditor({
  record,
  patientId = '',
  onClose,
  onSaved,
}: {
  record?: CoverageRecord;
  patientId?: string;
  onClose: () => void;
  onSaved: (record: CoverageRecord) => void;
}) {
  const notesErrorId = useId();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientId: record?.patientId ?? patientId,
      programId: record?.programId ?? '',
      startDate: record?.startDate ?? '',
      endDate: record?.endDate ?? '',
      terminatedAt: record?.terminatedAt ?? '',
      renewalDueDate: record?.renewalDueDate ?? '',
      renewalStatus: record?.renewalStatus ?? 'not_started',
      notes: record?.notes ?? '',
    },
  });
  const selected = useWatch({ control: form.control, name: 'patientId' }),
    create = useCreateCoverage(),
    update = useUpdateCoverage(),
    busy = create.isPending || update.isPending,
    focus = useDialogFocus();
  const [error, setError] = useState(''),
    [confirm, setConfirm] = useState(false),
    guard = useRef(false),
    key = useRef({ signature: '', key: '' });
  const dirty = form.formState.isDirty;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || busy) && currentLocation.pathname !== nextLocation.pathname,
  );
  useBeforeUnload((event) => {
    if ((dirty || busy) && !isConfirmedDemoResetNavigation()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  const close = () => {
    if (busy) return;
    if (dirty) setConfirm(true);
    else onClose();
  };
  async function save(value: z.infer<typeof formSchema>) {
    if (guard.current) return;
    guard.current = true;
    setError('');
    const signature = JSON.stringify(value);
    if (key.current.signature !== signature)
      key.current = { signature, key: crypto.randomUUID() };
    const fields = {
      startDate: value.startDate,
      endDate: value.endDate || null,
      terminatedAt: value.terminatedAt || null,
      renewalDueDate: value.renewalDueDate || null,
      renewalStatus: value.renewalStatus,
      notes: value.notes,
    };
    try {
      const saved = record
        ? await update.mutateAsync({
            id: record.id,
            updatedAt: record.updatedAt,
            value: fields,
          })
        : await create.mutateAsync({
            key: key.current.key,
            value: {
              ...fields,
              patientId: value.patientId,
              programId: value.programId,
            },
          });
      form.reset(value);
      onSaved(saved);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Coverage could not be saved; draft preserved.',
      );
    } finally {
      guard.current = false;
    }
  }
  return (
    <>
      <Dialog.Root
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/50" />
          <Dialog.Content
            {...focus}
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-card p-5 shadow-xl sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-xl font-semibold">
                  {record ? 'Edit coverage' : 'Create coverage'}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-xs">
                  Explicit synthetic record entry only. Screening is not proof
                  of coverage or enrollment.
                </Dialog.Description>
              </div>
              <Button
                variant="ghost"
                disabled={busy}
                aria-label="Close coverage editor"
                onClick={close}
              >
                Close
              </Button>
            </div>
            <form
              noValidate
              onSubmit={(event) => void form.handleSubmit(save)(event)}
              className="space-y-5"
            >
              {record || patientId ? (
                <p className="text-sm">Patient: {selected} (fixed)</p>
              ) : (
                <PatientSelector
                  patientId={selected}
                  disabled={busy}
                  onSelect={(id) =>
                    form.setValue('patientId', id, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              )}
              {form.formState.errors.patientId && (
                <p role="alert">{form.formState.errors.patientId.message}</p>
              )}
              <SelectField
                label="Fictional program"
                registration={form.register('programId')}
                error={form.formState.errors.programId?.message}
                disabled={busy || !!record}
              >
                <option value="">Select program</option>
                {programs.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </SelectField>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    'startDate',
                    'endDate',
                    'terminatedAt',
                    'renewalDueDate',
                  ] as const
                ).map((name) => (
                  <InputField
                    key={name}
                    label={
                      {
                        startDate: 'Coverage start',
                        endDate: 'Coverage end',
                        terminatedAt: 'Termination date',
                        renewalDueDate: 'Renewal due date',
                      }[name]
                    }
                    type="date"
                    optional={name !== 'startDate'}
                    registration={form.register(name)}
                    error={form.formState.errors[name]?.message}
                    disabled={busy}
                  />
                ))}
              </div>
              <SelectField
                label="Renewal stage"
                registration={form.register('renewalStatus')}
                disabled={busy}
              >
                {(record
                  ? [
                      record.renewalStatus,
                      ...renewalTransitions[record.renewalStatus],
                    ]
                  : (['not_started'] as const)
                ).map((stage) => (
                  <option value={stage} key={stage}>
                    {coverageLabels[stage]}
                  </option>
                ))}
              </SelectField>
              <label className="block text-sm">
                Notes (optional)
                <textarea
                  className="form-control mt-2 w-full"
                  maxLength={3000}
                  rows={3}
                  {...form.register('notes')}
                  disabled={busy}
                  aria-invalid={!!form.formState.errors.notes}
                  aria-describedby={
                    form.formState.errors.notes ? notesErrorId : undefined
                  }
                />
              </label>
              {form.formState.errors.notes && (
                <p id={notesErrorId} role="alert">
                  {form.formState.errors.notes.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Start/end are inclusive. Termination excludes its day. Editing
                does not generate historical events or extend coverage
                automatically.
              </p>
              {error && (
                <p role="alert" className="rounded-lg border p-3 text-sm">
                  {error}
                </p>
              )}
              <div className="flex gap-3">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving coverage…' : 'Save coverage'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={close}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <UnsavedChangesDialog
        busy={busy}
        open={confirm || blocker.state === 'blocked'}
        onKeep={() => {
          setConfirm(false);
          if (blocker.state === 'blocked') blocker.reset();
        }}
        onDiscard={() => {
          if (busy) return;
          if (blocker.state === 'blocked') blocker.proceed();
          else onClose();
        }}
      />
    </>
  );
}
