import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MapPin,
  Building2,
  X,
  AlertTriangle,
  Briefcase,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchSponsorshipPage,
  SPONSORSHIP_PAGE_SIZE,
  SPONSORSHIP_SEARCH_MAX_LENGTH,
  type SponsorCompanyResult,
  type SponsorshipPageResult,
} from "../../services/jobsPortalService";
import { getCompaniesHouseData } from "../../services/companiesHouse";
import type { SocMasterOccupation } from "../../types/soc";
import SponsorshipHubShell from "../sponsorship-hub/SponsorshipHubShell";
import SocSponsorshipPanel from "../sponsorship-hub/SocSponsorshipPanel";
import { getSponsorshipStatusMeta } from "../sponsorship-hub/socDisplay";
import UkSponsorCompanyCard from "../sponsorship-hub/UkSponsorCompanyCard";
import UkRoleCard from "../sponsorship-hub/UkRoleCard";
import SponsorCompanyLogo from "../sponsorship-hub/SponsorCompanyLogo";
import { useModalScrollLock } from "../sponsorship-hub/useModalScrollLock";
import OfficialDirectoryDisclaimer from "../sponsorship-hub/OfficialDirectoryDisclaimer";
import ActionToast from "../sponsorship-hub/ActionToast";
import { useSponsorCardActions } from "../sponsorship-hub/useSponsorCardActions";
import { sponsorCompanyKey, migrateUkCompanyFavorite } from "../sponsorship-hub/favoriteKeys";

type SponsorCompany = SponsorCompanyResult;

const UK_FAVORITES_STORAGE_KEY = "cafy:uk-sponsor-favorites";
const UK_ROLE_FAVORITES_STORAGE_KEY = "cafy:uk-role-favorites";

const APPLICANT_STATUS_ORDER: SocMasterOccupation["sponsorship"]["applicantStatus"][] = [
  "open_to_new_applicants",
  "legacy_only_existing_visa_holders",
  "not_eligible",
];


const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

const SponsorshipHubV2: React.FC = () => {
  const { width } = useWindowSize();
  const [searchParams] = useSearchParams();
  const openRoles = searchParams.get("tab") === "roles";
  const roleCode = openRoles ? (searchParams.get("code") ?? "") : "";

  const [activeTab, setActiveTab] = useState<"companies" | "roles">(openRoles ? "roles" : "companies");
  const [roleSearchQuery, setRoleSearchQuery] = useState(roleCode);

  useEffect(() => {
    if (searchParams.get("tab") !== "roles") return;
    setActiveTab("roles");
    const code = searchParams.get("code");
    if (code) setRoleSearchQuery(code);
  }, [searchParams]);
  const [currentRolePage, setCurrentRolePage] = useState(1);
  const [selectedSkilledStatuses, setSelectedSkilledStatuses] = useState<string[]>([]);
  const [islOnly, setIslOnly] = useState(false);
  const [phdOnly, setPhdOnly] = useState(false);
  const [rolesSidebarOpen, setRolesSidebarOpen] = useState(false);

  const {
    favorites: companyFavorites,
    favoriteSnapshots: companyFavoriteSnapshots,
    favoriteCount: companyFavoriteCount,
    toggleFavorite: toggleCompanyFavorite,
    shareItem: shareCompany,
    actionMessage: companyActionMessage,
    favoritesSyncHint: companyFavoritesSyncHint,
  } = useSponsorCardActions<SponsorCompanyResult>(UK_FAVORITES_STORAGE_KEY, {
    migrateEntry: migrateUkCompanyFavorite,
  });

  const {
    favorites: roleFavorites,
    favoriteSnapshots: roleFavoriteSnapshots,
    favoriteCount: roleFavoriteCount,
    toggleFavorite: toggleRoleFavorite,
    shareItem: shareRole,
    actionMessage: roleActionMessage,
    favoritesSyncHint: roleFavoritesSyncHint,
  } = useSponsorCardActions<SocMasterOccupation>(UK_ROLE_FAVORITES_STORAGE_KEY);

  const actionMessage = companyActionMessage ?? roleActionMessage;
  const [showCompanyFavoritesOnly, setShowCompanyFavoritesOnly] = useState(false);
  const [showRoleFavoritesOnly, setShowRoleFavoritesOnly] = useState(false);

  // Sponsorship companies — server-driven
  const [pageData, setPageData] = useState<SponsorshipPageResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [cityFilterSearch, setCityFilterSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [selectedCompany, setSelectedCompany] = useState<SponsorCompany | null>(null);
  const [selectedRole, setSelectedRole] = useState<SocMasterOccupation | null>(null);
  const [socCodes, setSocCodes] = useState<SocMasterOccupation[] | null>(null);
  const [socGeneratedAt, setSocGeneratedAt] = useState<string | null>(null);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesLoadError, setRolesLoadError] = useState<string | null>(null);

  const displayLimit = SPONSORSHIP_PAGE_SIZE;

  // Debounce search input — reset to page 1 once the debounced value settles
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCities]);

  // Fetch one page from the backend whenever page or search changes.
  // AbortController cancels the in-flight HTTP request on cleanup so that:
  //   • React StrictMode's mount→cleanup→remount cycle only sends ONE request
  //   • Rapid filter/search changes abort stale requests instead of racing
  useEffect(() => {
    if (showCompanyFavoritesOnly) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    fetchSponsorshipPage({
      page: currentPage,
      q: debouncedSearch || undefined,
      cities: selectedCities.length > 0 ? selectedCities : undefined,
      signal: controller.signal,
    })
      .then(result => {
        setPageData(result);
        setLoadError(null);
        setInitialFetchDone(true);
        setIsLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error("Failed to load sponsorship data:", err);
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Unable to load the sponsor register. Please try again.'
        );
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [currentPage, debouncedSearch, selectedCities, reloadNonce, showCompanyFavoritesOnly]);

  const filteredCompanyFavorites = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return companyFavoriteSnapshots.filter((company) => {
      if (q && !company.organisationName.toLowerCase().includes(q) && !company.townCity.toLowerCase().includes(q)) {
        return false;
      }
      if (
        selectedCities.length > 0 &&
        !selectedCities.some((c) => c.toLowerCase() === company.townCity.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [companyFavoriteSnapshots, debouncedSearch, selectedCities]);

  const companyFavoritesTotalPages = Math.max(
    1,
    Math.ceil(filteredCompanyFavorites.length / displayLimit)
  );
  const safeCompanyFavoritesPage = Math.min(currentPage, companyFavoritesTotalPages);
  const paginatedCompanyFavorites = showCompanyFavoritesOnly
    ? filteredCompanyFavorites.slice(
        (safeCompanyFavoritesPage - 1) * displayLimit,
        safeCompanyFavoritesPage * displayLimit
      )
    : [];

  const displayCompanies = showCompanyFavoritesOnly
    ? paginatedCompanyFavorites
    : (pageData?.companies ?? []);
  const displayCompanyTotalCount = showCompanyFavoritesOnly
    ? filteredCompanyFavorites.length
    : (pageData?.totalCount ?? 0);
  const displayCompanyTotalPages = showCompanyFavoritesOnly
    ? companyFavoritesTotalPages
    : (pageData?.totalPages ?? 1);
  const displayCompanyLoading = showCompanyFavoritesOnly ? false : isLoading;
  const displayCompanyInitialDone = showCompanyFavoritesOnly ? true : initialFetchDone;

  const retryLoad = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  const toggleCity = useCallback((city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedCities([]);
    setCityFilterSearch("");
    setSearchQuery("");
    setShowCompanyFavoritesOnly(false);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    if (activeTab !== "roles" || socCodes) return;

    let cancelled = false;
    setRolesLoading(true);
    setRolesLoadError(null);

    import("../../data/socMaster")
      .then((module) => {
        if (!cancelled) {
          setSocCodes(module.socOccupations);
          setSocGeneratedAt(module.SOC_MASTER_GENERATED_AT);
          setRolesLoadError(null);
        }
      })
      .catch((err) => {
        console.error("Failed to load SOC codes:", err);
        if (!cancelled) {
          setRolesLoadError('Unable to load occupation data. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, socCodes]);

  const retryRolesLoad = useCallback(() => {
    setSocCodes(null);
    setRolesLoadError(null);
  }, []);

  // Reset role pagination when role filters change
  useEffect(() => {
    setCurrentRolePage(1);
  }, [roleSearchQuery, selectedSkilledStatuses, islOnly, phdOnly]);

  // code -> occupation, for resolving stored role favourites (which may hold an
  // older thin snapshot shape) back to the full master record.
  const localByCode = useMemo(
    () => new Map((socCodes ?? []).map((o): [string, SocMasterOccupation] => [o.code, o])),
    [socCodes],
  );

  const skilledStatusCounts = useMemo(() => {
    if (!socCodes) return [];
    const map = new Map<string, number>();
    for (const role of socCodes) {
      const s = role.sponsorship.applicantStatus;
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return APPLICANT_STATUS_ORDER.filter((s) => map.has(s)).map((s) => ({
      value: s,
      label: getSponsorshipStatusMeta(s).label,
      count: map.get(s) ?? 0,
    }));
  }, [socCodes]);

  const filteredRoles = useMemo(() => {
    const source: SocMasterOccupation[] = showRoleFavoritesOnly
      ? roleFavoriteSnapshots
          .map((snap) => localByCode.get((snap as { code?: string })?.code ?? ""))
          .filter((r): r is SocMasterOccupation => !!r)
      : socCodes ?? [];
    const q = roleSearchQuery.trim().toLowerCase();
    return source.filter((role) => {
      if (q) {
        const matchesSearch =
          role.title.toLowerCase().includes(q) ||
          role.code.includes(q) ||
          role.category.toLowerCase().includes(q) ||
          role.relatedJobTitles.some((t) => t.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      if (
        selectedSkilledStatuses.length > 0 &&
        !selectedSkilledStatuses.includes(role.sponsorship.applicantStatus)
      ) {
        return false;
      }
      if (islOnly && !role.sponsorship.immigrationSalaryList) return false;
      if (phdOnly && role.sponsorship.phdEligible !== true) return false;
      return true;
    });
  }, [
    socCodes,
    localByCode,
    roleFavoriteSnapshots,
    showRoleFavoritesOnly,
    roleSearchQuery,
    selectedSkilledStatuses,
    islOnly,
    phdOnly,
  ]);

  const totalRolePages = Math.max(1, Math.ceil(filteredRoles.length / displayLimit));
  const paginatedRoles = filteredRoles.slice(
    (currentRolePage - 1) * displayLimit,
    currentRolePage * displayLimit
  );

  const toggleSkilledStatus = useCallback((status: string) => {
    setSelectedSkilledStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }, []);

  const clearRoleFilters = useCallback(() => {
    setRoleSearchQuery("");
    setSelectedSkilledStatuses([]);
    setIslOnly(false);
    setPhdOnly(false);
    setShowRoleFavoritesOnly(false);
    setCurrentRolePage(1);
  }, []);

  const rolesFilterSidebar = (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Sponsorship status</h3>
        <div className="space-y-1">
          {skilledStatusCounts.map(({ value, label, count }) => (
            <label
              key={value}
              className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-blue-50/50 cursor-pointer"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedSkilledStatuses.includes(value)}
                  onChange={() => toggleSkilledStatus(value)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </span>
              <span className="text-xs font-semibold text-slate-400">{count.toLocaleString()}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Eligibility</h3>
        <label className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-blue-50/50 cursor-pointer">
          <input
            type="checkbox"
            checked={islOnly}
            onChange={(e) => setIslOnly(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">Immigration Salary List only</span>
        </label>
        <label className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-blue-50/50 cursor-pointer">
          <input
            type="checkbox"
            checked={phdOnly}
            onChange={(e) => setPhdOnly(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">PhD eligible only</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="bg-white flex-1 flex flex-col h-full overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 pt-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-4">
          UK Visa Sponsor Register
        </h1>
        <div className="flex gap-2 sm:gap-4 border-b border-slate-200 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab("companies")}
              className={`px-3 sm:px-4 py-3 flex items-center gap-2 font-medium transition-colors whitespace-nowrap ${activeTab === "companies"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <Building2 size={18} />
              Companies
            </button>
            <button
              onClick={() => setActiveTab("roles")}
              className={`px-3 sm:px-4 py-3 flex items-center gap-2 font-medium transition-colors whitespace-nowrap ${activeTab === "roles"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-500 hover:text-slate-900"
                }`}
            >
              <Briefcase size={18} />
              Roles
            </button>
          </div>
      </div>

      {activeTab === "companies" ? (
        <SponsorshipHubShell
          tourId="sponsorship-hub"
          searchPlaceholder="Search for a company by name..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchMaxLength={SPONSORSHIP_SEARCH_MAX_LENGTH}
          disclaimer={
            <OfficialDirectoryDisclaimer>
              This directory mirrors the official UK Home Office register of licensed sponsors.
              Company details are sourced from government records; Cafy does not modify the register.
            </OfficialDirectoryDisclaimer>
          }
          cityFilterOptions={pageData?.stats.cityCounts ?? []}
          selectedCities={selectedCities}
          onToggleCity={toggleCity}
          onClearFilters={clearFilters}
          cityFilterSearch={cityFilterSearch}
          onCityFilterSearchChange={setCityFilterSearch}
          showFavoritesOnly={showCompanyFavoritesOnly}
          onShowFavoritesOnlyChange={(value) => {
            setShowCompanyFavoritesOnly(value);
            setCurrentPage(1);
          }}
          favoritesCount={companyFavoriteCount}
          favoritesSyncHint={companyFavoritesSyncHint}
          resultsLabel={showCompanyFavoritesOnly ? "saved favourites" : "companies found"}
          resultsCount={displayCompanyTotalCount}
          resultsMeta={
            displayCompanyInitialDone
              ? showCompanyFavoritesOnly
                ? companyFavoritesSyncHint
                : `${(pageData?.stats.total ?? 0).toLocaleString()} licensed sponsors on register`
              : undefined
          }
          isLoading={displayCompanyLoading}
          initialFetchDone={displayCompanyInitialDone}
          loadError={showCompanyFavoritesOnly ? null : loadError}
          onRetry={retryLoad}
          currentPage={showCompanyFavoritesOnly ? safeCompanyFavoritesPage : currentPage}
          totalPages={displayCompanyTotalPages}
          totalCount={displayCompanyTotalCount}
          pageSize={displayLimit}
          onPageChange={setCurrentPage}
          windowWidth={width}
          sidebarOpen={sidebarOpen}
          onSidebarOpenChange={setSidebarOpen}
        >
          {displayCompanyLoading
            ? Array.from({ length: displayLimit }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse h-80"
                />
              ))
            : displayCompanies.map((company, index) => (
                <UkSponsorCompanyCard
                  key={sponsorCompanyKey(company)}
                  company={company}
                  index={index}
                  isFavorite={companyFavorites.has(sponsorCompanyKey(company))}
                  onToggleFavorite={() =>
                    toggleCompanyFavorite(
                      sponsorCompanyKey(company),
                      company.organisationName,
                      company
                    )
                  }
                  onShare={() =>
                    shareCompany(
                      company.organisationName,
                      `${company.organisationName}. UK licensed sponsor (${company.route}). Official Home Office register.`
                    )
                  }
                  onViewProfile={() => setSelectedCompany(company)}
                />
              ))}
        </SponsorshipHubShell>
      ) : rolesLoading && !socCodes ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 bg-slate-50/50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loading occupation data...</p>
        </div>
      ) : rolesLoadError && !socCodes ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/50">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 max-w-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 flex-1">{rolesLoadError}</p>
            <button
              type="button"
              onClick={retryRolesLoad}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-red-200 text-sm font-semibold text-red-800"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      ) : socCodes ? (
        <SponsorshipHubShell
          searchPlaceholder="Search for a job title or SOC code..."
          searchQuery={roleSearchQuery}
          onSearchChange={setRoleSearchQuery}
          searchMaxLength={SPONSORSHIP_SEARCH_MAX_LENGTH}
          disclaimer={
            <OfficialDirectoryDisclaimer title="Official occupation reference">
              Salary going rates, visa routes and Immigration Salary List status are the official
              UK government SOC 2020 / Home Office Appendix Skilled Worker figures
              {socGeneratedAt ? ` (dataset generated ${new Date(socGeneratedAt).toLocaleDateString()})` : ""}.
              Always confirm requirements on GOV.UK before applying.
            </OfficialDirectoryDisclaimer>
          }
          customFilterSidebar={rolesFilterSidebar}
          hasActiveFilters={
            selectedSkilledStatuses.length > 0 ||
            islOnly ||
            phdOnly ||
            roleSearchQuery.length > 0 ||
            showRoleFavoritesOnly
          }
          onClearFilters={clearRoleFilters}
          showFavoritesOnly={showRoleFavoritesOnly}
          onShowFavoritesOnlyChange={(value) => {
            setShowRoleFavoritesOnly(value);
            setCurrentRolePage(1);
          }}
          favoritesCount={roleFavoriteCount}
          favoritesSyncHint={roleFavoritesSyncHint}
          resultsLabel={showRoleFavoritesOnly ? "saved favourites" : "occupations found"}
          resultsCount={filteredRoles.length}
          resultsMeta={
            showRoleFavoritesOnly
              ? roleFavoritesSyncHint
              : `${(socCodes?.length ?? 0).toLocaleString()} SOC 2020 occupations in directory`
          }
          isLoading={false}
          initialFetchDone
          loadError={null}
          onRetry={retryRolesLoad}
          currentPage={currentRolePage}
          totalPages={totalRolePages}
          totalCount={filteredRoles.length}
          pageSize={displayLimit}
          onPageChange={setCurrentRolePage}
          windowWidth={width}
          sidebarOpen={rolesSidebarOpen}
          onSidebarOpenChange={setRolesSidebarOpen}
        >
          {paginatedRoles.map((role, index) => (
            <UkRoleCard
              key={role.code}
              role={role}
              index={index}
              isFavorite={roleFavorites.has(role.code)}
              onToggleFavorite={() => toggleRoleFavorite(role.code, role.title, role)}
              onShare={() =>
                shareRole(
                  role.title,
                  `${role.title} (SOC ${role.code}). ${getSponsorshipStatusMeta(role.sponsorship.applicantStatus).label}. UK skilled worker reference.`
                )
              }
              onViewProfile={() => setSelectedRole(role)}
            />
          ))}
        </SponsorshipHubShell>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-50/50">
          Occupation data is unavailable. Please refresh the page.
        </div>
      )}

      <ActionToast message={actionMessage} />

      <AnimatePresence>
        {selectedCompany && (
          <CompanyDetailModal
            company={selectedCompany}
            onClose={() => setSelectedCompany(null)}
          />
        )}
        {selectedRole && (
          <RoleDetailModal
            role={selectedRole}
            onClose={() => setSelectedRole(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

type CompaniesHouseData = {
  registrationNumber: string;
  foundedYear: string | null;
  registeredAddress: string;
  sicCodes: string[];
};

const CompanyDetailModal: React.FC<{
  company: SponsorCompany;
  onClose: () => void;
}> = ({ company, onClose }) => {
  const isARating = company.typeRating.includes("A rating");
  const [chData, setChData] = useState<CompaniesHouseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chError, setChError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalScrollLock(panelRef);

  useEffect(() => {
    let cancelled = false;
    setChData(null);
    setChError(null);
    setIsLoading(true);

    getCompaniesHouseData(company.organisationName)
      .then(data => {
        if (!cancelled) {
          setChData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setChError(
            err instanceof Error
              ? err.message
              : 'Organisation details are temporarily unavailable.'
          );
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company.organisationName]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 scrollbar-hide"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <motion.div
        ref={panelRef}
        initial={{ scale: 0.95, opacity: 0, y: 100 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 100 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sponsor-company-modal-title"
        className="bg-white w-full max-w-2xl h-[95vh] sm:h-auto sm:max-h-[85vh] overflow-y-auto overscroll-contain scrollbar-hide rounded-t-2xl sm:rounded-lg border border-slate-200 shadow-xl relative"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 sm:p-6 flex items-start justify-between gap-3 z-10">
          <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
            <SponsorCompanyLogo companyName={company.organisationName} size={48} />
            <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h2 id="sponsor-company-modal-title" className="text-base sm:text-lg md:text-xl font-bold text-slate-900 break-words leading-tight">
                  {company.organisationName}
                </h2>
                {isARating && (
                  <span className="inline-block px-2 py-1 rounded text-[10px] sm:text-xs font-medium bg-blue-50 text-blue-700 w-fit">
                    A Rating
                  </span>
                )}
              </div>
              {company.townCity && (
                <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1">
                  <MapPin size={14} className="shrink-0 text-blue-500" />
                  <span className="truncate">{company.townCity}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close company details"
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors rounded shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5">

          {/* Sponsorship register data */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Sponsorship Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Visa Route</p>
                <p className="text-slate-900 text-sm font-semibold">{company.route}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Type & Rating</p>
                <p className="text-slate-900 text-sm font-semibold">{company.typeRating}</p>
              </div>
            </div>
          </div>

          {/* Organisation details */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Organisation Details</h3>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Matched by company name via Companies House. Verify the registration number before relying on this information.
            </p>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl border border-slate-200 bg-slate-50">
                <Loader2 className="animate-spin text-blue-600" size={28} />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Loading details...</p>
                  <p className="text-xs text-slate-400 mt-0.5">Please wait a moment</p>
                </div>
              </div>
            ) : chData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Registration Number</p>
                  <p className="text-slate-900 font-mono text-sm font-semibold break-all">{chData.registrationNumber}</p>
                </div>
                {chData.foundedYear && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Founded</p>
                    <p className="text-slate-900 text-sm font-semibold">{chData.foundedYear}</p>
                  </div>
                )}
                {chData.registeredAddress && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 sm:col-span-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Registered Address</p>
                    <p className="text-slate-900 text-sm font-semibold">{chData.registeredAddress}</p>
                  </div>
                )}
                {chData.sicCodes && chData.sicCodes.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 sm:col-span-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Industry</p>
                    <div className="flex flex-wrap gap-2">
                      {chData.sicCodes.map((code, i) => (
                        <span key={i} className="text-xs bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 py-4 px-4 rounded-xl border border-slate-200 bg-slate-50">
                <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {chError ?? 'No matching organisation found on Companies House'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {chError
                      ? 'You can still use the sponsor register details above.'
                      : 'Try searching the register listing or verify the company name.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <OfficialDirectoryDisclaimer>
            Sponsor register fields are from the official UK Home Office directory. Companies House
            details are matched separately and should be verified before use.
          </OfficialDirectoryDisclaimer>

        </div>
      </motion.div>
    </motion.div>
  );
};

const RoleDetailModal: React.FC<{
  role: SocMasterOccupation;
  onClose: () => void;
}> = ({ role, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalScrollLock(panelRef);
  const statusMeta = getSponsorshipStatusMeta(role.sponsorship.applicantStatus);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.95, y: 100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 100 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sponsor-role-modal-title"
        className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-3xl h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto overscroll-contain scrollbar-hide shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-200 p-4 sm:p-6 flex justify-between items-start gap-3 z-10">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-start gap-2 sm:gap-3 mb-3">
              <div className="p-1.5 sm:p-2 bg-indigo-50 rounded-lg shrink-0">
                <Briefcase size={20} className="text-indigo-700 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h2 id="sponsor-role-modal-title" className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 break-words">{role.title}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] sm:text-sm font-mono text-slate-700 font-bold bg-slate-100 px-2 sm:px-2.5 py-1 rounded border border-slate-300 shadow-sm inline-block">
                    SOC {role.code}
                  </span>
                  <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full ${statusMeta.chip}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">{role.category}</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close role details"
            className="p-2 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0 text-slate-400 hover:text-slate-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
          {/* Related Job Titles */}
          {role.relatedJobTitles.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                Related Job Titles
              </h3>
              <p className="text-base text-slate-600 leading-relaxed">
                {role.relatedJobTitles.join(" · ")}
              </p>
            </div>
          )}

          {/* Sponsorship & salary — identical to the Career Path detail view */}
          <SocSponsorshipPanel
            socData={{
              skillLevel: role.skillLevel,
              expandedJobTitles: null,
              sponsorship: role.sponsorship,
              salary: role.salary,
            }}
            socCode={role.code}
          />

          {/* Important Information - Fixed Visibility */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <AlertTriangle
                size={22}
                className="text-blue-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <h4 className="text-base font-bold text-blue-900 mb-2">
                  Official Guidance Note
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  This data is sourced directly from the UK Government's SOC 2020
                  classification system. Eligibility rules change frequently.
                  Always verify with official UK Visas and Immigration guidance
                  before submitting applications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div >
    </motion.div >
  );
};

export default SponsorshipHubV2;
