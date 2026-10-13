import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
test('repeatable development + MSW browser timings', async ({ browser }) => {
  const samples: Record<string, number[]> = {};
  async function measure(
    page: Page,
    name: string,
    action: () => Promise<void>,
  ) {
    await page.evaluate(() => performance.mark('audit-start'));
    await action();
    const duration = await page.evaluate(() => {
      performance.mark('audit-end');
      return performance.measure('audit', 'audit-start', 'audit-end').duration;
    });
    (samples[name] ??= []).push(duration);
  }
  for (let trial = 0; trial < 5; trial++) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Start with a patient or workflow',
      }),
    ).toBeVisible();
    samples.initialLoad ??= [];
    samples.initialLoad.push(await page.evaluate(() => performance.now()));
    await page.goto('/patients');
    await expect(page.getByText('Showing 1–20 of 150 patients')).toBeVisible();
    await measure(page, 'patientFiltering', async () => {
      await page
        .getByLabel('Search patients', { exact: true })
        .fill('Reese Alden');
      await expect(page.getByText('Showing 1–1 of 1 patients')).toBeVisible();
    });
    await measure(page, 'patientProfile', async () => {
      await page.getByRole('link', { name: /View Reese Alden/ }).click();
      await expect(
        page
          .getByRole('region', { name: 'Household Income' })
          .getByText('$0.00')
          .first(),
      ).toBeVisible();
    });
    await measure(page, 'dashboardNavigation', async () => {
      await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Start with a patient or workflow',
        }),
      ).toBeVisible();
    });
    await page.goto('/eligibility?patientId=patient-011&date=2026-06-15');
    await expect(
      page.getByRole('button', { name: 'Run screening' }),
    ).toBeEnabled();
    await measure(page, 'screening', async () => {
      await page.getByRole('button', { name: 'Run screening' }).click();
      await expect(
        page.getByRole('link', { name: 'Explore What-if Scenarios' }),
      ).toBeVisible();
    });
    await page.getByRole('link', { name: 'Explore What-if Scenarios' }).click();
    await measure(page, 'simulation', async () => {
      await page
        .getByLabel('Hypothetical annual income (USD)', { exact: true })
        .fill('60000.00');
      await expect(
        page.getByText(
          /3 changed programs · 2 unchanged programs · 5 changed rules/,
        ),
      ).toBeVisible();
    });
    await page.goto(
      '/policies?program=demo-family&baseline=2025.1&comparison=2026.1&date=2026-06-15',
    );
    await measure(page, 'populationAnalysis', async () => {
      await page
        .getByRole('button', { name: 'Run Population Impact Analysis' })
        .click();
      await expect(page.getByRole('status')).toContainText(
        '150 patients evaluated',
      );
    });
    await page.goto('/tasks');
    await expect(page.getByLabel('Task overview')).toContainText(
      'Open tasks150',
    );
    await measure(page, 'taskFiltering', async () => {
      await page.getByLabel('Search tasks').fill('Reese Alden');
      await expect(page).toHaveURL(/search=Reese/);
      await expect(page.getByText(/^\d+ matching tasks · Page/)).toBeVisible();
    });
    await page.goto('/coverage?date=2026-10-09&search=Jordan+Alden');
    const records = page.getByRole('region', { name: 'Coverage records' });
    await expect(
      records.getByText(/^2 matching coverage records/),
    ).toBeVisible();
    await measure(page, 'coverageTimeline', async () => {
      await records
        .getByRole('button', { name: 'Timeline for patient-002' })
        .first()
        .click();
      await expect(
        page.getByRole('list', { name: 'Chronological coverage alternative' }),
      ).toBeVisible();
    });
    await context.close();
  }
  const report = {
    measuredAt: new Date().toISOString(),
    browser: browser.version(),
    mode: 'Vite development, MSW, unthrottled, fresh context per trial; UI timings include Playwright dispatch/assertion overhead and mock latency',
    trials: 5,
    timings: Object.fromEntries(
      Object.entries(samples).map(([name, values]) => [
        name,
        { samplesMs: values, medianMs: [...values].sort((a, b) => a - b)[2] },
      ]),
    ),
  };
  await mkdir('docs/measurements', { recursive: true });
  await writeFile(
    `docs/measurements/browser-${process.env.AUDIT_PHASE ?? 'current'}.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
});
