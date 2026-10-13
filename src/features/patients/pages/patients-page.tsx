import { useCallback, useEffect } from 'react';
import { useLocation } from 'react-router';
import { UserRoundCheck } from 'lucide-react';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { usePatients } from '../api/patient-queries';
import { usePatientWorklistParams } from '../hooks/use-patient-worklist-params';
import type { WorklistSort } from '../utils/worklist-params';
import { PatientMetrics } from '../components/patient-metrics';
import { PatientSearch } from '../components/patient-search';
import { PatientFilters } from '../components/patient-filters';
import { PatientTable } from '../components/patient-table';
import { PatientCard } from '../components/patient-card';
import { PatientTableSkeleton } from '../components/patient-table-skeleton';
import { PatientEmptyState } from '../components/patient-empty-state';
import { PatientPagination } from '../components/patient-pagination';
// Matches the fictional coordinator identity already shown in the shell.
const currentCoordinatorId = 'coordinator-001';
export function PatientsPage() {
  const { params, update, clear, hasFilters } = usePatientWorklistParams();
  const query = usePatients(params);
  const pageNeedsCorrection = Boolean(
    query.data &&
    query.data.pagination.totalItems > 0 &&
    query.data.pagination.page > query.data.pagination.totalPages,
  );
  const { search } = useLocation();
  const onSearch = useCallback(
    (value: string) => update({ search: value }),
    [update],
  );
  const sort = (field: WorklistSort) =>
    update({
      sortBy: field,
      sortOrder:
        params.sortBy === field && params.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  useEffect(() => {
    if (
      query.data &&
      !query.isPlaceholderData &&
      !query.isFetching &&
      params.page > Math.max(1, query.data.pagination.totalPages)
    )
      update({ page: Math.max(1, query.data.pagination.totalPages) }, true);
  }, [
    query.data,
    query.isPlaceholderData,
    query.isFetching,
    params.page,
    update,
  ]);
  return (
    <PageContainer>
      <PageHeader
        title="Patients"
        description="Manage patients and coordinate benefits assistance."
        actions={
          <Button
            variant={
              params.coordinatorId === currentCoordinatorId
                ? 'default'
                : 'outline'
            }
            aria-pressed={params.coordinatorId === currentCoordinatorId}
            onClick={() =>
              update({
                coordinatorId:
                  params.coordinatorId === currentCoordinatorId
                    ? undefined
                    : currentCoordinatorId,
              })
            }
          >
            <UserRoundCheck size={16} aria-hidden="true" />
            Assigned to me
          </Button>
        }
      />
      <PatientMetrics />
      <section
        aria-label="Patient worklist"
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className="space-y-4 p-4 sm:p-5">
          <PatientSearch search={params.search} onSearch={onSearch} />
          <PatientFilters
            params={params}
            onUpdate={update}
            onClear={clear}
            hasFilters={hasFilters}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" role="status">
              {query.isFetching && query.data
                ? 'Updating results…'
                : query.data
                  ? query.data.pagination.totalItems + ' matching patients'
                  : query.isError
                    ? 'Patient list unavailable'
                    : 'Finding patients…'}
            </p>
            <div className="flex items-center gap-2 md:hidden">
              <label htmlFor="mobile-sort" className="text-xs">
                Sort by
              </label>
              <select
                id="mobile-sort"
                className="form-control max-w-40"
                value={params.sortBy}
                onChange={(event) => sort(event.target.value as WorklistSort)}
              >
                <option value="lastUpdated">Last updated</option>
                <option value="fullName">Patient name</option>
                <option value="age">Age</option>
              </select>
              <Button
                variant="outline"
                className="min-h-11"
                aria-label={
                  'Sort ' +
                  (params.sortOrder === 'asc' ? 'descending' : 'ascending')
                }
                onClick={() =>
                  update({
                    sortOrder: params.sortOrder === 'asc' ? 'desc' : 'asc',
                  })
                }
              >
                {params.sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
              </Button>
            </div>
          </div>
        </div>
        {query.isError && (
          <div role="alert" className="border-t p-5">
            <h2 className="font-semibold">Unable to load patients</h2>
            <p className="my-3 text-sm text-muted-foreground">
              Please try again. Your search and filters have been preserved.
            </p>
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
        <div aria-busy={query.isFetching}>
          {query.isPending || pageNeedsCorrection ? (
            <PatientTableSkeleton pageSize={params.pageSize} />
          ) : query.data?.data.length ? (
            <>
              <PatientTable
                patients={query.data.data}
                params={params}
                onSort={sort}
                worklistSearch={search}
              />
              <ul
                aria-label="Patient cards"
                className="space-y-3 border-t bg-background p-3 md:hidden"
              >
                {query.data.data.map((patient) => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    worklistSearch={search}
                  />
                ))}
              </ul>
            </>
          ) : query.data ? (
            <PatientEmptyState filtered={hasFilters} onClear={clear} />
          ) : null}
        </div>
        {query.data && !pageNeedsCorrection && (
          <PatientPagination
            pagination={query.data.pagination}
            pageSize={params.pageSize}
            busy={query.isFetching || query.isPlaceholderData}
            onPage={(page) => update({ page })}
            onPageSize={(pageSize) => update({ pageSize })}
          />
        )}
      </section>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        Synthetic patient records only. No actual public-benefits
        determinations.
      </p>
    </PageContainer>
  );
}
