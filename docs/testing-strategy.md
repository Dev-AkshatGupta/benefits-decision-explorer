# Testing strategy

## Unit and integration testing

Vitest + React Testing Library run with strict TypeScript and an MSW Node server. Tests reset both handlers and synthetic repositories after each case; unhandled requests fail tests. Concurrency remains capped at four workers to prevent cold lazy imports/fixture resets overwhelming short async waits. `npm run test:coverage` includes all application source and generates V8 text/HTML/JSON summaries; mocks/tests/benchmarks are excluded, and untested bootstrap/error paths remain visible in the denominator.

Pure suites cover ALL/ANY decisions, missing vs zero income, thresholds, version dates, deterministic traces, immutable simulations/reset, structured policy diffs, all nine transitions, snapshot reconciliation and coverage date/gap semantics. Task lifecycle matrices include invalid moves and due-day boundaries. MSW integration covers pagination, foreign keys, response validation, optimistic conflicts, idempotent writes and renewal-to-task linkage. UI tests cover failures/empty states, URL validation, preserving drafts, outdated analysis, inspector values and rerunning after changes.

The suite covers retry classification, task not-found behavior, mutation cache synchronization, query dependency gating, unsaved-event navigation, identifier separation, and search debounce behavior.

## End-to-end tests

The full suite runs desktop and Pixel 7 Chromium against development/MSW. Four older mobile skips intentionally avoid duplicating tests that explicitly loop through widths. Journeys A–D exercise patient/household screening and simulation, policy comparison/reversal, task lifecycle/assignment and timeline renewal follow-up. The four new readiness journeys add keyboard activation to all 13 requested workflows on both projects. Tests use semantic locators, seeded records and condition-based waits rather than sleeps. Negative/failure workflows may intentionally generate failed API responses; happy journeys collect runtime errors and require none.

`npm run audit:browser` runs a separate serial audit suite: five viewport axe/overflow tests plus five-sample timing measurements. The computation test is intentionally excluded from Playwright discovery. Production preview is opt-in through `PRODUCTION_PREVIEW=1`; it checks the real built shell, no mock worker registration, and an accessible failure with no API service. It is not a production backend test.

## Fixtures and data integrity

150 synthetic patients, 250 synthetic care tasks, 260 coverage periods and 378 events are generated deterministically. Dates are fixed for screening/policy benchmarks (2026-06-15) and renewal checks (2026-10-09); local-day worklist tests pass an explicit date where needed. No external patient data is used. Tests explicitly protect patient linkage, saved-vs-hypothetical data, missing-vs-zero, same-context version comparisons and independence between task completion and coverage renewal completion. Separate browser contexts isolate mutation journeys.

## Coverage and verification

See [the actual coverage table](coverage-results.md) and retained JSON for statements, branches, functions and lines overall and by pure domain. Coverage instruments Vitest execution only; browser E2E execution is not added to the percentages. Engine coverage retains its existing minimum thresholds. Commands also include all four feature coverage suites, typecheck, zero-warning lint, formatting, production build, full E2E and npm audit. Results and exact totals appear in the final implementation report.

## Benchmarks and regression protection

`AUDIT_PHASE=baseline|final npm run bench:readiness` records warm-up, 31 samples and medians with Node/CPU/platform metadata. Operations include screening one patient/five policies, simulation/comparison, 150-patient analysis with/without normalization, 260-period gaps and a 20-row formatting pass. Existing engine/policy throughput benchmarks remain runnable; they print aggregates only. `npm run audit:bundle` records raw/gzip emitted sizes. `AUDIT_PHASE=baseline|final npm run audit:browser` records repeatable browser timings and axe results. In PowerShell set `$env:AUDIT_PHASE='final'` separately; otherwise reports use the `current` suffix. Baseline files should be preserved when tracking future changes.

Do not run benchmarks concurrently with other heavy suites or mutate source during browser runs. There are no machine-dependent performance pass/fail thresholds. Functional tests protect server pagination, debounce deadlines, no simulation writes, immutable snapshots and aggregate reconciliation; comparisons of raw measurements are advisory.

## Known gaps

Unit coverage is lower for coverage/task editors and branch-heavy details components than for pure domains. High-risk gaps include malformed/aborted writes during navigation, midnight/DST changes on real devices, browser reload during a pending mutation, actual assistive technologies, failing chunk downloads, startup failure recovery, and very large/long-lived datasets. Some branches are defensive impossible-after-schema-validation guards; others are exercised only by E2E. E2E smoke checks bootstrap while Vitest leaves `main.tsx` uncovered. No Lighthouse, heap/leak profiling, production API integration, authentication or security penetration testing was performed. These limits are preserved rather than hidden by coverage exclusions.
