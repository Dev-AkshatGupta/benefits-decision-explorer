import { test, expect } from '@playwright/test';
test('patient worklist journey preserves URL context on desktop and mobile', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const mobile = testInfo.project.name === 'mobile-chromium';
  const searches: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/patients' && url.searchParams.has('search'))
      searches.push(url.searchParams.get('search') ?? '');
  });
  await page.goto('/patients');
  await expect(page.getByText('Showing 1–20 of 150 patients')).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.worklistMarker = 'preserved';
  });
  await expect(
    page
      .getByRole('region', { name: 'Patient summary' })
      .getByText('150', { exact: true }),
  ).toBeVisible();
  const table = page.getByRole('table');
  const cards = page.getByRole('list', { name: 'Patient cards' });
  if (mobile) {
    await expect(table).toBeHidden();
    await expect(cards).toBeVisible();
  } else {
    await expect(table).toBeVisible();
    await expect(cards).toBeHidden();
  }
  await page.getByLabel('Patient status').selectOption('pending_review');
  await expect(page.getByText('Showing 1–20 of 50 patients')).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .click();
  await expect(page.getByText('Showing 1–20 of 150 patients')).toBeVisible();
  await page.getByRole('button', { name: 'Assigned to me' }).click();
  await expect(page.getByText('Showing 1–20 of 30 patients')).toBeVisible();
  await expect(
    page.getByLabel('Care coordinator', { exact: true }),
  ).toHaveValue('coordinator-001');
  await page.getByLabel('Patient status').selectOption('active');
  await page.getByLabel('U.S. state').selectOption('CO');
  await expect(page.getByText('Showing 1–5 of 5 patients')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search patients' }).fill('Avery');
  await expect(page).toHaveURL(/search=Avery/);
  await expect(page.getByText('Showing 1–5 of 5 patients')).toBeVisible();
  expect(searches.filter((value) => value !== 'Avery')).toHaveLength(0);
  await expect(
    page
      .getByRole('region', { name: 'Patient summary' })
      .getByText('150', { exact: true }),
  ).toBeVisible();
  const filteredUrl = page.url();
  const view = (mobile ? cards : table)
    .getByRole('link', { name: /View / })
    .first();
  await view.click();
  await expect(page).toHaveURL(/[/]patients[/]patient-[0-9]+$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /Avery / }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Back to patients/ }).click();
  await expect(page).toHaveURL(filteredUrl);
  await expect(
    page.getByRole('textbox', { name: 'Search patients' }),
  ).toHaveValue('Avery');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .click();
  await expect(page.getByText('Showing 1–20 of 150 patients')).toBeVisible();
  await page.getByLabel('Rows per page').selectOption('10');
  await expect(page.getByText('Showing 1–10 of 150 patients')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Showing 11–20 of 150 patients')).toBeVisible();
  if (mobile)
    await page.getByLabel('Sort by', { exact: true }).selectOption('fullName');
  else await table.getByRole('button', { name: /Sort by patient/ }).click();
  await expect(page.getByText('Showing 1–10 of 150 patients')).toBeVisible();
  await expect(page).toHaveURL(/sortBy=fullName&sortOrder=asc/);
  await expect(
    (mobile ? cards : table).getByRole('link', {
      name: 'Avery Alden',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Patient status').selectOption('active');
  await expect(page.getByText('Showing 1–10 of 50 patients')).toBeVisible();
  await page.getByLabel('U.S. state').selectOption('CO');
  await expect(page.getByText('Showing 1–5 of 5 patients')).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('U.S. state')).toHaveValue('');
  await expect(page.getByText('Showing 1–10 of 50 patients')).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel('U.S. state')).toHaveValue('CO');
  await expect(page.getByText('Showing 1–5 of 5 patients')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.dataset.worklistMarker),
  ).toBe('preserved');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('patient-worklist.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('empty results and invalid URLs recover safely', async ({ page }) => {
  await page.goto(
    '/patients?page=bad&pageSize=25&state=XX&status=wrong&search=NoSuchPatient',
  );
  await expect(
    page.getByRole('heading', {
      name: 'No patients match your current filters.',
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/[/]patients[?]search=NoSuchPatient$/);
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(page.getByText('Showing 1–20 of 150 patients')).toBeVisible();
  await page.goto('/patients/unknown');
  await expect(
    page.getByRole('heading', { name: 'Patient not found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Back to patients/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Patients' }),
  ).toBeVisible();
});
test('worklist stays within narrow, tablet, and desktop viewports', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Viewport sweep covered by desktop browser',
  );
  for (const width of [320, 768, 900, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/patients?pageSize=10');
    await expect(page.getByText('Showing 1–10 of 150 patients')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width >= 768) await expect(page.getByRole('table')).toBeVisible();
    else
      await expect(
        page.getByRole('list', { name: 'Patient cards' }),
      ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('worklist-' + width + '.png'),
    });
  }
});
