import { createSyntheticPatientData } from './patients';
import { createSyntheticTasks } from './tasks';
import { createSyntheticCoverage } from './coverage';
function createDatabase() {
  const patients = createSyntheticPatientData();
  return {
    ...patients,
    ...createSyntheticCoverage(patients.patients),
    coverageRequests: new Map<string, { signature: string; id: string }>(),
    tasks: createSyntheticTasks(patients.patients, patients.coordinators),
    taskRequests: new Map<string, { signature: string; taskId: string }>(),
  };
}
export const mockDatabase = createDatabase();
// Reset data as well as handlers between tests; PATCH changes are session-local.
export function resetMockDatabase() {
  Object.assign(mockDatabase, createDatabase());
}
