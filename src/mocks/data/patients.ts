import {
  patientSchema,
  householdSchema,
  coordinatorSchema,
  type Patient,
  type Household,
  type CareCoordinator,
  type IncomeSource,
  type HouseholdMember,
} from '@/features/patients/domain/schemas';
import { calculateHouseholdAnnualIncome } from '@/features/patients/domain/income';
// Fixed fixture generation, no random values or current timestamps.
const firstNames = [
  'Avery',
  'Jordan',
  'Riley',
  'Casey',
  'Taylor',
  'Quinn',
  'Rowan',
  'Emerson',
  'Harper',
  'Sage',
  'Reese',
  'Finley',
  'Dakota',
  'Cameron',
  'Parker',
];
const lastNames = [
  'Alden',
  'Bennett',
  'Calloway',
  'Dawson',
  'Ellis',
  'Fletcher',
  'Grayson',
  'Hollis',
  'Ingram',
  'Keaton',
];
const locations = [
  ['CO', 'Denver', '80201'],
  ['AZ', 'Phoenix', '85001'],
  ['OR', 'Portland', '97201'],
  ['CA', 'Sacramento', '95814'],
  ['TX', 'Austin', '78701'],
  ['NY', 'Albany', '12207'],
  ['NC', 'Raleigh', '27601'],
  ['FL', 'Tallahassee', '32301'],
  ['IL', 'Springfield', '62701'],
  ['WA', 'Olympia', '98501'],
] as const;
const sourceTypes = [
  'employment',
  'self_employment',
  'unemployment',
  'disability',
  'pension',
  'other',
] as const;
const frequencies = ['weekly', 'biweekly', 'monthly', 'annually'] as const;
const timestamp = '2026-01-15T12:00:00.000Z';
const code = (index: number) => String(index + 1).padStart(3, '0');
function pick<T>(values: readonly T[], index: number): T {
  const value = values[index % values.length];
  if (value === undefined) throw new Error('Fixture collection is empty');
  return value;
}
export function createSyntheticPatientData(): {
  patients: Patient[];
  households: Household[];
  coordinators: CareCoordinator[];
} {
  const coordinators = [
    'Morgan Chen',
    'Alex Rivera',
    'Jamie Brooks',
    'Sam Patel',
    'Robin Hayes',
  ].map((fullName, index) => {
    const [firstName, lastName] = fullName.split(' ');
    return coordinatorSchema.parse({
      id: 'coordinator-' + code(index),
      firstName,
      lastName,
      email: 'coordinator' + (index + 1) + '@example.org',
      role: index === 0 ? 'lead_coordinator' : 'care_coordinator',
    });
  });
  const patients: Patient[] = [];
  const households: Household[] = [];
  for (let index = 0; index < 150; index++) {
    const key = code(index);
    const [state, city, postalCode] = pick(locations, index);
    const patient = patientSchema.parse({
      id: 'patient-' + key,
      firstName: pick(firstNames, index),
      lastName: pick(lastNames, Math.floor(index / firstNames.length)),
      dateOfBirth:
        1935 +
        ((index * 7) % 76) +
        '-' +
        String(1 + (index % 12)).padStart(2, '0') +
        '-' +
        String(1 + (index % 28)).padStart(2, '0'),
      ...(index % 4 ? { gender: index % 2 ? 'female' : 'male' } : {}),
      ...(index % 3 ? { email: 'patient' + key + '@example.com' } : {}),
      ...(index % 5
        ? {
            phone: '+1-202-555-' + String(100 + (index % 100)).padStart(4, '0'),
          }
        : {}),
      address: {
        street: 100 + index + ' Example Avenue',
        city,
        state,
        postalCode,
        country: 'US',
      },
      householdId: 'household-' + key,
      assignedCoordinatorId: pick(coordinators, index).id,
      status: pick(['active', 'pending_review', 'inactive'] as const, index),
      createdAt: timestamp,
      updatedAt:
        '2026-02-' +
        String(1 + (index % 28)).padStart(2, '0') +
        'T12:00:00.000Z',
    });
    const sources: IncomeSource[] = [
      {
        id: 'income-' + key + '-1',
        type: pick(sourceTypes, index),
        frequency: pick(frequencies, Math.floor(index / sourceTypes.length)),
        amount: index % 10 === 0 ? 0 : 20000 + (index % 30) * 7500,
      },
    ];
    if (index % 3 === 0)
      sources.push({
        id: 'income-' + key + '-2',
        type: 'other',
        frequency: 'monthly',
        amount: 12500,
      });
    const totalAnnualIncome = calculateHouseholdAnnualIncome(sources);
    const members: HouseholdMember[] = [
      {
        id: 'member-' + key + '-1',
        firstName: patient.firstName,
        lastName: patient.lastName,
        relationship: 'self',
        dateOfBirth: patient.dateOfBirth,
        income: totalAnnualIncome,
        employmentStatus: pick(
          [
            'employed',
            'self_employed',
            'unemployed',
            'retired',
            'student',
            'unable_to_work',
          ] as const,
          index,
        ),
      },
    ];
    for (let memberIndex = 1; memberIndex <= index % 5; memberIndex++) {
      const minor = patient.dateOfBirth >= '2008-01-01';
      members.push({
        id: 'member-' + key + '-' + (memberIndex + 1),
        firstName: pick(firstNames, index + memberIndex + 2),
        lastName: patient.lastName,
        relationship: minor ? 'parent' : memberIndex === 1 ? 'spouse' : 'child',
        dateOfBirth: minor
          ? '1975-06-15'
          : memberIndex === 1
            ? patient.dateOfBirth
            : '2015-08-20',
        income: 0,
        employmentStatus: 'unemployed',
      });
    }
    households.push(
      householdSchema.parse({
        id: patient.householdId,
        patientId: patient.id,
        members,
        incomeSources: sources,
        incomeInformationStatus: index % 11 === 0 ? 'incomplete' : 'complete',
        householdSize: members.length,
        totalAnnualIncome,
        updatedAt: patient.updatedAt,
      }),
    );
    patients.push(patient);
  }
  return { patients, households, coordinators };
}
