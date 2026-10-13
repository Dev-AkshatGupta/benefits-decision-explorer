import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { DecisionInspector } from './decision-inspector';
import { RuleComparison } from './rule-comparison';
import { createScreeningSnapshot } from '../ui/screening-snapshot';
import { evaluateRule } from '../engine/evaluate-rule';
import { screenPatient } from '../engine/screen-patient';
import { eligibilityRuleSchema } from '../domain/schemas';
import { context, numberRule, testProgram } from '../tests/helpers';
import { createSyntheticPatientData } from '../../../mocks/data/patients';
describe('structured comparisons and inspector strategy', () => {
  it.each([
    {
      field: 'state',
      fieldType: 'string',
      operator: 'in',
      expectedValue: ['AZ', 'CO'],
    },
    {
      field: 'hasQualifyingChild',
      fieldType: 'boolean',
      operator: 'equals',
      expectedValue: true,
    },
    {
      field: 'evaluationDate',
      fieldType: 'date',
      operator: 'greater_than',
      expectedValue: '2026-01-01',
    },
    {
      field: 'incomeSourceTypes',
      fieldType: 'string_array',
      operator: 'in',
      expectedValue: ['employment'],
    },
    {
      field: 'incomeSourceTypes',
      fieldType: 'string_array',
      operator: 'not_in',
      expectedValue: ['pension'],
    },
  ])('uses structured data for $field, without numeric charts', (patch) => {
    const rule = eligibilityRuleSchema.parse({ ...numberRule, ...patch });
    const result = evaluateRule(rule, context);
    render(<RuleComparison rule={rule} result={result} />);
    expect(screen.getByText('Actual evaluated value')).toBeVisible();
    expect(screen.getByText('Configured policy value')).toBeVisible();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    if (patch.field === 'incomeSourceTypes')
      expect(screen.getByText(/Has (any|no) overlap with/)).toBeVisible();
  });
  it.each([0, Number.MAX_SAFE_INTEGER])(
    'shows exact cents and finite markers for %s',
    (actual) => {
      const rule = {
        ...numberRule,
        field: 'annualHouseholdIncomeCents' as const,
        expectedValue: 0,
      };
      render(
        <RuleComparison
          rule={rule}
          result={evaluateRule(rule, {
            ...context,
            annualHouseholdIncomeCents: actual,
          })}
        />,
      );
      expect(
        screen.getByRole('figure', { name: 'Numeric rule comparison' }),
      ).toBeVisible();
      screen
        .getAllByText(actual === 0 ? '$0.00' : '$90,071,992,547,409.91', {
          selector: 'dd',
        })
        .forEach((value) => expect(value).toBeVisible());
      expect(
        document.querySelector('circle')?.getAttribute('cx'),
      ).not.toContain('NaN');
    },
  );
  it('explains ANY with passing and unknown rules, including actual flow and policy metadata', async () => {
    const user = userEvent.setup(),
      data = createSyntheticPatientData(),
      patient = data.patients[0]!,
      household = data.households[0]!;
    const program = {
      ...testProgram(
        [
          numberRule,
          {
            ...numberRule,
            id: 'unknown',
            name: 'Residency requirement',
            field: 'state' as const,
            fieldType: 'string' as const,
            operator: 'equals' as const,
            expectedValue: 'CO',
          },
        ],
        'ANY',
      ),
      effectiveTo: '2026-12-31',
    };
    const evaluated = { ...context, patientId: patient.id, state: null };
    const results = screenPatient([program], evaluated),
      result = results[0]!;
    const snapshot = createScreeningSnapshot(
      patient,
      household,
      evaluated,
      [program],
      results,
    );
    render(
      <MemoryRouter>
        <DecisionInspector
          snapshot={snapshot}
          program={program}
          result={result}
          outdated={false}
          onClose={vi.fn()}
          onRerun={vi.fn()}
          busy={false}
          canRerun
          profilePath={'/patients/' + patient.id}
          returnSearch={'patientId=' + patient.id}
        />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('ANY: At least one required rule must pass.'),
    ).toBeVisible();
    expect(
      within(dialog).getByText(/do not override the passing rule/),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('list', { name: 'Decision flow' }),
    ).toHaveTextContent('Apply ANY strategy');
    expect(
      within(dialog).getByRole('list', { name: 'Decision flow' }),
    ).toHaveTextContent('Final demonstration outcome: Eligible');
    expect(within(dialog).getByText(/2026-12-31/)).toBeVisible();
    await user.click(
      within(dialog).getByText('Patient age requirement', {
        selector: 'summary span',
      }),
    );
    expect(
      within(dialog).getByText('30', { selector: 'details[open] dd' }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('link', { name: 'Update Patient Information' }),
    ).toHaveAttribute('href', '/patients/' + patient.id);
  });
});
