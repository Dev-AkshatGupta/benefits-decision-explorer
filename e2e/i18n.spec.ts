import { expect, test } from '@playwright/test';

test('Spanish is available throughout the shell and remains selected after reload', async ({
  page,
}) => {
  await page.goto('/dashboard');
  const mobile = (page.viewportSize()?.width ?? 1024) < 768;
  const localizedNavigation = async () => {
    if (mobile)
      await page.getByRole('button', { name: 'Abrir navegación' }).click();
    return page.getByRole('navigation', { name: 'Navegación principal' });
  };
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Start with a patient or workflow',
    }),
  ).toBeVisible();

  await page.getByRole('combobox', { name: 'Language' }).selectOption('es');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Comience con un paciente o flujo de trabajo',
    }),
  ).toBeVisible();
  await expect(
    (await localizedNavigation()).getByRole('link', { name: 'Pacientes' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue(
    'es',
  );
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Comience con un paciente o flujo de trabajo',
    }),
  ).toBeVisible();

  await (
    await localizedNavigation()
  )
    .getByRole('link', { name: 'Pacientes' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pacientes' }),
  ).toBeVisible();
});
