# Benefits Decision Explorer

A frontend demonstration of benefits screening and care coordination. Explore synthetic patient profiles, review fictional policies, understand screening results, and coordinate follow-up.

> Benefits Decision Explorer is an independent demonstration project. It is not affiliated with ITO Health. All patient records, policies, and eligibility results are fictional and must not be used for real benefit decisions.

## Run locally

Use Node.js 24 LTS and npm. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run dev
```

Development defaults to demo mode. For the standalone production demonstration:

```sh
npm run build:demo
npm run preview
```

Open the URL printed by Vite and use the Dashboard to explore the workflows. The production demo starts MSW before rendering React and needs no backend. Changes exist only in the current tab and disappear on refresh. Do not enter real personal information. **Reset demo data** restores all repositories after confirmation, clears caches, and reloads to discard drafts and analysis snapshots.

## Feature status

| Route                    | Implemented behavior                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `/patients`              | Paginated search, filters, sorting and synthetic patient summaries                                           |
| `/patients/:patientId`   | Profile, household members/income editing, task and recorded-coverage summaries                              |
| `/eligibility`           | Explicit screening, missing-information handling and Decision Inspector                                      |
| `/eligibility/simulator` | Temporary overrides and result/rule comparisons against a captured baseline; refresh requires a new baseline |
| `/policies`              | Structural version differences, full-population analysis, all nine transitions and patient impact inspection |
| `/tasks`                 | Creation, assignment, lifecycle changes and patient/screening/renewal linkage                                |
| `/coverage`              | Recorded periods/events, timeline, bounded gaps, renewal stages/deadlines and reviewed follow-up tasks       |
| `/dashboard`             | Starting page with links to the working demonstration workflows                                              |
| `/about`                 | Data boundaries, demonstration behavior and links to key workflows                                           |

Fixtures contain 150 patients, 150 households, five fictional coordinators, 250 tasks, 260 coverage periods and 378 recorded events. Eligibility, enrollment, recorded coverage, renewal stages and task completion remain separate concepts. Dates/thresholds are fictional conventions; this is not an insurance-verification or benefits-enrollment service.

## Demo configuration

| Build/runtime        | Flag                    | Result                                                                     |
| -------------------- | ----------------------- | -------------------------------------------------------------------------- |
| `npm run dev`        | unset                   | Demo mode, MSW                                                             |
| Development          | `VITE_DEMO_MODE=false`  | No mock worker; no backend is supplied                                     |
| `npm run build`      | unset or `false`        | Non-demo production shell, no mock repositories; data features need an API |
| `npm run build:demo` | `true` from `.env.demo` | Standalone production demonstration                                        |

Only exact strings `true`/`false` are accepted. Invalid values fail configuration validation; a demo build also rejects an override of `false`. `.env.example` documents the public flag. **Every `VITE_*` value is public client configuration: never place secrets in it.** Private/local env files are ignored; the safe demo/example files are committed. MSW's generated `public/mockServiceWorker.js` must be included in builds. Run `npm run mocks:init` only after an MSW upgrade.

## Deployment and demonstration

The source is available in the [public GitHub repository](https://github.com/Dev-AkshatGupta/benefits-decision-explorer). `vercel.json` configures a Vite static deployment, `npm run build:demo`, output `dist`, SPA deep-link rewrites, root worker scope and worker cache headers. The application has not been deployed to a public URL; local production behavior and live hosting are separate checks.

- [Deployment instructions, rollback and hosted verification](docs/deployment.md)
- [Founder demo: a reproducible 8–10 minute walkthrough](docs/founder-demo.md)
- [Architecture and engineering tradeoffs](docs/architecture.md)
- [Release scope, safety and verification report](docs/release-readiness.md)

## Verification commands

```sh
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run format:check
npm run build
npm run build:demo
npm run test:e2e
npm run test:demo
npm audit
```

Playwright uses desktop and mobile Chromium. Install its browser with `npx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome`/`msedge` for an installed browser. In PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'`.

`test:demo` builds the production demo and tests nested-route refreshes, the real service worker asset/API interception, all-repository reset, other-tab isolation, unsaved-draft/simulation reset, and reset-dialog accessibility. To check a published demo, set `$env:DEMO_BASE_URL='https://your-actual-demo-host.example'` (replace this placeholder) and run `npm run test:demo:remote`. Remove the variable afterward. Remote tests mutate **synthetic tab-local fixtures**; they require a visible demo environment and active worker before doing so.

Focused suites: `test:engine:coverage`, `test:screening:coverage`, `test:simulator:coverage`, `test:policies:coverage`. Measurements: `bench:engine`, `bench:policies`, `bench:readiness`, `audit:bundle`, `audit:browser`. `test:watch`, `format`, and `preview` support development. Recorded performance results are historical measurements and do not describe the current standalone demo bundle.

## Technical guides

- [Patient contracts and mock API](docs/patient-data-layer.md), [worklist](docs/patient-worklist.md), [household/profile editing](docs/patient-profile.md)
- [Eligibility engine](docs/eligibility-engine.md), [Decision Inspector](docs/decision-inspector.md), [What-if Simulator](docs/what-if-simulator.md)
- [Policy population analysis](docs/policy-impact-analysis.md), [care tasks](docs/care-coordination-tasks.md), [coverage/renewals](docs/coverage-renewals.md)
- [Performance audit](docs/performance-audit.md), [accessibility audit](docs/accessibility-audit.md), [testing strategy](docs/testing-strategy.md)

The application uses React 19, strict TypeScript, Vite, React Router, Tailwind/shadcn components, TanStack Query, React Hook Form, Zod, MSW, Vitest/RTL, Playwright, ESLint and Prettier. No Redux/Zustand, chart framework, worker pool or production backend is added. Authentication, shared persistence, real government rules, enrollment, notifications, an immutable audit log, and clinical/HIPAA compliance are outside this demonstration's verified scope.
