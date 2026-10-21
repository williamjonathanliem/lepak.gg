import type { ComponentType } from 'react';
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router';
import { ROUTED_APPS } from '../apps/registry';
import Hub from '../pages/Hub';
import Landing from '../pages/Landing';
import NotFound from '../pages/NotFound';
import { CrashPage } from './CrashPage';
import { RouteLoading } from './RouteLoading';

// Each live app is lazy-loaded from its manifest, so the landing page stays small.
// Everything inside an app gets the calmer style (see .calm in styles/index.css).
const appRoutes: RouteObject[] = ROUTED_APPS.map((app) => ({
  path: `${app.route}/*`, // apps own their sub-routes, e.g. /katabomb/r/KJRW
  lazy: async () => calm((await app.load()).default),
  HydrateFallback: RouteLoading,
}));

/** Wraps a page in the calm style without adding a layout box (display: contents). */
function calm(Page: ComponentType): { Component: ComponentType } {
  return {
    Component: () => (
      <div className="calm contents">
        <Page />
      </div>
    ),
  };
}

// Every route shows CrashPage (and reports the error) if it throws while drawing.
export const router = createBrowserRouter(
  withCrashPage([
    { path: '/', element: <Landing /> },
    { path: '/hub', element: <Hub /> },
    {
      path: '/privacy',
      lazy: async () => calm((await import('../pages/Legal')).Privacy),
      HydrateFallback: RouteLoading,
    },
    {
      path: '/terms',
      lazy: async () => calm((await import('../pages/Legal')).Terms),
      HydrateFallback: RouteLoading,
    },
    // Published Lepak Pages: short links like /n/bio-chapter-3
    {
      path: '/n/:slug/*',
      lazy: async () => calm((await import('../apps/notes/view')).default),
      HydrateFallback: RouteLoading,
    },
    // Old names, so shared links keep working.
    { path: '/wordl/*', element: <Navigate to="/letterlock" replace /> },
    { path: '/connections/*', element: <Navigate to="/groupthink" replace /> },
    ...appRoutes,
    { path: '*', element: <NotFound /> },
  ]),
);

function withCrashPage(routes: RouteObject[]): RouteObject[] {
  return routes.map((r) => ({ ...r, errorElement: <CrashPage /> }));
}
