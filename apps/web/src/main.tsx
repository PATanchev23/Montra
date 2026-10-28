import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { restoreSession } from './api/session';
import { Providers } from './app/Providers';
import { router } from './app/router';

// The access token lives in memory only, so every page load starts by
// exchanging the refresh cookie for a new one.
restoreSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
