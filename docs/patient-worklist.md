# Patient worklist

`/patients` provides searchable, paginated patient discovery. `/patients/:patientId` displays the editable profile and household sections described in [the patient profile guide](patient-profile.md).

## URL state

`usePatientWorklistParams` reads controls directly from React Router search parameters and validates each field independently. Valid filters survive invalid values elsewhere. Unsupported or repeated parameters, unknown keys, and redundant defaults are removed through history replacement. Unknown coordinator IDs are removed when metadata loads.

Defaults: page 1, 20 rows, last-updated descending, no search or filters. Page sizes: 10, 20, 50. Sort fields: full name, age, last updated. These defaults explicitly override the API's name-ascending default.

User changes push history entries; Back/Forward restores controls. Search keeps only a transient typing buffer and commits a trimmed value after 300ms. Clearing search commits immediately. Search/filter/sort/size changes reset page 1; pagination preserves other controls. Out-of-range pages are replaced with the last available page after totals arrive.

Example: `/patients?page=2&pageSize=10&status=active&state=CO&sortBy=fullName&sortOrder=asc`.

Patient links and row clicks carry the committed search string in router history state. The back link reconstructs a validated local worklist URL. Newly copied detail URLs return to the default list. No global store or browser storage is needed.

## Queries and API

Existing Fetch functions, response validation, and TanStack Query hooks own server data. Query keys include all normalized controls. No server records are copied into local state and no client filtering or sorting occurs. Coordinator metadata shares its existing cache key.

`GET /api/patients/summary` returns `{ totalPatients, activePatients, pendingReview }`, calculated from the entire mock database. It ignores worklist filters, has a separate Zod schema/query key, and is invalidated after successful patient updates. The frontend never downloads all records to calculate cards.

Previous rows remain visible only for page/size transitions with identical search, filters, and sorting. A live message identifies fetching; pagination is disabled until results arrive. Initial requests use skeleton rows. New filters or sorting never label old rows as new results. Errors show safe messages and Retry. Summary and coordinator errors have separate retry controls.

## Presentation and architecture

A native semantic table handles the small fixed column set without another dependency. Sorting buttons expose `aria-sort`. Native patient links provide keyboard access; noninteractive row areas support pointer navigation. Text status badges use shared success, warning, and neutral tokens.

Below 768px, the same query response renders patient cards and mobile sort controls. Search, filters, and pagination have explicit labels and focus styles. Compact summary cards leave mobile space for the worklist. Patient routes load lazily with real chunk-loading fallbacks, keeping their data/UI code out of the dashboard's initial bundle. No artificial delays or virtualization are introduced.

## Scope and limitations

- The coordinator filter is explicitly labeled Morgan Chen; it is a synthetic fixture, not an authenticated user identity.
- Patient creation and external data imports are outside the current workflow; profile and household editing are available from each patient record.
- Development and the standalone demo use synthetic MSW data; ordinary production builds need a compatible `/api` implementation.
- Detail return context uses router history state and does not accompany newly copied detail URLs.

## Verification

Vitest/RTL cover rendering and global counts, debounce, individual/combined filters, sorting, pagination, sizes, URL normalization, Back/Forward, page clamping, empty/error/retry states, retained page data, keyboard/detail navigation, and mobile card markup. API/query tests verify summary counts and mutation invalidation.

Playwright covers desktop/mobile visibility, request debouncing, filter/detail context, history restoration, sorting, pagination, unknown patients, empty results, runtime errors, and viewports from 320–1280px. Screenshots are saved in ignored `test-results` directories for visual review.
