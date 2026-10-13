# Performance and production review

See [the baseline](performance-baseline.md) for the initial verification and measurement method, [measured results](performance-results.md) for every before/after median and bundle comparison, and `measurements/` for raw samples. This is a fictional portfolio frontend, not a deployed healthcare system.

## Findings and changes

Bundle tables measure actual files on disk and use Node `gzipSync` with default options for both captures. These gzip sizes can differ from Vite's printed estimate; use the same method when comparing them.

Repeated `Intl.NumberFormat` and `Intl.DateTimeFormat` construction was a measurable cost in rendering and engine explanations. Money, UTC dates/timestamps and numeric rule displays now reuse fixed-locale formatters. Exact integer-cent formatting, including maximum safe integer values, remains unchanged. The benchmark includes 20 formatted rows and the four required computational workflows.

An unstable parent `onSearch` callback restarted the 300 ms search debounce on unrelated query updates in task/coverage pages. A fake-clock regression test reproduced the delay before the fix. React's effect event reads the latest callback without moving the existing deadline. Search clearing, URL acknowledgement, newer keystrokes and back/forward synchronization retain their tests. No debounce interval was reduced to manufacture an improvement.

Read retries were inconsistent: task reads inherited a numeric retry count, while patient reads classified permanent failures. Shared retry handling now retries network/5xx failures once and stops for 4xx, invalid response contracts and cancellation. Coverage event history waits for a successful record load, preventing an extra request for an invalid ID. Static coordinator metadata stays fresh for five minutes instead of repeatedly refetching during navigation. Mutations continue to use authoritative server responses, pending guards, idempotency keys and optimistic-concurrency tokens.

The shell's retry code uses lightweight error classes; Zod response-error schemas stay in the deferred API parsing module. Existing major route splitting was retained. The start and information pages remain small and do not justify additional chunks. Feature fallbacks remain accessible status text/skeletons; existing global and router error boundaries provide reload/return recovery without exposing production stack traces. A final production-preview smoke test checks startup without MSW and a useful API failure when no backend is present.

Coverage event drafts now survive attempted navigation and require deliberate discard. Edit/renewal task controls cannot create a second editor while an event form owns navigation protection. Error descriptions are associated with the event field and coverage notes; focus outlines cover textareas/disclosures. Coverage gap grouping uses an unambiguous patient/program tuple key; identifiers containing `|` cannot merge separate records.

## Rendering and computation review

Patient/task/coverage worklists request bounded server pages (20/10/10 default rows). Patient cards and desktop rows use stable record IDs. Affected patients use a bounded explicit population snapshot and render ten rows, with memoized filter/sort transformations. Only one patient inspector is mounted. Desktop tables retain horizontal scroll containers; mobile cards preserve the information.

The simulator memoizes valid override calculations, reuses baseline results on reset, and cannot write patient records. Screening runs explicitly rather than on every field change. Population analysis normalizes each patient's source inputs once, validates the two policies outside the patient loop, evaluates identical contexts, and preserves immutable input/result snapshots. Public pure functions still validate their contracts; safety was not removed to improve benchmarks. Gap detection is cached by query selection and timeline input dependencies. Task overview totals are repository summaries, not recomputed from a visible page.

Existing memoization is adequate for these sizes. No blanket `React.memo`, row callback wrappers, unnecessary context splits, additional shared state, virtualizer or worker was introduced. Browser interaction timings are not React commit profiles; no flamegraph claim is made.

## Query cache review

| Data                     | Key and freshness                                                                   | Mutation/freshness behavior                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Patient lists            | Normalized filters/page under `patients/list`; 30 s stale, 5 min inactive GC        | Patient and household writes invalidate lists; previous rows retained only for pagination with matching filters/sort                     |
| Patient/detail/household | Stable ID keys; 30 s stale                                                          | Cancel older reads before installing replies; household changes invalidate derived patient/context data                                  |
| Coordinators             | Single shared key; 5 min stale                                                      | No coordinator editor exists; useful focus refetch remains enabled after freshness expires                                               |
| Tasks                    | List filters include local date/page; patient subsets/detail/overview keys separate | Cancel detail read, install reply, invalidate task lists, owning patient subset and overview; unrelated patient/coverage state untouched |
| Coverage                 | Record and renewal list prefixes separate; filters/date/page in keys                | Coverage writes invalidate lists, renewals, summary and owning patient history; event writes invalidate event histories only             |
| Coverage events          | Record-ID key, enabled after record success                                         | Invalid record does not launch event request; transient reads still recover                                                              |
| Policy population        | Explicit fresh batch per run, in-memory snapshot                                    | Patient/household writes invalidate version query; version is stale at 5 s and polls every 15 s only with analysis present               |

Default inactive cache lifetime is explicitly five minutes; useful focus refetching is preserved. Structural query-key hashing tolerates recreated equivalent filter objects. No patient state is saved to browser storage. Patient name/coordinator updates continue to invalidate affected task/coverage metadata. There is no unbounded per-patient request fan-out.

## Complexity and safeguards

For P patients and R baseline/comparison rules, analysis is O(P × R) time/space for full traces (plus source-member normalization). Rule maps prevent positional matching and repeated scans. Gap detection groups and sorts N periods: O(N log N) time, O(N) space. Paginated presentation is bounded by the current page. Fixture/context immutability, snapshot reconciliation, server pagination, no simulation writes, precise currency/date boundaries, debounce timing, retry classification and targeted invalidation have regression tests. Benchmarks have warm-up, multiple samples and medians without CI timing thresholds.

## Security/privacy review

MSW now starts with `quiet: true` in development so its default request/response logger does not print patient-shaped fixture objects. Production does not start a mock worker. The production smoke test separately records expected `/api` 404 resource messages (15 across five trials) while requiring no JavaScript exceptions and no shell startup console errors.

Source inspection found no `dangerouslySetInnerHTML`, secrets, patient browser-storage persistence, or production patient-object console logging. React escapes dynamic text; return paths and filter URLs are parsed/validated; API payloads use Zod contracts. Fictional-data disclaimers and eligibility/enrollment distinctions remain visible. The old population benchmark's patient-shaped log sample was removed; benchmark output now contains aggregate counts only. npm audit before and after reports zero vulnerabilities at every severity; raw reports are retained. No major dependency upgrades or new production dependencies were introduced; `@axe-core/playwright` is development-only. This is not a HIPAA compliance claim or a penetration test.

## Limits and remaining risks

Development/MSW timing includes server transforms, worker startup, mock latency and Playwright overhead; five UI samples do not establish statistical significance. Formatter/engine medians are measured improvements; broader browser improvements must not be assumed. Production initial load has a final-only measurement. No Lighthouse score, DevTools flamegraph, heap snapshot or React commit profile was collected. Mobile widths and emulation are not physical-device testing. Dataset growth should trigger another profile before choosing workers/virtualization. The initial shared React/router/query/dialog bundle remains substantial, but no artificial vendor split is presented as a download reduction.

Ordinary production builds exclude MSW and have no backend or authentication. The standalone demo includes session-local mock mutations and is unsuitable for real clinical or public-benefits use. A browser/server MSW update warning appeared intermittently during disposable axe iframe/context cleanup; no application page exceptions were observed in the core journeys. Current-input validation remains distinct from an ordinary missing eligibility value; tests preserve Needs Information rather than misclassifying it as eligible/ineligible.
