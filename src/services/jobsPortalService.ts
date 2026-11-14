/**
 * jobsPortalService.ts
 *
 * Client-side service for all Jobs Portal API calls.
 * All requests are authenticated via Firebase ID tokens (matching existing gemini.ts pattern).
 * Base URL comes from VITE_BACKEND_URL env var.
 */

import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';
import { officialPartTimeCity } from '../data/partTimeUkCities';
import type { PublicSponsorshipAssessment } from '../types/sponsorshipAssessment';

// ---- Types (mirrors backend types) ----------------------------------------

export type BrowseFeedSegment = 'preferred' | 'secondary' | 'levelOnly' | 'remainder';

export type PortalJobSoc =
    | { kind: 'single'; code: string; title: string; reason?: string }
    | { kind: 'candidates'; matches: { code: string; title: string; percent: number }[]; reason?: string };

export interface PortalJob {
    /** Independently retrieved employer advert, or legacy indexed listing. */
    listingSource?: {
        kind: 'web';
        provider: 'jsearch' | 'employer-sites';
        publisher?: string;
        retrievedAt: string;
        postedAt?: string;
        expiresAt?: string;
        availability: 'unverified' | 'source-listed';
        employerLicence: 'unknown' | 'catalogue-match';
    };
    listingEvidence?: { sourceSeenAt: string; descriptionCheckedAt: string; checksVersion: 'content-v1' };
    sponsorshipAssessment?: PublicSponsorshipAssessment;
    id: string | number;
    title: string;
    url: string;
    location: string;
    /** Official UK city when present (part-time catalog). */
    city?: string | null;
    department?: string;
    level?: string | null;
    sector?: string | null;
    /** Employment type from catalog (`jobs.job_type`) */
    jobType?: string | null;
    /** UK jobs list. One code when the match is confident; up to three codes at 40% or more when it is not. */
    soc?: PortalJobSoc | null;
    /** Advert pay text, when the listing states one. */
    salary?: string | null;
    /** Plain-text job description from the catalog */
    description?: string | null;
    created_at: string;
    company_id: number;
    company?: {
        id: number;
        trading_name: string;
        companies_house_name: string | null;
        url: string | null;
        url_linkedin: string | null;
        url_favicon: string | null;
        description: string | null;
        estimated_num_employees_label?: string | null;
        /** UK Home Office Worker / Temporary Worker licence */
        licensed_sponsor: boolean;
        /** Ireland DETE employment-permits register employer */
        ireland_permit_employer?: boolean;
        cos_used_count_2025?: number | null;
        open_to_sponsorship?: number | null;
        show_recently_added_badge?: boolean;
        added_to_register?: string | null;
    };
    hasReported?: boolean;
    feedSegment?: BrowseFeedSegment;
}

export interface JobsPortalAccessMeta {
    isPremium: boolean;
    mode: 'browse' | 'search';
    jobsReturned: number;
    previewLimit: number;
    premiumRequiredFor: Array<'pagination' | 'full_search' | 'filters'>;
    /** Full match count before free cap — upgrade UI only */
    trueTotalCount?: number;
    hasMoreResults?: boolean;
}

export interface PortalJobsResponse {
    jobs: PortalJob[];
    totalPages: number;
    totalCount: number;
    globalTotalCount: number;
    access?: JobsPortalAccessMeta;
    /** Premium browse: jobs matching sector + level preferences */
    preferredTotalCount?: number;
    secondaryTotalCount?: number;
    levelOnlyTotalCount?: number;
    remainderTotalCount?: number;
    browseHasSectorPreferences?: boolean;
    browseHasLevelPreferences?: boolean;
    /** Distinct levels in the jobs catalog (Supabase `jobs.level`) */
    catalogJobLevels?: readonly string[];
    /** Job-level values matched from the user's experience preferences */
    matchedJobLevels?: string[];
    /** Which country catalog was served — `uk` or `ireland` */
    catalogCountry?: 'uk' | 'ireland';
}

export class JobsPremiumRequiredError extends Error {
    code = 'JOBS_PREMIUM_REQUIRED';
    constructor(message: string) {
        super(message);
        this.name = 'JobsPremiumRequiredError';
    }
}

export interface GetJobsParams {
    page?: number;
    /** @deprecated Prefer role + where */
    q?: string;
    role?: string;
    where?: string;
    excludedJobIds?: string[];
    excludedJobUrls?: string[];
    excludedCompanyIds?: number[];
    /** @deprecated Sectors are loaded server-side from saved preferences. */
    userSectors?: string[];
    companyId?: number;
    /** Bypass feed cache after preference changes */
    refreshPreferences?: boolean;
    /** Premium hard filters */
    filterSectors?: string[];
    filterLevels?: string[];
    filterCities?: string[];
}

// ---- Helpers ---------------------------------------------------------------


async function getAuthToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('User must be authenticated to use Jobs Portal.');
    return user.getIdToken();
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await getAuthToken();
    const url = `${getBackendUrl()}${path}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options?.headers || {})
        },
        signal: options?.signal ?? AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const message =
            errorData?.message ||
            (response.status === 429
                ? 'Too many requests. Please wait a moment and try again.'
                : undefined) ||
            (errorData?.error === 'JOBS_PREMIUM_REQUIRED'
                ? 'Upgrade to Premium to see all jobs and use full search.'
                : errorData?.error) ||
            `API Error ${response.status}`;
        if (errorData?.error === 'JOBS_PREMIUM_REQUIRED') {
            throw new JobsPremiumRequiredError(message);
        }
        if (errorData?.error === 'PART_TIME_UK_ONLY') {
            throw new PartTimeUkOnlyError();
        }
        throw new Error(message);
    }

    return response.json() as Promise<T>;
}

// ---- Public preview (logged-out) -------------------------------------------

export interface PublicPreviewFilters {
    country: 'uk' | 'ireland';
    sectors: string[];
    levels: string[];
    jobTypes: string[];
}

export interface PublicPreviewResponse {
    /** Max 15 jobs; `url` is always empty — apply links are never sent to anon users. */
    jobs: PortalJob[];
    previewLimit: number;
    hasMore: boolean;
    moreLabel: string | null;
}

export class PublicPreviewError extends Error {
    constructor(
        public kind: 'verification' | 'rate_limited' | 'unavailable' | 'invalid',
        message: string
    ) {
        super(message);
        this.name = 'PublicPreviewError';
    }
}

/** Unauthenticated preview feed — requires a fresh Turnstile token per call. */
export async function getPublicPreviewJobs(
    filters: PublicPreviewFilters,
    turnstileToken: string,
    signal?: AbortSignal
): Promise<PublicPreviewResponse> {
    const params = new URLSearchParams({ country: filters.country });
    if (filters.sectors.length) params.set('sectors', filters.sectors.join(','));
    if (filters.levels.length) params.set('levels', filters.levels.join(','));
    if (filters.jobTypes.length) params.set('jobTypes', filters.jobTypes.join(','));
    return fetchPublicPreview(`/api/jobs-portal/public-preview?${params.toString()}`, turnstileToken, signal);
}

/** Unauthenticated UK part-time preview: all-UK only (location filter needs login). */
export async function getPublicPartTimePreviewJobs(
    turnstileToken: string,
    signal?: AbortSignal
): Promise<PublicPreviewResponse> {
    return fetchPublicPreview('/api/jobs-portal/public-preview/part-time', turnstileToken, signal);
}

async function fetchPublicPreview(
    path: string,
    turnstileToken: string,
    signal?: AbortSignal
): Promise<PublicPreviewResponse> {
    const response = await fetch(`${getBackendUrl()}${path}`, {
        headers: { 'X-Turnstile-Token': turnstileToken },
        credentials: 'omit',
        // Part-time city lists can take a few seconds to build on a cold cache.
        signal: signal ?? AbortSignal.timeout(25_000),
    });

    if (response.status === 401) {
        throw new PublicPreviewError('verification', 'We could not verify your browser. Please try again.');
    }
    if (response.status === 429) {
        // express-rate-limit sends its message as plain text.
        const text = (await response.text().catch(() => '')).trim();
        throw new PublicPreviewError(
            'rate_limited',
            text && text.length < 200 && !text.startsWith('<')
                ? text
                : 'Too many requests. Please wait a moment and try again.'
        );
    }
    if (response.status === 400) {
        throw new PublicPreviewError('invalid', 'Some preferences were not recognised. Please update them.');
    }
    if (!response.ok) {
        throw new PublicPreviewError('unavailable', 'Jobs are temporarily unavailable. Please try again.');
    }

    const data = (await response.json()) as Omit<PublicPreviewResponse, 'jobs'> & {
        jobs: Array<Omit<PortalJob, 'url' | 'company'> & { company: Partial<NonNullable<PortalJob['company']>> | null }>;
    };
    return {
        ...data,
        jobs: (data.jobs ?? []).map((job) => ({
            ...job,
            url: '',
            company: job.company
                ? {
                      id: job.company.id ?? 0,
                      trading_name: job.company.trading_name ?? 'Unknown Company',
                      companies_house_name: null,
                      url: null,
                      url_linkedin: job.company.url_linkedin ?? null,
                      url_favicon: job.company.url_favicon ?? null,
                      description: job.company.description ?? null,
                      estimated_num_employees_label: job.company.estimated_num_employees_label ?? null,
                      licensed_sponsor: job.company.licensed_sponsor === true,
                      ireland_permit_employer: job.company.ireland_permit_employer === true,
                      cos_used_count_2025: job.company.cos_used_count_2025 ?? null,
                      show_recently_added_badge: job.company.show_recently_added_badge === true,
                  }
                : undefined,
        })),
    };
}

// ---- Service Functions -----------------------------------------------------

export async function getPortalJobs(
    params: GetJobsParams = {}
): Promise<PortalJobsResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.role?.trim()) qs.set('role', params.role.trim());
    if (params.where?.trim()) qs.set('where', params.where.trim());
    if (params.excludedJobIds?.length) qs.set('excludedJobIds', params.excludedJobIds.join(','));
    if (params.excludedJobUrls?.length) {
        qs.set('excludedJobUrls', params.excludedJobUrls.map(encodeURIComponent).join('|'));
    }
    if (params.excludedCompanyIds?.length) qs.set('excludedCompanyIds', params.excludedCompanyIds.join(','));
    // Sectors for browse filtering are resolved on the server from Firestore preferences.
    if (params.companyId) qs.set('companyId', String(params.companyId));
    if (params.refreshPreferences) qs.set('refresh', '1');
    if (params.filterSectors?.length) qs.set('filterSectors', params.filterSectors.join(','));
    if (params.filterLevels?.length) qs.set('filterLevels', params.filterLevels.join(','));
    if (params.filterCities?.length) qs.set('filterCities', params.filterCities.join(','));

    const url = `/api/jobs-portal/jobs?${qs.toString()}`;
    return apiFetch<PortalJobsResponse>(url);
}

export async function getPortalJob(jobId: string | number): Promise<PortalJob> {
    const data = await apiFetch<{ job: PortalJob }>(
        `/api/jobs-portal/jobs/${encodeURIComponent(String(jobId))}`
    );
    return data.job;
}

export class PartTimeUkOnlyError extends Error {
    constructor() {
        super('PART_TIME_UK_ONLY');
        this.name = 'PartTimeUkOnlyError';
    }
}

export function partTimeReportJobId(jobId: string | number): string {
    const raw = String(jobId).trim();
    return raw.startsWith('ptuk:') ? raw : `ptuk:${raw}`;
}

export async function getPartTimeJobs(
    params: { page?: number; city?: string; role?: string; company?: string } = {}
): Promise<PortalJobsResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.role?.trim()) qs.set('role', params.role.trim());
    if (params.company?.trim()) qs.set('company', params.company.trim());
    const rawCity = params.city?.trim();
    if (rawCity) {
        const city = officialPartTimeCity(rawCity);
        if (!city) {
            throw new Error('Unknown city');
        }
        qs.set('city', city);
    }
    return apiFetch<PortalJobsResponse>(`/api/jobs-portal/part-time/jobs?${qs.toString()}`);
}

export async function getPartTimeJob(jobId: string | number): Promise<PortalJob> {
    const data = await apiFetch<{ job: PortalJob }>(
        `/api/jobs-portal/part-time/jobs/${encodeURIComponent(String(jobId))}`
    );
    return data.job;
}

export type JobsCatalogCountry = 'uk' | 'ireland';

export interface PortalCompany {
    id: number;
    trading_name: string;
    companies_house_name: string | null;
    url: string | null;
    url_linkedin: string | null;
    url_favicon: string | null;
    description: string | null;
    estimated_num_employees_label?: string | null;
    licensed_sponsor: boolean;
    ireland_permit_employer?: boolean;
    active_jobs_count?: number;
    cos_used_count_2025?: number | null;
    open_to_sponsorship?: number | null;
    show_recently_added_badge?: boolean;
    added_to_register?: string | null;
}

export interface CompaniesPortalAccessMeta {
    isPremium: boolean;
    companiesReturned: number;
    previewLimit: number;
    premiumRequiredFor: Array<'pagination' | 'full_search'>;
    trueTotalCount?: number;
    hasMoreResults?: boolean;
}

export interface PortalCompaniesResponse {
    companies: PortalCompany[];
    totalPages: number;
    totalCount: number;
    catalogCountry: JobsCatalogCountry;
    access?: CompaniesPortalAccessMeta;
}

export interface CompanyJobsAccessMeta {
    isPremium: boolean;
    jobsReturned: number;
    previewLimit: number;
    premiumRequiredFor: Array<'pagination'>;
    trueTotalCount?: number;
    hasMoreResults?: boolean;
}

export interface PortalCompanyDetailResponse {
    company: PortalCompany;
    jobs: PortalJob[];
    totalCount: number;
    totalPages: number;
    catalogCountry: JobsCatalogCountry;
    access?: CompanyJobsAccessMeta;
}

export async function getPortalCompanies(params: {
    page?: number;
    q?: string;
}): Promise<PortalCompaniesResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.q?.trim()) qs.set('q', params.q.trim());
    return apiFetch<PortalCompaniesResponse>(`/api/jobs-portal/companies?${qs.toString()}`);
}

export async function getPortalCompany(params: {
    companyId: number;
    page?: number;
}): Promise<PortalCompanyDetailResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<PortalCompanyDetailResponse>(
        `/api/jobs-portal/companies/${params.companyId}${suffix}`
    );
}

export async function reportPortalJob(
    jobId: string | number,
    jobTitle?: string,
    companyName?: string,
    reason?: string,
    jobUrl?: string
): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>('/api/jobs-portal/report', {
        method: 'POST',
        body: JSON.stringify({ jobId, jobTitle, companyName, reason, jobUrl })
    });
}

export interface SponsorCompanyResult {
    organisationName: string;
    townCity: string;
    typeRating: string;
    route: string;
}

export interface SponsorshipPageResult {
    companies: SponsorCompanyResult[];
    page: number;
    totalPages: number;
    totalCount: number;
    stats: {
        total: number;
        cityCounts: Array<{ city: string; count: number }>;
    };
}

/** Must match ProductBackend/jobs-portal/constants.ts SPONSORSHIP_PAGE_SIZE */
export const SPONSORSHIP_PAGE_SIZE = 12;
export const SPONSORSHIP_SEARCH_MAX_LENGTH = 100;

export async function fetchSponsorshipPage(params: {
    page: number;
    q?: string;
    cities?: string[];
    signal?: AbortSignal;
}): Promise<SponsorshipPageResult> {
    const qs = new URLSearchParams({ page: String(params.page) });
    const trimmedQ = params.q?.trim();
    if (trimmedQ) {
        qs.set('q', trimmedQ.slice(0, SPONSORSHIP_SEARCH_MAX_LENGTH));
    }
    if (params.cities && params.cities.length > 0) {
        qs.set('city', params.cities.join(','));
    }
    return apiFetch<SponsorshipPageResult>(
        `/api/jobs-portal/sponsorship/data?${qs}`,
        params.signal ? { signal: params.signal } : undefined
    );
}

export interface IrelandEmployerResult {
    employerName: string;
    city: string | null;
    permitsByYear: Record<'2020' | '2021' | '2022' | '2023' | '2024' | '2025' | '2026', number>;
    permitsJan: number;
    permitsFeb: number;
    permitsMar: number;
    permitsApr: number;
    permitsMay: number;
    permitsJun: number;
    permitsJul: number;
    totalPermits: number;
}

export type IrelandPermitYear = '2020' | '2021' | '2022' | '2023' | '2024' | '2025' | '2026';

export interface IrelandSponsorshipPageResult {
    companies: IrelandEmployerResult[];
    page: number;
    totalPages: number;
    totalCount: number;
    stats: {
        total: number;
        totalPermitsIssued: number;
        maxPermits: number;
        cityCounts: Array<{ city: string; count: number }>;
        yearCounts: Array<{ year: IrelandPermitYear; count: number }>;
        permitRangeCounts: Array<{ id: string; label: string; count: number }>;
        years: IrelandPermitYear[];
        /** True when volume buckets are measured against selected year(s). */
        volumeScopedToYears?: boolean;
    };
}

export async function fetchIrelandSponsorshipPage(params: {
    page: number;
    q?: string;
    cities?: string[];
    years?: string[];
    ranges?: string[];
    signal?: AbortSignal;
}): Promise<IrelandSponsorshipPageResult> {
    const qs = new URLSearchParams({ page: String(params.page) });
    const trimmedQ = params.q?.trim();
    if (trimmedQ) {
        qs.set('q', trimmedQ.slice(0, SPONSORSHIP_SEARCH_MAX_LENGTH));
    }
    if (params.cities && params.cities.length > 0) {
        qs.set('city', params.cities.join(','));
    }
    if (params.years && params.years.length > 0) {
        qs.set('years', params.years.join(','));
    }
    if (params.ranges && params.ranges.length > 0) {
        qs.set('ranges', params.ranges.join(','));
    }
    return apiFetch<IrelandSponsorshipPageResult>(
        `/api/jobs-portal/sponsorship/ireland/data?${qs}`,
        params.signal ? { signal: params.signal } : undefined
    );
}

// ---- Preferences (unified — users/{uid}.preferences) ----------------------

export {
    getJobsBrowsePreferences,
    saveJobsBrowsePreferences,
    getUserPreferences,
    saveUserPreferences,
} from './userPreferencesService';

export type { JobsBrowsePreferences } from './userPreferencesService';
