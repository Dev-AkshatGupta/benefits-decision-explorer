import { lazy, Suspense } from 'react';
import { PageContainer } from '@/components/common/page-container';
const CoveragePage = lazy(() =>
  import('@/features/coverage/pages/coverage-page').then((module) => ({
    default: module.CoveragePage,
  })),
);
export function CoverageRoute() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <p role="status">Loading coverage workspace…</p>
        </PageContainer>
      }
    >
      <CoveragePage />
    </Suspense>
  );
}
