import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/common/page-container';
import { Button } from '@/components/ui/button';
import { demoPolicyRegistry } from '../../eligibility/policies/registry';
import { isCalendarDate } from '../../patients/domain/dates';
import { comparePolicyVersions } from '../domain/policy-diff';
import { statuses } from '../domain/population';
import { usePopulationImpact } from '../hooks/use-population-impact';
import { readPolicyParams } from '../ui/policy-url';
import { RuleDifferences } from '../components/rule-differences';
import { PopulationDashboard } from '../components/population-dashboard';
import { PatientImpactInspector } from '../components/patient-impact-inspector';
const programs = [
  ...new Map(
    demoPolicyRegistry.map((policy) => [policy.id, policy.name]),
  ).entries(),
];
export function PoliciesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useSearchParams(),
    params = readPolicyParams(search);
  const versions = demoPolicyRegistry.filter(
    (policy) => policy.id === params.program,
  );
  const baseline = versions.find(
      (policy) => policy.policyVersion === params.baseline,
    ),
    comparison = versions.find(
      (policy) => policy.policyVersion === params.comparison,
    );
  const valid =
    !!baseline &&
    !!comparison &&
    baseline.policyVersion !== comparison.policyVersion &&
    isCalendarDate(params.date);
  const diff =
    baseline &&
    comparison &&
    baseline.policyVersion !== comparison.policyVersion
      ? comparePolicyVersions(baseline, comparison)
      : null;
  const analysis = usePopulationImpact();
  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(search);
    if (!next.has('date')) next.set('date', params.date);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setSearch(next, { replace: true });
  }
  const transition = [
    'all',
    'changed',
    ...statuses.flatMap((before) =>
      statuses.map((after) => `${before}->${after}`),
    ),
  ].includes(params.transition)
    ? params.transition
    : 'changed';
  const snapshot = analysis.snapshot;
  const outdated =
    !!snapshot &&
    (snapshot.baseline.id !== params.program ||
      snapshot.baseline.policyVersion !== params.baseline ||
      snapshot.comparison.policyVersion !== params.comparison ||
      snapshot.evaluationDate !== params.date ||
      (!!analysis.freshness.data &&
        snapshot.snapshotId !== analysis.freshness.data.snapshotId));
  const patient = snapshot?.result.patients.find(
    (record) => record.patientId === params.patient,
  );
  const selectorClass =
    'mt-2 block min-h-11 w-full rounded-md border bg-card p-2 text-sm disabled:opacity-60';
  return (
    <PageContainer>
      <div className="space-y-7">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('policiesPageTitle')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('policiesPageDescription')}
          </p>
        </header>
        <p className="rounded-lg border bg-muted/40 p-4 text-xs leading-6">
          {t('policyDisclaimer')}
        </p>
        <section
          aria-label={t('policyVersionSelection')}
          className="rounded-lg border bg-card p-4 sm:p-6"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="text-sm font-medium">
              {t('benefitProgram')}
              <select
                className={selectorClass}
                value={params.program}
                disabled={analysis.busy}
                onChange={(event) =>
                  update({
                    program: event.target.value,
                    baseline: null,
                    comparison: null,
                    patient: null,
                    transition: null,
                    page: null,
                  })
                }
              >
                <option value="">{t('selectFictionalProgram')}</option>
                {programs.map(([id, name]) => (
                  <option value={id} key={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {(['baseline', 'comparison'] as const).map((side) => (
              <label className="text-sm font-medium" key={side}>
                {side === 'baseline'
                  ? t('baselineVersion')
                  : t('comparisonVersion')}
                <select
                  className={selectorClass}
                  value={params[side]}
                  disabled={analysis.busy || versions.length < 2}
                  onChange={(event) => update({ [side]: event.target.value })}
                >
                  <option value="">{t('selectVersion')}</option>
                  {versions.map((policy) => (
                    <option
                      key={policy.policyVersion}
                      value={policy.policyVersion}
                    >
                      {policy.policyVersion} · {policy.effectiveFrom} –{' '}
                      {policy.effectiveTo ?? 'ongoing'}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <label className="text-sm font-medium">
              {t('populationEvaluationDate')}
              <input
                type="date"
                className={selectorClass}
                value={params.date}
                disabled={analysis.busy}
                onChange={(event) => update({ date: event.target.value })}
              />
            </label>
            <Button
              variant="outline"
              disabled={
                analysis.busy ||
                !baseline ||
                !comparison ||
                baseline.policyVersion === comparison.policyVersion
              }
              onClick={() =>
                update({
                  baseline: params.comparison,
                  comparison: params.baseline,
                  patient: null,
                  transition: null,
                  page: null,
                })
              }
            >
              {t('swapVersions')}
            </Button>
            <Button
              id="population-analysis-action"
              disabled={!valid || analysis.busy}
              onClick={async () => {
                if (baseline && comparison && valid) {
                  await analysis.run(baseline, comparison, params.date);
                  update({ patient: null, page: '1' });
                }
              }}
            >
              {analysis.busy
                ? t('loadingAnalyzing')
                : t('runPopulationAnalysis')}
            </Button>
          </div>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            Counterfactual comparison: both versions evaluate the same patient
            snapshot on this single date. Historical policy dates do not change
            patient ages; effective-period restrictions are explicitly bypassed
            for this comparison.
          </p>
          {!params.program && (
            <p className="mt-3 text-sm">
              Select a program to compare its versions.
            </p>
          )}
          {!!params.program && !versions.length && (
            <p role="alert" className="mt-3 text-sm">
              The selected program is unavailable.
            </p>
          )}
          {versions.length === 1 && (
            <p className="mt-3 text-sm">
              This program has fewer than two versions available.
            </p>
          )}
          {!!params.baseline &&
            !!params.comparison &&
            params.baseline === params.comparison && (
              <p role="alert" className="mt-3 text-sm">
                Choose two distinct policy versions.
              </p>
            )}
          {versions.length > 1 &&
            ((!!params.baseline && !baseline) ||
              (!!params.comparison && !comparison)) && (
              <p role="alert" className="mt-3 text-sm">
                A selected version does not belong to this program. Select valid
                versions.
              </p>
            )}
          {!isCalendarDate(params.date) && (
            <p role="alert" className="mt-3 text-sm">
              Choose a valid evaluation date.
            </p>
          )}
        </section>
        {diff && (
          <RuleDifferences
            key={`${params.program}:${params.baseline}:${params.comparison}`}
            diff={diff}
          />
        )}
        {analysis.error && (
          <p role="alert" className="rounded-lg border p-4 text-sm">
            {analysis.error}
          </p>
        )}
        {outdated && (
          <p role="alert" className="rounded-lg border bg-muted p-4 text-sm">
            Analysis outdated. Selections, evaluation date, or population
            changed. Rerun analysis. Results below retain their original
            snapshot and version labels.
          </p>
        )}
        {snapshot && analysis.freshness.isError && (
          <div role="alert" className="rounded-lg border p-4 text-sm">
            Population freshness could not be verified. Results reflect the
            captured snapshot.
            <Button
              variant="outline"
              className="ml-3"
              onClick={() => void analysis.freshness.refetch()}
            >
              Retry freshness check
            </Button>
          </div>
        )}
        {snapshot && (
          <PopulationDashboard
            snapshot={snapshot}
            transition={transition}
            sort={params.sort}
            page={params.page}
            onUpdate={update}
          />
        )}
        {!snapshot && params.patient && (
          <p className="text-sm">
            This link preserves comparison selections. Run analysis to inspect
            the current population.
          </p>
        )}
        {patient && snapshot && (
          <PatientImpactInspector
            patient={patient}
            snapshot={snapshot}
            outdated={outdated}
            returnSearch={search.toString()}
            onClose={() => update({ patient: null })}
          />
        )}
      </div>
    </PageContainer>
  );
}
