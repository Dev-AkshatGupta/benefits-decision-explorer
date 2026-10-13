import { useState, useRef, useId } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Link, useBlocker, useBeforeUnload } from 'react-router';
import { UnsavedChangesDialog } from '../../patients/components/profile/unsaved-changes-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  InputField,
  SelectField,
} from '../../patients/components/profile/form-fields';
import { useDialogFocus } from '../../tasks/hooks/use-dialog-focus';
import {
  useCoverageRecord,
  useCoverageEvents,
  useAddCoverageEvent,
  useUpdateCoverage,
} from '../api/coverage-queries';
import {
  coverageStatus,
  renewalUrgency,
  coverageLabels,
  renewalTransitions,
  eventTypes,
  createEventSchema,
  type CreateEvent,
  type CoverageRecord,
} from '../domain/coverage';
import { CoverageEditor } from './coverage-editor';
import { RenewalTask } from './renewal-task';
import { formatTimestamp } from '../../patients/domain/dates';
export function CoverageDetails({
  id,
  date,
  onClose,
  autoOpenTask = false,
  onTaskConsumed,
}: {
  id: string;
  date: string;
  onClose: () => void;
  autoOpenTask?: boolean;
  onTaskConsumed?: (() => void) | undefined;
}) {
  const query = useCoverageRecord(id),
    events = useCoverageEvents(id, query.isSuccess),
    update = useUpdateCoverage(),
    [editing, setEditing] = useState<CoverageRecord | null>(null),
    [eventForm, setEventForm] = useState(false),
    [message, setMessage] = useState(''),
    focus = useDialogFocus();
  const record = query.data;
  if (editing)
    return (
      <CoverageEditor
        record={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setMessage('Coverage updated.');
        }}
      />
    );
  const advance = async (stage: CoverageRecord['renewalStatus']) => {
    if (!record || update.isPending) return;
    try {
      await update.mutateAsync({
        id,
        updatedAt: record.updatedAt,
        value: { renewalStatus: stage },
      });
      setMessage('Renewal stage updated. Coverage dates remain unchanged.');
    } catch (failure) {
      setMessage(
        failure instanceof Error ? failure.message : 'Renewal update failed.',
      );
    }
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !update.isPending && !eventForm) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/50" />
        <Dialog.Content
          {...focus}
          className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-card p-5 shadow-xl sm:p-7"
          onEscapeKeyDown={(event) => {
            if (update.isPending || eventForm) event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-xl font-semibold">
              Coverage details
            </Dialog.Title>
            <Button
              variant="ghost"
              aria-label="Close coverage details"
              disabled={update.isPending || eventForm}
              onClick={onClose}
            >
              Close
            </Button>
          </div>
          <Dialog.Description className="mt-2 text-xs">
            Synthetic recorded coverage only. This is not verified insurance or
            enrollment.
          </Dialog.Description>
          {query.isPending ? (
            <p role="status" className="mt-5">
              Loading coverage…
            </p>
          ) : query.isError ? (
            <div role="alert" className="mt-5">
              Coverage record not found or could not load.
              <Button variant="outline" onClick={() => void query.refetch()}>
                Retry coverage
              </Button>
            </div>
          ) : (
            record && (
              <div className="mt-6 space-y-5">
                <h2 className="text-lg font-semibold">{record.programName}</h2>
                <p className="text-sm">
                  {record.patientId} · {record.id}
                </p>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  {[
                    [
                      'Coverage status',
                      coverageLabels[coverageStatus(record, date)],
                    ],
                    ['Start date', record.startDate],
                    ['End date', record.endDate ?? 'Open-ended'],
                    [
                      'Termination',
                      record.terminatedAt
                        ? record.terminatedAt + ' (day excluded)'
                        : 'Not recorded',
                    ],
                    ['Renewal due', record.renewalDueDate ?? 'Not recorded'],
                    ['Renewal stage', coverageLabels[record.renewalStatus]],
                    [
                      'Renewal urgency',
                      coverageLabels[renewalUrgency(record, date)],
                    ],
                    ['Last updated', formatTimestamp(record.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {record.notes || 'No notes.'}
                </p>
                {message && (
                  <p role="status" className="rounded-lg border p-3 text-sm">
                    {message}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={eventForm}
                    onClick={() => setEditing(record)}
                  >
                    Edit Coverage
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void query.refetch()}
                  >
                    Reload coverage
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      to={'/patients/' + encodeURIComponent(record.patientId)}
                    >
                      View Patient Profile
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      to={
                        '/tasks?status=all&coverageId=' +
                        encodeURIComponent(record.id)
                      }
                    >
                      View coverage tasks
                    </Link>
                  </Button>
                </div>
                <section aria-label="Update renewal stage">
                  <h3 className="mb-3 text-sm font-semibold">
                    Update Renewal Status
                  </h3>
                  <p className="mb-3 text-xs">
                    Overdue is derived from the deadline; it is not a workflow
                    stage. Completing a renewal stage does not extend its dates.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {renewalTransitions[record.renewalStatus].map((stage) => (
                      <Button
                        key={stage}
                        disabled={update.isPending}
                        variant="outline"
                        onClick={() => void advance(stage)}
                      >
                        Set renewal {coverageLabels[stage]}
                      </Button>
                    ))}
                    {!renewalTransitions[record.renewalStatus].length && (
                      <p className="text-sm">Renewal workflow completed.</p>
                    )}
                  </div>
                </section>
                {!eventForm && (
                  <RenewalTask
                    record={record}
                    autoOpen={autoOpenTask}
                    onConsumed={onTaskConsumed}
                  />
                )}
                <section aria-label="Coverage event history">
                  <h3 className="mb-3 font-semibold">Recorded event history</h3>
                  {events.isPending ? (
                    <p role="status">Loading recorded events…</p>
                  ) : events.isError ? (
                    <div role="alert">
                      Events could not load.
                      <Button
                        variant="outline"
                        onClick={() => void events.refetch()}
                      >
                        Retry events
                      </Button>
                    </div>
                  ) : events.data?.length ? (
                    <ol className="space-y-3">
                      {events.data.map((event) => (
                        <li
                          key={event.id}
                          className="rounded-lg border p-3 text-sm"
                        >
                          <p className="font-medium">
                            {coverageLabels[event.type]} · {event.eventDate}
                          </p>
                          <p className="my-2 whitespace-pre-wrap break-words">
                            {event.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Recorded {formatTimestamp(event.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm">
                      No recorded events. Editing a period does not fabricate
                      historical events.
                    </p>
                  )}
                </section>
                {eventForm ? (
                  <EventForm
                    id={id}
                    date={date}
                    onClose={() => setEventForm(false)}
                    onSaved={() => {
                      setEventForm(false);
                      setMessage(
                        'Coverage event recorded. Period dates and renewal stage remain unchanged.',
                      );
                    }}
                  />
                ) : (
                  <Button variant="outline" onClick={() => setEventForm(true)}>
                    Add Event
                  </Button>
                )}
              </div>
            )
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function EventForm({
  id,
  date,
  onClose,
  onSaved,
}: {
  id: string;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<CreateEvent>({
      resolver: zodResolver(createEventSchema),
      defaultValues: { type: 'note_added', eventDate: date, description: '' },
    }),
    mutation = useAddCoverageEvent(),
    guard = useRef(false),
    key = useRef({ signature: '', key: '' }),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState(false);
  const errorId = useId();
  const dirty = form.formState.isDirty;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || mutation.isPending) &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  useBeforeUnload((event) => {
    if (dirty || mutation.isPending) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  async function save(value: CreateEvent) {
    if (guard.current) return;
    guard.current = true;
    setError('');
    const signature = JSON.stringify(value);
    if (key.current.signature !== signature)
      key.current = { signature, key: crypto.randomUUID() };
    try {
      await mutation.mutateAsync({ id, value, key: key.current.key });
      onSaved();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Event could not save.',
      );
    } finally {
      guard.current = false;
    }
  }
  return (
    <>
      <form
        aria-label="Add coverage event"
        noValidate
        onSubmit={(event) => void form.handleSubmit(save)(event)}
        className="space-y-4 rounded-lg border p-4"
      >
        <SelectField
          label="Event type"
          registration={form.register('type')}
          disabled={mutation.isPending}
        >
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {coverageLabels[type]}
            </option>
          ))}
        </SelectField>
        <InputField
          type="date"
          label="Event date"
          registration={form.register('eventDate')}
          error={form.formState.errors.eventDate?.message}
          disabled={mutation.isPending}
        />
        <label className="block text-sm">
          Event description
          <textarea
            maxLength={2000}
            className="form-control mt-2 w-full"
            rows={3}
            {...form.register('description')}
            disabled={mutation.isPending}
            aria-invalid={!!form.formState.errors.description}
            aria-describedby={
              form.formState.errors.description ? errorId : undefined
            }
          />
        </label>
        {form.formState.errors.description && (
          <p id={errorId} role="alert">
            {form.formState.errors.description.message}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <p className="text-xs">
          Manual event entry only; not a tamper-proof audit log. Events do not
          change dates or renewal stages.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving event…' : 'Save event'}
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending}
            variant="outline"
            onClick={() => (dirty ? setConfirm(true) : onClose())}
          >
            Cancel event
          </Button>
        </div>
      </form>
      <UnsavedChangesDialog
        open={confirm || blocker.state === 'blocked'}
        busy={mutation.isPending}
        onKeep={() => {
          setConfirm(false);
          if (blocker.state === 'blocked') blocker.reset();
        }}
        onDiscard={() => {
          setConfirm(false);
          if (blocker.state === 'blocked') blocker.proceed();
          else onClose();
        }}
      />
    </>
  );
}
