import { lazy, Suspense } from 'react';
import { PageContainer } from '@/components/common/page-container';
const PoliciesPage = lazy(() =>
  import('@/features/policies/pages/policies-page').then((module) => ({
    default: module.PoliciesPage,
  })),
);
export function PoliciesRoute() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <p role="status">Loading policy comparison…</p>
        </PageContainer>
      }
    >
      <PoliciesPage />
    </Suspense>
  );
}
