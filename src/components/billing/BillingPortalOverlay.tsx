import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ExternalLink, Loader2, X } from 'lucide-react';

interface BillingPortalOverlayProps {
  opening: boolean;
  error: string | null;
  intent?: 'cancel' | 'update_card' | 'manage';
  onDismissError: () => void;
  onRetry?: () => void;
}

function getPortalRoot(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('document is not available');
  }
  return document.getElementById('modal-root') ?? document.body;
}

const BillingPortalOverlay: React.FC<BillingPortalOverlayProps> = ({
  opening,
  error,
  intent = 'manage',
  onDismissError,
  onRetry,
}) => {
  const [mounted, setMounted] = useState(false);
  const visible = opening || Boolean(error);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && error) onDismissError();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, error, onDismissError]);

  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="billing-portal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9990] touch-none"
          role="presentation"
        >
        <div
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-[4px]"
          aria-hidden
        />
        <div
          className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
          role="alertdialog"
          aria-modal="true"
          aria-busy={opening}
          aria-labelledby={error ? 'billing-portal-error-title' : 'billing-portal-loading-title'}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {opening && !error && (
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-cafy-50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-cafy-600 animate-spin" aria-hidden />
                </div>
                <div>
                  <p id="billing-portal-loading-title" className="text-base font-bold text-slate-900">
                    {intent === 'cancel'
                      ? 'Opening Stripe to cancel'
                      : intent === 'update_card'
                        ? 'Opening Stripe to update your card'
                        : 'Opening billing portal'}
                  </p>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    {intent === 'cancel'
                      ? 'You’ll confirm cancellation on Stripe’s secure page. Access continues until the end of the current period, then you will not be charged again.'
                      : intent === 'update_card'
                        ? 'You’ll add a new card on Stripe’s secure page. If a payment failed, we will retry the charge after you save. Failed payments keep retrying until you update your card or cancel.'
                        : 'Connecting to Stripe so you can update your card, invoices, or subscription.'}
                  </p>
                  <p className="text-xs text-slate-400 mt-3">This usually takes a few seconds.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-rose-100 shrink-0">
                    <AlertCircle className="w-5 h-5 text-rose-600" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p id="billing-portal-error-title" className="text-base font-bold text-slate-900">
                      Could not open billing portal
                    </p>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onDismissError}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onDismissError}
                    className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={() => {
                        onDismissError();
                        onRetry();
                      }}
                      className="flex-1 py-2.5 px-4 bg-cafy-600 text-white rounded-xl text-sm font-semibold hover:bg-cafy-700 inline-flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Try again
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
      ) : null}
    </AnimatePresence>,
    getPortalRoot(),
  );
};

export default BillingPortalOverlay;
