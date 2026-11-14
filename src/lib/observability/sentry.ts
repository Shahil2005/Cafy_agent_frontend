import * as Sentry from '@sentry/react';
import { getTracesSampleRate, isSentryEnabled } from './config';

let initialized = false;

export function initSentry(): void {
  if (initialized || !isSentryEnabled()) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: getTracesSampleRate(),
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1,
    environment: import.meta.env.MODE,
    beforeBreadcrumb(breadcrumb, hint) {
      const target: unknown = hint?.event?.target;
      if (typeof Element !== 'undefined' && target instanceof Element && target.closest('[data-google-grounded]')) return null;
      return breadcrumb;
    },
  });

  initialized = true;
}

export function setSentryUser(user: { id: string }): void {
  if (!isSentryEnabled()) return;
  Sentry.setUser({ id: user.id });
}

export function clearSentryUser(): void {
  if (!isSentryEnabled()) return;
  Sentry.setUser(null);
}

export function captureClientError(error: unknown, context?: Record<string, unknown>): string | undefined {
  if (!isSentryEnabled()) return undefined;
  return Sentry.captureException(error, context ? { extra: context } : undefined);
}
