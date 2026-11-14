import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  isDesktopViewport,
  JobCardSkeleton,
  JobDetailPanel,
  JobDetailPanelSkeleton,
  JobsExplorePremiumModal,
  JobsFeedJobList,
  JobsPremiumSearchPreview,
} from "./jobsFeedChrome";
import {
  getPartTimeJobs,
  partTimeReportJobId,
  reportPortalJob,
  JobsPremiumRequiredError,
  PartTimeUkOnlyError,
  type PortalJob,
  type JobsPortalAccessMeta,
} from "../../services/jobsPortalService";
import { fetchBillingStatus } from "../../services/billingService";
import { useAuth } from "../../hooks/useAuth";
import { isIrelandCareerLocation } from "../../utils/sponsorshipHubRouting";
import { PART_TIME_UK_CITIES, officialPartTimeCity } from "../../data/partTimeUkCities";
import { consumePendingJobsIntent, peekPendingJobsIntent } from "./public/publicJobsStorage";
import UkOnlyFeatureNotice from "../common/UkOnlyFeatureNotice";
import { JobsCompanyLogo } from "./JobsCompanyLogo";

const UPGRADE_FROM = "/part-time-jobs";
const SEARCH_MAX_LENGTH = 100;
const NHS_PART_TIME_JOBS_URL =
  "https://www.jobs.nhs.uk/candidate/search/results?sort=publicationDateDesc&searchFormType=filters&workingPattern=part-time&language=en";
/** Same stored employer icon the NHS job cards use (part_time_companies_UK). */
const NHS_ICON_URL =
  "https://jbuikhbssecxhfunkaol.supabase.co/storage/v1/object/public/company_icons/33c3e8fe-0259-49ae-a796-269d7c2b56e2.png";

/** Pinned first card: opens the official NHS Jobs part-time search in a new tab. */
function NhsPartTimeJobsCard() {
  return (
    <article className="border-b border-slate-200 bg-cafy-50/40 px-4 py-5 hover:bg-cafy-50/70">
      <a
        href={NHS_PART_TIME_JOBS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-full text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <JobsCompanyLogo
            companyName="NHS"
            faviconUrl={NHS_ICON_URL}
            size={28}
            rounded={false}
          />
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-cafy-700 underline decoration-cafy-300 underline-offset-4 group-hover:text-cafy-800 group-hover:decoration-cafy-700">
            NHS part-time jobs
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          </h3>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Search all part-time NHS roles across the UK on the official NHS Jobs website.
        </p>
      </a>
    </article>
  );
}

export default function PartTimeJobsFeedView() {
  const navigate = useNavigate();
  const { user, profileLoaded } = useAuth();
  const irelandProfile = isIrelandCareerLocation(user?.preferences?.locations);
  const [ukOnlyFromApi, setUkOnlyFromApi] = useState(false);

  const [jobs, setJobs] = useState<PortalJob[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [globalTotalCount, setGlobalTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingPage, setPendingPage] = useState<number | null>(1);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<PortalJob | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [portalAccess, setPortalAccess] = useState<JobsPortalAccessMeta | null>(null);
  const [browsePremiumGateOpen, setBrowsePremiumGateOpen] = useState(false);
  // City chosen on the logged-out part-time preview (read here, cleared in the effect below).
  const [city, setCity] = useState(() => {
    const intent = peekPendingJobsIntent();
    return intent?.toolId === "part-time-jobs" ? (intent.partTimeCity ?? "") : "";
  });

  useEffect(() => {
    if (peekPendingJobsIntent()?.toolId === "part-time-jobs") consumePendingJobsIntent();
  }, []);
  const [roleInput, setRoleInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const cityMenuRef = useRef<HTMLDivElement>(null);
  const cityOptions = PART_TIME_UK_CITIES;
  const jobListRef = useRef<HTMLDivElement>(null);
  const loadRequestIdRef = useRef(0);
  const userPickedJobRef = useRef(false);

  useEffect(() => {
    if (!cityMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!cityMenuRef.current?.contains(event.target as Node)) setCityMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCityMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [cityMenuOpen]);

  const handleSelectJob = useCallback((job: PortalJob) => {
    userPickedJobRef.current = true;
    setSelectedJob(job);
  }, []);

  const replacingList = loading && pendingPage === 1;
  const showJobsSkeleton = replacingList;
  const showEmptyState = initialFetchDone && !loading && jobs.length === 0;
  const showHeaderCountLoading = replacingList;
  const freeHasMoreResults = portalAccess?.hasMoreResults === true;
  const upsellTotalCount = portalAccess?.trueTotalCount ?? totalCount;
  const isSearchActive = Boolean(roleQuery || companyQuery);
  const isFilterActive = isSearchActive || Boolean(city);
  // Backend decides the mode: a role of only filler words ("part time jobs") stays browse.
  const isSearchMode = portalAccess?.mode === "search";
  const showSearchUpsell =
    !isPremium && isSearchMode && freeHasMoreResults && jobs.length > 0;
  const showBrowsePremiumModal =
    browsePremiumGateOpen && !isPremium && !isSearchMode && freeHasMoreResults;
  const canExploreMore =
    jobs.length > 0 &&
    !showSearchUpsell &&
    (isPremium ? hasMore : freeHasMoreResults);
  // Free search responses cap totalCount at the preview size; show the real match count.
  const matchCount = isPremium ? totalCount : upsellTotalCount;

  const loadJobs = async (
    pageToLoad = 1,
    cityFilter = city,
    role = roleQuery,
    company = companyQuery,
  ) => {
    const requestId = ++loadRequestIdRef.current;
    const validatedCity = cityFilter ? officialPartTimeCity(cityFilter) : null;
    if (cityFilter && !validatedCity) {
      setError("Choose a valid UK location.");
      setLoading(false);
      setPendingPage(null);
      return;
    }

    setLoading(true);
    setPendingPage(pageToLoad);
    setError(null);
    if (pageToLoad === 1) setBrowsePremiumGateOpen(false);

    try {
      const result = await getPartTimeJobs({
        page: pageToLoad,
        city: validatedCity || undefined,
        role: role || undefined,
        company: company || undefined,
      });
      if (requestId !== loadRequestIdRef.current) return;

      if (result.access) {
        setIsPremium(result.access.isPremium);
        setPortalAccess(result.access);
      }

      if (pageToLoad === 1) {
        setJobs(result.jobs);
        setTotalCount(result.totalCount || 0);
        setGlobalTotalCount(result.globalTotalCount || 0);
        setCurrentPage(1);
        const premium = result.access?.isPremium ?? false;
        setHasMore(premium && result.totalPages > 1);
        setSelectedJob((prev) => {
          if (!isDesktopViewport()) return null;
          if (result.jobs.length === 0) return null;
          if (!userPickedJobRef.current) {
            return result.jobs[0];
          }
          if (
            prev &&
            result.jobs.some(
              (j) => j.id === prev.id || (j.url && prev.url && j.url === prev.url),
            )
          ) {
            return result.jobs.find(
              (j) => j.id === prev.id || (j.url && prev.url && j.url === prev.url),
            )!;
          }
          return result.jobs[0];
        });
      } else {
        setJobs((prev) => {
          const existingIds = new Set(prev.map((j) => String(j.id)));
          const existingUrls = new Set(
            prev.map((j) => (typeof j.url === "string" ? j.url.trim() : "")).filter(Boolean),
          );
          const newJobs = result.jobs.filter((j) => {
            if (existingIds.has(String(j.id))) return false;
            const url = typeof j.url === "string" ? j.url.trim() : "";
            if (url && existingUrls.has(url)) return false;
            return true;
          });
          return [...prev, ...newJobs];
        });
        setCurrentPage(pageToLoad);
        const premium = result.access?.isPremium ?? false;
        setHasMore(premium && pageToLoad < result.totalPages);
      }
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;
      if (err instanceof PartTimeUkOnlyError) {
        setUkOnlyFromApi(true);
        return;
      }
      if (err instanceof JobsPremiumRequiredError) {
        navigate("/subscription", { state: { from: UPGRADE_FROM } });
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      // Only the latest request may clear loading state.
      if (requestId === loadRequestIdRef.current) {
        if (pageToLoad === 1) setInitialFetchDone(true);
        setLoading(false);
        setPendingPage(null);
      }
    }
  };

  useEffect(() => {
    if (loading || jobs.length === 0 || !isDesktopViewport() || userPickedJobRef.current) return;
    setSelectedJob((prev) => prev ?? jobs[0]);
  }, [loading, jobs]);

  useEffect(() => {
    if (!profileLoaded || irelandProfile) return;
    userPickedJobRef.current = false;
    void loadJobs(1, city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded, irelandProfile, city]);

  useEffect(() => {
    if (!profileLoaded || irelandProfile) return;
    fetchBillingStatus()
      .then((billing) => {
        if (billing) setIsPremium(billing.isPartTimePremium);
      })
      .catch((err) => {
        console.warn("Failed to load billing status", err);
      });
  }, [profileLoaded, irelandProfile]);

  const handleExploreMore = () => {
    if (!isPremium) {
      setBrowsePremiumGateOpen(true);
      return;
    }
    void loadJobs(currentPage + 1, city);
  };

  const applySearch = (roleValue: string, companyValue: string) => {
    const role = roleValue.trim();
    const company = companyValue.trim();
    if (role === roleQuery && company === companyQuery) return;
    userPickedJobRef.current = false;
    setRoleQuery(role);
    setCompanyQuery(company);
    void loadJobs(1, city, role, company);
  };

  const handleSearchSubmit = () => {
    applySearch(roleInput, companyInput);
  };

  const handleSearchClear = () => {
    setRoleInput("");
    setCompanyInput("");
    applySearch("", "");
  };

  const searchSubtitle = [
    roleQuery ? (
      <span key="role">
        role <span className="font-medium text-slate-800">"{roleQuery}"</span>
      </span>
    ) : null,
    companyQuery ? (
      <span key="company">
        at <span className="font-medium text-slate-800">"{companyQuery}"</span>
      </span>
    ) : null,
    city ? (
      <span key="city">
        in <span className="font-medium text-slate-800">{city}</span>
      </span>
    ) : null,
  ]
    .filter(Boolean)
    .flatMap((part, i) => (i === 0 ? [part] : [" ", part]));

  useEffect(() => {
    const handleResize = () => {
      if (!isDesktopViewport()) setSelectedJob(null);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleReport = async (job: PortalJob, reason: string) => {
    await reportPortalJob(
      partTimeReportJobId(job.id),
      job.title,
      job.company?.trading_name,
      reason,
      job.url,
    );
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, hasReported: true } : j)));
    if (selectedJob?.id === job.id) {
      setSelectedJob({ ...selectedJob, hasReported: true });
    }
  };

  if (!profileLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (irelandProfile || ukOnlyFromApi) {
    return (
      <UkOnlyFeatureNotice
        title="Part-time jobs aren't available for Ireland yet"
        body="This catalog covers United Kingdom part-time roles only. You can keep using the rest of Cafy — update your location in Profile if this was set incorrectly."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <p className="sr-only" aria-live="polite">
        {showJobsSkeleton ? "Loading jobs…" : ""}
      </p>

      <div className="z-20 shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <div data-tour="part-time-search" className="mb-3 flex w-full flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {replacingList && isSearchActive ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden />
              ) : (
                <Search className="h-4 w-4 text-slate-500" />
              )}
            </div>
            <input
              type="text"
              placeholder="Job role, e.g. barista"
              maxLength={SEARCH_MAX_LENGTH}
              className="w-full border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cafy-600 focus:bg-white focus:outline-none"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              aria-label="Job role"
              aria-busy={replacingList}
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Building2 className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Company, e.g. KFC"
              maxLength={SEARCH_MAX_LENGTH}
              className="w-full border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cafy-600 focus:bg-white focus:outline-none"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              aria-label="Company (optional)"
              aria-busy={replacingList}
            />
            {(roleInput || companyInput) && (
              <button
                onClick={handleSearchClear}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                title="Clear search"
                aria-label="Clear search"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearchSubmit}
            disabled={replacingList}
            className="inline-flex min-w-[5.5rem] shrink-0 items-center justify-center bg-cafy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cafy-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {replacingList && isSearchActive ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span className="ml-2 hidden sm:inline">Loading</span>
              </>
            ) : (
              "Search"
            )}
          </button>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-8">
          <div ref={cityMenuRef} className="relative w-full lg:w-72">
            <button
              type="button"
              className="flex h-11 w-full items-center gap-3 border-2 border-slate-800 bg-white px-3 text-left disabled:opacity-60"
              data-tour="part-time-city"
              aria-label="Filter part-time jobs by location"
              aria-haspopup="listbox"
              aria-expanded={cityMenuOpen}
              aria-busy={replacingList}
              disabled={replacingList}
              onClick={() => setCityMenuOpen((open) => !open)}
            >
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Location
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                {city || "All locations"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-700" aria-hidden />
            </button>
            {cityMenuOpen ? (
              <ul
                role="listbox"
                aria-label="Locations"
                className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto border border-slate-200 bg-white py-1 shadow-lg"
              >
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={city === ""}
                    className={`w-full px-3 py-2 text-left text-sm ${city === "" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
                    onClick={() => {
                      setCity("");
                      setCityMenuOpen(false);
                    }}
                  >
                    All locations
                  </button>
                </li>
                {cityOptions.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={city === name}
                      className={`w-full px-3 py-2 text-left text-sm ${city === name ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
                      onClick={() => {
                        const next = officialPartTimeCity(name);
                        if (!next) return;
                        setCity(next);
                        setCityMenuOpen(false);
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <p className="flex items-center gap-2 text-sm text-slate-500">
            {replacingList && initialFetchDone ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
            ) : null}
            {showHeaderCountLoading ? (
              "Loading jobs…"
            ) : (
              <>
                <span className="font-semibold text-slate-900">
                  {(isFilterActive ? matchCount : globalTotalCount).toLocaleString()}
                </span>
                {isFilterActive ? "matching jobs" : "active jobs"}
              </>
            )}
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="py-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
            <p className="font-medium text-slate-600">{error}</p>
            <button
              onClick={() => void loadJobs()}
              className="mt-4 text-sm text-blue-600 underline"
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_520px] lg:grid-rows-[minmax(0,1fr)]">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden lg:border-r lg:border-slate-200">
            {isSearchActive && !replacingList && jobs.length > 0 ? (
              <div className="mx-4 mt-4 shrink-0 bg-[#f6f1e4] px-4 py-3 text-sm text-slate-700">
                <p>
                  Showing{" "}
                  <span className="font-medium text-slate-900">
                    {totalCount.toLocaleString()}
                    {freeHasMoreResults && upsellTotalCount > totalCount
                      ? ` preview of ${upsellTotalCount.toLocaleString()}`
                      : ""}
                  </span>{" "}
                  jobs for {searchSubtitle}.{" "}
                  <button
                    type="button"
                    onClick={handleSearchClear}
                    className="underline underline-offset-2 hover:text-slate-900"
                  >
                    Clear search
                  </button>
                </p>
              </div>
            ) : null}
            {showEmptyState ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center border border-slate-100 bg-slate-50">
                  <Briefcase className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-slate-900">
                  {isSearchActive
                    ? "No matching part-time jobs"
                    : city
                      ? `No part-time jobs in ${city}`
                      : "No part-time jobs"}
                </h3>
                <p className="max-w-[320px] text-sm leading-relaxed text-slate-500">
                  {isSearchActive
                    ? "No jobs matched your search. Try a different role, company, or location from the list."
                    : city
                      ? `There are no part-time jobs in ${city} right now.`
                      : "There are currently no active part-time vacancies. Check back again soon!"}
                </p>
                {isSearchActive ? (
                  <button
                    type="button"
                    onClick={handleSearchClear}
                    className="mt-4 text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900"
                  >
                    Clear search
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                ref={jobListRef}
                className="min-h-0 flex-1 overflow-y-auto custom-scrollbar"
                aria-busy={loading}
              >
                <NhsPartTimeJobsCard />
                {showJobsSkeleton ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <JobCardSkeleton key={i} selected={i === 0} />
                  ))
                ) : (
                  <JobsFeedJobList
                    jobs={jobs}
                    selectedJobId={selectedJob?.id}
                    onSelectJob={handleSelectJob}
                    catalogCountry="uk"
                    linkCompany={false}
                    showLevelAndSponsor={false}
                    showSector={false}
                  />
                )}

                {showSearchUpsell && (
                  <div className="px-4 pb-4">
                    <JobsPremiumSearchPreview
                      totalCount={upsellTotalCount}
                      upgradeFrom={UPGRADE_FROM}
                      variant="partTime"
                    />
                  </div>
                )}

                <div className="flex flex-col items-center gap-4 pb-10 pt-6">
                  {loading && pendingPage !== null && pendingPage > 1 && (
                    <>
                      <div className="flex items-center gap-2 font-semibold text-slate-700">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                        <span className="text-sm">Loading more jobs…</span>
                      </div>
                      <div className="w-full">
                        <JobCardSkeleton />
                        <JobCardSkeleton />
                      </div>
                    </>
                  )}

                  {!loading && canExploreMore && (
                    <button
                      type="button"
                      onClick={handleExploreMore}
                      className="border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                    >
                      Explore more
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden min-h-0 min-w-0 flex-col overflow-hidden lg:flex">
            {showJobsSkeleton ? (
              <JobDetailPanelSkeleton />
            ) : selectedJob ? (
              <JobDetailPanel
                job={selectedJob}
                onClose={() => setSelectedJob(null)}
                onReport={handleReport}
                catalogCountry="uk"
                linkCompany={false}
                showLevelAndSponsor={false}
                showSector={false}
                jobInfoFirst
                showJobDescription={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-sm text-slate-400">
                Select a job to see details
              </div>
            )}
          </div>
        </div>
      )}

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white lg:hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <button
              onClick={() => setSelectedJob(null)}
              className="rounded-lg p-1.5 hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <span className="truncate text-sm font-semibold text-slate-700">Back to jobs</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <JobDetailPanel
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
              onReport={handleReport}
              catalogCountry="uk"
              linkCompany={false}
              showLevelAndSponsor={false}
              showSector={false}
              jobInfoFirst
              showJobDescription={false}
            />
          </div>
        </div>
      )}

      <JobsExplorePremiumModal
        open={showBrowsePremiumModal}
        onClose={() => setBrowsePremiumGateOpen(false)}
        totalCount={upsellTotalCount}
        upgradeFrom={UPGRADE_FROM}
        variant="partTime"
      />
    </div>
  );
}
