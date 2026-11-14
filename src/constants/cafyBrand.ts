/** Shared Cafy product colours for billing & subscription UI. */
export type CafyTier = 'full' | 'jobs' | 'neutral';

export const cafyTier = {
  full: {
    border: 'border-cafy-200',
    borderStrong: 'border-cafy-500',
    bg: 'bg-cafy-50',
    bgGradient: 'bg-gradient-to-br from-cafy-50/90 via-white to-white',
    text: 'text-cafy-700',
    textLabel: 'text-cafy-600',
    iconBg: 'bg-cafy-50 text-cafy-600',
    check: 'text-cafy-500',
    btn: 'bg-cafy-600 text-white hover:bg-cafy-700 border border-cafy-600',
    btnMuted: 'bg-cafy-50 text-cafy-700 border border-cafy-200',
    shadow: 'shadow-sm shadow-cafy-100/60',
    card: 'border-cafy-200/80 bg-white shadow-sm shadow-cafy-100/30',
    cardCurrent:
      'border-cafy-500 bg-gradient-to-b from-cafy-50/50 via-white to-white shadow-md shadow-cafy-100/40 ring-1 ring-cafy-500/20',
    cardRecommended:
      'border-cafy-400 bg-gradient-to-b from-cafy-50/70 via-white to-white shadow-md shadow-cafy-100/50 ring-1 ring-cafy-400/25',
    labelCurrent: 'text-cafy-700',
    labelRecommended: 'text-cafy-600',
  },
  jobs: {
    border: 'border-teal-200',
    borderStrong: 'border-teal-500',
    bg: 'bg-teal-50',
    bgGradient: 'bg-gradient-to-br from-teal-50/90 via-white to-white',
    text: 'text-teal-700',
    textLabel: 'text-teal-600',
    iconBg: 'bg-teal-50 text-teal-600',
    check: 'text-teal-500',
    btn: 'bg-teal-600 text-white hover:bg-teal-700 border border-teal-600',
    btnMuted: 'bg-teal-50 text-teal-700 border border-teal-200',
    shadow: 'shadow-sm shadow-teal-100/60',
    card: 'border-teal-200/80 bg-white shadow-sm shadow-teal-100/30',
    cardCurrent:
      'border-teal-500 bg-gradient-to-b from-teal-50/50 via-white to-white shadow-md shadow-teal-100/40 ring-1 ring-teal-500/20',
    cardRecommended:
      'border-teal-400 bg-gradient-to-b from-teal-50/60 via-white to-white shadow-md shadow-teal-100/40 ring-1 ring-teal-400/20',
    labelCurrent: 'text-teal-700',
    labelRecommended: 'text-teal-600',
  },
  neutral: {
    border: 'border-slate-200',
    borderStrong: 'border-slate-400',
    bg: 'bg-slate-50',
    bgGradient: 'bg-gradient-to-br from-slate-50/90 via-white to-white',
    text: 'text-slate-700',
    textLabel: 'text-slate-500',
    iconBg: 'bg-slate-100 text-slate-600',
    check: 'text-slate-400',
    btn: 'bg-slate-700 text-white hover:bg-slate-800 border border-slate-700',
    btnMuted: 'bg-slate-100 text-slate-500 border border-slate-200',
    shadow: 'shadow-sm',
    card: 'border-slate-200 bg-white shadow-sm',
    cardCurrent:
      'border-slate-400 bg-gradient-to-b from-slate-50/80 via-white to-white shadow-md ring-1 ring-slate-300/30',
    cardRecommended: 'border-slate-300 bg-white shadow-md ring-1 ring-slate-200/50',
    labelCurrent: 'text-slate-600',
    labelRecommended: 'text-slate-500',
  },
} as const;

export function planTier(
  planId: 'free' | 'part_time_weekly' | 'weekly' | 'jobs_monthly' | 'monthly' | 'quarterly'
): CafyTier {
  if (planId === 'part_time_weekly') return 'jobs';
  if (planId === 'weekly' || planId === 'jobs_monthly') return 'jobs';
  if (planId === 'free') return 'neutral';
  return 'full';
}

export function activeBillingTier(isFullPremium: boolean, isJobsOnly: boolean): CafyTier {
  if (isFullPremium) return 'full';
  if (isJobsOnly) return 'jobs';
  return 'neutral';
}
