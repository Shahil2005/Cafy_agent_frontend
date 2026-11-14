import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Crown,
  Globe,
  Loader2,
  Lock,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { JobsCompanyLogo } from './JobsCompanyLogo';
import SponsorshipEvidence from './SponsorshipEvidence';
import JobListingEvidence from './JobListingEvidence';
import { ApplyNowButton, ApplyWithAutofillButton, ApplyWithAutofillStatus } from './ApplyWithAutofill';
import { useApplyWithAutofill } from './useApplyWithAutofill';
import { useBillingContext } from '../../context/BillingContext';
import { catalogCountryLabel, companyRolesPath } from './jobsPortalCatalog';
import type { PortalJob } from '../../services/jobsPortalService';
import type { SocOccupationData, SocSalaryTable } from '../../types/soc';

type JobsCatalogCountry = 'uk' | 'ireland';

function resolveCatalogCountryLabel(country: JobsCatalogCountry): string {
  return country === 'ireland' ? 'Ireland' : 'UK';
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fixJobUrl(url: string): string {
  if (!url) return "#";
  if (url.includes("api.smartrecruiters.com")) {
    const match = url.match(/\/companies\/([^/]+)\/postings\/([^/?#]+)/);
    if (match)
      return `https://jobs.smartrecruiters.com/${match[1]}/${match[2]}`;
  }
  return url;
}

export function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth >= 1024;
}

const OPEN_ROLES_TEXT = /\d[\d,]*\s*open roles?\b/i;

function stripOpenRolesFromDescription(description: string): string {
  return description
    .split("\n")
    .filter((line) => !OPEN_ROLES_TEXT.test(line.trim()))
    .join("\n")
    .trim();
}

function jobDescriptionText(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}

function sponsorStatus(job: PortalJob, catalogCountry: JobsCatalogCountry) {
  const licensed =
    catalogCountry === "ireland"
      ? !!job.company?.ireland_permit_employer
      : !!job.company?.licensed_sponsor;
  return {
    licensed,
    pill:
      catalogCountry === "ireland"
        ? "Licensed Irish employment permit employer"
        : "Employer listed as UK sponsor",
    detail:
      catalogCountry === "ireland"
        ? "This employer is on Ireland's employment permits register and may sponsor eligible roles."
        : "An employer licence does not confirm sponsorship for this vacancy. Check the advert and job-level evidence.",
  };
}

function SponsorLicenceCallout({
  job,
  catalogCountry,
}: {
  job: PortalJob;
  catalogCountry: JobsCatalogCountry;
}) {
  const sponsor = sponsorStatus(job, catalogCountry);
  if (!sponsor.licensed) return null;
  // Temporarily hide CoS / employees-sponsored count from job UI.
  return (
    <div className="border border-cafy-200 bg-cafy-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-cafy-700">
        {sponsor.pill}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">{sponsor.detail}</p>
    </div>
  );
}

function jobLocationDisplay(job: PortalJob, catalogCountry: JobsCatalogCountry): string {
  const city = job.city?.trim();
  if (city) return city;
  const loc = job.location?.trim();
  if (loc && !/^(uk|u\.k\.|united kingdom)$/i.test(loc)) return loc;
  return catalogCountryLabel(catalogCountry);
}

function JobFact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function SponsorshipRolesLink({ code }: { code?: string }) {
  const to = code ? `/sponsorship?tab=roles&code=${encodeURIComponent(code)}` : "/sponsorship?tab=roles";
  return (
    <p className="mt-1 text-xs leading-relaxed text-slate-500">
      Check this in the{" "}
      <Link to={to} className="font-medium text-slate-700 underline">
        Roles tab in the Sponsorship Hub
      </Link>
      .
    </p>
  );
}

function gbpAnnual(amount: number | null | undefined): string | null {
  if (amount == null) return null;
  return `£${amount.toLocaleString('en-GB')}`;
}

const GOING_RATE_ROWS = [
  ['Full', 'rate100'],
  ['90%', 'rate90'],
  ['80%', 'rate80'],
  ['70%', 'rate70'],
] as const;

function GoingRateTable({
  median,
  percentile25,
}: {
  median: SocSalaryTable | null;
  percentile25: SocSalaryTable | null;
}) {
  const columns = [
    median ? { key: 'table1', label: median.source, table: median } : null,
    percentile25 ? { key: 'table2', label: percentile25.source, table: percentile25 } : null,
  ].filter((column): column is { key: string; label: string; table: SocSalaryTable } => column != null);
  if (!columns.length) return null;

  const rows = GOING_RATE_ROWS.map(([label, key]) => ({
    label,
    amounts: columns.map((column) => gbpAnnual(column.table[key]?.annual)),
  })).filter((row) => row.amounts.some((amount) => amount != null));
  if (!rows.length) return null;

  return (
    <div>
      <p className="text-xs font-medium text-slate-500">Going rate</p>
      <table className="mt-2 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
            <th className="py-1.5 pr-3 font-medium">Rate</th>
            {columns.map((column) => (
              <th key={column.key} className="py-1.5 pr-3 font-medium">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-slate-100">
              <th className="py-1.5 pr-3 text-left text-xs font-medium text-slate-500">{row.label}</th>
              {row.amounts.map((amount, index) => (
                <td key={columns[index].key} className="py-1.5 pr-3 font-medium text-slate-900">
                  {amount ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function occupationStatus(status: SocOccupationData['sponsorship']['applicantStatus']): string {
  if (status === 'open_to_new_applicants') return 'Open to new applicants';
  if (status === 'legacy_only_existing_visa_holders') return 'Existing visa-holders only';
  return 'Not eligible for sponsorship';
}

function phdLine(eligible: boolean | null): string {
  if (eligible == null) return 'Not stated';
  return eligible ? 'A STEM PhD can reduce the salary' : 'Not eligible';
}

function routeLine(routes: SocOccupationData['sponsorship']['routes']): string {
  if (!routes) return 'None';
  const names = [
    routes.skilledWorker ? 'Skilled Worker' : null,
    routes.globalBusinessMobility ? 'Global Business Mobility' : null,
    routes.scaleUp ? 'Scale-up' : null,
  ].filter((name): name is string => name != null);
  return names.length ? names.join(', ') : 'None';
}

function salaryListLine(soc: SocOccupationData): string {
  const list = soc.sponsorship.immigrationSalaryList;
  if (!list?.length) return 'Not listed';
  return list
    .map((entry) => {
      const nations = Object.entries(entry.nations)
        .filter(([, on]) => on)
        .map(([nation]) => nation)
        .join(', ');
      return [entry.criteria, nations || null, entry.removalDate ? `until ${entry.removalDate}` : null]
        .filter((part): part is string => part != null)
        .join(' · ');
    })
    .join('; ');
}

function JobSocRecord({ code, percent }: { code: string; percent?: number }) {
  const [soc, setSoc] = useState<SocOccupationData | null>(null);

  useEffect(() => {
    let live = true;
    import('../../data/socMaster')
      .then((master) => {
        if (!live) return;
        const occupation = master.lookupSoc(code);
        setSoc(occupation ? master.toSocOccupationData(occupation) : null);
      })
      .catch(() => {
        if (live) setSoc(null);
      });
    return () => {
      live = false;
    };
  }, [code]);

  if (!soc) return null;
  const scale = soc.salary.type === 'national_pay_scale' ? soc.salary.nationalPayScale : null;
  return (
    <div className={percent != null ? 'space-y-3 border-t border-slate-100 pt-3' : 'space-y-3'}>
      {percent != null ? <p className="text-sm font-medium text-slate-900">SOC {code} · {percent}%</p> : null}
      <JobFact label="Occupation status" value={occupationStatus(soc.sponsorship.applicantStatus)} />
      <JobFact label="Skill level" value={soc.skillLevel || 'Not stated'} />
      <JobFact label="PhD" value={phdLine(soc.sponsorship.phdEligible)} />
      {soc.salary.type === 'going_rate' ? (
        <GoingRateTable median={soc.salary.median} percentile25={soc.salary.percentile25} />
      ) : null}
      {soc.salary.type === 'not_eligible' ? (
        <JobFact label="Salary threshold" value="None published for this occupation" />
      ) : null}
      {scale
        ? Object.entries(scale.byNation).map(([nation, entry]) => (
            <JobFact key={nation} label={`Pay scale · ${nation}`} value={entry.rawText.replace(/\|/g, ', ')} />
          ))
        : null}
      <JobFact label="Visa routes" value={routeLine(soc.sponsorship.routes)} />
      <JobFact label="Immigration Salary List" value={salaryListLine(soc)} />
    </div>
  );
}

function JobsSocFacts({ soc, show }: { soc?: PortalJob["soc"]; show: boolean }) {
  if (!show || !soc) return null;
  if (soc.kind === "single") {
    return (
      <div className="space-y-4">
        <JobFact label="SOC code" value={soc.title ? `${soc.code} - ${soc.title}` : soc.code} />
        {soc.reason ? <p className="text-sm leading-relaxed text-slate-700">{soc.reason}</p> : null}
        <p className="text-xs leading-relaxed text-slate-500">
          Matched to one UK SOC 2020 occupation. This is not an official classification of the vacancy, and it is not a sponsorship decision.
        </p>
        <SponsorshipRolesLink code={soc.code} />
        <JobSocRecord code={soc.code} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-500">Possible SOC codes</p>
        <ul className="mt-1 space-y-1">
          {soc.matches.map((match) => (
            <li key={match.code} className="text-sm font-medium text-slate-900">
              {match.code}
              {match.title ? ` - ${match.title}` : ""} · {match.percent}%
            </li>
          ))}
        </ul>
      </div>
      {soc.reason ? <p className="text-sm leading-relaxed text-slate-700">{soc.reason}</p> : null}
      <p className="text-xs leading-relaxed text-slate-500">
        These are the closest SOC 2020 matches. The percentages are shares of that match, not the chance a code is correct, and they are not a sponsorship decision.
      </p>
      <SponsorshipRolesLink />
      {soc.matches.map((match) => (
        <JobSocRecord key={match.code} code={match.code} percent={match.percent} />
      ))}
    </div>
  );
}

function JobListSoc({ soc, show }: { soc?: PortalJob["soc"]; show: boolean }) {
  if (!show || !soc) return null;
  if (soc.kind === "single") {
    return (
      <span className="bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
        SOC {soc.code}
      </span>
    );
  }
  return (
    <>
      {soc.matches.map((match) => (
        <span key={match.code} className="bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
          SOC {match.code} · {match.percent}%
        </span>
      ))}
    </>
  );
}
function websiteHref(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

export function JobsFeedJobList({
  jobs,
  selectedJobId,
  onSelectJob,
  catalogCountry,
  linkCompany = true,
  showLevelAndSponsor = true,
  showSector = true,
}: {
  jobs: PortalJob[];
  selectedJobId: string | number | undefined;
  onSelectJob: (job: PortalJob) => void;
  catalogCountry: JobsCatalogCountry;
  linkCompany?: boolean;
  showLevelAndSponsor?: boolean;
  showSector?: boolean;
}) {
  return (
    <>
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          isSelected={selectedJobId === job.id}
          onClick={() => onSelectJob(job)}
          catalogCountry={catalogCountry}
          linkCompany={linkCompany}
          showLevelAndSponsor={showLevelAndSponsor}
          showSector={showSector}
        />
      ))}
    </>
  );
}

export function JobCardSkeleton({ selected = false }: { selected?: boolean }) {
  return (
    <div
      className={`w-full border-b border-slate-200 px-4 py-5 animate-pulse ${
        selected ? "bg-slate-50" : "bg-white"
      }`}
      aria-hidden
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 bg-slate-200" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-24 bg-slate-200" />
          <div className="h-4 w-2/3 bg-slate-300" />
          <div className="h-3 w-1/2 bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function JobDetailPanelSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white animate-pulse" aria-hidden>
      <div className="space-y-3 px-6 pt-6">
        <div className="h-7 w-3/4 bg-slate-300" />
        <div className="h-3 w-24 bg-slate-200" />
        <div className="flex gap-4 border-b border-slate-200 pt-2">
          <div className="h-8 w-28 bg-slate-200" />
          <div className="h-8 w-20 bg-slate-100" />
        </div>
      </div>
      <div className="flex-1 space-y-3 px-6 py-5">
        <div className="h-24 w-full bg-slate-100" />
        <div className="h-16 w-full bg-slate-100" />
      </div>
      <div className="border-t border-slate-200 p-4">
        <div className="h-11 w-full bg-slate-800" />
      </div>
    </div>
  );
}

export function JobCard({
  job,
  isSelected,
  onClick,
  catalogCountry,
  linkCompany = true,
  showLevelAndSponsor = true,
  showSector = true,
}: {
  job: PortalJob;
  isSelected: boolean;
  onClick: () => void;
  catalogCountry: JobsCatalogCountry;
  linkCompany?: boolean;
  showLevelAndSponsor?: boolean;
  showSector?: boolean;
}) {
  const navigate = useNavigate();
  const company = job.company;
  const companyHref = linkCompany && company?.id ? companyRolesPath(company.id) : null;
  const locationFallback = resolveCatalogCountryLabel(catalogCountry);
  const sponsor = sponsorStatus(job, catalogCountry);
  const locationLabel = job.city?.trim() || job.location || locationFallback;

  return (
    <article
      className={`border-b border-slate-200 px-4 py-5 ${
        isSelected ? "bg-slate-50" : "bg-white hover:bg-slate-50/70"
      }`}
    >
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="flex min-w-0 items-center gap-2">
            <JobsCompanyLogo
              companyName={company?.trading_name}
              faviconUrl={company?.url_favicon}
              size={28}
              rounded={false}
            />
            {companyHref ? (
              <span
                role="link"
                tabIndex={0}
                className="truncate text-sm text-slate-600 hover:text-slate-900 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  navigate(companyHref);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    navigate(companyHref);
                  }
                }}
              >
                {company?.trading_name}
              </span>
            ) : (
              <span className="truncate text-sm text-slate-600">
                {company?.trading_name || "Unknown Company"}
              </span>
            )}
        </div>

        <h3 className="mt-2 line-clamp-2 break-words text-[15px] font-semibold text-slate-900">{job.title}</h3>
        {job.listingEvidence && <p className="mt-1 text-xs text-slate-500">{job.salary || 'Pay: see employer advert'}</p>}
        {job.listingEvidence && job.feedSegment === 'remainder' && <p className="mt-1 text-xs text-slate-500">More roles to explore</p>}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.jobType ? (
            <span className="bg-cafy-100 px-2.5 py-0.5 text-[11px] font-semibold text-cafy-800">
              {job.jobType}
            </span>
          ) : null}
          {showLevelAndSponsor && job.level ? (
            <span className="bg-cafy-100 px-2.5 py-0.5 text-[11px] font-semibold text-cafy-800">
              {job.level}
            </span>
          ) : null}
          {locationLabel ? (
            <span className="bg-cafy-100 px-2.5 py-0.5 text-[11px] font-semibold text-cafy-800">
              {locationLabel}
            </span>
          ) : null}
          {showSector && job.sector ? (
            <span className="bg-cafy-100 px-2.5 py-0.5 text-[11px] font-semibold text-cafy-800">
              {job.sector}
            </span>
          ) : null}
          {showLevelAndSponsor && (sponsor.licensed || job.sponsorshipAssessment) ? (
            <span className="rounded-full bg-cafy-800 px-2.5 py-0.5 text-[11px] font-medium text-white">
              {job.sponsorshipAssessment ? (job.sponsorshipAssessment.verdict === 'advert_supported' ? 'Advert states sponsorship available' : 'Sponsorship potential') : sponsor.pill}
            </span>
          ) : null}
          <JobListSoc soc={job.soc} show={catalogCountry === "uk" && showLevelAndSponsor} />
          {job.hasReported ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
              Reported
            </span>
          ) : null}
        </div>
      </button>
    </article>
  );
}

type JobDetailTab = "about" | "jobInfo";

/** Account-only actions shown to logged-out visitors; each opens the signup gate. */
export type GatedJobAction = "apply" | "report";

export function JobDetailPanel({
  job,
  onClose,
  onReport,
  catalogCountry,
  linkCompany = true,
  showLevelAndSponsor = true,
  showSector = true,
  jobInfoFirst = false,
  detailLoading = false,
  showJobDescription = true,
  onGatedAction,
}: {
  job: PortalJob;
  onClose: () => void;
  onReport: (job: PortalJob, reason: string) => Promise<void>;
  catalogCountry: JobsCatalogCountry;
  linkCompany?: boolean;
  showLevelAndSponsor?: boolean;
  showSector?: boolean;
  /** Part-time jobs: Job info tab before About. Jobs portal keeps About first. */
  jobInfoFirst?: boolean;
  /** True while the full job (description / company about) is still loading. */
  detailLoading?: boolean;
  /** The job description isn't shown in the Jobs and Part-time jobs tabs or on the public jobs pages. */
  showJobDescription?: boolean;
  /** Logged-out preview: Apply / Report open the signup gate instead of acting. */
  onGatedAction?: (action: GatedJobAction) => void;
}) {
  const company = job.company;
  const jobUrl = fixJobUrl(job.url);
  const gatedApply = onGatedAction ? () => onGatedAction("apply") : undefined;
  const autofill = useApplyWithAutofill(jobUrl, String(job.id), gatedApply);
  const sponsor = sponsorStatus(job, catalogCountry);
  const showSponsor = showLevelAndSponsor && sponsor.licensed;
  const about = company?.description
    ? stripOpenRolesFromDescription(company.description)
    : "";
  const description = showJobDescription ? jobDescriptionText(job.description) : "";
  const scrollRef = useRef<HTMLDivElement>(null);
  const defaultTab: JobDetailTab = jobInfoFirst ? "jobInfo" : "about";
  const [activeTab, setActiveTab] = useState<JobDetailTab>(defaultTab);
  const [reportStatus, setReportStatus] = useState<
    "idle" | "reported" | "already_reported"
  >("idle");
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("Listing is expired");
  const [otherReason, setOtherReason] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    setReportStatus(job.hasReported ? "already_reported" : "idle");
    setShowReportForm(false);
    setReportReason("Listing is expired");
    setOtherReason("");
    setReportError(null);
    setActiveTab(jobInfoFirst ? "jobInfo" : "about");
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [job.id, job.hasReported, jobInfoFirst]);

  const handleReportSubmit = async () => {
    const finalReason = reportReason === "Other" ? otherReason : reportReason;
    if (reportStatus !== "idle" || !finalReason.trim()) return;
    setReportError(null);
    try {
      await onReport(job, finalReason);
      setReportStatus("reported");
      setShowReportForm(false);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("already reported")) {
        setReportStatus("already_reported");
        setShowReportForm(false);
      } else if (
        msg.includes("no longer exists") ||
        msg.includes("no longer active")
      ) {
        setReportError(
          "This job listing is no longer active and cannot be reported.",
        );
      } else {
        setReportError(msg || "Failed to submit report");
      }
    }
  };

  const legalName =
    company?.companies_house_name &&
    company.companies_house_name !== company.trading_name
      ? company.companies_house_name
      : null;

  const tabs: Array<{ id: JobDetailTab; label: string }> = jobInfoFirst
    ? [
        { id: "jobInfo", label: "Job info" },
        { id: "about", label: "About" },
      ]
    : [
        { id: "about", label: "About" },
        { id: "jobInfo", label: "Job info" },
      ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="shrink-0 px-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-snug text-slate-900">
              {job.title}
            </h2>
            {job.department ? (
              <p className="mt-1 text-sm text-slate-500">{job.department}</p>
            ) : showSector && job.sector ? (
              <p className="mt-1 text-sm text-slate-500">{job.sector}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 text-slate-400 hover:text-slate-700 lg:hidden"
            aria-label="Close job details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {company ? (
          <div className="mt-4 flex items-center gap-2">
            <JobsCompanyLogo
              companyName={company.trading_name}
              faviconUrl={company.url_favicon}
              size={28}
              rounded={false}
            />
            {linkCompany && company.id ? (
              <Link
                to={companyRolesPath(company.id)}
                className="text-sm font-medium text-slate-800 hover:underline"
              >
                {company.trading_name}
              </Link>
            ) : (
              <span className="text-sm font-medium text-slate-800">
                {company.trading_name}
              </span>
            )}
          </div>
        ) : null}

        <div className="mt-5 flex items-end gap-4 border-b border-slate-200">
        <div className="flex" role="tablist" aria-label="Job details">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`job-detail-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`job-detail-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = 0;
                  }
                }}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${
                  selected
                    ? "border-cafy-600 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
          <div className="pb-2">
            <ApplyWithAutofillButton jobId={String(job.id)} control={autofill} />
          </div>
        </div>
        <ApplyWithAutofillStatus jobId={String(job.id)} jobUrl={jobUrl} control={autofill} />
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
        <JobListingEvidence job={job} />
        {catalogCountry === 'uk' && <SponsorshipEvidence assessment={job.sponsorshipAssessment} />}
        {activeTab === "about" ? (
          <div
            role="tabpanel"
            id="job-detail-panel-about"
            aria-labelledby="job-detail-tab-about"
          >
            {company ? (
              <>
                {showSponsor ? (
                  <SponsorLicenceCallout job={job} catalogCountry={catalogCountry} />
                ) : null}
                {legalName ? (
                  <p className={`text-sm text-slate-500 ${showSponsor ? "mt-4" : ""}`}>
                    {legalName}
                  </p>
                ) : null}
                {(company.url || company.url_linkedin) && (
                  <div className={`${legalName || showSponsor ? "mt-4" : ""} flex flex-wrap gap-2`}>
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
                        <LinkedInGlyph className="h-3.5 w-3.5 text-slate-500" />
                        LinkedIn
                      </a>
                    ) : null}
                  </div>
                )}
                {about ? (
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{about}</p>
                ) : detailLoading ? (
                  <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading company overview">
                    <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No company overview is available.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Company details are not available for this listing.
              </p>
            )}
          </div>
        ) : (
          <div
            role="tabpanel"
            id="job-detail-panel-jobInfo"
            aria-labelledby="job-detail-tab-jobInfo"
            className="space-y-5"
          >
            {showJobDescription && detailLoading && !description ? (
              <div
                className="space-y-5"
                aria-busy="true"
                aria-label="Loading job details"
              >
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
                  Loading job details…
                </div>
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                      <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <JobFact
                    label="Location"
                    value={jobLocationDisplay(job, catalogCountry)}
                  />
                  {showLevelAndSponsor ? <JobFact label="Level" value={job.level} /> : null}
                  <JobFact label="Job type" value={job.jobType} />
                  {showSector ? <JobFact label="Sector" value={job.sector} /> : null}
                  <JobsSocFacts soc={job.soc} show={catalogCountry === "uk" && !jobInfoFirst} />
                </div>
                {showJobDescription ? (
                  <div>
                    <p className="text-xs font-medium text-slate-500">Job description</p>
                    {description ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                        {description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No job description is available for this listing.
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 px-6 py-4">
        <ApplyNowButton jobUrl={jobUrl} onGatedApply={gatedApply} />
        {!showReportForm && reportStatus === "idle" && (
          <button
            type="button"
            onClick={() => (onGatedAction ? onGatedAction("report") : setShowReportForm(true))}
            className="mt-2 flex w-full items-center justify-center gap-1.5 py-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Report an issue with this job
          </button>
        )}

        {showReportForm && reportStatus === "idle" && (
          <div className="mt-3 flex flex-col gap-3 border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-cafy-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Report job listing
                </p>
                <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                  Help us keep the job board clean and accurate.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Reason
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-cafy-500"
                >
                  <option value="Listing is expired">Listing is expired</option>
                  <option value="Link is broken">Link is broken</option>
                  <option value="Not a sponsored role">
                    Not a sponsored role
                  </option>
                  <option value="Spam or fraudulent">Spam or fraudulent</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {reportReason === "Other" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Additional details
                  </label>
                  <textarea
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    placeholder="Please provide more specifics..."
                    className="min-h-[70px] w-full resize-none border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-cafy-500"
                  />
                </div>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={handleReportSubmit}
                className="flex flex-1 items-center justify-center bg-cafy-600 py-2 text-xs font-bold text-white hover:bg-cafy-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={reportReason === "Other" && !otherReason.trim()}
              >
                Submit report
              </button>
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
            {reportError && (
              <p className="mt-1 text-center text-xs font-medium text-red-600">
                {reportError}
              </p>
            )}
          </div>
        )}

        {reportStatus === "reported" && (
          <div className="mt-2 cursor-default text-center text-xs text-slate-400">
            Reported. Thanks!
          </div>
        )}

        {reportStatus === "already_reported" && (
          <div className="mt-2 cursor-default bg-amber-50 py-1.5 text-center text-xs font-medium text-amber-700">
            <AlertCircle className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
            You have already reported this job
          </div>
        )}
      </div>
    </div>
  );
}

/** Which feed an upgrade prompt belongs to; part-time is unlocked by a cheaper plan too. */
export type UpgradePromptVariant = 'jobs' | 'partTime';

/** Live plan prices ("£0.99/week"); null for a plan that is not on sale. */
function usePlanPrices(): Record<'partTime' | 'jobsWeekly' | 'jobsMonthly', string | null> {
  const { pricingByPlan } = useBillingContext();
  const label = (plan: (typeof pricingByPlan)[keyof typeof pricingByPlan] | undefined) =>
    plan?.priceId && plan.priceDisplay ? `${plan.priceDisplay}${plan.pricePeriod ?? ''}` : null;
  return {
    partTime: label(pricingByPlan.part_time_weekly),
    jobsWeekly: label(pricingByPlan.weekly),
    jobsMonthly: label(pricingByPlan.jobs_monthly),
  };
}

function jobsPlanPriceLine(prices: ReturnType<typeof usePlanPrices>): string {
  const options = [prices.jobsWeekly, prices.jobsMonthly].filter(Boolean);
  if (options.length === 0) return 'Included in Jobs Premium and Premium';
  return `From ${options.join(' or ')}. Jobs board only`;
}

export function JobsPremiumSearchPreview({
  totalCount,
  upgradeFrom = "/jobs-portal",
  variant = "jobs",
}: {
  totalCount: number;
  upgradeFrom?: string;
  variant?: UpgradePromptVariant;
}) {
  const navigate = useNavigate();
  const partTimePrice = usePlanPrices().partTime;
  const isPartTime = variant === "partTime";

  return (
    <div className="w-full mt-2 space-y-3">
      <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 text-center">
        <Lock className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-900">
          {totalCount.toLocaleString()} {isPartTime ? "part-time jobs" : "jobs"} match your search
        </p>
        <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
          {isPartTime
            ? `You're viewing 1 preview job. Get the Part-time plan${partTimePrice ? ` (${partTimePrice})` : ""} to see all matches.`
            : "You're viewing 1 preview job. Get Jobs Premium to see all matches."}
        </p>
        <button
          type="button"
          onClick={() =>
            navigate("/subscription", { state: { from: upgradeFrom } })
          }
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700"
        >
          <Sparkles className="w-4 h-4" />
          View plans
        </button>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="relative rounded-xl border border-slate-200 bg-white p-4 overflow-hidden select-none pointer-events-none"
        >
          <div className="flex gap-3 blur-[6px] opacity-70">
            <div className="w-10 h-10 rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 bg-slate-200 rounded" />
              <div className="h-2 w-1/2 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobsExplorePremiumModal({
  open,
  onClose,
  totalCount,
  upgradeFrom = "/jobs-portal",
  variant = "jobs",
}: {
  open: boolean;
  onClose: () => void;
  totalCount: number;
  upgradeFrom?: string;
  variant?: UpgradePromptVariant;
}) {
  const navigate = useNavigate();
  const moreCount = Math.max(0, totalCount - 10);
  const prices = usePlanPrices();
  const partTimePrice = prices.partTime;
  const isPartTime = variant === "partTime";

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jobs-premium-modal-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 pt-10 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Lock className="w-7 h-7 text-indigo-600" />
              </div>
              <h2
                id="jobs-premium-modal-title"
                className="text-xl font-bold text-slate-900"
              >
                {isPartTime ? "Explore more part-time jobs" : "Explore more jobs"}
              </h2>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                You&apos;re viewing <strong>10 {isPartTime ? "part-time jobs" : "jobs"}</strong> on the Free plan.
                {moreCount > 0 && (
                  <>
                    {" "}
                    <strong>{moreCount.toLocaleString()} more</strong>{" "}
                    {isPartTime
                      ? "part-time jobs are available with the Part-time plan, Jobs Premium or Premium."
                      : "jobs are available with Jobs Premium or full Premium."}
                  </>
                )}
              </p>
              <ul className="mt-5 text-left text-sm text-slate-600 space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <li className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-indigo-600 shrink-0" />
                  {isPartTime ? "Browse all UK part-time jobs" : "Browse all jobs (Explore more)"}
                </li>
                <li className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-600 shrink-0" />
                  {isPartTime ? "Full search and location results" : "Full job search results"}
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  {isPartTime
                    ? partTimePrice
                      ? `Part-time plan from ${partTimePrice}`
                      : "Included in the Part-time plan, Jobs Premium and Premium"
                    : jobsPlanPriceLine(prices)}
                </li>
              </ul>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/subscription", {
                      state: { from: upgradeFrom },
                    })
                  }
                  className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md"
                >
                  View plans
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
