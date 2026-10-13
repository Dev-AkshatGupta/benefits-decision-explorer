# Coverage timeline and renewals

All coverage periods, events, coordinators and patients are fictional demonstration data. Recorded coverage is not verified insurance or enrollment, and eligibility screening never creates coverage records automatically. This independent portfolio project is not affiliated with ITO Health.

## Functionality

`/coverage` contains full-population metrics, a renewal worklist, coverage records, debounced patient/program search, URL filters, separate sorting/pagination controls, explicit creation/editing, record details, patient timelines, event entry and reviewed renewal task creation. Desktop uses semantic tables; mobile uses cards and full-width sheets. Existing layout, design tokens, patient selector, form components, task editor, focus handling and date utilities are reused. No dependencies are added.

Creation is explicit, with React Hook Form/Zod validation. Patient/program identifiers remain fixed during editing. Pending submissions are guarded; unchanged retries retain their request key. Failed writes preserve drafts. Coverage edits require the captured update timestamp; stale writes return a conflict. Unsaved coverage changes require confirmation before closing or navigating away. Existing screening, simulation, policy comparison and task workflows are retained.

## Date semantics

Coverage/renewal/termination/event dates are validated `YYYY-MM-DD` calendar dates. Created/updated/event-recorded timestamps are UTC ISO instants. Pure functions require an explicit evaluation/reference date. The UI defaults to the existing local calendar-date hook; users may select another evaluation date without changing records.

- Start and stated end dates are inclusive.
- Termination excludes its date: the last covered day is the preceding calendar day.
- Upcoming means start is after the evaluation date.
- Active means start has occurred and neither the inclusive end nor effective termination has ended coverage.
- Expired means the stated end is before the evaluation date, unless termination occurred on/before the first day after that end.
- Terminated means effective termination has occurred. A later termination entered after an already expired period does not replace the earlier expiration.
- A termination on the start date creates no covered days.
- An absent end is open-ended unless termination supplies an effective end.

Coverage status is always derived; no mutable status field is stored. Changing renewal stage does not extend coverage or alter its derived status.

The selected date reclassifies currently recorded periods/deadlines; it does not reconstruct historical renewal workflow state.

## Bounded gaps

`detectCoverageGaps` groups records by patient and logical fictional program, sorts intervals, computes termination-adjusted ends, and merges overlaps and immediately adjacent days. Open-ended periods cover the remaining evaluated horizon. It reports only calendar-day intervals between two positive-length recorded periods whose starts have occurred by the evaluation date. It never reports an interval before the first period, after the last period, or from an empty record set. Future planned periods do not confirm a historical gap.

Coverage from another program cannot remove a gap in the selected program. Returned gaps carry patient/program identifiers and exact inclusive start/end dates. UI language identifies them as bounded gaps in demonstration records, never proof that a patient lacked real-world insurance. Patient-history gap derivation is cached by TanStack Query's stable selector; timeline gap calculations are memoized against records/reference date. Approximate gap-detection complexity is O(R log R) time and O(R) space.

## Renewal stages and urgency

Workflow stages are `not_started`, `in_progress`, `submitted`, `completed`. Allowed changes:

| From        | Allowed destinations   |
| ----------- | ---------------------- |
| Not started | In progress            |
| In progress | Submitted, Not started |
| Submitted   | Completed, In progress |
| Completed   | None                   |

The same stage is a harmless no-op in field updates. Completed is terminal for that recorded cycle; a subsequent period/cycle can be entered explicitly as another record. There is no automatic submission or renewal extension.

Urgency is derived separately: completed takes precedence; an absent deadline is “Deadline not recorded”; dates before the reference date are overdue, equal dates are due today, the next 30 days inclusive are due soon, and later dates are later. Calendar-day differences use UTC calendar coordinates only for arithmetic, never local-midnight conversions. Overdue does not change coverage status.

Renewal rows default to overdue/today/next-30-days and deadline ascending, with independent sorting/pagination. Renewal urgency affects that worklist, not the general coverage list. Shared date ranges apply to coverage starts in the coverage table and renewal deadlines in the renewal table. A “Deadline not recorded” filter explicitly exposes undated pending renewals. Other renewal views contain dated cycles; undated completed/historical records remain inspectable in coverage history.

## Global metrics

An aggregate repository query evaluates all records, rather than a paginated response:

- Patients with active records: unique patient identifiers with at least one active period.
- Records expiring in 30 days: active records whose stated end is today through reference date + 30.
- Renewals due today/30 days: noncompleted dated cycles due today through reference date + 30.
- Overdue renewals: noncompleted cycles with deadlines before the reference date.
- Patients with bounded gaps: unique patients with at least one program-specific historical gap.

Patient counts and record/cycle counts are labeled separately. Worklist filters do not change global totals.

## Timeline and event history

The lightweight SVG uses one proportional calendar-day axis for all selected patient periods, on separate lanes so overlap is visible. Inclusive ends are drawn to the next day's edge. Open-ended intervals are clipped to an explicit display horizon, with an arrow instead of an invented ending date. A reference-date marker, current renewal deadline diamonds and recorded event circles share the scale. Exact dates, source types and gap intervals are also available in readable chronological lists. SVG periods and list controls support keyboard selection.

Timeline bounds include period dates, current deadlines, recorded event dates and the evaluation horizon. Point markers do not imply additional covered duration. Long generated identifiers stay in accessible labels rather than widening mobile buttons. No chart library or virtualization is introduced.

Event history loads only when a record or patient timeline is opened. Timeline event retrieval uses a dedicated patient batch endpoint rather than individual requests for every period. Manual events are ordered by event date, created timestamp and identifier. Events do not modify coverage dates or renewal stages. Creation/edits/stage updates do not invent events; users explicitly record observations. This is session history, not a tamper-proof or legally auditable log.

## Mock API and data integrity

```text
GET   /api/coverage
GET   /api/coverage/summary
GET   /api/coverage/renewals
GET   /api/coverage/:coverageId
POST  /api/coverage
PATCH /api/coverage/:coverageId
GET   /api/coverage/:coverageId/events
POST  /api/coverage/:coverageId/events
GET   /api/patients/:patientId/coverage
GET   /api/patients/:patientId/coverage/timeline
GET   /api/patients/:patientId/coverage/events
```

Static summary/renewal endpoints are registered before dynamic record routes. Requests/responses use Zod and the existing Fetch/error contracts. List responses contain validated pagination metadata. Patient/program references must exist; program display names come from the fictional registry. Invalid end/termination dates and renewal transitions are rejected rather than repaired.

POST coverage/events uses bounded idempotency keys. Replays return the same entity; changed payloads under the same key conflict. Identical duplicate periods are also rejected. PATCH uses `If-Match`, and update timestamps advance monotonically. Editing does not rewrite existing events.

The deterministic fixture contains 260 periods across 130 of the existing 150 patients, plus 378 recorded events. Twenty patients intentionally have no coverage recorded. Data includes active, upcoming, expired, terminated, open-ended, adjacent/overlapping and gapped histories. Dates are anchored around October 9, 2026; tests inject that reference date. Session records/events/request metadata reset together between tests.

TanStack Query keys separate lists, renewals, global summary, record details, patient periods and event histories. Coverage writes cancel older detail reads, install authoritative data and invalidate the relevant lists, metrics and affected patient history. Event writes invalidate only record/patient event history. Patient name/coordinator changes refresh coverage row metadata. Task completion does not invalidate or mutate coverage because these are separate operations. No browser storage or duplicated global store is added.

Patient-period responses cap at 1,000 records and event responses at 2,000; current per-patient data is small. Larger histories would need a paged snapshot/timeline contract. Workspace lists remain server-paginated at ten rows by default.

## Patient and task integration

Patient profiles show Coverage History: active counts, recent periods, current renewal urgency and program-specific bounded gaps. They link to timelines/details and can open the reused task editor with the current patient fixed. The profile's existing dirty/pending navigation handling is reused for task drafts.

Create Renewal Follow-up Task works from renewal rows, coverage details and patient history. It prepopulates patient, `coverage_renewal` type, title/description, deadline and the patient's coordinator. The user reviews and explicitly saves. Task sources now include a validated coverage ID and optional deadline-cycle reference, without inventing a coverage event ID. Open tasks for the same record/deadline are deduplicated; ordinary POST replay protection also applies.

Coverage details link to filtered care tasks, and task details link back to source coverage. Completing a task changes only the task. Completing renewal stage changes only that stage. Neither operation extends period dates or creates enrollment.

## Verification and limitations

Use Node 24 and run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run format:check` and `npm run test:e2e`. On this Windows machine, browser verification uses installed Chrome with `$env:PLAYWRIGHT_CHANNEL = 'chrome'`.

Tests cover date/status boundaries, open ends, termination, overlap/adjacency, bounded gaps, missing records/deadlines, calendar arithmetic, all renewal transitions, full-population aggregates, validated pagination, reference integrity, idempotency, conflicts, explicit event history, reviewed task sources and independence of task/coverage completion. UI/E2E tests cover search, sorting/pagination, timeline keyboard selection, creation/errors, stage/event updates, patient profiles, direct renewal-row task review and mobile overflow.

Everything is synthetic and session-only. Reload restores fixtures. Development and the standalone demo start MSW; ordinary production builds require a compatible API. No backend is introduced. Real insurance verification, government enrollment, notification delivery, automated submissions, authentication and persistent audit history remain outside the scope. Accessibility checks do not replace a full assistive-technology audit.

Final verification, October 9, 2026, using Node 24:

| Check                                           | Result                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| TypeScript                                      | Passed                                                                                           |
| ESLint, zero warnings                           | Passed                                                                                           |
| Full Vitest suite                               | 454 tests passed across 29 files                                                                 |
| Coverage domain/API/UI tests                    | 41 passed                                                                                        |
| Production build                                | Passed; coverage-page chunk approximately 8.22 kB gzip                                           |
| Prettier                                        | Passed                                                                                           |
| Full Playwright desktop/mobile regression suite | 36 passed; 4 existing duplicate viewport tests intentionally skipped                             |
| Coverage browser journeys                       | All 4 passed; no runtime/console errors in the checked workflow                                  |
| Visual/layout review                            | Desktop and mobile screenshots reviewed; tested flows have no document-level horizontal overflow |

All requested verification commands could be executed. No package dependencies were added or upgraded. Coverage and renewal records remain fictional; external integrations are outside the current scope.
