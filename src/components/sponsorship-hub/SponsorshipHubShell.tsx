import React, { useMemo } from "react";
import {
    Search,
    X,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    RefreshCw,
    SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FavoritesFilterToggle from "./FavoritesFilterToggle";

export interface CityFilterOption {
    city: string;
    count: number;
}

interface SponsorshipHubShellProps {
    tourId?: string;
    searchPlaceholder: string;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    searchMaxLength: number;
    disclaimer?: React.ReactNode;
    /** When set, replaces the default location filter sidebar. */
    customFilterSidebar?: React.ReactNode;
    hasActiveFilters?: boolean;
    onClearFilters?: () => void;
    cityFilterOptions?: CityFilterOption[];
    selectedCities?: string[];
    onToggleCity?: (city: string) => void;
    cityFilterSearch?: string;
    onCityFilterSearchChange?: (value: string) => void;
    resultsLabel: string;
    resultsCount: number | null;
    resultsMeta?: string;
    isLoading: boolean;
    initialFetchDone: boolean;
    loadError: string | null;
    onRetry: () => void;
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    windowWidth: number;
    sidebarOpen: boolean;
    onSidebarOpenChange: (open: boolean) => void;
    showFavoritesOnly?: boolean;
    onShowFavoritesOnlyChange?: (value: boolean) => void;
    favoritesCount?: number;
    favoritesSyncHint?: string;
    children: React.ReactNode;
}

function getPaginationRange(current: number, total: number, isMobile: boolean) {
    const totalSlots = isMobile ? 5 : 11;
    if (total <= totalSlots) return Array.from({ length: total }, (_, i) => i + 1);
    if (isMobile) {
        if (current <= 2) return [1, 2, 3, "...", total];
        if (current >= total - 1) return [1, "...", total - 2, total - 1, total];
        return [1, "...", current, "...", total];
    }
    if (current <= 7) return [1, 2, 3, 4, 5, 6, 7, 8, 9, "...", total];
    if (current >= total - 6) return [1, "...", ...Array.from({ length: 9 }, (_, i) => total - 8 + i)];
    return [1, "...", current - 2, current - 1, current, current + 1, current + 2, "...", total];
}

const SponsorshipHubShell: React.FC<SponsorshipHubShellProps> = ({
    tourId,
    searchPlaceholder,
    searchQuery,
    onSearchChange,
    searchMaxLength,
    disclaimer,
    customFilterSidebar,
    hasActiveFilters: hasActiveFiltersProp,
    onClearFilters,
    cityFilterOptions = [],
    selectedCities = [],
    onToggleCity,
    cityFilterSearch = "",
    onCityFilterSearchChange,
    resultsLabel,
    resultsCount,
    resultsMeta,
    isLoading,
    initialFetchDone,
    loadError,
    onRetry,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    onPageChange,
    windowWidth,
    sidebarOpen,
    onSidebarOpenChange,
    showFavoritesOnly = false,
    onShowFavoritesOnlyChange,
    favoritesCount = 0,
    favoritesSyncHint,
    children,
}) => {
    const isMobile = windowWidth < 1024;
    const isNarrow = windowWidth < 640;
    const hasActiveFilters =
        hasActiveFiltersProp ??
        (selectedCities.length > 0 || searchQuery.length > 0 || showFavoritesOnly);
    const showSidebar = Boolean(customFilterSidebar) || cityFilterOptions.length > 0;

    const filteredCityOptions = useMemo(() => {
        const q = cityFilterSearch.trim().toLowerCase();
        if (!q) return cityFilterOptions;
        return cityFilterOptions.filter((c) => c.city.toLowerCase().includes(q));
    }, [cityFilterOptions, cityFilterSearch]);

    const favoritesBlock =
        onShowFavoritesOnlyChange != null ? (
            <FavoritesFilterToggle
                checked={showFavoritesOnly}
                count={favoritesCount}
                onChange={onShowFavoritesOnlyChange}
                syncHint={favoritesSyncHint}
            />
        ) : null;

    const locationFilters = (
        <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">Location</h3>
            <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                    type="text"
                    value={cityFilterSearch}
                    onChange={(e) => onCityFilterSearchChange?.(e.target.value)}
                    placeholder="Search city..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1 scrollbar-hide">
                {filteredCityOptions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">No cities match</p>
                ) : (
                    filteredCityOptions.map(({ city, count }) => (
                        <label
                            key={city}
                            className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-blue-50/50 cursor-pointer group"
                        >
                            <span className="flex items-center gap-2.5 min-w-0">
                                <input
                                    type="checkbox"
                                    checked={selectedCities.includes(city)}
                                    onChange={() => onToggleCity?.(city)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 truncate">{city}</span>
                            </span>
                            <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-600">
                                {count.toLocaleString()}
                            </span>
                        </label>
                    ))
                )}
            </div>
        </div>
    );

    const filtersHeader = (
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Filters</h2>
            {hasActiveFilters && onClearFilters && (
                <button
                    type="button"
                    onClick={onClearFilters}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                    Clear all
                </button>
            )}
        </div>
    );

    const sidebarTop = (
        <div className="space-y-5">
            {filtersHeader}
            {favoritesBlock}
        </div>
    );

    const sidebarScrollable = customFilterSidebar ?? locationFilters;

    const showSidebarPanel =
        showSidebar || favoritesBlock != null || Boolean(customFilterSidebar);

    return (
        <div className="bg-white flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex flex-1 min-h-0">
                {showSidebarPanel && !isMobile && (
                    <aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0">
                        <div className="shrink-0 p-6 pb-4">{sidebarTop}</div>
                        {sidebarScrollable && (
                            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-0 scrollbar-hide border-t border-slate-100">
                                <div className="pt-5">{sidebarScrollable}</div>
                            </div>
                        )}
                    </aside>
                )}

                <main className="flex-1 overflow-y-auto scrollbar-hide bg-slate-50/50">
                    <div className="px-6 py-6 w-full">
                        {isMobile && showSidebarPanel && (
                            <button
                                type="button"
                                onClick={() => onSidebarOpenChange(true)}
                                className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm"
                            >
                                <SlidersHorizontal size={16} />
                                Filters
                                {hasActiveFilters && (
                                    <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                                        •
                                    </span>
                                )}
                            </button>
                        )}

                        {disclaimer}

                        <div data-tour={tourId} className="mb-6">
                            <div className="relative">
                                <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) =>
                                        onSearchChange(e.target.value.slice(0, searchMaxLength))
                                    }
                                    maxLength={searchMaxLength}
                                    placeholder={searchPlaceholder}
                                    className="w-full bg-white border border-slate-200 text-slate-900 pl-12 pr-4 py-3 rounded-xl shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-5">
                            <p className="text-sm text-slate-600">
                                {isLoading && !initialFetchDone ? (
                                    <span className="inline-block h-4 w-32 bg-slate-200 rounded animate-pulse" />
                                ) : (
                                    <>
                                        <span className="font-bold text-slate-900">
                                            {(resultsCount ?? 0).toLocaleString()}
                                        </span>{" "}
                                        {resultsLabel}
                                    </>
                                )}
                            </p>
                            {resultsMeta && !isLoading && initialFetchDone && (
                                <p className="text-xs text-slate-400">{resultsMeta}</p>
                            )}
                        </div>

                        {loadError && !isLoading && (
                            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-red-900">Could not load register</p>
                                        <p className="text-sm text-red-700 mt-0.5">{loadError}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={onRetry}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-red-200 text-sm font-semibold text-red-800 hover:bg-red-100"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Try again
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{children}</div>

                        {!isLoading && !loadError && totalPages > 1 && (
                            <div className="mt-10 flex flex-col items-center gap-3">
                                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                                    <button
                                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 hover:bg-slate-50 disabled:opacity-30 rounded-xl text-slate-600"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    {getPaginationRange(currentPage, totalPages, isNarrow).map((page, i) =>
                                        page === "..." ? (
                                            <span
                                                key={i}
                                                className="w-9 h-9 flex items-center justify-center text-slate-400"
                                            >
                                                ...
                                            </span>
                                        ) : (
                                            <button
                                                key={i}
                                                onClick={() => onPageChange(Number(page))}
                                                className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold ${
                                                    currentPage === page
                                                        ? "bg-blue-600 text-white"
                                                        : "text-slate-600 hover:bg-slate-50"
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        )
                                    )}
                                    <button
                                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 hover:bg-slate-50 disabled:opacity-30 rounded-xl text-slate-600"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                    {(currentPage - 1) * pageSize + 1}–
                                    {Math.min(currentPage * pageSize, totalCount)} of{" "}
                                    {totalCount.toLocaleString()}
                                </p>
                            </div>
                        )}

                        {!isLoading && !loadError && totalCount === 0 && (
                            <div className="text-center py-16 col-span-full">
                                <p className="text-slate-500 font-medium">
                                    {showFavoritesOnly
                                        ? "No favourites saved yet. Tap the heart on a card to save it here"
                                        : "No results match your filters"}
                                </p>
                                {onClearFilters && (
                                    <button
                                        type="button"
                                        onClick={onClearFilters}
                                        className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                        Clear all filters
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <AnimatePresence>
                {isMobile && showSidebarPanel && sidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 z-[9998]"
                            onClick={() => onSidebarOpenChange(false)}
                        />
                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 28, stiffness: 320 }}
                            className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-white z-[9999] p-6 overflow-y-auto shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold">Filters</h2>
                                <button
                                    type="button"
                                    onClick={() => onSidebarOpenChange(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            {sidebarTop}
                            {sidebarScrollable && (
                                <div className="pt-5 mt-5 border-t border-slate-100">{sidebarScrollable}</div>
                            )}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SponsorshipHubShell;
