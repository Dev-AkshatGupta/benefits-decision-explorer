import { test, expect } from '@playwright/test';
test('create, assign, complete and review a patient task on desktop/mobile', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/tasks');
  await expect(
    page.getByRole('heading', { name: 'Care Coordination Tasks', level: 1 }),
  ).toBeVisible();
  const metrics = page.getByLabel('Task overview');
  await expect(metrics).toContainText('Open tasks150');
  await expect(metrics).toContainText('Completed tasks50');
  await page.getByRole('button', { name: 'Create Task', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Create task' });
  await editor
    .getByLabel('Task title', { exact: false })
    .fill('Verify synthetic household documents');
  await editor.getByLabel('Search by patient name').fill('Avery Alden');
  const choice = editor.getByRole('button', {
    name: 'Avery Alden, patient-001, CO',
  });
  await expect(choice).toBeEnabled();
  await choice.click();
  await expect(editor).toBeVisible();
  await editor
    .getByLabel('Assigned coordinator', { exact: false })
    .selectOption('coordinator-001');
  await editor.getByLabel('Priority', { exact: false }).selectOption('urgent');
  await editor.getByLabel('Due date', { exact: false }).fill('2026-10-08');
  await editor.getByRole('button', { name: 'Save task' }).click();
  const detail = page.getByRole('dialog', { name: 'Task details' });
  await expect(
    detail.getByRole('heading', {
      name: 'Verify synthetic household documents',
    }),
  ).toBeVisible();
  await detail.getByRole('button', { name: 'Close task details' }).click();
  await expect(metrics).toContainText('Open tasks151');
  await page
    .getByLabel('Search tasks')
    .fill('Verify synthetic household documents');
  await page
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('todo');
  await expect(page.getByText(/^1 matching tasks · Page/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('tasks-workspace.png') });
  await page
    .getByRole('button', { name: /^Open task / })
    .first()
    .click();
  await detail
    .getByRole('button', { name: 'Complete task', exact: true })
    .click();
  await detail
    .getByLabel('Completion note (optional)')
    .fill('Reviewed fictional documentation.');
  await detail.getByRole('button', { name: 'Confirm status change' }).click();
  await expect(
    detail.getByRole('heading', { name: 'Completion information' }),
  ).toBeVisible();
  await expect(
    detail.getByText('Reviewed fictional documentation.'),
  ).toBeVisible();
  await detail.getByRole('button', { name: 'Close task details' }).click();
  await expect(metrics).toContainText('Completed tasks51');
  await page
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('completed');
  await expect(page.getByText(/^1 matching tasks · Page/)).toBeVisible();
  await page
    .getByRole('button', { name: /^Open task / })
    .first()
    .click();
  await detail.getByRole('link', { name: /^View patient:/ }).click();
  const patientTasks = page.getByRole('region', {
    name: 'Patient care coordination tasks',
  });
  await expect(
    patientTasks.getByText('Verify synthetic household documents', {
      exact: true,
    }),
  ).toBeVisible();
  await patientTasks
    .getByRole('button', { name: 'Create Task for This Patient' })
    .click();
  await editor
    .getByLabel('Task title', { exact: false })
    .fill('Unsaved profile task');
  await page.keyboard.press('Escape');
  await page
    .getByRole('dialog', { name: 'Discard unsaved changes?' })
    .getByRole('button', { name: 'Discard changes' })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('review and save a missing-information follow-up linked to the captured screening context', async ({
  page,
}) => {
  await page.goto('/eligibility?patientId=patient-012&date=2026-06-15');
  await expect(
    page.getByRole('button', { name: 'Run screening' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run screening' }).click();
  await page
    .getByRole('button', { name: /^Create Follow-up Task for/ })
    .first()
    .click();
  const editor = page.getByRole('dialog', { name: 'Create task' });
  await expect(editor.getByLabel('Task type', { exact: false })).toHaveValue(
    'eligibility_follow_up',
  );
  await expect(editor.getByText(/Patient: patient-012/)).toBeVisible();
  await expect(editor.getByText(/Evaluation date 2026-06-15/)).toBeVisible();
  await editor.getByRole('button', { name: 'Save task' }).click();
  await page.getByRole('link', { name: 'View follow-up task' }).click();
  const detail = page.getByRole('dialog', { name: 'Task details' });
  await expect(
    detail.getByRole('heading', { name: 'Source reference' }),
  ).toBeVisible();
  await expect(detail.getByText('patient-012', { exact: true })).toBeVisible();
  await expect(
    detail.getByRole('link', { name: 'Open screening context' }),
  ).toHaveAttribute('href', /patientId=patient-012.*date=2026-06-15/);
  await detail
    .getByRole('button', { name: 'Complete task', exact: true })
    .click();
  await detail.getByRole('button', { name: 'Confirm status change' }).click();
  await expect(
    detail.getByRole('heading', { name: 'Completion information' }),
  ).toBeVisible();
  await detail.getByRole('button', { name: 'Reopen task' }).click();
  await detail.getByRole('button', { name: 'Confirm status change' }).click();
  await expect(
    detail.getByRole('heading', { name: 'Completion information' }),
  ).toHaveCount(0);
  await detail.getByRole('button', { name: 'Close task details' }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
