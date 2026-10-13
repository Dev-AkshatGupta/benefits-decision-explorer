import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/app/layouts/app-layout';
import { PlaceholderPage } from '@/components/common/placeholder-page';
import { navigation } from './navigation';
import { NotFoundPage } from './not-found-page';
import { RouteErrorPage } from './route-error-page';
import { PatientWorklistRoute, PatientProfileRoute } from './patient-routes';
import { PoliciesRoute } from './policies-route';
import { TasksRoute } from './tasks-route';
import { CoverageRoute } from './coverage-route';
import {
  EligibilityRoute,
  EligibilitySimulatorRoute,
} from './eligibility-route';
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'patients', Component: PatientWorklistRoute },
      { path: 'patients/:patientId', Component: PatientProfileRoute },
      { path: 'eligibility', Component: EligibilityRoute },
      { path: 'eligibility/simulator', Component: EligibilitySimulatorRoute },
      { path: 'policies', Component: PoliciesRoute },
      { path: 'tasks', Component: TasksRoute },
      { path: 'coverage', Component: CoverageRoute },
      ...navigation
        .filter(
          (page) =>
            page.path !== '/patients' &&
            page.path !== '/eligibility' &&
            page.path !== '/policies' &&
            page.path !== '/tasks' &&
            page.path !== '/coverage',
        )
        .map((page) => ({
          path: page.path.slice(1),
          element: <PlaceholderPage page={page} />,
        })),
      { path: '*', Component: NotFoundPage },
    ],
  },
];
