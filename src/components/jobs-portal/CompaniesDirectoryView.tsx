import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowLeft,
    Crown,
    ExternalLink,
    Globe,
    Loader2,
    Lock,
    Search,
    ShieldCheck,
    Sparkles,
    SquarePen,
    X,
} from 'lucide-react';
import { JobsCompanyLogo } from './JobsCompanyLogo';
import { useAuth } from '../../hooks/useAuth';
import {
    getPortalCompanies,
    getPortalCompany,
    JobsPremiumRequiredError,
    type PortalCompany,
    type PortalJob,
} from '../../services/jobsPortalService';
import { fetchBillingStatus } from '../../services/billingService';
import {
    catalogCountryLabel,
    companyRolesPath,
    companiesListPath,
    useJobsPortalCatalog,
} from './jobsPortalCatalog';

const ZERO_ACTIVE_JOBS_COPY =
    'We are unable to find open roles at this company.';

function fixJobUrl(url: string): string {
    if (!url) return '#';
    if (url.includes('api.smartrecruiters.com')) {
        const match = url.match(/\/companies\/([^/]+)\/postings\/([^/?#]+)/);
        if (match) return `https://jobs.smartrecruiters.com/${match[1]}/${match[2]}`;
    }
    return url;
}

function websiteHref(url: string): string {
    return url.startsWith('http') ? url : `https://${url}`;
}

function stripOpenRolesFromDescription(description: string): string {
    return description
        .split('\n')
        .filter((line) => !/\d[\d,]*\s*open roles?\b/i.test(line.trim()))
        .join('\n')
        .trim();
}

function openRolesCount(company: PortalCompany): number | null {
    const n = Number(company.active_jobs_count);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
}

function sortCompaniesByOpenRolesDesc(companies: PortalCompany[]): PortalCompany[] {
    return [...companies].sort((a, b) => {
        const aCount = Number(a.active_jobs_count);
        const bCount = Number(b.active_jobs_count);
        const aSafe = Number.isFinite(aCount) ? aCount : -1;
        const bSafe = Number.isFinite(bCount) ? bCount : -1;
        if (bSafe !== aSafe) return bSafe - aSafe;
        return (a.trading_name || '').localeCompare(b.trading_name || '');
    });
}

function syncCompanyUrl(companyId: number | null, q?: string) {
    const next =
        companyId && companyId > 0 ? companyRolesPath(companyId, q) : companiesListPath(q);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === next) return;
    window.history.replaceState(window.history.state, '', next);
}

function isSponsor(company: PortalCompany, catalog: 'uk' | 'ireland') {
    return catalog === 'ireland' ? company.ireland_permit_employer : company.licensed_sponsor;
}

function addedToRegisterLabel(value?: string | null): string | null {
    if (!value) return null;
    const added = new Date(value);
    if (Number.isNaN(added.getTime())) return null;
    const years = Math.floor((Date.now() - added.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (years < 1) return 'Added to register this year';
    if (years === 1) return 'Added to register 1 year ago';
    return `Added to register ${years} years ago`;
}

function RoleRow({ job, catalogLabel }: { job: PortalJob; catalogLabel: string }) {
    const href = fixJobUrl(job.url);
    const locationLabel = job.location || catalogLabel;

    return (
        <article className="border-b border-slate-200 py-4 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">{job.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {job.jobType ? (
                            <span className="bg-cafy-100 px-2.5 py-0.5 text-[11px] font-semibold text-cafy-800">
                                {job.jobType}
                            </span>
                        ) : null}
                        {job.level ? (
                            <span className="bg-cafy-100 px-2.5 py-0.5 text-[11px] font-semibold text-cafy-800">
                                {job.level}
                            </span>
                        ) : null}
                        {locationLabel ? (
                            <span className="bg-cafy-100 px-2.5 py-0.5 text-[11px] font-semibold text-cafy-800">
                                {locationLabel}
                            </span>
                        ) : null}
                        {job.sector ? (
                            <span className="bg-cafy-100 px-2.5 py-0.5 text-[11px] font-semibold text-cafy-800">
                                {job.sector}
                            </span>
                        ) : null}
                    </div>
                </div>
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-medium text-slate-600 hover:text-blue-700"
                >
                    <SquarePen className="h-3.5 w-3.5" aria-hidden />
                    View job
                </a>
            </div>
        </article>
    );
}

function CompanyRow({
    company,
    catalog,
    selected,
    onSelect,
}: {
    company: PortalCompany;
    catalog: 'uk' | 'ireland';
    selected: boolean;
    onSelect: () => void;
}) {
    const sponsor = isSponsor(company, catalog);
    const count = openRolesCount(company);
    const about = company.description
        ? stripOpenRolesFromDescription(company.description)
        : '';
    const legalName =
        company.companies_house_name &&
        company.companies_house_name !== company.trading_name
            ? company.companies_house_name
            : null;
    const addedLabel = addedToRegisterLabel(company.added_to_register);
    const rolesLabel =
        count == null
            ? 'Active jobs'
            : count === 0
              ? 'No open roles'
              : `${count.toLocaleString()} active job${count === 1 ? '' : 's'}`;

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full border-b border-slate-200 py-6 text-left ${
                selected ? 'bg-violet-50/70' : 'hover:bg-slate-50'
            }`}
        >
            <div className="flex items-start gap-3 px-1">
                <JobsCompanyLogo
                    companyName={company.trading_name}
                    faviconUrl={company.url_favicon}
                    size={36}
                    rounded={false}
                />
                <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-semibold text-slate-900">
                        {company.trading_name}
                    </h2>
                    {legalName ? (
                        <p className="mt-0.5 text-xs text-slate-500">{legalName}</p>
                    ) : null}
                    {addedLabel ? (
                        <p className="mt-0.5 text-xs text-slate-400">{addedLabel}</p>
                    ) : null}
                    {about ? (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-2">
                            {about}
                        </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {sponsor ? (
                            <span className="inline-flex items-center gap-1 bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                <ShieldCheck className="h-3 w-3" aria-hidden />
                                {catalog === 'ireland' ? 'Permit employer' : 'Licensed sponsor'}
                            </span>
                        ) : null}
                        <span className="border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            {rolesLabel}
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
}

function CompanyDetails({
    company,
    catalog,
    catalogLabel,
    showBack,
    onBack,
    onViewOpenRoles,
}: {
    company: PortalCompany;
    catalog: 'uk' | 'ireland';
    catalogLabel: string;
    showBack: boolean;
    onBack: () => void;
    onViewOpenRoles: () => void;
}) {
    const sponsor = isSponsor(company, catalog);
    const count = openRolesCount(company);
    const description = company.description
        ? stripOpenRolesFromDescription(company.description)
        : '';
    const legalName =
        company.companies_house_name &&
        company.companies_house_name !== company.trading_name
            ? company.companies_house_name
            : null;
    const [aboutOpen, setAboutOpen] = useState(false);
    const aboutLong = description.length > 220;

    return (
        <div className="flex h-full min-h-0 flex-col bg-white">
            {showBack ? (
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex shrink-0 items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 lg:hidden"
                >
                    <ArrowLeft className="h-4 w-4" />
                    All companies
                </button>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-5 py-5">
                <div className="flex items-start gap-3">
                    <JobsCompanyLogo
                        companyName={company.trading_name}
                        faviconUrl={company.url_favicon}
                        size={40}
                        rounded={false}
                    />
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold leading-snug text-slate-900">
                            {company.trading_name}
                        </h2>
                        {legalName ? (
                            <p className="mt-0.5 text-sm text-slate-500">{legalName}</p>
                        ) : (
                            <p className="mt-0.5 text-sm text-slate-500">{catalogLabel}</p>
                        )}
                    </div>
                </div>

                {(company.url || company.url_linkedin) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {company.url ? (
                            <a
                                href={websiteHref(company.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
                            >
                                <Globe className="h-3.5 w-3.5" aria-hidden />
                                Website
                            </a>
                        ) : null}
                        {company.url_linkedin ? (
                            <a
                                href={websiteHref(company.url_linkedin)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
                            >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                LinkedIn
                            </a>
                        ) : null}
                    </div>
                )}

                {description ? (
                    <section className="mt-6">
                        <h3 className="text-sm font-semibold text-slate-900">About the company</h3>
                        <p
                            className={`mt-2 text-sm leading-relaxed text-slate-600 ${
                                aboutOpen || !aboutLong ? '' : 'line-clamp-4'
                            }`}
                        >
                            {description}
                        </p>
                        {aboutLong ? (
                            <button
                                type="button"
                                onClick={() => setAboutOpen((open) => !open)}
                                className="mt-2 text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
                            >
                                {aboutOpen ? 'Show less' : 'Show more'}
                            </button>
                        ) : null}
                    </section>
                ) : null}

                <section className="mt-8">
                    <h3 className="text-sm font-semibold text-slate-900">Open roles</h3>
                    {count === 0 ? (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            {ZERO_ACTIVE_JOBS_COPY}
                        </p>
                    ) : (
                        <>
                            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
                                {count != null ? count.toLocaleString() : '—'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {sponsor
                                    ? 'jobs that may be sponsored'
                                    : `jobs in ${catalogLabel}`}
                            </p>
                        </>
                    )}
                </section>

                {count !== 0 ? (
                    <button
                        type="button"
                        onClick={onViewOpenRoles}
                        className="mt-6 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        View open roles
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function OpenRolesPanel({
    company,
    catalogLabel,
    jobs,
    loadingRoles,
    loadingMoreRoles,
    canLoadMoreRoles,
    showPremiumGate,
    onClose,
    onLoadMore,
    onUpgrade,
}: {
    company: PortalCompany;
    catalogLabel: string;
    jobs: PortalJob[];
    loadingRoles: boolean;
    loadingMoreRoles: boolean;
    canLoadMoreRoles: boolean;
    showPremiumGate: boolean;
    onClose: () => void;
    onLoadMore: () => void;
    onUpgrade: () => void;
}) {
    return (
        <div className="flex h-full min-h-0 flex-col bg-white">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900">Open roles</h2>
                    <p className="mt-0.5 text-sm text-slate-500">{company.trading_name}</p>
                    {jobs.length > 0 || loadingRoles ? (
                    <p className="mt-3 text-sm leading-relaxed text-slate-500">
                        These are the current open positions at {company.trading_name} that you
                        might be the right candidate for.
                    </p>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 p-1 text-slate-400 hover:text-slate-700"
                    aria-label="Close open roles"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-5">
                {loadingRoles && jobs.length === 0 ? (
                    <div className="space-y-4 py-5" aria-busy="true">
                        {Array.from({ length: showPremiumGate ? 1 : 6 }).map((_, i) => (
                            <div key={i} className="border-b border-slate-100 py-3">
                                <div className="h-4 w-2/3 animate-pulse bg-slate-200" />
                                <div className="mt-2 h-3 w-1/3 animate-pulse bg-slate-100" />
                            </div>
                        ))}
                    </div>
                ) : jobs.length === 0 ? (
                    <p className="py-10 text-sm text-slate-500">
                        {ZERO_ACTIVE_JOBS_COPY}
                    </p>
                ) : (
                    jobs.map((job) => (
                        <RoleRow key={String(job.id)} job={job} catalogLabel={catalogLabel} />
                    ))
                )}

                {loadingMoreRoles ? (
                    <div className="py-4">
                        <div className="h-4 w-1/2 animate-pulse bg-slate-100" />
                    </div>
                ) : null}

                {canLoadMoreRoles && !loadingMoreRoles ? (
                    <button
                        type="button"
                        onClick={onLoadMore}
                        className="w-full py-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                        Load more roles
                    </button>
                ) : null}

                {showPremiumGate ? (
                    <div className="py-6 text-center">
                        <p className="text-sm font-semibold text-slate-900">1 role on the Free plan</p>
                        <p className="mt-1 text-xs text-slate-500">
                            Upgrade to see every open role at this company.
                        </p>
                        <button
                            type="button"
                            onClick={onUpgrade}
                            className="mt-3 inline-flex items-center gap-1.5 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            View plans
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function CompaniesSearchPremiumModal({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const navigate = useNavigate();

    return (
        <AnimatePresence>
            {open ? (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="companies-search-premium-title"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-full max-w-md overflow-hidden border border-slate-200 bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute left-0 top-0 h-1.5 w-full bg-blue-600" />
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute right-4 top-4 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="p-8 pt-10 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center bg-blue-50">
                                <Lock className="h-7 w-7 text-blue-600" />
                            </div>
                            <h2
                                id="companies-search-premium-title"
                                className="text-xl font-bold text-slate-900"
                            >
                                Premium required
                            </h2>
                            <p className="mt-3 text-sm leading-relaxed text-slate-600">
                                You need Premium to access this feature. Upgrade to search
                                companies across the full directory.
                            </p>
                            <ul className="mt-5 space-y-2 border border-slate-100 bg-slate-50 p-4 text-left text-sm text-slate-600">
                                <li className="flex items-center gap-2">
                                    <Search className="h-4 w-4 shrink-0 text-blue-600" />
                                    Search any company or industry
                                </li>
                                <li className="flex items-center gap-2">
                                    <Crown className="h-4 w-4 shrink-0 text-blue-600" />
                                    Browse the full companies directory
                                </li>
                                <li className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
                                    From £1.99/week or £5.99/month. Jobs board only
                                </li>
                            </ul>
                            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 border border-slate-200 px-4 py-3 font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Not now
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate('/subscription', {
                                            state: { from: '/jobs-portal/companies' },
                                        })
                                    }
                                    className="flex-1 bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
                                >
                                    View plans
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            ) : null}
        </AnimatePresence>
    );
}

export default function CompaniesDirectoryView() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { companyId: companyIdParam } = useParams();
    const [searchParams] = useSearchParams();
    const { catalog, applyCatalog } = useJobsPortalCatalog();
    const qFromUrl = searchParams.get('q') ?? '';
    const urlCompanyId = Number.parseInt(companyIdParam || '', 10);

    const [queryInput, setQueryInput] = useState(qFromUrl);
    const [companies, setCompanies] = useState<PortalCompany[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPremium, setIsPremium] = useState(false);
    const [hasMoreCompanies, setHasMoreCompanies] = useState(false);

    const [jobs, setJobs] = useState<PortalJob[]>([]);
    const [rolesPage, setRolesPage] = useState(1);
    const [rolesTotalPages, setRolesTotalPages] = useState(1);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [loadingMoreRoles, setLoadingMoreRoles] = useState(false);
    const [hasMoreRoles, setHasMoreRoles] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<PortalCompany | null>(null);
    const [rolesOpen, setRolesOpen] = useState(false);
    const [searchPremiumOpen, setSearchPremiumOpen] = useState(false);

    const loadIdRef = useRef(0);
    const rolesIdRef = useRef(0);
    const userPickedRef = useRef(false);
    const hydratedSelectionRef = useRef(false);
    const selectedIdRef = useRef<number | null>(null);
    const accessKnownRef = useRef(false);
    const isPremiumRef = useRef(isPremium);
    isPremiumRef.current = isPremium;

    const searchQuery = qFromUrl.trim();
    const catalogLabel = catalogCountryLabel(catalog);

    useEffect(() => {
        selectedIdRef.current = selectedCompany?.id ?? null;
    }, [selectedCompany]);

    useEffect(() => {
        setQueryInput(qFromUrl);
    }, [qFromUrl]);

    const loadCompanies = useCallback(
        async (pageToLoad: number, append: boolean) => {
            const requestId = ++loadIdRef.current;
            if (append) {
                setLoadingMore(true);
            } else {
                setCompanies([]);
                setLoading(true);
            }
            setError(null);

            try {
                if (!isPremiumRef.current && pageToLoad > 1) {
                    return;
                }
                const result = await getPortalCompanies({
                    page: pageToLoad,
                    q: isPremiumRef.current ? searchQuery || undefined : undefined,
                });
                if (requestId !== loadIdRef.current) return;

                setCompanies((prev) => {
                    const next = !append
                        ? result.companies
                        : (() => {
                              const seen = new Set(prev.map((c) => c.id));
                              return [
                                  ...prev,
                                  ...result.companies.filter((c) => !seen.has(c.id)),
                              ];
                          })();
                    return sortCompaniesByOpenRolesDesc(next);
                });
                setPage(pageToLoad);
                setTotalPages(result.totalPages);
                setIsPremium(result.access?.isPremium ?? false);
                accessKnownRef.current = true;
                setHasMoreCompanies(Boolean(result.access?.hasMoreResults));
                if (
                    result.catalogCountry === 'ireland' ||
                    result.catalogCountry === 'uk'
                ) {
                    applyCatalog(result.catalogCountry);
                }
            } catch (err) {
                if (requestId !== loadIdRef.current) return;
                if (err instanceof JobsPremiumRequiredError) {
                    navigate('/subscription', { state: { from: '/jobs-portal/companies' } });
                    return;
                }
                setError(err instanceof Error ? err.message : 'Failed to load companies');
            } finally {
                if (requestId !== loadIdRef.current) return;
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [applyCatalog, navigate, searchQuery]
    );

    const loadRoles = useCallback(
        async (companyId: number, pageToLoad: number, append: boolean) => {
            const requestId = ++rolesIdRef.current;
            if (append) setLoadingMoreRoles(true);
            else setLoadingRoles(true);

            try {
                if (!isPremiumRef.current && pageToLoad > 1) {
                    return;
                }
                const result = await getPortalCompany({ companyId, page: pageToLoad });
                if (requestId !== rolesIdRef.current) return;
                setSelectedCompany((prev) => {
                    if (prev?.id !== result.company.id) return result.company;
                    return {
                        ...result.company,
                        active_jobs_count:
                            result.company.active_jobs_count ?? prev.active_jobs_count,
                    };
                });
                setCompanies((prev) =>
                    sortCompaniesByOpenRolesDesc(
                        prev.map((c) =>
                            c.id === result.company.id
                                ? {
                                      ...c,
                                      active_jobs_count:
                                          result.company.active_jobs_count ?? c.active_jobs_count,
                                  }
                                : c
                        )
                    )
                );
                setJobs((prev) => {
                    if (!append) return result.jobs;
                    const seen = new Set(prev.map((j) => String(j.id)));
                    return [...prev, ...result.jobs.filter((j) => !seen.has(String(j.id)))];
                });
                setRolesPage(pageToLoad);
                setRolesTotalPages(result.totalPages);
                setIsPremium(result.access?.isPremium ?? false);
                setHasMoreRoles(Boolean(result.access?.hasMoreResults));
                if (
                    result.catalogCountry === 'ireland' ||
                    result.catalogCountry === 'uk'
                ) {
                    applyCatalog(result.catalogCountry);
                }
            } catch (err) {
                if (requestId !== rolesIdRef.current) return;
                if (err instanceof JobsPremiumRequiredError) {
                    navigate('/subscription', {
                        state: { from: `/jobs-portal/companies/${companyId}` },
                    });
                    return;
                }
                if (!append) setJobs([]);
            } finally {
                if (requestId !== rolesIdRef.current) return;
                setLoadingRoles(false);
                setLoadingMoreRoles(false);
            }
        },
        [applyCatalog, navigate]
    );

    useEffect(() => {
        hydratedSelectionRef.current = false;
        userPickedRef.current = false;
        void loadCompanies(1, false);
    }, [loadCompanies]);

    const locationsKey = (user?.preferences?.locations ?? []).join('|');
    const locationsKeyRef = useRef(locationsKey);
    useEffect(() => {
        if (locationsKeyRef.current === locationsKey) return;
        locationsKeyRef.current = locationsKey;
        hydratedSelectionRef.current = false;
        userPickedRef.current = false;
        void loadCompanies(1, false);
    }, [locationsKey, loadCompanies]);

    useEffect(() => {
        fetchBillingStatus()
            .then((billing) => {
                if (accessKnownRef.current) return;
                if (billing) setIsPremium(billing.isJobsPremium);
            })
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        if (hydratedSelectionRef.current || loading) return;
        if (userPickedRef.current) {
            hydratedSelectionRef.current = true;
            return;
        }

        const fromUrl =
            Number.isInteger(urlCompanyId) && urlCompanyId > 0
                ? companies.find((c) => c.id === urlCompanyId)
                : undefined;

        if (fromUrl) {
            hydratedSelectionRef.current = true;
            setSelectedCompany(fromUrl);
            setRolesOpen(false);
            return;
        }

        if (Number.isInteger(urlCompanyId) && urlCompanyId > 0) {
            hydratedSelectionRef.current = true;
            setRolesOpen(false);
            void loadRoles(urlCompanyId, 1, false);
            return;
        }

        hydratedSelectionRef.current = true;
    }, [companies, loading, loadRoles, urlCompanyId]);

    const commitSearch = useCallback(
        (value: string) => {
            if (!isPremium) {
                setSearchPremiumOpen(true);
                return;
            }
            const next = value.trim();
            if (next === searchQuery) return;
            setSelectedCompany(null);
            setRolesOpen(false);
            setJobs([]);
            hydratedSelectionRef.current = false;
            userPickedRef.current = false;
            navigate(companiesListPath(value), { replace: true, preventScrollReset: true });
        },
        [isPremium, navigate, searchQuery]
    );

    useEffect(() => {
        if (!isPremium) return;
        const timeoutId = window.setTimeout(() => {
            commitSearch(queryInput);
        }, 300);
        return () => window.clearTimeout(timeoutId);
    }, [queryInput, isPremium, commitSearch]);

    const handleSelectCompany = (company: PortalCompany) => {
        userPickedRef.current = true;
        if (selectedIdRef.current === company.id) {
            setRolesOpen(false);
            return;
        }
        setSelectedCompany(company);
        setRolesOpen(false);
        setJobs([]);
        setHasMoreRoles(false);
        syncCompanyUrl(company.id, searchQuery);
    };

    const handleViewOpenRoles = () => {
        if (!selectedCompany) return;
        if (openRolesCount(selectedCompany) === 0) return;
        userPickedRef.current = true;
        setRolesOpen(true);
        if (jobs.length === 0 || selectedIdRef.current !== selectedCompany.id) {
            setLoadingRoles(true);
            void loadRoles(selectedCompany.id, 1, false);
        }
    };

    const handleCloseRoles = () => {
        userPickedRef.current = true;
        setRolesOpen(false);
    };

    const handleCloseCompany = () => {
        userPickedRef.current = true;
        setSelectedCompany(null);
        setRolesOpen(false);
        setJobs([]);
        syncCompanyUrl(null, searchQuery);
    };

    const canExploreMore =
        companies.length > 0 && (isPremium ? page < totalPages : hasMoreCompanies);
    const showPremiumGate = !isPremium && hasMoreCompanies;
    const canLoadMoreRoles = isPremium && rolesPage < rolesTotalPages;
    const showDirectorySkeleton = loading && companies.length === 0;

    const handleExploreMore = () => {
        if (!isPremium) {
            navigate('/subscription', { state: { from: '/jobs-portal/companies' } });
            return;
        }
        void loadCompanies(page + 1, true);
    };

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
            <div
                data-tour="companies-directory"
                className="z-20 shrink-0 border-b border-slate-200 bg-white px-4 py-3 lg:px-6"
            >
                <p className="text-lg font-bold text-slate-900">
                    Hiring in {catalogLabel}
                    {isPremium && searchQuery ? (
                        <>
                            {' '}
                            · Results for{' '}
                            <span className="font-semibold text-slate-800">
                                “{searchQuery}”
                            </span>
                        </>
                    ) : null}
                </p>
            </div>
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
                <div
                    className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${
                        selectedCompany
                            ? 'hidden lg:flex lg:min-w-0 lg:flex-1'
                            : 'flex-1'
                    }`}
                >
                    <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-4 pb-10 lg:px-6">
                        {error ? (
                            <div className="py-16 text-center">
                                <p className="text-sm font-medium text-slate-700">{error}</p>
                                <button
                                    type="button"
                                    onClick={() => void loadCompanies(1, false)}
                                    className="mt-3 text-sm font-semibold text-blue-600"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : showDirectorySkeleton ? (
                            <div className="mt-2 divide-y divide-slate-200" aria-busy="true">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="py-6">
                                        <div className="flex gap-3">
                                            <div className="h-9 w-9 shrink-0 animate-pulse bg-slate-200" />
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <div className="h-4 w-40 animate-pulse bg-slate-200" />
                                                <div className="h-3 w-full animate-pulse bg-slate-100" />
                                                <div className="h-3 w-2/3 animate-pulse bg-slate-100" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : companies.length === 0 ? (
                            <div className="py-16 text-center">
                                <p className="text-sm font-semibold text-slate-900">
                                    No matching companies
                                </p>
                                <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                                    {searchQuery
                                        ? 'Try a different company name.'
                                        : 'Change your location in job preferences to see the other catalog.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mt-1">
                                    {companies.map((company) => (
                                        <CompanyRow
                                            key={company.id}
                                            company={
                                                selectedCompany?.id === company.id
                                                    ? selectedCompany
                                                    : company
                                            }
                                            catalog={catalog}
                                            selected={selectedCompany?.id === company.id}
                                            onSelect={() => handleSelectCompany(company)}
                                        />
                                    ))}
                                </div>

                                {showPremiumGate ? (
                                    <div className="py-8 text-center">
                                        <Crown className="mx-auto mb-2 h-5 w-5 text-blue-600" />
                                        <p className="text-sm font-semibold text-slate-900">
                                            10 companies on the Free plan
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate('/subscription', {
                                                    state: { from: '/jobs-portal/companies' },
                                                })
                                            }
                                            className="mt-2 text-sm font-semibold text-blue-600"
                                        >
                                            View plans
                                        </button>
                                    </div>
                                ) : null}

                                <div className="py-8 text-center">
                                    {loadingMore ? (
                                        <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading…
                                        </span>
                                    ) : canExploreMore ? (
                                        <button
                                            type="button"
                                            onClick={handleExploreMore}
                                            className="border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                                        >
                                            Explore more
                                        </button>
                                    ) : null}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {selectedCompany ? (
                    <section
                        className={`relative flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-l border-slate-200 transition-[width] duration-200 ${
                            rolesOpen ? 'lg:w-[520px]' : 'lg:w-[360px]'
                        }`}
                    >
                        <CompanyDetails
                            company={selectedCompany}
                            catalog={catalog}
                            catalogLabel={catalogLabel}
                            showBack
                            onBack={handleCloseCompany}
                            onViewOpenRoles={handleViewOpenRoles}
                        />
                        <AnimatePresence>
                            {rolesOpen ? (
                                <motion.aside
                                    key="open-roles-panel"
                                    initial={{ x: '100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '100%' }}
                                    transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
                                    className="absolute inset-0 z-10 flex flex-col bg-white"
                                >
                                    <OpenRolesPanel
                                        company={selectedCompany}
                                        catalogLabel={catalogLabel}
                                        jobs={jobs}
                                        loadingRoles={loadingRoles}
                                        loadingMoreRoles={loadingMoreRoles}
                                        canLoadMoreRoles={
                                            canLoadMoreRoles &&
                                            jobs.length > 0 &&
                                            (selectedCompany.active_jobs_count ?? 0) > 0
                                        }
                                        showPremiumGate={
                                            !isPremium &&
                                            hasMoreRoles &&
                                            jobs.length > 0 &&
                                            (selectedCompany.active_jobs_count ?? 0) > 0
                                        }
                                        onClose={handleCloseRoles}
                                        onLoadMore={() =>
                                            void loadRoles(
                                                selectedCompany.id,
                                                rolesPage + 1,
                                                true
                                            )
                                        }
                                        onUpgrade={() =>
                                            navigate('/subscription', {
                                                state: {
                                                    from: `/jobs-portal/companies/${selectedCompany.id}`,
                                                },
                                            })
                                        }
                                    />
                                </motion.aside>
                            ) : null}
                        </AnimatePresence>
                    </section>
                ) : null}
            </div>
            <CompaniesSearchPremiumModal
                open={searchPremiumOpen}
                onClose={() => setSearchPremiumOpen(false)}
            />
        </div>
    );
}
