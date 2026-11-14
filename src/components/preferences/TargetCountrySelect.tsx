import React, { useEffect, useId, useRef, useState } from 'react';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import {
  TARGET_COUNTRIES,
  getTargetCountryById,
  type TargetCountryId,
} from '../../utils/sponsorshipHubRouting';
import CountryFlag from './CountryFlag';

interface TargetCountrySelectProps {
  value: TargetCountryId | null;
  onChange: (id: TargetCountryId) => void;
  /** Compact layout for profile edit forms */
  compact?: boolean;
}

const TargetCountrySelect: React.FC<TargetCountrySelectProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = value ? getTargetCountryById(value) : null;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative w-full ${compact ? 'max-w-md' : 'max-w-lg'}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className={`
          w-full flex items-center gap-3 border bg-white text-left transition-all
          ${compact ? 'px-3.5 py-2.5 rounded-xl text-sm' : 'px-4 py-3.5 rounded-xl text-base'}
          ${open ? 'border-slate-400 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'}
        `}
      >
        {selected ? (
          <>
            <CountryFlag
              countryId={selected.id}
              label={selected.label}
              size={compact ? 22 : 28}
            />
            <span className="flex-1 min-w-0 font-medium text-slate-900 truncate">
              {selected.label}
            </span>
          </>
        ) : (
          <span className="flex-1 min-w-0 text-slate-400 font-medium">
            Select a country
          </span>
        )}
        <TbChevronDown
          className={`h-5 w-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Target country"
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
        >
          {TARGET_COUNTRIES.map((country) => {
            const isSelected = value === country.id;
            return (
              <li key={country.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(country.id);
                    setOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                    ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'}
                  `}
                >
                  <CountryFlag countryId={country.id} label={country.label} size={28} />
                  <span className="flex-1 min-w-0 font-medium text-slate-900 text-sm">
                    {country.label}
                  </span>
                  {isSelected && <TbCheck className="h-4 w-4 text-slate-700 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TargetCountrySelect;
