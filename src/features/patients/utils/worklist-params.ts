import {
  patientListParamsSchema,
  type PatientListQuery,
} from '../domain/schemas';
export type WorklistSort = 'fullName' | 'age' | 'lastUpdated';
export function readWorklistParams(search: URLSearchParams): PatientListQuery {
  const valid: Record<string, unknown> = {
    sortBy: 'lastUpdated',
    sortOrder: 'desc',
  };
  for (const key of Object.keys(patientListParamsSchema.shape) as Array<
    keyof typeof patientListParamsSchema.shape
  >) {
    const raw = search.get(key);
    if (raw === null || search.getAll(key).length > 1) continue;
    const parsed = patientListParamsSchema.shape[key].safeParse(raw);
    if (parsed.success) valid[key] = parsed.data;
  }
  if (![10, 20, 50].includes(Number(valid.pageSize ?? 20))) valid.pageSize = 20;
  if (!['fullName', 'age', 'lastUpdated'].includes(String(valid.sortBy)))
    valid.sortBy = 'lastUpdated';
  return patientListParamsSchema.parse(valid);
}
export function writeWorklistParams(params: PatientListQuery): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (
      value === undefined ||
      value === '' ||
      (key === 'page' && value === 1) ||
      (key === 'pageSize' && value === 20) ||
      (key === 'sortBy' && value === 'lastUpdated') ||
      (key === 'sortOrder' && value === 'desc')
    )
      continue;
    search.set(key, String(value));
  }
  return search;
}
export function worklistReturnPath(state: unknown): string {
  if (
    state &&
    typeof state === 'object' &&
    'worklistSearch' in state &&
    typeof state.worklistSearch === 'string'
  ) {
    const search = writeWorklistParams(
      readWorklistParams(new URLSearchParams(state.worklistSearch)),
    ).toString();
    return '/patients' + (search ? '?' + search : '');
  }
  return '/patients';
}
