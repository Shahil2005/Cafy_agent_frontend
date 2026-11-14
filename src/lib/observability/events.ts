export const ProductEvents = {
  AUTH_SIGNED_IN: 'auth_signed_in',
  AUTH_SIGNED_OUT: 'auth_signed_out',
  BILLING_CHECKOUT_STARTED: 'billing_checkout_started',
  BILLING_PORTAL_OPENED: 'billing_portal_opened',
  BILLING_LIMIT_HIT: 'billing_limit_hit',
  RESOURCE_DOWNLOADED: 'resource_downloaded',
  RESOURCE_VIEWED: 'resource_viewed',
  PUBLIC_EXPLORE_VIEWED: 'public_explore_viewed',
  PUBLIC_FEATURE_CLICKED: 'public_feature_clicked',
  PUBLIC_JOBS_VIEWED: 'public_jobs_viewed',
  PUBLIC_JOBS_PREFS_SUBMITTED: 'public_jobs_prefs_submitted',
  PUBLIC_JOBS_JOB_OPENED: 'public_jobs_job_opened',
  PUBLIC_JOBS_GATE_SHOWN: 'public_jobs_gate_shown',
  PUBLIC_JOBS_SIGNUP_STARTED: 'public_jobs_signup_started',
  PUBLIC_JOBS_SIGNUP_COMPLETED: 'public_jobs_signup_completed',
} as const;

export type ProductEventName = (typeof ProductEvents)[keyof typeof ProductEvents];
