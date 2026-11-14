import React, { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SubscriptionPlanContent from './SubscriptionPlanContent';
import { pricingPage } from '../../constants/pricingPage';

const BACK_ROUTE_LABELS: Record<string, string> = {
  '/home': 'Home',
  '/profile': 'Profile',
  '/commcenter': 'Cover Letter or Email',
  '/tracker': 'Job tracker',
  '/resume-studio': 'Resume studio',
};

/** Billing is account-level — never send users back to jobs upsell flows. */

function resolveBackNavigation(state: unknown, canceled: boolean): { path: string; label: string } {
  if (canceled) {
    return { path: '/profile', label: 'Profile' };
  }

  const from =
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof (state as { from?: string }).from === 'string'
      ? (state as { from: string }).from
      : null;

  if (
    from &&
    from.startsWith('/') &&
    !from.startsWith('/subscription') &&
    from !== '/jobs-portal' &&
    !from.startsWith('/jobs-portal/') &&
    from !== '/part-time-jobs'
  ) {
    return { path: from, label: BACK_ROUTE_LABELS[from] ?? 'Profile' };
  }

  return { path: '/profile', label: 'Profile' };
}

const SubscriptionPricing: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const canceled = searchParams.get('canceled') === '1';
  const fromPortal = searchParams.get('from') === 'portal';
  const backNav = useMemo(
    () => resolveBackNavigation(location.state, canceled),
    [location.state, canceled]
  );

  return (
    <div className={`w-full min-h-full ${pricingPage.pageBg}`}>
      <header
        className={`sticky top-0 z-20 border-b ${pricingPage.headerBorder} ${pricingPage.headerBg} backdrop-blur-sm`}
      >
        <div className={`${pricingPage.contentMax} mx-auto px-3 sm:px-4 lg:px-6 h-14 flex items-center gap-3 sm:gap-4`}>
          <button
            type="button"
            onClick={() => navigate(backNav.path)}
            className={`inline-flex items-center gap-2 text-sm font-medium ${pricingPage.body} hover:text-slate-900 transition-colors px-2 py-1.5 rounded-md hover:bg-slate-100 shrink-0`}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Back to {backNav.label}</span>
            <span className="sm:hidden">Back</span>
          </button>
          <span className="h-5 w-px bg-slate-200 shrink-0" aria-hidden />
          <div className="flex items-center gap-2 min-w-0">
            <img src="/CAFY-Icon.svg" alt="" aria-hidden className="w-6 h-6 object-contain shrink-0" />
            <span className={`text-base font-semibold tracking-tight ${pricingPage.heading}`}>Cafy</span>
          </div>
        </div>
      </header>

      <main className={`${pricingPage.contentMax} mx-auto px-3 sm:px-4 lg:px-6 py-6 lg:py-8 pb-12`}>
        <div className="mb-8 lg:mb-10 max-w-2xl">
          <p className={`text-xs font-medium uppercase tracking-wide ${pricingPage.eyebrow}`}>
            Subscription
          </p>
          <h1 className={`mt-2 text-2xl sm:text-[1.75rem] font-semibold ${pricingPage.heading} tracking-tight`}>
            Plans & billing
          </h1>
          <p className={`mt-2 text-[15px] leading-relaxed ${pricingPage.body}`}>
            Compare plans and manage your subscription. Paid plans renew automatically. If a payment
            fails, we retry the charge until it succeeds or you cancel. After you cancel, you will
            not be charged again.
          </p>
        </div>

        {fromPortal && (
          <div
            className={`mb-6 rounded-md border px-4 py-3 text-sm ${pricingPage.notice}`}
            role="status"
          >
            Billing details updated. Your plan status below reflects any changes from Stripe.
          </div>
        )}

        <SubscriptionPlanContent showCanceledBanner={canceled} />
      </main>
    </div>
  );
};

export default SubscriptionPricing;
