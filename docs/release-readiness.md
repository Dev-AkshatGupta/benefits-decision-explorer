# Release readiness

## Scope and starting point

This report records the release scope and local verification completed on October 10, 2026. Live hosting checks were not part of that verification.

The initial repository verification passed: typecheck, zero-warning lint, 467 unit/integration tests across 31 files, production build, and 44 Playwright tests with four intentional duplicate-viewport skips. The main release gap was production MSW: ordinary production expected an API backend. The standalone demonstration build starts MSW before rendering React.

## Delivered

- An explicit validated public `VITE_DEMO_MODE` flag and `.env.demo` build profile, plus `.env.example` guidance.
- Production MSW startup before React, absolute root worker URL/scope, quiet logging and the existing typed API/repository architecture.
- A visible demo banner explaining synthetic records and tab-local changes; the complete independence/fictional-data disclaimer appears in the application and README.
- Confirmed all-repository reset, blocking while saves run, cancellation of active reads, validated reset response, cache clearing and post-completion reload to clear drafts/snapshots. Other tabs remain independent.
- Vercel build/output/SPA rewrite and worker/security-header configuration. Private env files/provider metadata are ignored.
- A rewritten README, architecture guide, deployment/rollback checklist and seeded 8–10 minute founder walkthrough.
- Unit/integration reset/configuration tests and a dedicated desktop/mobile built-demo suite, plus an origin-only HTTPS hosted-test command.

No production dependencies, backend, state-management framework, authentication or major business module were added. Existing engine/rule definitions and feature structure remain intact.

## Safety review

Fixtures are generated in `src/mocks/data`: patient/household/coordinator/task/coverage/event records are fictional. Policies are demonstration definitions in the existing registry. Branding uses the original application title/favicon and generic Lucide icons; no ITO logo, internal code, real patient information, credential or private endpoint is included. Dynamic text is rendered through React; no unsafe HTML insertion or patient browser-storage persistence was added. `VITE_*` variables are explicitly public. No compliance certification or real benefits determination is claimed.

The reset endpoint is a synthetic browser mock, not an authenticated administrative server. Confirmation is a UX safeguard, not authorization/security infrastructure. All normal draft guards remain active; the confirmed successful reset bypasses them for one reload because the user has already agreed to discard drafts. Failure does not claim completion; repeating a reset is safe.

## Verification record

Final local verification on October 10, 2026, using Node 24 and installed Chrome:

| Check                             | Result                                                                     |
| --------------------------------- | -------------------------------------------------------------------------- |
| TypeScript                        | Passed, no errors                                                          |
| ESLint                            | Passed, zero warnings                                                      |
| Prettier                          | Passed, all matched files formatted                                        |
| Vitest with V8 coverage           | 483 tests in 34 files passed                                               |
| Coverage                          | 90.58% statements, 86.44% branches, 88.41% functions, 92.16% lines         |
| Development Playwright            | 44 passed; four intentional duplicate-viewport skips                       |
| Built-demo Playwright             | Eight passed across desktop/mobile                                         |
| Ordinary production build         | Passed                                                                     |
| Ordinary production browser check | Passed: no worker registration, safe missing-backend error                 |
| Standalone demo production build  | Passed                                                                     |
| Public environment validation     | Invalid flag and disabled demo override correctly rejected before building |
| npm audit                         | Zero reported vulnerabilities                                              |

The built-demo suite verifies real worker/assets and deep-link refreshes, seeded screening/simulation/population results, all-repository reset, cancellation, independent tabs, draft/snapshot discard, responsive controls and zero axe violations in the reset dialog. A regression found during verification was fixed: explicit reset confirmation now signals the application's draft guards during the reload rather than depending on event listener ordering. Ordinary unsaved-change protection remains tested and active.

Coverage, deployment artifacts and test outputs are distinct from earlier performance measurements. The standalone demo deliberately includes MSW/fixtures; this release does not claim a smaller bundle or new performance benchmark. Hosted tests (`test:demo:remote`) were not executed because no live demonstration URL was available. Vercel CDN routing/header delivery cannot be claimed as verified by local preview.

## Remaining limits

There is no verified live deployment URL. Hosted rewrite/header checks and hosted E2E remain to be run after publishing. Local production tests validate the built application and worker behavior, not Vercel infrastructure. Demo data is lost on refresh and is not shared between tabs or users; persistent analysis/task history, authentication, enrollment, notification delivery, and real policy integrations are not part of this project. Accessibility automation does not replace a full assistive-technology review.
