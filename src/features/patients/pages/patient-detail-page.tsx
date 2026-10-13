import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Link,
  useLocation,
  useParams,
  useBlocker,
  useBeforeUnload,
} from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import {
  usePatient,
  usePatientHousehold,
  useCoordinators,
} from '../api/patient-queries';
import { worklistReturnPath } from '../utils/worklist-params';
import { calculateAge, formatTimestamp } from '../domain/dates';
import { PatientStatusBadge } from '../components/patient-status-badge';
import { ProfileSection } from '../components/profile/profile-section';
import {
  PersonalInformation,
  ContactInformation,
  ProfileSummary,
} from '../components/profile/profile-overview';
import {
  HouseholdMembersView,
  HouseholdIncomeView,
} from '../components/profile/household-view';
import { ProfileEditor } from '../components/profile/profile-editor';
import { MembersEditor } from '../components/profile/members-editor';
import { IncomeEditor } from '../components/profile/income-editor';
import { UnsavedChangesDialog } from '../components/profile/unsaved-changes-dialog';
type Editing = 'profile' | 'members' | 'income' | null;
export function PatientDetailPage() {
  const { patientId = '' } = useParams(),
    { state } = useLocation();
  const patient = usePatient(patientId),
    household = usePatientHousehold(patientId),
    coordinators = useCoordinators();
  const [editing, setEditing] = useState<Editing>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [closeRequested, setCloseRequested] = useState(false),
    [notice, setNotice] = useState('');
  const blocker = useBlocker(dirty || busy);
  const navigationStarted = useRef(false);
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (dirty || busy) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty, busy],
    ),
  );
  useEffect(() => {
    if (blocker.state === 'unblocked') navigationStarted.current = false;
    if (
      blocker.state === 'blocked' &&
      !dirty &&
      !busy &&
      !navigationStarted.current
    ) {
      navigationStarted.current = true;
      blocker.proceed();
    }
  }, [blocker, dirty, busy]);
  const stopEditing = (message = '') => {
    const focusId = 'edit-' + editing;
    setEditing(null);
    setDirty(false);
    setBusy(false);
    setCloseRequested(false);
    setNotice(message);
    requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };
  const requestClose = () => {
    if (busy) return;
    if (dirty) setCloseRequested(true);
    else stopEditing();
  };
  const reloadPatient = async () => {
    const result = await patient.refetch();
    return result.isSuccess ? result.data : undefined;
  };
  const reloadHousehold = async () => {
    const result = await household.refetch();
    return result.isSuccess ? result.data : undefined;
  };
  const coordinator = coordinators.data?.find(
    (item) => item.id === patient.data?.assignedCoordinatorId,
  );
  const coordinatorName = coordinator
    ? coordinator.firstName + ' ' + coordinator.lastName
    : 'Not available';
  const missing =
    patient.error instanceof ApiError && patient.error.status === 404;
  const householdMissing =
    household.error instanceof ApiError && household.error.status === 404;
  const editorProps = {
    onDirty: setDirty,
    onBusy: setBusy,
    onCancel: () => stopEditing(),
    onDone: stopEditing,
  };
  return (
    <Dialog.Root
      open={editing === 'profile'}
      onOpenChange={(open) => {
        if (open) {
          setNotice('');
          setEditing('profile');
        } else requestClose();
      }}
    >
      <PageContainer>
        <Button asChild variant="outline" className="mb-7">
          <Link to={worklistReturnPath(state)}>← Back to patients</Link>
        </Button>
        {notice && (
          <p
            role="status"
            className="mb-5 rounded-lg border bg-accent p-4 text-sm text-primary"
          >
            {notice}
          </p>
        )}
        {patient.isPending ? (
          <div role="status" aria-label="Loading patient profile">
            <span className="sr-only">Loading patient profile…</span>
            <div aria-hidden="true" className="space-y-6">
              <div className="h-10 w-2/3 rounded bg-muted" />
              <div className="h-44 rounded-xl border bg-card" />
              <div className="h-44 rounded-xl border bg-card" />
            </div>
          </div>
        ) : patient.isError && !patient.data ? (
          <>
            <PageHeader
              title={missing ? 'Patient not found' : 'Unable to load patient'}
              description={
                missing
                  ? 'This patient record could not be found.'
                  : 'Please try again or return to your worklist.'
              }
            />
            {!missing && (
              <Button variant="outline" onClick={() => void patient.refetch()}>
                Retry
              </Button>
            )}
          </>
        ) : patient.data ? (
          <>
            <PageHeader
              title={patient.data.firstName + ' ' + patient.data.lastName}
              description={
                patient.data.id +
                ' · ' +
                calculateAge(patient.data.dateOfBirth) +
                ' years · ' +
                patient.data.address.state
              }
              actions={
                <Dialog.Trigger asChild>
                  <Button id="edit-profile" disabled={editing !== null}>
                    Edit Profile
                  </Button>
                </Dialog.Trigger>
              }
            />
            <div className="mb-7 flex flex-wrap items-center gap-3 text-sm">
              <PatientStatusBadge status={patient.data.status} />
              <span className="text-muted-foreground">
                Assigned to {coordinatorName}
              </span>
              <span className="text-muted-foreground">
                Updated{' '}
                <time dateTime={patient.data.updatedAt}>
                  {formatTimestamp(patient.data.updatedAt)}
                </time>
              </span>
            </div>
            {patient.isError && (
              <div role="alert" className="mb-5 text-sm">
                <p>Current profile information could not be refreshed.</p>
                <Button
                  variant="outline"
                  onClick={() => void patient.refetch()}
                >
                  Retry profile
                </Button>
              </div>
            )}
            {coordinators.isError && (
              <div role="alert" className="mb-5 text-sm">
                <p>Coordinator information could not be loaded.</p>
                <Button
                  variant="outline"
                  onClick={() => void coordinators.refetch()}
                >
                  Retry coordinators
                </Button>
              </div>
            )}
            {editing && (
              <p className="mb-5 text-sm text-muted-foreground">
                Save or cancel your current edits before editing another
                section.
              </p>
            )}
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <PersonalInformation patient={patient.data} />
                <ContactInformation patient={patient.data} />
              </div>
              {household.isPending ? (
                <div
                  role="status"
                  aria-label="Loading household"
                  className="h-40 rounded-xl border bg-card p-6"
                >
                  Loading household information…
                </div>
              ) : household.isError && !household.data ? (
                <ProfileSection title="Household information">
                  <p role="alert" className="text-sm text-muted-foreground">
                    {householdMissing
                      ? 'Household not found. The patient profile is still available.'
                      : 'Household information could not be loaded.'}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => void household.refetch()}
                  >
                    Retry household
                  </Button>
                </ProfileSection>
              ) : household.data ? (
                <>
                  {household.isError && (
                    <div role="alert" className="text-sm">
                      <p>Household information could not be refreshed.</p>
                      <Button
                        variant="outline"
                        onClick={() => void household.refetch()}
                      >
                        Retry household
                      </Button>
                    </div>
                  )}
                  <ProfileSection
                    title="Household Members"
                    action={
                      editing !== 'members' ? (
                        <Button
                          id="edit-members"
                          variant="outline"
                          disabled={editing !== null}
                          onClick={() => {
                            setNotice('');
                            setEditing('members');
                          }}
                        >
                          Edit household members
                        </Button>
                      ) : undefined
                    }
                  >
                    {editing === 'members' ? (
                      <MembersEditor
                        household={household.data}
                        {...editorProps}
                        onReload={reloadHousehold}
                      />
                    ) : (
                      <HouseholdMembersView household={household.data} />
                    )}
                  </ProfileSection>
                  <ProfileSection
                    title="Household Income"
                    action={
                      editing !== 'income' ? (
                        <Button
                          id="edit-income"
                          variant="outline"
                          disabled={editing !== null}
                          onClick={() => {
                            setNotice('');
                            setEditing('income');
                          }}
                        >
                          Edit household income
                        </Button>
                      ) : undefined
                    }
                  >
                    {editing === 'income' ? (
                      <IncomeEditor
                        household={household.data}
                        {...editorProps}
                        onReload={reloadHousehold}
                      />
                    ) : (
                      <HouseholdIncomeView household={household.data} />
                    )}
                  </ProfileSection>
                </>
              ) : null}
              <ProfileSummary
                patient={patient.data}
                household={household.data}
                coordinator={coordinatorName}
              />
            </div>
            <p className="mt-6 text-xs leading-6 text-muted-foreground">
              Fictional patient records only. No actual public-benefits
              determinations.
            </p>
          </>
        ) : null}
      </PageContainer>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90svh] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-5 shadow-xl sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                Edit patient profile
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                Update personal and contact information. Identifiers cannot be
                changed.
              </Dialog.Description>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label="Close profile editor"
              onClick={requestClose}
            >
              <X size={20} aria-hidden="true" />
            </Button>
          </div>
          {patient.data && (
            <ProfileEditor
              patient={patient.data}
              coordinators={coordinators.data ?? []}
              {...editorProps}
              onReload={reloadPatient}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
      <UnsavedChangesDialog
        busy={busy}
        open={blocker.state === 'blocked' || closeRequested}
        onKeep={() => {
          setCloseRequested(false);
          if (blocker.state === 'blocked') blocker.reset();
        }}
        onDiscard={() => {
          if (busy) return;
          stopEditing();
          if (blocker.state === 'blocked' && !navigationStarted.current) {
            navigationStarted.current = true;
            blocker.proceed();
          }
        }}
      />
    </Dialog.Root>
  );
}
