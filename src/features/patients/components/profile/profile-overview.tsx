import type { Patient, Household } from '../../domain/schemas';
import { calculateAge, formatDate, formatTimestamp } from '../../domain/dates';
import { formatCurrency } from '../../domain/income';
import { genderLabels } from '../../domain/profile-labels';
import { PatientStatusBadge } from '../patient-status-badge';
import { ProfileSection, InfoItem } from './profile-section';
export function PersonalInformation({ patient }: { patient: Patient }) {
  return (
    <ProfileSection title="Personal Information">
      <dl className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="First name">{patient.firstName}</InfoItem>
        <InfoItem label="Last name">{patient.lastName}</InfoItem>
        <InfoItem label="Date of birth">
          {formatDate(patient.dateOfBirth)}
        </InfoItem>
        <InfoItem label="Age">
          {calculateAge(patient.dateOfBirth)} years
        </InfoItem>
        <InfoItem label="Gender">
          {patient.gender ? genderLabels[patient.gender] : 'Not provided'}
        </InfoItem>
        <InfoItem label="Record created">
          {formatDate(patient.createdAt)}
        </InfoItem>
      </dl>
    </ProfileSection>
  );
}
export function ContactInformation({ patient }: { patient: Patient }) {
  return (
    <ProfileSection title="Contact & Address">
      <dl className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="Email">{patient.email ?? 'Not provided'}</InfoItem>
        <InfoItem label="Phone number">
          {patient.phone ?? 'Not provided'}
        </InfoItem>
        <InfoItem label="Street address">{patient.address.street}</InfoItem>
        <InfoItem label="City">{patient.address.city}</InfoItem>
        <InfoItem label="State">{patient.address.state}</InfoItem>
        <InfoItem label="Postal code">{patient.address.postalCode}</InfoItem>
        <InfoItem label="Country">United States</InfoItem>
      </dl>
    </ProfileSection>
  );
}
export function ProfileSummary({
  patient,
  household,
  coordinator,
}: {
  patient: Patient;
  household: Household | undefined;
  coordinator: string;
}) {
  return (
    <ProfileSection title="Profile Summary">
      <p className="mb-4 text-xs text-muted-foreground">
        Saved information. Totals update after a successful save.
      </p>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem label="Household size">
          {household?.householdSize ?? 'Not available'}
        </InfoItem>
        <InfoItem label="Annual household income">
          {household
            ? formatCurrency(household.totalAnnualIncome)
            : 'Not available'}
        </InfoItem>
        <InfoItem label="Income sources">
          {household?.incomeSources.length ?? 'Not available'}
        </InfoItem>
        <InfoItem label="State of residence">{patient.address.state}</InfoItem>
        <InfoItem label="Assigned coordinator">{coordinator}</InfoItem>
        <InfoItem label="Patient status">
          <PatientStatusBadge status={patient.status} />
        </InfoItem>
        <InfoItem label="Last updated">
          {formatTimestamp(patient.updatedAt)}
        </InfoItem>
      </dl>
    </ProfileSection>
  );
}
