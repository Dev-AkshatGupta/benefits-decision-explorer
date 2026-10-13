# Patient data layer

Step 3 defines data contracts and integration; Step 4 adds a read-only worklist, Step 5 adds profile and household editing, and Step 6 adds a separate pure TypeScript eligibility engine. All records are synthetic and every rule in this mock environment is a fictional modeling convention, not a public-benefits rule.

## Domain conventions

The patient feature owns its interfaces, Zod schemas, Fetch functions, and Query hooks. Interfaces derive from the schemas to keep compile-time and runtime contracts aligned. Domain date and income functions are framework-independent.

- Calendar dates use `YYYY-MM-DD`. Birth dates must exist and cannot exceed the current UTC calendar date. Age compares calendar year/month/day, never elapsed milliseconds. February 29 birthdays advance on March 1 in non-leap years; this is an explicit application convention, not an eligibility rule.
- Timestamps use ISO UTC strings ending in `Z`; comparisons use timestamp values rather than formatted strings. Display formatting uses `en-US` and UTC, including date-only values, to prevent local timezone shifts.
- All amounts are non-negative safe integer **USD cents**. An income source amount is per its stated frequency. Household member `income` means annual income in cents. Source annualization uses weekly × 52, biweekly × 26, monthly × 12, and annually × 1. These are simplified fictional modeling assumptions.
- Household `totalAnnualIncome` derives exclusively from its income sources, not member incomes. Member incomes are descriptive and must never be summed again into household totals. Schema validation verifies the derived total and guards arithmetic overflow. Currency formatting preserves exact cents even at the safe-integer limit.
- Household size includes the patient and equals the member count. Member IDs and income source IDs are unique within a household. Schemas require exactly one self member per household.
- Addresses use country `US`, fifty state abbreviations plus `DC`, and five-digit ZIP codes with optional four-digit extensions. Optional phone numbers accept ten U.S. digits with common separators and optional country code `1`. Optional contact fields can be omitted in saved records; blank or null record values are invalid. Patient PATCH accepts null for gender, email, and phone to explicitly clear those optional fields.

Household incomeInformationStatus is optional for backward compatibility and accepts complete, incomplete, or unknown. Omission means unknown. Source updates default to incomplete unless the same conditional PATCH explicitly reconfirms completeness; member-only updates preserve it. Recorded totals remain derived from sources. The eligibility engine exposes income as unknown until a complete report with present sources is supplied; only a complete empty source list confirms zero income. See [the engine guide](eligibility-engine.md).

## Synthetic fixtures

`src/mocks/data/patients.ts` deterministically creates 150 patients, 150 matching households, and five coordinators from fixed arrays and index-based selection. No randomness or current timestamps enter fixture generation. Fixture timestamps are fixed, while list ages use the current UTC date. Every record validates before use.

Names and addresses are invented. Email addresses use reserved `example.com` or `example.org` domains, and phones use the fictional `202-555-0100` through `202-555-0199` range. Scenarios vary state, age, household size, source type, frequency, income level, status, and optional contact information. Fixtures are examples, not socioeconomic representations or benefits rules.

The MSW database is held in memory. Updates survive subsequent requests within a page session and reset on reload. Test teardown resets both handlers and data to prevent cross-test leakage. There is no persistence, authentication, or actual backend.

## REST contract

| Method and endpoint                        | Response                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `GET /api/patients`                        | `{ data: PatientSummary[], pagination: { page, pageSize, totalItems, totalPages } }` |
| `GET /api/patients/summary`                | `{ totalPatients, activePatients, pendingReview }` across the entire dataset         |
| `GET /api/patients/:patientId`             | `Patient`                                                                            |
| `GET /api/patients/:patientId/household`   | `Household` with members and income sources                                          |
| `PATCH /api/patients/:patientId/household` | Updated `Household`, including optional income completeness                          |
| `GET /api/coordinators`                    | `CareCoordinator[]`                                                                  |
| `PATCH /api/patients/:patientId`           | Updated `Patient`                                                                    |

List parameters:

| Parameter       | Default and accepted values                                                     |
| --------------- | ------------------------------------------------------------------------------- |
| `page`          | 1; integer 1–1,000,000                                                          |
| `pageSize`      | 20; integer 1–100                                                               |
| `search`        | Empty; trimmed name substring, case-insensitive, at most 100 characters         |
| `status`        | Optional: `active`, `pending_review`, `inactive`                                |
| `state`         | Optional: supported uppercase U.S. abbreviation                                 |
| `coordinatorId` | Optional nonempty ID; unknown IDs yield an empty worklist                       |
| `sortBy`        | `fullName`; also `age`, `state`, `status`, `assignedCoordinator`, `lastUpdated` |
| `sortOrder`     | `asc` or `desc`                                                                 |

Filtering, sorting, and slicing occur in MSW. String sorting uses deterministic JavaScript ordering; equal primary values always break ties by ascending patient ID. Out-of-range pages return empty data and retain the requested page. Empty results have zero total pages. Summaries omit DOB, contact information, street addresses, household details, and income; assigned coordinator contains only ID and full name.

PATCH permits `firstName`, `lastName`, `dateOfBirth`, `gender`, `email`, `phone`, `address`, `status`, and `assignedCoordinatorId`. Address replacement requires a complete address. Coordinator references must exist. IDs, household links, and creation/update timestamps are immutable. Unknown fields and empty bodies are rejected. The server advances `updatedAt`, preserves creation time, and synchronizes household self-member name and birth date. Profile editors send a quoted updatedAt value in If-Match; stale versions return 409. Legacy callers may omit the patient version header for backward compatibility. All new editors use conditional updates.

PATCH /api/patients/:patientId/household accepts members, incomeSources, and/or incomeInformationStatus and returns the updated Household. If-Match is required. Household IDs, links, timestamps, size, and totals cannot be supplied as editable fields. The server derives size and income, protects primary-patient identity, and advances both household and patient timestamps.

Successful responses are 200. Invalid bodies, parameters, repeated parameters, and unknown parameters return 400. Unknown patients or missing households return 404. Error payloads use `{ error: { code, message, issues? } }`; issue entries contain `path` and `message`, not patient values. Codes are `INVALID_REQUEST`, `INVALID_JSON`, `NOT_FOUND`, or `CONFLICT`. Stale conditional writes return 409 without changing saved data.

## Client and TanStack Query

Feature API functions use native Fetch through `src/lib/api/client.ts`. Successful responses are parsed with Zod. Contract failures throw `ApiResponseError`; HTTP failures throw `ApiError` with status, code, and optional issues. Network errors and cancellations propagate normally. Read functions accept `AbortSignal` from Query. Updates validate before serialization and again in MSW.

Hooks: `usePatients`, `usePatient`, `usePatientHousehold`, `useCoordinators`, `useUpdatePatient`, and `useUpdateHousehold`. Query options are exported for prefetching or direct QueryClient use. List keys include normalized filters and pagination, so omitted defaults share cache entries with explicit defaults. Empty patient IDs disable dependent reads. Schema failures and 4xx responses are not retried; transient failures retry once. Existing provider stale-time settings remain in place.

On successful mutation, pending detail reads are canceled, detail cache receives the authoritative response, and patient lists and the related household are invalidated. Patient mutations also invalidate global summary counts. Household mutations cancel older household reads, set the authoritative household response, and invalidate the current patient detail and patient lists. Unrelated patient details and coordinator metadata are not invalidated. Mutation failures leave existing data intact. There is no optimistic update or global client store.

A future backend can serve the same `/api` contract through the same origin or a proxy. Centralized Fetch code can be changed for a different base URL without rewriting feature components. MSW is enabled only in development and tests.

## Verification

Domain tests cover fixture integrity, calendar boundaries, leap days, contact/address validation, household consistency, safe integer math, and exact currency display. API tests cover pagination, filtering, stable sorting, immutable updates, concurrent partial updates, status/error contracts, response validation, and cancellation. Query tests cover caching, disabled reads, error states, mutation refresh, and preservation of data on failure. Existing shell tests remain in place.
