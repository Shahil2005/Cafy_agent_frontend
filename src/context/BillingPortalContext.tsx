import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createBillingPortal } from '../services/billingService';
import BillingPortalOverlay from '../components/billing/BillingPortalOverlay';

export type BillingPortalFlow = 'cancel' | 'update_card';

interface BillingPortalContextValue {
  opening: boolean;
  error: string | null;
  openPortal: (options?: { flow?: BillingPortalFlow; retry?: boolean }) => Promise<void>;
  dismissError: () => void;
}

const BillingPortalContext = createContext<BillingPortalContextValue | null>(null);

export function BillingPortalProvider({ children }: { children: React.ReactNode }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<'cancel' | 'update_card' | 'manage'>('manage');
  const lastFlowRef = useRef<BillingPortalFlow | undefined>(undefined);

  const openPortal = useCallback(async (options?: { flow?: BillingPortalFlow; retry?: boolean }) => {
    if (opening) return;
    const flow = options?.retry ? lastFlowRef.current : options?.flow;
    lastFlowRef.current = flow;
    setIntent(flow === 'cancel' ? 'cancel' : flow === 'update_card' ? 'update_card' : 'manage');
    setOpening(true);
    setError(null);
    try {
      await createBillingPortal(flow ? { flow } : undefined);
    } catch (e) {
      setOpening(false);
      setError(
        e instanceof Error ? e.message : 'Could not open billing portal. Please try again.',
      );
    }
  }, [opening]);

  const dismissError = useCallback(() => setError(null), []);
  const retryPortal = useCallback(() => {
    void openPortal({ retry: true });
  }, [openPortal]);

  const value = useMemo(
    () => ({ opening, error, openPortal, dismissError }),
    [opening, error, openPortal, dismissError],
  );

  return (
    <BillingPortalContext.Provider value={value}>
      {children}
      <BillingPortalOverlay
        opening={opening}
        error={error}
        intent={intent}
        onDismissError={dismissError}
        onRetry={retryPortal}
      />
    </BillingPortalContext.Provider>
  );
}

export function useBillingPortal(): BillingPortalContextValue {
  const ctx = useContext(BillingPortalContext);
  if (!ctx) {
    throw new Error('useBillingPortal must be used within BillingPortalProvider');
  }
  return ctx;
}
