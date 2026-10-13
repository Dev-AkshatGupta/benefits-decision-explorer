# Eligibility screening and Decision Inspector

The /eligibility page provides patient and program selection, an evaluation date, explicit screening, multi-program results, and the Decision Inspector. All policies and patient records remain fictional demonstrations. No official benefits determination is made.

## Screening and engine integration

The route is lazy-loaded. Patient search reuses the paginated patient API and TanStack Query keys, requests ten records at a time, and debounces name search by 300 ms. Native result buttons support Tab, Enter, arrow keys, Home, and End. Previous/Next controls access additional pages; empty results and API failures have feedback and retry controls. Selected patient and household queries load independently.

The UI does not calculate eligibility. Clicking Run screening or Rerun screening selects applicable policy versions through selectPoliciesForDate, refreshes the selected patient's records, calls buildEligibilityContext once, and calls screenPatient once. No screening occurs on initial navigation, opening/closing the inspector, changing inputs, or returning from a profile. Duplicate submissions are guarded, and failed reruns retain the previous snapshot.

A missing household (404) is permitted as missing information; transient failures block screening and offer retry. Invalid contexts, malformed policy configuration, and policy-date gaps produce safe errors instead of invented decisions. All five demonstration programs are selected initially. The date defaults to the current UTC calendar date and is then written into the URL explicitly. Every result reports its actual selected version and evaluation date.

## Immutable session snapshots

The application layout owns a small React context provider containing one current screening snapshot. This preserves results while visiting the patient profile without a new state library. TanStack Query remains responsible for live patient/household records; it does not own or modify historical decision values.

A snapshot captures patient ID/name, patient and household update versions, normalized evaluation context, selected immutable policy definitions, engine results, and income source type/amount/frequency. It excludes contact information, street addresses, member names, and source IDs. Objects are deeply frozen. Normalized context retains the birth date needed to explain derived age. No localStorage, sessionStorage, backend persistence, or eligibility history is introduced.

Results are shown only when their patient ID matches the selected patient. Changing patient selection never displays another patient's decisions. Changing date/program selection or observing different patient/household update versions marks results outdated. Both dashboard and sheet warn that the original trace is retained. Rerunning explicitly replaces the snapshot with freshly fetched inputs and results. A failed rerun preserves the old trace and reports the failure.

The income breakdown uses captured source amounts and the existing annualizeIncome/formatCurrency utilities. Its total comes from the captured normalized context. It appears only when the evaluated annual income is known and supporting sources exist; incomplete income is not presented as a confirmed total. Newly fetched values never substitute for the previous decision's inputs.

## Inspector and explainability

Each program card exposes Inspect Decision. The modal Radix sheet appears on the right at desktop/tablet sizes and fills the available width on mobile. Its header and close control remain outside the scrollable content. Escape closes it, focus is trapped while open, and closing restores focus to the initiating result control or a safe fallback.

The sheet shows the program, engine status, evaluated patient, supplied date, policy version, rule count, outcome counts, ALL/ANY strategy, and a semantic decision flow. Summary wording follows the existing engine counts and semantics: ALL failures remain decisive even with unknown rules; ANY passes remain decisive even with unknown rules. It never turns an unknown into a failure or promises eligibility after missing information is supplied.

Native details/summary accordions show every rule in engine order, with name, ID, textual status, a short explanation, and expandable full details. Actual values, configured operands, operators, and references come from structured result fields. The matching captured policy rule supplies field/type metadata; explanation strings are never parsed. No engine contract change was needed.

Numeric scalar rules use a small SVG value scale with distinct actual/threshold markers and exact adjacent values. Coordinates normalize magnitudes before calculating positions, including negative, zero, and extreme finite values. The geometry is presentation only: there are no probability or progress percentages and no new financial calculations. Numeric membership, categorical, boolean, date, and array rules use structured comparisons instead. Array intersection wording matches the existing engine's in/not_in semantics.

The decision flow is an ordered semantic HTML list: evaluated context → actual policy version/rule count → pass/fail/unknown counts → actual strategy → engine outcome. Text provides the complete meaning; arrows and icons are decorative. Existing theme tokens, focus styles, and reduced-motion behavior are reused. No charting or graph dependency is added.

Unknown rules expose the engine's missing fields, affected rules/program, and a patient-profile action. Policy Information shows the captured version, inclusive effective window, strategy, references, and fictional-policy disclaimer.

## Correcting income completeness

The existing profile income editor now includes an unchecked-by-default confirmation: I confirm this demonstration income report is complete. Only explicitly checking it causes the existing conditional household PATCH to emit incomeInformationStatus: complete. Other source edits keep the existing behavior of invalidating completeness. Confirming an empty source list represents a confirmed zero-income report. This is a synthetic completeness marker, not real income verification.

Profile links carry a sanitized screening return search string in router history state. Back to screening retains patient, date, selected programs, and requested inspector. Profile mutations reuse existing query invalidation, causing the retained decision to show its outdated warning until rerun.

## URL behavior

Example: /eligibility?patientId=patient-001&date=2026-06-15&programs=demo-health,demo-nutrition&programId=demo-health.

patientId selects the patient, date selects the evaluation date, programs stores selected program IDs, and programId requests an inspector. Omitted programs selects the full demonstration catalog; an empty programs value selects none. Closing the sheet removes only programId. Changing patients also removes it. Browser Back/Forward reopens or closes an inspector against available matching session results without reevaluation.

A deep link does not represent persisted eligibility history. Refresh resets the in-memory snapshot and mock session. If no matching result exists, the page preserves the selection and explains that screening must be run first. External redirect parameters are not accepted by profile return navigation.

## Verification commands

```sh
npm run typecheck
npm run lint
npm run test
npm run test:screening:coverage
npm run build
npm run format:check
npm run test:e2e
```

Coverage reports for the screening page, components, and UI utilities are generated under ignored coverage/screening. Existing engine coverage remains separately available through npm run test:engine:coverage. Unit/integration tests cover engine-call counts, rule values/operators/references, ALL/ANY summaries, charts, immutable monetary breakdowns, updates/reruns, patient isolation, errors/retry, missing records, profile correction, keyboard selection, bounded pagination, focus restoration, and URL history. Playwright covers the full desktop/mobile workflow, native keyboard accordions, focus trapping, refresh behavior, and 320/768/1280px layouts. No brittle UI snapshots are used.

## Limitations and deferred scope

Only the most recent snapshot is held in the current application session; refresh clears it. Version-based freshness relies on the existing API's updatedAt contract and successful refreshes; network failures cannot establish current record freshness. Demo data reset on reload. All policies, income completeness, and derived child conventions remain fictional.

The [What-if Simulator](what-if-simulator.md) uses screening snapshots that can include qualifying-child counts. Bulk screening, persistent decision history, official government integrations, authentication, and a production backend are outside the current workflow.
