import React, { useEffect, useState } from "react";
import {
  Gauge,
  Sparkles,
  Clock,
  ScanLine,
  Copy,
  Check,
  User,
  ListChecks,
  Download,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Unlink,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  subscribeToLinkedinOptimizerProfile,
  disconnectLinkedinProfile,
  type StoredLinkedinProfile,
  type LinkedinOptimizerScrapedData,
} from "../../services/linkedinOptimizerService";
import { useAuth } from "../../hooks/useAuth";
import PageHeader from "../common/PageHeader";

const CHROME_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/getlanded-career-assistan/acbkphafegncebaffomiebcnleepafcn";

const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-2xl border border-slate-200 bg-white overflow-hidden ${className}`}
  >
    {children}
  </div>
);

const CardHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors shrink-0"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

const ScrapedSection = ({ label, value }: { label: string; value?: string }) => {
  const isEmpty = !value || value.trim().length === 0;
  return (
    <details
      className="border border-slate-200 rounded-xl overflow-hidden bg-white"
      open={!isEmpty && value.length < 300}
    >
      <summary className="cursor-pointer select-none px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700 truncate">{label}</span>
        {isEmpty ? (
          <span className="text-xs text-slate-400 shrink-0">Not detected</span>
        ) : (
          <span className="text-xs text-slate-400 tabular-nums shrink-0">
            {value.length} chars
          </span>
        )}
      </summary>
      {!isEmpty && (
        <div className="px-4 py-3 text-sm text-slate-600 whitespace-pre-wrap max-h-72 overflow-y-auto border-t border-slate-100 custom-scrollbar">
          {value}
        </div>
      )}
    </details>
  );
};

const ResultBlock = ({ label, text }: { label: string; text: string }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
    <div className="flex items-center justify-between gap-2 mb-2">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <CopyButton text={text} />
    </div>
    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{text}</p>
  </div>
);

interface ChecklistItem {
  key: string;
  label: string;
  filled: boolean;
  weight: number;
}

/** Single source of truth for both the completeness score and the "what's missing" checklist. */
function buildProfileChecklist(
  data: LinkedinOptimizerScrapedData | null | undefined,
): ChecklistItem[] {
  const isFilled = (value?: string) => !!value && value.trim().length > 0;
  return [
    { key: "photo", label: "Profile photo", filled: !!data?.hasProfilePhoto, weight: 10 },
    { key: "banner", label: "Banner image", filled: !!data?.hasBanner, weight: 5 },
    { key: "headline", label: "Headline", filled: isFilled(data?.headline), weight: 15 },
    { key: "about", label: "About", filled: isFilled(data?.about), weight: 15 },
    { key: "experience", label: "Experience", filled: isFilled(data?.experience), weight: 20 },
    { key: "education", label: "Education", filled: isFilled(data?.education), weight: 10 },
    { key: "skills", label: "Skills", filled: isFilled(data?.skills), weight: 15 },
    { key: "certifications", label: "Certifications", filled: isFilled(data?.certifications), weight: 5 },
  ];
}

function scoreFromChecklist(items: ChecklistItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + (item.filled ? item.weight : 0), 0));
}

function scoreTier(score: number): { label: string; badgeClass: string; barColor: string } {
  if (score >= 80)
    return { label: "Excellent", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100", barColor: "#059669" };
  if (score >= 50)
    return { label: "Good", badgeClass: "bg-cafy-50 text-cafy-700 border-cafy-100", barColor: "#1955da" };
  return { label: "Needs work", badgeClass: "bg-amber-50 text-amber-800 border-amber-100", barColor: "#d97706" };
}

const formatTimestamp = (date: Date | null): string => {
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatRelative = (date: Date | null): string => {
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
};

const KpiTile = ({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  hint: string;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5 sm:py-5">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <Icon size={16} className="text-slate-300" />
    </div>
    <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 truncate">{value}</p>
    <p className="mt-1 text-xs text-slate-500 truncate">{hint}</p>
  </div>
);

const OnboardingStep = ({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) => (
  <div className="flex items-start gap-3 text-left">
    <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-cafy-50 text-cafy-700 text-xs font-bold">
      {step}
    </span>
    <div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
    </div>
  </div>
);

const EmptyState = () => (
  <Card className="p-8 sm:p-10">
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cafy-50 text-cafy-600 mb-4">
        <ScanLine size={22} />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">No LinkedIn profile data yet</h2>
      <p className="text-sm text-slate-500 max-w-md leading-relaxed mt-1.5">
        Scan your LinkedIn profile from the Cafy Chrome extension to see your profile
        breakdown and AI-optimised suggestions here.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 max-w-2xl w-full mt-8 mb-2 text-left">
        <OnboardingStep
          step={1}
          title="Install the extension"
          description="Add the free Cafy Chrome extension in under a minute."
        />
        <OnboardingStep
          step={2}
          title="Scan your profile"
          description="Open your LinkedIn profile and hit “Scan My Profile”."
        />
        <OnboardingStep
          step={3}
          title="Get AI suggestions"
          description="Run “Optimise with AI” — results sync here automatically."
        />
      </div>

      <a
        href={CHROME_EXTENSION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-cafy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cafy-700 transition-colors"
      >
        <Download className="w-4 h-4" />
        Get the Chrome Extension
      </a>
      <p className="text-xs text-slate-400 mt-3">Data syncs from the extension in real time</p>
    </div>
  </Card>
);

const DisconnectModal = ({
  profileName,
  disconnecting,
  error,
  onConfirm,
  onClose,
}: {
  profileName?: string;
  disconnecting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4"
    onClick={disconnecting ? undefined : onClose}
    role="dialog"
    aria-modal="true"
    aria-labelledby="disconnect-linkedin-title"
  >
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle size={18} />
          </span>
          <h2 id="disconnect-linkedin-title" className="text-base font-bold text-slate-900">
            Disconnect this LinkedIn profile?
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={disconnecting}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-5 py-5 space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          {profileName ? (
            <>
              The scanned data for <span className="font-semibold text-slate-900">{profileName}</span>{" "}
              and its AI suggestions will be removed from Cafy and from the Chrome extension.
            </>
          ) : (
            <>
              Your scanned profile data and AI suggestions will be removed from Cafy and from the
              Chrome extension.
            </>
          )}
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          You can scan any LinkedIn profile again from the extension at any time, but the AI
          suggestions will need to be regenerated.
        </p>

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
        <button
          type="button"
          onClick={onClose}
          disabled={disconnecting}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={disconnecting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-60"
        >
          {disconnecting && <Loader2 size={14} className="animate-spin" />}
          {disconnecting ? "Disconnecting" : "Disconnect"}
        </button>
      </div>
    </motion.div>
  </div>
);

const LinkedInOptimiserTab: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StoredLinkedinProfile | null | undefined>(undefined);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToLinkedinOptimizerProfile(user.uid, setProfile);
    return () => unsubscribe();
  }, [user?.uid]);

  /** The live subscription clears the page once the doc is gone, so on success we
   *  only need to close the modal — there is no local state to reset. */
  const handleDisconnect = async () => {
    if (!user?.uid) return;
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      await disconnectLinkedinProfile(user.uid);
      setShowDisconnect(false);
    } catch (error) {
      console.error("[LinkedInOptimiser] Disconnect failed:", error);
      setDisconnectError("Could not disconnect the profile. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const closeDisconnect = () => {
    if (disconnecting) return;
    setShowDisconnect(false);
    setDisconnectError(null);
  };

  const isLoading = profile === undefined;
  const checklist = buildProfileChecklist(profile?.scrapedData ?? null);
  const score = scoreFromChecklist(checklist);
  const tier = scoreTier(score);
  const missingItems = checklist.filter((item) => !item.filled);
  const filledCount = checklist.length - missingItems.length;
  const isLive = !isLoading && !!profile?.scrapedData;

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-8 pb-10">
        <PageHeader
          data-tour="linkedin-optimiser"
          eyebrow="LinkedIn"
          title="LinkedIn Optimiser"
          subtitle="Profile data and AI suggestions captured from the Cafy Chrome extension."
          actions={
            isLive ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-cafy-500" />
                  Live-synced
                </span>
                <button
                  type="button"
                  onClick={() => setShowDisconnect(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                >
                  <Unlink size={13} />
                  Disconnect profile
                </button>
              </>
            ) : undefined
          }
        />

        {isLoading && (
          <Card className="p-10 text-center">
            <p className="text-sm text-slate-400">Loading your LinkedIn data…</p>
          </Card>
        )}

        {!isLoading && !profile?.scrapedData && <EmptyState />}

        {!isLoading && profile?.scrapedData && (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiTile
                label="Profile Score"
                value={`${score}%`}
                icon={Gauge}
                hint={tier.label}
              />
              <KpiTile
                label="Sections Complete"
                value={`${filledCount}/${checklist.length}`}
                icon={ListChecks}
                hint={missingItems.length === 0 ? "All done" : `${missingItems.length} missing`}
              />
              <KpiTile
                label="Last Scanned"
                value={formatRelative(profile.lastScrapedAt)}
                icon={Clock}
                hint={formatTimestamp(profile.lastScrapedAt)}
              />
              <KpiTile
                label="AI Suggestions"
                value={profile.suggestions ? "Ready" : "Pending"}
                icon={Sparkles}
                hint={
                  profile.suggestions
                    ? `Generated ${formatRelative(profile.lastOptimizedAt)}`
                    : "Not generated yet"
                }
              />
            </section>

            <Card>
              <div className="relative">
                <div className="h-32 sm:h-40 w-full bg-slate-100">
                  {profile.scrapedData.bannerUrl ? (
                    <img
                      src={profile.scrapedData.bannerUrl}
                      alt="Profile banner"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                      No banner
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-8 left-6 w-20 h-20 rounded-full ring-4 ring-white bg-slate-200 overflow-hidden">
                  {profile.scrapedData.profilePhotoUrl ? (
                    <img
                      src={profile.scrapedData.profilePhotoUrl}
                      alt="Profile photo"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-10 pb-5 px-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900 truncate">
                    {profile.scrapedData.name || (
                      <span className="text-slate-400 font-normal">Name not detected</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5 truncate">
                    {profile.scrapedData.headline || (
                      <span className="text-slate-400">Headline not detected</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tier.badgeClass}`}
                  >
                    {score}% complete
                  </span>
                  <div className="h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${score}%`, backgroundColor: tier.barColor }}
                    />
                  </div>
                </div>
              </div>

              {missingItems.length > 0 ? (
                <div className="px-6 pb-5 flex flex-wrap gap-1.5">
                  {missingItems.map((item) => (
                    <span
                      key={item.key}
                      className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100"
                    >
                      Add {item.label.toLowerCase()}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="px-6 pb-5">
                  <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Every section is filled in
                  </span>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <Card>
                <CardHeader title="Quick Details" />
                <div className="px-5 py-4 space-y-2">
                  <ScrapedSection label="Headline" value={profile.scrapedData.headline} />
                  <ScrapedSection label="Skills" value={profile.scrapedData.skills} />
                  <ScrapedSection label="Certifications" value={profile.scrapedData.certifications} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Profile Details" />
                <div className="px-5 py-4 space-y-2">
                  <ScrapedSection label="About" value={profile.scrapedData.about} />
                  <ScrapedSection label="Experience" value={profile.scrapedData.experience} />
                  <ScrapedSection label="Education" value={profile.scrapedData.education} />
                  <ScrapedSection label="Projects" value={profile.scrapedData.projects} />
                </div>
              </Card>
            </div>

            {profile.suggestions ? (
              <Card>
                <CardHeader
                  title="AI Suggestions"
                  subtitle={`Generated ${formatTimestamp(profile.lastOptimizedAt)}`}
                />
                <div className="px-5 py-4 space-y-3">
                  {profile.suggestions.headline && (
                    <ResultBlock label="Headline" text={profile.suggestions.headline} />
                  )}
                  {profile.suggestions.about && (
                    <ResultBlock label="About" text={profile.suggestions.about} />
                  )}
                  {profile.suggestions.experience && (
                    <ResultBlock label="Experience" text={profile.suggestions.experience} />
                  )}
                  {profile.suggestions.skillsToAdd && (
                    <ResultBlock label="Skills to Add" text={profile.suggestions.skillsToAdd} />
                  )}
                  {profile.suggestions.generalTips && (
                    <ResultBlock label="General Tips" text={profile.suggestions.generalTips} />
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-6">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-cafy-50 text-cafy-600">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">No AI suggestions yet</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Run &quot;Optimise with AI&quot; from the extension to generate them — they
                      sync here automatically.
                    </p>
                    <a
                      href={CHROME_EXTENSION_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cafy-700 hover:text-cafy-800"
                    >
                      Open the extension
                      <ArrowRight size={12} />
                    </a>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {showDisconnect && (
        <DisconnectModal
          profileName={profile?.scrapedData?.name}
          disconnecting={disconnecting}
          error={disconnectError}
          onConfirm={handleDisconnect}
          onClose={closeDisconnect}
        />
      )}
    </div>
  );
};

export default LinkedInOptimiserTab;
