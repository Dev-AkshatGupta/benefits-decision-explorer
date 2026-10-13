import type { Household } from '../../domain/schemas';
import { calculateAge, formatDate } from '../../domain/dates';
import { annualizeIncome, formatCurrency } from '../../domain/income';
import {
  relationshipLabels,
  employmentLabels,
  incomeTypeLabels,
  frequencyLabels,
} from '../../domain/profile-labels';
export function HouseholdMembersView({ household }: { household: Household }) {
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Household size: {household.householdSize} · The primary patient is
        managed through Edit Profile.
      </p>
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">
            Household members and reported annual income
          </caption>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-3">
                Member / Relationship
              </th>
              <th scope="col">Date of birth / Age</th>
              <th scope="col">Employment status</th>
              <th scope="col">Reported annual income</th>
            </tr>
          </thead>
          <tbody>
            {household.members.map((member) => (
              <tr key={member.id} className="border-b last:border-0">
                <td className="break-words py-4 pr-2 font-medium">
                  {member.firstName} {member.lastName}
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    {relationshipLabels[member.relationship]}
                  </p>
                </td>
                <td className="pr-2">
                  {formatDate(member.dateOfBirth)}
                  <p className="text-xs text-muted-foreground">
                    {calculateAge(member.dateOfBirth)} years
                  </p>
                </td>
                <td className="pr-2">
                  {employmentLabels[member.employmentStatus]}
                </td>
                <td className="break-words">{formatCurrency(member.income)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label="Household member cards" className="space-y-3 md:hidden">
        {household.members.map((member) => (
          <li key={member.id} className="rounded-lg border p-4 text-sm">
            <p className="break-words font-semibold">
              {member.firstName} {member.lastName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {relationshipLabels[member.relationship]}
            </p>
            <dl className="mt-3 grid gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Birth date / Age
                </dt>
                <dd>
                  {formatDate(member.dateOfBirth)} ·{' '}
                  {calculateAge(member.dateOfBirth)} years
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Employment</dt>
                <dd>{employmentLabels[member.employmentStatus]}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Reported annual income
                </dt>
                <dd>{formatCurrency(member.income)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
export function HouseholdIncomeView({ household }: { household: Household }) {
  return (
    <>
      <div className="mb-5 rounded-lg bg-accent p-4">
        <p className="text-sm text-primary">Total annual household income</p>
        <p className="mt-1 text-2xl font-semibold text-primary">
          {formatCurrency(household.totalAnnualIncome)}
        </p>
      </div>
      <p className="mb-4 text-sm leading-6 text-muted-foreground">
        The total comes from these income sources only. Member-reported income
        is shown separately and is not added again. Weekly × 52, biweekly × 26,
        monthly × 12, annually × 1.
      </p>
      {!household.incomeSources.length ? (
        <p className="rounded-lg border p-5 text-sm text-muted-foreground">
          No income sources recorded.
        </p>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Household income sources</caption>
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-3">
                    Income type
                  </th>
                  <th scope="col">Per payment</th>
                  <th scope="col">Frequency</th>
                  <th scope="col">Annualized income</th>
                </tr>
              </thead>
              <tbody>
                {household.incomeSources.map((source) => (
                  <tr key={source.id} className="border-b last:border-0">
                    <td className="break-words py-4 pr-2">
                      {incomeTypeLabels[source.type]}
                    </td>
                    <td className="break-words pr-2">
                      {formatCurrency(source.amount)}
                    </td>
                    <td className="pr-2">
                      {frequencyLabels[source.frequency]}
                    </td>
                    <td className="break-words">
                      {formatCurrency(
                        annualizeIncome(source.amount, source.frequency),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul aria-label="Income source cards" className="space-y-3 md:hidden">
            {household.incomeSources.map((source) => (
              <li key={source.id} className="rounded-lg border p-4 text-sm">
                <p className="font-semibold">{incomeTypeLabels[source.type]}</p>
                <p className="mt-2">
                  {formatCurrency(source.amount)} ·{' '}
                  {frequencyLabels[source.frequency]}
                </p>
                <p className="mt-2 text-muted-foreground">
                  Annualized:{' '}
                  {formatCurrency(
                    annualizeIncome(source.amount, source.frequency),
                  )}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
