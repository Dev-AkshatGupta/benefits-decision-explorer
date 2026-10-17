import { createBrowserRouter } from 'react-router';
import { appRoutes } from './routes';
export const router = createBrowserRouter(appRoutes, {
  basename: import.meta.env.BASE_URL,
});
