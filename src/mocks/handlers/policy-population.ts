import { http, HttpResponse } from 'msw';
import { capturePolicyPopulation } from '../data/policy-population';
export const policyPopulationHandlers = [
  http.get('/api/policy-population', () =>
    HttpResponse.json(capturePolicyPopulation()),
  ),
  http.get('/api/policy-population/version', () => {
    const snapshot = capturePolicyPopulation();
    return HttpResponse.json({
      snapshotId: snapshot.snapshotId,
      count: snapshot.records.length,
    });
  }),
];
