import { describe, expect, it } from 'vitest';
import {
  getPatient,
  getPatientHousehold,
  getPatients,
  updatePatient,
  updateHousehold,
} from './patients-api';
import { createSyntheticPatientData } from '@/mocks/data/patients';
const id = 'patient-001';
describe('household mutation integrity', () => {
  it('preserves completeness for member edits and requires explicit confirmation after source changes', async () => {
    const original = await getPatientHousehold('patient-002');
    expect(original.incomeInformationStatus).toBe('complete');
    const memberUpdate = await updateHousehold(
      'patient-002',
      { members: original.members },
      original.updatedAt,
    );
    expect(memberUpdate.incomeInformationStatus).toBe('complete');
    const cleared = await updateHousehold(
      'patient-002',
      { incomeSources: [] },
      memberUpdate.updatedAt,
    );
    expect(cleared.totalAnnualIncome).toBe(0);
    expect(cleared.incomeInformationStatus).toBe('incomplete');
    const confirmed = await updateHousehold(
      'patient-002',
      { incomeInformationStatus: 'complete' },
      cleared.updatedAt,
    );
    expect(confirmed.incomeInformationStatus).toBe('complete');
    expect(confirmed.totalAnnualIncome).toBe(0);
    const replaced = await updateHousehold(
      'patient-002',
      {
        incomeSources: original.incomeSources,
        incomeInformationStatus: 'complete',
      },
      confirmed.updatedAt,
    );
    expect(replaced.incomeInformationStatus).toBe('complete');
    expect(() =>
      updateHousehold(
        'patient-002',
        { incomeInformationStatus: 'verified' } as never,
        replaced.updatedAt,
      ),
    ).toThrow();
    const invalidStatus = await fetch('/api/patients/patient-002/household', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': JSON.stringify(replaced.updatedAt),
      },
      body: JSON.stringify({ incomeInformationStatus: 'verified' }),
    });
    expect(invalidStatus.status).toBe(400);
    expect(await getPatientHousehold('patient-002')).toEqual(replaced);
  });
  it('clears optional profile fields without changing immutable fields', async () => {
    const original = await getPatient('patient-002');
    const result = await updatePatient(
      original.id,
      { email: null, phone: null, gender: null },
      original.updatedAt,
    );
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.gender).toBeUndefined();
    expect(result.createdAt).toBe(original.createdAt);
    expect(result.id).toBe(original.id);
  });
  it('detects stale patient and household versions without overwriting newer data', async () => {
    const original = await getPatient(id),
      household = await getPatientHousehold(id);
    await updatePatient(id, { firstName: 'Newer' }, original.updatedAt);
    await expect(
      updatePatient(id, { firstName: 'Stale' }, original.updatedAt),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    await expect(
      updateHousehold(id, { incomeSources: [] }, household.updatedAt),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect((await getPatient(id)).firstName).toBe('Newer');
  });
  it('derives totals and size and advances the linked patient/worklist timestamp', async () => {
    const household = await getPatientHousehold(id);
    const updated = await updateHousehold(
      id,
      {
        members: [
          ...household.members,
          {
            id: 'new-member',
            firstName: 'Fictional',
            lastName: 'Person',
            relationship: 'other',
            dateOfBirth: '1980-01-01',
            income: 999999900,
            employmentStatus: 'other',
          },
        ],
        incomeSources: [
          {
            id: 'monthly',
            type: 'employment',
            frequency: 'monthly',
            amount: 200000,
          },
        ],
      },
      household.updatedAt,
    );
    expect(updated.householdSize).toBe(2);
    expect(updated.totalAnnualIncome).toBe(2400000);
    expect(updated.members[1]?.income).toBe(999999900);
    expect((await getPatient(id)).updatedAt).toBe(updated.updatedAt);
    expect(
      (await getPatients({ search: 'Avery Alden' })).data[0]?.lastUpdated,
    ).toBe(updated.updatedAt);
  });
  it('rejects primary removal, identity changes, duplicate IDs, negative income, and derived fields', async () => {
    const household = await getPatientHousehold(id);
    const requests = [
      { members: [] },
      { members: [{ ...household.members[0], relationship: 'other' }] },
      { members: [{ ...household.members[0], id: 'replacement' }] },
      { members: [{ ...household.members[0], firstName: 'Tampered' }] },
      { members: [household.members[0], household.members[0]] },
      {
        incomeSources: [
          {
            id: 'source',
            type: 'employment',
            amount: -1,
            frequency: 'monthly',
          },
        ],
      },
      {
        incomeSources: [household.incomeSources[0], household.incomeSources[0]],
      },
      { householdSize: 22 },
      { totalAnnualIncome: 100 },
      { patientId: 'other' },
    ];
    for (const body of requests) {
      const response = await fetch('/api/patients/' + id + '/household', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': JSON.stringify(household.updatedAt),
        },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
      expect(await getPatientHousehold(id)).toEqual(household);
    }
  });
  it('rejects missing versions and unknown patients and permits zero sources', async () => {
    const household = await getPatientHousehold(id);
    expect(
      (
        await fetch('/api/patients/' + id + '/household', {
          method: 'PATCH',
          body: JSON.stringify({ incomeSources: [] }),
        })
      ).status,
    ).toBe(400);
    await expect(
      updateHousehold('unknown', { incomeSources: [] }, household.updatedAt),
    ).rejects.toMatchObject({ status: 404 });
    const zero = await updateHousehold(
      id,
      { incomeSources: [] },
      household.updatedAt,
    );
    expect(zero.totalAnnualIncome).toBe(0);
  });
  it('allows only one conditional concurrent save and leaves generated fixtures unchanged', async () => {
    const baseline = createSyntheticPatientData();
    const household = await getPatientHousehold(id);
    const results = await Promise.allSettled([
      updateHousehold(id, { incomeSources: [] }, household.updatedAt),
      updateHousehold(id, { incomeSources: [] }, household.updatedAt),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(createSyntheticPatientData()).toEqual(baseline);
  });
});
