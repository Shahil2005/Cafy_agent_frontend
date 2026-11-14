import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MapPin, X, FileBadge2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchIrelandSponsorshipPage,
  SPONSORSHIP_PAGE_SIZE,
  SPONSORSHIP_SEARCH_MAX_LENGTH,
  type IrelandEmployerResult,
  type IrelandSponsorshipPageResult,
} from "../../services/jobsPortalService";
import SponsorshipHubShell from "../sponsorship-hub/SponsorshipHubShell";
import IrelandFilterSidebar from "../sponsorship-hub/IrelandFilterSidebar";
import IrelandSponsorCompanyCard from "../sponsorship-hub/IrelandSponsorCompanyCard";
import SponsorCompanyLogo from "../sponsorship-hub/SponsorCompanyLogo";
import OfficialDirectoryDisclaimer from "../sponsorship-hub/OfficialDirectoryDisclaimer";
import ActionToast from "../sponsorship-hub/ActionToast";
import { useSponsorCardActions } from "../sponsorship-hub/useSponsorCardActions";
import { useModalScrollLock } from "../sponsorship-hub/useModalScrollLock";
import { irelandEmployerKey, migrateIrelandEmployerFavorite } from "../sponsorship-hub/favoriteKeys";
import {
  PERMIT_RANGE_BOUNDS,
  employerHasPermitInSelectedYears,
  matchesAnyPermitRange,
  volumePermitCount,
} from "../../utils/irelandSponsorshipFilters";

const PERMIT_YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"] as const;

const MONTH_LABELS = [
  { key: "permitsJan" as const, label: "Jan" },
  { key: "permitsFeb" as const, label: "Feb" },
  { key: "permitsMar" as const, label: "Mar" },
  { key: "permitsApr" as const, label: "Apr" },
  { key: "permitsMay" as const, label: "May" },

  
  { key: "permitsJun" as const, label: "Jun" },
  { key: "permitsJul" as const, label: "Jul" },
];

function employerKey(company: IrelandEmployerResult): string {
  return irelandEmployerKey(company);
}

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
  });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
};

const SponsorshipHubIreland: React.FC = () => {
  const { width } = useWindowSize();
  const { favorites, favoriteSnapshots, favoriteCount, toggleFavorite, shareItem, actionMessage, favoritesSyncHint } =
    useSponsorCardActions<IrelandEmployerResult>("cafy:ireland-sponsor-favorites", {
      migrateEntry: migrateIrelandEmployerFavorite,
    });

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [pageData, setPageData] = useState<IrelandSponsorshipPageResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedRanges, setSelectedRanges] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState<IrelandEmployerResult | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYears, selectedRanges]);

  useEffect(() => {
    if (showFavoritesOnly) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    fetchIrelandSponsorshipPage({
      page: currentPage,
      q: debouncedSearch || undefined,
      years: selectedYears.length > 0 ? selectedYears : undefined,
      ranges: selectedRanges.length > 0 ? selectedRanges : undefined,
      signal: controller.signal,
    })
      .then((result) => {
        setPageData(result);
        setLoadError(null);
        setInitialFetchDone(true);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load Ireland employment permit data. Please try again."
        );
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [currentPage, debouncedSearch, selectedYears, selectedRanges, reloadNonce, showFavoritesOnly]);

  const filteredFavorites = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const rangeDefs = selectedRanges
      .map((id) => PERMIT_RANGE_BOUNDS[id])
      .filter((bounds): bounds is [number, number] => Boolean(bounds));
    return favoriteSnapshots.filter((company) => {
      if (q && !company.employerName.toLowerCase().includes(q)) return false;
      if (!employerHasPermitInSelectedYears(company, selectedYears)) return false;
      if (
        rangeDefs.length > 0 &&
        !matchesAnyPermitRange(volumePermitCount(company, selectedYears), rangeDefs)
      ) {
        return false;
      }
      return true;
    });
  }, [favoriteSnapshots, debouncedSearch, selectedYears, selectedRanges]);

  const favoritesTotalPages = Math.max(1, Math.ceil(filteredFavorites.length / SPONSORSHIP_PAGE_SIZE));
  const safeFavoritesPage = Math.min(currentPage, favoritesTotalPages);
  const paginatedFavorites = showFavoritesOnly
    ? filteredFavorites.slice(
        (safeFavoritesPage - 1) * SPONSORSHIP_PAGE_SIZE,
        safeFavoritesPage * SPONSORSHIP_PAGE_SIZE
      )
    : [];

  const displayCompanies = showFavoritesOnly ? paginatedFavorites : (pageData?.companies ?? []);
  const displayTotalCount = showFavoritesOnly ? filteredFavorites.length : (pageData?.totalCount ?? 0);
  const displayTotalPages = showFavoritesOnly ? favoritesTotalPages : (pageData?.totalPages ?? 1);
  const displayLoading = showFavoritesOnly ? false : isLoading;
  const displayInitialDone = showFavoritesOnly ? true : initialFetchDone;

  const retryLoad = useCallback(() => setReloadNonce((n) => n + 1), []);

  const toggleYear = useCallback((year: string) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  }, []);

  const toggleRange = useCallback((rangeId: string) => {
    setSelectedRanges((prev) =>
      prev.includes(rangeId) ? prev.filter((r) => r !== rangeId) : [...prev, rangeId]
    );
  }, []);

  const hasActiveFilters =
    selectedYears.length > 0 ||
    selectedRanges.length > 0 ||
    searchQuery.length > 0 ||
    showFavoritesOnly;

  const clearFilters = useCallback(() => {
    setSelectedYears([]);
    setSelectedRanges([]);
    setSearchQuery("");
    setShowFavoritesOnly(false);
    setCurrentPage(1);
  }, []);

  return (
    <div className="bg-white flex-1 flex flex-col h-full overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 pt-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 pb-4">
          Ireland Employment Permits
        </h1>
      </div>

      <SponsorshipHubShell
        tourId="sponsorship-hub"
        searchPlaceholder="Search for a company by name..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchMaxLength={SPONSORSHIP_SEARCH_MAX_LENGTH}
        disclaimer={
          <OfficialDirectoryDisclaimer>
            This directory lists employers from the official Irish Department of Enterprise,
            Trade and Employment employment permits register (2020–2026). Cafy does not
            modify or endorse individual employers.
          </OfficialDirectoryDisclaimer>
        }
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        customFilterSidebar={
          <IrelandFilterSidebar
            yearOptions={pageData?.stats.yearCounts ?? []}
            selectedYears={selectedYears}
            onToggleYear={toggleYear}
            rangeOptions={pageData?.stats.permitRangeCounts ?? []}
            selectedRanges={selectedRanges}
            onToggleRange={toggleRange}
            volumeScopedToYears={Boolean(pageData?.stats.volumeScopedToYears)}
          />
        }
        showFavoritesOnly={showFavoritesOnly}
        onShowFavoritesOnlyChange={(value) => {
          setShowFavoritesOnly(value);
          setCurrentPage(1);
        }}
        favoritesCount={favoriteCount}
        favoritesSyncHint={favoritesSyncHint}
        resultsLabel={showFavoritesOnly ? "saved favourites" : "employers found"}
        resultsCount={displayTotalCount}
        resultsMeta={
          displayInitialDone
            ? showFavoritesOnly
              ? favoritesSyncHint
              : `${(pageData?.stats.total ?? 0).toLocaleString()} employers · ${(pageData?.stats.totalPermitsIssued ?? 0).toLocaleString()} permits (2020–2026)`
            : undefined
        }
        isLoading={displayLoading}
        initialFetchDone={displayInitialDone}
        loadError={showFavoritesOnly ? null : loadError}
        onRetry={retryLoad}
        currentPage={showFavoritesOnly ? safeFavoritesPage : currentPage}
        totalPages={displayTotalPages}
        totalCount={displayTotalCount}
        pageSize={SPONSORSHIP_PAGE_SIZE}
        onPageChange={setCurrentPage}
        windowWidth={width}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
      >
        {displayLoading
          ? Array.from({ length: SPONSORSHIP_PAGE_SIZE }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse h-80"
              />
            ))
          : displayCompanies.map((company, index) => (
              <IrelandSponsorCompanyCard
                key={employerKey(company)}
                company={company}
                index={index}
                isFavorite={favorites.has(employerKey(company))}
                onToggleFavorite={() =>
                  toggleFavorite(employerKey(company), company.employerName, company)
                }
                onShare={() =>
                  shareItem(
                    company.employerName,
                    `${company.employerName}: ${company.totalPermits} employment permits issued (2020–2026, official Irish register)`
                  )
                }
                onViewProfile={() => setSelectedCompany(company)}
              />
            ))}
      </SponsorshipHubShell>

      <ActionToast message={actionMessage} />

      <AnimatePresence>
        {selectedCompany && (
          <CompanyDetailModal company={selectedCompany} onClose={() => setSelectedCompany(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

const CompanyDetailModal: React.FC<{
  company: IrelandEmployerResult;
  onClose: () => void;
}> = ({ company, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalScrollLock(panelRef);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/50"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <motion.div
        ref={panelRef}
        initial={{ scale: 0.95, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 40 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ireland-employer-modal-title"
        className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-start justify-between gap-3 z-10">
          <div className="flex items-start gap-3 min-w-0">
            <SponsorCompanyLogo companyName={company.employerName} size={48} />
            <div className="min-w-0">
              <h2
                id="ireland-employer-modal-title"
                className="text-lg font-bold text-slate-900 break-words"
              >
                {company.employerName}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin size={13} className="text-blue-500" />
                {company.city ?? "Ireland"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">
              Total Permits (2020–2026)
            </p>
            <p className="text-4xl font-extrabold text-blue-700">
              {company.totalPermits.toLocaleString()}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FileBadge2 size={16} className="text-blue-600" />
              Permit History by Year
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PERMIT_YEARS.map((year) => (
                <div key={year} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{year}</p>
                  <p className="text-xl font-bold text-slate-900">
                    {(company.permitsByYear?.[year] ?? 0).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {(company.permitsByYear?.["2026"] ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <FileBadge2 size={16} className="text-blue-600" />
                2026 Monthly Breakdown
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MONTH_LABELS.map(({ key, label }) => (
                  <div key={key} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</p>
                    <p className="text-xl font-bold text-slate-900">{company[key].toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <OfficialDirectoryDisclaimer>
            Sourced from the official Irish employment permits register (2020–2026). Permit counts
            reflect government-published data only.
          </OfficialDirectoryDisclaimer>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SponsorshipHubIreland;
