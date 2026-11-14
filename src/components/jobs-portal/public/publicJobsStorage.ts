/**
 * Browser storage for the logged-out jobs preview.
 *
 * - Preferences live in localStorage (visitor has no account yet); they are
 *   re-validated on every read because storage is user-editable. The server
 *   validates again — this is UX only.
 * - Post-auth intent lives in localStorage with a 24 h expiry (the email
 *   verification link opens a new tab, which would lose sessionStorage). The
 *   redirect target is fixed to /jobs-portal (never a stored path) so it cannot
 *   become an open redirect.
 */
import {
  ALLOWED_JOB_TYPES,
  ALLOWED_SECTORS,
  JOB_CATALOG_LEVELS,
} from '../../../data/jobPortalConstants';
import { getTargetCountryById } from '../../../utils/sponsorshipHubRouting';
import { isHomeToolId, type HomeToolId } from '../../home/homeToolGroups';
import { officialPartTimeCity } from '../../../data/partTimeUkCities';

export type PublicCatalogCountry = 'uk' | 'ireland';

export interface AnonJobPreferences {
  country: PublicCatalogCountry;
  sectors: string[];
  experienceLevel: string[];
  jobTypes: string[];
}

export const PUBLIC_PREF_LIMITS = { sectors: 5, experienceLevel: 4, jobTypes: 5 } as const;

const PREFS_KEY = 'cafy.publicJobs.prefs.v1';
const INTENT_KEY = 'cafy.publicJobs.intent.v1';
const MAX_SEARCH_LENGTH = 100;
const MAX_JOB_ID_LENGTH = 64;
const INTENT_TTL_MS = 24 * 60 * 60 * 1000;

function pickAllowed(value: unknown, allowed: readonly string[], max: number): string[] {
  if (!Array.isArray(value)) return [];
  const allowedSet = new Set(allowed);
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && allowedSet.has(v)))].slice(0, max);
}

export function sanitizeAnonJobPreferences(raw: unknown): AnonJobPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  return {
    country: value.country === 'ireland' ? 'ireland' : 'uk',
    sectors: pickAllowed(value.sectors, ALLOWED_SECTORS, PUBLIC_PREF_LIMITS.sectors),
    experienceLevel: pickAllowed(value.experienceLevel, JOB_CATALOG_LEVELS, PUBLIC_PREF_LIMITS.experienceLevel),
    jobTypes: pickAllowed(value.jobTypes, ALLOWED_JOB_TYPES, PUBLIC_PREF_LIMITS.jobTypes),
  };
}

/** Same rule as logged-in browse preferences: at least one sector, level and job type. */
export function isCompleteAnonPreferences(prefs: AnonJobPreferences | null): prefs is AnonJobPreferences {
  return Boolean(prefs && prefs.sectors.length && prefs.experienceLevel.length && prefs.jobTypes.length);
}

export function readAnonJobPreferences(): AnonJobPreferences | null {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? sanitizeAnonJobPreferences(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeAnonJobPreferences(prefs: AnonJobPreferences): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (private mode) — preferences just won't persist */
  }
}

export function clearAnonJobPreferences(): void {
  try {
    window.localStorage.removeItem(PREFS_KEY);
  } catch {
    /* ignore */
  }
}

/** Map anon answers onto the profile `preferences` keys used by onboarding. */
export function anonPrefsToProfilePreferences(prefs: AnonJobPreferences) {
  return {
    jobTypes: prefs.jobTypes,
    experienceLevel: prefs.experienceLevel,
    sectors: prefs.sectors,
    locations: [getTargetCountryById(prefs.country === 'ireland' ? 'Ireland' : 'UK').locationsValue],
  };
}

export interface PendingJobsIntent {
  jobId: string | null;
  search: string | null;
  /** Tool clicked on the Explore page — land there after sign-up / login. */
  toolId: HomeToolId | null;
  /** City chosen on the part-time preview — pre-selected on /part-time-jobs. */
  partTimeCity: string | null;
}

function safePartTimeCity(value: unknown): string | null {
  return typeof value === 'string' ? officialPartTimeCity(value) : null;
}

export function savePendingJobsIntent(intent: Partial<PendingJobsIntent>): void {
  try {
    const existing = readPendingJobsIntent();
    const toolId = intent.toolId !== undefined ? intent.toolId : (existing?.toolId ?? null);
    const next = {
      jobId: (intent.jobId ?? existing?.jobId ?? null)?.slice(0, MAX_JOB_ID_LENGTH) ?? null,
      search: (intent.search ?? existing?.search ?? null)?.trim().slice(0, MAX_SEARCH_LENGTH) || null,
      toolId: isHomeToolId(toolId) ? toolId : null,
      partTimeCity: safePartTimeCity(
        intent.partTimeCity !== undefined ? intent.partTimeCity : (existing?.partTimeCity ?? null),
      ),
      at: Date.now(),
    };
    window.localStorage.setItem(INTENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function readPendingJobsIntent(): PendingJobsIntent | null {
  try {
    const raw = window.localStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (typeof value.at !== 'number' || Date.now() - value.at > INTENT_TTL_MS) {
      window.localStorage.removeItem(INTENT_KEY);
      return null;
    }
    return {
      jobId: typeof value.jobId === 'string' ? value.jobId.slice(0, MAX_JOB_ID_LENGTH) : null,
      search: typeof value.search === 'string' ? value.search.slice(0, MAX_SEARCH_LENGTH) : null,
      toolId: isHomeToolId(value.toolId) ? value.toolId : null,
      partTimeCity: safePartTimeCity(value.partTimeCity),
    };
  } catch {
    return null;
  }
}

export function hasPendingJobsIntent(): boolean {
  return readPendingJobsIntent() !== null;
}

/** Peek without clearing — App decides where to land after auth. */
export function peekPendingJobsIntent(): PendingJobsIntent | null {
  return readPendingJobsIntent();
}

/** Read once and clear. */
export function consumePendingJobsIntent(): PendingJobsIntent | null {
  const intent = readPendingJobsIntent();
  try {
    window.localStorage.removeItem(INTENT_KEY);
  } catch {
    /* ignore */
  }
  return intent;
}
