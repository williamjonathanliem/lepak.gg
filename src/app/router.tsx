import { createBrowserRouter, type RouteObject } from 'react-router';
import { ROUTED_APPS } from '../apps/registry';
import Hub from '../pages/Hub';
import Landing from '../pages/Landing';
import NotFound from '../pages/NotFound';
import { RouteLoading } from './RouteLoading';

// Each live app is lazy-loaded from its manifest, so the landing page stays small.
const appRoutes: RouteObject[] = ROUTED_APPS.map((app) => ({
  path: `${app.route}/*`, // apps own their sub-routes, e.g. /katabomb/r/KJRW
  lazy: async () => ({ Component: (await app.load()).default }),
  HydrateFallback: RouteLoading,
}));

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/hub', element: <Hub /> },
  // Published Lepak Pages: short links like /n/bio-chapter-3
  {
    path: '/n/:slug/*',
    lazy: async () => ({ Component: (await import('../apps/notes/view')).default }),
    HydrateFallback: RouteLoading,
  },
  ...appRoutes,
  { path: '*', element: <NotFound /> },
]);
