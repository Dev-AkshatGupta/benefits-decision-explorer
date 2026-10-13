# Performance baseline

Measured 2026-10-09T17:30:33.680Z (browser) and 2026-10-09T17:33:00.236Z (computation). No product changes preceded these baseline captures; audit instrumentation and the axe development dependency were added first.

Existing verification: TypeScript, zero-warning ESLint, formatting and production build passed; 454 tests across 29 files passed; Playwright passed 36 tests with four intentional mobile duplicate-viewport skips. npm audit reported zero vulnerabilities.

## Repeatable method

Browser: installed Chrome 153.0.8010.53, 1440 × 900, no throttling, five fresh contexts. Each workflow starts with known synthetic fixtures; screening/policy evaluation uses 2026-06-15 and coverage uses 2026-10-09. Browser Performance API marks encompass Playwright action dispatch and the assertion that the relevant result is visible. Initial load is performance.now() after the dashboard heading is visible. These are development + MSW interaction measurements, not Web Vitals, production timings or React commit durations. Search includes its intentional 300 ms debounce. Do not compare with a run made under concurrent heavy testing or throttling.

Pure computations: v24.19.0 on win32, AMD Ryzen 7 7840HS w/ Radeon 780M Graphics . Ten warm-up operations, 31 samples, median per operation; small operations are batched (counts preserved in JSON). Five programs for one patient; 150 patients for the two Family policies; 260 periods for gap detection; 20 rows for formatter measurements. Fetching/fingerprinting are excluded from pure analysis timing.

| Browser workflow    | Baseline median ms |
| ------------------- | -----------------: |
| initialLoad         |             704.00 |
| patientFiltering    |             448.70 |
| patientProfile      |             499.80 |
| dashboardNavigation |              87.60 |
| screening           |             108.10 |
| simulation          |             429.80 |
| populationAnalysis  |             639.60 |
| taskFiltering       |             413.90 |
| coverageTimeline    |             174.60 |

| Pure workflow                            | Baseline median ms |
| ---------------------------------------- | -----------------: |
| formatTwentyRows                         |               3.23 |
| screening150SourceOnePatientFivePrograms |               0.38 |
| simulationOnePatientFivePrograms         |               0.39 |
| population150NormalizedTwoPolicies       |              17.66 |
| population150NormalizationAndAnalysis    |              28.96 |
| coverageGaps260Records                   |               2.13 |

Production entry JavaScript: 430.86 kB raw, 134.78 kB gzip. Shared API/schema and feature chunks are deferred; do not add every emitted chunk to the initial-load size. Sizes use decimal kB. All assets and raw timing samples are in measurements/*-baseline.json.

## Initial architecture observations

Major functional routes use lazy loading with accessible status fallbacks. Server lists are paginated; full-population fetch is a dedicated bounded batch used only for explicit analysis. Local screening/simulation state is scoped; no Zustand/Redux or browser patient storage. Pure analysis validates policies outside its loop and derives one context per patient. Memoization limits simulator recalculation and population sorting to changed inputs.

Potential costs to investigate: new Intl formatters for every money/date/rule display; parent callback identity resets a search timer; inconsistent read retry behavior; event requests for invalid coverage IDs. Keyboard focus restoration accepts only HTML elements despite SVG timeline buttons. No evidence supports virtualization or a worker for this dataset.
