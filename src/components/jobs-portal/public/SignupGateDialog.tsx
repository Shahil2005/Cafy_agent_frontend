import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X } from 'lucide-react';

export type PublicGateAction = 'apply' | 'report' | 'search' | 'loadMore' | 'location' | 'feature' | 'signup';

export interface GateFeature {
  title: string;
  blurb: string;
}

function gateCopy(action: PublicGateAction, moreLabel: string | null, feature: GateFeature | null) {
  switch (action) {
    case 'location':
      return {
        title: 'Sign up free to filter by location',
        body: 'See part-time jobs in every UK city, including the ones near you.',
      };
    case 'feature':
      return {
        title: feature ? `Sign up free to use ${feature.title}` : 'Create your free account',
        body: feature?.blurb ?? 'Create a free account to use every Cafy tool.',
      };
    case 'apply':
      return {
        title: 'Sign up free to apply',
        body: 'Create a free account to open the application and track it in your job tracker.',
      };
    case 'report':
      return {
        title: 'Sign in to report this job',
        body: 'Reporting helps keep listings accurate. Sign in or create a free account to continue.',
      };
    case 'search':
      return {
        title: 'Sign up free to search all jobs',
        body: 'Search every job by title, company or location.',
      };
    case 'loadMore':
      return {
        title: 'Sign up free to see more jobs',
        body: moreLabel
          ? `${moreLabel} more jobs are waiting for you.`
          : 'Create a free account to keep browsing jobs.',
      };
    default:
      return {
        title: 'Create your free account',
        body: 'Browse every job, search, apply and track your applications in one place.',
      };
  }
}

export default function SignupGateDialog({
  action,
  moreLabel,
  feature = null,
  onSignup,
  onLogin,
  onClose,
}: {
  action: PublicGateAction | null;
  moreLabel: string | null;
  /** Locked tool on the Explore page (title + blurb). */
  feature?: GateFeature | null;
  onSignup: () => void;
  onLogin: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!action) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [action, onClose]);

  const copy = action ? gateCopy(action, moreLabel, feature) : null;

  return (
    <AnimatePresence>
      {action && copy && (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-gate-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full border border-slate-200 bg-white p-6 sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-cafy-50">
                <Lock className="h-5 w-5 text-cafy-700" aria-hidden />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h2 id="signup-gate-title" className="mt-4 text-lg font-semibold text-slate-900">
              {copy.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{copy.body}</p>

            <button
              type="button"
              onClick={onSignup}
              className="mt-6 flex w-full items-center justify-center bg-cafy-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cafy-700"
            >
              Sign up free
            </button>
            <p className="mt-3 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onLogin}
                className="font-semibold text-slate-900 underline underline-offset-2"
              >
                Sign in
              </button>
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Not now
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
