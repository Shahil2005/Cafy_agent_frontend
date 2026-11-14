/**
 * Shared UK SOC 2020 occupation types.
 *
 * These mirror the structures produced by the backend from `uk_soc_master.json`
 * (see cafy-backend/ProductBackend/data/uk_soc_master.json). The Career Path
 * feature receives `SocOccupationData` per recommendation from the API; the
 * Sponsorship Hub reads the same shapes directly from the bundled dataset.
 * Keep these in sync with careerAnalysisService.ts.
 */

export type SocApplicantStatus =
    | 'open_to_new_applicants'
    | 'legacy_only_existing_visa_holders'
    | 'not_eligible';

export interface SocSalaryRate {
    annual: number | null;
    hourly: number | null;
    /** Skilled Worker points-option codes (A–K) this rate row unlocks. */
    pointsOptions?: string[];
}

export interface SocSalaryTable {
    equivalentSoc2010?: string;
    rate100: SocSalaryRate;
    rate90?: SocSalaryRate;
    rate80?: SocSalaryRate;
    rate70?: SocSalaryRate;
    source: string;
}

export interface SocNationalPayScaleEntry {
    title: string;
    rawText: string;
    source: string;
}

export interface SocOccupationData {
    skillLevel: string | null;
    expandedJobTitles: string[] | null;
    sponsorship: {
        skilledWorkerEligible: boolean;
        phdEligible: boolean | null;
        routes: { skilledWorker: boolean; globalBusinessMobility: boolean; scaleUp: boolean } | null;
        immigrationSalaryList:
            | { criteria: string; nations: Record<string, boolean>; removalDate: string }[]
            | null;
        applicantStatus: SocApplicantStatus;
    };
    salary: {
        type: 'going_rate' | 'national_pay_scale' | 'not_eligible';
        currency: string;
        median: SocSalaryTable | null;
        percentile25: SocSalaryTable | null;
        nationalPayScale: {
            byNation: Record<string, SocNationalPayScaleEntry>;
            payBandReference: { table: string; data: Record<string, Record<string, string>> } | null;
            teacherPayReference: { table: string; data: Record<string, Record<string, string>> } | null;
        } | null;
    };
}

/**
 * One occupation row from `uk_soc_master.json`. This is the full record — the
 * same fields the backend indexes for vector search, minus nothing.
 */
export interface SocMasterOccupation {
    code: string;
    title: string;
    category: string;
    relatedJobTitles: string[];
    expandedJobTitles: string[];
    skillLevel: string | null;
    sponsorship: SocOccupationData['sponsorship'];
    salary: SocOccupationData['salary'];
}

/** One entry from `visaSalaryRules.pointsOptions` (A–K) in `uk_soc_master.json`. */
export interface VisaPointsOption {
    floorSalary: number | null;
    goingRatePercent: number;
    appliesTo: string;
    condition: string;
}

export interface VisaSalaryRules {
    document: string;
    url: string;
    note: string;
    pointsOptions: Record<string, VisaPointsOption>;
}
