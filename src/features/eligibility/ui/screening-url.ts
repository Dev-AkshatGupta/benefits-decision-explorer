import { isCalendarDate, todayUtc } from '../../patients/domain/dates';
const id = (value: string | null) =>
  value && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : '';
export function readScreeningParams(search: URLSearchParams) {
  return {
    patientId: id(search.get('patientId')),
    programId: id(search.get('programId')),
    date: search.get('date') ?? todayUtc(),
    programs: search.has('programs')
      ? [
          ...new Set(
            (search.get('programs') ?? '')
              .split(',')
              .map((value) => id(value))
              .filter(Boolean),
          ),
        ]
      : null,
  };
}
export function screeningReturnPath(state: unknown): string | null {
  if (
    !state ||
    typeof state !== 'object' ||
    !('screeningReturnSearch' in state) ||
    typeof state.screeningReturnSearch !== 'string'
  )
    return null;
  const params = readScreeningParams(
    new URLSearchParams(state.screeningReturnSearch),
  );
  if (!params.patientId) return null;
  const search = new URLSearchParams({ patientId: params.patientId });
  if (isCalendarDate(params.date)) search.set('date', params.date);
  if (params.programId) search.set('programId', params.programId);
  if (params.programs !== null)
    search.set('programs', params.programs.join(','));
  return '/eligibility?' + search.toString();
}
