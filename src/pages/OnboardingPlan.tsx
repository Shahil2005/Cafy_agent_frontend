import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import PlanPicker from "../components/profile/PlanPicker";
import {
  createCheckout,
  fetchPlanSelection,
  selectFreePlan,
  type BillingStatus,
  type PlanSelectionState,
} from "../services/billingService";
import { useAuth } from "../hooks/useAuth";
import type { PlanId } from "../utils/planCardUi";
import {
  FALLBACK_PLAN_PRICING,
  formatPaidPlansSummary,
  mapCatalogToPlanPricing,
} from "../data/planCatalog";
import { fetchPlanCatalog } from "../services/billingService";
import { TOUR_PENDING_SESSION_KEY } from "../services/tourService";
import { pricingPage } from "../constants/pricingPage";
import { isPromoEligiblePlan } from "../data/promoPricingDisplay";
import { capturePromoFromUrl, getStoredPromoCode } from "../utils/promoCodeStorage";

const OnboardingPlan: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [promoCode, setPromoCode] = useState<string | null>(() => getStoredPromoCode());
  const [paidPlansSummary, setPaidPlansSummary] = useState(
    formatPaidPlansSummary(FALLBACK_PLAN_PRICING),
  );

  const canceled = searchParams.get("canceled") === "1";

  useEffect(() => {
    capturePromoFromUrl();
    setPromoCode(getStoredPromoCode());
  }, []);

  const loadPlanSelection = useCallback(async () => {
    try {
      const result = await fetchPlanSelection();
      if (!result) {
        setError("Failed to load plans");
        return null;
      }
      const { planSelection, isPremium, isJobsPremium, isPartTimePremium } = result;
      const hasPaid = isPremium === true || isJobsPremium === true;
      setBilling({
        plan: isPremium ? "premium" : isJobsPremium ? "jobs_premium" : isPartTimePremium ? "part_time" : "free",
        status: hasPaid ? "active" : "free",
        isPremium: isPremium === true,
        isFullPremium: isPremium === true,
        isJobsPremium: hasPaid,
        isPartTimePremium: isPartTimePremium === true,
        productTier: isPremium ? "full" : isJobsPremium ? "jobs_only" : isPartTimePremium ? "part_time" : "free",
        provider: "stripe",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        commUsed: 0,
        commLimit: 0,
        commRemaining: null,
        source: "local",
        planSelection,
      });
      if (planSelection.completed) {
        navigate("/home", { replace: true });
      } else if (hasPaid) {
        navigate("/subscription/success?onboarding=1", { replace: true });
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
      return null;
    } finally {
      setBillingLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPlanSelection();
  }, [loadPlanSelection]);

  useEffect(() => {
    fetchPlanCatalog().then((plans) => {
      if (plans?.length) {
        setPaidPlansSummary(
          formatPaidPlansSummary(mapCatalogToPlanPricing(plans)),
        );
      }
    });
  }, []);

  const finishAndEnterApp = async (planSelection: PlanSelectionState) => {
    sessionStorage.setItem(TOUR_PENDING_SESSION_KEY, "1");
    await refreshUser({ planSelectionOverride: planSelection });
    navigate("/home", { replace: true });
  };

  const handleSelectFree = async () => {
    setLoadingPlan("free");
    setError(null);
    try {
      const planSelection = await selectFreePlan();
      await finishAndEnterApp(planSelection);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not continue with Free plan",
      );
      setLoadingPlan(null);
    }
  };

  const handleSubscribe = async (priceId: string, planKey: PlanId) => {
    setLoadingPlan(planKey);
    setError(null);
    try {
      const code = isPromoEligiblePlan(planKey) ? getStoredPromoCode() : null;
      await createCheckout(priceId, {
        onboarding: true,
        promotionCode: code,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoadingPlan(null);
      await loadPlanSelection();
    }
  };

  if (billingLoading) {
    return (
      <div className={`min-h-full flex items-center justify-center ${pricingPage.pageBg}`}>
        <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className={`w-full min-h-full ${pricingPage.pageBg}`}>
      <header
        className={`sticky top-0 z-20 border-b ${pricingPage.headerBorder} ${pricingPage.headerBg} backdrop-blur-sm`}
      >
        <div className={`${pricingPage.contentMax} mx-auto px-3 sm:px-4 lg:px-6 h-14 flex items-center`}>
          <div className="flex items-center gap-2">
            <img src="/CAFY-Icon.svg" alt="" aria-hidden className="w-6 h-6 object-contain shrink-0" />
            <span className={`text-base font-semibold tracking-tight ${pricingPage.heading}`}>Cafy</span>
          </div>
        </div>
      </header>

      <main className={`${pricingPage.contentMax} mx-auto px-3 sm:px-4 lg:px-6 py-6 lg:py-8 pb-12`}>
        <div className="mb-8 lg:mb-10 max-w-2xl">
          <p className={`text-xs font-medium uppercase tracking-wide ${pricingPage.eyebrow}`}>
            Step 2 of 2
          </p>
          <h1 className={`mt-2 text-2xl sm:text-[1.75rem] font-semibold ${pricingPage.heading} tracking-tight`}>
            Choose your plan
          </h1>
          <p className={`mt-2 text-[15px] leading-relaxed ${pricingPage.body}`}>
            Pick a plan to continue: {paidPlansSummary.toLowerCase()}. You can change or upgrade
            anytime from Profile.
          </p>
        </div>

        {promoCode && (
          <div
            className={`mb-6 rounded-md border px-4 py-3 text-sm ${pricingPage.notice}`}
            role="status"
          >
            Promo code <span className="font-semibold">{promoCode}</span> will be applied
            automatically when you choose Monthly or 3-month.
          </div>
        )}
        {canceled && (
          <div
            className={`mb-6 rounded-md border px-4 py-3 text-sm ${pricingPage.notice}`}
            role="status"
          >
            Checkout was cancelled. Continue with Free, or select a paid plan to try again.
          </div>
        )}
        {error && (
          <div
            className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mb-6">
          <h2 className={`text-base font-semibold ${pricingPage.heading}`}>Available plans</h2>
          <p className={`mt-1 text-sm ${pricingPage.muted}`}>
            Payments secured by Stripe.
          </p>
        </div>

        <PlanPicker
          mode="onboarding"
          billing={billing}
          loadingPlan={loadingPlan}
          onSelectFree={handleSelectFree}
          onSubscribe={handleSubscribe}
        />

        <p className={`mt-8 text-center text-xs ${pricingPage.footer}`}>
          Payments processed securely by Stripe. Cancel anytime from Manage billing.
        </p>
      </main>
    </div>
  );
};

export default OnboardingPlan;
