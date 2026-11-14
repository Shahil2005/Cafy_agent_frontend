/**
 * Single source of truth for career preferences in Firestore:
 *   users/{uid}.preferences
 *
 * Legacy users/{uid}/jobPortalPreferences/settings is migrated on read, then deleted.
 */

import { auth, db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { UserPreferences } from '../types';
import { ALLOWED_SECTORS, ALLOWED_JOB_TYPES, JOB_CATALOG_LEVELS } from '../data/jobPortalConstants';

const ALLOWED_SECTOR_SET = new Set<string>(ALLOWED_SECTORS);
const ALLOWED_JOB_TYPE_SET = new Set<string>(ALLOWED_JOB_TYPES);
const CATALOG_LEVEL_SET = new Set<string>(JOB_CATALOG_LEVELS);

/** Legacy profile labels → current `jobs.sector` values. */
const LEGACY_SECTOR_ALIASES: Record<string, string> = {
    'Software Engineering & IT': 'Engineering (Software)',
    'Hardware & Electronics Engineering': 'Engineering (Hardware)',
    'Mechanical, Civil & Other Engineering': 'Engineering (Other)',
};

/** Legacy profile labels → catalog `jobs.job_type` values. */
const LEGACY_JOB_TYPE_ALIASES: Record<string, string> = {
    Freelance: 'Contract',
};

/**
 * Collapse legacy profile / filter labels → production 4-level taxonomy.
 * Mirrors ProductBackend/jobs-portal/levelMapping.ts and CAFY-JOBS LEGACY_LEVEL_MAP.
 */
const LEGACY_TO_CATALOG: Record<string, string> = {
    Internship: 'Entry Level',
    Graduate: 'Entry Level',
    'Entry Level': 'Entry Level',
    'Entry-level': 'Entry Level',
    Entry: 'Entry Level',
    Junior: 'Junior',
    'Mid-level': 'Mid Level',
    'Mid Level': 'Mid Level',
    Mid: 'Mid Level',
    Senior: 'Senior',
    'Senior Level': 'Senior',
    Staff: 'Senior',
    Lead: 'Senior',
    Principal: 'Senior',
    Director: 'Senior',
    VP: 'Senior',
    Executive: 'Senior',
    Leadership: 'Senior',
    Manager: 'Senior',
};

const PORTAL_PREFS_PATH = (uid: string) => `users/${uid}/jobPortalPreferences/settings`;

function parseTimestamp(iso: string | undefined | null): number {
    if (!iso) return 0;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
}

function asStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v));
    return [String(value)];
}

export function normalizeSector(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (ALLOWED_SECTOR_SET.has(trimmed)) return trimmed;
    if (Object.prototype.hasOwnProperty.call(LEGACY_SECTOR_ALIASES, trimmed)) {
        return LEGACY_SECTOR_ALIASES[trimmed];
    }
    return null;
}

export function sanitizeSectors(input: string[] | undefined | null): string[] {
    if (!input?.length) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of input) {
        const sector = normalizeSector(String(raw));
        if (sector && !seen.has(sector)) {
            seen.add(sector);
            out.push(sector);
        }
    }
    return out;
}

export function sanitizeExperienceLevels(input: string[] | undefined | null): string[] {
    if (!input?.length) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of input) {
        const trimmed = String(raw).trim();
        const level = CATALOG_LEVEL_SET.has(trimmed)
            ? trimmed
            : LEGACY_TO_CATALOG[trimmed];
        if (level && CATALOG_LEVEL_SET.has(level) && !seen.has(level)) {
            seen.add(level);
            out.push(level);
        }
    }
    return out;
}

export function normalizeJobType(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (ALLOWED_JOB_TYPE_SET.has(trimmed)) return trimmed;
    if (Object.prototype.hasOwnProperty.call(LEGACY_JOB_TYPE_ALIASES, trimmed)) {
        return LEGACY_JOB_TYPE_ALIASES[trimmed];
    }
    return null;
}

export function sanitizeJobTypes(input: string[] | undefined | null): string[] {
    if (!input?.length) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of input) {
        const jobType = normalizeJobType(String(raw));
        if (jobType && !seen.has(jobType)) {
            seen.add(jobType);
            out.push(jobType);
        }
    }
    return out;
}

/** Map legacy sector labels when hydrating auth/profile state. */
export function mapStoredPreferences(p: unknown): UserPreferences | undefined {
    if (!p || typeof p !== 'object') return undefined;
    const raw = p as UserPreferences;
    const mapped: UserPreferences = { ...raw };
    if (Array.isArray(mapped.sectors)) {
        mapped.sectors = sanitizeSectors(mapped.sectors);
    }
    if (Array.isArray(mapped.experienceLevel)) {
        mapped.experienceLevel = sanitizeExperienceLevels(mapped.experienceLevel);
    }
    if (Array.isArray(mapped.jobTypes)) {
        mapped.jobTypes = sanitizeJobTypes(mapped.jobTypes);
    }
    return mapped;
}

function mergeSectorSources(params: {
    profileSectors: string[] | undefined | null;
    profileUpdatedAt: string | undefined | null;
    portalSectors: string[] | undefined | null;
    portalUpdatedAt: string | undefined | null;
}): string[] {
    const profile = sanitizeSectors(params.profileSectors);
    const portal = sanitizeSectors(params.portalSectors);

    if (!portal.length) return profile;
    if (!profile.length) return portal;

    const portalTs = parseTimestamp(params.portalUpdatedAt);
    const profileTs = parseTimestamp(params.profileUpdatedAt);
    return portalTs > profileTs ? portal : profile;
}

/**
 * Lazy migration: merge legacy portal doc into profile preferences, delete portal doc.
 * Pass `preloadedUserData` when users/{uid} was already loaded (e.g. auth hydration).
 * Once `preferencesPortalCleared` is stamped, skip the legacy portal doc read.
 */
async function loadStoredUserPreferences(
    uid: string,
    preloadedUserData?: Record<string, unknown> | null
): Promise<UserPreferences | null> {
    const userRef = doc(db, 'users', uid);
    const portalRef = doc(db, PORTAL_PREFS_PATH(uid));

    const userData =
        preloadedUserData ??
        ((await getDoc(userRef)).data() as Record<string, unknown> | undefined);
    const existing = mapStoredPreferences(userData?.preferences) ?? null;

    // Phase 3: after migration (or confirmed empty portal), never pay for portal reads again.
    if (userData?.preferencesPortalCleared === true) {
        return existing;
    }

    const portalSnap = await getDoc(portalRef);

    if (!portalSnap.exists()) {
        // Stamp once so future loads skip this read (best-effort).
        void setDoc(userRef, { preferencesPortalCleared: true }, { merge: true }).catch(() => {
            /* non-blocking */
        });
        return existing;
    }

    const portalData = portalSnap.data() as { sectors?: unknown[]; updatedAt?: string } | undefined;
    const mergedSectors = mergeSectorSources({
        profileSectors: existing?.sectors,
        profileUpdatedAt: existing?.updatedAt,
        portalSectors: asStringArray(portalData?.sectors),
        portalUpdatedAt: portalData?.updatedAt,
    });

    const merged: UserPreferences = {
        jobTypes: existing?.jobTypes ?? [],
        experienceLevel: existing?.experienceLevel ?? [],
        searchStatus: existing?.searchStatus ?? '',
        locations: existing?.locations ?? [],
        sectors: mergedSectors,
        sponsorship: existing?.sponsorship ?? '',
        roles: existing?.roles,
        updatedAt: new Date().toISOString(),
    };

    const batch = writeBatch(db);
    batch.set(
        userRef,
        { preferences: merged, preferencesPortalCleared: true },
        { merge: true }
    );
    batch.delete(portalRef);
    await batch.commit();

    return merged;
}

export async function getUserPreferences(options?: {
    /** Skip re-reading users/{uid} when the caller already has the doc data. */
    userData?: Record<string, unknown> | null;
}): Promise<UserPreferences | null> {
    const user = auth.currentUser;
    if (!user) return null;

    try {
        return await loadStoredUserPreferences(user.uid, options?.userData);
    } catch (error) {
        console.error('[userPreferencesService] getUserPreferences error:', error);
        return null;
    }
}

export interface JobsBrowsePreferences {
    sectors: string[];
    experienceLevels: string[];
    jobTypes: string[];
}

export function isValidJobsBrowseSelection(prefs: JobsBrowsePreferences): boolean {
    return (
        sanitizeSectors(prefs.sectors).length > 0 &&
        sanitizeExperienceLevels(prefs.experienceLevels).length > 0 &&
        sanitizeJobTypes(prefs.jobTypes).length > 0
    );
}

export function hasJobsBrowsePreferences(prefs: UserPreferences | null | undefined): boolean {
    if (!prefs) return false;
    return isValidJobsBrowseSelection({
        sectors: prefs.sectors ?? [],
        experienceLevels: prefs.experienceLevel ?? [],
        jobTypes: prefs.jobTypes ?? [],
    });
}

export async function getJobsBrowsePreferences(): Promise<JobsBrowsePreferences> {
    const prefs = await getUserPreferences();
    return {
        sectors: prefs?.sectors ?? [],
        experienceLevels: prefs?.experienceLevel ?? [],
        jobTypes: prefs?.jobTypes ?? [],
    };
}

function sanitizePartialPreferences(partial: Partial<UserPreferences>): Partial<UserPreferences> {
    const out: Partial<UserPreferences> = { ...partial };
    if (partial.sectors !== undefined) {
        out.sectors = sanitizeSectors(partial.sectors);
    }
    if (partial.experienceLevel !== undefined) {
        out.experienceLevel = sanitizeExperienceLevels(partial.experienceLevel);
    }
    if (partial.jobTypes !== undefined) {
        out.jobTypes = sanitizeJobTypes(partial.jobTypes);
    }
    if (partial.updatedAt === undefined) {
        out.updatedAt = new Date().toISOString();
    }
    return out;
}

/** Merge partial preferences into users/{uid}.preferences (single write). */
export async function saveUserPreferences(
    partial: Partial<UserPreferences>
): Promise<{ success: boolean; error?: string; preferences?: UserPreferences }> {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const existing = mapStoredPreferences(userSnap.data()?.preferences) ?? {
            jobTypes: [],
            experienceLevel: [],
            searchStatus: '',
            locations: [],
            sectors: [],
            sponsorship: '',
        };

        const merged = {
            ...existing,
            ...sanitizePartialPreferences(partial),
        } as UserPreferences;

        await setDoc(userRef, { preferences: merged }, { merge: true });

        // Best-effort cleanup if portal doc still exists (e.g. race with lazy migration).
        try {
            await deleteDoc(doc(db, PORTAL_PREFS_PATH(user.uid)));
        } catch {
            /* non-blocking */
        }

        return { success: true, preferences: merged };
    } catch (err) {
        console.error('[userPreferencesService] saveUserPreferences error:', err);
        return { success: false, error: 'Failed to save preferences' };
    }
}

/** Persist sector + level + job type choices for jobs browse feed ranking. */
export async function saveJobsBrowsePreferences(
    prefs: JobsBrowsePreferences
): Promise<{ success: boolean; error?: string; preferences?: UserPreferences }> {
    return saveUserPreferences({
        sectors: prefs.sectors,
        experienceLevel: prefs.experienceLevels,
        jobTypes: prefs.jobTypes,
    });
}
