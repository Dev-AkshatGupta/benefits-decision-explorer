import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import {
  patientQueryOptions,
  householdQueryOptions,
  usePatient,
  usePatientHousehold,
} from '../../patients/api/patient-queries';
import { formatCurrency } from '../../patients/domain/income';
import { isCalendarDate } from '../../patients/domain/dates';
import { buildEligibilityContext } from '../engine/context-builder';
import { selectPoliciesForDate } from '../engine/policy-selector';
import { screenPatient } from '../engine/screen-patient';
import { EligibilityEngineError } from '../engine/errors';
import { demoPolicyRegistry } from '../policies/registry';
import {
  createScreeningSnapshot,
  isSnapshotOutdated,
} from '../ui/screening-snapshot';
import { useScreeningSession } from '../ui/screening-session-context';
import { readScreeningParams } from '../ui/screening-url';
import { DecisionStatus } from '../components/decision-status';
import { PatientSelector } from '../components/patient-selector';
import { DecisionInspector } from '../components/decision-inspector';

const catalog = [
  ...new Map(
    demoPolicyRegistry.map((program) => [program.id, program]),
  ).values(),
];
const allIds = catalog.map((program) => program.id);
function screeningError(error: unknown): string {
  if (error instanceof EligibilityEngineError) {
    if (error.code === 'POLICY_NOT_APPLICABLE')
      return 'A selected demonstration program has no policy effective on this date. Change the date or select other programs.';
    if (error.code === 'INVALID_CONTEXT')
      return 'The patient and household information cannot be evaluated consistently. Review the patient profile before screening.';
    return 'The demonstration policy configuration could not be evaluated. No decision was produced.';
  }
  return 'Current patient information could not be loaded. Retry screening when the connection is available.';
}
export function EligibilityPage() {
  const [search, setSearch] = useSearchParams();
  const params = readScreeningParams(search);
  const selectedIds = (params.programs ?? allIds).filter((id) =>
    allIds.includes(id),
  );
  const patient = usePatient(params.patientId),
    household = usePatientHousehold(params.patientId);
  const client = useQueryClient();
  const { snapshot: saved, setSnapshot } = useScreeningSession();
  const snapshot = saved?.patientId === params.patientId ? saved : null;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const guard = useRef(false),
    mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (search.has('date')) return;
    const next = new URLSearchParams(search);
    next.set('date', params.date);
    setSearch(next, { replace: true });
  }, [params.date, search, setSearch]);
  const update = (patch: Record<string, string | null>) => {
    setError('');
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return next;
    });
  };
  const householdMissing =
    household.error instanceof ApiError && household.error.status === 404;
  const outdated = snapshot
    ? isSnapshotOutdated(
        snapshot,
        patient.data,
        household.data,
        householdMissing,
        params.date,
        selectedIds,
      )
    : false;
  const selectedResult = snapshot?.results.find(
    (result) => result.programId === params.programId,
  );
  const selectedPolicy = snapshot?.programs.find(
    (program) => program.id === params.programId,
  );
  const canRun = Boolean(
    params.patientId &&
    patient.data &&
    !patient.isError &&
    !household.isPending &&
    (!household.isError || householdMissing) &&
    selectedIds.length &&
    isCalendarDate(params.date) &&
    !busy &&
    !patient.isFetching &&
    !household.isFetching,
  );
  const run = async () => {
    if (!canRun || guard.current) return;
    guard.current = true;
    setBusy(true);
    setError('');
    try {
      const programs = selectPoliciesForDate(
        demoPolicyRegistry,
        params.date,
        selectedIds,
      );
      const [currentPatient, currentHousehold] = await Promise.all([
        client.fetchQuery({
          ...patientQueryOptions(params.patientId),
          staleTime: 0,
        }),
        client
          .fetchQuery({
            ...householdQueryOptions(params.patientId),
            staleTime: 0,
          })
          .catch((failure: unknown) => {
            if (failure instanceof ApiError && failure.status === 404)
              return null;
            throw failure;
          }),
      ]);
      if (!mounted.current) return;
      const context = buildEligibilityContext(
        currentPatient,
        currentHousehold,
        params.date,
      );
      const results = screenPatient(programs, context);
      setSnapshot(
        createScreeningSnapshot(
          currentPatient,
          currentHousehold,
          context,
          programs,
          results,
        ),
      );
      if (
        params.programId &&
        !results.some((result) => result.programId === params.programId)
      )
        update({ programId: null });
    } catch (failure) {
      if (mounted.current) setError(screeningError(failure));
    } finally {
      guard.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const profilePath = '/patients/' + encodeURIComponent(params.patientId);
  return (
    <PageContainer>
      <PageHeader
        title="Eligibility Screening"
        description="Screen patients against demonstration benefit-program policies."
      />
      <p className="mb-6 rounded-lg border bg-accent px-4 py-3 text-xs leading-6 text-primary">
        Demonstration only. Results are based on fictional policies and are not
        official benefit eligibility determinations.
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PatientSelector
          patientId={params.patientId}
          disabled={busy}
          onSelect={(id) => update({ patientId: id || null, programId: null })}
        />
        <section
          aria-labelledby="screening-context-title"
          className="rounded-xl border bg-card p-5 sm:p-6"
        >
          <h2 id="screening-context-title" className="text-lg font-semibold">
            Patient &amp; household summary
          </h2>
          {!params.patientId ? (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Select a synthetic patient to review the information used for
              screening.
            </p>
          ) : patient.isPending ? (
            <p role="status" className="mt-4 text-sm">
              Loading selected patient…
            </p>
          ) : patient.isError ? (
            <div role="alert" className="mt-4 text-sm">
              <p>
                {patient.error instanceof ApiError &&
                patient.error.status === 404
                  ? 'Selected patient not found.'
                  : 'Patient information could not be loaded.'}
              </p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => void patient.refetch()}
              >
                Retry selected patient
              </Button>
            </div>
          ) : (
            patient.data && (
              <>
                <p className="mt-4 break-words text-lg font-semibold">
                  {patient.data.firstName} {patient.data.lastName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {patient.data.id} · {patient.data.address.state}
                </p>
                <dl className="my-5 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Date of birth
                    </dt>
                    <dd className="mt-1">{patient.data.dateOfBirth}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Household size
                    </dt>
                    <dd className="mt-1">
                      {household.data?.householdSize ?? 'Unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Annual income available for screening
                    </dt>
                    <dd className="mt-1">
                      {household.data?.incomeInformationStatus === 'complete'
                        ? formatCurrency(household.data.totalAnnualIncome)
                        : 'Unknown — income report not complete'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Income information
                    </dt>
                    <dd className="mt-1 capitalize">
                      {household.data?.incomeInformationStatus ?? 'Unknown'}
                    </dd>
                  </div>
                </dl>
                {household.isPending && (
                  <p role="status" className="text-sm">
                    Loading household…
                  </p>
                )}
                {household.isError && (
                  <div role="alert" className="mb-4 text-sm">
                    <p>
                      {householdMissing
                        ? 'Household not found. Screening can identify the missing information.'
                        : 'Household information could not be loaded. Retry before screening.'}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-2"
                      onClick={() => void household.refetch()}
                    >
                      Retry household data
                    </Button>
                  </div>
                )}
                <Button asChild variant="outline">
                  <Link
                    to={profilePath}
                    state={{ screeningReturnSearch: search.toString() }}
                  >
                    Review patient profile
                  </Link>
                </Button>
              </>
            )
          )}
        </section>
      </div>
      <section
        aria-labelledby="select-programs-title"
        className="mt-6 rounded-xl border bg-card p-5 sm:p-6"
      >
        <h2 id="select-programs-title" className="text-lg font-semibold">
          2. Choose demonstration programs
        </h2>
        <div className="mt-4 max-w-xs">
          <label
            htmlFor="evaluation-date"
            className="mb-2 block text-sm font-medium"
          >
            Evaluation date
          </label>
          <input
            id="evaluation-date"
            type="date"
            className="form-control w-full"
            value={params.date}
            disabled={busy}
            onChange={(event) => update({ date: event.target.value })}
            aria-invalid={!isCalendarDate(params.date)}
          />
          {!isCalendarDate(params.date) && (
            <p role="alert" className="mt-2 text-sm text-warning">
              Choose a valid evaluation date.
            </p>
          )}
        </div>
        <fieldset disabled={busy} className="mt-5 grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Programs to screen</legend>
          {catalog.map((program) => (
            <label
              key={program.id}
              className={
                'flex cursor-pointer items-start gap-3 rounded-lg border p-4 ' +
                (selectedIds.includes(program.id)
                  ? 'border-primary bg-accent/40'
                  : '')
              }
            >
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-primary"
                checked={selectedIds.includes(program.id)}
                onChange={(event) =>
                  update({
                    programs: allIds
                      .filter((id) =>
                        id === program.id
                          ? event.target.checked
                          : selectedIds.includes(id),
                      )
                      .join(','),
                  })
                }
              />
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold">
                  {program.name}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {program.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            id="screening-action"
            className="min-h-11"
            disabled={!canRun}
            onClick={() => void run()}
          >
            <ClipboardCheck size={17} aria-hidden="true" />
            {busy
              ? 'Screening…'
              : snapshot
                ? 'Rerun screening'
                : 'Run screening'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {!params.patientId
              ? 'Select a patient to continue.'
              : !selectedIds.length
                ? 'Select at least one program.'
                : `${selectedIds.length} programs selected. Screening runs only when requested.`}
          </p>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-warning">
            {error}
          </p>
        )}
      </section>
      <section aria-labelledby="screening-results-title" className="mt-8">
        <h2 id="screening-results-title" className="text-xl font-semibold">
          Screening results
        </h2>
        {snapshot ? (
          <>
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {snapshot.results.length} programs screened for{' '}
              {snapshot.patientName} on {snapshot.context.evaluationDate}.
            </p>
            <Button asChild variant="outline" className="mt-4 min-h-11">
              <Link
                to={
                  '/eligibility/simulator?' +
                  new URLSearchParams({ patientId: snapshot.patientId })
                }
              >
                Explore What-if Scenarios
              </Link>
            </Button>
            {outdated && (
              <p
                role="status"
                className="mt-4 rounded-lg border bg-warning-muted p-4 text-sm text-warning"
              >
                <strong>Outdated results.</strong> Patient information or
                screening inputs have changed. Rerun screening to evaluate
                current information. These cards retain the original snapshot.
              </p>
            )}
            <div className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(['eligible', 'ineligible', 'needs_information'] as const).map(
                (status) => (
                  <div key={status} className="rounded-lg border bg-card p-4">
                    <DecisionStatus status={status} />
                    <p className="mt-2 text-2xl font-semibold">
                      {
                        snapshot.results.filter(
                          (result) => result.status === status,
                        ).length
                      }
                    </p>
                  </div>
                ),
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {snapshot.results.map((result) => (
                <article
                  key={result.programId}
                  aria-label={result.programName}
                  className="rounded-xl border bg-card p-5"
                >
                  <DecisionStatus status={result.status} />
                  <h3 className="mt-4 break-words text-lg font-semibold">
                    {result.programName}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Policy {result.policyVersion} · {result.passedRules} passed
                    · {result.failedRules} failed · {result.unknownRules}{' '}
                    unknown
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {result.status === 'needs_information'
                      ? 'Some required information is missing. Inspect the decision to review what is needed.'
                      : result.status === 'ineligible'
                        ? 'The evaluated information does not meet this fictional policy’s configured requirements.'
                        : 'The evaluated information meets this fictional policy’s configured requirements.'}
                  </p>
                  <Button
                    id={'inspect-' + result.programId}
                    aria-label={'Inspect Decision for ' + result.programName}
                    variant="outline"
                    className="mt-4 min-h-11"
                    onClick={() => update({ programId: result.programId })}
                  >
                    Inspect Decision
                    <span className="sr-only"> for {result.programName}</span>
                  </Button>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            No screening results for this patient in the current session. Select
            a patient and run screening to view demonstration outcomes.
          </p>
        )}
        {params.programId && (!selectedResult || !selectedPolicy) && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            No matching decision is available in this session. Run screening
            with the requested program selected, then inspect its result.
            Results are not retained after a page refresh.
          </p>
        )}
      </section>
      {snapshot && selectedResult && selectedPolicy && (
        <DecisionInspector
          key={selectedResult.programId}
          snapshot={snapshot}
          program={selectedPolicy}
          result={selectedResult}
          outdated={outdated}
          onClose={() => update({ programId: null })}
          onRerun={() => void run()}
          busy={busy}
          canRerun={canRun}
          profilePath={profilePath}
          returnSearch={search.toString()}
        />
      )}
    </PageContainer>
  );
}
