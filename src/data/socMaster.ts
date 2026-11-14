/**
 * UK SOC 2020 master dataset — the SAME data the Career Path backend uses to
 * enrich its recommendations (cafy-backend/ProductBackend/data/uk_soc_master.json).
 *
 * This module is only ever reached through a dynamic `import()` (from the
 * Sponsorship Hub "Roles" tab) so the ~1.7 MB JSON stays in its own lazy chunk
 * and never lands in the main bundle.
 *
 * Keep uk_soc_master.json in step with the backend copy — see
 * scripts/sync-soc-master (or copy it by hand when the backend dataset is
 * regenerated).
 */
import master from './uk_soc_master.json';
import type {
    SocMasterOccupation,
    SocOccupationData,
    VisaSalaryRules,
} from '../types/soc';

interface RawMaster {
    generatedAt: string;
    dataSources: string[];
    visaSalaryRules: VisaSalaryRules;
    occupations: SocMasterOccupation[];
}

const raw = master as unknown as RawMaster;

/** ISO timestamp the dataset was generated — shown as "data current as of…". */
export const SOC_MASTER_GENERATED_AT: string = raw.generatedAt;

/** Government sources the dataset was compiled from. */
export const SOC_MASTER_DATA_SOURCES: string[] = raw.dataSources;

/** Skilled Worker salary rules incl. the A–K points-option table. */
export const VISA_SALARY_RULES: VisaSalaryRules = raw.visaSalaryRules;

/** All 412 occupations, sorted by SOC code. */
export const socOccupations: SocMasterOccupation[] = raw.occupations
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code));

/** code → occupation. Exact 1:1 — every SOC 2020 unit group is present. */
export const socByCode: Map<string, SocMasterOccupation> = new Map(
    socOccupations.map((o): [string, SocMasterOccupation] => [o.code, o]),
);

/**
 * Resolve a possibly-messy code to its occupation. Mirrors the backend's
 * defensive normalisation in careerAnalysis/handler.ts (`String(code).match(/\d+/)`).
 */
export function lookupSoc(code: string | number | null | undefined): SocMasterOccupation | undefined {
    const normalized = String(code ?? '').match(/\d+/)?.[0];
    return normalized ? socByCode.get(normalized) : undefined;
}

/** Adapt a master row to the `SocOccupationData` shape the shared panel renders. */
export function toSocOccupationData(o: SocMasterOccupation): SocOccupationData {
    return {
        skillLevel: o.skillLevel,
        // "Related job titles" surface is intentionally not rendered from this field.
        expandedJobTitles: null,
        sponsorship: o.sponsorship,
        salary: o.salary,
    };
}

/** True when the occupation currently sits on the Immigration Salary List. */
export function isOnImmigrationSalaryList(o: SocMasterOccupation): boolean {
    return Array.isArray(o.sponsorship.immigrationSalaryList)
        && o.sponsorship.immigrationSalaryList.length > 0;
}

/** True when a relevant STEM PhD unlocks reduced-salary points for this code. */
export function isPhdEligible(o: SocMasterOccupation): boolean {
    return o.sponsorship.phdEligible === true;
}

/**
 * Headline annual going rate for list/card display: the full (100%) median rate
 * where published, else the 25th-percentile full rate, else null.
 */
export function headlineAnnualRate(o: SocMasterOccupation): number | null {
    const s = o.salary;
    if (s.type !== 'going_rate') return null;
    return s.median?.rate100.annual ?? s.percentile25?.rate100.annual ?? null;
}
