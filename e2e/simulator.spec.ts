import { test, expect } from '@playwright/test';
test('simulate income, inspect rule changes, reset and verify saved income is untouched', async ({
  page,
}, testInfo) => {
  const errors: string[] = [],
    writes: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (request.method() === 'PATCH') writes.push(request.url());
  });
  await page.goto('/patients/patient-011');
  await expect(
    page.getByRole('heading', { name: 'Reese Alden', level: 1 }),
  ).toBeVisible();
  const saved = page.getByRole('region', { name: 'Household Income' });
  await expect(saved.getByText('$0.00').first()).toBeVisible();
  await page.goto('/eligibility?patientId=patient-011&date=2026-06-15');
  await expect(
    page.getByRole('button', { name: 'Run screening' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run screening' }).click();
  await page.getByRole('link', { name: 'Explore What-if Scenarios' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'What-if Eligibility Simulator',
      level: 1,
    }),
  ).toBeVisible();
  await page
    .getByLabel('Hypothetical annual income (USD)', { exact: true })
    .fill('60000.00');
  await expect(
    page.getByText(
      /3 changed programs · 2 unchanged programs · 5 changed rules/,
    ),
  ).toBeVisible();
  const card = page.getByRole('article', {
    name: 'Demo Health Coverage (Fictional)',
  });
  await expect(
    card.getByText('Status changed: Eligible → Ineligible'),
  ).toBeVisible();
  await card.locator('summary').focus();
  await page.keyboard.press('Enter');
  const rule = card.getByRole('region', {
    name: 'Household income requirement',
  });
  await expect(
    rule.locator('dd').filter({ hasText: '$60,000.00' }),
  ).toBeVisible();
  await expect(
    rule.locator('dd').filter({ hasText: '$35,000.00' }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('simulator.png') });
  await page.getByRole('button', { name: 'Reset All Changes' }).click();
  await expect(
    page.getByText(
      /0 changed programs · 5 unchanged programs · 0 changed rules/,
    ),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Exit Simulation' }).click();
  await page.getByRole('link', { name: 'Review patient profile' }).click();
  await expect(saved.getByText('$0.00').first()).toBeVisible();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
test('simulator direct links require an explicit baseline and fit narrow viewports', async ({
  page,
}, testInfo) => {
  await page.goto(
    '/eligibility/simulator?patientId=patient-011&date=2026-06-15',
  );
  await expect(
    page.getByRole('heading', { name: 'A baseline screening is required' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Run a baseline screening' }).click();
  await expect(
    page.getByRole('button', { name: 'Run screening' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run screening' }).click();
  await page.getByRole('link', { name: 'Explore What-if Scenarios' }).click();
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 320, height: 850 });
  await page
    .getByLabel('Hypothetical annual income (USD)', { exact: true })
    .fill('-');
  await expect(page.getByText(/Simulation paused/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset All Changes' }).click();
  expect(
    await page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('simulator-narrow.png') });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'A baseline screening is required' }),
  ).toBeVisible();
});
