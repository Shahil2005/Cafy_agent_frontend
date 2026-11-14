import posthog from 'posthog-js';
import { isPostHogEnabled } from './config';
import type { ProductEventName } from './events';

let initialized = false;

export function initPostHog(): void {
  if (initialized || !isPostHogEnabled()) return;

  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: {
      dom_event_allowlist: ['click', 'submit'],
      element_allowlist: ['a', 'button', 'form', 'input', 'select', 'textarea', 'label'],
    },
  });

  initialized = true;
}

export function getPostHogClient() {
  return isPostHogEnabled() ? posthog : null;
}

export function identifyAnalyticsUser(user: {
  id: string;
  email?: string | null;
  name?: string | null;
}): void {
  if (!isPostHogEnabled()) return;
  posthog.identify(user.id, {
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    app: 'product-site',
  });
}

export function resetAnalyticsUser(): void {
  if (!isPostHogEnabled()) return;
  posthog.reset();
}

export function capturePageview(path?: string): void {
  if (!isPostHogEnabled()) return;
  posthog.capture('$pageview', path ? { $current_url: path } : undefined);
}

export function captureProductEvent(
  event: ProductEventName,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  if (!isPostHogEnabled()) return;
  posthog.capture(event, {
    app: 'product-site',
    ...properties,
  });
}
