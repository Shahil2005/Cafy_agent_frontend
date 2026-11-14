import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { PLAN_DEFINITIONS } from "../../data/planDefinitions";
import {
  FALLBACK_PLAN_FEATURES,
  FALLBACK_PLAN_PRICING,
  hasJobsMonthlyPlan,
  hasPartTimeWeeklyPlan,
  hasWeeklyPlan,
  mapCatalogToPlanFeatures,
  mapCatalogToPlanPricing,
  type PlanFeatureMap,
  type PlanPricingMap,
} from "../../data/planCatalog";
import {
  getAnchorPriceDisplay,
  isPromoEligiblePlan,
  resolveWebsitePriceDisplay,
} from "../../data/promoPricingDisplay";
import type { BillingStatus } from "../../services/billingService";
import { fetchPlanCatalog } from "../../services/billingService";
import {
  getPlanCardUi,
  getOnboardingPlanCardUi,
  type PlanId,
} from "../../utils/planCardUi";
import {
  pricingButtonClass,
  pricingCardClass,
  pricingCheckClass,
  pricingIconWrapClass,
  pricingLabelClass,
  pricingPage,
  planGridForCount,
} from "../../constants/pricingPage";
import { cafyTier, planTier } from "../../constants/cafyBrand";
import { useAuth } from "../../hooks/useAuth";
import { isIrelandCareerLocation } from "../../utils/sponsorshipHubRouting";

function UkOnlyBadge() {
  return (
    <span className={pricingPage.ukOnlyBadge} title="Available for United Kingdom profiles only">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      UK only part-time jobs
    </span>
  );
}

export type PlanPickerMode = "onboarding" | "subscription";

interface PlanPickerProps {
  mode: PlanPickerMode;
  billing: BillingStatus | null;
  loadingPlan: string | null;
  onSelectFree: () => void;
  onSubscribe: (priceId: string, planId: PlanId) => void;
  onUpgrade?: (priceId: string, planId: PlanId) => void;
  pricingByPlan?: PlanPricingMap;
  featuresByPlan?: PlanFeatureMap;
  compact?: boolean;
}

function FeatureSection({
  title,
  items,
  checkClass,
}: {
  title: string;
  items: string[];
  checkClass: string;
}) {
  return (
    <div>
      <p className={`text-xs font-medium uppercase tracking-wide ${pricingPage.muted} mb-2.5`}>
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className={`shrink-0 mt-0.5 w-3.5 h-3.5 ${checkClass}`} aria-hidden />
            <span className="text-xs leading-snug text-slate-600">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function planDisplayName(planId: PlanId, fallbackName: string): string {
  if (planId === "free") return "Free";
  if (planId === "part_time_weekly") return "Part-time";
  if (planId === "weekly" || planId === "jobs_monthly") return "Jobs Premium";
  return fallbackName === "Free" ? "Premium" : fallbackName;
}

const PlanPicker: React.FC<PlanPickerProps> = ({
  mode,
  billing,
  loadingPlan,
  onSelectFree,
  onSubscribe,
  onUpgrade,
  pricingByPlan: pricingProp,
  featuresByPlan: featuresProp,
  compact = false,
}) => {
  const { user } = useAuth();
  const hidePartTimePlan = isIrelandCareerLocation(user?.preferences?.locations);
  const isOnboarding = mode === "onboarding";
  const isBrandedLayout = !compact;
  const [featuresByPlan, setFeaturesByPlan] = useState<PlanFeatureMap>(
    featuresProp ?? FALLBACK_PLAN_FEATURES,
  );
  const [pricingByPlan, setPricingByPlan] = useState<PlanPricingMap>(
    pricingProp ?? FALLBACK_PLAN_PRICING,
  );

  useEffect(() => {
    if (featuresProp) setFeaturesByPlan(featuresProp);
  }, [featuresProp]);

  useEffect(() => {
    if (pricingProp) setPricingByPlan(pricingProp);
  }, [pricingProp]);

  useEffect(() => {
    // Always refresh catalog when part-time is shown (e.g. Ireland → UK) so
    // we don't keep the placeholder price from an older catalog fetch.
    if (pricingProp && featuresProp && hidePartTimePlan) return;
    fetchPlanCatalog().then((plans) => {
      if (plans?.length) {
        setFeaturesByPlan(mapCatalogToPlanFeatures(plans));
        setPricingByPlan(mapCatalogToPlanPricing(plans));
      }
    });
  }, [pricingProp, featuresProp, hidePartTimePlan]);

  const visiblePlans = PLAN_DEFINITIONS.filter((plan) => {
    if (plan.planId === "part_time_weekly") {
      return !hidePartTimePlan && hasPartTimeWeeklyPlan(pricingByPlan);
    }
    if (plan.planId === "weekly") return hasWeeklyPlan(pricingByPlan);
    if (plan.planId === "jobs_monthly") return hasJobsMonthlyPlan(pricingByPlan);
    return true;
  });

  const gridClass = planGridForCount(visiblePlans.length);

  return (
    <div>
      <div className={gridClass}>
      {visiblePlans.map((plan, index) => {
        const cardUi = isOnboarding
          ? getOnboardingPlanCardUi(plan.planId)
          : getPlanCardUi(billing, plan.planId);
        const isFreePlan = plan.planId === "free";
        const isPartTimePlan = plan.planId === "part_time_weekly";
        const { cafyFeatures, resumeFeatures } =
          featuresByPlan[plan.planId] ?? featuresByPlan.free;
        const pricing = pricingByPlan[plan.planId];
        const isUsersCurrentPlan = !isOnboarding && cardUi.isCurrent;
        const displayAmount =
          isUsersCurrentPlan && billing?.subscriptionPriceDisplay
            ? billing.subscriptionPriceDisplay
            : isPromoEligiblePlan(plan.planId)
              ? resolveWebsitePriceDisplay(plan.planId, pricing.priceDisplay)
              : pricing.priceDisplay;
        const anchorAmount = isUsersCurrentPlan ? null : getAnchorPriceDisplay(plan.planId);
        const pricePeriod =
          isUsersCurrentPlan && billing?.subscriptionPricePeriod
            ? billing.subscriptionPricePeriod
            : pricing.pricePeriod || plan.period;

        const handleClick = () => {
          if (cardUi.isLocked || loadingPlan) return;
          if (cardUi.action === "free" || isFreePlan) {
            onSelectFree();
            return;
          }
          if (!pricing?.priceId) return;
          if (cardUi.action === "upgrade") {
            onUpgrade?.(pricing.priceId, plan.planId);
            return;
          }
          onSubscribe(pricing.priceId, plan.planId);
        };

        const tierStyles = cafyTier[planTier(plan.planId)];
        const checkClass = isPartTimePlan
          ? "text-emerald-500"
          : pricingCheckClass(plan.planId);

        const cardBorder = isBrandedLayout
          ? pricingCardClass(cardUi, plan.popular, plan.planId)
          : cardUi.isCurrent
            ? "border-emerald-500 ring-4 ring-emerald-500/15"
            : plan.popular
              ? "border-cafy-600 ring-4 ring-cafy-600/10"
              : plan.planId === "weekly" || plan.planId === "jobs_monthly"
                ? "border-teal-500/40"
                : isPartTimePlan
                  ? "border-emerald-500/40"
                : "border-slate-200";

        const cardPadding = isBrandedLayout ? "p-4" : "p-5";
        const cardRadius = isBrandedLayout ? "rounded-xl" : "rounded-2xl";

        const CardWrapper = isBrandedLayout ? "div" : motion.div;
        const cardProps = isBrandedLayout
          ? {}
          : {
              initial: { opacity: 0, y: 30 },
              animate: { opacity: 1, y: 0 },
              transition: { delay: 0.1 * (index + 1) },
            };

        return (
          <CardWrapper
            key={`${plan.name}-${plan.planId}`}
            {...cardProps}
            className={`relative flex flex-col border ${cardRadius} ${cardPadding} ${cardBorder} ${
              cardUi.isLocked && !cardUi.isCurrent && !isBrandedLayout ? "opacity-90" : ""
            } ${isBrandedLayout ? "h-full" : "bg-white"} ${
              isPartTimePlan && isBrandedLayout
                ? "bg-gradient-to-b from-emerald-50/40 via-white to-white"
                : ""
            }`}
          >
            {isBrandedLayout ? (
              <div className="mb-4 flex min-h-[1.25rem] items-center justify-between gap-2">
                {cardUi.isCurrent ? (
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${pricingLabelClass(cardUi, plan.popular, plan.planId)}`}
                  >
                    Current plan
                  </span>
                ) : plan.popular ? (
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${pricingLabelClass(cardUi, plan.popular, plan.planId)}`}
                  >
                    Recommended
                  </span>
                ) : isPartTimePlan ? (
                  <UkOnlyBadge />
                ) : (
                  <span aria-hidden className="text-xs">
                    &nbsp;
                  </span>
                )}
                {isPartTimePlan && (cardUi.isCurrent || plan.popular) ? <UkOnlyBadge /> : null}
              </div>
            ) : (
              <>
                {cardUi.badge && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase whitespace-nowrap">
                    {cardUi.badge}
                  </div>
                )}
                {plan.popular && !cardUi.badge && (
                  <div className="absolute top-0 right-0 -translate-y-1/2 bg-cafy-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                    Most popular
                  </div>
                )}
                {isPartTimePlan ? (
                  <div className="absolute top-3 right-3">
                    <UkOnlyBadge />
                  </div>
                ) : null}
              </>
            )}

            <div
              className={
                isBrandedLayout
                  ? "mb-3 flex items-start gap-2.5"
                  : "flex items-center gap-3 mb-4"
              }
            >
              <div
                className={
                  isBrandedLayout
                    ? `p-2.5 rounded-lg shrink-0 ${
                        isPartTimePlan
                          ? "bg-emerald-50 text-emerald-700"
                          : pricingIconWrapClass(plan.planId)
                      }`
                    : `p-3 rounded-xl shrink-0 ${
                        isPartTimePlan ? "bg-emerald-50 text-emerald-700" : tierStyles.iconBg
                      }`
                }
              >
                {plan.icon}
              </div>
              <div className="min-w-0">
                <h3
                  className={
                    isBrandedLayout
                      ? `text-sm font-semibold ${pricingPage.heading} tracking-tight`
                      : "text-xl font-bold text-slate-900"
                  }
                >
                  {planDisplayName(plan.planId, plan.name)}
                </h3>
                {plan.subtitle && (
                  <p className={`text-sm ${pricingPage.muted} mt-0.5`}>{plan.subtitle}</p>
                )}
              </div>
            </div>

            <div
              className={
                isBrandedLayout
                  ? `mb-3 pb-3 border-b ${tierStyles.border}`
                  : "mb-6"
              }
            >
              <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
                {anchorAmount ? (
                  <span className="text-sm tabular-nums text-slate-400 line-through">
                    {anchorAmount}
                  </span>
                ) : null}
                <span
                  className={
                    isBrandedLayout
                      ? `text-xl sm:text-2xl font-semibold tracking-tight tabular-nums ${pricingPage.price}`
                      : "text-4xl font-extrabold text-slate-900 tabular-nums"
                  }
                >
                  {displayAmount}
                </span>
                {pricePeriod && (
                  <span
                    className={
                      isBrandedLayout
                        ? `text-sm font-medium ${pricingPage.muted}`
                        : "text-lg font-semibold text-slate-500"
                    }
                  >
                    {pricePeriod}
                  </span>
                )}
              </div>
              {plan.description ? (
                <p className={`text-sm ${pricingPage.muted} mt-1.5 leading-snug`}>
                  {plan.description}
                </p>
              ) : null}
            </div>

            {cardUi.subtitle && (
              <p
                className={
                  isBrandedLayout
                    ? `text-xs leading-relaxed rounded-md px-3 py-2 mb-4 border ${pricingPage.subtitleBox}`
                    : "text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4 -mt-2"
                }
              >
                {cardUi.subtitle}
              </p>
            )}

            <div className={`flex-1 ${isBrandedLayout ? "mb-4" : "mb-8"}`}>
              {plan.planId !== "quarterly" && (
                <div className="space-y-3">
                  <FeatureSection
                    title="Cafy Product"
                    items={cafyFeatures}
                    checkClass={checkClass}
                  />
                  {plan.planId !== "weekly" &&
                    plan.planId !== "jobs_monthly" &&
                    plan.planId !== "part_time_weekly" && (
                    <FeatureSection
                      title="Resume studio"
                      items={resumeFeatures}
                      checkClass={checkClass}
                    />
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleClick}
              disabled={cardUi.isLocked || cardUi.action === "none" || !!loadingPlan}
              className={
                isBrandedLayout
                  ? pricingButtonClass(cardUi, plan.planId)
                  : `w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${plan.buttonClass} disabled:opacity-60 disabled:cursor-not-allowed`
              }
            >
              {loadingPlan === plan.planId ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  {isFreePlan
                    ? "Continuing…"
                    : cardUi.action === "upgrade"
                      ? "Loading…"
                      : "Opening checkout…"}
                </>
              ) : (
                cardUi.buttonLabel
              )}
            </button>
          </CardWrapper>
        );
      })}
      </div>
    </div>
  );
};

export default PlanPicker;
