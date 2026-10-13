import { test, expect, type Locator } from '@playwright/test';
async function selectWithKeyboard(select: Locator, value: string) {
  await expect(select).toBeVisible();
  const index = await select
    .locator('option')
    .evaluateAll(
      (options, wanted) =>
        options.findIndex(
          (option) => (option as HTMLOptionElement).value === wanted,
        ),
      value,
    );
  expect(index).toBeGreaterThanOrEqual(0);
  await select.press('Home');
  for (let i = 0; i < index; i++) await select.press('ArrowDown');
  await select.press('Tab');
  await expect(select).toHaveValue(value);
}
test('keyboard journey: navigation, patient search, household, screening, decision and simulation', async ({
  page,
}, info) => {
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', {
      name: 'Start with a patient or workflow',
      level: 1,
    }),
  ).toBeVisible();
  if (info.project.name === 'mobile-chromium')
    await page.getByRole('button', { name: 'Open navigation' }).press('Enter');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Patients', exact: true })
    .press('Enter');
  await page
    .getByLabel('Search patients', { exact: true })
    .pressSequentially('Reese Alden');
  await expect(page.getByText('Showing 1–1 of 1 patients')).toBeVisible();
  await page.getByRole('link', { name: 'View Reese Alden' }).press('Enter');
  await expect(
    page
      .getByRole('region', { name: 'Household Income' })
      .getByText('$0.00')
      .first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Edit household income' })
    .press('Enter');
  await page
    .getByRole('checkbox', {
      name: /I confirm this demonstration income report is complete/,
    })
    .press('Space');
  await page
    .getByRole('button', { name: 'Save household income' })
    .press('Enter');
  await expect(page.getByText('Household income saved.')).toBeVisible();
  await page.goto('/eligibility?date=2026-06-15');
  const search = page.getByLabel('Search by patient name');
  await search.pressSequentially('Reese Alden');
  const choice = page.getByRole('button', {
    name: 'Reese Alden, patient-011, CO',
  });
  await expect(choice).toBeEnabled();
  await search.press('ArrowDown');
  await expect(choice).toBeFocused();
  await choice.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Run screening' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run screening' }).press('Enter');
  const trigger = page.getByRole('button', {
    name: 'Inspect Decision for Demo Health Coverage (Fictional)',
  });
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', {
    name: 'Demo Health Coverage (Fictional)',
  });
  await expect(dialog).toBeVisible();
  await dialog.locator('summary').first().press('Enter');
  await expect(dialog.locator('details').first()).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page
    .getByRole('link', { name: 'Explore What-if Scenarios' })
    .press('Enter');
  await page
    .getByLabel('Hypothetical annual income (USD)', { exact: true })
    .pressSequentially('60000');
  await expect(
    page.getByText(
      /3 changed programs · 2 unchanged programs · 5 changed rules/,
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset All Changes' }).press('Enter');
  await expect(
    page.getByText(
      /0 changed programs · 5 unchanged programs · 0 changed rules/,
    ),
  ).toBeVisible();
});
test('keyboard journey: native policy selectors, matrix and impact inspector', async ({
  page,
}) => {
  await page.goto('/policies?date=2026-06-15');
  await selectWithKeyboard(page.getByLabel('Benefit program'), 'demo-family');
  await selectWithKeyboard(
    page.getByLabel('Baseline policy version'),
    '2025.1',
  );
  await selectWithKeyboard(
    page.getByLabel('Comparison policy version'),
    '2026.1',
  );
  await page
    .getByRole('button', { name: 'Run Population Impact Analysis' })
    .press('Enter');
  await expect(page.getByRole('status')).toContainText(
    '150 patients evaluated',
  );
  await page
    .getByRole('button', { name: /Ineligible to Eligible:/ })
    .press('Space');
  await expect(page.getByLabel('Transition filter')).toHaveValue(
    'ineligible->eligible',
  );
  const trigger = page
    .getByRole('button', { name: /^Inspect patient-/ })
    .first();
  await trigger.press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'Patient policy impact' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
test('keyboard journey: create, assign and complete a linked task', async ({
  page,
}) => {
  await page.goto('/tasks');
  await page
    .getByRole('button', { name: 'Create Task', exact: true })
    .press('Enter');
  const editor = page.getByRole('dialog', { name: 'Create task' });
  await editor
    .getByLabel('Task title', { exact: false })
    .pressSequentially('Keyboard synthetic follow-up');
  const search = editor.getByLabel('Search by patient name');
  await search.pressSequentially('Avery Alden');
  await expect(
    editor.getByRole('button', { name: 'Avery Alden, patient-001, CO' }),
  ).toBeEnabled();
  await search.press('ArrowDown');
  await page.keyboard.press('Enter');
  await selectWithKeyboard(
    editor.getByLabel('Assigned coordinator', { exact: false }),
    'coordinator-001',
  );
  await editor.getByRole('button', { name: 'Save task' }).press('Enter');
  const detail = page.getByRole('dialog', { name: 'Task details' });
  await expect(
    detail.getByRole('link', { name: /View patient:/ }),
  ).toHaveAttribute('href', '/patients/patient-001');
  await detail
    .getByRole('button', { name: 'Start task', exact: true })
    .press('Enter');
  await detail
    .getByRole('button', { name: 'Confirm status change' })
    .press('Enter');
  await expect(detail.getByText('In progress', { exact: true })).toBeVisible();
  await detail
    .getByRole('button', { name: 'Complete task', exact: true })
    .press('Enter');
  await detail
    .getByRole('button', { name: 'Confirm status change' })
    .press('Enter');
  await expect(
    detail.getByRole('heading', { name: 'Completion information' }),
  ).toBeVisible();
});
test('keyboard journey: SVG timeline focus restores and renewal follow-up can be saved', async ({
  page,
}) => {
  await page.goto('/coverage?date=2026-10-09&search=Jordan+Alden');
  const records = page.getByRole('region', { name: 'Coverage records' });
  await expect(records.getByText(/^2 matching coverage records/)).toBeVisible();
  await records
    .getByRole('button', { name: 'Timeline for patient-002' })
    .first()
    .press('Enter');
  const timeline = page.getByRole('region', {
    name: 'Patient coverage timeline',
  });
  const trigger = timeline.getByRole('button', { name: /^Select period 2:/ });
  await trigger.press('Enter');
  const detail = page.getByRole('dialog', { name: 'Coverage details' });
  await expect(detail.getByText('2026-09-20', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.press('Space');
  await expect(detail).toBeVisible();
  await expect(
    detail.getByRole('button', { name: 'Create Renewal Follow-up Task' }),
  ).toBeEnabled();
  await detail
    .getByRole('button', { name: 'Create Renewal Follow-up Task' })
    .press('Enter');
  const editor = page.getByRole('dialog', { name: 'Create task' });
  await expect(editor.getByLabel('Due date', { exact: false })).toHaveValue(
    '2026-09-20',
  );
  await editor.getByRole('button', { name: 'Save task' }).press('Enter');
  await expect(
    detail.getByRole('link', { name: 'View renewal task' }),
  ).toBeVisible();
});
