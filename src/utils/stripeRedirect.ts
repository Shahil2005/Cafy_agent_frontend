export type StripeHostedKind = 'checkout' | 'portal';

const HOSTS: Record<StripeHostedKind, string> = {
  checkout: 'checkout.stripe.com',
  portal: 'billing.stripe.com',
};

/** Navigate to Stripe-hosted checkout or billing portal (full-page redirect). */
export function redirectToStripeHostedUrl(url: string, kind: StripeHostedKind): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid Stripe redirect URL');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== HOSTS[kind]) {
    throw new Error('Invalid Stripe redirect URL');
  }

  window.location.assign(parsed.toString());
}
