import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/app/layouts/app-layout';
import { PlaceholderPage } from '@/components/common/placeholder-page';
import { navigation } from './navigation';
import { NotFoundPage } from './not-found-page';
import { RouteErrorPage } from './route-error-page';
import { PatientWorklistRoute } from './patient-routes';
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'patients', Component: PatientWorklistRoute },
      ...navigation
        .filter((page) => !(['/patients'] as string[]).includes(page.path))
        .map((page) => ({
          path: page.path.slice(1),
          element: <PlaceholderPage page={page} />,
        })),
      { path: '*', Component: NotFoundPage },
    ],
  },
];
