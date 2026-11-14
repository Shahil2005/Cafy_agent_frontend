import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import JobsPreferencesModal from "./JobsPreferencesModal";
import {
  isDesktopViewport,
  JobCardSkeleton,
  JobDetailPanel,
  JobDetailPanelSkeleton,
  JobsExplorePremiumModal,
  JobsFeedJobList,
  JobsPremiumSearchPreview,
} from "./jobsFeedChrome";
import { useAuth } from "../../hooks/useAuth";
import {
  getJobsBrowsePreferences,
  isValidJobsBrowseSelection,
} from "../../services/userPreferencesService";
import {
  getPortalJobs,
  reportPortalJob,
  JobsPremiumRequiredError,
  type PortalJob,
  type JobsPortalAccessMeta,
} from "../../services/jobsPortalService";
import { fetchBillingStatus } from "../../services/billingService";
import { isIrelandCareerLocation } from "../../utils/sponsorshipHubRouting";
import { resolveInitialJobsPortalCatalog, writeCachedJobsPortalCatalog } from "./jobsPortalCatalog";
import { consumePendingJobsIntent } from "./public/publicJobsStorage";

type JobsCatalogCountry = "uk" | "ireland";

function resolveCatalogCountryLabel(country: JobsCatalogCountry): string {
  return country === "ireland" ? "Ireland" : "UK";
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function JobsFeedView() {
  const navigate = useNavigate();
  const { patchUserPreferences, user } = useAuth();

  const [jobs, setJobs] = useState<PortalJob[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [globalTotalCount, setGlobalTotalCount] = useState(0);
  const [catalogCountry, setCatalogCountry] = useState<JobsCatalogCountry>(() => {
    const initial = resolveInitialJobsPortalCatalog(user?.preferences?.locations);
    if (user?.preferences?.locations?.length) {
      writeCachedJobsPortalCatalog(initial);
    }
    return initial;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingPage, setPendingPage] = useState<number | null>(1);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<PortalJob | null>(null);
  const [roleQuery, setRoleQuery] = useState("");
  const [whereQuery, setWhereQuery] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [whereInput, setWhereInput] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [portalAccess, setPortalAccess] = useState<JobsPortalAccessMeta | null>(
    null,
  );
  const [browsePremiumGateOpen, setBrowsePremiumGateOpen] = useState(false);
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false);
  const [preferencesRequired, setPreferencesRequired] = useState(false);
  const [preferencesRefreshing, setPreferencesRefreshing] = useState(false);
  const [fullPageFeedLoading, setFullPageFeedLoading] = useState(false);
  const jobListRef = useRef<HTMLDivElement>(null);
  const scrollFeedToTopAfterLoadRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const userPickedJobRef = useRef(false);

  const handleSelectJob = useCallback((job: PortalJob) => {
    userPickedJobRef.current = true;
    setSelectedJob(job);
  }, []);

  // Resume what the visitor tried on the logged-out preview (search text / job they clicked Apply on).
  const pendingJobIdRef = useRef<string | null>(null);
  useEffect(() => {
    const intent = consumePendingJobsIntent();
    if (!intent) return;
    pendingJobIdRef.current = intent.jobId;
    if (intent.search) setRoleInput(intent.search);
  }, []);

  useEffect(() => {
    const pendingId = pendingJobIdRef.current;
    if (!pendingId || loading) return;
    pendingJobIdRef.current = null;
    const match = jobs.find((job) => String(job.id) === pendingId);
    if (match) {
      userPickedJobRef.current = true;
      setSelectedJob(match);
    }
  }, [jobs, loading]);

  const scrollFeedToTop = useCallback(() => {
    requestAnimationFrame(() => {
      jobListRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      let el: HTMLElement | null = jobListRef.current;
      while (el) {
        if (el.scrollTop > 0) {
          el.scrollTop = 0;
        }
        el = el.parentElement;
      }
    });
  }, []);
  const isInitialLoading = !initialFetchDone && loading && jobs.length === 0;
  const showJobsSkeleton = loading && jobs.length === 0;
  const showEmptyState = initialFetchDone && !loading && jobs.length === 0;
  const showHeaderCountLoading =
    !initialFetchDone || (loading && globalTotalCount === 0);
  const isSearchBusy = loading && (isInitialLoading || fullPageFeedLoading);

  const isSearchActive = Boolean(roleQuery || whereQuery);

  const freeHasMoreResults = portalAccess?.hasMoreResults === true;
  const upsellTotalCount = portalAccess?.trueTotalCount ?? totalCount;

  const showSearchPreviewUpsell =
    !isPremium && isSearchActive && freeHasMoreResults && jobs.length > 0;
  const showBrowsePremiumModal =
    browsePremiumGateOpen &&
    !isPremium &&
    !isSearchActive &&
    freeHasMoreResults;

  const canExploreMore =
    jobs.length > 0 && (isPremium ? hasMore : freeHasMoreResults);

  const loadJobs = async (
    pageToLoad = 1,
    role = roleQuery,
    where = whereQuery,
    options?: { fullPage?: boolean; softReload?: boolean; liveSearch?: boolean },
  ) => {
    const requestId = ++loadRequestIdRef.current;
    const useSoftReload = options?.softReload === true && pageToLoad === 1;
    const useLiveSearch = options?.liveSearch === true && pageToLoad === 1;
    const useFullPageLoader =
      options?.fullPage === true && pageToLoad === 1 && !useSoftReload;
    if (useSoftReload) {
      setPreferencesRefreshing(true);
      userPickedJobRef.current = false;
      scrollFeedToTopAfterLoadRef.current = true;
    }
    if (useLiveSearch) {
      userPickedJobRef.current = false;
      scrollFeedToTopAfterLoadRef.current = true;
    }
    if (useFullPageLoader) {
      setFullPageFeedLoading(true);
      setJobs([]);
      setSelectedJob(null);
      userPickedJobRef.current = false;
      scrollFeedToTopAfterLoadRef.current = true;
    }

    setLoading(true);
    setPendingPage(pageToLoad);
    setError(null);

    if (pageToLoad === 1) {
      setBrowsePremiumGateOpen(false);
    }

    try {
      const result = await getPortalJobs({
        page: pageToLoad,
        role: role || undefined,
        where: where || undefined,
        refreshPreferences: options?.softReload === true,
      });

      if (requestId !== loadRequestIdRef.current) return;

      if (result.access) {
        setIsPremium(result.access.isPremium);
        setPortalAccess(result.access);
      }
      if (
        result.catalogCountry === "ireland" ||
        result.catalogCountry === "uk"
      ) {
        setCatalogCountry(result.catalogCountry);
        writeCachedJobsPortalCatalog(result.catalogCountry);
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

          if (
            options?.fullPage ||
            options?.softReload ||
            options?.liveSearch ||
            !userPickedJobRef.current
          ) {
            return result.jobs[0];
          }

          if (
            prev &&
            result.jobs.some(
              (j) =>
                j.id === prev.id || (j.url && prev.url && j.url === prev.url),
            )
          ) {
            return result.jobs.find(
              (j) =>
                j.id === prev.id || (j.url && prev.url && j.url === prev.url),
            )!;
          }

          return result.jobs[0];
        });
      } else {
        setJobs((prev) => {
          const existingIds = new Set(prev.map((j) => String(j.id)));
          const existingUrls = new Set(
            prev
              .map((j) => (typeof j.url === "string" ? j.url.trim() : ""))
              .filter(Boolean),
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
      if (err instanceof JobsPremiumRequiredError) {
        navigate("/subscription", { state: { from: "/jobs-portal" } });
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      if (requestId !== loadRequestIdRef.current) return;
      if (pageToLoad === 1) {
        setInitialFetchDone(true);
      }
      setLoading(false);
      setPendingPage(null);
      if (useSoftReload) {
        setPreferencesRefreshing(false);
      }
      if (useFullPageLoader) {
        setFullPageFeedLoading(false);
      }
    }
  };

  useEffect(() => {
    if (
      loading ||
      jobs.length === 0 ||
      !isDesktopViewport() ||
      userPickedJobRef.current
    ) {
      return;
    }
    setSelectedJob((prev) => prev ?? jobs[0]);
  }, [loading, jobs]);

  useEffect(() => {
    if (loading || !scrollFeedToTopAfterLoadRef.current) {
      return;
    }
    scrollFeedToTopAfterLoadRef.current = false;
    scrollFeedToTop();
  }, [loading, jobs, scrollFeedToTop]);

  useEffect(() => {
    loadJobs(1, "", "");
    fetchBillingStatus()
      .then((billing) => {
        if (billing) setIsPremium(billing.isJobsPremium);
      })
      .catch((err) => {
        console.warn("Failed to load billing status", err);
      });

    getJobsBrowsePreferences()
      .then((prefs) => {
        if (!isValidJobsBrowseSelection(prefs)) {
          setPreferencesRequired(true);
          setPreferencesModalOpen(true);
        }
      })
      .catch((err) => {
        console.warn("Failed to load jobs browse preferences", err);
        setPreferencesRequired(true);
        setPreferencesModalOpen(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the user changes target country in Profile, reload the matching catalog.
  const locationsKey = (user?.preferences?.locations ?? []).join("|");
  const locationsKeyRef = useRef(locationsKey);
  useEffect(() => {
    if (locationsKeyRef.current === locationsKey) return;
    locationsKeyRef.current = locationsKey;
    const nextCountry: JobsCatalogCountry = isIrelandCareerLocation(
      user?.preferences?.locations,
    )
      ? "ireland"
      : "uk";
    setCatalogCountry(nextCountry);
    writeCachedJobsPortalCatalog(nextCountry);
    setRoleInput("");
    setWhereInput("");
    setRoleQuery("");
    setWhereQuery("");
    void loadJobs(1, "", "", { fullPage: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationsKey]);

  const handleExploreMore = () => {
    if (!isPremium) {
      if (isSearchActive) {
        navigate("/subscription", { state: { from: "/jobs-portal" } });
      } else {
        setBrowsePremiumGateOpen(true);
      }
      return;
    }
    loadJobs(currentPage + 1, roleQuery, whereQuery);
  };

  useEffect(() => {
    const handleResize = () => {
      if (!isDesktopViewport()) {
        setSelectedJob(null);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const applySearch = (
    roleValue: string,
    whereValue: string,
    mode: "live" | "full",
  ) => {
    const role = roleValue.trim();
    const where = whereValue.trim();
    if (role === roleQuery && where === whereQuery) return;
    setBrowsePremiumGateOpen(false);
    setPreferencesRequired(false);
    setPreferencesModalOpen(false);
    setRoleQuery(role);
    setWhereQuery(where);
    void loadJobs(
      1,
      role,
      where,
      mode === "full" ? { fullPage: true } : { liveSearch: true },
    );
  };

  const handleSearchSubmit = () => {
    applySearch(roleInput, whereInput, "full");
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      applySearch(roleInput, whereInput, "live");
    }, 300);
    return () => window.clearTimeout(timeoutId);
    // loadJobs reads latest role/where from this effect's inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleInput, whereInput]);

  const handleSearchClear = () => {
    setBrowsePremiumGateOpen(false);
    setRoleInput("");
    setWhereInput("");
    setRoleQuery("");
    setWhereQuery("");
    loadJobs(1, "", "", { fullPage: true });
  };

  const searchSubtitle = (() => {
    if (roleQuery && whereQuery) {
      return (
        <>
          role <span className="font-medium text-slate-800">"{roleQuery}"</span>{" "}
          and company/location{" "}
          <span className="font-medium text-slate-800">"{whereQuery}"</span>
        </>
      );
    }
    if (roleQuery) {
      return (
        <>
          role <span className="font-medium text-slate-800">"{roleQuery}"</span>
        </>
      );
    }
    return (
      <>
        company/location{" "}
        <span className="font-medium text-slate-800">"{whereQuery}"</span>
      </>
    );
  })();

  const handleReport = async (job: PortalJob, reason: string) => {
    await reportPortalJob(
      job.id,
      job.title,
      job.company?.trading_name,
      reason,
      job.url,
    );
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, hasReported: true } : j)),
    );
    if (selectedJob?.id === job.id) {
      setSelectedJob({ ...selectedJob, hasReported: true });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <p className="sr-only" aria-live="polite">
        {preferencesRefreshing
          ? "Updating jobs to match your preferences."
          : showJobsSkeleton
            ? "Loading jobs…"
            : ""}
      </p>

      <JobsPreferencesModal
        open={preferencesModalOpen}
        required={preferencesRequired}
        onClose={() => {
          if (!preferencesRequired) {
            setPreferencesModalOpen(false);
          }
        }}
        onSaved={(preferences) => {
          setPreferencesRequired(false);
          setPreferencesModalOpen(false);
          if (preferences) {
            patchUserPreferences(preferences);
          }
          if (!isSearchActive) {
            void loadJobs(1, "", "", { softReload: true });
          }
        }}
      />

      <div className="z-20 shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div
          data-tour="jobs-search"
          className="flex w-full flex-col gap-2 sm:flex-row"
        >
          <div className="group relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {loading && pendingPage === 1 ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-slate-500"
                  aria-hidden
                />
              ) : (
                <Search className="h-4 w-4 text-slate-500" />
              )}
            </div>
            <input
              type="text"
              placeholder="Job role"
              className="w-full border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cafy-600 focus:bg-white focus:outline-none disabled:opacity-60"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              aria-label="Job role"
              aria-busy={isSearchBusy}
            />
          </div>
          <div className="group relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MapPin className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Company or location"
              className="w-full border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cafy-600 focus:bg-white focus:outline-none disabled:opacity-60"
              value={whereInput}
              onChange={(e) => setWhereInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              aria-label="Company or location (optional)"
              aria-required={false}
              aria-busy={isSearchBusy}
            />
            {(roleInput || whereInput) && (
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
            disabled={isSearchBusy}
            className="inline-flex min-w-[5.5rem] shrink-0 items-center justify-center bg-cafy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cafy-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearchBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span className="ml-2 hidden sm:inline">Loading</span>
              </>
            ) : (
              "Search"
            )}
          </button>
        </div>
        <button type="button" onClick={() => navigate("/job-chat")} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cafy-700 hover:text-cafy-800"><Sparkles className="h-3.5 w-3.5" aria-hidden />Not finding the right role? Let CAFY choose five using your CV.</button>
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="py-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
            <p className="font-medium text-slate-600">{error}</p>
            <button
              onClick={() => loadJobs()}
              className="mt-4 text-sm text-blue-600 underline"
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_520px] lg:grid-rows-[minmax(0,1fr)]">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden lg:border-r lg:border-slate-200">
            <div className="mx-4 mt-4 shrink-0 bg-[#f6f1e4]">
              {preferencesRefreshing ? (
                <div className="cafy-indeterminate-bar bg-[#efe8d6]" />
              ) : null}
              <div className="px-4 py-3 text-sm text-slate-700">
              {preferencesRefreshing ? (
                <p>Refreshing jobs for your new preferences.</p>
              ) : isSearchActive ? (
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
              ) : (
                <p>
                  Jobs are ordered using your saved preferences. You can{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setPreferencesRequired(false);
                      setPreferencesModalOpen(true);
                    }}
                    className="underline underline-offset-2 hover:text-slate-900"
                  >
                    change these here
                  </button>
                  .
                </p>
              )}
              </div>
            </div>

            <div className="shrink-0 px-4 py-3">
              <p className="min-w-0 truncate text-lg font-bold text-slate-900">
                {showHeaderCountLoading
                  ? "Loading jobs…"
                  : `${globalTotalCount.toLocaleString()} active ${resolveCatalogCountryLabel(catalogCountry)} jobs`}
              </p>
            </div>

            {showEmptyState ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center border border-slate-100 bg-slate-50">
                  <Search className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-slate-900">
                  No matching jobs
                </h3>
                <p className="max-w-[320px] text-sm leading-relaxed text-slate-500">
                  {isSearchActive
                    ? "No jobs matched your search. Try a different role, company, or location."
                    : "There are currently no active vacancies in our portal. Check back again soon!"}
                </p>
                {isSearchActive ? (
                  <button
                    onClick={handleSearchClear}
                    className="mt-6 text-sm font-semibold text-slate-800 underline"
                  >
                    Clear search
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                ref={jobListRef}
                className={`min-h-0 flex-1 overflow-y-auto custom-scrollbar ${
                  preferencesRefreshing ? "pointer-events-none opacity-50" : ""
                }`}
                aria-busy={preferencesRefreshing}
              >
                {showJobsSkeleton ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <JobCardSkeleton key={i} selected={i === 0} />
                  ))
                ) : (
                  <JobsFeedJobList
                    jobs={jobs}
                    selectedJobId={selectedJob?.id}
                    onSelectJob={handleSelectJob}
                    catalogCountry={catalogCountry}
                  />
                )}

                {showSearchPreviewUpsell && (
                  <div className="px-4 pb-4">
                    <JobsPremiumSearchPreview totalCount={upsellTotalCount} />
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

          <div
            className={`hidden min-h-0 min-w-0 flex-col overflow-hidden lg:flex ${
              preferencesRefreshing ? "pointer-events-none opacity-50" : ""
            }`}
            aria-busy={preferencesRefreshing}
          >
            {showJobsSkeleton ? (
              <JobDetailPanelSkeleton />
            ) : selectedJob ? (
              <JobDetailPanel
                job={selectedJob}
                onClose={() => setSelectedJob(null)}
                onReport={handleReport}
                catalogCountry={catalogCountry}
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
            <span className="truncate text-sm font-semibold text-slate-700">
              Back to jobs
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <JobDetailPanel
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
              onReport={handleReport}
              catalogCountry={catalogCountry}
              showJobDescription={false}
            />
          </div>
        </div>
      )}

      <JobsExplorePremiumModal
        open={showBrowsePremiumModal}
        onClose={() => setBrowsePremiumGateOpen(false)}
        totalCount={upsellTotalCount}
      />
    </div>
  );
}
