# Deterministic eligibility engine

This engine evaluates **fictional demonstration policies only**. It is not suitable for real public-benefits determinations without authoritative policies, legal review, security controls, and extensive domain validation. No real government thresholds, external policy services, or AI decisions are used.

## Architecture and usage

The public entry point is src/features/eligibility/index.ts. Domain schemas/types define contracts; engine functions perform normalization, validation, comparisons, selection, and aggregation; policies contain structured data. The engine has no React, TanStack Query, MSW, browser, network, or UI dependencies. Zod and existing pure patient date/income utilities are reused.

```ts
import {
  buildEligibilityContext,
  demoPolicyRegistry,
  selectPoliciesForDate,
  screenPatient,
} from './src/features/eligibility';

const evaluationDate = '2026-06-15';
const context = buildEligibilityContext(patient, household, evaluationDate);
const programs = selectPoliciesForDate(demoPolicyRegistry, evaluationDate);
const results = screenPatient(programs, context);
```

Select policies once per date before screening a batch. Pass a list of selected program IDs as the third selector argument to screen a subset. Empty selections yield an empty result list. Screening preserves supplied program order and validates context once per call. All functions are synchronous. Context building derives fields once; no record fetching or automatic screening occurs.

evaluationDate is a supplied YYYY-MM-DD calendar date. evaluatedAt carries that same date, not an invented wall-clock timestamp. There is no implicit current date, randomness, input mutation, or caching. The same policy, context, and date produce equivalent complete traces. Program ID, policy version, supplied date, and per-rule actual/expected values identify the evaluated configuration; no input hash is introduced.

## Rule format and operators

```ts
const rule = {
  id: 'INCOME-01',
  name: 'Household income requirement',
  description: 'Fictional annual household income ceiling.',
  field: 'annualHouseholdIncomeCents',
  fieldType: 'number',
  operator: 'less_than_or_equal',
  expectedValue: 3_500_000,
  policyReference: {
    documentId: 'DEMO-HEALTH-2026.1',
    section: 'INCOME-01',
    policyVersion: '2026.1',
  },
  missingDataBehavior: 'unknown',
} as const satisfies EligibilityRule;
```

Fields are an allowlist, not arbitrary object paths or executable expressions. Field/type/operator/operand combinations form a union enforced by TypeScript and runtime schemas. Policy references must match their program's version. Every rule is required and decision-driving; optional/informational rules are not supported.

| Field type   | Fields                                                             | Supported operators                                                                    | Operand                     |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------- |
| number       | age, householdSize, annualHouseholdIncomeCents, incomeSourcesCount | equals, not_equals, greater_than, greater_than_or_equal, less_than, less_than_or_equal | Nonnegative safe integer    |
| number       | Same fields                                                        | in, not_in                                                                             | Nonempty numeric list       |
| string       | state, incomeInformationStatus                                     | equals, not_equals                                                                     | Nonempty string             |
| string       | Same fields                                                        | in, not_in                                                                             | Nonempty unique string list |
| boolean      | hasQualifyingChild                                                 | equals, not_equals                                                                     | Boolean                     |
| date         | dateOfBirth, evaluationDate                                        | Equality and ordered operators                                                         | Valid calendar date         |
| date         | Same fields                                                        | in, not_in                                                                             | Nonempty calendar-date list |
| string_array | incomeSourceTypes                                                  | equals, not_equals, in, not_in                                                         | Unique string list          |

Scalar in/not_in checks membership. Array equality uses set equality, ignoring order. Array in passes when at least one element intersects the expected set; not_in passes when no elements intersect. An explicitly empty array is known data: it equals an empty expected set and has no intersection. Strings use case-sensitive exact matching. Dates use validated calendar-date ordering. Values are never coerced.

Rule results include actual/expected values, operator, pass/fail/unknown, structured reference, missing field keys, explanation, and supplied evaluation date. Explanations derive from field labels and structured conditions; monetary values use exact USD formatting. All rules are evaluated in definition order, even after a decisive result.

## Decision semantics

| Strategy | Eligible                 | Ineligible              | Needs information             |
| -------- | ------------------------ | ----------------------- | ----------------------------- |
| ALL      | Every rule passes        | At least one rule fails | No fail, at least one unknown |
| ANY      | At least one rule passes | Every rule fails        | No pass, at least one unknown |

Programs cannot have empty rules or duplicate rule IDs. The result includes numeric passedRules, failedRules, and unknownRules counts, plus ordered ruleResults and a stable first-occurrence union of missingFields. Unknown is never silently converted to fail. An ALL result can be ineligible while still reporting unknown rules; ANY can be eligible while reporting unknown rules.

## Normalization and missing information

buildEligibilityContext accepts existing Patient/Household records and structurally incomplete engine inputs. A missing household is allowed. Required linking IDs must match. Provided member lists require one primary self member, unique IDs, consistent primary identity, and a consistent stored household size when present. Provided income sources require valid amounts/frequencies, unique IDs, safe annualization, and a consistent stored total when present. Only engine-relevant record fields are parsed; irrelevant contact fields are not carried into context or traces.

Dates are checked against the supplied evaluation date, including historical dates. Patient/member age uses the existing calendar utility: February 29 birthdays advance on March 1 in non-leap years. Household size derives from the member array. The fictional qualifying-child definition is a member with relationship child and age 0–12. One known qualifying child proves true even if another child's age is missing; without a known qualifying child, an undated child produces unknown. A primary self member is not counted as a dependent child.

Null, undefined, and absent supported fields produce unknown rule results, with actualValue null. Known zero, false, and empty arrays remain known values. The explicit unknown income-completeness marker also produces an unknown outcome when a rule evaluates completeness itself. Invalid provided data produces an error, rather than masquerading as missing information. Contradictory age/DOB or a known annual income without explicit completeness is invalid.

### Income completeness model change

Household now has an optional incomeInformationStatus: complete, incomplete, or unknown. Omission remains backward-compatible and means unknown. Fixtures explicitly mark every eleventh record incomplete and the remaining records complete. The enum is also accepted by household PATCH, allowing a status-only conditional update.

A complete report with an explicitly present empty source array represents confirmed zero income. Missing sources, missing status, unknown status, or incomplete status never imply zero. Existing totalAnnualIncome continues to show the sum of recorded sources in the profile, even for incomplete reports; the engine exposes annualHouseholdIncomeCents as null until completeness is confirmed.

Source changes automatically mark the report incomplete unless the same PATCH explicitly supplies completeness. Member-only changes preserve the status. Existing profile forms do not claim to verify income and therefore cannot silently mark an edited source list complete. The income editor provides explicit completeness confirmation, and the eligibility interface includes screening and an inspector. The pure engine remains unchanged; see [the UI guide](decision-inspector.md).

Annual income reuses the existing integer-cent utility: weekly × 52, biweekly × 26, monthly × 12, annually × 1. Member-reported income is descriptive and never added again. Source-to-member associations and income-per-member are not introduced because the current policies do not need them.

## Version selection and fictional policies

Policy version IDs are unique within a stable program ID. Registry validation rejects duplicate versions, inverted dates, and overlapping periods, including shared inclusive endpoints and open-ended overlaps. Validation checks the entire supplied registry so ambiguity outside the requested date is not hidden. Gaps are allowed but selection on a gap raises POLICY_NOT_APPLICABLE. Programs with different IDs may share a version label.

Selection returns one version per requested program. selectPoliciesForDate preserves selected ID order, or registry first-occurrence order when IDs are omitted. A missing applicable version is an explicit error; it is not silently skipped. screenPatient rejects multiple versions for the same program ID. evaluateProgram also checks the effective window for explicitly supplied versions. The published demo registry is deeply frozen; public contracts are readonly.

All current demonstration programs use ALL and residency in CO, AZ, or OR as fictional supported states. Nutrition 2025 supports only CO/AZ. The engine also supports ANY through its tested decision strategy. Nutrition and Family History versions extend the registry while preserving existing policy identifiers. Its explicitly counterfactual population evaluator bypasses effective-period enforcement for two selected versions at one fixed evaluation date; ordinary screening still enforces dates. See [the policy impact guide](policy-impact-analysis.md).

| Fictional program         | Version / effective dates   | Annual income ceiling | Other rules               |
| ------------------------- | --------------------------- | --------------------- | ------------------------- |
| Demo Health Coverage      | 2025.1 / Jan 1–Dec 31, 2025 | $32,000               | Patient age 18–64         |
| Demo Health Coverage      | 2026.1 / Jan 1, 2026 onward | $35,000               | Patient age 18–64         |
| Demo Nutrition Assistance | 2025.1 / Jan 1–Dec 31, 2025 | Below $35,000         | Household size 1–2; CO/AZ |
| Demo Nutrition Assistance | 2026.1 / Jan 1, 2026 onward | $42,000               | Household size at least 1 |
| Demo Childcare Support    | 2026.1 / Jan 1, 2026 onward | $55,000               | Qualifying child present  |
| Demo Housing Support      | 2026.1 / Jan 1, 2026 onward | $30,000               | Residency and income only |
| Demo Family Assistance    | 2025.1 / Jan 1–Dec 31, 2025 | $40,000               | Household size at least 3 |
| Demo Family Assistance    | 2026.1 / Jan 1, 2026 onward | $45,000               | Household size at least 2 |

Income ceilings are fixed per household with no hidden scaling; all are inclusive except the explicitly strict Nutrition 2025 ceiling. Every program has fictional: true, a fictional name label, and an explicit disclaimer. These numbers do not represent actual government benefits requirements.

## Sample result

For fictional patient fictional-patient, age 30, state CO, and complete annual household income of $24,000, evaluated on June 15, 2026:

```json
{
  "patientId": "fictional-patient",
  "programId": "demo-health",
  "programName": "Demo Health Coverage (Fictional)",
  "policyVersion": "2026.1",
  "status": "eligible",
  "passedRules": 4,
  "failedRules": 0,
  "unknownRules": 0,
  "missingFields": [],
  "evaluatedAt": "2026-06-15"
}
```

This abbreviated example omits ruleResults for readability. The returned income trace includes actualValue 2400000, expectedValue 3500000, operator less_than_or_equal, status pass, and reference DEMO-HEALTH-2026.1 / INCOME-01 / 2026.1. Its explanation states the actual $24,000.00, configured $35,000.00 ceiling, and that the demonstration condition is met. Incomplete income instead produces an unknown trace and identifies annualHouseholdIncomeCents and incomeInformationStatus as missing requirements.

## Errors and extension

EligibilityEngineError exposes a code: INVALID_CONTEXT, MALFORMED_POLICY, UNSUPPORTED_OPERATOR, AMBIGUOUS_POLICY_VERSION, or POLICY_NOT_APPLICABLE. Ordinary missing data is represented in rule results, not thrown. Configuration errors propagate and cannot become an eligibility decision.

To add a fictional program, define a readonly structured policy with a unique ID/version, explicit inclusive dates, category, fictional label/disclaimer, and at least one required rule. Add it to the registry and tests. New versions retain the program ID and require nonoverlapping windows. To add a rule on a supported field, choose an allowed type/operator/operand and a version-matching reference. To add a new field, extend the field/type schemas, context schema/builder, label mapping, and focused tests; add no executable expressions. Validate imported JSON through the exported schemas before use.

## Testing and throughput

```sh
npm run test:engine
npm run test:engine:coverage
npm run bench:engine
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

The separate engine configuration uses Node without application setup, jsdom, React Testing Library, or MSW. Tests cover all operators, typed contract rejection, three-valued decisions, complete ordered traces, date boundaries/gaps/overlaps, missing/invalid inputs, money safety, qualifying children, all 150 synthetic patients, fixture immutability, subsets, references, and changing system clocks. Compile-time negative examples verify that unsafe rule combinations are rejected by TypeScript as well as Zod.

V8 coverage covers eligibility engine/domain/policy runtime files and writes text, HTML, and JSON summaries under ignored coverage/eligibility. Thresholds are 90% statements/functions/lines and 85% branches. @vitest/coverage-v8 is pinned to the installed Vitest version.

The development benchmark measures 150 patients × five programs per operation, both with existing contexts and with normalization included. It reports timings without a hardware-dependent pass/fail threshold. Evaluation is linear in selected programs and rules (set comparisons add operand-list work), with bounded schema sizes. No workers, caching, or deep cloning beyond schema-boundary parsing are added.

## Verification and performance

Final verification on October 9, 2026: typecheck, ESLint, formatting, and the production build passed; all 266 application/engine tests passed. The isolated engine suite passed 144 tests with 98.05% statements, 98.42% branches, 98.46% functions, and 98.32% lines covered. Installed-Chrome Playwright passed 15 desktop/mobile tests with three intentional redundant viewport skips. No requested command was unavailable.

An isolated local benchmark measured approximately 63.8 ms per 150-patient/five-program batch with normalized contexts and 69.3 ms including context building. These are local development measurements, not performance guarantees.
