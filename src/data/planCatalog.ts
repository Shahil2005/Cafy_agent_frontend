import type { PlanId } from '../utils/planCardUi';
import {
  PRICE_JOBS_MONTHLY,
  PRICE_MONTHLY,
  PRICE_PART_TIME_WEEKLY,
  PRICE_QUARTERLY,
  PRICE_WEEKLY,
} from '../services/billingService';

export type CatalogPlanId =
  | 'free'
  | 'premium_part_time_weekly'
  | 'premium_weekly'
  | 'premium_jobs_monthly'
  | 'premium_monthly'
  | 'premium_quarterly';

export interface PlanCatalogPlan {
  id: CatalogPlanId;
  cafyFeatures: string[];
  resumeFeatures: string[];
  priceId?: string | null;
  priceDisplay?: string;
  pricePeriod?: string;
  billingPeriodDays?: number | null;
  pricePerDayDisplay?: string | null;
  unitAmountMinor?: number | null;
  renewalPeriodStart?: string | null;
  renewalPeriodEnd?: string | null;
}

export type PlanFeatureMap = Record<PlanId, { cafyFeatures: string[]; resumeFeatures: string[] }>;

export type PlanPricingMap = Record<
  PlanId,
  {
    priceId: string | null;
    priceDisplay: string;
    pricePeriod: string;
    pricePerDayDisplay?: string | null;
    unitAmountMinor?: number | null;
    billingPeriodDays?: number | null;
    renewalPeriodStart?: string | null;
    renewalPeriodEnd?: string | null;
  }
>;

const CATALOG_TO_PLAN_ID: Record<CatalogPlanId, PlanId> = {
  free: 'free',
  premium_part_time_weekly: 'part_time_weekly',
  premium_weekly: 'weekly',
  premium_jobs_monthly: 'jobs_monthly',
  premium_monthly: 'monthly',
  premium_quarterly: 'quarterly',
};

/** Fallback when API is unavailable — keep feature text aligned with ProductBackend billing/planCatalog.ts */
export const FALLBACK_PLAN_FEATURES: PlanFeatureMap = {
  free: {
    cafyFeatures: [
      'Unlimited job tracker',
      'Limited job analysis access',
      '5 cover letters & emails',
      '5 extension uses',
      '5 Autofill credits',
      '1 Career Path roadmap',
    ],
    resumeFeatures: [
      '2 AI uses',
      '1 import',
      '5 PDF downloads',
      'Unlimited editing',
    ],
  },
  part_time_weekly: {
    cafyFeatures: [
      'Everything in Free, plus',
      'Full UK part-time jobs',
    ],
    resumeFeatures: [
      '2 AI uses',
      '1 import',
      '5 PDF downloads',
      'Unlimited editing',
    ],
  },
  weekly: {
    cafyFeatures: [
      'Everything in Free, plus',
      'Access to Unlimited jobs',
      'Full UK part-time jobs',
    ],
    resumeFeatures: [
      '2 AI uses',
      '1 import',
      '5 PDF downloads',
      'Unlimited editing',
    ],
  },
  jobs_monthly: {
    cafyFeatures: [
      'Everything in Free, plus',
      'Access to Unlimited jobs',
      'Full UK part-time jobs',
    ],
    resumeFeatures: [
      '2 AI uses',
      '1 import',
      '5 PDF downloads',
      'Unlimited editing',
    ],
  },
  monthly: {
    cafyFeatures: [
      'Unlimited job tracker',
      'Full jobs board',
      'Unlimited cover letters & emails',
      'Unlimited AI analysis',
      '20 Autofill credits per day',
      'Daily Career Path roadmaps',
      'LinkedIn Optimiser',
    ],
    resumeFeatures: [
      'Unlimited AI tools',
      'Unlimited imports',
      'Unlimited PDF downloads',
      'Unlimited editing',
    ],
  },
  quarterly: {
    cafyFeatures: [
      'Unlimited job tracker',
      'Full jobs board',
      'Unlimited cover letters & emails',
      'Unlimited AI analysis',
      '20 Autofill credits per day',
      'Daily Career Path roadmaps',
      'LinkedIn Optimiser',
    ],
    resumeFeatures: [
      'Unlimited AI tools',
      'Unlimited imports',
      'Unlimited PDF downloads',
      'Unlimited editing',
    ],
  },
};

/** Checkout still works if catalog fetch fails — price IDs from env as last resort. */
export const FALLBACK_PLAN_PRICING: PlanPricingMap = {
  free: { priceId: null, priceDisplay: '£0', pricePeriod: '', pricePerDayDisplay: '£0/day' },
  part_time_weekly: {
    priceId: PRICE_PART_TIME_WEEKLY || null,
    priceDisplay: '£0.99',
    pricePeriod: '/week',
    unitAmountMinor: 99,
    pricePerDayDisplay: '£0.14/day',
  },
  weekly: {
    priceId: PRICE_WEEKLY || null,
    priceDisplay: '£1.99',
    pricePeriod: '/week',
    unitAmountMinor: 199,
    pricePerDayDisplay: '£0.28/day',
  },
  jobs_monthly: {
    priceId: PRICE_JOBS_MONTHLY || null,
    priceDisplay: '£5.99',
    pricePeriod: '/month',
    unitAmountMinor: 599,
    pricePerDayDisplay: '£0.20/day',
  },
  monthly: {
    priceId: PRICE_MONTHLY || null,
    priceDisplay: '…',
    pricePeriod: '/month',
  },
  quarterly: {
    priceId: PRICE_QUARTERLY || null,
    priceDisplay: '…',
    pricePeriod: '/3 months',
  },
};

export function mapCatalogToPlanFeatures(plans: PlanCatalogPlan[]): PlanFeatureMap {
  const out = { ...FALLBACK_PLAN_FEATURES };
  for (const p of plans) {
    const planId = CATALOG_TO_PLAN_ID[p.id];
    if (planId) {
      out[planId] = { cafyFeatures: p.cafyFeatures, resumeFeatures: p.resumeFeatures };
    }
  }
  return out;
}

export function mapCatalogToPlanPricing(plans: PlanCatalogPlan[]): PlanPricingMap {
  const out: PlanPricingMap = { ...FALLBACK_PLAN_PRICING };
  for (const p of plans) {
    const planId = CATALOG_TO_PLAN_ID[p.id];
    if (!planId) continue;
    out[planId] = {
      priceId: p.priceId ?? null,
      priceDisplay: p.priceDisplay ?? '…',
      pricePeriod: p.pricePeriod ?? '',
      pricePerDayDisplay: p.pricePerDayDisplay ?? null,
      unitAmountMinor: p.unitAmountMinor ?? null,
      billingPeriodDays: p.billingPeriodDays ?? null,
      renewalPeriodStart: p.renewalPeriodStart ?? null,
      renewalPeriodEnd: p.renewalPeriodEnd ?? null,
    };
  }
  return out;
}

export function formatPaidPlansSummary(pricing: PlanPricingMap): string {
  const monthly = pricing.monthly;
  const quarterly = pricing.quarterly;
  if (monthly.priceDisplay === '…' || quarterly.priceDisplay === '…') {
    return 'monthly or quarterly billing';
  }
  return `Monthly ${monthly.priceDisplay} or 3-month ${quarterly.priceDisplay}`;
}

export function formatWeeklyPlanLabel(pricing: PlanPricingMap): string {
  const { priceDisplay, pricePeriod } = pricing.weekly;
  if (priceDisplay === '…') return 'Jobs Premium Weekly';
  return `Jobs Premium Weekly (${priceDisplay}${pricePeriod})`;
}

export function formatPartTimeWeeklyPlanLabel(pricing: PlanPricingMap): string {
  const { priceDisplay, pricePeriod } = pricing.part_time_weekly;
  if (priceDisplay === '…') return 'Part-time Weekly (UK)';
  return `Part-time Weekly (UK) (${priceDisplay}${pricePeriod})`;
}

export function formatJobsMonthlyPlanLabel(pricing: PlanPricingMap): string {
  const { priceDisplay, pricePeriod } = pricing.jobs_monthly;
  if (priceDisplay === '…') return 'Jobs Premium Monthly';
  return `Jobs Premium Monthly (${priceDisplay}${pricePeriod})`;
}

export function formatMonthlyPlanLabel(pricing: PlanPricingMap): string {
  const { priceDisplay } = pricing.monthly;
  if (priceDisplay === '…') return 'Premium Monthly';
  return `Premium Monthly (${priceDisplay}/mo)`;
}

export function formatQuarterlyPlanLabel(pricing: PlanPricingMap): string {
  const { priceDisplay } = pricing.quarterly;
  if (priceDisplay === '…') return 'Premium 3 months';
  return `Premium 3 months (${priceDisplay})`;
}

type SubscriberBilling = {
  productTier?: string;
  plan?: string;
  billingInterval?: string | null;
  subscriptionPriceDisplay?: string | null;
  subscriptionPricePeriod?: string | null;
};

/** Label for an active subscriber using their Stripe price (legacy or current). */
export function formatSubscriberPlanLabel(billing: SubscriberBilling): string | null {
  const amount = billing.subscriptionPriceDisplay;
  if (!amount) return null;

  if (billing.productTier === 'part_time' || billing.plan === 'part_time') {
    const period = billing.subscriptionPricePeriod ?? '/week';
    return `Part-time Weekly (UK) (${amount}${period})`;
  }
  if (billing.productTier === 'jobs_only' || billing.plan === 'jobs_premium') {
    const isMonthly = billing.billingInterval === 'monthly';
    const period = billing.subscriptionPricePeriod ?? (isMonthly ? '/month' : '/week');
    const name = isMonthly ? 'Jobs Premium Monthly' : 'Jobs Premium Weekly';
    return `${name} (${amount}${period})`;
  }
  if (billing.billingInterval === 'monthly') {
    return `Premium Monthly (${amount}/mo)`;
  }
  if (billing.billingInterval === 'quarterly') {
    return `Premium 3 months (${amount})`;
  }
  return null;
}

export function hasWeeklyPlan(pricing: PlanPricingMap): boolean {
  return !!pricing.weekly?.priceId;
}

export function hasPartTimeWeeklyPlan(pricing: PlanPricingMap): boolean {
  return !!pricing.part_time_weekly?.priceId;
}

export function hasJobsMonthlyPlan(pricing: PlanPricingMap): boolean {
  return !!pricing.jobs_monthly?.priceId;
}

/** Human billing cadence — shown under per-day hero price. */
export function getPlanBillingCadenceLabel(planId: PlanId): string | null {
  switch (planId) {
    case 'part_time_weekly':
    case 'weekly':
      return 'Billed weekly';
    case 'jobs_monthly':
    case 'monthly':
      return 'Billed monthly';
    case 'quarterly':
      return 'Billed every 3 months';
    default:
      return null;
  }
}

/** Cadence + lump sum for the billing callout (user pays weekly/monthly/3-month, not daily). */
export function getPlanBilledAmountDetails(
  planId: PlanId,
  priceDisplay: string,
  pricePeriod = '',
): { cadence: string; amount: string; period: string } | null {
  if (planId === 'free' || priceDisplay === '…') return null;
  const cadence = getPlanBillingCadenceLabel(planId);
  if (!cadence) return null;
  const period = pricePeriod.trim();
  return {
    cadence,
    amount: priceDisplay,
    period,
  };
}

const SECONDS_PER_DAY = 86_400;

export function billingPeriodDaysBetweenIso(startIso: string, endIso: string): number {
  const startSec = Math.floor(new Date(startIso).getTime() / 1000);
  const endSec = Math.floor(new Date(endIso).getTime() / 1000);
  return Math.max(0, Math.floor((endSec - startSec) / SECONDS_PER_DAY));
}

export function formatPricePerDayDisplay(unitAmountMinor: number, periodDays: number): string {
  const perDayMinor = Math.round(unitAmountMinor / periodDays);
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: perDayMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(perDayMinor / 100) + '/day';
}

export function pricePerDayFromPeriodIso(
  unitAmountMinor: number,
  periodStartIso: string,
  periodEndIso: string,
): string | null {
  const days = billingPeriodDaysBetweenIso(periodStartIso, periodEndIso);
  if (days <= 0) {
    return null;
  }
  return formatPricePerDayDisplay(unitAmountMinor, days);
}

export function getPlanPricePerDayDisplay(
  planId: PlanId,
  pricing: PlanPricingMap[PlanId],
  options?: {
    isCurrentPlan?: boolean;
    isPaidSubscriber?: boolean;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
  },
): string {
  if (planId === 'free') {
    return '£0/day';
  }

  const unitAmountMinor = pricing.unitAmountMinor;
  if (unitAmountMinor == null || unitAmountMinor <= 0) {
    return pricing.pricePerDayDisplay ?? '…';
  }

  if (
    options?.isCurrentPlan &&
    options?.isPaidSubscriber &&
    options.currentPeriodStart &&
    options.currentPeriodEnd
  ) {
    const fromSubscription = pricePerDayFromPeriodIso(
      unitAmountMinor,
      options.currentPeriodStart,
      options.currentPeriodEnd,
    );
    if (fromSubscription) {
      return fromSubscription;
    }
  }

  if (pricing.renewalPeriodStart && pricing.renewalPeriodEnd) {
    const fromPreview = pricePerDayFromPeriodIso(
      unitAmountMinor,
      pricing.renewalPeriodStart,
      pricing.renewalPeriodEnd,
    );
    if (fromPreview) {
      return fromPreview;
    }
  }

  return pricing.pricePerDayDisplay ?? '…';
}
