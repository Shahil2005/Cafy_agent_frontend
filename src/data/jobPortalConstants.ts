/**
 * jobPortalConstants.ts (frontend)
 *
 * Shared allowlists for Jobs Portal preferences UI and validation.
 * Mirrors ProductBackend/jobs-portal/constants.ts and CAFY-JOBS ALLOWED_SECTORS (25).
 * Job browse matching uses Supabase `jobs.sector` (same labels as below).
 */

/**
 * Distinct levels in the jobs catalog (Supabase `jobs.level`).
 * Profile experience preferences use these same values.
 * Keep in sync with CAFY-JOBS `ALLOWED_JOB_LEVELS`.
 */
export const JOB_CATALOG_LEVELS = [
    'Entry Level',
    'Junior',
    'Mid Level',
    'Senior',
] as const;

export type JobCatalogLevel = (typeof JOB_CATALOG_LEVELS)[number];

/** Profile / onboarding experience level picker — matches `jobs.level` in the catalog. */
export const ALLOWED_EXPERIENCE_LEVELS = JOB_CATALOG_LEVELS;

/**
 * Employment type — mirrors CAFY-JOBS `ALLOWED_JOB_TYPES` / `jobs.job_type`.
 * Keep in sync with ProductBackend and CAFY-JOBS.
 */
export const ALLOWED_JOB_TYPES = [
    'Full-time',
    'Part-time',
    'Contract',
    'Internship',
    'Placement scheme',
] as const;

export type JobType = (typeof ALLOWED_JOB_TYPES)[number];

/** Distinct non-empty values in Supabase `jobs.sector` (must match CAFY-JOBS ingestion). */
export const ALLOWED_SECTORS = [
    'Business & Strategy',
    'Construction & Infrastructure',
    'Customer Success',
    'Data',
    'Design',
    'Engineering (Hardware)',
    'Engineering (Other)',
    'Engineering (Software)',
    'Finance',
    'Healthcare',
    'Healthcare & Social Care',
    'HR / People',
    'Legal',
    'Logistics & Transport',
    'Marketing & PR',
    'Media & Journalism',
    'Operations',
    'Other',
    'Pharmaceutical',
    'Product Management',
    'Project Management',
    'Research (Non-technical)',
    'Research (Technical)',
    'Retail & Hospitality',
    'Sales & Partnerships',
] as const;

/** Major UK job locations for Premium city filter dropdown. */
export const UK_JOB_FILTER_CITIES = [
    'Remote',
    'London',
    'Manchester',
    'Birmingham',
    'Leeds',
    'Glasgow',
    'Edinburgh',
    'Bristol',
    'Liverpool',
    'Sheffield',
    'Newcastle',
    'Nottingham',
    'Cardiff',
    'Belfast',
    'Leicester',
    'Coventry',
    'Southampton',
    'Reading',
    'Oxford',
    'Cambridge',
    'Brighton',
    'Milton Keynes',
    'Slough',
    'Croydon',
] as const;

/** Major Ireland job locations for Premium city filter dropdown. */
export const IRELAND_JOB_FILTER_CITIES = [
    'Remote',
    'Dublin',
    'Cork',
    'Galway',
    'Limerick',
    'Waterford',
    'Kilkenny',
    'Drogheda',
    'Dundalk',
    'Sligo',
    'Wexford',
    'Athlone',
    'Tralee',
    'Ennis',
    'Navan',
    'Bray',
] as const;

export function jobFilterCitiesForCatalog(
    catalogCountry: 'uk' | 'ireland'
): readonly string[] {
    return catalogCountry === 'ireland' ? IRELAND_JOB_FILTER_CITIES : UK_JOB_FILTER_CITIES;
}

/** @deprecated Use UserPreferences in users/{uid}.preferences — kept for type compatibility. */
export interface JobPortalPreferences {
    sectors: string[];
    updatedAt: string;
}
