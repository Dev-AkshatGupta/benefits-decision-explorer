import { test, expect } from '@playwright/test';
test('screen, inspect exact values, navigate history, and mark changed inputs outdated', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/eligibility?date=2026-06-15');
  await page.getByLabel('Search by patient name').fill('Avery Alden');
  const choice = page.getByRole('button', {
    name: 'Avery Alden, patient-001, CO',
  });
  await expect(choice).toBeEnabled();
  await page.getByLabel('Search by patient name').focus();
  await page.keyboard.press('ArrowDown');
  await expect(choice).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Run screening' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run screening' }).click();
  const trigger = page.getByRole('button', {
    name: 'Inspect Decision for Demo Health Coverage (Fictional)',
  });
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: 'Demo Health Coverage (Fictional)',
  });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/programId=demo-health/);
  const age = dialog.locator('details').filter({
    has: page.locator('summary').filter({ hasText: 'Maximum patient age' }),
  });
  await age.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(age).toHaveAttribute('open', '');
  await expect(age.locator('dd').filter({ hasText: /^91$/ })).toBeVisible();
  await expect(age.locator('dd').filter({ hasText: /^64$/ })).toBeVisible();
  await expect(
    age.getByRole('figure', { name: 'Numeric rule comparison' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('decision-inspector.png'),
  });
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page).not.toHaveURL(/programId=/);
  await page.goBack();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Close decision inspector' })
    .click();
  await page.getByLabel('Evaluation date').fill('2026-06-16');
  await expect(
    page.getByText('Outdated results.', { exact: false }),
  ).toBeVisible();
  await trigger.click();
  await expect(
    dialog.getByText('Outdated results', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Rerun screening' }).click();
  await expect(
    dialog.getByText('Outdated results', { exact: true }),
  ).not.toBeVisible();
  await expect(dialog.locator('time')).toHaveText('2026-06-16');
  await page.reload();
  await expect(
    page.getByText(/No matching decision is available/),
  ).toBeVisible();
  await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
});
test('correct missing income information and preserve the original trace until rerun', async ({
  page,
}) => {
  await page.goto('/eligibility?patientId=patient-001&date=2026-06-15');
  await expect(
    page.getByRole('button', { name: 'Run screening' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run screening' }).click();
  await page
    .getByRole('button', {
      name: 'Inspect Decision for Demo Nutrition Assistance (Fictional)',
    })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Demo Nutrition Assistance (Fictional)',
  });
  await expect(
    dialog.getByRole('heading', { name: 'Missing information' }),
  ).toBeVisible();
  await dialog
    .getByRole('link', { name: 'Update Patient Information' })
    .click();
  await page.getByRole('button', { name: 'Edit household income' }).click();
  await page
    .getByLabel(/I confirm this demonstration income report is complete/)
    .check();
  await page.getByRole('button', { name: 'Save household income' }).click();
  await expect(page.getByText('Household income saved.')).toBeVisible();
  await page.getByRole('link', { name: '← Back to screening' }).click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('Outdated results', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'Missing information' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Rerun screening' }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Rerun screening' }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Missing information' }),
  ).not.toBeVisible();
  await expect(
    dialog.getByText('Derived annual total: $1,500.00'),
  ).toBeVisible();
});
test('decision sheet and screening controls fit narrow, tablet and desktop viewports', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'This test explicitly checks all viewport widths.',
  );
  await page.goto('/eligibility?patientId=patient-002&date=2026-06-15');
  await expect(
    page.getByRole('button', { name: 'Run screening' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run screening' }).click();
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);
    await page
      .getByRole('button', {
        name: 'Inspect Decision for Demo Health Coverage (Fictional)',
      })
      .click();
    const dialog = page.getByRole('dialog');
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await expect(
      dialog.getByRole('button', { name: 'Close decision inspector' }),
    ).toBeInViewport();
    if (width === 320)
      await page.screenshot({
        path: testInfo.outputPath('decision-inspector-320.png'),
      });
    await dialog
      .getByRole('button', { name: 'Close decision inspector' })
      .click();
  }
});
