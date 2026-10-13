import { lazy, Suspense } from 'react';
import { PageContainer } from '@/components/common/page-container';
const EligibilityPage = lazy(() =>
  import('@/features/eligibility/pages/eligibility-page').then((module) => ({
    default: module.EligibilityPage,
  })),
);
const EligibilitySimulatorPage = lazy(() =>
  import('@/features/eligibility/simulator/pages/eligibility-simulator-page').then(
    (module) => ({ default: module.EligibilitySimulatorPage }),
  ),
);
export function EligibilitySimulatorRoute() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <p role="status">Loading simulation workspace…</p>
        </PageContainer>
      }
    >
      <EligibilitySimulatorPage />
    </Suspense>
  );
}
export function EligibilityRoute() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <p role="status">Loading eligibility screening…</p>
        </PageContainer>
      }
    >
      <EligibilityPage />
    </Suspense>
  );
}
