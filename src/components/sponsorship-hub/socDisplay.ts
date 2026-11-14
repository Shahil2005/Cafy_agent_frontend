import { CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';
import type { SocApplicantStatus } from '../../types/soc';

/**
 * Display helpers shared by the Sponsorship Hub role card, role modal and the
 * Career-Path-style <SocSponsorshipPanel>. Kept in a non-component module so
 * Fast Refresh stays happy.
 */

/** Skilled Worker salary points-option codes (A–K) → human label. */
export const POINTS_OPTION_LABELS: Record<string, string> = {
    A: 'General route', B: 'Previously Immigration Salary List-sponsored', C: 'PhD in STEM subject',
    D: 'Immigration Salary List', E: 'New entrant at start of career', F: 'General route',
    G: 'Previously Immigration Salary List-sponsored', H: 'PhD in STEM subject',
    I: 'Immigration Salary List', J: 'New entrant at start of career', K: 'Health/education route',
};

export function getSponsorshipStatusMeta(status?: SocApplicantStatus) {
    switch (status) {
        case 'open_to_new_applicants':
            return {
                accent: 'bg-emerald-500',
                chip: 'bg-emerald-100 text-emerald-700',
                label: 'Open to sponsorship',
                shortLabel: 'Open',
                icon: CheckCircle2,
                card: 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50',
            };
        case 'legacy_only_existing_visa_holders':
            return {
                accent: 'bg-amber-500',
                chip: 'bg-amber-100 text-amber-700',
                label: 'Legacy visa holders only',
                shortLabel: 'Legacy only',
                icon: Clock,
                card: 'border-amber-200 bg-amber-50/70 hover:bg-amber-50',
            };
        case 'not_eligible':
            return {
                accent: 'bg-rose-500',
                chip: 'bg-rose-100 text-rose-700',
                label: 'Not sponsorship-eligible',
                shortLabel: 'Not eligible',
                icon: XCircle,
                card: 'border-rose-200 bg-rose-50/70 hover:bg-rose-50',
            };
        default:
            return {
                accent: 'bg-slate-300',
                chip: 'bg-slate-100 text-slate-500',
                label: 'Status unrated',
                shortLabel: 'Unrated',
                icon: AlertCircle,
                card: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
            };
    }
}
