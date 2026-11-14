import type { SponsorCompanyResult, IrelandEmployerResult } from "../../services/jobsPortalService";
import type { StoredFavorite } from "./useSponsorCardActions";

export function sponsorCompanyKey(company: Pick<SponsorCompanyResult, "organisationName" | "townCity" | "typeRating" | "route">): string {
    return [company.organisationName, company.townCity, company.typeRating, company.route].join("\u0000");
}

export function irelandEmployerKey(company: IrelandEmployerResult): string {
    return [company.employerName, company.city ?? ""].join("\u0000");
}

export function migrateUkCompanyFavorite(
    entry: StoredFavorite<SponsorCompanyResult>
): StoredFavorite<SponsorCompanyResult> | null {
    if (!entry.snapshot?.organisationName || entry.savedAt <= 0) {
        return entry.savedAt > 0 ? entry : null;
    }
    const newId = sponsorCompanyKey(entry.snapshot);
    if (newId === entry.id) return entry;
    return { ...entry, id: newId };
}

export function migrateIrelandEmployerFavorite(
    entry: StoredFavorite<IrelandEmployerResult>
): StoredFavorite<IrelandEmployerResult> | null {
    if (!entry.snapshot?.employerName || entry.savedAt <= 0) {
        return entry.savedAt > 0 ? entry : null;
    }
    const newId = irelandEmployerKey(entry.snapshot);
    if (newId === entry.id) return entry;
    return { ...entry, id: newId };
}
