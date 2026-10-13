import { createSyntheticPatientData } from './patients';

function createDatabase() {
  const patients = createSyntheticPatientData();
  return { ...patients };
}
export const mockDatabase = createDatabase();
export function resetMockDatabase() {
  Object.assign(mockDatabase, createDatabase());
}
