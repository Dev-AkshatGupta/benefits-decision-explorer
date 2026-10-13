# What-if Eligibility Simulator (Step 9)

Explore What-if Scenarios opens /eligibility/simulator?patientId=patient-011 from an existing screening. Simulation Mode — Changes are not saved to the patient profile is displayed throughout the workspace. All outcomes use fictional demonstration policies and do not guarantee benefit approval or denial.

## Baseline and local state

The simulator captures the matching immutable screening snapshot when its workspace mounts. It preserves the original patient identifier/name, normalized context, evaluation date, selected policies/versions, program results, and supporting source information. It never reconstructs an older baseline from current patient records.

Saved records remain in TanStack Query/MSW. The existing screening session provider retains the original screening; the simulator holds only five editable string fields and explicit normalized overrides in local state. No Zustand, global scenario store, persistence, history, or sharing is added. Leaving the route discards the draft without a confirmation because changes are explicitly temporary. Exit restores the baseline patient/date/program selection on the screening page and never replaces the original result.

Without a matching session baseline, the page loads the selected patient and household for review and asks the coordinator to run a baseline screening. Its action navigates to the existing screening workflow; evaluation still requires an explicit Run screening action. Refresh clears session results and prompts for a new baseline. Another patient's snapshot is never used.

## Inputs and override semantics

| Input                     | Validation and behavior                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Annual household income   | Nonnegative USD decimal input, at most two decimal places and safe integer cents. Uses existing dollarsToCents. Explicit zero is known zero; blank restores the baseline, including unknown. A supplied amount assumes complete hypothetical income. |
| Household size            | Whole number 1–50. Overrides the normalized size only; does not add/remove members.                                                                                                                                                                  |
| State                     | Existing supported U.S. state abbreviations and DC. Overrides residency context only.                                                                                                                                                                |
| Patient age               | Whole number 0–120. A changed age sets simulated dateOfBirth to null rather than fabricating a birthday or contradicting the saved birth date. Date-of-birth-dependent rules would therefore remain unknown until the original age is restored.      |
| Qualifying child presence | Yes, No, or Use baseline for the existing boolean field. Does not create hypothetical member records or invent ages.                                                                                                                                 |

Blank text and Use baseline intentionally mean no override, rather than incomplete input. Invalid nonblank values pause calculation and hide comparisons instead of showing stale results as current. Field errors are accessible and drafts remain editable. Reset controls clear individual numeric overrides; state/child selectors provide Use baseline. Reset All Changes clears every override and reuses the original results.

Income is an aggregate override. Recorded source count/types remain baseline information; no fake source amounts or verification evidence are created. Hypothetical completeness is an explicit computational assumption, not a statement that the saved report has been verified. The difference from known baseline income uses integer arithmetic and exact currency formatting; unknown baseline income has no fabricated numerical difference.

Age, size, and child presence are documented context overrides, not alterations to the normal context builder's underlying source records. The normal engine and saved schemas are unchanged.

## Child and household consistency

ScreeningSnapshot gains an optional qualifyingChildrenCount supporting field, calculated once from known household child relationships and ages at the supplied evaluation date. No new engine field or additional personal records are stored. Older snapshots without that metadata remain supported.

When qualifying-child presence remains true, a known count is preserved as a household-size constraint: size must accommodate those children plus the primary patient. A newly assumed qualifying child, or legacy known presence without a count, requires at least two members when size is known. Setting child presence to No clears that scenario constraint. Unknown size is left unknown, never synthesized. This boolean control cannot model removal of only some known qualifying children; finer member scenarios are deferred.

## Recalculation and comparisons

The hook separates raw draft validation from evaluation. Valid minimal overrides are normalized into a stable key, so equivalent text such as 60000 and 60000.00 does not trigger another evaluation. Unchanged/reset inputs reuse baseline results. Changed valid overrides call screenPatient with the exact captured policy objects and fixed date. No policy selection for today's date, network requests, PATCH calls, artificial loading state, or new calculation engine is involved.

Comparison functions match program and rule identifiers and reject incompatible patients, dates, versions, rule sets, or configured operands. Status changes use actual engine statuses. A rule whose actual value moves but whose pass/fail/unknown outcome stays the same is not counted as changed. The impact summary counts evaluated, changed/unchanged programs, and outcome-changing rules.

Every program card displays baseline/simulated statuses and rule counts, with explicit transition text or No status change. Expandable rule differences show before/after values and statuses, unchanged configured thresholds/operators, policy references, and the simulated engine explanation. Formatting and status badges reuse Step 8 utilities. Scenario Changes lists only inputs that differ from the baseline. No human-readable explanation is parsed to infer data or decisions.

## Integrity, accessibility, and layout

Simulation modules import read-only records only for the missing-baseline review. The active workspace has no patient/household mutation hook or write API. Baseline objects remain frozen and saved repository records are never touched. Engine results are derived synchronous values, not persisted server state.

Desktop uses two columns for inputs and impact; mobile stacks them. Labels distinguish baseline, hypothetical inputs, and simulation output. Native inputs/selectors and details/summary controls support the keyboard, visible focus states, textual status transitions, accessible errors, and a polite impact announcement. No charts, workers, animation framework, or additional dependency is introduced.

## Files

Created under src/features/eligibility/simulator:

- domain/simulation.ts and simulation.test.ts: validation, context overrides, exact income differences, result comparison.
- hooks/use-eligibility-simulation.ts: local draft and synchronous derived evaluation.
- components/simulation-inputs.tsx and simulation-impact.tsx: inputs, changes, summaries, program/rule comparisons.
- pages/eligibility-simulator-page.tsx and eligibility-simulator-page.test.tsx: session-aware workspace and direct-link handling.

Also created e2e/simulator.spec.ts and this guide.

Modified src/features/eligibility/ui/screening-snapshot.ts, src/features/eligibility/pages/eligibility-page.tsx, src/app/router/{eligibility-route,routes}.tsx, src/app/layouts/app-layout.tsx, package.json, README.md, and docs/decision-inspector.md. The Step 6 engine, patient domain schemas, mock APIs, and saved-record query hooks were not modified. No dependencies were added.

Browser regression checks exposed a preexisting worklist search issue: committing a debounced URL search remounted the input, interrupting continued typing. The narrow fix retains the input node and newer draft text for its own commits, while still synchronizing external URL navigation. Also modified src/features/patients/components/patient-search.tsx, patient-search.test.tsx, src/features/patients/pages/patients-page.tsx, and e2e/patients.spec.ts. Controlled timer tests verify debounce, immediate clear, focus retention, and URL synchronization; the browser assertion no longer assumes inter-character scheduling stays below the debounce interval under CPU load.

## Verification commands

```sh
npm run typecheck
npm run lint
npm run test
npm run test:simulator:coverage
npm run build
npm run format:check
npm run test:e2e
```

Run instrumented coverage separately from the multiworker browser suite to avoid CPU contention. Coverage output is written to ignored coverage/simulator. Tests cover every override, fixed historical versions, unknown/zero semantics, invalid intermediate input, child/size constraints, input-only changes, program/rule metrics, resets, exit, direct navigation, patient isolation, equivalent normalized values, no edit-time API requests, no PATCH calls, unchanged saved records, and unchanged original screening results. Browser tests cover the full desktop/mobile simulation journey and a 320px viewport; screenshots are reviewed.

## Limitations

Final verification: typecheck, ESLint, formatting, and production build passed. All 339 unit/integration tests passed across 21 files, including 33 simulator tests. Simulator coverage reached 96.87% statements, 88.07% branches, 95.45% functions, and 96.69% lines. Installed-Chrome Playwright passed 24 tests with four intentional duplicate viewport skips. Desktop, mobile, and 320px screenshots were reviewed. No requested command was unavailable.

Scenarios are aggregate assumptions, not complete synthetic household reconstructions. Evaluation date and policy versions are fixed. Only five existing context fields can be overridden. Saved source arrays are not changed to match hypothetical income. Child presence is boolean, with the consistency limits described above. No changes are persisted; refresh or route exit loses the draft.

Policy comparison, bulk impact analysis, scenario history/sharing, government rules, task/coverage integration, new backend services, and generative AI predictions remain deferred.
