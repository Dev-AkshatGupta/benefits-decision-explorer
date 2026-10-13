import { isConfirmedDemoResetNavigation } from '@/app/demo/reset-session';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useBlocker, useBeforeUnload } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  InputField,
  SelectField,
} from '../../patients/components/profile/form-fields';
import { UnsavedChangesDialog } from '../../patients/components/profile/unsaved-changes-dialog';
import { PatientSelector } from '../../eligibility/components/patient-selector';
import { useDialogFocus } from '../hooks/use-dialog-focus';
import { useCoordinators } from '../../patients/api/patient-queries';
import { isCalendarDate } from '../../patients/domain/dates';
import { useCreateTask, useUpdateTask } from '../api/task-queries';
import {
  taskTypes,
  taskPriorities,
  taskStatuses,
  taskLabels,
  transitions,
  type CareTask,
} from '../domain/tasks';
const formSchema = z.object({
  patientId: z.string().min(1, 'Select a patient'),
  title: z.string().trim().min(1, 'Task title is required').max(160),
  description: z.string().trim().max(3000),
  type: z.enum(taskTypes),
  priority: z.enum(taskPriorities),
  assignedCoordinatorId: z.string(),
  dueDate: z
    .string()
    .refine(
      (value) => value === '' || isCalendarDate(value),
      'Enter a valid due date',
    ),
  status: z.enum(taskStatuses),
  completionNote: z.string().trim().max(2000),
});
type FormValue = z.infer<typeof formSchema>;
export interface TaskDraft {
  patientId?: string;
  title?: string;
  description?: string;
  type?: CareTask['type'];
  dueDate?: string | null;
  assignedCoordinatorId?: string | null;
  source?: CareTask['source'];
}
function TaskForm({
  task,
  draft,
  onClose,
  onSaved,
  onDirty,
  onBusy,
}: {
  task?: CareTask | undefined;
  draft?: TaskDraft | undefined;
  onClose: () => void;
  onSaved: (task: CareTask) => void;
  onDirty: (dirty: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const form = useForm<FormValue>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientId: task?.patientId ?? draft?.patientId ?? '',
      title: task?.title ?? draft?.title ?? '',
      description: task?.description ?? draft?.description ?? '',
      type: task?.type ?? draft?.type ?? 'general',
      priority: task?.priority ?? 'medium',
      assignedCoordinatorId:
        task?.assignedCoordinatorId ?? draft?.assignedCoordinatorId ?? '',
      dueDate: task?.dueDate ?? draft?.dueDate ?? '',
      status: task?.status ?? 'todo',
      completionNote: '',
    },
  });
  const create = useCreateTask(),
    update = useUpdateTask(),
    coordinators = useCoordinators();
  const busy = create.isPending || update.isPending,
    [error, setError] = useState('');
  const requestKey = useRef({ signature: '', key: '' }),
    guard = useRef(false);
  const patientId = useWatch({ control: form.control, name: 'patientId' }),
    status = useWatch({ control: form.control, name: 'status' });
  const assignedCoordinatorId = useWatch({
    control: form.control,
    name: 'assignedCoordinatorId',
  });
  useEffect(
    () => onDirty(form.formState.isDirty),
    [onDirty, form.formState.isDirty],
  );
  useEffect(() => onBusy(busy), [onBusy, busy]);
  const save = async (value: FormValue) => {
    if (guard.current) return;
    guard.current = true;
    setError('');
    const signature = JSON.stringify(value);
    if (requestKey.current.signature !== signature)
      requestKey.current = { signature, key: crypto.randomUUID() };
    const fields = {
      title: value.title,
      description: value.description,
      type: value.type,
      priority: value.priority,
      assignedCoordinatorId: value.assignedCoordinatorId || null,
      dueDate: value.dueDate || null,
    };
    try {
      const result = task
        ? await update.mutateAsync({
            id: task.id,
            expectedUpdatedAt: task.updatedAt,
            patch: {
              ...fields,
              ...(value.status !== task.status
                ? {
                    status: value.status,
                    ...(value.status === 'completed'
                      ? { completionNote: value.completionNote }
                      : {}),
                  }
                : {}),
            },
          })
        : await create.mutateAsync({
            requestId: requestKey.current.key,
            value: {
              ...fields,
              patientId: value.patientId,
              ...(draft?.source ? { source: draft.source } : {}),
            },
          });
      form.reset(value);
      onSaved(result);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Task could not be saved. Your draft is preserved.',
      );
    } finally {
      guard.current = false;
    }
  };
  return (
    <form
      onSubmit={(event) => void form.handleSubmit(save)(event)}
      noValidate
      className="space-y-5"
    >
      {task || draft?.patientId ? (
        <p className="text-sm">Patient: {patientId} (fixed for this task)</p>
      ) : (
        <PatientSelector
          patientId={patientId}
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
        <p role="alert" className="text-sm text-warning">
          {form.formState.errors.patientId.message}
        </p>
      )}
      <InputField
        label="Task title"
        registration={form.register('title')}
        error={form.formState.errors.title?.message}
        disabled={busy}
      />
      <label className="block text-sm font-medium">
        Description (optional)
        <textarea
          className="form-control mt-2 w-full"
          rows={3}
          maxLength={3000}
          disabled={busy}
          {...form.register('description')}
          aria-invalid={!!form.formState.errors.description}
        />
        {form.formState.errors.description && (
          <span role="alert">{form.formState.errors.description.message}</span>
        )}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Task type"
          registration={form.register('type')}
          disabled={busy}
        >
          {taskTypes.map((value) => (
            <option key={value} value={value}>
              {taskLabels[value]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Priority"
          registration={form.register('priority')}
          disabled={busy}
        >
          {taskPriorities.map((value) => (
            <option key={value} value={value}>
              {taskLabels[value]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Assigned coordinator"
          value={assignedCoordinatorId}
          optional
          registration={form.register('assignedCoordinatorId')}
          disabled={busy || !coordinators.data}
        >
          <option value="">Unassigned</option>
          {coordinators.data?.map((coordinator) => (
            <option key={coordinator.id} value={coordinator.id}>
              {coordinator.firstName} {coordinator.lastName}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Due date"
          optional
          type="date"
          registration={form.register('dueDate')}
          error={form.formState.errors.dueDate?.message}
          disabled={busy}
        />
        {task && (
          <SelectField
            label="Task status"
            registration={form.register('status')}
            disabled={busy}
          >
            {[task.status, ...transitions[task.status]].map((value) => (
              <option value={value} key={value}>
                {taskLabels[value]}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      {task && status === 'completed' && status !== task.status && (
        <label className="block text-sm">
          Completion note (optional)
          <textarea
            className="form-control mt-2 w-full"
            maxLength={2000}
            rows={3}
            {...form.register('completionNote')}
            disabled={busy}
            aria-invalid={!!form.formState.errors.completionNote}
          />
          {form.formState.errors.completionNote && (
            <span role="alert">
              {form.formState.errors.completionNote.message}
            </span>
          )}
        </label>
      )}
      {draft?.source?.screening && (
        <p className="rounded-lg border p-3 text-xs">
          Follow-up source: {draft.source.programId} · Policy{' '}
          {draft.source.screening?.policyVersion} · Evaluation date{' '}
          {draft.source.screening?.evaluationDate} · Missing field{' '}
          {draft.source.missingField}. This references a screening context, not
          a persisted historical result. Completing this task does not guarantee
          eligibility.
        </p>
      )}
      {draft?.source?.coverageId && (
        <p className="rounded-lg border p-3 text-xs">
          Coverage source: {draft.source.coverageId} · Renewal deadline{' '}
          {draft.source.renewalDueDate ?? 'not recorded'}. Task completion does
          not complete a renewal or extend coverage.
        </p>
      )}
      {coordinators.isError && (
        <div role="alert" className="text-sm">
          Coordinators could not load.{' '}
          <Button
            type="button"
            variant="outline"
            onClick={() => void coordinators.refetch()}
          >
            Retry coordinators
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg border p-3 text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy || !coordinators.data}>
          {busy ? 'Saving task…' : 'Save task'}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
export function TaskEditor({
  task,
  draft,
  onClose,
  onSaved,
  onDirty,
  onBusy,
}: {
  task?: CareTask | undefined;
  draft?: TaskDraft | undefined;
  onClose: () => void;
  onSaved: (task: CareTask) => void;
  onDirty?: ((dirty: boolean) => void) | undefined;
  onBusy?: ((busy: boolean) => void) | undefined;
}) {
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const focus = useDialogFocus();
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);
  useEffect(
    () => () => {
      onDirty?.(false);
      onBusy?.(false);
    },
    [onDirty, onBusy],
  );
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if ((dirty || busy) && !isConfirmedDemoResetNavigation()) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty, busy],
    ),
  );
  const close = () => {
    if (busy) return;
    if (dirty) setConfirm(true);
    else onClose();
  };
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
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              event.preventDefault();
            }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-card p-5 shadow-xl sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-xl font-semibold">
                  {task ? 'Edit task' : 'Create task'}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                  Synthetic coordination work only. Review the details before
                  saving.
                </Dialog.Description>
              </div>
              <Button
                variant="ghost"
                aria-label="Close task editor"
                disabled={busy}
                onClick={close}
              >
                Close
              </Button>
            </div>
            <TaskForm
              task={task}
              draft={draft}
              onClose={close}
              onSaved={onSaved}
              onDirty={setDirty}
              onBusy={setBusy}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <UnsavedChangesDialog
        open={confirm}
        busy={busy}
        onKeep={() => {
          setConfirm(false);
        }}
        onDiscard={() => {
          if (busy) return;
          setDirty(false);
          onClose();
        }}
      />
      {!onDirty && <TaskNavigationGuard dirty={dirty} busy={busy} />}
    </>
  );
}
// Patient profiles already own a blocker; they receive dirty/busy callbacks instead.
function TaskNavigationGuard({
  dirty,
  busy,
}: {
  dirty: boolean;
  busy: boolean;
}) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || busy) && currentLocation.pathname !== nextLocation.pathname,
  );
  return (
    <UnsavedChangesDialog
      open={blocker.state === 'blocked'}
      busy={busy}
      onKeep={() => {
        if (blocker.state === 'blocked') blocker.reset();
      }}
      onDiscard={() => {
        if (!busy && blocker.state === 'blocked') blocker.proceed();
      }}
    />
  );
}
