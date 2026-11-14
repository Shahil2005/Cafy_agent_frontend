/**
 * Logged-out jobs preview — same layout as the Jobs Portal / part-time page, but:
 * - jobs: preferences first, then max 15 jobs (GET /api/jobs-portal/public-preview)
 * - partTime: 15 UK jobs straight away; choosing a city shows 1 job
 *   (GET /api/jobs-portal/public-preview/part-time) — caps are server-enforced
 * - search, load more, apply and report open the signup gate (no network call)
 * - no apply URLs are ever received, so nothing can be extracted client-side
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Building2, Info, Lock, MapPin, Search, Unlock } from 'lucide-react';
import {
  isDesktopViewport,
  JobCardSkeleton,
  JobDetailPanel,
  JobDetailPanelSkeleton,
  JobsFeedJobList,
  type GatedJobAction,
} from '../jobsFeedChrome';
import {
  getPublicPartTimePreviewJobs,
  getPublicPreviewJobs,
  PublicPreviewError,
  type PortalJob,
} from '../../../services/jobsPortalService';
import { captureProductEvent } from '../../../lib/observability/posthog';
import { ProductEvents } from '../../../lib/observability/events';
import PublicPreferencesModal from './PublicPreferencesModal';
import PublicPreferencesForm from './PublicPreferencesForm';
import PublicHeader from '../../public/PublicHeader';
import PublicCityMenu from './PublicCityMenu';
import SignupGateDialog, { type PublicGateAction } from './SignupGateDialog';
import { usePublicTurnstile } from './usePublicTurnstile';
import {
  isCompleteAnonPreferences,
  readAnonJobPreferences,
  savePendingJobsIntent,
  writeAnonJobPreferences,
  type AnonJobPreferences,
} from './publicJobsStorage';

const BLURRED_PLACEHOLDER_COUNT = 3;

/** Static fake card — never real job data, so the DOM holds nothing beyond the 15 jobs. */
function BlurredPlaceholderCard() {
  return (
    <div className="pointer-events-none select-none border-b border-slate-200 px-4 py-5 blur-[3px]" aria-hidden>
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 bg-slate-200" />
        <div className="h-3 w-28 bg-slate-200" />
      </div>
      <div className="mt-3 h-4 w-3/5 bg-slate-300" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-4 w-16 bg-cafy-100" />
        <div className="h-4 w-14 bg-cafy-100" />
        <div className="h-4 w-20 bg-cafy-100" />
      </div>
    </div>
  );
}

export type PublicJobsVariant = 'jobs' | 'partTime';

export default function PublicJobsPage({ variant = 'jobs' }: { variant?: PublicJobsVariant }) {
  const navigate = useNavigate();
  const isPartTime = variant === 'partTime';
  const { containerRef: turnstileContainerRef, getToken, needsInteraction } = usePublicTurnstile();

  const [prefs, setPrefs] = useState<AnonJobPreferences | null>(() => readAnonJobPreferences());
  const [jobs, setJobs] = useState<PortalJob[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [moreLabel, setMoreLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<PortalJob | null>(null);
  const [roleInput, setRoleInput] = useState('');
  const [whereInput, setWhereInput] = useState('');
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const [gateAction, setGateAction] = useState<PublicGateAction | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** Part-time only: city the visitor tried to pick (locked). Remembered for after sign-up. */
  const [requestedCity, setRequestedCity] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const catalogCountry = isPartTime ? 'uk' : (prefs?.country ?? 'uk');
  // Full-time: preferences come first (same rule as logged-in users); no API call until complete.
  // Part-time: no preferences — jobs load straight away.
  const hasPrefs = isPartTime || isCompleteAnonPreferences(prefs);
  const toolId = isPartTime ? 'part-time-jobs' : 'jobs';

  // Keep job content out of search indexes until SEO is decided.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    captureProductEvent(ProductEvents.PUBLIC_JOBS_VIEWED, { variant });
    return () => {
      meta.remove();
    };
  }, [variant]);

  const filters = useMemo(
    () => ({
      country: catalogCountry,
      sectors: prefs?.sectors ?? [],
      levels: prefs?.experienceLevel ?? [],
      jobTypes: prefs?.jobTypes ?? [],
    }),
    [catalogCountry, prefs],
  );

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current;
    if (!hasPrefs) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchPreview = async () =>
          isPartTime
            ? getPublicPartTimePreviewJobs(await getToken())
            : getPublicPreviewJobs(filters, await getToken());
        let result;
        try {
          result = await fetchPreview();
        } catch (err) {
          // Tokens are single-use; one fresh retry covers expiry/races.
          if (err instanceof PublicPreviewError && err.kind === 'verification') {
            result = await fetchPreview();
          } else {
            throw err;
          }
        }
        if (!isCurrent()) return;
        setJobs(result.jobs);
        setHasMore(result.hasMore);
        setMoreLabel(result.moreLabel);
        setSelectedJob(isDesktopViewport() ? (result.jobs[0] ?? null) : null);
      } catch (err) {
        if (!isCurrent()) return;
        setJobs([]);
        setSelectedJob(null);
        setError(
          err instanceof PublicPreviewError
            ? err.message
            : err instanceof Error && /verification/i.test(err.message)
              ? "We couldn't verify your browser. Please try again."
              : 'Jobs are temporarily unavailable. Please try again.',
        );
      } finally {
        if (isCurrent()) setLoading(false);
      }
    };

    void load();
  }, [filters, getToken, reloadKey, hasPrefs, isPartTime]);

  useEffect(() => {
    const handleResize = () => {
      if (!isDesktopViewport()) setSelectedJob(null);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openGate = useCallback(
    (action: PublicGateAction, job?: PortalJob | null) => {
      if (action === 'apply' && job) savePendingJobsIntent({ jobId: String(job.id) });
      if (action === 'search') {
        const query = [roleInput, whereInput].map((v) => v.trim()).filter(Boolean).join(' ');
        if (query) savePendingJobsIntent({ search: query });
      }
      captureProductEvent(ProductEvents.PUBLIC_JOBS_GATE_SHOWN, { action, variant });
      setGateAction(action);
    },
    [roleInput, whereInput, variant],
  );

  const goToAuth = useCallback(
    (mode: 'signup' | 'login') => {
      savePendingJobsIntent(isPartTime ? { toolId, partTimeCity: requestedCity } : { toolId });
      if (mode === 'signup') {
        captureProductEvent(ProductEvents.PUBLIC_JOBS_SIGNUP_STARTED, {
          source: gateAction ?? 'header',
          variant,
        });
      }
      setGateAction(null);
      navigate(mode === 'signup' ? '/signup' : '/login');
    },
    [gateAction, navigate, isPartTime, toolId, requestedCity, variant],
  );

  const handleSelectJob = useCallback(
    (job: PortalJob) => {
      captureProductEvent(ProductEvents.PUBLIC_JOBS_JOB_OPENED, { variant });
      setSelectedJob(job);
    },
    [variant],
  );

  const handleGatedJobAction = useCallback(
    (action: GatedJobAction) => openGate(action, selectedJob),
    [openGate, selectedJob],
  );

  const handlePrefsSubmit = (next: AnonJobPreferences) => {
    writeAnonJobPreferences(next);
    setPrefs(next);
    setPrefsModalOpen(false);
    captureProductEvent(ProductEvents.PUBLIC_JOBS_PREFS_SUBMITTED, {
      country: next.country,
      sectors: next.sectors.length,
      levels: next.experienceLevel.length,
      jobTypes: next.jobTypes.length,
    });
  };

  const noopReport = useCallback(async () => {
    openGate('report');
  }, [openGate]);

  const renderDetail = (job: PortalJob) => (
    <JobDetailPanel
      job={job}
      onClose={() => setSelectedJob(null)}
      onReport={noopReport}
      catalogCountry={catalogCountry}
      linkCompany={false}
      onGatedAction={handleGatedJobAction}
      showJobDescription={false}
      {...(isPartTime ? { showLevelAndSponsor: false, showSector: false, jobInfoFirst: true } : {})}
    />
  );

  const listTitle = isPartTime
    ? 'UK part-time jobs'
    : catalogCountry === 'ireland'
      ? 'Jobs at Irish permit-register employers'
      : 'Jobs at sponsor-licensed UK companies';
  const previewHeading = isPartTime
    ? 'Free preview: UK part-time jobs'
    : catalogCountry === 'ireland'
      ? "Free preview: jobs at employers on Ireland's employment permit register"
      : 'Free preview: jobs at companies with a UK sponsor licence';
  const sponsorNote =
    catalogCountry === 'ireland'
      ? 'Being on the permit register means the employer has hired permit holders. Not every role offers a permit. Check each job.'
      : 'A sponsor licence means the company can sponsor visas. Not every role offers sponsorship. Check each job.';
  const moreHeadline = isPartTime
    ? `${moreLabel ?? 'More'} more part-time jobs in the UK`
    : moreLabel
      ? `${moreLabel} more jobs match you`
      : 'More jobs match you';

  if (!hasPrefs) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-white font-inter">
        <PublicHeader
          onSignIn={() => goToAuth('login')}
          onGetStarted={() => goToAuth('signup')}
          backTo={{ to: '/', label: 'All features' }}
        />
        <main className="flex min-h-0 flex-1 justify-center overflow-hidden bg-slate-50 sm:p-6">
          <div className="flex min-h-0 w-full max-w-xl flex-col overflow-hidden border-slate-200 bg-white sm:border">
            <div className="shrink-0 bg-[#f6f1e4] px-5 py-4">
              <h1 className="text-[15px] font-semibold text-slate-900">Your preferences</h1>
              <p className="mt-1 text-sm leading-snug text-slate-600">
                Tell us what you&apos;re looking for and we&apos;ll show the best matching jobs at sponsor-licensed companies first.
              </p>
            </div>
            <PublicPreferencesForm initial={prefs} onSubmit={handlePrefsSubmit} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white font-inter">
      <PublicHeader
        onSignIn={() => goToAuth('login')}
        onGetStarted={() => goToAuth('signup')}
        backTo={{ to: '/', label: 'All features' }}
      />

      {/* Search — typing is allowed, submitting opens the gate. No request is ever sent. */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <form
          className="flex w-full flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            openGate('search');
          }}
        >
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Job role"
              maxLength={100}
              className="w-full border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cafy-600 focus:bg-white focus:outline-none"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              aria-label="Job role"
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {isPartTime ? (
                <Building2 className="h-4 w-4 text-slate-500" />
              ) : (
                <MapPin className="h-4 w-4 text-slate-500" />
              )}
            </div>
            <input
              type="text"
              placeholder={isPartTime ? 'Company, e.g. KFC' : 'Company or location'}
              maxLength={100}
              className="w-full border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cafy-600 focus:bg-white focus:outline-none"
              value={whereInput}
              onChange={(e) => setWhereInput(e.target.value)}
              aria-label={isPartTime ? 'Company' : 'Company or location'}
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-w-[5.5rem] shrink-0 items-center justify-center gap-1.5 bg-cafy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cafy-700"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Search
          </button>
        </form>
        {isPartTime ? (
          <div className="mt-3">
            <PublicCityMenu
              locked
              city={null}
              onChange={(city) => {
                if (!city) return;
                // Location filtering needs an account (server rejects ?city too).
                setRequestedCity(city);
                openGate('location');
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_520px] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden lg:border-r lg:border-slate-200">
          {/* Preview notice — says up front what is free and what needs an account. */}
          <div className="mx-4 mt-4 shrink-0 bg-[#f6f1e4] px-4 py-3 text-sm text-slate-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Unlock className="h-4 w-4 shrink-0 text-cafy-700" aria-hidden />
                  {previewHeading}
                </p>
                <p className="mt-0.5">Sign up free to apply, search and see every job.</p>
              </div>
              <button
                type="button"
                onClick={() => goToAuth('signup')}
                className="shrink-0 bg-cafy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cafy-700"
              >
                Sign up free
              </button>
            </div>
            {isPartTime ? (
              <p className="mt-2 text-slate-600">Want jobs near you? Sign up free to filter by location.</p>
            ) : (
              <>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {sponsorNote}
                </p>
                <p className="mt-2 text-slate-600">
                  Not quite right?{' '}
                  <button
                    type="button"
                    onClick={() => setPrefsModalOpen(true)}
                    className="font-medium underline underline-offset-2 hover:text-slate-900"
                  >
                    Change your preferences
                  </button>
                </p>
              </>
            )}
          </div>

          <div className="shrink-0 px-4 py-3">
            <p className="truncate text-lg font-bold text-slate-900">
              {loading ? 'Loading jobs…' : listTitle}
            </p>
          </div>

          {error ? (
            <div className="flex flex-1 items-center justify-center px-4">
              <div className="py-12 text-center">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
                <p className="font-medium text-slate-600">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-4 text-sm font-semibold text-slate-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : !loading && jobs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
              <Search className="mb-4 h-8 w-8 text-slate-300" />
              <h3 className="mb-1 text-lg font-semibold text-slate-900">No matching jobs</h3>
              <p className="max-w-[320px] text-sm text-slate-500">
                {isPartTime
                  ? 'No part-time jobs to show right now. Please try again soon.'
                  : 'Try different preferences to see more jobs at sponsor-licensed companies.'}
              </p>
              <button
                type="button"
                onClick={() => (isPartTime ? setReloadKey((k) => k + 1) : setPrefsModalOpen(true))}
                className="mt-6 text-sm font-semibold text-slate-800 underline"
              >
                {isPartTime ? 'Try again' : 'Change preferences'}
              </button>
            </div>
          ) : (
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} selected={i === 0} />)
              ) : (
                <>
                  <JobsFeedJobList
                    jobs={jobs}
                    selectedJobId={selectedJob?.id}
                    onSelectJob={handleSelectJob}
                    catalogCountry={catalogCountry}
                    linkCompany={false}
                    {...(isPartTime ? { showLevelAndSponsor: false, showSector: false } : {})}
                  />

                  {hasMore ? (
                    <div className="relative">
                      {Array.from({ length: BLURRED_PLACEHOLDER_COUNT }).map((_, i) => (
                        <BlurredPlaceholderCard key={i} />
                      ))}
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/30 via-white/80 to-white px-4">
                        <div className="w-full max-w-sm border border-slate-200 bg-white p-5 text-center shadow-sm">
                          <p className="text-base font-semibold text-slate-900">
                            {moreHeadline}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Sign up free to browse, search and apply.
                          </p>
                          <button
                            type="button"
                            onClick={() => goToAuth('signup')}
                            className="mt-4 w-full bg-cafy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cafy-700"
                          >
                            Sign up free <span aria-hidden>→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-center pb-10 pt-6">
                    <button
                      type="button"
                      onClick={() => openGate('loadMore')}
                      className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                    >
                      <Lock className="h-3.5 w-3.5" aria-hidden />
                      Explore more
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="hidden min-h-0 min-w-0 flex-col overflow-hidden lg:flex">
          {loading ? (
            <JobDetailPanelSkeleton />
          ) : selectedJob ? (
            renderDetail(selectedJob)
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-sm text-slate-400">
              Select a job to see details
            </div>
          )}
        </div>
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white lg:hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setSelectedJob(null)}
              className="rounded-lg p-1.5 hover:bg-slate-100"
              aria-label="Back to jobs"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <span className="truncate text-sm font-semibold text-slate-700">Back to jobs</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{renderDetail(selectedJob)}</div>
        </div>
      )}

      <PublicPreferencesModal
        open={prefsModalOpen && !isPartTime}
        initial={prefs}
        onClose={() => setPrefsModalOpen(false)}
        onSubmit={handlePrefsSubmit}
      />

      <SignupGateDialog
        action={gateAction}
        moreLabel={moreLabel}
        onSignup={() => goToAuth('signup')}
        onLogin={() => goToAuth('login')}
        onClose={() => setGateAction(null)}
      />

      {/* Invisible Turnstile — only shows a challenge if Cloudflare needs interaction. */}
      {needsInteraction ? <div className="fixed inset-0 z-[135] bg-slate-900/40" aria-hidden /> : null}
      <div
        className={
          needsInteraction
            ? 'fixed left-1/2 top-1/2 z-[140] w-[min(92vw,340px)] -translate-x-1/2 -translate-y-1/2 bg-white p-4 text-center shadow-xl'
            : 'fixed bottom-4 right-4 z-[140]'
        }
        role={needsInteraction ? 'dialog' : undefined}
        aria-label={needsInteraction ? 'Verify you are human' : undefined}
      >
        {needsInteraction ? (
          <p className="mb-2 text-sm font-medium text-slate-700">Quick check before we show jobs</p>
        ) : null}
        <div ref={turnstileContainerRef} className="flex justify-center" />
      </div>
    </div>
  );
}
