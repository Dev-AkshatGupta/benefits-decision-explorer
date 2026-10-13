import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/common/page-container';
import { PatientSearch } from '../../patients/components/patient-search';
import { demoPolicyRegistry } from '../../eligibility/policies/registry';
import { useLocalToday } from '../../tasks/hooks/use-local-today';
import {
  coverageFiltersSchema,
  coverageStatuses,
  renewalStages,
  coverageLabels,
} from '../domain/coverage';
import {
  useCoverageRecords,
  useUpcomingRenewals,
  useCoverageOverview,
  usePatientPeriods,
  usePatientTimelineEvents,
} from '../api/coverage-queries';
import { CoverageTable } from '../components/coverage-table';
import { CoverageTimeline } from '../components/coverage-timeline';
import { CoverageDetails } from '../components/coverage-details';
import { CoverageEditor } from '../components/coverage-editor';
const programs = [
  ...new Map(
    demoPolicyRegistry.map((program) => [program.id, program.name]),
  ).entries(),
];
export function CoveragePage() {
  const [params, setParams] = useSearchParams(),
    today = useLocalToday(),
    [creating, setCreating] = useState(false),
    [message, setMessage] = useState('');
  const raw = Object.fromEntries(params);
  for (const key of [
    'record',
    'timeline',
    'rPage',
    'createTask',
    'rSortBy',
    'rSortOrder',
  ])
    delete raw[key];
  const parsed = coverageFiltersSchema.safeParse({
      ...raw,
      date: raw.date ?? today,
    }),
    filter = parsed.success
      ? parsed.data
      : coverageFiltersSchema.parse({ date: today });
  const renewalParsed = coverageFiltersSchema.safeParse({
    ...filter,
    urgency: params.get('urgency') ? filter.urgency : ('urgent' as const),
    sortBy: params.get('rSortBy') ?? 'renewalDueDate',
    sortOrder: params.get('rSortOrder') ?? 'asc',
    page: params.get('rPage') ?? 1,
  });
  const renewalFilter = renewalParsed.success
    ? renewalParsed.data
    : coverageFiltersSchema.parse({
        date: filter.date,
        urgency: 'urgent',
        sortBy: 'renewalDueDate',
        sortOrder: 'asc',
      });
  const records = useCoverageRecords(
      { ...filter, urgency: 'all' },
      parsed.success,
    ),
    renewals = useUpcomingRenewals(
      renewalFilter,
      parsed.success && renewalParsed.success,
    ),
    overview = useCoverageOverview(filter.date),
    periods = usePatientPeriods(params.get('timeline') ?? '');
  const recordId = params.get('record') ?? '';
  const timelineEvents = usePatientTimelineEvents(params.get('timeline') ?? '');
  function change(patch: Record<string, string | null>) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) {
          if (!value) next.delete(key);
          else next.set(key, value);
        }
        if (
          Object.keys(patch).some((key) =>
            [
              'date',
              'search',
              'patientId',
              'programId',
              'status',
              'renewalStatus',
              'urgency',
              'from',
              'to',
              'sortBy',
              'sortOrder',
              'rSortBy',
              'rSortOrder',
            ].includes(key),
          )
        ) {
          next.set('page', '1');
          next.set('rPage', '1');
        }
        return next;
      },
      { replace: true },
    );
  }
  const select = (
    key: 'status' | 'renewalStatus' | 'urgency' | 'sortBy' | 'sortOrder',
    label: string,
    values: readonly string[],
  ) => (
    <label className="text-xs">
      {label}
      <select
        aria-label={label}
        className="form-control mt-2 w-full"
        value={
          key === 'urgency' ? (params.get('urgency') ?? 'urgent') : filter[key]
        }
        onChange={(event) => change({ [key]: event.target.value })}
      >
        {values.map((value) => (
          <option key={value} value={value}>
            {coverageLabels[value] ??
              (
                {
                  all: 'All',
                  urgent: 'Overdue, today and next 30 days',
                  startDate: 'Coverage start',
                  endDate: 'Coverage end',
                  renewalDueDate: 'Renewal due',
                  updatedAt: 'Last updated',
                  asc: 'Ascending',
                  desc: 'Descending',
                } as Record<string, string>
              )[value] ??
              value}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <PageContainer>
      <div className="space-y-6">
        <header className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Coverage &amp; Renewals
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Track demonstration coverage periods, renewal deadlines, and
              follow-up activity.
            </p>
          </div>

          <Button onClick={() => setCreating(true)}>Create Coverage</Button>
        </header>
        <p className="rounded-lg border bg-muted/40 p-4 text-xs">
          Demonstration only. Coverage periods and patient records are
          fictional. Screening is not confirmed coverage or enrollment. No
          recorded coverage does not prove lack of real-world insurance.
        </p>
        {message && <p role="status">{message}</p>}
        <p className="text-xs">
          Global totals use all recorded patients and programs on {filter.date};
          filters below affect worklists.
        </p>
        {overview.isPending ? (
          <p role="status">Loading coverage overview…</p>
        ) : overview.isError ? (
          <div role="alert">
            Coverage overview could not load.
            <Button variant="outline" onClick={() => void overview.refetch()}>
              Retry overview
            </Button>
          </div>
        ) : (
          overview.data && (
            <dl
              aria-label="Coverage overview"
              className="grid grid-cols-2 gap-3 lg:grid-cols-5"
            >
              {(
                [
                  [
                    'Patients with active records',
                    overview.data.activePatients,
                  ],
                  [
                    'Records expiring in 30 days',
                    overview.data.expiringRecords,
                  ],
                  ['Renewals due today / 30 days', overview.data.dueRenewals],
                  ['Overdue renewals', overview.data.overdueRenewals],
                  ['Patients with bounded gaps', overview.data.gapPatients],
                ] as const
              ).map(([label, count]) => (
                <div className="rounded-lg border bg-card p-4" key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-2 text-2xl font-semibold">{count}</dd>
                </div>
              ))}
            </dl>
          )
        )}
        <section
          aria-label="Coverage filters"
          className="space-y-4 rounded-lg border bg-card p-4"
        >
          <PatientSearch
            search={filter.search}
            onSearch={(value) => change({ search: value })}
            label="Search coverage patients"
            placeholder="Patient name, patient ID or fictional program"
          />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <label className="text-xs">
              Evaluation date
              <input
                className="form-control mt-2 w-full"
                type="date"
                value={filter.date}
                onChange={(event) => change({ date: event.target.value })}
              />
            </label>
            <label className="text-xs">
              Patient ID
              <input
                className="form-control mt-2 w-full"
                value={filter.patientId}
                onChange={(event) => change({ patientId: event.target.value })}
              />
            </label>
            <label className="text-xs">
              Program
              <select
                className="form-control mt-2 w-full"
                aria-label="Program"
                value={filter.programId}
                onChange={(event) => change({ programId: event.target.value })}
              >
                <option value="">All fictional programs</option>
                {programs.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {select('status', 'Coverage status', ['all', ...coverageStatuses])}
            {select('renewalStatus', 'Renewal stage', [
              'all',
              ...renewalStages,
            ])}
            {select('urgency', 'Renewal urgency', [
              'all',
              'urgent',
              'overdue',
              'due_today',
              'due_soon',
              'later',
              'completed',
              'none',
            ])}
            {(['from', 'to'] as const).map((key) => (
              <label className="text-xs" key={key}>
                {key === 'from' ? 'From date' : 'Through date'}
                <input
                  type="date"
                  className="form-control mt-2 w-full"
                  value={filter[key] ?? ''}
                  onChange={(event) => change({ [key]: event.target.value })}
                />
              </label>
            ))}
            {select('sortBy', 'Coverage sort', [
              'startDate',
              'endDate',
              'renewalDueDate',
              'updatedAt',
            ])}
            {select('sortOrder', 'Coverage sort direction', ['asc', 'desc'])}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs">
              Renewal sort
              <select
                aria-label="Renewal sort"
                className="form-control mt-2 w-full"
                value={renewalFilter.sortBy}
                onChange={(event) => change({ rSortBy: event.target.value })}
              >
                {['renewalDueDate', 'endDate', 'updatedAt'].map((value) => (
                  <option value={value} key={value}>
                    {
                      {
                        renewalDueDate: 'Renewal deadline',
                        endDate: 'Coverage end',
                        updatedAt: 'Last updated',
                      }[value as 'renewalDueDate' | 'endDate' | 'updatedAt']
                    }
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Renewal sort direction
              <select
                aria-label="Renewal sort direction"
                className="form-control mt-2 w-full"
                value={renewalFilter.sortOrder}
                onChange={(event) => change({ rSortOrder: event.target.value })}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
          <p className="text-xs">
            Date ranges apply to period start in Coverage Records and deadlines
            in Renewals. Renewal urgency affects the renewal worklist only; it
            defaults to overdue/today/next 30 days sorted by deadline ascending.
          </p>
          <Button variant="outline" onClick={() => setParams({})}>
            Reset coverage filters
          </Button>
        </section>
        {!parsed.success || !renewalParsed.success ? (
          <p role="alert">
            Invalid coverage filters or dates. Reset filters to continue.
          </p>
        ) : (
          <>
            {[
              {
                query: renewals,
                title: 'Upcoming and overdue renewals',
                key: 'rPage',
                isRenewals: true,
              },
              {
                query: records,
                title: 'Coverage records',
                key: 'page',
                isRenewals: false,
              },
            ].map(({ query, title, key, isRenewals }) => (
              <section aria-label={title} key={key} className="space-y-4">
                <h2 className="text-xl font-semibold">{title}</h2>
                {query.isPending ? (
                  <p role="status">Loading {title.toLowerCase()}…</p>
                ) : query.isError ? (
                  <div role="alert">
                    {title} could not load.
                    <Button
                      variant="outline"
                      onClick={() => void query.refetch()}
                    >
                      Retry {title.toLowerCase()}
                    </Button>
                  </div>
                ) : (
                  query.data && (
                    <>
                      <p aria-live="polite" className="text-sm">
                        {query.data.pagination.totalItems} matching{' '}
                        {isRenewals ? 'renewals' : 'coverage records'} · Page{' '}
                        {query.data.pagination.page} of{' '}
                        {Math.max(1, query.data.pagination.totalPages)}
                      </p>
                      {query.data.data.length ? (
                        <CoverageTable
                          records={query.data.data}
                          date={filter.date}
                          renewals={isRenewals}
                          onOpen={(id) => change({ record: id })}
                          onTimeline={(id) => change({ timeline: id })}
                          onTask={(id) =>
                            change({ record: id, createTask: '1' })
                          }
                        />
                      ) : (
                        <p className="text-sm">
                          {isRenewals
                            ? 'No renewals match this worklist.'
                            : 'No coverage records match. This is not proof of being uninsured.'}
                        </p>
                      )}
                      <nav
                        aria-label={title + ' pagination'}
                        className="flex gap-3"
                      >
                        <Button
                          variant="outline"
                          disabled={query.data.pagination.page <= 1}
                          onClick={() =>
                            change({
                              [key]: String(query.data!.pagination.page - 1),
                            })
                          }
                        >
                          Previous {isRenewals ? 'renewal' : 'coverage'} page
                        </Button>
                        <Button
                          variant="outline"
                          disabled={
                            query.data.pagination.page >=
                            query.data.pagination.totalPages
                          }
                          onClick={() =>
                            change({
                              [key]: String(query.data!.pagination.page + 1),
                            })
                          }
                        >
                          Next {isRenewals ? 'renewal' : 'coverage'} page
                        </Button>
                      </nav>
                    </>
                  )
                )}
              </section>
            ))}
          </>
        )}
        {params.get('timeline') && (
          <section
            aria-label="Selected patient timeline"
            className="space-y-4 rounded-lg border bg-card p-4"
          >
            <p className="text-sm">Patient {params.get('timeline')}</p>
            <Button
              variant="outline"
              onClick={() => change({ timeline: null })}
            >
              Close timeline
            </Button>
            {periods.isPending ? (
              <p role="status">Loading patient coverage timeline…</p>
            ) : periods.isError ? (
              <div role="alert">
                Patient not found or timeline could not load.
                <Button
                  variant="outline"
                  onClick={() => void periods.refetch()}
                >
                  Retry timeline
                </Button>
              </div>
            ) : (
              periods.data && (
                <CoverageTimeline
                  records={periods.data}
                  date={filter.date}
                  events={timelineEvents.data ?? []}
                  onOpen={(id) => change({ record: id })}
                />
              )
            )}
          </section>
        )}
        {params.get('timeline') && timelineEvents.isError && (
          <p role="alert">
            Timeline events could not load.{' '}
            <Button
              variant="outline"
              onClick={() => void timelineEvents.refetch()}
            >
              Retry timeline events
            </Button>
          </p>
        )}
        {creating && (
          <CoverageEditor
            patientId={filter.patientId}
            onClose={() => setCreating(false)}
            onSaved={(record) => {
              setCreating(false);
              setMessage('Synthetic coverage record saved.');
              change({ record: record.id });
            }}
          />
        )}
        {recordId && !creating && (
          <CoverageDetails
            id={recordId}
            date={filter.date}
            autoOpenTask={params.get('createTask') === '1'}
            onTaskConsumed={() => change({ createTask: null })}
            onClose={() => change({ record: null })}
          />
        )}
      </div>
    </PageContainer>
  );
}
