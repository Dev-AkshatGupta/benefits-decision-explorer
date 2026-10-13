import { lazy, Suspense } from 'react';
import { PageContainer } from '@/components/common/page-container';
import { PatientTableSkeleton } from '@/features/patients/components/patient-table-skeleton';
const PatientsPage = lazy(() =>
  import('@/features/patients/pages/patients-page').then((module) => ({
    default: module.PatientsPage,
  })),
);
const PatientDetailPage = lazy(() =>
  import('@/features/patients/pages/patient-detail-page').then((module) => ({
    default: module.PatientDetailPage,
  })),
);
export function PatientWorklistRoute() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <PatientTableSkeleton pageSize={20} />
        </PageContainer>
      }
    >
      <PatientsPage />
    </Suspense>
  );
}
export function PatientProfileRoute() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <p role="status">Loading patient…</p>
        </PageContainer>
      }
    >
      <PatientDetailPage />
    </Suspense>
  );
}
