import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';
import { redirectToStripeHostedUrl } from '../utils/stripeRedirect';
import { captureProductEvent } from '../lib/observability/posthog';
import { ProductEvents } from '../lib/observability/events';

export type ChosenPlan =
  | 'free'
  | 'part_time_weekly'
  | 'weekly'
  | 'jobs_monthly'
  | 'monthly'
  | 'quarterly';
export type ProductTier = 'free' | 'part_time' | 'jobs_only' | 'full';

export interface PlanSelectionState {
  completed: boolean;
  chosenPlan?: ChosenPlan | null;
  completedAt?: string | null;
}

export interface ResumeToolMeterStatus {
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface ResumeToolStatus {
  tier: string;
  bucket: string;
  periodEnd: string | null;
  ai: ResumeToolMeterStatus;
  import: ResumeToolMeterStatus;
  pdfDownload: ResumeToolMeterStatus;
}

export interface ExtensionUsageStatus {
  allowed: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  isPremium: boolean;
}

export interface BillingStatus {
  plan: 'free' | 'part_time' | 'jobs_premium' | 'premium';
  status: string;
  /** Full Premium — backward compatible */
  isPremium: boolean;
  isFullPremium: boolean;
  isJobsPremium: boolean;
  /** Full UK part-time jobs access */
  isPartTimePremium: boolean;
  productTier: ProductTier;
  provider: string;
  billingInterval?: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Active subscription's Stripe price (grandfathered or current). */
  subscriptionPriceDisplay?: string | null;
  subscriptionPricePeriod?: string | null;
  commUsed: number;
  commLimit: number;
  commRemaining: number | null;
  extCoverLetterUsed?: number;
  extCoverLetterLimit?: number;
  extCoverLetterRemaining?: number | null;
  extAnalysisUsed?: number;
  extAnalysisLimit?: number | null;
  extAnalysisRemaining?: number | null;
  /**
   * Extension autofill: used / limit / left. Free (and Jobs / Part-time): for the account's lifetime;
   * Full Premium: today (UK), with the day it starts again. Missing from an older backend.
   */
  autofillUsed?: number;
  autofillLimit?: number | null;
  autofillRemaining?: number | null;
  autofillPeriod?: 'lifetime' | 'day';
  autofillResetsOn?: string | null;
  /** Every autofill on the account, any plan */
  autofillTotal?: number;
  /**
   * Career Path analysis usage — "lifetime" for free/Jobs Premium, "daily" for Full Premium,
   * "unlimited" for allowlisted emails (limit/remaining are null in that case).
   */
  careerAnalysisTier?: 'lifetime' | 'daily' | 'unlimited';
  careerAnalysisUsed?: number;
  careerAnalysisLimit?: number | null;
  careerAnalysisRemaining?: number | null;
  careerAnalysisResetAt?: string | null;
  resumeTool?: ResumeToolStatus;
  source: string;
  planSelection?: PlanSelectionState;
}

export class WeeklyUpgradeError extends Error {
  code: string;
  hostedInvoiceUrl: string | null;

  constructor(code: string, message: string, hostedInvoiceUrl?: string | null) {
    super(message);
    this.name = 'WeeklyUpgradeError';
    this.code = code;
    this.hostedInvoiceUrl = hostedInvoiceUrl ?? null;
  }
}

export interface WeeklyUpgradePreview {
  targetPlan: 'weekly' | 'monthly' | 'quarterly' | 'jobs_monthly';
  targetPriceId: string;
  targetAmountGBP: number;
  targetAmountDisplay: string;
  targetPeriod: string;
  promoCode: string | null;
  promotionCodeId: string | null;
  promoDuration: 'once' | 'repeating' | 'forever' | null;
  promoDurationInMonths: number | null;
  discountAppliedGBP: number;
  discountAppliedDisplay: string | null;
  creditGBP: number;
  creditDisplay: string;
  amountDueGBP: number;
  amountDueDisplay: string;
  recurringAmountGBP: number;
  recurringAmountDisplay: string;
  usedDays: number;
  remainingDays: number;
  weeklyDaysTotal: number;
  sourcePlan?: string;
}

let billingStatusInflight: Promise<BillingStatus | null> | null = null;
let billingStatusCache: { data: BillingStatus | null; at: number } | null = null;
/** Client-side dedupe window. Server /api/billing/status now reads users/{uid} once per request. */
const BILLING_STATUS_CACHE_MS = 15_000;

/** Synchronous read of the in-memory billing cache (e.g. for instant subscription UI). */
export function getCachedBillingStatus(): BillingStatus | null {
  if (
    billingStatusCache &&
    Date.now() - billingStatusCache.at < BILLING_STATUS_CACHE_MS
  ) {
    return billingStatusCache.data;
  }
  return null;
}

export function clearBillingStatusCache(): void {
  billingStatusCache = null;
}

/** Push billing into the in-memory cache (e.g. after upgrade API returns). */
export function primeBillingStatusCache(status: BillingStatus): BillingStatus {
  const normalized = normalizeBillingStatus(status);
  billingStatusCache = { data: normalized, at: Date.now() };
  return normalized;
}

let planSelectionInflight: Promise<PlanSelectionResponse | null> | null = null;

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function normalizeBillingStatus(data: BillingStatus): BillingStatus {
  // Trust server entitlement flags. Do not re-grant from plan alone — past_due
  // keeps plan labels but paid access must stay false.
  const statusActive = data.status === 'active';
  const isFullPremium =
    data.isFullPremium === true ||
    (statusActive && data.isPremium === true && data.plan === 'premium');
  const isJobsPremium =
    data.isJobsPremium === true ||
    isFullPremium ||
    (statusActive &&
      (data.plan === 'jobs_premium' || data.productTier === 'jobs_only'));
  const isPartTimePremium =
    data.isPartTimePremium === true ||
    isJobsPremium ||
    (statusActive &&
      (data.plan === 'part_time' || data.productTier === 'part_time'));
  const productTier: ProductTier =
    data.productTier ??
    (isFullPremium
      ? 'full'
      : isJobsPremium && data.plan === 'jobs_premium'
        ? 'jobs_only'
        : isPartTimePremium && data.plan === 'part_time'
          ? 'part_time'
          : 'free');

  return {
    ...data,
    isFullPremium,
    isJobsPremium,
    isPartTimePremium,
    isPremium: isFullPremium,
    productTier,
    currentPeriodStart: data.currentPeriodStart ?? null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
  };
}

export interface PlanSelectionResponse {
  planSelection: PlanSelectionState;
  isPremium?: boolean;
  isJobsPremium?: boolean;
  isPartTimePremium?: boolean;
}

export async function fetchPlanSelection(): Promise<PlanSelectionResponse | null> {
  if (planSelectionInflight) {
    return planSelectionInflight;
  }

  planSelectionInflight = (async () => {
    const res = await fetch(`${getBackendUrl()}/api/billing/plan-selection`, {
      headers: await authHeaders(),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) {
      throw new Error('Too many requests. Wait a moment and refresh the page.');
    }
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.planSelection) return null;
    return {
      planSelection: data.planSelection,
      isPremium: data.isPremium === true,
      isJobsPremium: data.isJobsPremium === true || data.isPremium === true,
      isPartTimePremium: data.isPartTimePremium === true,
    };
  })();

  try {
    return await planSelectionInflight;
  } finally {
    planSelectionInflight = null;
  }
}

export async function fetchExtensionUsageStatus(): Promise<ExtensionUsageStatus | null> {
  try {
    const res = await fetch(`${getBackendUrl()}/api/usage-status`, {
      headers: await authHeaders(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchBillingStatus(options?: {
  syncStripe?: boolean;
  force?: boolean;
}): Promise<BillingStatus | null> {
  const now = Date.now();
  if (
    !options?.syncStripe &&
    !options?.force &&
    billingStatusCache &&
    now - billingStatusCache.at < BILLING_STATUS_CACHE_MS
  ) {
    return billingStatusCache.data;
  }

  if (!options?.syncStripe && !options?.force && billingStatusInflight) {
    return billingStatusInflight;
  }

  const request = (async () => {
    if (options?.syncStripe || options?.force) {
      clearBillingStatusCache();
    }
    const qs = options?.syncStripe ? '?sync=1' : '';
    const res = await fetch(`${getBackendUrl()}/api/billing/status${qs}`, {
      headers: await authHeaders(),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) {
      throw new Error('Too many requests. Wait a moment and refresh the page.');
    }
    if (!res.ok) return null;
    const raw = (await res.json()) as BillingStatus;
    const data = normalizeBillingStatus(raw);
    billingStatusCache = { data, at: Date.now() };
    return data;
  })();

  if (!options?.syncStripe) {
    billingStatusInflight = request;
  }

  try {
    return await request;
  } catch (e) {
    if (e instanceof Error) throw e;
    return null;
  } finally {
    if (!options?.syncStripe) {
      billingStatusInflight = null;
    }
  }
}

export async function fetchWeeklyUpgradePreview(
  targetPriceId: string,
  promoCode?: string | null
): Promise<WeeklyUpgradePreview> {
  const params = new URLSearchParams({ targetPriceId });
  if (promoCode && promoCode.trim()) {
    params.set('promoCode', promoCode.trim());
  }
  const res = await fetch(`${getBackendUrl()}/api/billing/upgrade-preview?${params}`, {
    headers: await authHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof data.error === 'string' ? data.error : 'UPGRADE_PREVIEW_FAILED';
    throw new WeeklyUpgradeError(code, data.message || data.error || 'Failed to load upgrade preview');
  }
  return data as WeeklyUpgradePreview;
}

export async function upgradeFromWeekly(
  targetPriceId: string,
  promoCode?: string | null
): Promise<BillingStatus | null> {
  const res = await fetch(`${getBackendUrl()}/api/billing/upgrade-from-weekly`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      targetPriceId,
      ...(promoCode && promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof data.error === 'string' ? data.error : 'UPGRADE_FAILED';
    const message =
      (typeof data.message === 'string' && data.message) ||
      (code === 'INVALID_PROMO_CODE'
        ? 'This promo code is not valid, has expired, or has already been used.'
        : code === 'PAYMENT_ACTION_REQUIRED'
        ? 'Your bank needs additional verification. Use the secure link below to complete payment.'
        : code === 'UPGRADE_PAYMENT_FAILED'
          ? 'Payment could not be completed. Update your card in Manage billing, then try again.'
          : code === 'UPGRADE_AMOUNT_MISMATCH'
            ? 'The charge did not match the upgrade quote. No unexpected amount was kept — try again or contact support.'
          : code === 'UPGRADE_IN_PROGRESS'
            ? 'An upgrade payment is already in progress. Finish bank verification or wait a moment, then try again.'
            : code === 'ALREADY_FULL_PREMIUM'
              ? 'You already have Full Premium.'
              : 'Upgrade failed');
    throw new WeeklyUpgradeError(
      code,
      message,
      typeof data.hostedInvoiceUrl === 'string' ? data.hostedInvoiceUrl : null
    );
  }
  clearBillingStatusCache();
  if (data.billing) {
    const normalized = normalizeBillingStatus(data.billing as BillingStatus);
    billingStatusCache = { data: normalized, at: Date.now() };
    return normalized;
  }
  return fetchBillingStatus({ syncStripe: true, force: true });
}

export async function createCheckout(
  priceId: string,
  options?: { onboarding?: boolean; promotionCode?: string | null }
): Promise<{ url: string }> {
  const promotionCode =
    typeof options?.promotionCode === 'string' && options.promotionCode.trim()
      ? options.promotionCode.trim()
      : undefined;
  const res = await fetch(`${getBackendUrl()}/api/billing/create-checkout`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      priceId,
      onboarding: options?.onboarding === true,
      ...(promotionCode ? { promotionCode } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.message ||
      (res.status === 429
        ? 'Too many requests. Wait a minute and try again.'
        : null) ||
      (data.error === 'ALREADY_SUBSCRIBED'
        ? 'You already have an active subscription. Use Manage billing.'
        : data.error) ||
      'Failed to start checkout';
    throw new Error(msg);
  }
  captureProductEvent(ProductEvents.BILLING_CHECKOUT_STARTED, { price_id: priceId });
  redirectToStripeHostedUrl(data.url, 'checkout');
  return data;
}

export async function createBillingPortal(options?: {
  flow?: 'cancel' | 'update_card';
}): Promise<{ url: string }> {
  const res = await fetch(`${getBackendUrl()}/api/billing/create-portal`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(options?.flow ? { flow: options.flow } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.message ||
        (data.error === 'PORTAL_NOT_CONFIGURED'
          ? 'Billing portal is not set up yet. Please contact support.'
          : data.error) ||
        'Failed to open billing portal'
    );
  }
  captureProductEvent(ProductEvents.BILLING_PORTAL_OPENED);
  redirectToStripeHostedUrl(data.url, 'portal');
  return data;
}

export async function cancelSubscription(options?: {
  immediate?: boolean;
}): Promise<{
  mode: 'immediate' | 'period_end';
  billing: BillingStatus;
}> {
  let res: Response;
  try {
    res = await fetch(`${getBackendUrl()}/api/billing/cancel-subscription`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(options?.immediate ? { immediate: true } : {}),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    if (
      name === 'AbortError' ||
      name === 'TimeoutError' ||
      (e instanceof TypeError && /fetch/i.test(e.message))
    ) {
      throw new Error('Could not reach the billing API. Please try again in a moment.');
    }
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to cancel subscription');
  }
  clearBillingStatusCache();
  return {
    mode: data.mode === 'period_end' ? 'period_end' : 'immediate',
    billing: normalizeBillingStatus(data.billing),
  };
}

export async function selectFreePlan(): Promise<PlanSelectionState> {
  const res = await fetch(`${getBackendUrl()}/api/billing/select-free-plan`, {
    method: 'POST',
    headers: await authHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to select free plan');
  }
  clearBillingStatusCache();
  return data.planSelection;
}

export async function completePlanSelectionAfterPremium(): Promise<PlanSelectionState> {
  const res = await fetch(`${getBackendUrl()}/api/billing/complete-plan-selection`, {
    method: 'POST',
    headers: await authHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to complete plan selection');
  }
  clearBillingStatusCache();
  return data.planSelection;
}

export const PRICE_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_MONTHLY as string;
export const PRICE_QUARTERLY = import.meta.env.VITE_STRIPE_PRICE_QUARTERLY as string;
export const PRICE_WEEKLY = import.meta.env.VITE_STRIPE_PRICE_WEEKLY as string;
export const PRICE_JOBS_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_JOBS_MONTHLY as string;
export const PRICE_PART_TIME_WEEKLY = import.meta.env.VITE_STRIPE_PRICE_PART_TIME_WEEKLY as string;

export interface PlanCatalogPlanResponse {
  id:
    | 'free'
    | 'premium_part_time_weekly'
    | 'premium_weekly'
    | 'premium_jobs_monthly'
    | 'premium_monthly'
    | 'premium_quarterly';
  cafyFeatures: string[];
  resumeFeatures: string[];
  priceId?: string | null;
  priceDisplay?: string;
  pricePeriod?: string;
}

export async function fetchPlanCatalog(): Promise<PlanCatalogPlanResponse[] | null> {
  try {
    const res = await fetch(`${getBackendUrl()}/api/billing/plan-catalog`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.plans)) return null;
    return data.plans;
  } catch {
    return null;
  }
}
