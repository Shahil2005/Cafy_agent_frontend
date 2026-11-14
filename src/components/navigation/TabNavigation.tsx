import React, { useState, useRef, useEffect } from "react";
import type { TabType } from "../../types";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import UserAvatar from "../common/UserAvatar";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  MessageSquare,
  FileText,
  X,
  LogOut,
  User,
  Briefcase,
  ChevronsUpDown,
  Chrome,
  Home,
  Globe,
  CalendarClock,
  ShieldCheck,
  GraduationCap,
  Route,
  BookOpen,
  PanelLeftOpen,
  PanelLeftClose,
  CreditCard,
  Crown,
  Loader2,
  Linkedin,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { useBilling } from "../../hooks/useBilling";
import { usePlanUsageModal } from "../../context/PlanUsageModalContext";
import { useBillingPortal } from "../../hooks/useBillingPortal";
import { isIrelandCareerLocation } from "../../utils/sponsorshipHubRouting";
type NavItem = {
  id: TabType;
  label: string;
  icon: LucideIcon;
};

interface TabNavigationProps {
  activeTab: TabType;
  navigate: (path: string) => void;
  /** Saved career locations from the app profile. Updates as soon as profile preferences are saved. */
  careerLocations?: string[] | null;
  isMobileSidebarOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

// Deterministic daily random number between 100-350 based on current date
const getDailyJobsCount = () => {
  const now = new Date();
  const dateSeed =
    now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  // Simple LCG randomizer
  const x = Math.sin(dateSeed) * 10000;
  const rand = x - Math.floor(x);
  return Math.floor(rand * (350 - 100 + 1)) + 100;
};

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  navigate,
  careerLocations,
  onClose,
  isCollapsed = false,
  onToggle,
}) => {
  const { user, handleSignOut, isSigningOut } = useAuth();
  const navLocations = careerLocations === undefined ? user?.preferences?.locations : careerLocations;
  const { billing, planLabel, isFullPremium, isJobsPremium, isPartTimePremium } = useBilling();
  const hasPaidPlan = isFullPremium || isJobsPremium || isPartTimePremium;
  const { openPlanUsageModal } = usePlanUsageModal();
  const { opening: portalOpening, openPortal } = useBillingPortal();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
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

  const menuGroups: { title: string; items: NavItem[] }[] = [
    {
      title: "Overview",
      items: [
        { id: "home", label: "Home", icon: Home },
        { id: "tracker", label: "Tracker", icon: Briefcase },
        { id: "trends", label: "Analytics", icon: TrendingUp },
      ],
    },
    {
      title: "Tools",
      items: [
        { id: "resume-studio", label: "Resume Studio", icon: FileText },
        { id: "chrome-extension", label: "Chrome Extension", icon: Chrome },
        { id: "linkedin-optimiser", label: "LinkedIn Optimiser", icon: Linkedin },
        {
          id: "commcenter",
          label: "Cover Letter or Email",
          icon: MessageSquare,
        },
      ],
    },
    {
      title: "Discover",
      items: [
        { id: "job-chat", label: "Chat with CAFY", icon: MessageSquare },
        { id: "jobs-portal", label: "Jobs", icon: Globe },
        { id: "part-time-jobs", label: "Part-time jobs", icon: CalendarClock },
        { id: "jobs-companies", label: "Companies", icon: Building2 },
        { id: "sponsorship", label: "Sponsorship Hub", icon: ShieldCheck },
        { id: "career-path", label: "Career Path", icon: Route },
        { id: "career-counselling", label: "Career Counselling", icon: GraduationCap },
        { id: "resources", label: "Resources", icon: BookOpen },
      ],
    },
  ];

  return (
    <>
    <aside
      className={`
      ${isCollapsed ? "w-20" : "w-64"} 
      h-full bg-white border-r border-slate-200 flex flex-col font-sans relative overflow-visible transition-all duration-300 ease-in-out
    `}
    >
      {/* Header Area: Logo - Fixed at top */}
      <div
        className={`p-6 pb-2 flex-shrink-0 z-20 bg-white ${isCollapsed ? "px-2" : ""}`}
      >
        <div
          className={`relative group flex ${isCollapsed ? "flex-col items-center justify-center min-h-[48px]" : "items-center justify-between"}`}
        >
          {/* Logo Area */}
          <Link
            to="/home"
            className={`flex items-center transition-opacity duration-300 ${isCollapsed ? "justify-center group-hover:opacity-0" : "gap-2.5"}`}
          >
            <div
              className={`p-2 rounded-xl group-hover/logo:bg-slate-50 transition-colors flex items-center justify-center`}
            >
              <img
                src="/CAFY-Icon.svg"
                alt="Cafy Logo"
                className="w-8 h-8 object-contain opacity-90 group-hover:opacity-100 transition-opacity"
              />
            </div>
            {!isCollapsed && (
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Cafy
              </h1>
            )}
          </Link>

          {/* Desktop Toggle (Overlaid on Logo when collapsed) */}
          {onToggle && !onClose && (
            <button
              onClick={onToggle}
              className={`
                hidden lg:flex p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-300
                ${isCollapsed 
                  ? "absolute inset-0 m-auto w-10 h-10 items-center justify-center opacity-0 group-hover:opacity-100 bg-white shadow-sm border border-slate-100 z-30" 
                  : "relative"
                }
              `}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={18} />}
            </button>
          )}

          {/* Mobile Close - Always visible */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors overflow-visible"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 px-4 space-y-8 pb-4 overflow-y-auto overscroll-y-contain custom-scrollbar relative">
        {/* Navigation Groups */}
        {menuGroups.map((group) => (
          <div key={group.title}>
            {!isCollapsed && (
              <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                {group.title}
              </h3>
            )}
            <div
              className={`space-y-1 ${isCollapsed ? "flex flex-col items-center" : ""}`}
            >
              {group.items
                .filter((tab) => {
                  if (tab.id === 'part-time-jobs') {
                    return !isIrelandCareerLocation(navLocations);
                  }
                  return true;
                })
                .map((tab) => {
                const Icon = tab.icon;
                const isActive =
                  activeTab === tab.id ||
                  (tab.id === "tracker" && activeTab === "tracker");
                const handleTabClick = () => {
                  navigate(
                    tab.id === "sponsorship"
                      ? isIrelandCareerLocation(navLocations)
                        ? "/sponsorship/ireland"
                        : "/sponsorship"
                      : tab.id === "jobs-companies"
                      ? "/jobs-portal/companies"
                      : `/${tab.id}`
                  );
                  onClose?.();
                };

                return (
                  <button
                    key={tab.id}
                    data-tour={`nav-${tab.id}`}
                    onClick={handleTabClick}
                    className={`
                      relative w-full flex items-center gap-3 px-3 py-2.5 
                      text-sm font-medium rounded-lg group
                      ${isCollapsed ? "justify-center px-2" : ""}
                      ${
                        isActive
                          ? "bg-blue-50 text-slate-900 shadow-sm border border-blue-200 font-bold"
                          : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                      }
                    `}
                    title={isCollapsed ? tab.label : ""}
                  >
                    <Icon
                      size={18}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={
                        isActive
                          ? "text-blue-600"
                          : "text-slate-500 group-hover:text-slate-900"
                      }
                    />
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5 transition-opacity duration-200">
                        <span className="truncate tracking-wide">
                          {tab.label}
                        </span>
                        {tab.id === "jobs-portal" && (
                          <div className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm shadow-blue-200 flex items-center gap-1.5 leading-none border border-blue-400/30">
                            {getDailyJobsCount()}{" "}
                            <span className="text-[10px] font-semibold text-blue-50/90 whitespace-nowrap">
                              New jobs added
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Area: User Profile - Fixed at bottom */}
      <div className="p-4 border-t border-slate-200 bg-white flex-shrink-0 z-30 overflow-visible">
        <div className="relative overflow-visible" ref={profileRef}>
          <button
            onClick={() => {
              if (isCollapsed) {
                setIsProfileOpen(false);
                onClose?.();
                navigate("/profile");
                return;
              }
              setIsProfileOpen(!isProfileOpen);
            }}
            className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group ${isCollapsed ? "justify-center" : ""}`}
          >
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-full overflow-hidden">
              <UserAvatar user={user} />
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                    {user?.displayName || "User"}
                  </p>
                  <p className="text-[11px] font-semibold truncate flex items-center gap-1 mt-0.5">
                    {(isFullPremium || isJobsPremium || isPartTimePremium) ? (
                      <Crown size={10} className={isFullPremium ? "text-amber-500 shrink-0" : "text-teal-500 shrink-0"} />
                    ) : null}
                    <span className={hasPaidPlan ? (isFullPremium ? "text-indigo-600" : "text-teal-600") : "text-slate-500"}>{planLabel}</span>
                  </p>
                </div>
                <ChevronsUpDown
                  size={16}
                  className="text-slate-400 group-hover:text-slate-600 transition-colors"
                />
              </>
            )}
          </button>

          <AnimatePresence>
            {!isCollapsed && isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={[
                  "absolute bottom-full mb-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 z-50 overflow-hidden",
                  isCollapsed ? "left-full ml-3 w-56" : "left-0 right-0 w-full",
                ].join(" ")}
              >
                <div className="p-2 space-y-0.5">
                  <Link
                    to="/profile"
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors group"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onClose?.();
                    }}
                  >
                    <User
                      size={16}
                      className="text-slate-400 group-hover:text-slate-600 transition-colors"
                    />
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors group"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onClose?.();
                      openPlanUsageModal();
                    }}
                  >
                    <Crown
                      size={16}
                      className={hasPaidPlan ? (isFullPremium ? "text-amber-500" : "text-teal-500") : "text-slate-400 group-hover:text-slate-600"}
                    />
                    <span className="flex-1 text-left">Plan & usage</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isFullPremium
                          ? "bg-indigo-100 text-indigo-700"
                          : isJobsPremium
                            ? "bg-teal-100 text-teal-700"
                            : isPartTimePremium
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isFullPremium
                        ? "Pro"
                        : isJobsPremium
                          ? "Jobs"
                          : isPartTimePremium
                            ? "Part-time"
                            : "Free"}
                    </span>
                  </button>
                  {hasPaidPlan && billing?.provider === "stripe" && (
                    <button
                      type="button"
                      disabled={portalOpening}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors group disabled:opacity-60"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onClose?.();
                        void openPortal();
                      }}
                    >
                      {portalOpening ? (
                        <Loader2 size={16} className="animate-spin text-indigo-500" />
                      ) : (
                        <CreditCard size={16} className="text-slate-400 group-hover:text-slate-600" />
                      )}
                      {portalOpening ? "Opening portal…" : "Manage billing"}
                    </button>
                  )}
                </div>
                <div className="p-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={isSigningOut}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors group disabled:opacity-70 disabled:pointer-events-none"
                  >
                    {isSigningOut ? (
                      <Loader2 size={16} className="animate-spin text-rose-500" />
                    ) : (
                      <LogOut
                        size={16}
                        className="text-rose-400 group-hover:text-rose-600 transition-colors"
                      />
                    )}
                    {isSigningOut ? "Signing out…" : "Sign Out"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
    </>
  );
};

export default TabNavigation;
