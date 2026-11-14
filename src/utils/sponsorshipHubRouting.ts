import type { UserPreferences } from '../types';

export type TargetCountryId = 'UK' | 'Ireland';

export interface TargetCountryOption {
  id: TargetCountryId;
  label: string;
  /** ISO-style code used for local SVG assets under /flags */
  flagCode: 'gb' | 'ie';
  locationsValue: string;
}

export const TARGET_COUNTRIES: readonly TargetCountryOption[] = [
  {
    id: 'UK',
    label: 'United Kingdom',
    flagCode: 'gb',
    locationsValue: 'United Kingdom',
  },
  {
    id: 'Ireland',
    label: 'Ireland',
    flagCode: 'ie',
    locationsValue: 'Ireland',
  },
] as const;

function normalizeLocation(value: string): string {
  return value.trim().toLowerCase();
}

export function getTargetCountryById(id: TargetCountryId): TargetCountryOption {
  return TARGET_COUNTRIES.find((c) => c.id === id)!;
}

export function getTargetCountryByLocationsValue(
  value: string | undefined | null
): TargetCountryOption | null {
  if (!value) return null;
  const normalized = normalizeLocation(value);
  return (
    TARGET_COUNTRIES.find((c) => normalizeLocation(c.locationsValue) === normalized) ?? null
  );
}

/** Resolve selected country from stored locations (canonical only). */
export function resolveTargetCountryId(
  locations: string[] | undefined | null
): TargetCountryId | null {
  if (!locations?.length) return null;
  for (const loc of locations) {
    const match = getTargetCountryByLocationsValue(loc);
    if (match) return match.id;
  }
  return null;
}

/** Display helper: country id + label for a stored location string, or plain text for legacy values. */
export function formatLocationDisplay(
  location: string
): { countryId: TargetCountryId | null; label: string } {
  const match = getTargetCountryByLocationsValue(location);
  if (match) return { countryId: match.id, label: match.label };
  return { countryId: null, label: location };
}

/** True when career preferences target Ireland (canonical or legacy free-text).
 * Uses the first resolved target country (UK listed before Ireland → UK).
 */
export function isIrelandCareerLocation(locations: string[] | undefined | null): boolean {
  if (!locations?.length) return false;

  if (resolveTargetCountryId(locations) === 'Ireland') return true;
  if (resolveTargetCountryId(locations) === 'UK') return false;

  return locations.some((location) => {
    const normalized = normalizeLocation(location);
    if (!normalized) return false;

    if (normalized.includes('northern ireland')) return false;

    if (normalized === 'ireland') return true;
    if (normalized === 'republic of ireland') return true;
    if (normalized === 'éire' || normalized === 'eire') return true;

    return /\bireland\b/i.test(normalized);
  });
}

/**
 * Career Path eligibility — mirrors ProductBackend `locationGate.ts`.
 * True if ANY location is Republic of Ireland (dual UK+Ireland still blocked).
 */
export function isCareerPathLocationBlocked(
  locations: string[] | undefined | null
): boolean {
  if (!locations?.length) return false;

  return locations.some((location) => {
    if (typeof location !== 'string') return false;
    const normalized = normalizeLocation(location);
    if (!normalized) return false;

    if (normalized.includes('northern ireland')) return false;
    if (normalized === 'united kingdom' || normalized === 'uk') return false;

    if (normalized === 'ireland') return true;
    if (normalized === 'republic of ireland') return true;
    if (normalized === 'éire' || normalized === 'eire') return true;

    return /\bireland\b/i.test(normalized);
  });
}

export function getDefaultSponsorshipPath(
  preferences?: UserPreferences | null
): '/sponsorship' | '/sponsorship/ireland' {
  return isIrelandCareerLocation(preferences?.locations)
    ? '/sponsorship/ireland'
    : '/sponsorship';
}

/** Map static tour paths to user-specific routes (e.g. Ireland sponsorship hub). */
export function resolveTourStepPath(
  stepPath: string,
  preferences?: UserPreferences | null
): string {
  if (stepPath === '/sponsorship') {
    return getDefaultSponsorshipPath(preferences);
  }
  return stepPath;
}

export function locationsFromTargetCountry(id: TargetCountryId): string[] {
  return [getTargetCountryById(id).locationsValue];
}
