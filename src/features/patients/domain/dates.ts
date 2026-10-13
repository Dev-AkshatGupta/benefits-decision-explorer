// Calendar dates are YYYY-MM-DD. "Today" and timestamp formatting use UTC.
const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || !value.endsWith('Z'))
    throw new RangeError('Expected a UTC timestamp.');
  return timestampFormatter.format(date) + ' UTC';
}
export function isCalendarDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function calculateAge(dateOfBirth: string, asOf = todayUtc()): number {
  if (
    !isCalendarDate(dateOfBirth) ||
    !isCalendarDate(asOf) ||
    dateOfBirth > asOf
  )
    throw new RangeError(
      'Age requires valid calendar dates and a non-future birth date.',
    );
  const birthYear = Number(dateOfBirth.slice(0, 4));
  const currentYear = Number(asOf.slice(0, 4));
  // A February 29 birthday advances on March 1 in non-leap years.
  return (
    currentYear - birthYear - (asOf.slice(5) < dateOfBirth.slice(5) ? 1 : 0)
  );
}
export function formatDate(value: string): string {
  const calendar = isCalendarDate(value);
  if (
    !calendar &&
    (!isCalendarDate(value.slice(0, 10)) ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?Z$/.test(
        value,
      ))
  )
    throw new RangeError('Expected an ISO calendar date or UTC timestamp.');
  const date = new Date(calendar ? value + 'T00:00:00.000Z' : value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date.');
  return dateFormatter.format(date);
}
