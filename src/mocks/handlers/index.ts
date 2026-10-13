import { delay, http, HttpResponse } from 'msw';
import { patientHandlers } from './patients';
import { policyPopulationHandlers } from './policy-population';
import { taskHandlers } from './tasks';
import { coverageHandlers } from './coverage';
export const handlers = [
  ...patientHandlers,
  ...policyPopulationHandlers,
  ...taskHandlers,
  ...coverageHandlers,
  http.get('/api/health', async () => {
    await delay(150);
    return HttpResponse.json({ status: 'ok' });
  }),
];
