import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isIrelandCareerLocation } from '../../utils/sponsorshipHubRouting';
import type { JobsCatalogCountry } from '../../services/jobsPortalService';

const CATALOG_CACHE_KEY = 'cafy.jobsPortal.catalog';

export function catalogFromPreferences(locations?: string[] | null): JobsCatalogCountry {
    return isIrelandCareerLocation(locations) ? 'ireland' : 'uk';
}

export function catalogCountryLabel(country: JobsCatalogCountry): string {
    return country === 'ireland' ? 'Ireland' : 'United Kingdom';
}

export function readCachedJobsPortalCatalog(): JobsCatalogCountry | null {
    if (typeof window === 'undefined') return null;
    try {
        const value =
            window.sessionStorage.getItem(CATALOG_CACHE_KEY) ||
            window.localStorage.getItem(CATALOG_CACHE_KEY);
        if (value === 'ireland' || value === 'uk') return value;
    } catch {
        return null;
    }
    return null;
}

export function writeCachedJobsPortalCatalog(catalog: JobsCatalogCountry) {
    try {
        window.sessionStorage.setItem(CATALOG_CACHE_KEY, catalog);
        window.localStorage.setItem(CATALOG_CACHE_KEY, catalog);
    } catch {
        /* private mode / quota */
    }
}

export function resolveInitialJobsPortalCatalog(
    locations?: string[] | null,
): JobsCatalogCountry {
    if (locations?.length) return catalogFromPreferences(locations);
    return readCachedJobsPortalCatalog() ?? 'uk';
}

/** ATS cards often glue posted-time / applicant counts onto location. */
export function cleanPortalJobLocation(raw?: string | null): string {
    let loc = (raw || '').trim();
    if (!loc) return '';

    loc = loc
        .replace(
            /\s*(?:[·•|,/-]\s*)?(?:posted\s+)?(?:just\s+now|\d+\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?)\s+ago)\b[\s\S]*$/i,
            '',
        )
        .replace(/\s*\(\d+[^\)]*$/g, '')
        .replace(/[|·•,;:\-\s]+$/g, '')
        .replace(/^(uk|gb|ie)\s*[-–—/]\s*/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return loc;
}

export function companiesListPath(q?: string): string {
    const trimmed = q?.trim();
    if (!trimmed) return '/jobs-portal/companies';
    return `/jobs-portal/companies?q=${encodeURIComponent(trimmed)}`;
}

export function companyRolesPath(companyId: number, q?: string): string {
    const path = `/jobs-portal/companies/${companyId}`;
    const trimmed = q?.trim();
    if (!trimmed) return path;
    return `${path}?q=${encodeURIComponent(trimmed)}`;
}

/** Catalog follows career location preferences — same as Jobs and Sponsorship Hub. */
export function useJobsPortalCatalog(): {
    catalog: JobsCatalogCountry;
    applyCatalog: (next: JobsCatalogCountry) => void;
} {
    const { user } = useAuth();
    const fromPrefs = user?.preferences?.locations?.length
        ? catalogFromPreferences(user.preferences.locations)
        : null;

    const [catalog, setCatalog] = useState<JobsCatalogCountry>(() => {
        const initial = resolveInitialJobsPortalCatalog(user?.preferences?.locations);
        if (user?.preferences?.locations?.length) {
            writeCachedJobsPortalCatalog(initial);
        }
        return initial;
    });

    const applyCatalog = useCallback((next: JobsCatalogCountry) => {
        setCatalog(next);
        writeCachedJobsPortalCatalog(next);
    }, []);

    useEffect(() => {
        if (!fromPrefs) return;
        applyCatalog(fromPrefs);
    }, [fromPrefs, applyCatalog]);

    return { catalog, applyCatalog };
}
