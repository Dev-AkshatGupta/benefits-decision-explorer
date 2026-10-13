import { z } from 'zod';
import { requestJson } from '@/lib/api/client';
export const demoResetRequestSchema = z.strictObject({
  confirmReset: z.literal(true),
});
export const demoResetResponseSchema = z.strictObject({
  status: z.literal('reset'),
  counts: z.strictObject({
    patients: z.number().int().nonnegative(),
    households: z.number().int().nonnegative(),
    coordinators: z.number().int().nonnegative(),
    tasks: z.number().int().nonnegative(),
    coverage: z.number().int().nonnegative(),
    coverageEvents: z.number().int().nonnegative(),
  }),
});
export function resetDemoData() {
  return requestJson('/api/demo/reset', demoResetResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ confirmReset: true }),
  });
}
