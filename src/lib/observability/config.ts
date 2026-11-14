export const observabilityEnvironment = import.meta.env.MODE;

function isExplicitlyEnabled(flag: string | undefined): boolean {
  return flag === 'true' || flag === '1';
}

/** Sentry only runs in production unless VITE_SENTRY_ENABLED=true (local testing). */
export function isSentryEnabled(): boolean {
  const hasDsn = Boolean(import.meta.env.VITE_SENTRY_DSN);
  if (!hasDsn) return false;
  if (import.meta.env.PROD) return true;
  return isExplicitlyEnabled(import.meta.env.VITE_SENTRY_ENABLED);
}

/** PostHog can run in dev when a key is set (analytics only). */
export function isPostHogEnabled(): boolean {
  return Boolean(import.meta.env.VITE_POSTHOG_KEY);
}

export function getTracesSampleRate(): number {
  return import.meta.env.PROD ? 0.05 : 1;
}
