import {
  householdInputSchema,
  patientInputSchema,
} from '@/features/eligibility/engine/context-builder';
import {
  populationFingerprint,
  type PopulationResponse,
  type PopulationRecord,
} from '@/features/policies/domain/population';
import { mockDatabase } from './database';
/** Capture the complete session database synchronously, with only eligibility-relevant source fields. */
export function capturePolicyPopulation(): PopulationResponse {
  const households = new Map(
    mockDatabase.households.map((household) => [household.id, household]),
  );
  const records: PopulationRecord[] = mockDatabase.patients.map(
    (patient, index) => {
      const person = patientInputSchema.safeParse(patient),
        household = households.get(patient.householdId);
      const home = household ? householdInputSchema.safeParse(household) : null;
      const recordKey = 'record-' + String(index + 1).padStart(4, '0');
      const patientName =
        typeof patient.firstName === 'string' &&
        typeof patient.lastName === 'string'
          ? patient.firstName + ' ' + patient.lastName
          : recordKey;
      if (!person.success || (home && !home.success))
        return {
          kind: 'error',
          recordKey,
          patientName,
          patientId: typeof patient.id === 'string' ? patient.id : null,
          message:
            'Malformed eligibility source record; no patient values included in this error.',
        };
      return {
        kind: 'record',
        recordKey,
        patientName,
        patient: person.data,
        household: home?.data ?? null,
      };
    },
  );
  // Include versions so even non-eligibility profile updates conservatively invalidate freshness.
  const versions = mockDatabase.patients.map((patient) => [
    patient.id,
    patient.updatedAt,
  ]);
  const householdVersions = mockDatabase.households.map((household) => [
    household.id,
    household.updatedAt,
  ]);
  return {
    snapshotId: populationFingerprint({ records, versions, householdVersions }),
    records,
  };
}
