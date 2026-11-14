import { useBillingContext } from '../context/BillingContext';

export { getPlanLabel } from '../utils/planCardUi';

/** Shared billing state — requires BillingProvider ancestor. */
export function useBilling(_autoRefreshMs?: number) {
  return useBillingContext();
}
