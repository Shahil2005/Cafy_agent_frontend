import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Check, Briefcase, Layers, MapPin, Crown, Lock, ChevronDown, Search,
} from 'lucide-react';
import {
    ALLOWED_SECTORS,
    JOB_CATALOG_LEVELS,
    jobFilterCitiesForCatalog,
} from '../../data/jobPortalConstants';

export interface JobsHardFilters {
    sectors: string[];
    /** Same catalog levels as onboarding / profile preferences */
    levels: string[];
    cities: string[];
}

export const EMPTY_JOBS_HARD_FILTERS: JobsHardFilters = {
    sectors: [],
    levels: [],
    cities: [],
};

export function hasActiveJobsHardFilters(filters: JobsHardFilters): boolean {
    return (
        filters.sectors.length > 0 ||
        filters.levels.length > 0 ||
        filters.cities.length > 0
    );
}

export function countActiveJobsHardFilters(filters: JobsHardFilters): number {
    return filters.sectors.length + filters.levels.length + filters.cities.length;
}

function toggleInList(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function SelectionChip({
    label,
    selected,
    onClick,
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                selected
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
        >
            {selected && <Check className="w-3 h-3 shrink-0" strokeWidth={2.5} aria-hidden />}
            <span className="truncate">{label}</span>
        </button>
    );
}

function SectionBlock({
    icon: Icon,
    title,
    count,
    children,
}: {
    icon: typeof Briefcase;
    title: string;
    count: number;
    children: ReactNode;
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
                    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-400 shrink-0">
                    {count} selected
                </span>
            </div>
            <div className="p-4">{children}</div>
        </section>
    );
}

function CityDropdown({
    cities,
    selected,
    onChange,
    catalogLabel,
}: {
    cities: readonly string[];
    selected: string[];
    onChange: (next: string[]) => void;
    catalogLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return cities;
        return cities.filter((c) => c.toLowerCase().includes(q));
    }, [cities, query]);

    const summary =
        selected.length === 0
            ? `Select ${catalogLabel} cities`
            : selected.length <= 2
              ? selected.join(', ')
              : `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`;

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="listbox"
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border-2 border-slate-200 bg-white text-sm text-left hover:border-slate-300 focus:outline-none focus:border-blue-600"
            >
                <span className={selected.length ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                    {summary}
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden
                />
            </button>

            {open && (
                <div
                    role="listbox"
                    aria-multiselectable="true"
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                >
                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search cities…"
                                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-600"
                                aria-label="Search cities"
                            />
                        </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-slate-400">No cities match</p>
                        ) : (
                            filtered.map((city) => {
                                const checked = selected.includes(city);
                                return (
                                    <button
                                        key={city}
                                        type="button"
                                        role="option"
                                        aria-selected={checked}
                                        onClick={() => onChange(toggleInList(selected, city))}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-blue-50/60"
                                    >
                                        <span
                                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                checked
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'border-slate-300 bg-white'
                                            }`}
                                        >
                                            {checked && <Check className="w-3 h-3" strokeWidth={3} aria-hidden />}
                                        </span>
                                        <span className="text-slate-700">{city}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                    {selected.length > 0 && (
                        <div className="border-t border-slate-100 px-3 py-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                                Clear cities
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface JobsFiltersPanelProps {
    open: boolean;
    catalogCountry: 'uk' | 'ireland';
    initialFilters: JobsHardFilters;
    onClose: () => void;
    onApply: (filters: JobsHardFilters) => void;
}

export default function JobsFiltersPanel({
    open,
    catalogCountry,
    initialFilters,
    onClose,
    onApply,
}: JobsFiltersPanelProps) {
    const [sectors, setSectors] = useState<string[]>(initialFilters.sectors);
    const [levels, setLevels] = useState<string[]>(initialFilters.levels);
    const [cities, setCities] = useState<string[]>(initialFilters.cities);

    const cityOptions = useMemo(
        () => jobFilterCitiesForCatalog(catalogCountry),
        [catalogCountry]
    );
    const catalogLabel = catalogCountry === 'ireland' ? 'Ireland' : 'UK';

    useEffect(() => {
        if (!open) return;
        setSectors(initialFilters.sectors);
        setLevels(initialFilters.levels);
        setCities(initialFilters.cities);
    }, [open, initialFilters]);

    // Drop cities that aren't in the current catalog list (e.g. after UK↔Ireland switch).
    useEffect(() => {
        const allowed = new Set(cityOptions);
        setCities((prev) => prev.filter((c) => allowed.has(c)));
    }, [cityOptions]);

    const draft: JobsHardFilters = {
        sectors,
        levels,
        cities,
    };

    const handleClear = () => {
        setSectors([]);
        setLevels([]);
        setCities([]);
    };

    const handleApply = () => {
        onApply({
            sectors: [...sectors],
            levels: [...levels],
            cities: [...cities],
        });
        onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.button
                        type="button"
                        aria-label="Close filters"
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="jobs-filters-title"
                        className="relative w-full sm:max-w-lg max-h-[90vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    >
                        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 shrink-0">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2
                                        id="jobs-filters-title"
                                        className="text-lg font-bold text-slate-900"
                                    >
                                        Filters
                                    </h2>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                        <Crown className="w-3 h-3" aria-hidden />
                                        Premium
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Narrow by city, sector, and level. Preferences still prioritize
                                    matches inside these filters.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            <section className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
                                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 bg-white">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
                                        <h3 className="text-sm font-semibold text-slate-900">
                                            City ({catalogLabel})
                                        </h3>
                                    </div>
                                    <span className="text-[11px] font-semibold tabular-nums text-slate-400 shrink-0">
                                        {cities.length} selected
                                    </span>
                                </div>
                                <div className="p-4">
                                    <CityDropdown
                                        cities={cityOptions}
                                        selected={cities}
                                        onChange={setCities}
                                        catalogLabel={catalogLabel}
                                    />
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        Shows jobs whose location includes any selected city.
                                    </p>
                                </div>
                            </section>

                            <SectionBlock icon={Briefcase} title="Sector" count={sectors.length}>
                                <div className="flex flex-wrap gap-2">
                                    {ALLOWED_SECTORS.map((sector) => (
                                        <SelectionChip
                                            key={sector}
                                            label={sector}
                                            selected={sectors.includes(sector)}
                                            onClick={() => setSectors((prev) => toggleInList(prev, sector))}
                                        />
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-3">
                                    Standard sectors only — legacy labels in the catalog are mapped
                                    automatically.
                                </p>
                            </SectionBlock>

                            <SectionBlock
                                icon={Layers}
                                title="Level"
                                count={levels.length}
                            >
                                <div className="flex flex-wrap gap-2">
                                    {JOB_CATALOG_LEVELS.map((level) => (
                                        <SelectionChip
                                            key={level}
                                            label={level}
                                            selected={levels.includes(level)}
                                            onClick={() =>
                                                setLevels((prev) => toggleInList(prev, level))
                                            }
                                        />
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-3">
                                    Same seniority labels as your profile preferences.
                                </p>
                            </SectionBlock>
                        </div>

                        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-t border-slate-200 bg-white">
                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={!hasActiveJobsHardFilters(draft)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={handleApply}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm"
                            >
                                Apply filters
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

interface JobsFiltersPremiumModalProps {
    open: boolean;
    onClose: () => void;
    onViewPlans: () => void;
}

export function JobsFiltersPremiumModal({
    open,
    onClose,
    onViewPlans,
}: JobsFiltersPremiumModalProps) {
    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.button
                        type="button"
                        aria-label="Close"
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="jobs-filters-premium-title"
                        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 12 }}
                    >
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                                <Lock className="w-6 h-6" aria-hidden />
                            </div>
                            <h2
                                id="jobs-filters-premium-title"
                                className="text-xl font-bold text-slate-900"
                            >
                                Filters are a Premium feature
                            </h2>
                            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                                Search and preferences are free for everyone. Upgrade to filter by
                                city, sector, and level.
                            </p>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Not now
                                </button>
                                <button
                                    type="button"
                                    onClick={onViewPlans}
                                    className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-md"
                                >
                                    View plans
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
