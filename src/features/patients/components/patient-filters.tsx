import { Button } from '@/components/ui/button';
import { useCoordinators } from '../api/patient-queries';
import {
  patientListParamsSchema,
  patientStatuses,
  usStates,
  type PatientListQuery,
} from '../domain/schemas';
import { statusLabels } from '../domain/patient-status';
import { useEffect } from 'react';
export function PatientFilters({
  params,
  onUpdate,
  onClear,
  hasFilters,
}: {
  params: PatientListQuery;
  onUpdate: (patch: Partial<PatientListQuery>, replace?: boolean) => void;
  onClear: () => void;
  hasFilters: boolean;
}) {
  const coordinators = useCoordinators();
  useEffect(() => {
    if (
      coordinators.data &&
      params.coordinatorId &&
      !coordinators.data.some((item) => item.id === params.coordinatorId)
    )
      onUpdate({ coordinatorId: undefined }, true);
  }, [coordinators.data, params.coordinatorId, onUpdate]);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="status-filter"
            className="mb-2 block text-xs font-medium"
          >
            Patient status
          </label>
          <select
            id="status-filter"
            className="form-control w-full"
            value={params.status ?? ''}
            onChange={(event) => {
              const parsed = patientListParamsSchema.shape.status.parse(
                event.target.value || undefined,
              );
              onUpdate({ status: parsed });
            }}
          >
            <option value="">All statuses</option>
            {patientStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="state-filter"
            className="mb-2 block text-xs font-medium"
          >
            U.S. state
          </label>
          <select
            id="state-filter"
            className="form-control w-full"
            value={params.state ?? ''}
            onChange={(event) =>
              onUpdate({
                state: patientListParamsSchema.shape.state.parse(
                  event.target.value || undefined,
                ),
              })
            }
          >
            <option value="">All states</option>
            {usStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="coordinator-filter"
            className="mb-2 block text-xs font-medium"
          >
            Care coordinator
          </label>
          <select
            id="coordinator-filter"
            className="form-control w-full"
            value={params.coordinatorId ?? ''}
            disabled={!coordinators.data}
            onChange={(event) =>
              onUpdate({ coordinatorId: event.target.value || undefined })
            }
          >
            <option value="">
              {coordinators.isPending
                ? 'Loading coordinators…'
                : 'All coordinators'}
            </option>
            {params.coordinatorId && !coordinators.data && (
              <option value={params.coordinatorId}>Selected coordinator</option>
            )}
            {coordinators.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.firstName} {item.lastName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            variant="ghost"
            disabled={!hasFilters}
            onClick={onClear}
            className="min-h-11 w-full sm:w-auto"
          >
            Clear filters
          </Button>
        </div>
      </div>
      {coordinators.isError && (
        <div role="alert" className="mt-3 text-sm">
          <p>Coordinator filters are unavailable.</p>
          <Button variant="outline" onClick={() => void coordinators.refetch()}>
            Retry coordinators
          </Button>
        </div>
      )}
    </>
  );
}
