import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { router } from './app/router';
import { startMonitoring } from './lib/monitoring';
import { sweepStorage } from './lib/storage';
import './styles/fonts';
import './styles/index.css';

// Forget anything saved on this device that hasn't been used for 30 days.
sweepStorage();
// Crash reports, if configured (see lib/monitoring.ts).
startMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
