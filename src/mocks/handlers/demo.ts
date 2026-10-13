import { http, HttpResponse } from 'msw';
import {
  demoResetRequestSchema,
  demoResetResponseSchema,
} from '@/app/demo/demo-api';
import { mockDatabase, resetMockDatabase } from '../data/database';
export const demoHandlers = [
  http.post('/api/demo/reset', async ({ request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return HttpResponse.json(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Provide a confirmed reset request.',
          },
        },
        { status: 400 },
      );
    }
    if (!demoResetRequestSchema.safeParse(body).success)
      return HttpResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Explicit reset confirmation is required.',
          },
        },
        { status: 400 },
      );
    resetMockDatabase();
    return HttpResponse.json(
      demoResetResponseSchema.parse({
        status: 'reset',
        counts: {
          patients: mockDatabase.patients.length,
          households: mockDatabase.households.length,
          coordinators: mockDatabase.coordinators.length,
          tasks: mockDatabase.tasks.length,
          coverage: mockDatabase.coverage.length,
          coverageEvents: mockDatabase.coverageEvents.length,
        },
      }),
    );
  }),
];
