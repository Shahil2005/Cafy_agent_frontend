import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import {
  completePlanSelectionAfterPremium,
  fetchBillingStatus,
  type BillingStatus,
} from '../services/billingService';
import { useAuth } from '../hooks/useAuth';
import { TOUR_PENDING_SESSION_KEY } from '../services/tourService';
import { clearStoredPromoCode } from '../utils/promoCodeStorage';

function isPaidActivation(billing: BillingStatus | null): boolean {
  if (!billing) return false;
  return (
    billing.isJobsPremium === true ||
    billing.isFullPremium === true ||
    billing.isPartTimePremium === true ||
    billing.isPremium === true
  );
}

const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const fromOnboarding = searchParams.get('onboarding') === '1';
  const [status, setStatus] = useState<'loading' | 'active' | 'timeout'>('loading');
  const [billingResult, setBillingResult] = useState<BillingStatus | null>(null);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20;
    let cancelled = false;

    const poll = async () => {
      const billing = await fetchBillingStatus({ syncStripe: true });
      if (isPaidActivation(billing)) {
        if (fromOnboarding) {
          try {
            await completePlanSelectionAfterPremium();
          } catch (e) {
            console.error('[SubscriptionSuccess] plan selection:', e);
          }
          sessionStorage.setItem(TOUR_PENDING_SESSION_KEY, '1');
        }
        if (!cancelled) {
          clearStoredPromoCode();
          setBillingResult(billing);
          setStatus('active');
          await refreshUser();
        }
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        if (!cancelled) {
          setStatus('timeout');
        }
        return;
      }
      setTimeout(poll, 3000);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId, fromOnboarding, refreshUser]);

  const plansPath = fromOnboarding ? '/onboarding/plan' : '/subscription';
  const isJobsOnly = billingResult?.productTier === 'jobs_only';

  if (status === 'loading') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-slate-50 p-8">
        <Loader2 className="w-12 h-12 text-cafy-600 animate-spin mb-4" />
        <h1 className="text-xl font-bold text-slate-900">Confirming your subscription…</h1>
        <p className="text-slate-500 mt-2 text-center max-w-md">
          We are confirming your payment with Stripe. This usually takes a few seconds. Please keep this page open.
        </p>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-slate-50 p-8">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <h1 className="text-xl font-bold text-slate-900">Still processing</h1>
        <p className="text-slate-500 mt-2 text-center max-w-md">
          Payment received but activation is delayed. Refresh in a minute or check your email from Stripe.
        </p>
        <button
          onClick={() => navigate(plansPath)}
          className="mt-6 px-6 py-3 bg-cafy-600 text-white rounded-xl font-bold"
        >
          Back to plans
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-slate-50 p-8">
      <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
      <h1 className="text-2xl font-black text-slate-900">
        {isJobsOnly ? "You're on Jobs Premium" : "You're on Premium"}
      </h1>
      <p className="text-slate-500 mt-2 text-center max-w-md">
        {isJobsOnly
          ? 'Full access to the jobs board: browse, search, and paginate. Upgrade anytime for unlimited AI analysis and 20 autofill credits a day.'
          : 'Unlimited cover letters and emails while your subscription is active.'}
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate(isJobsOnly ? '/jobs-portal' : '/home')}
          className="px-8 py-3 bg-cafy-600 text-white rounded-xl font-bold hover:bg-cafy-700"
        >
          {isJobsOnly ? 'Browse jobs' : 'Go to app'}
        </button>
        {!fromOnboarding && (
          <button
            onClick={() => navigate('/profile#billing-plan')}
            className="px-8 py-3 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50"
          >
            View plan in profile
          </button>
        )}
      </div>
    </div>
  );
};

export default SubscriptionSuccess;
