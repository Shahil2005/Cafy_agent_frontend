import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Sparkles, X } from 'lucide-react';
import { useBillingContext } from '../../context/BillingContext';

export type AiLimitModalView =
  | { kind: 'closed' }
  | { kind: 'usage-updated'; used: number; limit: number; remaining: number }
  | { kind: 'limit-reached'; limit?: number };

type LimitTier = 'free' | 'jobs';

interface AiLimitModalProps {
  view: AiLimitModalView;
  onClose: () => void;
}

function limitTitle(tier: LimitTier): string {
  if (tier === 'jobs') return 'Generation limit reached on Jobs Premium';
  return 'Free generation limit reached';
}

function upgradeCtaLabel(tier: LimitTier): string {
  return tier === 'jobs' ? 'Upgrade to Full Premium' : 'View plans';
}

const AiLimitModal: React.FC<AiLimitModalProps> = ({ view, onClose }) => {
  const navigate = useNavigate();
  const { isFullPremium, isJobsPremium } = useBillingContext();
  const open = view.kind !== 'closed';
  const tier: LimitTier = isJobsPremium && !isFullPremium ? 'jobs' : 'free';

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleViewPlans = () => {
    onClose();
    navigate('/subscription', { state: { from: '/commcenter' } });
  };

  if (isFullPremium) {
    return null;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-limit-modal-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    view.kind === 'limit-reached' ? 'bg-rose-50' : 'bg-amber-50'
                  }`}
                >
                  {view.kind === 'limit-reached' ? (
                    <AlertCircle className="h-5 w-5 text-rose-600" aria-hidden />
                  ) : (
                    <Sparkles className="h-5 w-5 text-amber-600" aria-hidden />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 id="ai-limit-modal-title" className="text-base font-bold text-slate-900">
                    {view.kind === 'limit-reached'
                      ? limitTitle(tier)
                      : 'Generation usage updated'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                    {view.kind === 'limit-reached' ? (
                      <LimitReachedBody view={view} tier={tier} />
                    ) : (
                      <UsageUpdatedBody view={view} tier={tier} />
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4 bg-slate-50/80">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
              >
                {view.kind === 'limit-reached' ? 'Not now' : 'Got it'}
              </button>
              <button
                type="button"
                onClick={handleViewPlans}
                className={`w-full sm:w-auto px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-colors ${
                  tier === 'jobs'
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'bg-cafy-600 hover:bg-cafy-700'
                }`}
              >
                {upgradeCtaLabel(tier)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function LimitReachedBody({
  view,
  tier,
}: {
  view: Extract<AiLimitModalView, { kind: 'limit-reached' }>;
  tier: LimitTier;
}) {
  if (tier === 'jobs') {
    return (
      <>
        You have used all{' '}
        {view.limit != null ? (
          <span className="font-semibold text-slate-800">{view.limit}</span>
        ) : (
          'included'
        )}{' '}
        cover letters and emails included with Jobs Premium. AI communications stay on the same
        limits as Free until you upgrade to Full Premium for unlimited access.
      </>
    );
  }

  return (
    <>
      You have used all{' '}
      {view.limit != null ? (
        <span className="font-semibold text-slate-800">{view.limit}</span>
      ) : (
        'included'
      )}{' '}
      free cover letters and emails on your Free plan. Upgrade to Premium for unlimited access while
      your subscription is active.
    </>
  );
}

function UsageUpdatedBody({
  view,
  tier,
}: {
  view: Extract<AiLimitModalView, { kind: 'usage-updated' }>;
  tier: LimitTier;
}) {
  const planPhrase = tier === 'jobs' ? 'your Jobs Premium plan' : 'your Free plan';

  return (
    <>
      You have used{' '}
      <span className="font-semibold text-slate-800">
        {view.used} of {view.limit}
      </span>{' '}
      cover letters &amp; emails on {planPhrase}.
      {view.remaining > 0 ? (
        <>
          {' '}
          <span className="font-semibold text-amber-700">{view.remaining} remaining.</span>
        </>
      ) : tier === 'jobs' ? (
        <> Upgrade to Full Premium for unlimited cover letters and emails.</>
      ) : (
        <> Upgrade to Premium to keep generating.</>
      )}
    </>
  );
}

export default AiLimitModal;
