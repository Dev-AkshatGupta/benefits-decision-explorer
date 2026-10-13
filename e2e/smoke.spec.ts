import { test, expect } from '@playwright/test';
test('browser MSW patient data endpoints validate and retain updates', async ({
  page,
}) => {
  await page.goto('/patients');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Patients' }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const list = await fetch('/api/patients?pageSize=5&status=active').then(
      (response) => response.json(),
    );
    const coordinators = await fetch('/api/coordinators').then((response) =>
      response.json(),
    );
    const patch = await fetch('/api/patients/patient-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Browser' }),
    });
    const patient = await patch.json();
    const household = await fetch('/api/patients/patient-001/household').then(
      (response) => response.json(),
    );
    const invalid = await fetch('/api/patients?page=0');
    const missing = await fetch('/api/patients/unknown');
    return {
      list,
      coordinators,
      patient,
      household,
      patchStatus: patch.status,
      invalidStatus: invalid.status,
      missingStatus: missing.status,
    };
  });
  expect(result.list.data).toHaveLength(5);
  expect(result.list.pagination.totalItems).toBe(50);
  expect(result.list.data[0]).not.toHaveProperty('email');
  expect(result.coordinators).toHaveLength(5);
  expect(result.patchStatus).toBe(200);
  expect(result.patient.firstName).toBe('Browser');
  expect(result.household.members[0].firstName).toBe('Browser');
  expect(result.invalidStatus).toBe(400);
  expect(result.missingStatus).toBe(404);
});
const pages = [
  ['Dashboard', '/dashboard'],
  ['Patients', '/patients'],
  ['Eligibility Screening', '/eligibility'],
  ['Policies', '/policies'],
  ['Care Tasks', '/tasks'],
  ['Coverage Timeline', '/coverage'],
  ['Settings', '/settings'],
] as const;
test('responsive shell navigates without reloads or console errors', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.navigationMarker = 'preserved';
  });
  const mobile = testInfo.project.name === 'mobile-chromium';
  if (!mobile) {
    const toggle = page.getByRole('button', { name: 'Collapse sidebar' });
    await toggle.click();
    await expect(
      page.getByRole('button', { name: 'Expand sidebar' }),
    ).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#desktop-sidebar')).toHaveCSS('width', '80px');
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.locator('#desktop-sidebar')).toHaveCSS('width', '256px');
  }
  for (const [title, path] of pages) {
    if (mobile)
      await page.getByRole('button', { name: 'Open navigation' }).click();
    const nav = mobile
      ? page
          .getByRole('dialog')
          .getByRole('navigation', { name: 'Main navigation' })
      : page.getByRole('navigation', { name: 'Main navigation' });
    await nav
      .getByRole('link', {
        name: title,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(path + '$'));
    await expect(
      page.getByRole('heading', {
        level: 1,
        name:
          path === '/policies'
            ? 'Policy Comparison & Impact Analysis'
            : path === '/tasks'
              ? 'Care Coordination Tasks'
              : path === '/coverage'
                ? 'Coverage & Renewals'
                : title,
      }),
    ).toBeVisible();
    if (mobile) {
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: 'Open navigation' }).click();
    }
    await expect(
      (mobile
        ? page.getByRole('dialog')
        : page.locator('#desktop-sidebar')
      ).getByRole('link', {
        name: title,
        exact: true,
      }),
    ).toHaveAttribute('aria-current', 'page');
    if (mobile) await page.keyboard.press('Escape');
    expect(
      await page.evaluate(
        () => document.documentElement.dataset.navigationMarker,
      ),
    ).toBe('preserved');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  if (mobile) {
    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await trigger.click();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(
        await page
          .getByRole('dialog')
          .evaluate((dialog) => dialog.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('button', { name: 'Close navigation' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect(
    await page.evaluate(async () => (await fetch('/api/health')).json()),
  ).toEqual({ status: 'ok' });
  await page.screenshot({
    path: testInfo.outputPath('shell.png'),
    fullPage: true,
  });
  await page.goto('/missing');
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Return to Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(errors).toEqual([]);
});
test('tablet defaults to collapsed and mobile drawer closes on resizing', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Viewport resize covered in desktop project',
  );
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/patients');
  await expect(
    page.getByRole('button', { name: 'Expand sidebar' }),
  ).toBeVisible();
  await expect(page.locator('#desktop-sidebar')).toHaveCSS('width', '80px');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Expand sidebar' }),
  ).toBeFocused();
});
