import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  buttonClassName?: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'Select Date',
  required = false,
  buttonClassName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize calendar view to either the selected date or today
  const [currentDate, setCurrentDate] = useState(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Close calendar popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format selected date for display
  const getFormattedDisplayDate = () => {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get start day offset and total days in month
  const startDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const selectedMonth = String(month + 1).padStart(2, '0');
    const selectedDay = String(day).padStart(2, '0');
    const formattedDate = `${year}-${selectedMonth}-${selectedDay}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  // Helper to determine if a day is in the past or on Sunday
  const checkIsDisabled = (day: number) => {
    const date = new Date(year, month, day);
    
    // 1. Disable Sunday (0 is Sunday)
    if (date.getDay() === 0) return true;

    // 2. Disable past dates (comparing year, month, day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    return date < today;
  };

  // Build array of days to render in grid
  const daysArray = [];
  // Add empty spaces for starting day offset
  for (let i = 0; i < startDay; i++) {
    daysArray.push(null);
  }
  // Add days of the month
  for (let i = 1; i <= totalDays; i++) {
    daysArray.push(i);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Date Picker Button / Input Replacement */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName || "w-full flex items-center justify-between pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 hover:border-violet-300 focus:border-violet-500 rounded-xl text-sm font-bold text-slate-900 focus:outline-none transition-all duration-200 outline-none text-left"}
      >
        <div className="flex items-center gap-2">
          {getFormattedDisplayDate() || <span className="text-slate-400 font-semibold">{placeholder}</span>}
        </div>
        <CalendarIcon className="h-4 w-4 text-slate-400 group-hover:text-violet-600 transition-colors flex-shrink-0" />
      </button>

      {/* Required field helper input for form validation */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            bottom: 0,
            left: '50%',
            width: 0,
            height: 0
          }}
        />
      )}

      {/* Floating Popover Calendar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] mt-2 left-0 right-0 sm:w-80 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-4 overflow-hidden"
          >
            {/* Header: Month & Year Selector */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h4 className="text-sm font-black text-slate-900">
                {MONTHS[month]} {year}
              </h4>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {DAYS_OF_WEEK.map((day, idx) => (
                <div
                  key={idx}
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    day === 'Sun' ? 'text-rose-500' : 'text-slate-400'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {daysArray.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} />;
                }

                const isDisabled = checkIsDisabled(day);
                
                // Format check for active selection highlight
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = value === dateStr;

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleDateSelect(day)}
                    className={`
                      h-8 w-8 mx-auto flex items-center justify-center text-xs font-bold rounded-lg transition-all duration-150 relative
                      ${isSelected ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20 scale-105' : ''}
                      ${!isSelected && !isDisabled ? 'text-slate-700 hover:bg-violet-50 hover:text-violet-700' : ''}
                      ${isDisabled ? 'text-slate-300 cursor-not-allowed opacity-30 bg-slate-50/50' : ''}
                    `}
                  >
                    {day}
                    {/* Visual dot for today */}
                    {(() => {
                      const today = new Date();
                      if (
                        today.getDate() === day &&
                        today.getMonth() === month &&
                        today.getFullYear() === year
                      ) {
                        return (
                          <span
                            className={`absolute bottom-1 w-1 h-1 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-violet-600'
                            }`}
                          />
                        );
                      }
                      return null;
                    })()}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
