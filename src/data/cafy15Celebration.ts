export const CAFY15_PROMO_CODE = 'CAFY15';

/** End of 30 Sep 2026 in UK time (BST). */
export const CAFY15_OFFER_ENDS_AT_MS = Date.parse('2026-09-30T23:59:59+01:00');

export type OfferCountdown = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function getOfferCountdown(nowMs = Date.now()): OfferCountdown | null {
  if (!Number.isFinite(CAFY15_OFFER_ENDS_AT_MS)) return null;
  const totalMs = CAFY15_OFFER_ENDS_AT_MS - nowMs;
  if (totalMs <= 0) return null;
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function padOfferUnit(value: number): string {
  return String(value).padStart(2, '0');
}

const FIRST_LOOK_STORAGE_PREFIX = 'cafy.10k.celebration.seen.';

function playedUserIds(): Set<string> {
  const w = window as Window & { __cafy10kCrackers?: Set<string> };
  if (!w.__cafy10kCrackers) w.__cafy10kCrackers = new Set();
  return w.__cafy10kCrackers;
}

/** True only the first time this user should see the 10k cracker burst. */
export function consumeMilestoneCrackerPlay(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  const played = playedUserIds();
  if (played.has(userId)) return false;
  try {
    if (window.localStorage.getItem(`${FIRST_LOOK_STORAGE_PREFIX}${userId}`)) {
      played.add(userId);
      return false;
    }
    window.localStorage.setItem(`${FIRST_LOOK_STORAGE_PREFIX}${userId}`, '1');
  } catch {
    /* private mode still plays once this session via the in-memory set */
  }
  played.add(userId);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}
