export const incomeFrequencies = [
  'weekly',
  'biweekly',
  'monthly',
  'annually',
] as const;
export type IncomeFrequency = (typeof incomeFrequencies)[number];
// Locale and currency are fixed for this application; reuse the formatter,
// including in engine explanations, rather than constructing it per rule/row.
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
const annualMultipliers: Record<IncomeFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  annually: 1,
};
function assertCents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError('Money must be non-negative safe integer cents.');
}
export function annualizeIncome(
  amount: number,
  frequency: IncomeFrequency,
): number {
  assertCents(amount);
  const result = amount * annualMultipliers[frequency];
  assertCents(result);
  return result;
}
export function calculateHouseholdAnnualIncome(
  sources: ReadonlyArray<{ amount: number; frequency: IncomeFrequency }>,
): number {
  const total = sources.reduce((sum, source) => {
    const next = sum + annualizeIncome(source.amount, source.frequency);
    assertCents(next);
    return next;
  }, 0);
  return total;
}
export function formatCurrency(cents: number): string {
  assertCents(cents);
  // Format whole dollars as bigint, then insert exact cents without float division.
  return usdFormatter
    .formatToParts(BigInt(cents) / 100n)
    .map((part) =>
      part.type === 'fraction'
        ? String(BigInt(cents) % 100n).padStart(2, '0')
        : part.value,
    )
    .join('');
}
