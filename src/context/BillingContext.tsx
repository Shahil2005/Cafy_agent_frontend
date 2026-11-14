import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  fetchBillingStatus,
  fetchPlanCatalog,
  getCachedBillingStatus,
  primeBillingStatusCache,
  type BillingStatus,
} from '../services/billingService';
import {
  FALLBACK_PLAN_FEATURES,
  FALLBACK_PLAN_PRICING,
  mapCatalogToPlanFeatures,
  mapCatalogToPlanPricing,
  type PlanFeatureMap,
  type PlanPricingMap,
} from '../data/planCatalog';
import { getPlanLabel } from '../utils/planCardUi';

export interface BillingRefreshOptions {
  syncStripe?: boolean;
  force?: boolean;
}

interface BillingContextValue {
  billing: BillingStatus | null;
  loading: boolean;
  error: string | null;
  refresh: (options?: BillingRefreshOptions) => Promise<BillingStatus | null>;
  /** Instantly update UI from a known billing payload (e.g. post-upgrade). */
  applyBilling: (status: BillingStatus) => void;
  pricingByPlan: PlanPricingMap;
  featuresByPlan: PlanFeatureMap;
  planLabel: string;
  /** Full Premium — unlimited AI (backward compat). */
  isPremium: boolean;
  isFullPremium: boolean;
  isJobsPremium: boolean;
  isPartTimePremium: boolean;
  productTier: 'free' | 'part_time' | 'jobs_only' | 'full';
}

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({
  children,
  autoRefreshMs,
}: {
  children: React.ReactNode;
  autoRefreshMs?: number;
}) {
  const [billing, setBilling] = useState<BillingStatus | null>(() => getCachedBillingStatus());
  const [pricingByPlan, setPricingByPlan] = useState<PlanPricingMap>(FALLBACK_PLAN_PRICING);
  const [featuresByPlan, setFeaturesByPlan] = useState<PlanFeatureMap>(FALLBACK_PLAN_FEATURES);
  const [loading, setLoading] = useState(() => getCachedBillingStatus() === null);
  const [error, setError] = useState<string | null>(null);
  const billingRef = useRef(billing);
  billingRef.current = billing;

  const loadPlanCatalog = useCallback(() => {
    return fetchPlanCatalog().then((plans) => {
      if (plans?.length) {
        setPricingByPlan(mapCatalogToPlanPricing(plans));
        setFeaturesByPlan(mapCatalogToPlanFeatures(plans));
      }
      return plans;
    });
  }, []);

  useEffect(() => {
    void loadPlanCatalog();
  }, [loadPlanCatalog]);

  const refresh = useCallback(async (options?: BillingRefreshOptions) => {
    const hasBilling = billingRef.current !== null || getCachedBillingStatus() !== null;
    if (!hasBilling) setLoading(true);
    try {
      setError(null);
      void loadPlanCatalog();
      const status = await fetchBillingStatus({
        syncStripe: options?.syncStripe,
        force: options?.force,
      });
      setBilling(status);
      return status;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plan');
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadPlanCatalog]);

  const applyBilling = useCallback((status: BillingStatus) => {
    const normalized = primeBillingStatusCache(status);
    setBilling(normalized);
  }, []);

  useEffect(() => {
    void refresh(getCachedBillingStatus() ? undefined : { force: true });
    if (!autoRefreshMs) return;

    const id = setInterval(() => {
      // Skip background-tab polling — refresh on visibility instead.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refresh();
    }, autoRefreshMs);

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const cached = getCachedBillingStatus();
      // Refresh when returning to the tab if cache is empty/stale (>60s).
      if (!cached) {
        void refresh({ force: true });
        return;
      }
      void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, autoRefreshMs]);

  const value = useMemo(
    () => ({
      billing,
      loading,
      error,
      refresh,
      applyBilling,
      pricingByPlan,
      featuresByPlan,
      planLabel: getPlanLabel(billing, pricingByPlan),
      isPremium: billing?.isFullPremium ?? billing?.isPremium ?? false,
      isFullPremium: billing?.isFullPremium ?? billing?.isPremium ?? false,
      isJobsPremium: billing?.isJobsPremium ?? false,
      isPartTimePremium: billing?.isPartTimePremium ?? false,
      productTier: billing?.productTier ?? 'free',
    }),
    [billing, loading, error, refresh, applyBilling, pricingByPlan, featuresByPlan]
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBillingContext(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) {
    throw new Error('useBillingContext must be used within BillingProvider');
  }
  return ctx;
}
