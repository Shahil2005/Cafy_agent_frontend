import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PlanUsageModal from '../components/profile/PlanUsageModal';
import AiLimitModal, { type AiLimitModalView } from '../components/billing/AiLimitModal';
import { useBillingContext } from './BillingContext';
import { captureProductEvent } from '../lib/observability/posthog';
import { ProductEvents } from '../lib/observability/events';

interface PlanUsageModalContextValue {
  open: boolean;
  openPlanUsageModal: () => void;
  closePlanUsageModal: () => void;
  showCommUsageUpdated: (used: number, limit: number, remaining: number) => void;
  showCommLimitReached: (limit?: number) => void;
  closeAiLimitModal: () => void;
  checkCommBeforeUse: () => boolean;
  notifyCommSuccess: () => Promise<void>;
  handleCommLimitError: (errorCode?: string | null) => boolean;
}

const PlanUsageModalContext = createContext<PlanUsageModalContextValue | null>(null);

export function PlanUsageModalProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { billing, isFullPremium, refresh } = useBillingContext();
  const [open, setOpen] = useState(false);
  const [aiLimitView, setAiLimitView] = useState<AiLimitModalView>({ kind: 'closed' });

  const openPlanUsageModal = useCallback(() => {
    setOpen(true);
  }, []);

  const closePlanUsageModal = useCallback(() => {
    setOpen(false);
  }, []);

  const closeAiLimitModal = useCallback(() => {
    setAiLimitView({ kind: 'closed' });
  }, []);

  const showCommUsageUpdated = useCallback((used: number, limit: number, remaining: number) => {
    setAiLimitView({ kind: 'usage-updated', used, limit, remaining });
  }, []);

  const showCommLimitReached = useCallback((limit?: number) => {
    captureProductEvent(ProductEvents.BILLING_LIMIT_HIT, { meter: 'comm', limit: limit ?? null });
    setAiLimitView({ kind: 'limit-reached', limit });
  }, []);

  const checkCommBeforeUse = useCallback(() => {
    if (!billing || isFullPremium) return true;
    const limit = billing.commLimit ?? 5;
    const remaining = billing.commRemaining ?? Math.max(0, limit - (billing.commUsed ?? 0));
    if (remaining <= 0) {
      showCommLimitReached(limit);
      return false;
    }
    return true;
  }, [billing, isFullPremium, showCommLimitReached]);

  const notifyCommSuccess = useCallback(async () => {
    const updated = await refresh({ force: true });
    if (!updated || updated.isFullPremium) return;
    const limit = updated.commLimit ?? 5;
    const used = updated.commUsed ?? 0;
    const remaining =
      updated.commRemaining ?? Math.max(0, limit - used);
    showCommUsageUpdated(used, limit, remaining);
  }, [refresh, showCommUsageUpdated]);

  const handleCommLimitError = useCallback(
    (errorCode?: string | null) => {
      if (errorCode !== 'COMM_LIMIT_REACHED') return false;
      showCommLimitReached(billing?.commLimit ?? 5);
      return true;
    },
    [billing?.commLimit, showCommLimitReached]
  );

  useEffect(() => {
    const hash = location.hash;
    if (hash === '#billing-plan') {
      openPlanUsageModal();
      if (window.history.replaceState) {
        window.history.replaceState(null, '', location.pathname);
      }
      return;
    }

    if (hash === '#billing-plans') {
      navigate('/subscription', { replace: true, state: { from: location.pathname } });
      if (window.history.replaceState) {
        window.history.replaceState(null, '', location.pathname);
      }
    }
  }, [location.hash, location.pathname, navigate, openPlanUsageModal]);

  const value = useMemo(
    () => ({
      open,
      openPlanUsageModal,
      closePlanUsageModal,
      showCommUsageUpdated,
      showCommLimitReached,
      closeAiLimitModal,
      checkCommBeforeUse,
      notifyCommSuccess,
      handleCommLimitError,
    }),
    [
      open,
      openPlanUsageModal,
      closePlanUsageModal,
      showCommUsageUpdated,
      showCommLimitReached,
      closeAiLimitModal,
      checkCommBeforeUse,
      notifyCommSuccess,
      handleCommLimitError,
    ],
  );

  return (
    <PlanUsageModalContext.Provider value={value}>
      {children}
      <PlanUsageModal open={open} onClose={closePlanUsageModal} />
      <AiLimitModal view={aiLimitView} onClose={closeAiLimitModal} />
    </PlanUsageModalContext.Provider>
  );
}

export function usePlanUsageModal(): PlanUsageModalContextValue {
  const ctx = useContext(PlanUsageModalContext);
  if (!ctx) {
    throw new Error('usePlanUsageModal must be used within PlanUsageModalProvider');
  }
  return ctx;
}
