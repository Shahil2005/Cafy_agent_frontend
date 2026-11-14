import type { BillingStatus } from '../services/billingService';
import type { PlanFeatureMap, PlanPricingMap } from '../data/planCatalog';
import {
  FALLBACK_PLAN_PRICING,
  formatJobsMonthlyPlanLabel,
  formatMonthlyPlanLabel,
  formatPartTimeWeeklyPlanLabel,
  formatQuarterlyPlanLabel,
  formatSubscriberPlanLabel,
  formatWeeklyPlanLabel,
} from '../data/planCatalog';

export type PlanId =
  | 'free'
  | 'part_time_weekly'
  | 'weekly'
  | 'jobs_monthly'
  | 'monthly'
  | 'quarterly';

export function isJobsOnlyPlanId(planId: PlanId): boolean {
  return planId === 'weekly' || planId === 'jobs_monthly';
}

/** Stripe still has a paid sub, but the latest invoice is unpaid. */
function isPastDueOnPaidPlan(billing: BillingStatus): boolean {
  return (
    billing.status === 'past_due' &&
    (billing.plan === 'premium' ||
      billing.plan === 'jobs_premium' ||
      billing.plan === 'part_time')
  );
}

function hasCurrentPaidPlan(billing: BillingStatus): boolean {
  return (
    billing.isFullPremium ||
    billing.isJobsPremium ||
    billing.isPartTimePremium ||
    isPastDueOnPaidPlan(billing)
  );
}

export function getPlanLabel(
  billing: BillingStatus | null,
  pricing: PlanPricingMap = FALLBACK_PLAN_PRICING
): string {
  if (!billing) return 'Free plan';
  const subscriberLabel = formatSubscriberPlanLabel(billing);
  if (subscriberLabel) return subscriberLabel;
  if (!hasCurrentPaidPlan(billing)) return 'Free plan';
  if (billing.productTier === 'part_time' || billing.plan === 'part_time') {
    return formatPartTimeWeeklyPlanLabel(pricing);
  }
  if (billing.productTier === 'jobs_only' || billing.plan === 'jobs_premium') {
    if (billing.billingInterval === 'monthly') return formatJobsMonthlyPlanLabel(pricing);
    return formatWeeklyPlanLabel(pricing);
  }
  if (billing.billingInterval === 'monthly') return formatMonthlyPlanLabel(pricing);
  if (billing.billingInterval === 'quarterly') return formatQuarterlyPlanLabel(pricing);
  return 'Premium';
}

function isJobsOnlySubscriber(billing: BillingStatus): boolean {
  if (billing.isFullPremium === true && billing.plan === 'premium') return false;
  return billing.productTier === 'jobs_only' || billing.plan === 'jobs_premium';
}

function isPartTimeSubscriber(billing: BillingStatus): boolean {
  if (billing.isFullPremium || isJobsOnlySubscriber(billing)) return false;
  return (
    billing.productTier === 'part_time' ||
    billing.plan === 'part_time'
  );
}

function isJobsMonthlyCadence(billing: BillingStatus): boolean {
  if (billing.billingInterval === 'weekly') return false;
  if (billing.billingInterval === 'monthly') return true;
  const period = billing.subscriptionPricePeriod ?? '';
  return period.includes('month') && !period.includes('week');
}

export function getActivePlanId(billing: BillingStatus | null): PlanId {
  if (!billing || !hasCurrentPaidPlan(billing)) return 'free';
  if (isPartTimeSubscriber(billing)) return 'part_time_weekly';
  if (isJobsOnlySubscriber(billing)) {
    return isJobsMonthlyCadence(billing) ? 'jobs_monthly' : 'weekly';
  }
  if (billing.billingInterval === 'quarterly') return 'quarterly';
  if (billing.billingInterval === 'monthly') return 'monthly';
  return 'monthly';
}

/** Feature bullets for the user's current plan (from plan catalog). */
export function getIncludedPlanFeatures(
  billing: BillingStatus | null,
  featuresByPlan: PlanFeatureMap,
  options?: { includeResume?: boolean }
): string[] {
  const planId = getActivePlanId(billing);
  const features = featuresByPlan[planId] ?? featuresByPlan.free;
  const items = [...features.cafyFeatures];
  if (options?.includeResume !== false) {
    items.push(...features.resumeFeatures);
  }
  return items;
}

export interface PlanCardUi {
  isCurrent: boolean;
  isLocked: boolean;
  buttonLabel: string;
  badge?: string;
  subtitle?: string;
  action: 'free' | 'checkout' | 'upgrade' | 'none';
}

/** Plan picker shown right after onboarding — all plans selectable. */
export function getOnboardingPlanCardUi(planId: PlanId): PlanCardUi {
  if (planId === 'free') {
    return { isCurrent: false, isLocked: false, buttonLabel: 'Continue with Free', action: 'free' };
  }
  return { isCurrent: false, isLocked: false, buttonLabel: 'Continue to payment', action: 'checkout' };
}

const PLAN_BUTTON_NAME: Record<Exclude<PlanId, 'free'>, string> = {
  part_time_weekly: 'Part-time Weekly (UK)',
  weekly: 'Jobs Premium Weekly',
  jobs_monthly: 'Jobs Premium Monthly',
  monthly: 'Premium Monthly',
  quarterly: 'Premium 3-month',
};

const CURRENT_PLAN_LABEL: Record<Exclude<PlanId, 'free'>, string> = {
  part_time_weekly: 'Your plan: Part-time Weekly (UK)',
  weekly: 'Your plan: Weekly',
  jobs_monthly: 'Your plan: Jobs Monthly',
  monthly: 'Your plan: Monthly',
  quarterly: 'Your plan: 3 months',
};

/** Upgrade targets from each paid plan. */
const UPGRADE_TARGETS: Partial<Record<PlanId, Exclude<PlanId, 'free'>[]>> = {
  part_time_weekly: ['weekly', 'jobs_monthly', 'monthly', 'quarterly'],
  weekly: ['jobs_monthly', 'monthly', 'quarterly'],
  jobs_monthly: ['monthly', 'quarterly'],
};

export function getPlanCardUi(billing: BillingStatus | null, planId: PlanId): PlanCardUi {
  const active = getActivePlanId(billing);

  if (active === 'free') {
    if (planId === 'free') {
      return { isCurrent: true, isLocked: true, buttonLabel: 'Your plan', badge: 'Your plan', action: 'none' };
    }
    return { isCurrent: false, isLocked: false, buttonLabel: 'Continue to payment', action: 'checkout' };
  }

  if (planId === 'free') {
    return {
      isCurrent: false,
      isLocked: true,
      buttonLabel: 'Free tier',
      action: 'none',
    };
  }

  if (planId === active) {
    return {
      isCurrent: true,
      isLocked: true,
      buttonLabel: CURRENT_PLAN_LABEL[active],
      badge: 'Your plan',
      action: 'none',
    };
  }

  const targets = UPGRADE_TARGETS[active];
  if (targets?.includes(planId)) {
    return {
      isCurrent: false,
      isLocked: false,
      buttonLabel: `Upgrade to ${PLAN_BUTTON_NAME[planId]}`,
      action: 'upgrade',
    };
  }

  return {
    isCurrent: false,
    isLocked: true,
    buttonLabel: PLAN_BUTTON_NAME[planId],
    action: 'none',
  };
}
