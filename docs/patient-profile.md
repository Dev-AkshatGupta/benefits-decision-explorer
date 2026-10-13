# Patient profile and household management

`/patients/:patientId` displays personal information, contact/address, household members, household income, and a saved profile summary. The header includes name, identifier, age, state, status, coordinator, and a UTC update timestamp. Back to Patients preserves the validated worklist context carried in router history state. Navigation from screening instead offers Back to screening with the sanitized patient/date/program context preserved.

## Editing architecture

Patient, household, and coordinator queries load independently, allowing household failures to show a separate retry while the patient remains visible. Optional missing values are labeled Not provided. Empty income sources have a dedicated state.

Three independent React Hook Form editors use Zod validation: a profile dialog, an inline household-member field array, and an inline income-source field array. Only one editor opens at a time. Domain schemas and pure form mapping functions remain separate from presentation and Fetch functions. No new dependency or global state store is introduced.

Each editor captures saved defaults and an updatedAt baseline on opening. Background query refreshes do not replace active drafts. Save validates before submitting, disables controls while pending, prevents duplicate submissions, and shows accessible feedback. Failed saves retain the draft. Cancel discards it. A conflict offers an explicit reload of current saved data; failed reloads preserve the draft.

React Router useBlocker protects route navigation. A Radix confirmation dialog offers Keep editing or Discard changes, with focus restoration. useBeforeUnload requests the browser's native warning for tab closure/refresh where supported. Explicit Cancel is an intentional discard. Browser prompt wording is controlled by the browser.

## API and integrity

Profile PATCH retains its existing fields and accepts null to clear optional gender, email, and phone. Profile changes synchronize the household primary member's name and birth date. New editors send If-Match containing the quoted captured timestamp. Household PATCH requires this header; stale writes return 409 CONFLICT. Legacy patient callers may omit the header for compatibility.

Household PATCH accepts members and/or incomeSources. The API also permits incomeInformationStatus: complete, incomplete, or unknown. Source edits mark completeness incomplete unless the same request explicitly confirms it; the income editor now permits explicit completeness confirmation through an unchecked-by-default checkbox. This is a demonstration marker, not real verification. The server validates unique stable IDs, exactly one self member, unchanged self identity, and matching primary name/date of birth. The primary member cannot be removed; identity changes use Edit Profile. New member/source IDs use crypto.randomUUID and remain stable during editing. Root IDs and household links are immutable. Successful household changes advance both household and patient timestamps so worklist ordering remains current. Source fixtures are never mutated; the session database is separate.

Household size derives from members.length. Income amounts use safe integer USD cents. Dollar input is parsed as a decimal string with BigInt before conversion to safe integers, avoiding floating-point dollar conversion. Source annualization uses the existing pure utility: weekly × 52, biweekly × 26, monthly × 12, annually × 1. A $2,000 monthly source annualizes to $24,000. Negative values, excessive precision, and overflow are rejected.

The household total derives exclusively from income sources. Member-reported annual income remains descriptive and is never added again. The existing model has no source-to-member association, so no association field is invented. Size and annual total are read-only derived values. Editors show live income previews; the profile summary shows saved values until saving succeeds.

## Query cache

Patient saves cancel older detail reads, set the authoritative patient response, and invalidate patient lists, global summary counts, and the related household. Household saves cancel older household reads, set the authoritative household response, and invalidate the current patient detail and patient lists. Unrelated patient detail and coordinator caches are preserved. There are no optimistic writes; failed mutations leave saved cache data intact.

## Verification and limitations

Typecheck, ESLint, 121 Vitest/RTL tests, and the production build pass. Playwright using installed Chrome passes 15 tests; three redundant viewport combinations are intentionally skipped. Coverage includes edits, validation, optional clearing, cancellation, failures/retries, primary-member protection, stable IDs, exact income, concurrency conflicts, draft preservation, unsaved navigation, focus, and worklist synchronization. Desktop/mobile screenshots and the 320px profile dialog were reviewed.

Development and the standalone demo use synthetic MSW data. Changes last for the current browser session and reset on reload; ordinary production builds require a compatible API. Authentication, patient creation, and external data integrations are outside the current workflow. All records and income conventions are synthetic; no public-benefits determination is made.
