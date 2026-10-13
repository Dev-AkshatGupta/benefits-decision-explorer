import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import type { PatientListQuery } from '../domain/schemas';
import {
  readWorklistParams,
  writeWorklistParams,
} from '../utils/worklist-params';
export function usePatientWorklistParams() {
  const [search, setSearch] = useSearchParams();
  const params = readWorklistParams(search);
  const canonical = writeWorklistParams(params).toString();
  useEffect(() => {
    if (search.toString() !== canonical)
      setSearch(canonical, { replace: true });
  }, [search, canonical, setSearch]);
  const update = useCallback(
    (patch: Partial<PatientListQuery>, replace = false) => {
      setSearch(
        (current) =>
          writeWorklistParams({
            ...readWorklistParams(current),
            ...patch,
            page: patch.page ?? 1,
          }),
        { replace },
      );
    },
    [setSearch],
  );
  const clear = useCallback(
    () =>
      update({
        search: '',
        status: undefined,
        state: undefined,
        coordinatorId: undefined,
      }),
    [update],
  );
  return {
    params,
    update,
    clear,
    hasFilters: Boolean(
      params.search || params.status || params.state || params.coordinatorId,
    ),
  };
}
