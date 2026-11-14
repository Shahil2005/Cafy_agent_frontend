import { auth } from '../../services/firebase';
import { getBackendUrl } from '../../services/apiConfig';

/**
 * Google Analytics conversions (sign_up, activation; purchase is sent by the backend from
 * Stripe). This app does not load Google Analytics. The marketing site (www.cafy.careers)
 * does, and GA4 keeps its visitor id in cookies on the parent domain, .cafy.careers, which
 * this app can read. We send those ids to the backend, which reports the event to GA4 for
 * the same visitor, so GA4 can tell which page, search or ad led to a sign-up or purchase.
 *
 * The cookies only exist when the visitor accepted analytics cookies on the marketing site.
 * Without them nothing is sent. See ProductBackend/analytics/ga4.ts.
 */

// GA4 measurement id G-LJJB4G099Y; its session cookie is named _ga_<id without "G-">.
const GA_SESSION_COOKIE = '_ga_LJJB4G099Y';

export interface GaLink {
  clientId: string;
  sessionId: string | null;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
}

/** GA visitor and session ids from the marketing site's cookies, or null without consent. */
export function readGaLink(): GaLink | null {
  // _ga = "GA1.1.<random>.<first visit timestamp>"; the client id is the last two parts.
  const clientId = readCookie('_ga')?.match(/^GA\d\.\d\.(\d+\.\d+)$/)?.[1];
  if (!clientId) return null;
  // Session cookie: "GS1.1.<session id>.<count>..." (older) or "GS2.1.s<session id>$o<count>..." (newer).
  const session = readCookie(GA_SESSION_COOKIE);
  const sessionId = session?.match(/^GS1\.\d\.(\d+)\./)?.[1] ?? session?.match(/^GS2\.\d\.s(\d+)/)?.[1] ?? null;
  return { clientId, sessionId };
}

type GaAppEvent =
  | { event: 'link' }
  | { event: 'sign_up'; method: 'email' | 'google' }
  | { event: 'activation'; activationType: 'job_saved' | 'cv_uploaded' };

/** Sends a conversion to the backend for GA4. Never throws and never blocks the UI. */
export async function sendGaAppEvent(payload: GaAppEvent): Promise<void> {
  try {
    const ga = readGaLink();
    const user = auth.currentUser;
    if (!ga || !user) return;
    const token = await user.getIdToken();
    await fetch(`${getBackendUrl()}/api/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, ga }),
      keepalive: true,
    });
  } catch {
    // Analytics must never affect the product.
  }
}

/** Activation is "first job saved or first CV uploaded": report it once per browser, the backend dedupes per user. */
export function sendGaActivation(activationType: 'job_saved' | 'cv_uploaded'): void {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const key = `cafy_ga_activation_${uid}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch {
    // storage unavailable: the backend still dedupes
  }
  void sendGaAppEvent({ event: 'activation', activationType });
}
