import { lazy, Suspense } from 'react';
import { PageContainer } from '@/components/common/page-container';
const TasksPage = lazy(() =>
  import('@/features/tasks/pages/tasks-page').then((module) => ({
    default: module.TasksPage,
  })),
);
export function TasksRoute() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <p role="status">Loading care tasks…</p>
        </PageContainer>
      }
    >
      <TasksPage />
    </Suspense>
  );
}
