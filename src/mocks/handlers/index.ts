import { delay, http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/health', async () => {
    await delay(150);
    return HttpResponse.json({ status: 'ok' });
  }),
];
