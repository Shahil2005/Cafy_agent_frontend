import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { PART_TIME_UK_CITIES, officialPartTimeCity } from '../../../data/partTimeUkCities';

/** Location dropdown — same look as the logged-in part-time page. `null` = all UK. */
export default function PublicCityMenu({
  city,
  onChange,
  disabled = false,
  locked = false,
}: {
  city: string | null;
  onChange: (city: string | null) => void;
  disabled?: boolean;
  /** Logged-out preview: choosing a city opens the sign-up popup instead of filtering. */
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (next: string | null) => {
    setOpen(false);
    if (next === null) {
      onChange(null);
      return;
    }
    const official = officialPartTimeCity(next);
    if (official) onChange(official);
  };

  const optionClass = (selected: boolean) =>
    `w-full px-3 py-2 text-left text-sm ${
      selected ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700 hover:bg-slate-50'
    }`;

  return (
    <div ref={menuRef} className="relative w-full lg:w-72">
      <button
        type="button"
        className="flex h-11 w-full items-center gap-3 border-2 border-slate-800 bg-white px-3 text-left disabled:opacity-60"
        aria-label="Filter part-time jobs by location"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Location</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{city || 'All locations'}</span>
        {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden /> : null}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-700" aria-hidden />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="Locations"
          className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto border border-slate-200 bg-white py-1 shadow-lg"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={city === null}
              className={optionClass(city === null)}
              onClick={() => choose(null)}
            >
              All locations
            </button>
          </li>
          {PART_TIME_UK_CITIES.map((name) => (
            <li key={name}>
              <button
                type="button"
                role="option"
                aria-selected={city === name}
                className={optionClass(city === name)}
                onClick={() => choose(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
