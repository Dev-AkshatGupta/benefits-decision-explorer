import { test, expect } from '@playwright/test';
test('edit profile, manage income, and return to the filtered worklist', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/patients?search=Alden&status=active&state=CO');
  await expect(page.getByText('Showing 1–1 of 1 patients')).toBeVisible();
  const origin = page.url();
  await page
    .getByRole('link', { name: 'View Avery Alden', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Avery Alden' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Household Members' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit patient profile' });
  await dialog
    .getByLabel('First name', { exact: false })
    .fill('ProfileUpdated');
  await dialog
    .getByLabel('Email', { exact: false })
    .fill('updated@example.com');
  await dialog
    .getByRole('button', { name: 'Save profile', exact: true })
    .click();
  await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'ProfileUpdated Alden' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Edit Profile', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Edit household income', exact: true })
    .click();
  const section = page.getByRole('region', { name: 'Household Income' });
  await section
    .getByRole('button', { name: 'Add income source', exact: true })
    .click();
  const source = section.getByRole('group', {
    name: 'Income source 3',
    exact: true,
  });
  await source
    .getByLabel('Amount per payment (USD)', { exact: false })
    .fill('2000.00');
  await source
    .getByLabel('Payment frequency', { exact: false })
    .selectOption('monthly');
  await expect(source.getByText('$24,000.00', { exact: true })).toBeVisible();
  await expect(section.getByText('$25,500.00', { exact: true })).toBeVisible();
  await section
    .getByRole('button', { name: 'Save household income', exact: true })
    .click();
  await expect(
    page.getByText('Household income saved.', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Profile Summary' })
      .getByText('$25,500.00', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('patient-profile.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: /Back to patients/ }).click();
  await expect(page).toHaveURL(origin);
  await expect(
    page.getByRole('link', { name: 'View ProfileUpdated Alden', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('unsaved household edits require a deliberate navigation decision', async ({
  page,
}) => {
  await page.goto('/patients/patient-001');
  await expect(
    page.getByRole('region', { name: 'Household Income' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Edit household income', exact: true })
    .click();
  const section = page.getByRole('region', { name: 'Household Income' });
  await section
    .getByLabel('Amount per payment (USD)', { exact: false })
    .first()
    .fill('500.00');
  await page.getByRole('link', { name: /Back to patients/ }).click();
  const warning = page.getByRole('dialog', {
    name: 'Discard unsaved changes?',
  });
  await expect(warning).toBeVisible();
  await warning
    .getByRole('button', { name: 'Keep editing', exact: true })
    .click();
  await expect(
    section.getByLabel('Amount per payment (USD)', { exact: false }).first(),
  ).toHaveValue('500.00');
  await page.getByRole('link', { name: /Back to patients/ }).click();
  await warning
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page).toHaveURL(/[/]patients$/);
});
test('profile editor fits a narrow viewport and validates future dates', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Viewport check uses desktop browser',
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/patients/patient-001');
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit patient profile' });
  await dialog.getByLabel('Date of birth', { exact: false }).fill('2099-01-01');
  await dialog
    .getByRole('button', { name: 'Save profile', exact: true })
    .click();
  await expect(
    dialog.getByText('Date of birth cannot be in the future', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('profile-editor-320.png'),
  });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit Profile', exact: true }),
  ).toBeFocused();
});
