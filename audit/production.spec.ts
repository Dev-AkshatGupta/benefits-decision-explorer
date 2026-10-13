import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
test('production shell starts without MSW and fails safely when no API backend is configured', async ({
  browser,
}) => {
  const samplesMs: number[] = [];
  let expectedApi404Messages = 0;
  for (let trial = 0; trial < 5; trial++) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    const consoleErrors: Array<{ text: string; url: string }> = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error')
        consoleErrors.push({
          text: message.text(),
          url: message.location().url,
        });
    });
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
    samplesMs.push(await page.evaluate(() => performance.now()));
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
    ).toBe(0);
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Patients', exact: true })
      .click();
    const failure = page
      .getByRole('alert')
      .filter({ hasText: 'Unable to load patients' });
    await expect(failure).toBeVisible();
    await expect(
      failure.getByRole('button', { name: 'Retry', exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    const expected = consoleErrors.filter(
      (error) =>
        error.text.includes('status of 404') &&
        new URL(error.url || page.url()).pathname.startsWith('/api/'),
    );
    expect(consoleErrors).toEqual(expected);
    expectedApi404Messages += expected.length;
    await context.close();
  }
  await writeFile(
    'docs/measurements/production-final.json',
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        mode: 'Vite production preview, no MSW/backend, unthrottled, fresh contexts; API resource 404 console messages are expected and recorded separately from JavaScript errors',
        browser: browser.version(),
        samplesMs,
        medianMs: [...samplesMs].sort((a, b) => a - b)[2],
        expectedApi404Messages,
      },
      null,
      2,
    ) + '\n',
  );
});
