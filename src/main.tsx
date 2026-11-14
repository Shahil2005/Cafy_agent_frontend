import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import App from './App.tsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary.tsx';
import { initPostHog } from './lib/observability/posthog.ts';
import { initSentry } from './lib/observability/sentry.ts';
import { isPostHogEnabled } from './lib/observability/config.ts';
import { capturePromoFromUrl } from './utils/promoCodeStorage.ts';

// Persist ?promo= before React Router navigations strip the query string.
capturePromoFromUrl();

initSentry();
initPostHog();

const appTree = (
  <StrictMode>
    {isPostHogEnabled() ? (
      <PostHogProvider client={posthog}>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </PostHogProvider>
    ) : (
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    )}
  </StrictMode>
);

createRoot(document.getElementById('root')!).render(appTree);
