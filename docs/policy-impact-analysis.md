# Policy comparison and population impact (Step 10)

All policies, monetary thresholds, and records are fictional demonstrations. Results are decision support, never official government eligibility determinations. No enrollment, policy publishing, task management, real backend, AI decisions, or persistent analysis history is added.

## Workflow and reuse

Open `/policies`, explicitly select a program and two distinct versions, choose one evaluation date, review structural rule changes, then run analysis. Health, Nutrition and Family Assistance each have 2025.1 and 2026.1 versions. Childcare and Housing clearly report that only one version exists. Swap reverses direction. No version is chosen automatically.

The URL preserves program, baseline, comparison, date, transition, sort, page and selected patient. It contains identifiers, never patient contexts or income. Matrix counts filter patients, including unchanged diagonal cells. The table initially shows changed statuses, sorts by name in either direction, and renders ten patients per page. Mobile uses cards. One modal inspector displays captured engine traces from both policies, including old/new values, unknown values and absent rules. It reuses Step 8's `RuleComparison`, `DecisionStatus`, formatting and decision-summary utilities. Step 9's same-policy simulator comparison cannot compare different policy versions; this feature shares engine and presentation semantics instead of weakening that contract.

Profile navigation preserves sanitized comparison/filter parameters. Leaving this page discards its in-memory analysis; returning requires a fresh run. Comparison and inspection never modify saved records. Native selectors, semantic matrix/table headers, text statuses, live summaries, focusable cells, Radix focus trapping/restoration and existing reduced-motion styles support accessibility.

## Structural differences

`domain/policy-diff.ts` validates each policy and matches rules by stable identifier. Added/removed rules are semantic changes. Matched rules explicitly compare field, field type, operator, normalized expected operand, missing-data behavior, name, description and structured policy reference. Arrays use set comparison, scalar values exact comparison. Semantic comparisons do not use JSON serialization. Description/name/reference differences are metadata-only; strategy changes are separate. Policy metadata includes effective dates and version identifiers.

Current schemas require every rule and allow only `unknown` missing-data behavior. Optional rules and other missing-data behaviors are not invented. References must carry the owning policy version, so version bumps often make unchanged conditions metadata-only modified rules. The UI shows both structural modified counts and eligibility-logic change counts. Metadata/unchanged logic is collapsed initially.

Historical additions leave every existing 2026 definition intact. Nutrition 2025 has income strictly below $35,000, household maximum two, and CO/AZ residency; 2026 removes the maximum, changes the operator/threshold to at most $42,000 and adds OR. Family 2025 requires household size at least three and income at most $40,000; 2026 requires at least two and at most $45,000. Historical periods end December 31, 2025; current periods start January 1, 2026, without overlap. Existing Health history remains unchanged.

## Population algorithm and transitions

MSW `GET /api/policy-population` synchronously captures every synthetic patient and its associated household from the session repository, rather than one worklist page or individual requests. Exported eligibility-input Zod schemas project relevant source fields, omitting contacts and address fields beyond state. A typed error union preserves malformed source records. Normalization uses the existing context builder once per source record; inconsistent links/derived data are explicit errors. Ordinary missing data becomes unknown engine input.

Pure `analyzePolicyImpact` validates both definitions once, then validates each normalized context, checks duplicate identifiers and a consistent evaluation date, evaluates that **same context** twice, and joins rule results by ID. It invokes existing `evaluateValidatedProgram` with explicit `counterfactual` applicability. Only effective-period enforcement is bypassed. Operators, missing-data behavior, explanations and ALL/ANY aggregation remain the original engine. Public screening still defaults to effective-date enforcement. Historical dates never determine patient ages here.

Each patient has one typed `baselineStatus->comparisonStatus` transition across Eligible, Ineligible and Needs Information. All nine combinations are represented; diagonal cells are unchanged. “Became eligible/ineligible” and “into Needs Information” partition changed outcomes by destination. “Out of Needs Information” overlaps those destination metrics and must not be added again to the changed total. Row/column sums reflect each policy's distribution; all cells sum to evaluated records. Population records = evaluated records + source/context errors. Errors never occupy valid transitions.

Added/removed rules retain null on the absent side, never fail/unknown. Inspectors show every changed outcome with both engine explanations. They do not claim a single cause. A strategy change can change the program status without changed rule outcomes.

For P patients, R combined rules and bounded operands, analysis is approximately O(P × R) time and O(P × R) space for retained traces. Normalization also scales with member/source counts; categorical membership scales with bounded operands. Memoized filtering/sorting is O(P log P), rendering is limited to ten patients and one inspector. No whole-database deep clone, Worker, charting dependency or state library is introduced.

## Snapshots and freshness

Each immutable analysis captures policies, evaluation date, normalized contexts, names, evaluations, population fingerprint, timestamp and measured duration. Snapshots stay in component memory. URL changes never relabel old results. Selection/date changes mark results outdated and request a rerun. `GET /api/policy-population/version` checks the identifier every 15 seconds while results are mounted and on focus; patient and household mutations immediately invalidate the query. Freshness API errors explicitly report unverified freshness with retry.

The fingerprint uses canonical sorted-key encoding and 64-bit FNV-1a over eligibility-relevant records plus repository update timestamps. It is a deterministic noncryptographic change detector, not a security token/audit signature. Inspectors continue reading the original captured snapshot after data changes. Current data has 150 patients. Batch contracts cap at 2,000; larger datasets require a paged snapshot contract/bounded batches and are deferred, never silently truncated. Production still does not start MSW and requires a matching API; no production backend is introduced.

## Actual sample and benchmark

Fresh default dataset, Family Assistance 2025.1 → 2026.1, June 15, 2026:

- Snapshot `demo-population-4c520259dd9b8553`.
- 150 evaluated, 0 errors, 12 changed, 138 unchanged.
- 10 became eligible, 0 became ineligible, 2 entered Needs Information, 0 exited Needs Information.

| Baseline / comparison | Eligible | Ineligible | Needs Information | Total |
| --------------------- | -------: | ---------: | ----------------: | ----: |
| Eligible              |       10 |          0 |                 0 |    10 |
| Ineligible            |       10 |        126 |                 2 |   138 |
| Needs Information     |        0 |          0 |                 2 |     2 |
| Total                 |       20 |        126 |                 4 |   150 |

`npm run bench:policies` prints this fixture result and benchmarks pure analysis and normalization plus analysis. Initial Node 24 run on this machine: mean 18.67 ms pure analysis (54 samples, ±2.21%); mean 23.23 ms including normalization (44 samples, ±2.18%). These exclude fetch/fingerprint/rendering and vary by environment. The page reports normalization/analysis duration separately.

## Files

Created:

```text
src/features/policies/
  api/population-api.ts
  components/patient-impact-inspector.tsx
  components/population-dashboard.tsx
  components/rule-differences.tsx
  domain/policy-diff.ts
  domain/population.ts
  domain/policies.test.ts
  domain/population.bench.ts
  hooks/use-population-impact.ts
  pages/policies-page.tsx
  pages/policies-page.test.tsx
  ui/policy-url.ts
src/app/router/policies-route.tsx
src/mocks/data/policy-population.ts
src/mocks/handlers/policy-population.ts
e2e/policies.spec.ts
vitest.policies.config.ts
docs/policy-impact-analysis.md
```

Modified:

```text
src/app/router/routes.tsx
src/features/eligibility/engine/context-builder.ts
src/features/eligibility/engine/evaluate-program.ts
src/features/eligibility/policies/demo-programs.ts
src/features/eligibility/policies/registry.ts
src/features/patients/api/patient-queries.ts
src/features/patients/pages/patient-detail-page.tsx
src/mocks/handlers/index.ts
src/test/app.test.tsx
e2e/smoke.spec.ts
package.json
vite.config.ts
README.md
docs/eligibility-engine.md
```

Changes connect routes, export existing context schemas, add explicit evaluator applicability, register historical policies and batch handlers, invalidate freshness after patient/household edits, preserve profile return links, update heading assertions, add scripts and exclude benchmark code from unit coverage. No dependencies added/upgraded.

## Verification commands

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run format:check`, `npm run test:policies:coverage`, and `npm run test:e2e`. Playwright exercises desktop/mobile comparison, actual changed values, all-population analysis, matrix filtering, inspection, swapping/rerunning, pagination, focus restoration and narrow viewport overflow. Unit tests cover semantic differences, all transitions, reconciliation, identical contexts/dates, invalid records, input integrity, determinism, API errors, empty results, stale snapshots and profile return navigation.

Final verification on Node 24, October 9, 2026:

| Check                        | Result                                                                  |
| ---------------------------- | ----------------------------------------------------------------------- |
| TypeScript                   | Passed                                                                  |
| ESLint, zero warnings        | Passed                                                                  |
| Full Vitest suite            | 378 tests, 23 files passed                                              |
| Step 10 tests                | 39 tests passed                                                         |
| Step 10 coverage             | 97.38% statements, 84.56% branches, 98% lines                           |
| Structural diff coverage     | 100% statements and branches                                            |
| Population analysis coverage | 100% statements, 88.37% branches                                        |
| Production build             | Passed; lazy policy-page chunk approximately 8.25 kB gzip               |
| Prettier                     | Passed                                                                  |
| Playwright, installed Chrome | 28 passed; 4 preexisting duplicate viewport tests intentionally skipped |
| Policy browser tests         | All 4 desktop/mobile runs passed; no runtime/console errors             |
| Benchmark                    | Passed; timings above                                                   |

All requested verification commands could be executed. Desktop and mobile screenshots were visually reviewed; tests also check narrow layout overflow and keyboard/focus behavior. These tests do not replace a full assistive-technology audit.
