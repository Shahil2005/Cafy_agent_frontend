import { cafyTier, planTier } from './cafyBrand';
import type { PlanId } from '../utils/planCardUi';

/**
 * Restrained palette for onboarding & subscription pricing pages.
 * Tier-accented cards (cafy blue / teal / slate) — no heavy black borders.
 */
export const pricingPage = {
  pageBg: 'bg-slate-50',
  /** Full-page pricing/onboarding shell — wide enough for five or six plan cards. */
  contentMax: 'max-w-[100rem]',
  /** Fallback when plan count is unknown; prefer planGridForCount(). */
  planGrid:
    'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 w-full items-stretch',
  headerBorder: 'border-slate-200',
  headerBg: 'bg-white/95',
  eyebrow: 'text-slate-500',
  heading: 'text-slate-900',
  body: 'text-slate-600',
  muted: 'text-slate-500',
  footer: 'text-slate-400',
  price: 'text-slate-900',
  subtitleBox: 'bg-slate-50/80 border-slate-200 text-slate-600',
  btnSecondary:
    'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 disabled:opacity-50',
  btnGhost: 'bg-slate-50 text-slate-400 border border-slate-200',
  notice: 'border-slate-200 bg-slate-50 text-slate-700',
  noticeError: 'border-slate-200 bg-white text-slate-800',
  sectionBorder: 'border-slate-200',
  /** Part-time UK-only locale chip on pricing cards. */
  ukOnlyBadge:
    'inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800',
} as const;

/** One-row plan grid that reflows for Ireland (5) vs UK (6) plan sets. */
export function planGridForCount(count: number): string {
  if (count >= 6) {
    return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full items-stretch';
  }
  if (count === 5) {
    return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 w-full items-stretch';
  }
  if (count === 4) {
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full items-stretch';
  }
  return pricingPage.planGrid;
}

export function pricingButtonClass(
  cardUi: { isCurrent: boolean; isLocked: boolean; action: string },
  planId: PlanId,
): string {
  const base =
    'w-full py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors';
  const tier = cafyTier[planTier(planId)];

  if (cardUi.isCurrent || cardUi.action === 'none') {
    if (planId === 'part_time_weekly') {
      return `${base} bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default`;
    }
    return `${base} ${tier.btnMuted} cursor-default`;
  }
  if (cardUi.isLocked) {
    return `${base} ${pricingPage.btnGhost} cursor-not-allowed`;
  }
  if (planId === 'free') {
    return `${base} ${pricingPage.btnSecondary}`;
  }
  if (planId === 'part_time_weekly') {
    return `${base} bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600 disabled:opacity-50`;
  }
  return `${base} ${tier.btn} disabled:opacity-50`;
}

export function pricingCardClass(
  cardUi: { isCurrent: boolean },
  popular: boolean,
  planId: PlanId,
): string {
  if (planId === 'part_time_weekly') {
    if (cardUi.isCurrent) {
      return 'border-emerald-500 bg-gradient-to-b from-emerald-50/60 via-white to-white shadow-md shadow-emerald-100/40 ring-1 ring-emerald-500/20';
    }
    return 'border-emerald-200/90 bg-gradient-to-b from-emerald-50/35 via-white to-white shadow-sm shadow-emerald-100/30';
  }
  const tier = cafyTier[planTier(planId)];
  if (cardUi.isCurrent) return tier.cardCurrent;
  if (popular) return tier.cardRecommended;
  return tier.card;
}

export function pricingLabelClass(
  cardUi: { isCurrent: boolean },
  popular: boolean,
  planId: PlanId,
): string {
  if (planId === 'part_time_weekly' && cardUi.isCurrent) {
    return 'text-emerald-700';
  }
  const tier = cafyTier[planTier(planId)];
  if (cardUi.isCurrent) return tier.labelCurrent;
  if (popular) return tier.labelRecommended;
  return pricingPage.muted;
}

export function pricingIconWrapClass(planId: PlanId): string {
  return cafyTier[planTier(planId)].iconBg;
}

export function pricingCheckClass(planId: PlanId): string {
  return cafyTier[planTier(planId)].check;
}
