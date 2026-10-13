import { test, expect } from '@playwright/test';
test('compare fictional policy versions, analyze all patients, inspect, and reverse', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/policies');
  await expect(
    page.getByRole('heading', {
      name: 'Policy Comparison & Impact Analysis',
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Run Population Impact Analysis' }),
  ).toBeDisabled();
  await page.getByLabel('Benefit program').selectOption('demo-family');
  await page.getByLabel('Baseline policy version').selectOption('2025.1');
  await page.getByLabel('Comparison policy version').selectOption('2026.1');
  await page.getByLabel('Population evaluation date').fill('2026-06-15');
  await expect(
    page.getByText(/Configured value increased by \$5,000/),
  ).toBeVisible();
  await expect(page.getByText(/Configured value decreased by 1/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Run Population Impact Analysis' })
    .click();
  await expect(page.getByRole('status')).toContainText(
    '150 patients evaluated',
  );
  const matrix = page.getByRole('region', {
    name: 'Eligibility transition matrix',
  });
  await expect(matrix.getByRole('table')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('policy-impact.png') });
  await matrix.getByRole('button', { name: /Ineligible to Eligible:/ }).click();
  await expect(page.getByLabel('Transition filter')).toHaveValue(
    'ineligible->eligible',
  );
  const first = page.getByRole('button', { name: /^Inspect patient-/ }).first();
  await first.click();
  const inspector = page.getByRole('dialog', { name: 'Patient policy impact' });
  await expect(
    inspector.getByRole('heading', { name: 'Baseline 2025.1', exact: true }),
  ).toBeVisible();
  await expect(
    inspector.getByRole('heading', { name: 'Comparison 2026.1', exact: true }),
  ).toBeVisible();
  await expect(
    inspector.getByText('Household size · At least (≥) · 3', { exact: true }),
  ).toBeVisible();
  await expect(
    inspector.getByText('Household size · At least (≥) · 2', { exact: true }),
  ).toBeVisible();
  await expect(
    inspector.getByRole('link', { name: 'View patient profile' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(inspector).toHaveCount(0);
  await expect(page.getByLabel('Transition filter')).toHaveValue(
    'ineligible->eligible',
  );
  await page.getByRole('button', { name: 'Swap Versions' }).click();
  await expect(page.getByRole('alert')).toContainText('Analysis outdated');
  await expect(page.getByLabel('Baseline policy version')).toHaveValue(
    '2026.1',
  );
  await page
    .getByRole('button', { name: 'Run Population Impact Analysis' })
    .click();
  await expect(
    page.getByText(/Baseline 2026.1 → Comparison 2025.1/),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await matrix.getByRole('button', { name: /Eligible to Ineligible:/ }).click();
  await expect(page.getByLabel('Transition filter')).toHaveValue(
    'eligible->ineligible',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('policy population pagination and keyboard inspection on a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(
    '/policies?program=demo-family&baseline=2025.1&comparison=2026.1&date=2026-06-15',
  );
  await page
    .getByRole('button', { name: 'Run Population Impact Analysis' })
    .click();
  await page.getByLabel('Transition filter').selectOption('all');
  await expect(
    page.getByText('150 matching patients · Page 1 of 15'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next impact page' }).click();
  await expect(
    page.getByText('150 matching patients · Page 2 of 15'),
  ).toBeVisible();
  const inspect = page
    .getByRole('button', { name: /^Inspect patient-/ })
    .first();
  await inspect.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Patient policy impact' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(inspect).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
