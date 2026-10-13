import { createSyntheticPatientData } from './patients';
import { createSyntheticTasks } from './tasks';
function createDatabase() {
  const patients = createSyntheticPatientData();
  return {
    ...patients,
    tasks: createSyntheticTasks(patients.patients, patients.coordinators),
    taskRequests: new Map<string, { signature: string; taskId: string }>(),
  };
}
export const mockDatabase = createDatabase();
export function resetMockDatabase() {
  Object.assign(mockDatabase, createDatabase());
}
