import { delay, http, HttpResponse } from 'msw';
import { patientHandlers } from './patients';
import { taskHandlers } from './tasks';
import { coverageHandlers } from './coverage';
import { policyPopulationHandlers } from './policy-population';
import { demoHandlers } from './demo';
export const handlers = [
  ...demoHandlers,
  ...coverageHandlers,
  ...taskHandlers,
  ...patientHandlers,
  ...policyPopulationHandlers,
  http.get('/api/health', async () => {
    await delay(150);
    return HttpResponse.json({ status: 'ok' });
  }),
];
