import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DecisionStatus } from '../../eligibility/components/decision-status';
import {
  formatRuleValue,
  programStatusLabels,
} from '../../eligibility/ui/decision-presentation';
import type { DeepReadonly } from '../../eligibility/domain/types';
import { statuses } from '../domain/population';
import type { AnalysisSnapshot } from '../hooks/use-population-impact';
export function PopulationDashboard({
  snapshot,
  transition,
  sort,
  page,
  onUpdate,
}: {
  snapshot: DeepReadonly<AnalysisSnapshot>;
  transition: string;
  sort: string;
  page: number;
  onUpdate: (patch: Record<string, string | null>) => void;
}) {
  const result = snapshot.result;
  const patients = useMemo(
    () =>
      result.patients
        .filter(
          (patient) =>
            transition === 'all' ||
            (transition === 'changed'
              ? patient.changed
              : patient.transition === transition),
        )
        .sort((a, b) => {
          const order =
            (snapshot.names[a.patientId] ?? a.patientId).localeCompare(
              snapshot.names[b.patientId] ?? b.patientId,
            ) || a.patientId.localeCompare(b.patientId);
          return sort === 'name_desc' ? -order : order;
        }),
    [result.patients, snapshot.names, transition, sort],
  );
  const pages = Math.max(1, Math.ceil(patients.length / 10)),
    current = Math.min(page, pages);
  const visible = patients.slice((current - 1) * 10, current * 10);
  const metrics = [
    ['Population records', result.total],
    ['Patients evaluated', result.evaluated],
    ['Evaluation errors', result.errors.length],
    ['Changed status', result.changed],
    ['Unchanged status', result.unchanged],
    ['Became eligible', result.becameEligible],
    ['Became ineligible', result.becameIneligible],
    ['Into Needs Information', result.intoNeedsInformation],
    ['Out of Needs Information', result.outOfNeedsInformation],
  ] as const;
  return (
    <section aria-label="Population impact results" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Population impact</h2>
        <p className="mt-2 text-sm">
          {snapshot.baseline.name} · Baseline {snapshot.baseline.policyVersion}{' '}
          → Comparison {snapshot.comparison.policyVersion}
        </p>
        <p className="mt-1 break-words text-xs text-muted-foreground">
          Evaluation date {snapshot.evaluationDate} · Analyzed{' '}
          {snapshot.analyzedAt} · {snapshot.snapshotId} ·{' '}
          {snapshot.durationMs.toFixed(1)} ms
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p role="status" className="text-sm">
        {result.evaluated} patients evaluated: {result.changed} changed,{' '}
        {result.unchanged} unchanged. {result.errors.length} records reported
        separately as errors.
      </p>
      {!result.total && <p>No synthetic patient records are available.</p>}
      {!!result.evaluated && !result.changed && (
        <p>No eligibility statuses changed between these versions.</p>
      )}
      <section aria-label="Eligibility transition matrix">
        <h3 className="mb-3 font-semibold">Eligibility transition matrix</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Rows: baseline. Columns: comparison. Select any count to filter
          patients. Diagonal cells have unchanged status.
        </p>
        <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
          <caption className="sr-only">
            All nine eligibility transitions for the captured population
          </caption>
          <thead>
            <tr>
              <th scope="col" className="border p-2">
                Baseline / comparison
              </th>
              {statuses.map((status) => (
                <th scope="col" className="break-words border p-1" key={status}>
                  {programStatusLabels[status]}
                </th>
              ))}
              <th scope="col" className="border p-1">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((before) => (
              <tr key={before}>
                <th scope="row" className="break-words border p-1 text-left">
                  {programStatusLabels[before]}
                </th>
                {statuses.map((after) => {
                  const key = `${before}->${after}`,
                    count = result.matrix[before][after];
                  return (
                    <td key={after} className="border p-1 text-center">
                      <button
                        className="min-h-11 w-full rounded-md font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                        aria-label={`${programStatusLabels[before]} to ${programStatusLabels[after]}: ${count} patients`}
                        aria-pressed={transition === key}
                        onClick={() =>
                          onUpdate({
                            transition: key,
                            page: '1',
                            patient: null,
                          })
                        }
                      >
                        {count}
                        <span className="sr-only">
                          {' '}
                          {before === after ? 'unchanged' : 'changed'}
                        </span>
                      </button>
                    </td>
                  );
                })}
                <td className="border p-1 text-center">
                  {statuses.reduce(
                    (sum, after) => sum + result.matrix[before][after],
                    0,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="border p-1 text-left">
                Total
              </th>
              {statuses.map((after) => (
                <td className="border p-1 text-center" key={after}>
                  {statuses.reduce(
                    (sum, before) => sum + result.matrix[before][after],
                    0,
                  )}
                </td>
              ))}
              <td className="border p-1 text-center font-semibold">
                {result.evaluated}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
      <section aria-label="Affected patients">
        <h3 className="mb-3 font-semibold">Affected patients</h3>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="text-sm">
            Transition filter
            <select
              className="mt-1 block min-h-11 max-w-full rounded-md border bg-card p-2"
              value={transition}
              onChange={(event) =>
                onUpdate({
                  transition: event.target.value,
                  page: '1',
                  patient: null,
                })
              }
            >
              <option value="changed">Changed status only</option>
              <option value="all">All evaluated patients</option>
              {statuses.flatMap((before) =>
                statuses.map((after) => (
                  <option
                    key={`${before}->${after}`}
                    value={`${before}->${after}`}
                  >
                    {programStatusLabels[before]} → {programStatusLabels[after]}
                  </option>
                )),
              )}
            </select>
          </label>
          <label className="text-sm">
            Patient sort
            <select
              className="mt-1 block min-h-11 rounded-md border bg-card p-2"
              value={sort}
              onChange={(event) =>
                onUpdate({ sort: event.target.value, page: '1' })
              }
            >
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
            </select>
          </label>
        </div>
        <p aria-live="polite" className="mb-3 text-sm">
          {patients.length} matching patients · Page {current} of {pages}
        </p>
        {!patients.length && <p>No patients match this transition filter.</p>}
        {!!visible.length && (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Patient impacts for the selected transition
                </caption>
                <thead>
                  <tr>
                    {[
                      'Patient',
                      'Patient ID',
                      'State',
                      'Household size',
                      'Annual income',
                      'Baseline',
                      'Comparison',
                      'Transition',
                      'Inspect',
                    ].map((label) => (
                      <th scope="col" className="border-b p-3" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((patient) => (
                    <tr key={patient.patientId}>
                      <th scope="row" className="border-b p-3 font-medium">
                        {snapshot.names[patient.patientId]}
                      </th>
                      <td className="border-b p-3">{patient.patientId}</td>
                      <td className="border-b p-3">
                        {patient.context.state ?? 'Unknown'}
                      </td>
                      <td className="border-b p-3">
                        {patient.context.householdSize ?? 'Unknown'}
                      </td>
                      <td className="border-b p-3">
                        {formatRuleValue(
                          patient.context.annualHouseholdIncomeCents ?? null,
                          'annualHouseholdIncomeCents',
                        )}
                      </td>
                      <td className="border-b p-3">
                        <DecisionStatus status={patient.baseline.status} />
                      </td>
                      <td className="border-b p-3">
                        <DecisionStatus status={patient.comparison.status} />
                      </td>
                      <td className="border-b p-3">
                        {programStatusLabels[patient.baseline.status]} →{' '}
                        {programStatusLabels[patient.comparison.status]}
                      </td>
                      <td className="border-b p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Inspect ${patient.patientId}`}
                          onClick={() =>
                            onUpdate({ patient: patient.patientId })
                          }
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {visible.map((patient) => (
                <article
                  className="rounded-lg border p-4"
                  key={patient.patientId}
                >
                  <h4 className="font-semibold">
                    {snapshot.names[patient.patientId]}
                  </h4>
                  <p className="mt-2 text-xs">
                    {patient.patientId} ·{' '}
                    {patient.context.state ?? 'Unknown state'} · Household{' '}
                    {patient.context.householdSize ?? 'Unknown'}
                  </p>
                  <p className="mt-2 text-sm">
                    Annual income:{' '}
                    {formatRuleValue(
                      patient.context.annualHouseholdIncomeCents ?? null,
                      'annualHouseholdIncomeCents',
                    )}
                  </p>
                  <p className="my-3 text-sm">
                    {programStatusLabels[patient.baseline.status]} →{' '}
                    {programStatusLabels[patient.comparison.status]}
                  </p>
                  <Button
                    variant="outline"
                    aria-label={`Inspect ${patient.patientId}`}
                    onClick={() => onUpdate({ patient: patient.patientId })}
                  >
                    Inspect impact
                  </Button>
                </article>
              ))}
            </div>
          </>
        )}
        <nav
          aria-label="Patient impact pagination"
          className="mt-4 flex flex-wrap gap-3"
        >
          <Button
            variant="outline"
            aria-label="Previous impact page"
            disabled={current <= 1}
            onClick={() =>
              onUpdate({ page: String(current - 1), patient: null })
            }
          >
            Previous
          </Button>
          <Button
            variant="outline"
            aria-label="Next impact page"
            disabled={current >= pages}
            onClick={() =>
              onUpdate({ page: String(current + 1), patient: null })
            }
          >
            Next
          </Button>
        </nav>
      </section>
      {!!result.errors.length && (
        <section
          aria-label="Population evaluation errors"
          className="rounded-lg border p-4"
        >
          <h3 className="font-semibold">Records requiring correction</h3>
          <p className="mt-2 text-sm">
            These records are excluded from the nine valid transitions, never
            counted as Needs Information.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {result.errors.map((error) => (
              <li key={error.recordKey}>
                {error.patientName} · {error.patientId ?? error.recordKey}:{' '}
                {error.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
