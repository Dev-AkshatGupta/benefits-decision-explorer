import { z } from 'zod';
// Kept with response parsing so shell-level retry handling does not eagerly load Zod.
export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(['INVALID_REQUEST', 'NOT_FOUND', 'INVALID_JSON', 'CONFLICT']),
    message: z.string(),
    issues: z
      .array(z.strictObject({ path: z.string(), message: z.string() }))
      .optional(),
  }),
});
