import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/app/layouts/app-layout';
import { PlaceholderPage } from '@/components/common/placeholder-page';
import { navigation } from './navigation';
import { NotFoundPage } from './not-found-page';
import { RouteErrorPage } from './route-error-page';
import { PatientWorklistRoute, PatientProfileRoute } from './patient-routes';
import {
  EligibilityRoute,
  EligibilitySimulatorRoute,
} from './eligibility-route';
import { PoliciesRoute } from './policies-route';
import { TasksRoute } from './tasks-route';
import { CoverageRoute } from './coverage-route';
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
            !(
              [
                '/patients',
                '/eligibility',
                '/eligibility/simulator',
                '/policies',
                '/tasks',
                '/coverage',
              ] as string[]
            ).includes(page.path),
        )
        .map((page) => ({
          path: page.path.slice(1),
          element: <PlaceholderPage page={page} />,
        })),
      { path: '*', Component: NotFoundPage },
    ],
  },
];
