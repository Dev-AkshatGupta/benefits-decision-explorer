import { todayUtc, isCalendarDate } from '../../patients/domain/dates';
export function readPolicyParams(search: URLSearchParams) {
  return {
    program: search.get('program') ?? '',
    baseline: search.get('baseline') ?? '',
    comparison: search.get('comparison') ?? '',
    date: search.get('date') ?? todayUtc(),
    transition: search.get('transition') ?? 'changed',
    patient: search.get('patient') ?? '',
    sort: search.get('sort') === 'name_desc' ? 'name_desc' : 'name_asc',
    page: /^[1-9][0-9]{0,5}$/.test(search.get('page') ?? '')
      ? Number(search.get('page'))
      : 1,
  };
}
export function policyReturnPath(state: unknown): string | null {
  if (
    !state ||
    typeof state !== 'object' ||
    !('policyReturnSearch' in state) ||
    typeof state.policyReturnSearch !== 'string'
  )
    return null;
  const params = readPolicyParams(
    new URLSearchParams(state.policyReturnSearch),
  );
  const query = new URLSearchParams();
  for (const key of [
    'program',
    'baseline',
    'comparison',
    'transition',
    'sort',
  ] as const)
    if (params[key]) query.set(key, params[key]);
  if (isCalendarDate(params.date)) query.set('date', params.date);
  query.set('page', String(params.page));
  return '/policies?' + query.toString();
}
