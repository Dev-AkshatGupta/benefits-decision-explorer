import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
for (const width of [320, 375, 768, 1024, 1440]) {
  test(`WCAG automation and responsive audit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const findings: Array<{
      name: string;
      layout: Record<
        'documentOverflow' | 'mainOverflow' | 'dialogOverflow',
        boolean
      >;
      violations: Array<{
        id: string;
        impact?: string | null | undefined;
        description: string;
        nodes: Array<{ target: unknown; summary?: string | undefined }>;
      }>;
      incomplete: string[];
    }> = [];
    async function audit(name: string) {
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const layout = await page.evaluate(() => ({
        documentOverflow: document.documentElement.scrollWidth > innerWidth,
        mainOverflow: (() => {
          const main = document.getElementById('main-content');
          return main ? main.scrollWidth > main.clientWidth : false;
        })(),
        dialogOverflow: [...document.querySelectorAll('[role="dialog"]')].some(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      }));
      findings.push({
        name,
        layout,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        incomplete: result.incomplete.map((v) => v.id),
      });
    }
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Start with a patient or workflow',
      }),
    ).toBeVisible();
    await audit('dashboard');
    if (width < 768) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await audit('navigation drawer');
      await page.keyboard.press('Escape');
    }
    await page.goto('/patients');
    await expect(page.getByText('Showing 1–20 of 150 patients')).toBeVisible();
    await audit('patient worklist');
    await page.goto('/patients/patient-011');
    await expect(
      page
        .getByRole('region', { name: 'Household Income' })
        .getByText('$0.00')
        .first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Edit household income' }).click();
    await audit('household editor');
    await page.goto('/eligibility?patientId=patient-011&date=2026-06-15');
    await expect(
      page.getByRole('button', { name: 'Run screening' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Run screening' }).click();
    await audit('screening results');
    await page
      .getByRole('button', {
        name: 'Inspect Decision for Demo Health Coverage (Fictional)',
      })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').locator('summary').first().press('Enter');
    await audit('decision inspector');
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Explore What-if Scenarios' }).click();
    await page
      .getByLabel('Hypothetical annual income (USD)', { exact: true })
      .fill('60000');
    await expect(page.getByText(/3 changed programs/)).toBeVisible();
    await audit('simulator');
    await page.goto(
      '/policies?program=demo-family&baseline=2025.1&comparison=2026.1&date=2026-06-15',
    );
    await page
      .getByRole('button', { name: 'Run Population Impact Analysis' })
      .click();
    await expect(page.getByRole('status')).toContainText(
      '150 patients evaluated',
    );
    await audit('policy matrix');
    await page
      .getByRole('button', { name: /^Inspect patient-/ })
      .first()
      .click();
    await audit('patient impact inspector');
    await page.keyboard.press('Escape');
    await page.goto('/tasks');
    await expect(page.getByLabel('Task overview')).toContainText(
      'Open tasks150',
    );
    await audit('task worklist');
    await page
      .getByRole('button', { name: 'Create Task', exact: true })
      .click();
    await audit('task editor');
    await page
      .getByRole('dialog', { name: 'Create task' })
      .getByRole('button', { name: 'Save task' })
      .click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await audit('task validation errors');
    await page.keyboard.press('Escape');
    await page.goto('/coverage?date=2026-10-09&search=Jordan+Alden');
    const records = page.getByRole('region', { name: 'Coverage records' });
    await expect(
      records.getByText(/^2 matching coverage records/),
    ).toBeVisible();
    await audit('coverage worklist');
    await records
      .getByRole('button', { name: 'Timeline for patient-002' })
      .first()
      .click();
    await expect(
      page.getByRole('list', { name: 'Chronological coverage alternative' }),
    ).toBeVisible();
    await audit('coverage timeline');
    await page
      .getByRole('list', { name: 'Chronological coverage alternative' })
      .getByRole('button', { name: 'Open coverage coverage-004' })
      .click();
    const detail = page.getByRole('dialog', { name: 'Coverage details' });
    await expect(detail.getByText('Active', { exact: true })).toBeVisible();
    await audit('coverage details');
    await detail
      .getByRole('button', { name: 'Create Renewal Follow-up Task' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Create task' }),
    ).toBeVisible();
    await audit('renewal task editor');
    await page.keyboard.press('Escape');
    await detail.getByRole('button', { name: 'Add Event' }).click();
    await detail.getByRole('button', { name: 'Save event' }).click();
    await expect(detail.getByRole('alert')).toBeVisible();
    await audit('event validation errors');
    await detail
      .getByLabel('Event description')
      .fill('Synthetic unsaved review');
    await detail.getByRole('link', { name: 'View Patient Profile' }).click();
    const confirmation = page.getByRole('dialog', {
      name: 'Discard unsaved changes?',
    });
    await expect(confirmation).toBeVisible();
    await audit('unsaved event confirmation');
    await confirmation.getByRole('button', { name: 'Discard changes' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Jordan Alden' }),
    ).toBeVisible();
    await page.goto('/coverage');
    await page
      .getByRole('button', { name: 'Create Coverage', exact: true })
      .click();
    await audit('coverage editor');
    await mkdir('docs/measurements', { recursive: true });
    await writeFile(
      `docs/measurements/accessibility-${process.env.AUDIT_PHASE ?? 'current'}-${width}.json`,
      JSON.stringify({ width, findings }, null, 2) + '\n',
    );
    if (process.env.AUDIT_PHASE !== 'baseline') {
      expect(
        findings.flatMap((f) =>
          f.violations.map((v) => ({ name: f.name, ...v })),
        ),
      ).toEqual([]);
      expect(
        findings.filter((f) => Object.values(f.layout).some(Boolean)),
      ).toEqual([]);
    }
    // Leave the editor explicitly: an open beforeunload listener can delay
    // Chrome's context teardown even when the draft is pristine.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.close({ runBeforeUnload: false });
  });
}
