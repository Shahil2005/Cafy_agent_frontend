import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import type { CounsellingSlot } from '../../services/counsellingService';
import {
  dateKeyFromDate,
  dateKeyToUtcDate,
  formatDateKeyLabel,
  formatSlotTime,
  isDateInRange,
  sortedDateKeys,
  startOfDay,
} from './bookingCalendarUtils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type Props = {
  slotsByDate: Map<string, CounsellingSlot[]>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
  selectedSlot: CounsellingSlot | null;
  onSelectSlot: (slot: CounsellingSlot) => void;
  timeZone: string;
  loading?: boolean;
  reserving?: boolean;
  minDateKey: string;
  maxDateKey: string;
};

function mondayBasedStartOffset(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export const BookingCalendarPicker: React.FC<Props> = ({
  slotsByDate,
  selectedDate,
  onSelectDate,
  selectedSlot,
  onSelectSlot,
  timeZone,
  loading = false,
  reserving = false,
  minDateKey,
  maxDateKey,
}) => {
  const availableKeys = useMemo(() => sortedDateKeys(slotsByDate), [slotsByDate]);

  const initialMonth = useMemo(() => {
    if (selectedDate) return dateKeyToUtcDate(selectedDate);
    if (availableKeys.length) return dateKeyToUtcDate(availableKeys[0]);
    return startOfDay(new Date());
  }, [selectedDate, availableKeys]);

  const [viewMonth, setViewMonth] = useState(initialMonth);

  useEffect(() => {
    if (!selectedDate && availableKeys.length) {
      onSelectDate(availableKeys[0]);
    }
  }, [availableKeys, selectedDate, onSelectDate]);

  useEffect(() => {
    if (selectedDate) {
      setViewMonth(dateKeyToUtcDate(selectedDate));
    } else if (availableKeys.length) {
      setViewMonth(dateKeyToUtcDate(availableKeys[0]));
    }
  }, [selectedDate, availableKeys]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = mondayBasedStartOffset(year, month);

  const minMonth = dateKeyToUtcDate(minDateKey);
  const maxMonth = dateKeyToUtcDate(maxDateKey);
  const canPrev = viewMonth > new Date(minMonth.getFullYear(), minMonth.getMonth(), 1);
  const canNext = viewMonth < new Date(maxMonth.getFullYear(), maxMonth.getMonth(), 1);

  const slotsForSelected = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];

  const gridCells: Array<{ day: number; dateKey: string } | null> = [];
  for (let i = 0; i < offset; i++) gridCells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = dateKeyFromDate(new Date(year, month, day));
    gridCells.push({ day, dateKey });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Loading available dates…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:gap-6">
      <div className="lg:w-[min(100%,320px)] shrink-0">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="p-2 rounded-xl hover:bg-white text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h4 className="text-sm font-bold text-slate-900 tabular-nums">
              {MONTHS[month]} {year}
            </h4>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              className="p-2 rounded-xl hover:bg-white text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1" role="row">
            {WEEKDAYS.map((label) => (
              <div
                key={label}
                className="text-[10px] font-bold uppercase tracking-wide text-slate-400 text-center py-1"
                role="columnheader"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Choose a date">
            {gridCells.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} role="gridcell" aria-hidden />;
              }

              const { day, dateKey } = cell;
              const inWindow = isDateInRange(dateKey, minDateKey, maxDateKey);
              const hasSlots = slotsByDate.has(dateKey);
              const isSelected = selectedDate === dateKey;
              const isToday = dateKey === dateKeyFromDate(new Date());
              const disabled = !inWindow || !hasSlots;

              return (
                <button
                  key={dateKey}
                  type="button"
                  role="gridcell"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  aria-label={
                    hasSlots
                      ? `${day} ${MONTHS[month]}, ${slotsByDate.get(dateKey)?.length ?? 0} slots`
                      : `${day} ${MONTHS[month]}, unavailable`
                  }
                  onClick={() => onSelectDate(dateKey)}
                  className={`
                    relative h-9 w-full flex flex-col items-center justify-center rounded-xl text-sm font-semibold transition-all
                    ${isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-[1.02]' : ''}
                    ${!isSelected && !disabled ? 'text-slate-800 hover:bg-blue-50 hover:text-blue-700' : ''}
                    ${disabled ? 'text-slate-300 cursor-not-allowed' : ''}
                    ${isToday && !isSelected && !disabled ? 'ring-1 ring-blue-300 ring-inset' : ''}
                  `}
                >
                  {day}
                  {hasSlots && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-slate-500 text-center leading-relaxed">
            Dates with a dot have availability · Times in{' '}
            <span className="font-medium text-slate-600">{timeZone.replace(/_/g, ' ')}</span>
            <span className="block mt-1 text-slate-400">
              Slots can be held briefly while someone else checks out.
            </span>
          </p>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {selectedDate ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 h-full flex flex-col">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Available times</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{formatDateKeyLabel(selectedDate)}</p>
            </div>

            {reserving ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-slate-500 py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Holding your slot…</span>
              </div>
            ) : slotsForSelected.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center leading-relaxed">
                No times left on this date. Another user may be completing a booking. Try another day
                or refresh the list.
              </p>
            ) : (
              <div
                className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 lg:max-h-72 overflow-y-auto pr-0.5 custom-scrollbar"
                role="listbox"
                aria-label="Available times"
              >
                {slotsForSelected.map((slot) => {
                  const isActive = selectedSlot?.startsAt === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      disabled={reserving}
                      onClick={() => onSelectSlot(slot)}
                      className={`
                        flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all
                        ${isActive ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 text-slate-800 hover:border-blue-400 hover:bg-blue-50/60'}
                        disabled:opacity-50
                      `}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      {formatSlotTime(slot.startsAt, timeZone)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
            Select a highlighted date to see available times.
          </div>
        )}
      </div>
    </div>
  );
};
