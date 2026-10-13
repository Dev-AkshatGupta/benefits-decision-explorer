import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  patientSchema,
  householdSchema,
} from '../src/features/patients/domain/schemas';
import { taskListSchema, taskSchema } from '../src/features/tasks/domain/tasks';
import {
  coverageSchema,
  coverageListSchema,
  eventListSchema,
} from '../src/features/coverage/domain/coverage';
async function read(page: Page, path: string): Promise<unknown> {
  return page.evaluate(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Demo read failed: ${response.status}`);
    return response.json();
  }, path);
}
async function write(
  page: Page,
  path: string,
  method: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<unknown> {
  return page.evaluate(
    async (args) => {
      const response = await fetch(args.path, {
        method: args.method,
        headers: { 'Content-Type': 'application/json', ...args.headers },
        body: JSON.stringify(args.body),
      });
      if (!response.ok)
        throw new Error(`Demo write failed: ${response.status}`);
      return response.json();
    },
    { path, method, body, headers },
  );
}
async function snapshot(page: Page) {
  return {
    patient: patientSchema.parse(await read(page, '/api/patients/patient-001')),
    household: householdSchema.parse(
      await read(page, '/api/patients/patient-001/household'),
    ),
    tasks: taskListSchema.parse(
      await read(page, '/api/tasks?today=2026-10-09&status=all&pageSize=1'),
    ).pagination.totalItems,
    coverage: coverageListSchema.parse(
      await read(page, '/api/coverage?date=2026-10-09&pageSize=1'),
    ).pagination.totalItems,
    period: coverageSchema.parse(
      await read(page, '/api/coverage/coverage-004'),
    ),
    events: eventListSchema.parse(
      await read(page, '/api/coverage/coverage-004/events'),
    ),
  };
}
test('production demo intercepts APIs, supports deep-link refreshes and serves real worker/assets', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  for (const [path, title] of [
    ['/patients/patient-011', 'Reese Alden'],
    [
      '/eligibility?patientId=patient-011&date=2026-06-15',
      'Eligibility Screening',
    ],
    [
      '/eligibility/simulator?patientId=patient-011&date=2026-06-15',
      'What-if Eligibility Simulator',
    ],
    [
      '/policies?program=demo-family&baseline=2025.1&comparison=2026.1&date=2026-06-15',
      'Policy Comparison & Impact Analysis',
    ],
    ['/tasks', 'Care Coordination Tasks'],
    ['/coverage?date=2026-10-09', 'Coverage & Renewals'],
  ]) {
    await page.goto(path!);
    await expect(
      page.getByRole('heading', { name: title!, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Reset demo data' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: title!, level: 1 }),
    ).toBeVisible();
    const health = await read(page, '/api/health');
    expect(health).toEqual({ status: 'ok' });
  }
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const response = await fetch('/mockServiceWorker.js');
    return {
      scope: registration.scope,
      script: registration.active?.scriptURL,
      contentType: response.headers.get('content-type'),
      text: await response.text(),
    };
  });
  expect(worker.script).toMatch(/\/mockServiceWorker\.js$/);
  expect(worker.scope).toBe(new URL('/', page.url()).href);
  expect(worker.contentType).toMatch(/javascript/);
  expect(worker.text).toContain('Mock Service Worker');
  expect(worker.text).not.toContain('<!doctype html>');
  const assetPaths = await page
    .locator('script[src],link[rel="stylesheet"]')
    .evaluateAll((elements) =>
      elements.map(
        (element) =>
          element.getAttribute('src') ?? element.getAttribute('href'),
      ),
    );
  expect(assetPaths.every((path) => path?.startsWith('/assets/'))).toBe(true);
  expect(errors).toEqual([]);
});
test('reset discards unsaved household drafts and captured simulations after confirmation', async ({
  page,
}) => {
  const nativeDialogs: string[] = [];
  page.on('dialog', (dialog) => {
    nativeDialogs.push(dialog.type());
    void dialog.dismiss();
  });
  await page.goto('/eligibility?patientId=patient-011&date=2026-06-15');
  await expect(
    page.getByRole('button', { name: 'Run screening' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run screening' }).click();
  await page.getByRole('link', { name: 'Explore What-if Scenarios' }).click();
  await page
    .getByLabel('Hypothetical annual income (USD)', { exact: true })
    .fill('60000');
  await page.getByRole('link', { name: 'Exit Simulation' }).click();
  await page.getByRole('link', { name: 'Review patient profile' }).click();
  await page.getByRole('button', { name: 'Edit household income' }).click();
  await page
    .getByLabel('Amount per payment (USD)', { exact: false })
    .fill('999');
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.getByRole('button', { name: 'Confirm reset' }).click();
  await expect(page).toHaveURL(/\/dashboard\?demoReset=complete$/);
  await expect(page.getByRole('status')).toContainText(
    'Demonstration data restored',
  );
  expect(nativeDialogs).toEqual([]);
  expect(
    householdSchema.parse(
      await read(page, '/api/patients/patient-011/household'),
    ).totalAnnualIncome,
  ).toBe(0);
  await page.goto(
    '/eligibility/simulator?patientId=patient-011&date=2026-06-15',
  );
  await expect(
    page.getByRole('heading', { name: 'A baseline screening is required' }),
  ).toBeVisible();
});
test('confirmed reset restores all fixture stores and leaves another tab untouched', async ({
  page,
  context,
}) => {
  await page.goto('/patients');
  await expect(page.getByText('Showing 1–20 of 150 patients')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reset demo data' }),
  ).toBeVisible();
  const baseline = await snapshot(page);
  patientSchema.parse(
    await write(page, '/api/patients/patient-001', 'PATCH', {
      firstName: 'ModifiedDemo',
    }),
  );
  const household = householdSchema.parse(
    await read(page, '/api/patients/patient-001/household'),
  );
  householdSchema.parse(
    await write(
      page,
      '/api/patients/patient-001/household',
      'PATCH',
      { incomeInformationStatus: 'complete' },
      { 'If-Match': JSON.stringify(household.updatedAt) },
    ),
  );
  taskSchema.parse(
    await write(
      page,
      '/api/tasks',
      'POST',
      {
        patientId: 'patient-001',
        title: 'Production demo reset fixture',
        type: 'general',
        priority: 'medium',
      },
      { 'Idempotency-Key': 'demo-reset-task' },
    ),
  );
  coverageSchema.parse(
    await write(
      page,
      '/api/coverage/coverage-004',
      'PATCH',
      { notes: 'Changed demonstration note' },
      { 'If-Match': JSON.stringify(baseline.period.updatedAt) },
    ),
  );
  await write(
    page,
    '/api/coverage/coverage-004/events',
    'POST',
    {
      type: 'note_added',
      eventDate: '2026-10-09',
      description: 'Changed demonstration event',
    },
    { 'Idempotency-Key': 'demo-reset-event' },
  );
  const changed = await snapshot(page);
  expect(changed.patient.firstName).toBe('ModifiedDemo');
  expect(changed.tasks).toBe(baseline.tasks + 1);
  expect(changed.events).toHaveLength(baseline.events.length + 1);
  const other = await context.newPage();
  await other.goto('/patients');
  await expect(other.getByText('Showing 1–20 of 150 patients')).toBeVisible();
  await write(other, '/api/patients/patient-001', 'PATCH', {
    firstName: 'OtherTab',
  });
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.getByRole('button', { name: 'Keep current data' }).click();
  expect(await snapshot(page)).toEqual(changed);
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  const completed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/demo/reset' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Confirm reset' }).click();
  expect((await completed).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard\?demoReset=complete$/);
  await expect(page.getByRole('status')).toContainText(
    'Demonstration data restored',
  );
  expect(await snapshot(page)).toEqual(baseline);
  expect(
    patientSchema.parse(await read(other, '/api/patients/patient-001'))
      .firstName,
  ).toBe('OtherTab');
  await other.close();
  await page.goto('/patients');
  await expect(page.getByText('Showing 1–20 of 150 patients')).toBeVisible();
});
test('production screening and policy analysis work without a backend; reset dialog is accessible', async ({
  page,
}) => {
  await page.goto('/eligibility?patientId=patient-011&date=2026-06-15');
  await expect(
    page.getByRole('button', { name: 'Run screening' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Run screening' }).click();
  await page.getByRole('link', { name: 'Explore What-if Scenarios' }).click();
  await page
    .getByLabel('Hypothetical annual income (USD)', { exact: true })
    .fill('60000');
  await expect(
    page.getByText(
      /3 changed programs · 2 unchanged programs · 5 changed rules/,
    ),
  ).toBeVisible();
  await page.goto(
    '/policies?program=demo-family&baseline=2025.1&comparison=2026.1&date=2026-06-15',
  );
  await page
    .getByRole('button', { name: 'Run Population Impact Analysis' })
    .click();
  await expect(page.getByRole('status')).toContainText(
    '150 patients evaluated: 12 changed, 138 unchanged',
  );
  const trigger = page.getByRole('button', { name: 'Reset demo data' });
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', {
    name: 'Reset demonstration data?',
  });
  await expect(dialog).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.close({ runBeforeUnload: false });
});
