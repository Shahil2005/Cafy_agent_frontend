import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';

export type DurationMinutes = 30 | 45 | 60;

export type CounsellingSlot = {
  startsAt: string;
  endsAt: string;
};

export type CounsellingConfig = {
  enabled: boolean;
  skipPayment: boolean;
  paymentRequired?: boolean;
  stripeConfigured?: boolean;
  reservationHoldMinutes?: number;
  durations: DurationMinutes[];
  prices: Record<DurationMinutes, { pence: number; label: string }>;
  standardPrices?: Record<DurationMinutes, { pence: number; label: string }>;
  premiumPrices: Record<DurationMinutes, { pence: number; label: string }>;
  minNoticeMinutes: number;
  bookingWindowDays: number;
};

export type CounsellingPublicStatus = {
  enabled: boolean;
  skipPayment?: boolean;
  paymentRequired?: boolean;
  stripeConfigured?: boolean;
  reservationHoldMinutes?: number;
  minNoticeMinutes?: number;
  bookingWindowDays?: number;
};

export type CounsellingReservation = {
  reservationId: string;
  expiresAt: string;
  slotStartsAt: string;
};

export type CounsellingBooking = {
  id: string;
  mentorId: number;
  mentorName: string | null;
  status: string;
  slotStartsAt: string | null;
  slotEndsAt: string | null;
  durationMinutes: number | null;
  meetingUrl: string | null;
  goal: string | null;
  bookedDay: string | null;
  bookedTime: string | null;
  createdAt: string | null;
};

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('NOT_AUTHENTICATED');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(res: Response): Promise<string> {
  const { message } = await parseCounsellingApiError(res);
  return message;
}

export const SLOT_HELD_USER_MESSAGE =
  'This time is temporarily held while another user completes their booking. Please choose a different slot or try again in a few minutes.';

export const SLOT_HOLD_GENERAL_HINT =
  'Some times may be briefly unavailable while another user is checking out. If a slot you want is missing, try another time or refresh the list.';

export class CounsellingRequestError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'CounsellingRequestError';
    this.code = code;
  }
}

export async function parseCounsellingApiError(
  res: Response
): Promise<{ code: string; message: string }> {
  try {
    const json = await res.json();
    const code = typeof json.error === 'string' ? json.error : 'UNKNOWN';
    let message = typeof json.message === 'string' ? json.message : '';
    if (!message && typeof json.error === 'string') {
      message = json.error;
    }
    if (!message) message = 'Request failed';

    if (code === 'SLOT_HELD' || code === 'SLOT_UNAVAILABLE') {
      message = SLOT_HELD_USER_MESSAGE;
    }

    return { code, message };
  } catch {
    return { code: 'UNKNOWN', message: 'Request failed' };
  }
}

async function throwCounsellingError(res: Response): Promise<never> {
  const { code, message } = await parseCounsellingApiError(res);
  throw new CounsellingRequestError(message, code);
}

const CONFIG_CACHE_MS = 60_000;
const AVAILABILITY_CACHE_MS = 45_000;

let configCache: { at: number; data: CounsellingConfig } | null = null;
const availabilityCache = new Map<string, { at: number; data: CounsellingSlot[] }>();

function availabilityCacheKey(mentorId: number, durationMinutes: DurationMinutes): string {
  return `${mentorId}:${durationMinutes}`;
}

export function invalidateCounsellingAvailability(
  mentorId: number,
  durationMinutes?: DurationMinutes
): void {
  if (durationMinutes != null) {
    availabilityCache.delete(availabilityCacheKey(mentorId, durationMinutes));
    return;
  }
  for (const key of availabilityCache.keys()) {
    if (key.startsWith(`${mentorId}:`)) {
      availabilityCache.delete(key);
    }
  }
}

/** Warm config while the user browses mentors — safe to call without awaiting. */
export function prefetchCounsellingConfig(): void {
  void fetchCounsellingPublicStatus().catch(() => {});
}

export async function fetchCounsellingPublicStatus(): Promise<CounsellingPublicStatus> {
  const res = await fetch(`${getBackendUrl()}/api/counselling/public-config`);
  if (!res.ok) {
    return { enabled: false };
  }
  return res.json();
}

/** Warm slots for the default 30 min session before the modal opens. */
export function prefetchCounsellingAvailability(
  mentorId: number,
  durationMinutes: DurationMinutes = 30
): void {
  void fetchCounsellingAvailability(mentorId, durationMinutes).catch(() => {});
}

export async function fetchCounsellingConfig(): Promise<CounsellingConfig> {
  if (configCache && Date.now() - configCache.at < CONFIG_CACHE_MS) {
    return configCache.data;
  }

  const publicStatus = await fetchCounsellingPublicStatus();
  if (!publicStatus.enabled) {
    throw new Error('Career counselling is not available right now.');
  }

  const res = await fetch(`${getBackendUrl()}/api/counselling/config`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  const data = (await res.json()) as CounsellingConfig;
  configCache = { at: Date.now(), data: { ...data, enabled: true } };
  return configCache.data;
}

export async function fetchCounsellingAvailability(
  mentorId: number,
  durationMinutes: DurationMinutes,
  options?: { skipCache?: boolean }
): Promise<CounsellingSlot[]> {
  const cacheKey = availabilityCacheKey(mentorId, durationMinutes);
  if (!options?.skipCache) {
    const hit = availabilityCache.get(cacheKey);
    if (hit && Date.now() - hit.at < AVAILABILITY_CACHE_MS) {
      return hit.data;
    }
  }

  const params = new URLSearchParams({
    mentorId: String(mentorId),
    durationMinutes: String(durationMinutes),
  });
  const res = await fetch(`${getBackendUrl()}/api/counselling/availability?${params}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  const json = await res.json();
  const slots = Array.isArray(json.slots) ? json.slots : [];
  availabilityCache.set(cacheKey, { at: Date.now(), data: slots });
  return slots;
}

export async function reserveCounsellingSlot(input: {
  mentorId: number;
  durationMinutes: DurationMinutes;
  slotStartsAt: string;
}): Promise<CounsellingReservation> {
  const res = await fetch(`${getBackendUrl()}/api/counselling/reserve`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    await throwCounsellingError(res);
  }
  return res.json();
}

export async function createCounsellingCheckout(input: {
  reservationId: string;
  goal?: string;
  attendeeTimeZone?: string;
}): Promise<{ url: string; sessionId: string }> {
  const res = await fetch(`${getBackendUrl()}/api/counselling/checkout`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    await throwCounsellingError(res);
  }
  return res.json();
}

export async function confirmCounsellingPayment(sessionId: string): Promise<{
  booking: CounsellingBooking;
  meetingUrl: string | null;
  alreadyConfirmed: boolean;
}> {
  const res = await fetch(`${getBackendUrl()}/api/counselling/confirm-payment`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json();
}

export async function confirmCounsellingReservation(input: {
  reservationId: string;
  goal?: string;
  attendeeTimeZone?: string;
}): Promise<{ booking: CounsellingBooking; meetingUrl: string | null }> {
  const res = await fetch(`${getBackendUrl()}/api/counselling/confirm`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    await throwCounsellingError(res);
  }
  return res.json();
}

export async function cancelCounsellingReservation(reservationId: string): Promise<void> {
  const res = await fetch(`${getBackendUrl()}/api/counselling/reserve/cancel`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reservationId }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(await parseError(res));
  }
}

export async function bookCounsellingSession(input: {
  mentorId: number;
  durationMinutes: DurationMinutes;
  slotStartsAt: string;
  goal?: string;
}): Promise<{ booking: CounsellingBooking; meetingUrl: string | null }> {
  const res = await fetch(`${getBackendUrl()}/api/counselling/book`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json();
}

export async function fetchMyCounsellingBookings(): Promise<CounsellingBooking[]> {
  const res = await fetch(`${getBackendUrl()}/api/counselling/bookings`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  const json = await res.json();
  return Array.isArray(json.bookings) ? json.bookings : [];
}

export function formatSlotLabel(iso: string, timeZone?: string): string {
  const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/London';
  const date = new Date(iso);
  return date.toLocaleString('en-GB', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/London';
}
