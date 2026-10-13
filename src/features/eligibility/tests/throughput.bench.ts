import { bench, describe } from 'vitest';
import { createSyntheticPatientData } from '../../../mocks/data/patients';
import { buildEligibilityContext } from '../engine/context-builder';
import { screenPatient } from '../engine/screen-patient';
import { selectPoliciesForDate } from '../engine/policy-selector';
import { demoPolicyRegistry } from '../policies/registry';
const data = createSyntheticPatientData();
const evaluationDate = '2026-06-15';
const programs = selectPoliciesForDate(demoPolicyRegistry, evaluationDate);
const contexts = data.patients.map((patient, index) =>
  buildEligibilityContext(patient, data.households[index], evaluationDate),
);
describe('eligibility throughput (150 patients × 5 programs per operation)', () => {
  bench('screen normalized contexts', () => {
    for (const context of contexts) screenPatient(programs, context);
  });
  bench('normalize and screen', () => {
    data.patients.forEach((patient, index) =>
      screenPatient(
        programs,
        buildEligibilityContext(
          patient,
          data.households[index],
          evaluationDate,
        ),
      ),
    );
  });
});
