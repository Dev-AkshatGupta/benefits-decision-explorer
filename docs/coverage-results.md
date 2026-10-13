# Vitest V8 coverage

Full application source included; test helpers, tests, benchmarks and mock repositories excluded. Browser bootstrap remains included and visibly uncovered by Vitest; it is checked by production/browser smoke tests. E2E execution is not merged into this report.

| Scope                              | Statements | Branches | Functions |   Lines |
| ---------------------------------- | ---------: | -------: | --------: | ------: |
| All application source             |     90.62% |   86.76% |    88.53% |  92.14% |
| Eligibility engine/domain/policies |     98.07% |   98.44% |    98.46% |  98.34% |
| Simulation domain                  |     98.41% |   97.33% |   100.00% |  98.33% |
| Policy comparison/analysis domain  |    100.00% |   93.06% |   100.00% | 100.00% |
| Task domain                        |    100.00% |  100.00% |   100.00% | 100.00% |
| Coverage domain                    |    100.00% |   92.31% |   100.00% | 100.00% |

The engine-only coverage command also passes its existing 90/85/90/90 thresholds. HTML reports are generated under coverage/all and the feature-specific coverage directories. Raw final summary is in measurements/coverage-final.json.
