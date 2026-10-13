import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import {
  usePatient,
  usePatientHousehold,
} from '../../../patients/api/patient-queries';
import { useScreeningSession } from '../../ui/screening-session-context';
import { readScreeningParams } from '../../ui/screening-url';
import type { ScreeningSnapshot } from '../../ui/screening-snapshot';
import { useEligibilitySimulation } from '../hooks/use-eligibility-simulation';
import { SimulationInputs } from '../components/simulation-inputs';
import { SimulationImpact } from '../components/simulation-impact';
function BaselineRequired({
  patientId,
  returnPath,
}: {
  patientId: string;
  returnPath: string;
}) {
  const patient = usePatient(patientId),
    household = usePatientHousehold(patientId);
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">
        A baseline screening is required
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        No matching screening snapshot is available in this session. Refreshing
        does not preserve previous results. Review the selected patient and
        explicitly run a new baseline screening before simulating.
      </p>
      {!patientId ? (
        <p className="mt-4 text-sm">Select a patient on the screening page.</p>
      ) : patient.isPending ? (
        <p role="status" className="mt-4">
          Loading selected patient…
        </p>
      ) : patient.isError ? (
        <div role="alert" className="mt-4">
          <p>
            {patient.error instanceof ApiError && patient.error.status === 404
              ? 'Patient not found.'
              : 'Patient information could not be loaded.'}
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => void patient.refetch()}
          >
            Retry patient
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-4 font-medium">
            {patient.data.firstName} {patient.data.lastName} · {patient.data.id}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            State: {patient.data.address.state} · Household size:{' '}
            {household.data?.householdSize ?? 'Unknown'}
          </p>
          {household.isPending && (
            <p role="status" className="mt-3 text-sm">
              Loading household…
            </p>
          )}
          {household.isError && (
            <div role="alert" className="mt-3 text-sm">
              <p>
                Household information could not be loaded. Review it during
                baseline screening.
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => void household.refetch()}
              >
                Retry household
              </Button>
            </div>
          )}
        </>
      )}
      <Button asChild className="mt-5">
        <Link to={returnPath}>Run a baseline screening</Link>
      </Button>
    </section>
  );
}
function SimulationWorkspace({
  snapshot,
  returnPath,
}: {
  snapshot: ScreeningSnapshot;
  returnPath: string;
}) {
  const [baseline] = useState(snapshot);
  const simulation = useEligibilitySimulation(baseline);
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
        <div className="min-w-0">
          <h2 className="break-words font-semibold">
            Baseline: {baseline.patientName} · {baseline.patientId}
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Evaluation date fixed at {baseline.context.evaluationDate} ·{' '}
            {baseline.programs.length} original program versions. This is the
            original screening snapshot, not a live patient view.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={returnPath}>Exit Simulation</Link>
        </Button>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <SimulationInputs
          baseline={baseline.context}
          draft={simulation.draft}
          errors={simulation.errors}
          onChange={simulation.update}
          onReset={simulation.reset}
        />
        <SimulationImpact
          baseline={baseline}
          comparisons={simulation.comparisons}
          context={simulation.context}
        />
      </div>
      <p className="mt-6 text-xs leading-6 text-muted-foreground">
        Overrides are aggregate assumptions. Income sources and household
        members remain unchanged; hypothetical age has no associated birth date.
        Child presence does not supply exact child ages or create member
        records. These demonstration outcomes do not guarantee approval or
        denial.
      </p>
    </>
  );
}
export function EligibilitySimulatorPage() {
  const [search] = useSearchParams(),
    params = readScreeningParams(search);
  const { snapshot } = useScreeningSession();
  const matching = snapshot?.patientId === params.patientId ? snapshot : null;
  const returnSearch = new URLSearchParams();
  if (params.patientId) returnSearch.set('patientId', params.patientId);
  returnSearch.set('date', matching?.context.evaluationDate ?? params.date);
  if (matching)
    returnSearch.set(
      'programs',
      matching.programs.map((program) => program.id).join(','),
    );
  else if (params.programs !== null)
    returnSearch.set('programs', params.programs.join(','));
  const returnPath = '/eligibility?' + returnSearch.toString();
  return (
    <PageContainer>
      <PageHeader
        title="What-if Eligibility Simulator"
        description="Explore hypothetical changes against the original demonstration policies."
      />
      <p className="mb-6 rounded-lg border bg-accent p-4 text-sm font-medium text-primary">
        Simulation Mode — Changes are not saved to the patient profile.
      </p>
      {matching ? (
        <SimulationWorkspace
          key={params.patientId}
          snapshot={matching}
          returnPath={returnPath}
        />
      ) : (
        <BaselineRequired
          patientId={params.patientId}
          returnPath={returnPath}
        />
      )}
    </PageContainer>
  );
}
