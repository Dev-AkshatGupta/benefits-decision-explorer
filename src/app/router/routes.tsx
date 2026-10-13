import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/app/layouts/app-layout';
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page';
import { DemoAboutPage } from '@/features/about/pages/demo-about-page';
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
      { path: 'dashboard', Component: DashboardPage },
      { path: 'about', Component: DemoAboutPage },
      { path: 'settings', element: <Navigate to="/about" replace /> },
      { path: 'patients', Component: PatientWorklistRoute },
      { path: 'patients/:patientId', Component: PatientProfileRoute },
      { path: 'eligibility', Component: EligibilityRoute },
      { path: 'eligibility/simulator', Component: EligibilitySimulatorRoute },
      { path: 'policies', Component: PoliciesRoute },
      { path: 'tasks', Component: TasksRoute },
      { path: 'coverage', Component: CoverageRoute },
      { path: '*', Component: NotFoundPage },
    ],
  },
];
