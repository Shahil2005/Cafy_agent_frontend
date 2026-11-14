import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown,
  Zap,
  Check,
  Loader2,
  ExternalLink,
  Sparkles,
  Mail,
  Chrome,
  FileText,
  Infinity,
  ArrowUpRight,
  Compass,
} from 'lucide-react';
import { useBilling } from '../../hooks/useBilling';
import { useBillingPortal } from '../../hooks/useBillingPortal';
import type { ResumeToolMeterStatus } from '../../services/billingService';
import { RESUME_STUDIO_URL } from '../../constants/resumeStudio';
import { getIncludedPlanFeatures } from '../../utils/planCardUi';
import BillingPeriodNotice from '../billing/BillingPeriodNotice';

function meterTone(used: number, limit: number): string {
  if (limit <= 0) return 'bg-cafy-600';
  if (used >= limit) return 'bg-rose-500';
  if (used >= limit - 1) return 'bg-amber-500';
  return 'bg-cafy-600';
}

function UsageMeter({
  label,
  used,
  limit,
  isPremium,
  unlimitedNote,
  resetsDaily,
  resetsMonthlyOn,
}: {
  label: string;
  used: number;
  limit: number;
  isPremium: boolean;
  unlimitedNote?: string;
  /** Premium isn't "Unlimited" here — it's capped per day. Swaps the caption wording only. */
  resetsDaily?: boolean;
  /** Capped per calendar month: the day the next month's allowance starts, e.g. "1 November". */
  resetsMonthlyOn?: string | null;
}) {
  const resetsMonthly = resetsMonthlyOn !== undefined;
  if (isPremium && !resetsDaily && !resetsMonthly) {
    return (
      <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-white border border-slate-100">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-cafy-600">
          <Infinity size={14} />
          Unlimited
          {unlimitedNote && <span className="font-normal text-slate-400 hidden sm:inline">· {unlimitedNote}</span>}
        </span>
      </div>
    );
  }

  const atLimit = used >= limit;
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="py-2.5 px-3 rounded-lg bg-white border border-slate-100 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${atLimit ? 'text-rose-600' : 'text-slate-500'}`}>
          {used}/{limit}
          {resetsDaily && <span className="font-normal text-slate-400"> today</span>}
          {resetsMonthly && <span className="font-normal text-slate-400"> this month</span>}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${meterTone(used, limit)}`} style={{ width: `${pct}%` }} />
      </div>
      {atLimit ? (
        <p className="text-[11px] text-rose-600 font-medium">
          {resetsDaily
            ? 'Limit reached — resets tomorrow'
            : resetsMonthly
              ? `Limit reached${resetsMonthlyOn ? ` — ${limit} more on ${resetsMonthlyOn}` : ' for this month'}`
              : 'Limit reached'}
        </p>
      ) : (
        <p className="text-[11px] text-slate-400">
          {remaining} left{resetsDaily ? ' today' : ''}
          {resetsMonthly ? ` this month${resetsMonthlyOn ? ` · resets ${resetsMonthlyOn}` : ''}` : ''}
        </p>
      )}
    </div>
  );
}

function UsageSection({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200/80 bg-white">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-cafy-50 text-cafy-600 shrink-0">{icon}</div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function formatResumeTier(tier: string): string {
  if (tier === 'premium_quarterly') return 'Premium 3 months';
  if (tier === 'premium_monthly') return 'Premium Monthly';
  return 'Free plan';
}

function resumeMeterLine(label: string, meter: ResumeToolMeterStatus): string {
  if (meter.limit === null) return `${label}: Unlimited`;
  return `${label}: ${meter.used}/${meter.limit}`;
}

function PlanTierBadge({
  isFullPremium,
  isJobsOnly,
  isPastDue,
  planLabel,
  compact,
}: {
  isFullPremium: boolean;
  isJobsOnly: boolean;
  isPastDue?: boolean;
  planLabel?: string;
  compact?: boolean;
}) {
  if (isPastDue) {
    return (
      <span className="text-xs font-bold px-3 py-1 rounded-full border shrink-0 bg-rose-50 text-rose-800 border-rose-100">
        Past due
      </span>
    );
  }

  if (compact) {
    return (
      <span
        className={`text-xs font-bold px-3 py-1 rounded-full border shrink-0 ${
          isFullPremium
            ? 'bg-cafy-50 text-cafy-700 border-cafy-100'
            : isJobsOnly
              ? 'bg-teal-50 text-teal-700 border-teal-100'
              : 'bg-slate-50 text-slate-600 border-slate-200'
        }`}
      >
        {isFullPremium ? 'Premium' : isJobsOnly ? 'Jobs Premium' : 'Free'}
      </span>
    );
  }

  return (
    <span
      className={`text-xs font-bold px-3 py-1 rounded-full border shrink-0 ${
        isFullPremium
          ? 'bg-cafy-50 text-cafy-700 border-cafy-100'
          : isJobsOnly
            ? 'bg-teal-50 text-teal-700 border-teal-100'
            : 'bg-slate-50 text-slate-600 border-slate-200'
      }`}
    >
      {planLabel ??
        (isFullPremium ? 'Premium active' : isJobsOnly ? 'Jobs Premium' : 'Free plan')}
    </span>
  );
}

function PlanActionButtons({
  isFullPremium,
  isJobsOnly,
  isPastDue,
  hasStripeBilling,
  portalOpening,
  onViewPlans,
  onOpenPortal,
}: {
  isFullPremium: boolean;
  isJobsOnly: boolean;
  isPastDue?: boolean;
  hasStripeBilling: boolean;
  portalOpening: boolean;
  onViewPlans: () => void;
  onOpenPortal: () => void;
}) {
  if (isPastDue) {
    return (
      <>
        <button
          type="button"
          onClick={onViewPlans}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cafy-600 text-white rounded-lg text-sm font-semibold hover:bg-cafy-700 shadow-sm transition-all"
        >
          <Sparkles size={16} />
          Update or cancel plan
        </button>
        {hasStripeBilling && (
          <button
            type="button"
            onClick={onOpenPortal}
            disabled={portalOpening}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-all"
          >
            {portalOpening ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
            {portalOpening ? 'Opening portal…' : 'Update card'}
          </button>
        )}
      </>
    );
  }

  if (!isFullPremium && !isJobsOnly) {
    return (
      <>
        <button
          type="button"
          onClick={onViewPlans}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cafy-600 text-white rounded-lg text-sm font-semibold hover:bg-cafy-700 shadow-sm transition-all"
        >
          <Sparkles size={16} />
          View plans & upgrade
        </button>
        {hasStripeBilling && (
          <button
            type="button"
            onClick={onOpenPortal}
            disabled={portalOpening}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-all"
          >
            {portalOpening ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
            {portalOpening ? 'Opening portal…' : 'Manage billing'}
          </button>
        )}
      </>
    );
  }

  if (isJobsOnly && !isFullPremium) {
    return (
      <>
        <button
          type="button"
          onClick={onViewPlans}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 shadow-sm transition-all"
        >
          <Sparkles size={16} />
          Upgrade plan
        </button>
        {hasStripeBilling && (
          <button
            type="button"
            onClick={onOpenPortal}
            disabled={portalOpening}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-all"
          >
            {portalOpening ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
            {portalOpening ? 'Opening portal…' : 'Manage billing'}
          </button>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onViewPlans}
        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition-all"
      >
        <Sparkles size={16} />
        View plans
      </button>
      {hasStripeBilling && (
        <button
          type="button"
          onClick={onOpenPortal}
          disabled={portalOpening}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-all"
        >
          {portalOpening ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
          {portalOpening ? 'Opening portal…' : 'Manage billing'}
        </button>
      )}
    </>
  );
}

const BillingPlanCard: React.FC<{
  embedded?: boolean;
  onViewPlans?: () => void;
}> = ({ embedded = false, onViewPlans }) => {
  const navigate = useNavigate();
  const { billing, loading, planLabel, featuresByPlan } = useBilling();
  const { opening: portalOpening, openPortal } = useBillingPortal();

  const openPlans = () => {
    if (onViewPlans) {
      onViewPlans();
      return;
    }
    navigate('/subscription', { state: { from: '/profile' } });
  };

  if (loading && !billing) {
    return (
      <div className={`${embedded ? '' : 'bg-white rounded-xl shadow-sm border border-slate-200'} overflow-hidden animate-pulse`}>
        <div className={`p-5 ${embedded ? '' : 'border-b border-slate-100'}`}>
          <div className="h-5 bg-slate-200 rounded w-36" />
        </div>
        <div className="p-5 space-y-4">
          <div className="h-24 bg-slate-100 rounded-xl" />
          <div className="h-24 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const isFullPremium = billing?.isFullPremium ?? billing?.isPremium ?? false;
  const isJobsOnly = billing?.productTier === 'jobs_only';
  const isPastDue = billing?.status === 'past_due';
  const hasPaidPlan = isFullPremium || isJobsOnly || isPastDue;
  const commUsed = billing?.commUsed ?? 0;
  const commLimit = billing?.commLimit ?? 5;
  const extCoverUsed = billing?.extCoverLetterUsed ?? 0;
  const extCoverLimit = billing?.extCoverLetterLimit ?? 5;
  const extAnalysisUsed = billing?.extAnalysisUsed ?? 0;
  const extAnalysisLimit = billing?.extAnalysisLimit ?? 5;
  const careerAnalysisUsed = billing?.careerAnalysisUsed ?? 0;
  const careerAnalysisLimit = billing?.careerAnalysisLimit ?? 1;
  const careerAnalysisIsDaily = billing?.careerAnalysisTier === 'daily';
  const careerAnalysisIsUnlimited = billing?.careerAnalysisTier === 'unlimited';
  const resumeTool = billing?.resumeTool;
  const extAnalysisPremium = isFullPremium || billing?.extAnalysisLimit === null;
  // Autofill: free = for the account's lifetime; Full Premium = per day. Shown once the backend
  // reports it (an older backend doesn't).
  const autofillLimit = typeof billing?.autofillLimit === 'number' ? billing.autofillLimit : null;
  const autofillUsed = billing?.autofillUsed ?? 0;
  const autofillDaily = billing?.autofillPeriod === 'day';
  const includedFeatures = getIncludedPlanFeatures(billing, featuresByPlan, {
    includeResume: Boolean(resumeTool),
  });
  const periodTone = isJobsOnly ? 'jobs' : 'full';
  const hasStripeBilling = billing?.provider === 'stripe' && hasPaidPlan;

  const currentPlanPanel = (
    <div
      className={`rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 ${
        embedded ? 'mb-5' : 'mx-5 mt-5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current plan</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{planLabel}</p>
        </div>
        <PlanTierBadge
          isFullPremium={isFullPremium}
          isJobsOnly={isJobsOnly}
          isPastDue={isPastDue}
          compact
        />
      </div>

      {(isPastDue || (hasPaidPlan && billing?.currentPeriodEnd)) && (
        <div className="mt-3">
          <BillingPeriodNotice
            currentPeriodEnd={billing?.currentPeriodEnd}
            cancelAtPeriodEnd={billing?.cancelAtPeriodEnd ?? false}
            pastDue={isPastDue}
            planLabel={planLabel}
            tone={periodTone}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <PlanActionButtons
          isFullPremium={isFullPremium}
          isJobsOnly={isJobsOnly}
          isPastDue={isPastDue}
          hasStripeBilling={hasStripeBilling}
          portalOpening={portalOpening}
          onViewPlans={openPlans}
          onOpenPortal={() => void openPortal(isPastDue ? { flow: 'update_card' } : undefined)}
        />
      </div>
    </div>
  );

  return (
    <>
    <div className={`${embedded ? '' : 'bg-white rounded-xl shadow-sm border border-slate-200'} overflow-hidden`}>
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${hasPaidPlan ? (isFullPremium ? 'bg-cafy-600 text-white' : 'bg-teal-600 text-white') : 'bg-slate-100 text-slate-600'}`}
            >
              {hasPaidPlan ? <Crown size={18} /> : <Zap size={18} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Plan & usage</h2>
              <p className="text-xs text-slate-500 mt-0.5">{planLabel}</p>
            </div>
          </div>
          <PlanTierBadge
            isFullPremium={isFullPremium}
            isJobsOnly={isJobsOnly}
            isPastDue={isPastDue}
            planLabel={planLabel}
          />
        </div>
      )}

      {currentPlanPanel}

      <div className={embedded ? 'space-y-4' : 'p-5 space-y-4'}>
        {/* Usage grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UsageSection
            icon={<Mail size={16} />}
            title="Cover letters & emails"
            subtitle="AI Comm Center"
          >
            {isFullPremium ? (
              <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-white border border-cafy-100">
                <span className="text-sm font-medium text-slate-700">Generations</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-cafy-600">
                  <Infinity size={14} />
                  Unlimited
                </span>
              </div>
            ) : (
              <UsageMeter label="Generations" used={commUsed} limit={commLimit} isPremium={false} />
            )}
          </UsageSection>

          <UsageSection
            icon={<Chrome size={16} />}
            title="Chrome extension"
            subtitle={autofillLimit !== null ? 'Cover letters, job analyses & autofill' : 'Cover letters & job analyses'}
          >
            <UsageMeter
              label="Cover letters"
              used={extCoverUsed}
              limit={extCoverLimit}
              isPremium={isFullPremium}
              unlimitedNote="while subscribed"
            />
            <UsageMeter
              label="Job analyses"
              used={extAnalysisUsed}
              limit={extAnalysisLimit ?? 5}
              isPremium={extAnalysisPremium}
              unlimitedNote="while subscribed"
            />
            {autofillLimit !== null && (
              <UsageMeter
                label={autofillDaily ? 'Autofill credits' : 'Free autofill credits'}
                used={autofillUsed}
                limit={autofillLimit}
                isPremium={isFullPremium}
                resetsDaily={autofillDaily}
              />
            )}
          </UsageSection>

          <UsageSection
            icon={<Compass size={16} />}
            title="Career Path"
            subtitle={
              careerAnalysisIsUnlimited
                ? 'Unlimited access'
                : careerAnalysisIsDaily
                ? 'Resets every day'
                : 'One-time free limit'
            }
          >
            <UsageMeter
              label={careerAnalysisIsDaily ? 'Daily analyses' : 'Free analyses'}
              used={careerAnalysisUsed}
              limit={careerAnalysisLimit}
              isPremium={isFullPremium || careerAnalysisIsUnlimited}
              resetsDaily={careerAnalysisIsDaily}
            />
          </UsageSection>

          {resumeTool && (
            <UsageSection
              icon={<FileText size={16} />}
              title="Resume tool"
              subtitle={formatResumeTier(resumeTool.tier)}
              action={
                <a
                  href={RESUME_STUDIO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-cafy-600 hover:text-cafy-800 shrink-0"
                >
                  Open studio
                  <ArrowUpRight size={12} />
                </a>
              }
            >
              {resumeTool.tier === 'free' ? (
                <>
                  <UsageMeter
                    label="AI uses"
                    used={resumeTool.ai.used}
                    limit={resumeTool.ai.limit ?? 0}
                    isPremium={false}
                  />
                  <UsageMeter
                    label="Imports"
                    used={resumeTool.import.used}
                    limit={resumeTool.import.limit ?? 0}
                    isPremium={false}
                  />
                  <UsageMeter
                    label="PDF downloads"
                    used={resumeTool.pdfDownload.used}
                    limit={resumeTool.pdfDownload.limit ?? 0}
                    isPremium={false}
                  />
                  <p className="text-[11px] text-slate-400 px-1 pt-1">
                    Analyse, optimise & compare share the same AI quota.
                  </p>
                </>
              ) : (
                <div className="py-2.5 px-3 rounded-lg bg-white border border-cafy-100 text-xs text-slate-600 space-y-1">
                  <p>{resumeMeterLine('AI uses', resumeTool.ai)}</p>
                  <p>{resumeMeterLine('Imports', resumeTool.import)}</p>
                  <p>{resumeMeterLine('PDF downloads', resumeTool.pdfDownload)}</p>
                </div>
              )}
            </UsageSection>
          )}

          {/* Plan benefits — fills grid slot or spans when no resume */}
          <div
            className={`rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden ${
              resumeTool ? '' : 'lg:col-span-1'
            }`}
          >
            <div className="px-4 py-3 border-b border-slate-200/80 bg-white">
              <p className="text-sm font-bold text-slate-900">Included in your plan</p>
            </div>
            <ul className="p-4 space-y-2.5">
              {includedFeatures.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default BillingPlanCard;

export const BillingPlanSummary: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { billing, loading, planLabel } = useBilling();
  const isFullPremium = billing?.isFullPremium ?? billing?.isPremium ?? false;
  const isJobsOnly = billing?.productTier === 'jobs_only';
  const isPastDue = billing?.status === 'past_due';
  const hasPaidPlan = isFullPremium || isJobsOnly || isPastDue;

  if (loading && !billing) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-40" />
        <div className="h-4 bg-slate-100 rounded w-56 mt-3" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-cafy-200 hover:shadow-md transition-colors"
    >
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isPastDue
                ? 'bg-rose-600 text-white'
                : hasPaidPlan
                  ? isFullPremium
                    ? 'bg-cafy-600 text-white'
                    : 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {hasPaidPlan ? <Crown size={18} /> : <Zap size={18} />}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Plan & usage</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{planLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isPastDue
                ? 'bg-rose-50 text-rose-800 border-rose-100'
                : isFullPremium
                  ? 'bg-cafy-50 text-cafy-700 border-cafy-100'
                  : isJobsOnly
                    ? 'bg-teal-50 text-teal-700 border-teal-100'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            {isPastDue ? 'Past due' : isFullPremium ? 'Premium' : isJobsOnly ? 'Jobs' : 'Free'}
          </span>
          <ArrowUpRight size={16} className="text-slate-400" />
        </div>
      </div>
    </button>
  );
};
