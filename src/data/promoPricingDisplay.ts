import type { PlanId } from '../utils/planCardUi';

/** Website sell amounts when Stripe catalog has not loaded yet. */
export const WEBSITE_PRICE_FALLBACK: Partial<Record<PlanId, string>> = {
  monthly: '£34',
  quarterly: '£91',
};

/** Compare-at “Was” amounts shown under the live sell price. */
export const ANCHOR_PRICE_DISPLAY: Partial<Record<PlanId, string>> = {
  monthly: '£48',
  quarterly: '£130',
};

export function isPromoEligiblePlan(planId: PlanId): boolean {
  return planId === 'monthly' || planId === 'quarterly';
}

/** Upgrade modal: promo only for Full Premium targets — never jobs weekly/monthly (incl. from part-time). */
export function isPromoEligibleUpgradeTarget(planId: PlanId | null | undefined): boolean {
  return planId === 'monthly' || planId === 'quarterly';
}

export function getAnchorPriceDisplay(planId: PlanId): string | null {
  return ANCHOR_PRICE_DISPLAY[planId] ?? null;
}

export function resolveWebsitePriceDisplay(
  planId: PlanId,
  catalogPriceDisplay: string | undefined | null
): string {
  if (catalogPriceDisplay && catalogPriceDisplay !== '…') {
    return catalogPriceDisplay;
  }
  return WEBSITE_PRICE_FALLBACK[planId] ?? '…';
}
