import React, { useState, useEffect, Suspense, lazy } from "react";
import { initializeGemini } from "./services/gemini";
import { useAuth } from "./hooks/useAuth";
import { useJobs } from "./hooks/useJobs";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { capturePageview } from "./lib/observability/posthog";

// Components
import LoadingScreen from "./components/auth/LoadingScreen";
import AuthForm from "./components/auth/AuthForm";
import OnboardingForm from "./components/auth/OnboardingForm";
import VerificationPending from "./components/auth/VerificationPending";
import ForgotPasswordForm from "./components/auth/ForgotPasswordForm";
import AuthActionHandler from "./components/auth/AuthActionHandler";
import TabNavigation from "./components/navigation/TabNavigation";
import TrackerTab from "./components/jobs/TrackerTab";
import SponsorshipHubRoute from "./components/tabs/SponsorshipHubRoute";
import AICommCenterTab from "./components/tabs/AICommCenterTab";
import HomeTab from "./components/tabs/HomeTab";
import AISuccessTrendsTab from "./components/tabs/AISuccessTrendsTab";
import ProfileTab from "./components/tabs/ProfileTab";
import ChromeExtensionTab from "./components/tabs/ChromeExtensionTab";
import ResumeStudioTab from "./components/tabs/ResumeStudioTab";
import CareerCounsellingTab from "./components/tabs/CareerCounsellingTab";
import JobsPortalTab from "./components/tabs/JobsPortalTab";
import JobChatTab from "./components/tabs/JobChatTab";
import JobsFeedView from "./components/jobs-portal/JobsFeedView";
import PartTimeJobsFeedView from "./components/jobs-portal/PartTimeJobsFeedView";
import CompaniesDirectoryView from "./components/jobs-portal/CompaniesDirectoryView";
import CareerPathTab from "./components/tabs/CareerPathTab";
import LinkedInOptimiserTab from "./components/tabs/LinkedInOptimiserTab";
import ResourcesTab from "./components/tabs/ResourcesTab";
import { requestNavigation } from "./utils/navigationGuard";
import SubscriptionPricing from "./components/profile/SubscriptionPricing";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import OnboardingPlan from "./pages/OnboardingPlan";

import PrivacyPolicy from "./pages/PrivacyPolicy";
import InterviewNotificationManager from "./components/notifications/InterviewNotificationManager";

import type { TabType } from "./types";
import { Menu } from "lucide-react";
import ProtectedRoute from "./utils/ProtectedRoute";
import { SessionProvider } from "./context/SessionContext";
import OfflineBanner from "./components/common/OfflineBanner";
import TourProvider from "./tour/TourProvider";
import { getWelcomeFirstName } from "./utils/displayNameCache";
import { getDefaultSponsorshipPath } from "./utils/sponsorshipHubRouting";
import { BillingProvider } from "./context/BillingContext";
import { BillingPortalProvider } from "./context/BillingPortalContext";
import { PlanUsageModalProvider } from "./context/PlanUsageModalContext";
import { capturePromoFromUrl } from "./utils/promoCodeStorage";
import ErrorBoundary from "./components/common/ErrorBoundary";
import {
  consumePendingJobsIntent,
  peekPendingJobsIntent,
} from "./components/jobs-portal/public/publicJobsStorage";
import { findHomeTool } from "./components/home/homeToolGroups";

const PublicJobsPage = lazy(() => import("./components/jobs-portal/public/PublicJobsPage"));
const PublicExplorePage = lazy(() => import("./components/public/PublicExplorePage"));

const PUBLIC_PATHS = ["/privacy-policy", "/auth/action"] as const;

function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(pathname);
}

/** Logged-out entry points: Explore (`/`), jobs preview, dedicated auth pages. */
const PUBLIC_JOBS_PATHS = ["/", "/explore-jobs", "/explore-part-time-jobs"] as const;
const AUTH_PATHS = ["/login", "/signup"] as const;

function isPublicJobsPath(pathname: string): boolean {
  return (PUBLIC_JOBS_PATHS as readonly string[]).includes(pathname);
}

function isAuthPath(pathname: string): boolean {
  return (AUTH_PATHS as readonly string[]).includes(pathname);
}

const AppContent: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  //routing
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    capturePageview(`${window.location.origin}${location.pathname}`);
  }, [location.pathname]);

  useEffect(() => {
    if (location.search.includes('promo=')) {
      capturePromoFromUrl(location.search);
    }
  }, [location.search]);

  useEffect(() => {
    const closeMobileSidebar = () => setIsMobileSidebarOpen(false);
    window.addEventListener('cafy-close-mobile-sidebar', closeMobileSidebar);
    return () => window.removeEventListener('cafy-close-mobile-sidebar', closeMobileSidebar);
  }, []);

  const pathSegment = location.pathname.replace(/^\//, "") || "home";
  const activeTab = (
    pathSegment.startsWith("jobs-portal/companies")
      ? "jobs-companies"
      : pathSegment === "jobs-portal" || pathSegment.startsWith("jobs-portal/")
      ? "jobs-portal"
      : pathSegment === "sponsorship" ||
        pathSegment.startsWith("sponsorship/") ||
        pathSegment.startsWith("sponsorshiphub/")
      ? "sponsorship"
      : pathSegment
  ) as TabType;

  // Initialize Gemini service (no key needed on frontend now)
  useEffect(() => {
    initializeGemini();
  }, []);

  // Redirect to root if not authenticated and trying to access protected routes

  // Authentication
  const {
    user,
    profileLoaded,
    uiState,
    setUiState,
    authError,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    name,
    setName,
    handleEmailSignUp,
    handleEmailLogin,
    handleGoogleSignIn,
    handleResendVerification,
    handleSignOut,
    isSigningOut,
    handleForgotPassword,
    updateUserProfile,
    updateUserPreferences,
    refreshUser,
    markOnboardingComplete,
    updateTourStatus,
  } = useAuth();

  useEffect(() => {
    if (
      uiState !== "loading" &&
      !user &&
      !isPublicJobsPath(location.pathname) &&
      !isAuthPath(location.pathname) &&
      !isPublicPath(location.pathname)
    ) {
      navigate("/", { replace: true });
      return;
    }

    // Wait until Firestore profile is loaded — undefined onboarding flags must not trigger redirects.
    if (!user || !profileLoaded) {
      return;
    }

    // Redirect to onboarding only when profile explicitly says incomplete
    if (
      user.onboardingCompleted === false &&
      location.pathname !== "/onboarding" &&
      !isPublicPath(location.pathname)
    ) {
      navigate("/onboarding", { replace: true });
      return;
    }

    const planSelectionAllowed =
      location.pathname.startsWith("/onboarding/plan") ||
      location.pathname.startsWith("/subscription");

    if (
      user.onboardingCompleted === true &&
      user.planSelectionCompleted === false &&
      !planSelectionAllowed &&
      !isPublicPath(location.pathname)
    ) {
      navigate("/onboarding/plan", { replace: true });
      return;
    }

    // Fully onboarded: leave logged-out entry pages; resume a public-preview intent in the Jobs Portal.
    if (
      user.onboardingCompleted === true &&
      user.planSelectionCompleted !== false &&
      !planSelectionAllowed
    ) {
      // Resume what the visitor clicked before signing up / in (Explore tool or jobs preview).
      const intent = location.pathname === "/home" ? peekPendingJobsIntent() : null;
      if (intent) {
        if (intent.toolId && intent.toolId !== "jobs") {
          // Part-time keeps the intent: PartTimeJobsFeedView pre-selects the chosen city.
          if (intent.toolId !== "part-time-jobs") consumePendingJobsIntent();
          const tool = findHomeTool(intent.toolId, getDefaultSponsorshipPath(user.preferences));
          // External tools (Resume Studio) stay on Home, where their card is.
          if (tool?.to) navigate(tool.to, { replace: true });
        } else {
          // JobsFeedView consumes the jobs intent (pending search / job).
          navigate("/jobs-portal", { replace: true });
        }
      }
    }
  }, [user, profileLoaded, uiState, location.pathname, navigate]);

  // /login and /signup decide the auth form mode from the URL. (useAuth re-subscribes its
  // auth listener on every navigation and resets uiState to "login", so the URL is the source of truth.)
  const authPathMode: "login" | "signup" | null =
    user ? null : location.pathname === "/signup" ? "signup" : location.pathname === "/login" ? "login" : null;

  const handleAuthFormUiState = (next: string) => {
    if ((next === "login" || next === "signup") && isAuthPath(location.pathname)) {
      navigate(next === "signup" ? "/signup" : "/login", { replace: true });
    }
    setUiState(next as Parameters<typeof setUiState>[0]);
  };

  useEffect(() => {
    if (!user || !profileLoaded) return;

    const targetPath = getDefaultSponsorshipPath(user.preferences);
    if (location.pathname === "/sponsorship/ireland" && targetPath === "/sponsorship") {
      navigate("/sponsorship", { replace: true });
      return;
    }
    if (location.pathname === "/sponsorship" && targetPath === "/sponsorship/ireland") {
      navigate("/sponsorship/ireland", { replace: true });
    }
  }, [user?.preferences, profileLoaded, location.pathname, navigate, user]);

  const {
    jobsWithFollowUp,
    statusCounts,
    matchedCount,
    isLoading,
    isSaving,
    addJob,
    updateJobStatus,
    updateJobMatched,
    updateJobFavorite,
    updateJobPersonalNotes,
    deleteJob,
    uploadCV,
    deleteCV,
    savedCVs,
    isCVsLoading,
  } = useJobs(user?.uid || null);

  const isOnboarding = location.pathname === "/onboarding";
  const isOnboardingPlan = location.pathname === "/onboarding/plan";
  const isSubscriptionRoute = location.pathname.startsWith("/subscription");
  const isSponsorshipRoute =
    location.pathname === "/sponsorship" ||
    location.pathname.startsWith("/sponsorship/") ||
    location.pathname.startsWith("/sponsorshiphub/");
  const isResourcesRoute = location.pathname === "/resources";
  const isJobsPortalRoute =
    location.pathname === "/jobs-portal" ||
    location.pathname.startsWith("/jobs-portal/");
  const isPartTimeJobsRoute = location.pathname === "/part-time-jobs";
  const isJobsFeedLayout = isJobsPortalRoute || isPartTimeJobsRoute || location.pathname === "/job-chat";
  const hideSidebar = isOnboarding || isOnboardingPlan || isSubscriptionRoute;
  const displayNameReady =
    !user?.onboardingCompleted ||
    Boolean(getWelcomeFirstName(user?.uid, user?.displayName));
  const appReady =
    Boolean(user) && !isLoading && uiState !== "loading" && displayNameReady && profileLoaded;

  const withTour = (content: React.ReactNode) =>
    user && !hideSidebar ? (
      <TourProvider
        user={user}
        hideSidebar={hideSidebar}
        appReady={appReady}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
        updateTourStatus={updateTourStatus}
      >
        {content}
      </TourProvider>
    ) : (
      content
    );

  // Public routes — no auth, no loading gate
  if (location.pathname === "/privacy-policy") {
    return <PrivacyPolicy />;
  }

  if (location.pathname === "/auth/action") {
    return <AuthActionHandler />;
  }

  if (isSigningOut) {
    return <LoadingScreen message="Signing out…" />;
  }

  // Loading state (auth + profile only — Home does not wait on tracker jobs)
  if (uiState === "loading" || (user && (!displayNameReady || !profileLoaded))) {
    return withTour(<LoadingScreen />);
  }

  // Logged-out visitors: Explore (all tools) at "/", jobs preview at /explore-jobs, auth on /login and /signup.
  if (!user && (uiState === "login" || uiState === "signup") && isPublicJobsPath(location.pathname)) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          {location.pathname === "/explore-jobs" ? (
            <PublicJobsPage />
          ) : location.pathname === "/explore-part-time-jobs" ? (
            <PublicJobsPage variant="partTime" />
          ) : (
            <PublicExplorePage />
          )}
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Authentication screens
  if (uiState === "login" || uiState === "signup") {
    return (
      <AuthForm
        type={authPathMode ?? uiState}
        authError={authError}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        name={name}
        setName={setName}
        handleEmailLogin={handleEmailLogin}
        handleEmailSignUp={handleEmailSignUp}
        handleGoogleSignIn={handleGoogleSignIn}
        setUiState={handleAuthFormUiState}
      />
    );
  }

  // Verification pending screen
  if (uiState === "verification-pending") {
    return (
      <VerificationPending
        email={email}
        handleResendVerification={handleResendVerification}
        handleSignOut={handleSignOut}
        isSigningOut={isSigningOut}
        authError={authError}
      />
    );
  }

  // Forgot password screen
  if (uiState === "forgot-password") {
    return (
      <ForgotPasswordForm
        authError={authError}
        handleForgotPassword={handleForgotPassword}
        setUiState={setUiState as any}
      />
    );
  }

  // Main application UI
  return (
    <BillingProvider autoRefreshMs={300_000}>
    <BillingPortalProvider>
    <PlanUsageModalProvider>
    <motion.div className="flex flex-col h-screen font-inter overflow-hidden">
      {withTour(
        <>
          {user && <InterviewNotificationManager jobs={jobsWithFollowUp} />}

          <div className="flex flex-1 overflow-hidden relative">
            {/* Desktop Sidebar */}
            {!hideSidebar && (
              <div
                data-cafy-sidebar
                className={`hidden lg:block ${isSidebarCollapsed ? "w-20" : "w-64"} h-full flex-shrink-0 z-10 border-r border-slate-200 bg-white transition-all duration-300 ease-in-out`}
              >
                <TabNavigation
                  activeTab={activeTab}
                  careerLocations={user?.preferences?.locations}
                  navigate={(path) => {
                    if (requestNavigation(path)) return;
                    navigate(path);
                  }}
                  isCollapsed={isSidebarCollapsed}
                  onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
              </div>
            )}

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
              {!hideSidebar && isMobileSidebarOpen && (
                <>
                  <motion.div
                    data-cafy-sidebar
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden"
                  />
                  <motion.div
                    data-cafy-sidebar
                    initial={{ x: -280 }}
                    animate={{ x: 0 }}
                    exit={{ x: -280 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed top-0 left-0 bottom-0 z-40 w-64 h-full shadow-2xl lg:hidden bg-white"
                  >
                    <TabNavigation
                      activeTab={activeTab}
                      careerLocations={user?.preferences?.locations}
                      navigate={(path) => {
                        if (requestNavigation(path)) return;
                        navigate(path);
                        setIsMobileSidebarOpen(false);
                      }}
                      onClose={() => setIsMobileSidebarOpen(false)}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* MAIN CONTENT */}
            <main
              className={`flex-1 flex flex-col min-h-0 min-w-0 relative ${
                isSponsorshipRoute || isJobsFeedLayout ? "bg-white" : "bg-slate-50"
              }`}
            >
              {/* Mobile Header Bar - Sticky */}
              {!hideSidebar && (
                <div className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-md flex items-center px-4 py-3 border-b border-slate-200 mb-2">
                  <button
                    data-cafy-mobile-menu
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <Menu size={20} />
                  </button>
                </div>
              )}

              <div
                className={`flex-1 flex flex-col min-h-0 min-w-0 ${
                  isOnboarding || isOnboardingPlan || isSubscriptionRoute
                    ? "overflow-y-auto overscroll-y-contain"
                    : isSponsorshipRoute || isJobsFeedLayout
                      ? "overflow-hidden"
                      : isResourcesRoute
                        ? "overflow-hidden p-3 sm:p-4 md:p-5 lg:p-6"
                        : "overflow-hidden p-4 md:p-8"
                }`}
              >
                <Routes>
                  <Route
                    path="/onboarding"
                    element={
                      user && !user.onboardingCompleted ? (
                        <OnboardingForm
                          user={user}
                          onComplete={() => {
                            markOnboardingComplete();
                            navigate("/onboarding/plan", { replace: true });
                            void refreshUser({ skipBillingFetch: true });
                          }}
                        />
                      ) : user && user.onboardingCompleted ? (
                        <Navigate
                          to={
                            user.planSelectionCompleted
                              ? "/home"
                              : "/onboarding/plan"
                          }
                          replace
                        />
                      ) : (
                        <Navigate to="/" replace />
                      )
                    }
                  />

                  <Route
                    path="/onboarding/plan"
                    element={
                      user &&
                      user.onboardingCompleted &&
                      !user.planSelectionCompleted ? (
                        <OnboardingPlan />
                      ) : user && user.planSelectionCompleted ? (
                        <Navigate to="/home" replace />
                      ) : user && !user.onboardingCompleted ? (
                        <Navigate to="/onboarding" replace />
                      ) : (
                        <Navigate to="/" replace />
                      )
                    }
                  />

                  <Route element={<ProtectedRoute user={user} />}>
                    <Route index element={<Navigate to="/home" replace />} />
                    <Route path="/explore-jobs" element={<Navigate to="/jobs-portal" replace />} />
                    <Route path="/explore-part-time-jobs" element={<Navigate to="/part-time-jobs" replace />} />
                    <Route path="/login" element={<Navigate to="/home" replace />} />
                    <Route path="/signup" element={<Navigate to="/home" replace />} />
                    <Route path="/home" element={<HomeTab />} />
                    <Route
                      path="/job-chat"
                      element={
                        user ? (
                          <JobChatTab
                            user={user}
                            savedCVs={savedCVs}
                            isCVsLoading={isCVsLoading}
                            jobs={jobsWithFollowUp}
                            addJob={addJob}
                            uploadCV={uploadCV}
                          />
                        ) : (
                          <Navigate to="/login" replace />
                        )
                      }
                    />
                    <Route
                      path="/resume-studio"
                      element={<ResumeStudioTab />}
                    />
                    <Route
                      path="/resumes"
                      element={<Navigate to="/resume-studio" replace />}
                    />
                    <Route
                      path="/resume-analyzer"
                      element={<Navigate to="/resume-studio" replace />}
                    />
                    <Route
                      path="/resume-builder"
                      element={<Navigate to="/resume-studio" replace />}
                    />
                    <Route path="/jobs-portal" element={<JobsPortalTab />}>
                      <Route index element={<JobsFeedView />} />
                      <Route path="companies/:companyId?" element={<CompaniesDirectoryView />} />
                    </Route>
                    <Route path="/part-time-jobs" element={<JobsPortalTab />}>
                      <Route index element={<PartTimeJobsFeedView />} />
                    </Route>
                    <Route
                      path="/chrome-extension"
                      element={<ChromeExtensionTab />}
                    />
                    <Route
                      path="/tracker"
                      element={
                        <TrackerTab
                          jobs={jobsWithFollowUp}
                          statusCounts={statusCounts}
                          matchedCount={matchedCount}
                          onAddJob={addJob}
                          onUpdateStatus={updateJobStatus}
                          onUpdateMatched={updateJobMatched}
                          onUpdateFavorite={updateJobFavorite}
                          onUpdatePersonalNotes={updateJobPersonalNotes}
                          onDeleteJob={deleteJob}
                          isLoading={isLoading}
                          isSaving={isSaving}
                        />
                      }
                    />

                    <Route
                      path="/sponsorship"
                      element={<SponsorshipHubRoute variant="uk" />}
                    />

                    <Route
                      path="/sponsorship/ireland"
                      element={<SponsorshipHubRoute variant="ireland" />}
                    />

                    <Route
                      path="/sponsorshiphub/ireland"
                      element={<Navigate to="/sponsorship/ireland" replace />}
                    />

                    <Route
                      path="/career-counselling"
                      element={<CareerCounsellingTab />}
                    />

                    <Route
                      path="/career-path"
                      element={<CareerPathTab />}
                    />

                    <Route path="/resources" element={<ResourcesTab />} />

                    <Route
                      path="/linkedin-optimiser"
                      element={<LinkedInOptimiserTab />}
                    />

                    <Route
                      path="/trends"
                      element={<AISuccessTrendsTab jobs={jobsWithFollowUp} />}
                    />

                    <Route
                      path="/profile"
                      element={
                        <ProfileTab
                          user={user!}
                          savedCVs={savedCVs}
                          onUploadCV={uploadCV}
                          onDeleteCV={deleteCV}
                          onUpdateProfile={updateUserProfile}
                          onUpdatePreferences={updateUserPreferences}
                        />
                      }
                    />

                    <Route
                      path="/commcenter"
                      element={
                        <AICommCenterTab
                          jobs={jobsWithFollowUp}
                          user={user!}
                          savedCVs={savedCVs}
                        />
                      }
                    />

                    <Route
                      path="/subscription"
                      element={<SubscriptionPricing />}
                    />
                    <Route
                      path="/subscription/success"
                      element={<SubscriptionSuccess />}
                    />

                    <Route path="*" element={<Navigate to="/home" replace />} />
                  </Route>

                  {/* Public Routes */}
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                </Routes>
              </div>
            </main>
          </div>
        </>,
      )}
    </motion.div>
    </PlanUsageModalProvider>
    </BillingPortalProvider>
    </BillingProvider>
  );
};

const App: React.FC = () => {
  return (
    <SessionProvider>
      <OfflineBanner />
      <AppContent />
    </SessionProvider>
  );
};

export default App;
