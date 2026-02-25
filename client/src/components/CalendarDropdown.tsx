import { useState, useEffect, useRef } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isToday,
  getISOWeek,
  getYear,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api';

interface CalendarDropdownProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}

export const CalendarDropdown = ({
  currentDate,
  onSelectDate,
  onClose,
}: CalendarDropdownProps) => {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(currentDate));
  const [imageDates, setImageDates] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Fetch dates with images for the viewed month
  useEffect(() => {
    const monthStr = format(viewMonth, 'yyyy-MM');
    api.getImageDates(monthStr).then((res) => {
      setImageDates(new Set(res.dates));
    }).catch(() => {
      setImageDates(new Set());
    });
  }, [viewMonth]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  // Build grid: start from Monday of the week containing month start
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  // Current active week
  const activeWeekNum = getISOWeek(currentDate);
  const activeWeekYear = getYear(currentDate);

  const isSameISOWeek = (date: Date) =>
    getISOWeek(date) === activeWeekNum && getYear(date) === activeWeekYear;

  const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-sm shadow-lg z-50 select-none"
      style={{ width: 280 }}
    >
      {/* Month navigation header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
        <button
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-stone-200 transition-colors p-1"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-neutral-900 dark:text-stone-200">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-stone-200 transition-colors p-1"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 px-3 pt-3 pb-1">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-semibold tracking-wide text-neutral-400 dark:text-stone-500 uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, viewMonth);
          const today = isToday(day);
          const inActiveWeek = isSameISOWeek(day);
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasImages = imageDates.has(dateStr);

          return (
            <button
              key={i}
              onClick={() => {
                onSelectDate(day);
              }}
              disabled={!inMonth}
              className={clsx(
                'relative flex flex-col items-center justify-center h-9 text-sm rounded-sm transition-colors',
                !inMonth && 'text-neutral-300 dark:text-neutral-600 cursor-default',
                inMonth && !inActiveWeek && 'text-neutral-700 dark:text-stone-300 hover:bg-neutral-100 dark:hover:bg-neutral-700',
                inMonth && inActiveWeek && 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-900 dark:text-stone-200 font-medium',
                today && inMonth && 'ring-1 ring-neutral-400 dark:ring-stone-500'
              )}
            >
              {format(day, 'd')}
              {hasImages && inMonth && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-neutral-400 dark:bg-stone-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
