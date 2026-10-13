import { delay, http, HttpResponse } from 'msw';
import { patientHandlers } from './patients';
export const handlers = [
  ...patientHandlers,
  http.get('/api/health', async () => {
    await delay(150);
    return HttpResponse.json({ status: 'ok' });
  }),
];
