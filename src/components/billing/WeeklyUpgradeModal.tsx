import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Info, Loader2, ShieldCheck, Sparkles, Tag, X } from 'lucide-react';
import {
  fetchWeeklyUpgradePreview,
  primeBillingStatusCache,
  upgradeFromWeekly,
  WeeklyUpgradeError,
  type BillingStatus,
  type WeeklyUpgradePreview,
} from '../../services/billingService';
import { useBilling } from '../../hooks/useBilling';
import { type PlanId } from '../../utils/planCardUi';
import { isPromoEligibleUpgradeTarget } from '../../data/promoPricingDisplay';

interface WeeklyUpgradeModalProps {
  open: boolean;
  targetPriceId: string | null;
  targetLabel: string;
  targetPlanId?: PlanId;
  /** Prefetched summary — avoids empty→loaded blink when the modal opens. */
  initialPreview?: WeeklyUpgradePreview | null;
  onClose: () => void;
  onSuccess: (billing: BillingStatus) => void;
}

type ModalPhase = 'preview' | 'processing' | 'success';

function isUpgradeConfirmed(billing: BillingStatus | null, targetPlanId?: PlanId): boolean {
  if (!billing) return false;
  if (targetPlanId === 'weekly') {
    return (
      billing.plan === 'jobs_premium' &&
      (billing.billingInterval === 'weekly' || billing.productTier === 'jobs_only')
    );
  }
  if (targetPlanId === 'jobs_monthly') {
    return billing.plan === 'jobs_premium' || billing.productTier === 'jobs_only';
  }
  return billing.isFullPremium === true;
}

function isJobsUpgradeTarget(targetPlanId?: PlanId): boolean {
  return targetPlanId === 'weekly' || targetPlanId === 'jobs_monthly';
}

function creditPlanLabel(sourcePlan?: string | null): string {
  if (sourcePlan === 'part_time') return 'Part-time';
  return 'Jobs Premium';
}

const WeeklyUpgradeModal: React.FC<WeeklyUpgradeModalProps> = ({
  open,
  targetPriceId,
  targetLabel,
  targetPlanId,
  initialPreview = null,
  onClose,
  onSuccess,
}) => {
  const { applyBilling, refresh } = useBilling();
  const panelRef = useRef<HTMLDivElement>(null);
  const loadedPriceRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<WeeklyUpgradePreview | null>(initialPreview);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<ModalPhase>('preview');
  const [error, setError] = useState<string | null>(null);
  const [paymentActionUrl, setPaymentActionUrl] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const jobsTarget = isJobsUpgradeTarget(targetPlanId);
  const isJobsMonthlyUpgrade = targetPlanId === 'jobs_monthly';
  const showPromo = isPromoEligibleUpgradeTarget(targetPlanId);

  const loadPreview = (priceId: string, promoCode: string | null, opts?: { soft?: boolean }) => {
    let cancelled = false;
    setError(null);
    if (!opts?.soft) setLoading(true);
    fetchWeeklyUpgradePreview(priceId, promoCode)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        loadedPriceRef.current = priceId;
        setAppliedPromoCode(data.promoCode);
        setPromoError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (promoCode && e instanceof WeeklyUpgradeError && e.code === 'INVALID_PROMO_CODE') {
          setPromoError(e.message);
        } else {
          setError(e instanceof Error ? e.message : 'Could not load upgrade summary');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setApplyingPromo(false);
        }
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (!open || !targetPriceId) {
      setError(null);
      setPaymentActionUrl(null);
      setPhase('preview');
      setPromoInput('');
      setPromoError(null);
      setApplyingPromo(false);
      // Keep last preview so reopen does not flash empty content.
      return;
    }

    setPhase('preview');
    setError(null);
    setPaymentActionUrl(null);
    setPromoInput('');
    setPromoError(null);

    if (
      initialPreview &&
      initialPreview.targetPriceId === targetPriceId &&
      loadedPriceRef.current !== targetPriceId
    ) {
      setPreview(initialPreview);
      loadedPriceRef.current = targetPriceId;
      setAppliedPromoCode(initialPreview.promoCode);
      setLoading(false);
      return;
    }

    if (loadedPriceRef.current === targetPriceId && preview) {
      setLoading(false);
      return;
    }

    return loadPreview(targetPriceId, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetPriceId, initialPreview]);

  const handleApplyPromo = () => {
    if (!targetPriceId || !promoInput.trim() || applyingPromo || !showPromo) return;
    setApplyingPromo(true);
    setPromoError(null);
    loadPreview(targetPriceId, promoInput.trim(), { soft: true });
  };

  const handleRemovePromo = () => {
    if (!targetPriceId || !showPromo) return;
    setPromoInput('');
    setPromoError(null);
    loadPreview(targetPriceId, null, { soft: true });
  };

  const paymentInFlight = open && phase === 'processing';

  useEffect(() => {
    if (!paymentInFlight) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [paymentInFlight]);

  useEffect(() => {
    if (!paymentInFlight) return;
    const trapUrl = window.location.href;
    window.history.pushState({ weeklyUpgradePayment: true }, '', trapUrl);
    const onPopState = () => {
      const leave = window.confirm(
        'Your payment is still processing. Leaving now may interrupt your upgrade. Leave this page anyway?'
      );
      if (leave) {
        window.history.back();
      } else {
        window.history.pushState({ weeklyUpgradePayment: true }, '', trapUrl);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [paymentInFlight]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'processing') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, phase, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const isScrollable = (el: HTMLElement) => {
      const overflowY = window.getComputedStyle(el).overflowY;
      if (overflowY !== 'auto' && overflowY !== 'scroll') return false;
      return el.scrollHeight > el.clientHeight + 1;
    };

    const canScrollFurther = (el: HTMLElement, deltaY: number) => {
      if (deltaY < 0) return el.scrollTop > 0;
      return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    };

    const preventBackgroundScroll = (event: Event) => {
      const panel = panelRef.current;
      if (!panel || !(event.target instanceof Node) || !panel.contains(event.target)) {
        event.preventDefault();
        return;
      }

      if (!(event instanceof WheelEvent)) {
        if (!isScrollable(panel)) {
          event.preventDefault();
        }
        return;
      }

      let node: HTMLElement | null =
        event.target instanceof HTMLElement ? event.target : panel;
      while (node && panel.contains(node)) {
        if (isScrollable(node) && canScrollFurther(node, event.deltaY)) {
          return;
        }
        if (node === panel) break;
        node = node.parentElement;
      }
      event.preventDefault();
    };

    document.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false });
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.removeEventListener('wheel', preventBackgroundScroll);
      document.removeEventListener('touchmove', preventBackgroundScroll);
    };
  }, [open]);

  const handleConfirm = async () => {
    if (!targetPriceId) return;
    setPhase('processing');
    setError(null);
    setPaymentActionUrl(null);
    try {
      let updated = await upgradeFromWeekly(
        targetPriceId,
        showPromo ? appliedPromoCode : null
      );
      if (!updated || !isUpgradeConfirmed(updated, targetPlanId)) {
        updated = await refresh({ syncStripe: true, force: true });
      }
      if (!updated || !isUpgradeConfirmed(updated, targetPlanId)) {
        setPhase('preview');
        setError(
          'We could not confirm your payment yet. If your card was charged, open Plan & usage in a moment or check Manage billing. Otherwise try again.'
        );
        return;
      }

      const normalized = primeBillingStatusCache(updated);
      applyBilling(normalized);
      loadedPriceRef.current = null;
      setPhase('success');
      window.setTimeout(() => {
        onSuccess(normalized);
        onClose();
        setPhase('preview');
      }, 1800);
    } catch (e) {
      setPhase('preview');
      if (e instanceof WeeklyUpgradeError) {
        setPaymentActionUrl(e.hostedInvoiceUrl);
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'Upgrade could not be completed');
      }
    }
  };

  const sourceLabel = creditPlanLabel(preview?.sourcePlan);
  const creditLine =
    preview && preview.remainingDays > 0
      ? `Credit: unused ${sourceLabel} (${preview.remainingDays} day${preview.remainingDays === 1 ? '' : 's'})`
      : `Credit: unused ${sourceLabel}`;

  const showSummary = phase !== 'success' && phase !== 'processing' && !!preview && !loading;
  const showLoading = phase !== 'success' && phase !== 'processing' && loading && !preview;

  return (
    <AnimatePresence>
      {open && targetPriceId && (
        <motion.div
          className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm overscroll-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weekly-upgrade-title"
          onClick={phase === 'processing' ? undefined : onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="bg-white w-full sm:max-w-md max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 bg-gradient-to-b from-cafy-50/80 to-white shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-cafy-600 mb-1">
                  {jobsTarget ? 'Jobs Premium upgrade' : 'Full Premium upgrade'}
                </p>
                <h2 id="weekly-upgrade-title" className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {targetLabel}
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  Unused time on your current plan is applied as credit to today&apos;s payment.
                </p>
              </div>
              {phase !== 'processing' && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="min-h-[16rem] overflow-y-auto overscroll-contain scrollbar-hide px-4 py-4 sm:px-6 sm:py-5 space-y-4">
              {phase === 'success' && (
                <div className="py-6 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" strokeWidth={2.5} />
                  </div>
                  <p className="text-lg font-bold text-slate-900">Upgrade complete</p>
                  <p className="text-sm text-slate-600 max-w-xs mx-auto leading-relaxed">
                    {jobsTarget
                      ? isJobsMonthlyUpgrade
                        ? 'Jobs Premium Monthly is active. You keep unlimited jobs access, billed monthly.'
                        : 'Jobs Premium Weekly is active. You keep unlimited jobs access.'
                      : 'Full Premium is active. Unlimited AI and Resume Studio, plus 20 autofill credits a day, are unlocked.'}
                  </p>
                </div>
              )}

              {phase === 'processing' && preview && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex gap-3 text-left">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden />
                    <div className="text-sm text-amber-950">
                      <p className="font-bold">Please stay on this page</p>
                      <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                        Do not close this tab, refresh, or use the back button while we confirm your
                        payment with Stripe.
                      </p>
                    </div>
                  </div>
                  <div className="py-6 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-cafy-600 mx-auto" />
                    <p className="text-sm font-semibold text-slate-900">Processing your payment</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Charging your saved card and activating {targetLabel}. This usually takes a few
                      seconds.
                    </p>
                  </div>
                </div>
              )}

              {showLoading && (
                <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading upgrade summary">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="h-10 bg-slate-100" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                      <div className="h-4 bg-slate-100 rounded w-1/2" />
                      <div className="h-5 bg-slate-100 rounded w-2/5 mt-2" />
                    </div>
                  </div>
                  <div className="h-16 rounded-xl bg-slate-100" />
                  <div className="h-14 rounded-xl bg-slate-100" />
                </div>
              )}

              {phase !== 'success' && phase !== 'processing' && error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 space-y-2">
                  <p className="font-medium">{error}</p>
                  <p className="text-xs text-rose-700/90 leading-relaxed">
                    Your current plan stays active. A failed upgrade does not cancel your
                    subscription.
                  </p>
                  {paymentActionUrl && (
                    <a
                      href={paymentActionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block font-semibold text-rose-900 underline underline-offset-2 hover:text-rose-950"
                    >
                      Complete bank verification
                    </a>
                  )}
                </div>
              )}

              {showSummary && (
                <>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Order summary
                      </p>
                    </div>
                    <div className="p-3 sm:p-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-3 items-start">
                        <span className="text-slate-700 min-w-0 break-words">{targetLabel}</span>
                        <span className="font-semibold text-slate-900 tabular-nums text-right shrink-0">
                          {preview.targetAmountDisplay}
                          <span className="font-medium text-slate-500">{preview.targetPeriod}</span>
                        </span>
                      </div>
                      {showPromo && preview.promotionCodeId && preview.discountAppliedDisplay && (
                        <div className="flex justify-between gap-3 items-start text-cafy-700">
                          <span className="text-slate-700 min-w-0 break-words">
                            Promo code <span className="font-semibold">{preview.promoCode}</span>
                          </span>
                          <span className="font-semibold tabular-nums text-right shrink-0">
                            − {preview.discountAppliedDisplay}
                          </span>
                        </div>
                      )}
                      {preview.creditGBP > 0 && (
                        <div className="flex justify-between gap-3 items-start text-emerald-800">
                          <span className="text-slate-700 min-w-0 break-words">{creditLine}</span>
                          <span className="font-semibold tabular-nums text-right shrink-0">− {preview.creditDisplay}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-200 pt-3 flex justify-between gap-3 items-start">
                        <span className="font-bold text-slate-900">Due today</span>
                        <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums text-right shrink-0">
                          {preview.amountDueDisplay}
                        </span>
                      </div>
                    </div>
                  </div>

                  {showPromo && (
                    <div className="rounded-xl border border-slate-200 p-3">
                      {preview.promotionCodeId ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm text-cafy-700 min-w-0">
                            <Tag className="w-4 h-4 shrink-0" />
                            <span className="truncate">
                              <span className="font-semibold">{preview.promoCode}</span> applied
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemovePromo}
                            disabled={applyingPromo || loading}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-60 shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={promoInput}
                              onChange={(e) => setPromoInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleApplyPromo();
                                }
                              }}
                              placeholder="Promo code"
                              disabled={applyingPromo || loading}
                              className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cafy-200 disabled:bg-slate-50"
                            />
                            <button
                              type="button"
                              onClick={handleApplyPromo}
                              disabled={!promoInput.trim() || applyingPromo || loading}
                              className="px-4 py-2 text-sm font-semibold text-cafy-700 border border-cafy-200 rounded-lg hover:bg-cafy-50 disabled:opacity-50 disabled:hover:bg-transparent shrink-0 inline-flex items-center gap-1.5"
                            >
                              {applyingPromo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                            </button>
                          </div>
                          {promoError && (
                            <p className="text-xs text-rose-600 font-medium">{promoError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl border border-cafy-100 bg-cafy-50/60 px-4 py-3 text-sm text-cafy-950">
                    <p>
                      Your saved payment method will be charged{' '}
                      <span className="font-bold">{preview.amountDueDisplay}</span> today.
                    </p>
                    <p className="text-xs text-cafy-800/90 mt-1.5 leading-relaxed">
                      {showPromo && preview.promoDuration === 'forever' ? (
                        <>
                          Then {preview.recurringAmountDisplay}
                          {preview.targetPeriod} for as long as you&apos;re subscribed.
                        </>
                      ) : showPromo &&
                        preview.promoDuration === 'repeating' &&
                        preview.promoDurationInMonths ? (
                        <>
                          Then {preview.recurringAmountDisplay}
                          {preview.targetPeriod} for the next {preview.promoDurationInMonths}{' '}
                          billing cycle{preview.promoDurationInMonths === 1 ? '' : 's'}, then{' '}
                          {preview.targetAmountDisplay}
                          {preview.targetPeriod}.
                        </>
                      ) : (
                        <>
                          Then {preview.targetAmountDisplay}
                          {preview.targetPeriod} on your billing date.
                        </>
                      )}{' '}
                      You can change or cancel anytime in Manage billing.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex gap-3 text-left">
                    <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden />
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-semibold text-slate-800">Tip: </span>
                      If this upgrade payment fails, you stay on your current plan. We fall back
                      automatically and do not cancel your subscription.
                    </p>
                  </div>

                  <ul className="text-xs text-slate-600 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-cafy-500 shrink-0 mt-0.5" />
                      {jobsTarget
                        ? isJobsMonthlyUpgrade
                          ? 'Unlimited jobs board access, billed monthly'
                          : 'Unlimited jobs board access, billed weekly'
                        : 'Unlimited cover letters, AI analysis and Resume Studio, plus 20 autofill credits a day'}
                    </li>
                    <li className="flex items-start gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-cafy-500 shrink-0 mt-0.5" />
                      Secure payment processed by Stripe
                    </li>
                  </ul>
                </>
              )}
            </div>

            {phase === 'preview' && (
              <div className="shrink-0 border-t border-slate-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4 sm:pb-5 flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 min-w-0 py-2.5 sm:py-3 px-3 sm:px-4 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 text-sm sm:text-base"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!preview || loading}
                  className="flex-1 min-w-0 py-2.5 sm:py-3 px-3 sm:px-4 bg-cafy-600 text-white rounded-xl font-semibold hover:bg-cafy-700 disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm text-sm sm:text-base"
                >
                  {preview ? `Pay ${preview.amountDueDisplay}` : 'Continue'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WeeklyUpgradeModal;
