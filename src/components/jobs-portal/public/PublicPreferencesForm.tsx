import { useEffect, useState } from 'react';
import {
  ALLOWED_JOB_TYPES,
  ALLOWED_SECTORS,
  JOB_CATALOG_LEVELS,
} from '../../../data/jobPortalConstants';
import { PreferenceCheck, PreferenceToggle } from '../JobsPreferencesModal';
import {
  isCompleteAnonPreferences,
  PUBLIC_PREF_LIMITS,
  type AnonJobPreferences,
  type PublicCatalogCountry,
} from './publicJobsStorage';

const COUNTRY_OPTIONS: Array<{ id: PublicCatalogCountry; label: string }> = [
  { id: 'uk', label: 'United Kingdom' },
  { id: 'ireland', label: 'Ireland' },
];

function toggleInList(list: string[], value: string, max: number): string[] {
  if (list.includes(value)) return list.filter((v) => v !== value);
  return list.length >= max ? list : [...list, value];
}

/**
 * Country / sectors / level / job type picker. Rendered inside the "change"
 * modal and as the full-page first step on /explore-jobs.
 */
export default function PublicPreferencesForm({
  initial,
  submitLabel = 'Show my jobs',
  onSubmit,
  onCancel,
}: {
  initial: AnonJobPreferences | null;
  submitLabel?: string;
  onSubmit: (prefs: AnonJobPreferences) => void;
  onCancel?: () => void;
}) {
  // No default country — the visitor must choose, like the other three questions.
  const [country, setCountry] = useState<PublicCatalogCountry | null>(initial?.country ?? null);
  const [sectors, setSectors] = useState<string[]>(initial?.sectors ?? []);
  const [experienceLevel, setExperienceLevel] = useState<string[]>(initial?.experienceLevel ?? []);
  const [jobTypes, setJobTypes] = useState<string[]>(initial?.jobTypes ?? []);

  useEffect(() => {
    setCountry(initial?.country ?? null);
    setSectors(initial?.sectors ?? []);
    setExperienceLevel(initial?.experienceLevel ?? []);
    setJobTypes(initial?.jobTypes ?? []);
  }, [initial]);

  const draft: AnonJobPreferences | null = country
    ? { country, sectors, experienceLevel, jobTypes }
    : null;
  const complete = isCompleteAnonPreferences(draft);
  const hasSelection =
    country !== null || sectors.length > 0 || experienceLevel.length > 0 || jobTypes.length > 0;

  const clearAll = () => {
    setCountry(null);
    setSectors([]);
    setExperienceLevel([]);
    setJobTypes([]);
  };
  const sectorLimitReached = sectors.length >= PUBLIC_PREF_LIMITS.sectors;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Which country?</h3>
          <div className="flex flex-wrap gap-2">
            {COUNTRY_OPTIONS.map((option) => (
              <PreferenceToggle
                key={option.id}
                label={option.label}
                selected={country === option.id}
                onClick={() => setCountry(option.id)}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Which sectors?</h3>
            <span className="text-[11px] tabular-nums text-slate-400">
              {sectors.length}/{PUBLIC_PREF_LIMITS.sectors} selected
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            {ALLOWED_SECTORS.map((sector) => {
              const selected = sectors.includes(sector);
              return (
                <div key={sector} className={!selected && sectorLimitReached ? 'opacity-40' : undefined}>
                  <PreferenceCheck
                    label={sector}
                    selected={selected}
                    onClick={() => setSectors((prev) => toggleInList(prev, sector, PUBLIC_PREF_LIMITS.sectors))}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Experience level?</h3>
          <div className="flex flex-wrap gap-2">
            {JOB_CATALOG_LEVELS.map((level) => (
              <PreferenceToggle
                key={level}
                label={level}
                selected={experienceLevel.includes(level)}
                onClick={() =>
                  setExperienceLevel((prev) => toggleInList(prev, level, PUBLIC_PREF_LIMITS.experienceLevel))
                }
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Job type?</h3>
          <div className="flex flex-wrap gap-2">
            {ALLOWED_JOB_TYPES.map((type) => (
              <PreferenceToggle
                key={type}
                label={type}
                selected={jobTypes.includes(type)}
                onClick={() => setJobTypes((prev) => toggleInList(prev, type, PUBLIC_PREF_LIMITS.jobTypes))}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t border-slate-200 px-5 py-4">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={clearAll}
            disabled={!hasSelection}
            className="text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
          >
            Clear all
          </button>
        </div>
        {!complete ? (
          <p className="mb-3 text-center text-xs text-slate-500">
            Choose a country and at least one sector, experience level and job type.
          </p>
        ) : null}
        <div className="flex gap-2.5">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            disabled={!complete}
            onClick={() => draft && complete && onSubmit(draft)}
            className="flex-[1.2] bg-cafy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cafy-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
