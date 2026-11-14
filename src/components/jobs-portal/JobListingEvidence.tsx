import type { PortalJob } from '../../services/jobsPortalService';

function dateLabel(value: string): string | null {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { day:'numeric',month:'short',year:'numeric' }) : null;
}

/** These are source observations, never a claim of employer verification or sponsorship. */
export default function JobListingEvidence({ job }: { job: PortalJob }) {
    const evidence = job.listingEvidence;
    if (!evidence) return null;
    const seen = dateLabel(evidence.sourceSeenAt);
    if (!seen) return null;
    return (
        <section className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4" aria-label="Listing information">
            <p className="text-sm font-semibold text-slate-900">Listing information</p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500">Last seen in source feed</dt><dd className="mt-0.5 font-medium text-slate-900"><time dateTime={evidence.sourceSeenAt}>{seen}</time></dd></div>
                <div><dt className="text-slate-500">Description checked</dt><dd className="mt-0.5 font-medium text-slate-900">{dateLabel(evidence.descriptionCheckedAt)}</dd></div>
                {dateLabel(job.created_at) && <div><dt className="text-slate-500">First found by CAFY</dt><dd className="mt-0.5 font-medium text-slate-900">{dateLabel(job.created_at)}</dd></div>}
                <div><dt className="text-slate-500">Advertised pay</dt><dd className="mt-0.5 break-words font-medium text-slate-900">{job.salary || 'See employer advert'}</dd></div>
            </dl>
        </section>
    );
}
