import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { ALLOWED_SECTORS, ALLOWED_JOB_TYPES, JOB_CATALOG_LEVELS } from '../../data/jobPortalConstants';
import type { UserPreferences } from '../../types';
import {
    getJobsBrowsePreferences,
    isValidJobsBrowseSelection,
    saveJobsBrowsePreferences,
} from '../../services/userPreferencesService';

interface JobsPreferencesModalProps {
    open: boolean;
    /** When true, user must save valid sector + level + job type selections before dismissing. */
    required?: boolean;
    onClose: () => void;
    onSaved: (preferences?: UserPreferences) => void;
}

function toggleInList(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function PreferenceCheck({
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
            className="flex w-full items-center gap-2.5 px-1 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
            <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                    selected
                        ? 'border-cafy-600 bg-cafy-600'
                        : 'border-slate-300 bg-white'
                }`}
                aria-hidden
            >
                {selected ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
            </span>
            <span className={selected ? 'font-medium text-slate-900' : undefined}>{label}</span>
        </button>
    );
}

export function PreferenceToggle({
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
            className={`border px-3 py-1.5 text-xs font-medium ${
                selected
                    ? 'border-cafy-800 bg-cafy-800 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
        >
            {label}
        </button>
    );
}

export default function JobsPreferencesModal({
    open,
    required = false,
    onClose,
    onSaved,
}: JobsPreferencesModalProps) {
    const [sectors, setSectors] = useState<string[]>([]);
    const [experienceLevels, setExperienceLevels] = useState<string[]>([]);
    const [jobTypes, setJobTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    const canDismiss = !required && !saving;
    const isValidSelection = isValidJobsBrowseSelection({ sectors, experienceLevels, jobTypes });

    const attemptDismiss = useCallback(() => {
        if (canDismiss) onClose();
    }, [canDismiss, onClose]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        setError(null);
        setValidationError(null);
        setLoading(true);

        getJobsBrowsePreferences()
            .then((prefs) => {
                if (cancelled) return;
                setSectors(prefs.sectors);
                setExperienceLevels(prefs.experienceLevels);
                setJobTypes(prefs.jobTypes);
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load your preferences.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open || !canDismiss) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                attemptDismiss();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, canDismiss, attemptDismiss]);

    const handleSave = async () => {
        if (!isValidSelection) {
            setValidationError(
                'Select at least one sector, experience level, and job type to continue.'
            );
            return;
        }

        setSaving(true);
        setError(null);
        setValidationError(null);
        try {
            const result = await saveJobsBrowsePreferences({
                sectors,
                experienceLevels,
                jobTypes,
            });
            if (!result.success) {
                setError(result.error ?? 'Failed to save preferences.');
                return;
            }
            onSaved(result.preferences);
        } catch {
            setError('Failed to save preferences. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const title = required ? 'Set your job preferences' : 'Edit preferences';
    const subtitle = required
        ? 'Choose sectors, experience levels, and job types. Best matches show first; more jobs follow so you can keep browsing.'
        : 'Best matches show first. Job type filters the feed; sector and level rank the order.';

    return (
        <AnimatePresence>
            {open && (
                <div
                    className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="jobs-preferences-modal-title"
                    onClick={canDismiss ? attemptDismiss : undefined}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="flex max-h-[min(92vh,720px)] w-full flex-col overflow-hidden border border-slate-200 bg-white sm:max-w-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="shrink-0 bg-[#f6f1e4] px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h2
                                        id="jobs-preferences-modal-title"
                                        className="text-[15px] font-semibold text-slate-900"
                                    >
                                        {title}
                                    </h2>
                                    <p className="mt-1 text-sm leading-snug text-slate-600">{subtitle}</p>
                                </div>
                                {canDismiss && (
                                    <button
                                        type="button"
                                        onClick={attemptDismiss}
                                        className="shrink-0 p-1 text-slate-500 hover:text-slate-800"
                                        aria-label="Close"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
                            {loading ? (
                                <div className="animate-pulse space-y-6" aria-hidden>
                                    <div className="space-y-2">
                                        <div className="h-4 w-20 bg-slate-200" />
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <div key={i} className="flex items-center gap-2.5 py-1.5">
                                                    <div className="h-4 w-4 border border-slate-200 bg-slate-100" />
                                                    <div className="h-3 flex-1 bg-slate-100" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-4 w-32 bg-slate-200" />
                                        <div className="flex flex-wrap gap-2">
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="h-7 w-20 border border-slate-200 bg-slate-50" />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <section>
                                        <div className="mb-2 flex items-baseline justify-between gap-3">
                                            <h3 className="text-sm font-semibold text-slate-900">Sectors</h3>
                                            <span className="text-[11px] tabular-nums text-slate-400">
                                                {sectors.length} selected
                                            </span>
                                        </div>
                                        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                                            Used to rank browse results by the sector shown on each job card.
                                            Search stays keyword-only.
                                        </p>
                                        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                                            {ALLOWED_SECTORS.map((sector) => (
                                                <PreferenceCheck
                                                    key={sector}
                                                    label={sector}
                                                    selected={sectors.includes(sector)}
                                                    onClick={() => {
                                                        setValidationError(null);
                                                        setSectors((prev) => toggleInList(prev, sector));
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </section>

                                    <section>
                                        <div className="mb-2 flex items-baseline justify-between gap-3">
                                            <h3 className="text-sm font-semibold text-slate-900">
                                                Experience level
                                            </h3>
                                            <span className="text-[11px] tabular-nums text-slate-400">
                                                {experienceLevels.length} selected
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {JOB_CATALOG_LEVELS.map((level) => (
                                                <PreferenceToggle
                                                    key={level}
                                                    label={level}
                                                    selected={experienceLevels.includes(level)}
                                                    onClick={() => {
                                                        setValidationError(null);
                                                        setExperienceLevels((prev) =>
                                                            toggleInList(prev, level)
                                                        );
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </section>

                                    <section>
                                        <div className="mb-2 flex items-baseline justify-between gap-3">
                                            <h3 className="text-sm font-semibold text-slate-900">Job type</h3>
                                            <span className="text-[11px] tabular-nums text-slate-400">
                                                {jobTypes.length} selected
                                            </span>
                                        </div>
                                        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                                            Only jobs with these employment types are shown while browsing.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {ALLOWED_JOB_TYPES.map((type) => (
                                                <PreferenceToggle
                                                    key={type}
                                                    label={type}
                                                    selected={jobTypes.includes(type)}
                                                    onClick={() => {
                                                        setValidationError(null);
                                                        setJobTypes((prev) => toggleInList(prev, type));
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </section>

                                    {validationError && (
                                        <p
                                            className="px-2 text-center text-xs font-medium text-amber-700"
                                            role="status"
                                        >
                                            {validationError}
                                        </p>
                                    )}
                                </div>
                            )}

                            {error && (
                                <p
                                    className="mt-4 px-2 text-center text-sm font-medium text-red-600"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}
                        </div>

                        <div className="flex shrink-0 gap-2.5 border-t border-slate-200 px-5 py-4">
                            {canDismiss && (
                                <button
                                    type="button"
                                    onClick={attemptDismiss}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={loading || saving || !isValidSelection}
                                className={`${canDismiss ? 'flex-[1.2]' : 'flex-1'} relative overflow-hidden bg-cafy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cafy-700 disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                                {saving ? 'Saving' : required ? 'Continue' : 'Save'}
                                {saving ? (
                                    <span className="cafy-indeterminate-bar cafy-indeterminate-bar-on-blue absolute inset-x-0 bottom-0" />
                                ) : null}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
