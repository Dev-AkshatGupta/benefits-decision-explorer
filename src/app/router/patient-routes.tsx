import { lazy, Suspense } from 'react';
import { PageContainer } from '@/components/common/page-container';
import { PatientTableSkeleton } from '@/features/patients/components/patient-table-skeleton';
const PatientsPage = lazy(() =>
  import('@/features/patients/pages/patients-page').then((module) => ({
    default: module.PatientsPage,
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
