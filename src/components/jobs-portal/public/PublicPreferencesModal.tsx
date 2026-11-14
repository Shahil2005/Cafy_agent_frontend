import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import PublicPreferencesForm from './PublicPreferencesForm';
import type { AnonJobPreferences } from './publicJobsStorage';

export default function PublicPreferencesModal({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: AnonJobPreferences | null;
  onClose: () => void;
  onSubmit: (prefs: AnonJobPreferences) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="public-preferences-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-[min(92vh,720px)] w-full flex-col overflow-hidden border border-slate-200 bg-white sm:max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 bg-[#f6f1e4] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 id="public-preferences-title" className="text-[15px] font-semibold text-slate-900">
                    Your preferences
                  </h2>
                  <p className="mt-1 text-sm leading-snug text-slate-600">
                    Tell us what you&apos;re looking for and we&apos;ll show the best matching jobs at sponsor-licensed companies first.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 p-1 text-slate-500 hover:text-slate-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <PublicPreferencesForm initial={initial} onSubmit={onSubmit} onCancel={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
