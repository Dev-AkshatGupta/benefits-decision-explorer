# Care Coordination & Task Management — Step 11

This independent portfolio application uses synthetic patients, coordinators and tasks. It is not affiliated with ITO Health. Tasks do not contact people, enroll patients, change eligibility/coverage, or represent actual government benefit decisions.

## Functionality

`/tasks` now has global overview totals, URL-based server filters, debounced task-title/patient-name search, due-date/priority/update sorting, ten-row pagination, mobile cards, create/edit forms and a task detail sheet. It defaults to open tasks in ascending due-date order; undated tasks stay last in either direction. Filters cover status, priority, type, coordinator (including unassigned), patient ID, inclusive due-date ranges, overdue and upcoming work. Global totals remain independent of worklist filters.

Creation requires selecting a patient through the existing paginated remote selector, reviewing fields and explicitly saving. Coordinator choices come from the existing API. React Hook Form and Zod validate drafts; failures preserve entered values. Pending actions prevent repeat submissions. Unsaved edits trigger confirmation on Cancel/Escape and navigation away, with browser unload protection. Patient-profile editors reuse the profile's existing navigation blocker through callbacks, avoiding multiple router blockers. Identifiers and source references remain immutable during editing.

Task details show patient/coordinator links or names, dates, type, status, priority, description, completion details and optional structured source. Only valid status actions are shown. Cancellation requires confirmation and retains the record. Editing uses a captured update timestamp; conflicting writes return 409 and preserve the draft. Close/discard the editor, use Reload task, and reopen editing to review newer data. No optimistic task updates are used.

## Domain and lifecycle

`features/tasks/domain/tasks.ts` owns schemas, types, transitions, labels and pure calendar helpers. Task types: documentation, eligibility follow-up, patient outreach, coverage renewal and general. Priorities: low, medium, high and urgent. Descriptions serve as editable task notes; completion has a separate optional note.

| From        | Allowed destinations                       |
| ----------- | ------------------------------------------ |
| To do       | In progress, Blocked, Completed, Cancelled |
| In progress | Blocked, Completed, Cancelled              |
| Blocked     | In progress, Completed, Cancelled          |
| Completed   | In progress (reopen)                       |
| Cancelled   | To do (restore)                            |

Completion sets `completedAt` to the server's UTC ISO timestamp and records the optional note. Reopening clears both the timestamp and completion note. This convention is disclosed in confirmation; no previous completion/audit history is claimed. Editing an already completed task preserves its current completion data. All noncompleted tasks must have null completion timestamps and empty completion notes.

Source references are one small optional structured object: patient ID, fictional program ID, screening context (policy version and evaluation date), missing-field key from the engine allowlist, and a future coverage-event ID. Empty, unknown or malformed fields are rejected. Patient/source identity and existing coordinator/program/version references are checked by the mock repository. There is no invented historical screening-result identifier or polymorphic event system.

## Mock API and query contracts

| Endpoint                                  | Behavior                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| GET `/api/tasks`                          | Validated filters, sorting and pagination                                       |
| GET `/api/tasks/summary?today=YYYY-MM-DD` | Full repository totals: open, overdue, upcoming, high/urgent open and completed |
| GET `/api/tasks/:taskId`                  | Current task                                                                    |
| POST `/api/tasks`                         | Validated creation, reference checks, request idempotency                       |
| PATCH `/api/tasks/:taskId`                | Validated fields/transitions and concurrency check                              |
| DELETE `/api/tasks/:taskId`               | Soft cancellation of an open task; never destructive deletion                   |
| GET `/api/patients/:patientId/tasks`      | Same list contract scoped to an existing patient                                |

Mutations use the existing API error envelope and shared validated Fetch client. PATCH and DELETE require `If-Match` carrying the captured update timestamp. Update timestamps advance monotonically, including consecutive writes within one millisecond. POST requires a bounded idempotency key; replaying the same request returns the same task, while changed data under the same key returns a conflict. The form retains its key when retrying unchanged data after a failure. A separate duplicate check prevents two open follow-ups for the same patient/program/version/date/missing field, even from separate clicks or dialogs.

The session database includes 250 deterministic tasks and an in-memory idempotency map. Both reset with the existing repository reset function between tests. Fixtures distribute every task type across all statuses, priorities, coordinators and dates. Their due-date anchor is October 9, 2026; it stays fixed so results remain reproducible while live overdue classification follows the client's calendar date.

TanStack Query keys separate workspace lists, task details, patient lists and global summaries. Mutations cancel older detail reads, install the authoritative response, then invalidate workspace lists, the affected patient's lists and aggregate totals. Patient name changes also invalidate task lists that display that name. Household and eligibility state remain untouched. No Zustand store, localStorage or new dependency is introduced.

## Patient and eligibility integration

Patient profiles show five open tasks, an overdue count, and five recently completed tasks ordered by completion timestamp, using bounded patient-scoped queries. Editing an older completed task does not make it appear newly completed. Create Task for This Patient fixes that patient in the form. View All Patient Tasks opens `/tasks` with patient/status parameters. Task details and editing reuse the task feature's hooks and components; patient features do not own copies of task state.

Needs Information screening cards expose Create Follow-up Task. It prepopulates the captured patient ID, follow-up type, title, description, fictional program/version/evaluation-date context and an actual missing-field reference. All missing fields are described, and the first engine-provided field is the source's focused reference. No task is created until explicit Save. Outdated screening disables follow-up creation until rerun. Repeated open-context follow-ups are rejected rather than silently duplicating work.

The task links back to a patient/date/program screening context. Opening it uses current records and requires screening again; it is explicitly not a persisted historical decision. Completing a follow-up never changes patient information, eligibility or coverage status.

## Calendar conventions

Due dates are validated `YYYY-MM-DD` strings. The UI derives today from local calendar components, refreshes every 30 seconds and on window focus, and sends that date explicitly to task queries. A task is open unless completed/cancelled. Overdue means an open dated task with `dueDate < today`; upcoming means today through `today + 7` inclusive. Undated and terminal tasks belong to neither category.

Comparisons are date-only. UTC calendar arithmetic is used solely to add calendar days to a date string, never to convert a due date into a local instant or compare it to UTC midnight. Tests cover leap day, month/year boundaries and terminal tasks. Created/updated/completed instants remain UTC ISO timestamps, consistently formatted with the existing utilities.

## Files created

```text
src/features/tasks/
  domain/tasks.ts
  domain/tasks.test.ts
  api/tasks-api.ts
  api/task-queries.ts
  api/tasks-api.test.ts
  hooks/use-local-today.ts
  hooks/use-dialog-focus.ts
  components/task-list.tsx
  components/task-editor.tsx
  components/task-details.tsx
  components/patient-tasks-section.tsx
  components/eligibility-follow-up.tsx
  pages/tasks-page.tsx
  pages/tasks-page.test.tsx
src/mocks/data/tasks.ts
src/mocks/handlers/tasks.ts
src/app/router/tasks-route.tsx
e2e/tasks.spec.ts
docs/care-coordination-tasks.md
```

## Files modified

```text
src/mocks/data/database.ts
src/mocks/handlers/index.ts
src/app/router/routes.tsx
src/features/patients/api/patient-queries.ts
src/features/patients/components/patient-search.tsx
src/features/patients/pages/patient-detail-page.tsx
src/features/eligibility/components/patient-selector.tsx
src/features/eligibility/pages/eligibility-page.tsx
src/test/app.test.tsx
e2e/smoke.spec.ts
README.md
```

The existing debounced search receives optional labels/placeholders while retaining default patient behavior. Patient selector buttons now explicitly use `type="button"` so selection/pagination inside a form cannot accidentally submit it. Route heading assertions match the new task page title. The existing eligibility engine and policy definitions are unchanged.

## Verification and limitations

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run format:check` and `npm run test:e2e`. Use Node 24. For an installed Chrome on Windows, set `$env:PLAYWRIGHT_CHANNEL = 'chrome'` before browser tests.

Domain/API/UI tests exercise validation, reference integrity, all allowed/rejected status pairs, completion and reopening, due classification, repository reset, idempotency, duplicate screening follow-ups, filtering/sorting/pagination, concurrency, preserved drafts, status actions, patient integration and reviewed eligibility creation. Playwright covers the complete creation/assignment/completion/profile journey and screening-follow-up/reopen journey on desktop and mobile, including global metric changes, narrow layout overflow and runtime console errors.

Tasks and idempotency records persist only in the current MSW session, and reload resets fixtures. Production still does not start MSW and needs a matching API to run data workflows; no backend is added. There are no real notifications/outreach, authentication/permissions, automated renewals, external integrations, permanent audit logs or enrollment workflows. Recently completed records are a current task view, not a historical audit trail. Browser/keyboard checks do not substitute for a full assistive-technology audit.

Final verification, October 9, 2026, using Node 24:

| Check                               | Result                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------- |
| TypeScript                          | Passed                                                                      |
| ESLint, zero warnings               | Passed                                                                      |
| Full Vitest suite                   | 413 tests passed across 26 files                                            |
| Step 11 domain/API/UI tests         | 35 passed                                                                   |
| Production build                    | Passed                                                                      |
| Prettier                            | Passed                                                                      |
| Full Playwright regression suite    | 32 passed; 4 existing duplicate viewport tests intentionally skipped        |
| Final task browser rerun            | All 4 desktop/mobile journeys passed after the completion-date ordering fix |
| Task browser console/runtime errors | None                                                                        |
| Desktop/mobile visual review        | Passed; no document-level horizontal overflow in tested flows               |

All requested verification commands could be executed. No dependencies were added or upgraded. Step 11 stops at task management; other deferred workflows remain unchanged.
