import { test, expect } from '@playwright/test';
test('inspect a patient timeline, create a reviewed renewal task and return to coverage', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/coverage?date=2026-10-09');
  await expect(
    page.getByRole('heading', { name: 'Coverage & Renewals', level: 1 }),
  ).toBeVisible();
  await page.getByLabel('Search coverage patients').fill('Jordan Alden');
  const records = page.getByRole('region', { name: 'Coverage records' });
  await expect(records.getByText(/^2 matching coverage records/)).toBeVisible();
  await records
    .getByRole('button', { name: 'Timeline for patient-002' })
    .first()
    .click();
  const timeline = page.getByRole('region', {
    name: 'Patient coverage timeline',
  });
  await expect(
    timeline.getByRole('list', { name: 'Chronological coverage alternative' }),
  ).toBeVisible();
  await timeline
    .getByRole('button', { name: 'Open coverage coverage-004' })
    .click();
  const detail = page.getByRole('dialog', { name: 'Coverage details' });
  await expect(detail.getByText('Active', { exact: true })).toBeVisible();
  await expect(detail.getByText('2026-09-20', { exact: true })).toBeVisible();
  await detail
    .getByRole('button', { name: 'Create Renewal Follow-up Task' })
    .click();
  const editor = page.getByRole('dialog', { name: 'Create task' });
  await expect(editor.getByLabel('Task type', { exact: false })).toHaveValue(
    'coverage_renewal',
  );
  await expect(editor.getByLabel('Due date', { exact: false })).toHaveValue(
    '2026-09-20',
  );
  await editor.getByRole('button', { name: 'Save task' }).click();
  await detail.getByRole('link', { name: 'View renewal task' }).click();
  const task = page.getByRole('dialog', { name: 'Task details' });
  await expect(
    task.getByRole('link', { name: 'Open source coverage' }),
  ).toHaveAttribute('href', '/coverage?record=coverage-004');
  await task
    .getByRole('button', { name: 'Complete task', exact: true })
    .click();
  await task.getByRole('button', { name: 'Confirm status change' }).click();
  await expect(
    task.getByRole('heading', { name: 'Completion information' }),
  ).toBeVisible();
  await task.getByRole('link', { name: 'Open source coverage' }).click();
  await expect(detail.getByText('In progress', { exact: true })).toBeVisible();
  await expect(detail.getByText('2027-03-31', { exact: true })).toBeVisible();
  await detail.getByRole('link', { name: 'View Patient Profile' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Patient coverage history' })
      .getByRole('heading', { name: 'Coverage History' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('coverage-patient-history.png'),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('update renewal stages, record an event and synchronize renewal filters', async ({
  page,
}, testInfo) => {
  await page.goto(
    '/coverage?patientId=patient-002&record=coverage-004&date=2026-10-09',
  );
  const detail = page.getByRole('dialog', { name: 'Coverage details' });
  await expect(
    detail.getByRole('button', { name: 'Set renewal Submitted' }),
  ).toBeVisible();
  await detail.getByRole('button', { name: 'Set renewal Submitted' }).click();
  await expect(detail.getByText('Submitted', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Set renewal Completed' }).click();
  await expect(detail.getByText('Renewal workflow completed.')).toBeVisible();
  await detail.getByRole('button', { name: 'Add Event' }).click();
  const event = detail.getByRole('form', { name: 'Add coverage event' });
  await event
    .getByLabel('Event description')
    .fill('Synthetic renewal review complete; dates unchanged.');
  await event.getByRole('button', { name: 'Save event' }).click();
  await expect(
    detail.getByText('Synthetic renewal review complete; dates unchanged.'),
  ).toBeVisible();
  await detail.getByRole('button', { name: 'Close coverage details' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Upcoming and overdue renewals' })
      .getByText('No renewals match this worklist.'),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Renewal urgency', exact: true })
    .selectOption('completed');
  await expect(
    page
      .getByRole('region', { name: 'Upcoming and overdue renewals' })
      .getByText(/^1 matching renewals/),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('coverage-workspace.png'),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
