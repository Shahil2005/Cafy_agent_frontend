const STORAGE_KEY = 'cafy_promo_code';
const STORED_AT_KEY = 'cafy_promo_code_at';
/** Keep ad-attributed codes long enough to finish signup + onboarding. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CODE_LENGTH = 64;
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

function normalizePromoCode(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const code = raw.trim();
  if (!code || code.length > MAX_CODE_LENGTH || !CODE_PATTERN.test(code)) {
    return null;
  }
  return code;
}

function isExpired(storedAtRaw: string | null): boolean {
  if (!storedAtRaw) return true;
  const storedAt = Number(storedAtRaw);
  if (!Number.isFinite(storedAt)) return true;
  return Date.now() - storedAt > TTL_MS;
}

/** Read `?promo=` from the current URL and persist it for the signup → plan funnel. */
export function capturePromoFromUrl(search?: string): string | null {
  try {
    const params = new URLSearchParams(
      search ?? (typeof window !== 'undefined' ? window.location.search : '')
    );
    const code = normalizePromoCode(params.get('promo'));
    if (!code) return getStoredPromoCode();

    localStorage.setItem(STORAGE_KEY, code);
    localStorage.setItem(STORED_AT_KEY, String(Date.now()));
    return code;
  } catch {
    return null;
  }
}

export function getStoredPromoCode(): string | null {
  try {
    const code = normalizePromoCode(localStorage.getItem(STORAGE_KEY));
    if (!code) return null;
    if (isExpired(localStorage.getItem(STORED_AT_KEY))) {
      clearStoredPromoCode();
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearStoredPromoCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORED_AT_KEY);
  } catch {
    // ignore storage failures
  }
}
