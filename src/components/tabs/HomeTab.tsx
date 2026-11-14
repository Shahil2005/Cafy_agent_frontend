import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "../../hooks/useAuth";
import { useBillingContext } from "../../context/BillingContext";
import { getWelcomeFirstName } from "../../utils/displayNameCache";
import { getDefaultSponsorshipPath } from "../../utils/sponsorshipHubRouting";
import { buildHomeToolGroups } from "../home/homeToolGroups";
import ToolGroupsGrid from "../home/ToolGroupsGrid";
import UserAvatar from "../common/UserAvatar";
import Cafy15CelebrationBanner from "../billing/Cafy15CelebrationBanner";
import {
  ArrowRight,
  CreditCard,
  LogOut,
  Loader2,
  User,
} from "lucide-react";

function greetingForNow(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function toDate(value: Date | string | Timestamp | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const UsageMeter: React.FC<{
  label: string;
  used: number;
  limit: number | null | undefined;
  unlimited: boolean;
}> = ({ label, used, limit, unlimited }) => {
  const hasLimit = !unlimited && typeof limit === "number" && limit > 0;
  const pct = hasLimit ? Math.min(100, Math.round((used / limit!) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="tabular-nums text-slate-500">
          {hasLimit ? `${used} / ${limit}` : unlimited ? "Unlimited" : used}
        </span>
      </div>
      {hasLimit ? (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-cafy-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
};

const HomeTab: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleSignOut, isSigningOut } = useAuth();
  const { billing, planLabel, productTier } = useBillingContext();
  const firstName = getWelcomeFirstName(user?.uid, user?.displayName);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(), []);
  const greeting = greetingForNow(now);
  const todayLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const sponsorshipPath = getDefaultSponsorshipPath(user?.preferences);
  const isFree = productTier === "free";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileOpen]);

  const toolGroups = buildHomeToolGroups(sponsorshipPath);

  const commUnlimited = billing ? billing.commRemaining === null : false;
  const careerUnlimited = billing?.careerAnalysisTier === "unlimited";

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar">
      <div className="flex min-h-full w-full flex-col gap-6 pb-8">
        <header data-tour="home-welcome" className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">{todayLabel}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Here&apos;s where your job search stands today.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/subscription")}
              className={`hidden items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:inline-flex ${
                isFree
                  ? "bg-cafy-600 text-white hover:bg-cafy-700"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {isFree ? "Upgrade" : planLabel}
            </button>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen((open) => !open)}
                className="rounded-full ring-2 ring-white shadow-sm transition-all hover:ring-cafy-100"
                aria-label="Open profile menu"
                aria-expanded={isProfileOpen}
              >
                <UserAvatar user={user} className="h-10 w-10" />
              </button>
              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate("/profile");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <User size={16} className="text-slate-400" />
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate("/subscription");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <CreditCard size={16} className="text-slate-400" />
                      {isFree ? "Upgrade plan" : "Manage plan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        void handleSignOut();
                      }}
                      disabled={isSigningOut}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-70"
                    >
                      {isSigningOut ? (
                        <Loader2 size={16} className="animate-spin text-rose-500" />
                      ) : (
                        <LogOut size={16} className="text-rose-400" />
                      )}
                      {isSigningOut ? "Signing out…" : "Sign out"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <Cafy15CelebrationBanner />

        <ToolGroupsGrid groups={toolGroups} />

        <section
          aria-label="Plan and usage"
          className="rounded-lg border border-slate-200 bg-white px-6 py-5"
        >
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr_1fr_auto] lg:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cafy-100 bg-cafy-50 text-cafy-600">
                <CreditCard size={18} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Current plan</p>
                <p className="truncate text-base font-semibold text-slate-900">{planLabel}</p>
                {billing?.cancelAtPeriodEnd && billing.currentPeriodEnd ? (
                  <p className="text-xs text-amber-600">
                    Ends {formatShortDate(toDate(billing.currentPeriodEnd))}
                  </p>
                ) : null}
              </div>
            </div>
            {billing ? (
              <>
                <UsageMeter
                  label="Cover letters & emails"
                  used={billing.commUsed}
                  limit={billing.commLimit}
                  unlimited={commUnlimited}
                />
                <UsageMeter
                  label="Career Path analyses"
                  used={billing.careerAnalysisUsed ?? 0}
                  limit={billing.careerAnalysisLimit}
                  unlimited={careerUnlimited}
                />
              </>
            ) : (
              <>
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
              </>
            )}
            <button
              type="button"
              onClick={() => navigate("/subscription")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isFree
                  ? "bg-cafy-600 text-white hover:bg-cafy-700"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {isFree ? "Upgrade plan" : "Manage plan"}
              <ArrowRight size={15} aria-hidden />
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default HomeTab;
