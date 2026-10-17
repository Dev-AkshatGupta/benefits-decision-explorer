import { expect, test } from '@playwright/test';

test('Pages build serves the app and mocked data under the repository path', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Start with a patient or workflow',
    }),
  ).toBeVisible();

  await page.goto('./patients/patient-001');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Avery Alden' }),
  ).toBeVisible();
  await expect(page.getByText('patient-001')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Avery Alden' }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});
