import { readFile, writeFile } from 'node:fs/promises';
const read = async (name) =>
  JSON.parse(await readFile(`docs/measurements/${name}.json`, 'utf8'));
const [
  browserBefore,
  browserAfter,
  computeBefore,
  computeAfter,
  bundleBefore,
  bundleAfter,
] = await Promise.all([
  read('browser-baseline'),
  read('browser-final'),
  read('computation-baseline'),
  read('computation-final'),
  read('bundle-baseline'),
  read('bundle-final'),
]);
const fixed = (value) => value.toFixed(2);
const browserRows = Object.keys(browserBefore.timings)
  .map(
    (name) =>
      `| ${name} | ${fixed(browserBefore.timings[name].medianMs)} | ${fixed(browserAfter.timings[name].medianMs)} |`,
  )
  .join('\n');
const computeRows = computeBefore.measurements
  .map((before) => {
    const after = computeAfter.measurements.find(
      (row) => row.name === before.name,
    );
    return `| ${before.name} | ${fixed(before.medianMs)} | ${fixed(after.medianMs)} |`;
  })
  .join('\n');
const asset = (report, prefix, extension = '.js') =>
  report.assets.find(
    (row) => row.name.startsWith(prefix + '-') && row.name.endsWith(extension),
  );
const bundleRows = [
  'index',
  'client',
  'patients-page',
  'patient-detail-page',
  'eligibility-page',
  'eligibility-simulator-page',
  'policies-page',
  'tasks-page',
  'coverage-page',
  'task-editor',
]
  .map((name) => {
    const before = asset(bundleBefore, name),
      after = asset(bundleAfter, name);
    return `| ${name} | ${fixed(before.bytes / 1000)} / ${fixed(before.gzipBytes / 1000)} | ${fixed(after.bytes / 1000)} / ${fixed(after.gzipBytes / 1000)} |`;
  })
  .join('\n');
await writeFile(
  'docs/performance-baseline.md',
  `# Performance baseline — Step 13\n\nMeasured ${browserBefore.measuredAt} (browser) and ${computeBefore.measuredAt} (computation). No product changes preceded these baseline captures; audit instrumentation and the axe development dependency were added first.\n\nExisting verification: TypeScript, zero-warning ESLint, formatting and production build passed; 454 tests across 29 files passed; Playwright passed 36 tests with four intentional mobile duplicate-viewport skips. npm audit reported zero vulnerabilities.\n\n## Repeatable method\n\nBrowser: installed Chrome ${browserBefore.browser}, 1440 × 900, no throttling, five fresh contexts. Each workflow starts with known synthetic fixtures; screening/policy evaluation uses 2026-06-15 and coverage uses 2026-10-09. Browser Performance API marks encompass Playwright action dispatch and the assertion that the relevant result is visible. Initial load is performance.now() after the dashboard heading is visible. These are development + MSW interaction measurements, not Web Vitals, production timings or React commit durations. Search includes its intentional 300 ms debounce. Do not compare with a run made under concurrent heavy testing or throttling.\n\nPure computations: ${computeBefore.environment.node} on ${computeBefore.environment.platform}, ${computeBefore.environment.cpu}. Ten warm-up operations, 31 samples, median per operation; small operations are batched (counts preserved in JSON). Five programs for one patient; 150 patients for the two Family policies; 260 periods for gap detection; 20 rows for formatter measurements. Fetching/fingerprinting are excluded from pure analysis timing.\n\n| Browser workflow | Baseline median ms |\n| --- | ---: |\n${Object.keys(
    browserBefore.timings,
  )
    .map(
      (name) => `| ${name} | ${fixed(browserBefore.timings[name].medianMs)} |`,
    )
    .join(
      '\n',
    )}\n\n| Pure workflow | Baseline median ms |\n| --- | ---: |\n${computeBefore.measurements.map((row) => `| ${row.name} | ${fixed(row.medianMs)} |`).join('\n')}\n\nProduction entry JavaScript: ${fixed(asset(bundleBefore, 'index').bytes / 1000)} kB raw, ${fixed(asset(bundleBefore, 'index').gzipBytes / 1000)} kB gzip. Shared API/schema and feature chunks are deferred; do not add every emitted chunk to the initial-load size. Sizes use decimal kB. All assets and raw timing samples are in measurements/*-baseline.json.\n\n## Initial architecture observations\n\nMajor functional routes already use lazy + Suspense with status fallbacks. Dashboard and Settings are small placeholders, appropriately eager. Server lists are paginated; full-population fetch is a dedicated bounded batch used only for explicit analysis. Local screening/simulation state is scoped; no Zustand/Redux or browser patient storage. Pure analysis already validates policies outside its loop and derives one context per patient. Existing memoization limits simulator recalculation and population sorting to changed inputs.\n\nPotential costs to investigate: new Intl formatters for every money/date/rule display; parent callback identity resets a search timer; inconsistent read retry behavior; event requests for invalid coverage IDs. Keyboard focus restoration accepts only HTML elements despite SVG timeline buttons. No evidence supports virtualization or a worker for this dataset.\n`,
);
await writeFile(
  'docs/performance-results.md',
  `# Measured results\n\n## Browser interaction medians (development + MSW)\n\n| Workflow | Baseline ms | Final ms |\n| --- | ---: | ---: |\n${browserRows}\n\nFive samples per workflow, same harness/environment. Timing includes dispatch, browser rendering/assertion polling, mock responses and debounce; small differences are not evidence of render-only improvements. Initial load varies with development server transforms and worker startup. Do not claim a universal browser speedup from these results.\n\n## Pure computation medians\n\n| Workflow | Baseline ms | Final ms |\n| --- | ---: | ---: |\n${computeRows}\n\nTen warm-ups and 31 samples per operation. The formatter change benefits explanations as well as row rendering. Gap detection was hardened for identifier correctness, not optimized for speed. These are observations on one machine, not CI limits or service-level guarantees.\n\n## Production asset sizes\n\n| Chunk | Baseline raw / gzip kB | Final raw / gzip kB |\n| --- | ---: | ---: |\n${bundleRows}\n\nNo initial-download reduction is claimed. The small entry increase funds retry handling; coverage growth funds draft protection and accessible errors. The unchanged lazy boundaries keep form libraries, Zod schemas and feature code deferred. Error response parsing is separated from lightweight error classes so eager retry configuration does not pull Zod into the shell. CSS: ${fixed(asset(bundleBefore, 'index', '.css').bytes / 1000)} → ${fixed(asset(bundleAfter, 'index', '.css').bytes / 1000)} kB.\n\nProduction preview's final-only initial load is recorded separately in production-final.json. There is no production baseline for comparison and no API backend in preview.\n`,
);
const coverage = JSON.parse(
  await readFile('coverage/all/coverage-summary.json', 'utf8'),
);
await writeFile(
  'docs/measurements/coverage-final.json',
  JSON.stringify(coverage, null, 2) + '\n',
);
const groups = {
  'All application source': null,
  'Eligibility engine/domain/policies':
    /features\/eligibility\/(engine|domain|policies)\//,
  'Simulation domain': /features\/eligibility\/simulator\/domain\//,
  'Policy comparison/analysis domain': /features\/policies\/domain\//,
  'Task domain': /features\/tasks\/domain\//,
  'Coverage domain': /features\/coverage\/domain\//,
};
const metrics = ['statements', 'branches', 'functions', 'lines'];
const coverageRows = Object.entries(groups)
  .map(([label, pattern]) => {
    const records = pattern
      ? Object.entries(coverage)
          .filter(([name]) => pattern.test(name.replaceAll('\\', '/')))
          .map(([, row]) => row)
      : [coverage.total];
    const values = metrics.map((metric) => {
      if (!pattern) return fixed(coverage.total[metric].pct) + '%';
      const total = records.reduce((sum, row) => sum + row[metric].total, 0),
        covered = records.reduce((sum, row) => sum + row[metric].covered, 0);
      return fixed((100 * covered) / total) + '%';
    });
    return `| ${label} | ${values.join(' | ')} |`;
  })
  .join('\n');
await writeFile(
  'docs/coverage-results.md',
  `# Vitest V8 coverage\n\nFull application source included; test helpers, tests, benchmarks and mock repositories excluded. Browser bootstrap remains included and visibly uncovered by Vitest; it is checked by production/browser smoke tests. E2E execution is not merged into this report.\n\n| Scope | Statements | Branches | Functions | Lines |\n| --- | ---: | ---: | ---: | ---: |\n${coverageRows}\n\nThe engine-only coverage command also passes its existing 90/85/90/90 thresholds. HTML reports are generated under coverage/all and the feature-specific coverage directories. Raw final summary is in measurements/coverage-final.json.\n`,
);
