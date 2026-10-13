import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  coverageStatus,
  coverageLabels,
  effectiveCoverageEnd,
  calendarOrdinal,
  detectCoverageGaps,
  type CoverageRecord,
  type CoverageEvent,
} from '../domain/coverage';
import { addCalendarDays } from '../../tasks/domain/tasks';
export function CoverageTimeline({
  records,
  date,
  onOpen,
  events = [],
}: {
  records: readonly CoverageRecord[];
  date: string;
  onOpen: (id: string) => void;
  events?: readonly CoverageEvent[];
}) {
  const gaps = useMemo(
    () => detectCoverageGaps(records, date),
    [records, date],
  );
  if (!records.length)
    return (
      <p className="rounded-lg border p-4 text-sm">
        No recorded coverage for this patient. This is not evidence that they
        were uninsured.
      </p>
    );
  const ordered = [...records].sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
  );
  const eventsByPeriod = new Map<string, CoverageEvent[]>();
  for (const event of events) {
    const bucket = eventsByPeriod.get(event.coverageId) ?? [];
    bucket.push(event);
    eventsByPeriod.set(event.coverageId, bucket);
  }
  const min = Math.min(
      calendarOrdinal(date),
      calendarOrdinal(ordered[0]!.startDate),
      ...events.map((event) => calendarOrdinal(event.eventDate)),
      ...records.flatMap((record) =>
        record.renewalDueDate ? [calendarOrdinal(record.renewalDueDate)] : [],
      ),
    ),
    max = Math.max(
      calendarOrdinal(addCalendarDays(date, 30)),
      ...ordered.map((record) =>
        calendarOrdinal(
          effectiveCoverageEnd(record)
            ? addCalendarDays(effectiveCoverageEnd(record)!, 1)
            : addCalendarDays(
                record.startDate > date ? record.startDate : date,
                30,
              ),
        ),
      ),
      ...events.map((event) =>
        calendarOrdinal(addCalendarDays(event.eventDate, 1)),
      ),
      ...records.flatMap((record) =>
        record.renewalDueDate
          ? [calendarOrdinal(addCalendarDays(record.renewalDueDate, 1))]
          : [],
      ),
    );
  const position = (value: string) =>
    15 + ((calendarOrdinal(value) - min) / (max - min || 1)) * 570;
  return (
    <section aria-label="Patient coverage timeline" className="space-y-5">
      <h2 className="text-lg font-semibold">Coverage timeline</h2>
      <p className="text-xs text-muted-foreground">
        Bars use one proportional calendar scale. Termination excludes its date.
        An arrow means an open-ended period continues beyond this view. Each
        numbered period can be selected below.
      </p>
      <svg
        role="group"
        aria-label="Chronological recorded coverage periods, with evaluation date marker"
        viewBox={`0 0 600 ${ordered.length * 36 + 35}`}
        className="w-full rounded-lg border bg-card"
      >
        <line
          x1={position(date)}
          x2={position(date)}
          y1="0"
          y2={ordered.length * 36 + 20}
          stroke="currentColor"
          strokeDasharray="4 3"
        />
        <text
          x={position(date)}
          y={ordered.length * 36 + 31}
          textAnchor="middle"
          fontSize="10"
        >
          Date {date}
        </text>
        {ordered.map((record, index) => {
          const end = effectiveCoverageEnd(record),
            x = position(record.startDate),
            width =
              end && end < record.startDate
                ? 0
                : Math.max(
                    0,
                    (end ? position(addCalendarDays(end, 1)) : 585) - x,
                  );
          return (
            <g
              key={record.id}
              role="button"
              tabIndex={0}
              aria-label={`Select period ${index + 1}: ${record.programName}, ${record.startDate} to ${end ?? 'ongoing'}`}
              onClick={() => onOpen(record.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(record.id);
                }
              }}
              className="cursor-pointer text-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <title>
                {record.programName}: {record.startDate} – {end ?? 'ongoing'}
              </title>
              <rect
                x={x}
                y={index * 36 + 12}
                width={width}
                height="18"
                fill="currentColor"
                opacity="0.65"
              />
              {record.renewalDueDate && (
                <path
                  d={`M ${position(record.renewalDueDate)} ${index * 36 + 8} l 5 5 l -5 5 l -5 -5 Z`}
                  fill="currentColor"
                >
                  <title>
                    Current renewal deadline {record.renewalDueDate}
                  </title>
                </path>
              )}
              {(eventsByPeriod.get(record.id) ?? []).map((event) => (
                <circle
                  key={event.id}
                  cx={position(event.eventDate)}
                  cy={index * 36 + 31}
                  r="3"
                  fill="currentColor"
                >
                  <title>
                    {coverageLabels[event.type]} {event.eventDate}:{' '}
                    {event.description}
                  </title>
                </circle>
              ))}
              <text x="3" y={index * 36 + 25} fontSize="10">
                {index + 1}
              </text>
              {!end && (
                <text x="575" y={index * 36 + 26} fill="currentColor">
                  →
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="text-xs">
        Scale: {new Date(min * 86400000).toISOString().slice(0, 10)} –{' '}
        {new Date(max * 86400000).toISOString().slice(0, 10)}. Diamond: current
        renewal deadline. Circle: recorded event. Bar rows correspond to the
        numbered periods below.
      </p>
      <p className="text-xs">
        Scale uses calendar days; exact period dates are listed below. Renewal
        deadlines and recorded events are listed chronologically.
      </p>
      {!!events.length && (
        <ol aria-label="Timeline recorded events" className="space-y-2 text-xs">
          {events.map((event) => (
            <li key={event.id} className="break-words">
              {event.eventDate} · {coverageLabels[event.type]} ·{' '}
              {event.description}{' '}
              <Button
                size="sm"
                variant="outline"
                aria-label={'Inspect event coverage ' + event.coverageId}
                onClick={() => onOpen(event.coverageId)}
              >
                Inspect period
              </Button>
            </li>
          ))}
        </ol>
      )}
      <ol aria-label="Chronological coverage alternative" className="space-y-3">
        {ordered.map((record, index) => (
          <li key={record.id} className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold">
              {index + 1}. {record.programName} ·{' '}
              {coverageLabels[coverageStatus(record, date)]}
            </h3>
            <p className="my-2 text-xs">
              Starts {record.startDate} · Ends {record.endDate ?? 'open-ended'}
              {record.terminatedAt
                ? ' · Termination ' + record.terminatedAt + ' (excluded)'
                : ''}{' '}
              · Renewal {record.renewalDueDate ?? 'not recorded'}
            </p>
            <Button
              variant="outline"
              size="sm"
              aria-label={'Open coverage ' + record.id}
              onClick={() => onOpen(record.id)}
            >
              Open coverage details
            </Button>
          </li>
        ))}
      </ol>
      <section aria-label="Program-specific recorded gaps">
        <h3 className="mb-2 text-sm font-semibold">
          Bounded gaps in recorded coverage
        </h3>
        {gaps.length ? (
          <ul className="space-y-2 text-sm">
            {gaps.map((gap) => (
              <li key={gap.programId + gap.startDate}>
                {gap.programId}: {gap.startDate} – {gap.endDate}, inclusive. A
                gap between recorded periods for this demonstration program.
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">
            No bounded gaps found in recorded periods through {date}. Absence of
            other records is not proof of being uninsured.
          </p>
        )}
      </section>
    </section>
  );
}
