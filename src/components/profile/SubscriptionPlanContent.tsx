import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import {
  createCheckout,
  fetchWeeklyUpgradePreview,
  selectFreePlan,
  cancelSubscription,
  type WeeklyUpgradePreview,
} from '../../services/billingService';
import { type PlanId } from '../../utils/planCardUi';
import PlanPicker from './PlanPicker';
import WeeklyUpgradeModal from '../billing/WeeklyUpgradeModal';
import { useBillingPortal } from '../../hooks/useBillingPortal';
import { useBilling } from '../../hooks/useBilling';
import { pricingPage } from '../../constants/pricingPage';
import { isPromoEligiblePlan } from '../../data/promoPricingDisplay';
import { capturePromoFromUrl, getStoredPromoCode } from '../../utils/promoCodeStorage';
import BillingPeriodNotice from '../billing/BillingPeriodNotice';

interface SubscriptionPlanContentProps {
  showCanceledBanner?: boolean;
  syncStripeOnMount?: boolean;
  /** When true, only plan cards (no duplicate current-plan banner). Used inside Plan & usage modal. */
  embedded?: boolean;
}

const SubscriptionPlanContent: React.FC<SubscriptionPlanContentProps> = ({
  showCanceledBanner = false,
  syncStripeOnMount = true,
  embedded = false,
}) => {
  const { billing, loading, refresh, applyBilling, planLabel, pricingByPlan, featuresByPlan } = useBilling();
  const { opening: portalOpening, openPortal } = useBillingPortal();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmPastDueCancel, setConfirmPastDueCancel] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState<string | null>(() => getStoredPromoCode());
  const [upgradeTarget, setUpgradeTarget] = useState<{
    priceId: string;
    planId: PlanId;
    label: string;
    preview: WeeklyUpgradePreview | null;
  } | null>(null);

  const isPastDue = billing?.status === 'past_due';
  const hasPaidPlan =
    Boolean(billing?.isJobsPremium) ||
    Boolean(billing?.isPartTimePremium) ||
    isPastDue;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    capturePromoFromUrl();
    setPromoCode(getStoredPromoCode());
  }, []);

  useEffect(() => {
    if (syncStripeOnMount) {
      void refreshRef.current({ syncStripe: true, force: true });
    }
  }, [syncStripeOnMount]);

  const handleCancelPlan = async () => {
    if (isPastDue) {
      setConfirmPastDueCancel(true);
      setError(null);
      return;
    }
    void openPortal({ flow: 'cancel' });
  };

  const confirmImmediateCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      const result = await cancelSubscription({ immediate: true });
      applyBilling(result.billing);
      setConfirmPastDueCancel(false);
      setCancelNotice(
        'Your plan is cancelled. Retries have stopped and you will not be charged again.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel plan');
    } finally {
      setCancelling(false);
    }
  };

  const handleSelectFree = async () => {
    setLoadingPlan('free');
    setError(null);
    try {
      await selectFreePlan();
      await refresh({ force: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update plan');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSubscribe = async (priceId: string, planKey: PlanId) => {
    setLoadingPlan(planKey);
    setError(null);
    try {
      const code = isPromoEligiblePlan(planKey) ? getStoredPromoCode() : null;
      await createCheckout(priceId, { promotionCode: code });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setLoadingPlan(null);
      await refresh({ force: true });
    }
  };

  const handleUpgradeRequest = async (priceId: string, planId: PlanId) => {
    const label =
      planId === 'part_time_weekly'
        ? 'Part-time Weekly (UK)'
        : planId === 'weekly'
          ? 'Jobs Premium Weekly'
          : planId === 'jobs_monthly'
            ? 'Jobs Premium Monthly'
            : planId === 'monthly'
              ? 'Premium Monthly'
              : 'Premium 3-month';
    setLoadingPlan(planId);
    setError(null);
    try {
      // Prefetch so the modal opens with the summary already ready (no empty blink).
      const preview = await fetchWeeklyUpgradePreview(priceId, null);
      setUpgradeTarget({ priceId, planId, label, preview });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load upgrade summary');
    } finally {
      setLoadingPlan(null);
    }
  };

  const showSubscriptionSkeleton = loading && !billing;

  return (
    <>
      {promoCode && !hasPaidPlan && !embedded && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${pricingPage.notice}`}
          role="status"
        >
          Promo code <span className="font-semibold">{promoCode}</span> will be applied
          automatically when you choose Monthly or 3-month.
        </div>
      )}
      {cancelNotice && !embedded && (
        <div
          className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          role="status"
        >
          {cancelNotice}
        </div>
      )}
      {showCanceledBanner && !embedded && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${pricingPage.notice}`}
          role="status"
        >
          Checkout was cancelled. You can select a plan again when you are ready.
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

      {showSubscriptionSkeleton && !embedded ? (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3.5 sm:px-5 animate-pulse">
          <div className="h-4 w-36 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-full max-w-sm bg-slate-100 rounded" />
        </div>
      ) : billing && !embedded ? (
        <section
          className={`mb-6 rounded-lg border ${pricingPage.sectionBorder} bg-white px-4 py-3.5 sm:px-5`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-semibold ${pricingPage.heading}`}>{planLabel}</p>
                  {isPastDue && (
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800 ring-1 ring-inset ring-rose-600/15">
                      Past due
                    </span>
                  )}
                  {hasPaidPlan && !billing.cancelAtPeriodEnd && !isPastDue && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                      Active
                    </span>
                  )}
                  {billing.cancelAtPeriodEnd && !isPastDue && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/15">
                      Ending
                    </span>
                  )}
                </div>
              </div>
              {hasPaidPlan && (billing.provider === 'stripe' || isPastDue) && (
                <div className="flex flex-wrap items-center gap-2 shrink-0 sm:mt-0.5">
                  {billing.provider === 'stripe' && (
                    <button
                      type="button"
                      onClick={() => void openPortal(isPastDue ? { flow: 'update_card' } : undefined)}
                      disabled={portalOpening || cancelling}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-60 transition-colors ${pricingPage.btnSecondary}`}
                    >
                      {portalOpening ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                      )}
                      {portalOpening ? 'Opening…' : isPastDue ? 'Update card' : 'Manage billing'}
                    </button>
                  )}
                  {(isPastDue || !billing.cancelAtPeriodEnd) && (
                    <button
                      type="button"
                      onClick={() => void handleCancelPlan()}
                      disabled={cancelling || portalOpening}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-rose-200 bg-white text-rose-800 hover:bg-rose-50 disabled:opacity-60 transition-colors"
                    >
                      {cancelling || portalOpening ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                      )}
                      {cancelling
                        ? 'Cancelling…'
                        : portalOpening
                          ? 'Opening…'
                          : isPastDue
                            ? 'Cancel plan'
                            : 'Cancel at period end'}
                    </button>
                  )}
                </div>
              )}
            </div>
            {isPastDue ? (
              <BillingPeriodNotice
                currentPeriodEnd={billing.currentPeriodEnd}
                cancelAtPeriodEnd={false}
                pastDue
                planLabel={planLabel}
              />
            ) : billing.cancelAtPeriodEnd ? (
              <BillingPeriodNotice
                currentPeriodEnd={billing.currentPeriodEnd}
                cancelAtPeriodEnd
                planLabel={planLabel}
              />
            ) : hasPaidPlan && billing.currentPeriodEnd ? (
              <BillingPeriodNotice
                currentPeriodEnd={billing.currentPeriodEnd}
                cancelAtPeriodEnd={false}
                planLabel={planLabel}
              />
            ) : null}
            {confirmPastDueCancel && isPastDue ? (
              <div
                className="rounded-lg border border-rose-200 bg-white px-4 py-3"
                role="alertdialog"
                aria-labelledby="past-due-cancel-title"
              >
                <p id="past-due-cancel-title" className="text-sm font-semibold text-rose-950">
                  Cancel now and stop charges?
                </p>
                <p className="mt-1 text-xs leading-relaxed text-rose-800">
                  This voids the unpaid invoice and stops retries immediately. You will go back to
                  Free and you will not be charged again.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmPastDueCancel(false)}
                    disabled={cancelling}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Keep trying
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmImmediateCancel()}
                    disabled={cancelling}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-rose-200 bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-60"
                  >
                    {cancelling ? 'Cancelling…' : 'Yes, cancel — no further charges'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!embedded && (
        <div className="mb-6">
          <h2 className={`text-base font-semibold ${pricingPage.heading}`}>Available plans</h2>
          <p className={`mt-1 text-sm ${pricingPage.muted}`}>
            Payments secured by Stripe.
          </p>
        </div>
      )}

      <PlanPicker
        mode="subscription"
        billing={billing}
        loadingPlan={loadingPlan}
        onSelectFree={handleSelectFree}
        onSubscribe={handleSubscribe}
        onUpgrade={handleUpgradeRequest}
        pricingByPlan={pricingByPlan}
        featuresByPlan={featuresByPlan}
        compact={embedded}
      />

      {!embedded && (
        <p className={`mt-8 text-center text-xs ${pricingPage.footer}`}>
          Payments processed securely by Stripe. Cancel anytime to stop future charges.
        </p>
      )}

      <WeeklyUpgradeModal
        open={!!upgradeTarget}
        targetPriceId={upgradeTarget?.priceId ?? null}
        targetLabel={upgradeTarget?.label ?? 'Full Premium'}
        targetPlanId={upgradeTarget?.planId}
        initialPreview={upgradeTarget?.preview ?? null}
        onClose={() => setUpgradeTarget(null)}
        onSuccess={(status) => {
          applyBilling(status);
        }}
      />
    </>
  );
};

export default SubscriptionPlanContent;
