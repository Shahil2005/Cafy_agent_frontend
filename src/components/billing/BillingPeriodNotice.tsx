import React from 'react';
import { CalendarClock, CalendarX } from 'lucide-react';

function formatPeriodEnd(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface BillingPeriodNoticeProps {
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  pastDue?: boolean;
  planLabel?: string;
  tone?: 'full' | 'jobs' | 'neutral';
  className?: string;
}

const BillingPeriodNotice: React.FC<BillingPeriodNoticeProps> = ({
  currentPeriodEnd,
  cancelAtPeriodEnd,
  pastDue = false,
  planLabel,
  tone = 'full',
  className = '',
}) => {
  const dateLabel = currentPeriodEnd ? formatPeriodEnd(currentPeriodEnd) : null;
  const neutral = tone === 'neutral';
  const planName = planLabel?.trim() || 'this plan';

  if (pastDue) {
    return (
      <div
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
          neutral
            ? 'border-slate-200 bg-white text-slate-800'
            : 'border-rose-200 bg-rose-50 text-rose-950'
        } ${className}`}
        role="status"
      >
        <CalendarX
          className={`w-4 h-4 shrink-0 mt-0.5 ${neutral ? 'text-slate-500' : 'text-rose-700'}`}
          aria-hidden
        />
        <div>
          <p className="font-medium leading-snug">You are past due on {planName}</p>
          <p className={`text-xs mt-1 leading-relaxed ${neutral ? 'text-slate-500' : 'text-rose-800'}`}>
            The last payment failed, so you do not have paid access right now. We will keep retrying
            the charge on your card. Update your card to keep this plan, or cancel now to stop
            retries — you will not be charged again.
          </p>
        </div>
      </div>
    );
  }

  if (cancelAtPeriodEnd) {
    return (
      <div
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
          neutral
            ? 'border-slate-200 bg-white text-slate-800'
            : 'border-amber-300 bg-amber-50 text-amber-950'
        } ${className}`}
        role="status"
      >
        <CalendarX
          className={`w-4 h-4 shrink-0 mt-0.5 ${neutral ? 'text-slate-500' : 'text-amber-700'}`}
          aria-hidden
        />
        <div>
          <p className="font-medium leading-snug">
            {dateLabel ? `Access ends ${dateLabel}` : 'Your plan is cancelled'}
          </p>
          <p className={`text-xs mt-1 leading-relaxed ${neutral ? 'text-slate-500' : 'text-amber-800'}`}>
            {dateLabel
              ? `Your paid plan stays active until this date. You will not be charged again. After that you move to Free.`
              : 'You will not be charged again. When access ends you move to Free.'}{' '}
            Reactivate in Manage billing if you want to keep the plan.
          </p>
        </div>
      </div>
    );
  }

  const isJobs = tone === 'jobs';
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
        neutral
          ? 'border-slate-200 bg-white text-slate-800'
          : isJobs
            ? 'border-teal-300 bg-teal-50 text-teal-950'
            : 'border-cafy-300 bg-cafy-50 text-cafy-950'
      } ${className}`}
      role="status"
    >
      <CalendarClock
        className={`w-4 h-4 shrink-0 mt-0.5 ${
          neutral ? 'text-slate-500' : isJobs ? 'text-teal-700' : 'text-cafy-700'
        }`}
        aria-hidden
      />
      <div>
        <p className="font-medium leading-snug">{dateLabel ? `Renews on ${dateLabel}` : 'Renews automatically'}</p>
        <p
          className={`text-xs mt-1 leading-relaxed ${
            neutral ? 'text-slate-500' : isJobs ? 'text-teal-800' : 'text-cafy-800'
          }`}
        >
          {dateLabel
            ? 'We’ll charge your saved card on this date. If that payment fails, we’ll keep retrying until it works or you cancel. If you cancel, you keep access until this date and you won’t be charged again.'
            : 'We’ll charge your saved card at each renewal. If a payment fails, we’ll keep retrying until it works or you cancel.'}
        </p>
      </div>
    </div>
  );
};

export default BillingPeriodNotice;
