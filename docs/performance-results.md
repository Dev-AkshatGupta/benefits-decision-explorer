# Measured results

## Browser interaction medians (development + MSW)

| Workflow            | Baseline ms | Final ms |
| ------------------- | ----------: | -------: |
| initialLoad         |      704.00 |   873.50 |
| patientFiltering    |      448.70 |   467.00 |
| patientProfile      |      499.80 |   460.10 |
| dashboardNavigation |       87.60 |    68.30 |
| screening           |      108.10 |    93.20 |
| simulation          |      429.80 |   435.70 |
| populationAnalysis  |      639.60 |   624.90 |
| taskFiltering       |      413.90 |   442.60 |
| coverageTimeline    |      174.60 |   172.30 |

Five samples per workflow, same harness/environment. Timing includes dispatch, browser rendering/assertion polling, mock responses and debounce; small differences are not evidence of render-only improvements. Initial load varies with development server transforms and worker startup. Do not claim a universal browser speedup from these results.

## Pure computation medians

| Workflow                                 | Baseline ms | Final ms |
| ---------------------------------------- | ----------: | -------: |
| formatTwentyRows                         |        3.23 |     0.22 |
| screening150SourceOnePatientFivePrograms |        0.38 |     0.23 |
| simulationOnePatientFivePrograms         |        0.39 |     0.18 |
| population150NormalizedTwoPolicies       |       17.66 |     4.23 |
| population150NormalizationAndAnalysis    |       28.96 |    12.44 |
| coverageGaps260Records                   |        2.13 |     1.77 |

Ten warm-ups and 31 samples per operation. The formatter change benefits explanations as well as row rendering. Gap detection was hardened for identifier correctness, not optimized for speed. These are observations on one machine, not CI limits or service-level guarantees.

## Production asset sizes

| Chunk                      | Baseline raw / gzip kB | Final raw / gzip kB |
| -------------------------- | ---------------------: | ------------------: |
| index                      |        430.86 / 134.78 |     431.20 / 134.94 |
| client                     |         102.28 / 29.91 |      102.08 / 29.83 |
| patients-page              |           15.26 / 4.57 |        15.26 / 4.57 |
| patient-detail-page        |           31.96 / 7.83 |        31.96 / 7.84 |
| eligibility-page           |           23.80 / 6.52 |        23.80 / 6.52 |
| eligibility-simulator-page |           17.73 / 5.33 |        17.74 / 5.33 |
| policies-page              |           29.00 / 8.25 |        29.01 / 8.26 |
| tasks-page                 |            6.27 / 2.25 |         6.27 / 2.25 |
| coverage-page              |           29.56 / 8.19 |        30.30 / 8.37 |
| task-editor                |          59.86 / 20.16 |       59.91 / 20.43 |

No initial-download reduction is claimed. The small entry increase funds retry handling; coverage growth funds draft protection and accessible errors. The unchanged lazy boundaries keep form libraries, Zod schemas and feature code deferred. Error response parsing is separated from lightweight error classes so eager retry configuration does not pull Zod into the shell. CSS: 29.60 → 29.67 kB.

Production preview's final-only initial load is recorded separately in production-final.json. There is no production baseline for comparison and no API backend in preview.
