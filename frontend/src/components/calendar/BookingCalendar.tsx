import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface BookedRange {
  start: Date;
  end: Date;
  bookerName: string;
}

interface Props {
  bookedRanges: BookedRange[];
  onRangeSelect: (start: Date, end?: Date) => void;
  selectedStart?: Date | null;
  selectedEnd?: Date | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBetween(d: Date, start: Date, end: Date) {
  const ds = startOfDay(d).getTime();
  return ds > startOfDay(start).getTime() && ds < startOfDay(end).getTime();
}

export function BookingCalendar({ bookedRanges, onRangeSelect, selectedStart, selectedEnd }: Props) {
  const today = startOfDay(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Build day grid for current month view
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun

  const days: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];
  // Pad to complete last week
  while (days.length % 7 !== 0) days.push(null);

  const isBooked = useCallback((d: Date) => {
    const ds = startOfDay(d).getTime();
    return bookedRanges.some((r) => {
      const rs = startOfDay(r.start).getTime();
      const re = startOfDay(r.end).getTime();
      return ds >= rs && ds <= re;
    });
  }, [bookedRanges]);

  const bookerFor = useCallback((d: Date) => {
    return bookedRanges.find((r) => {
      const ds = startOfDay(d).getTime();
      return ds >= startOfDay(r.start).getTime() && ds <= startOfDay(r.end).getTime();
    })?.bookerName;
  }, [bookedRanges]);

  const isPast = (d: Date) => startOfDay(d).getTime() < today.getTime();

  const isSelected = (d: Date) => {
    if (selectedStart && isSameDay(d, selectedStart)) return 'start';
    if (selectedEnd && isSameDay(d, selectedEnd)) return 'end';
    if (selectedStart && selectedEnd && isBetween(d, selectedStart, selectedEnd)) return 'middle';
    return null;
  };

  const isInHoverRange = (d: Date) => {
    if (!selectedStart || selectedEnd || !hoverDate) return false;
    const ds = startOfDay(d).getTime();
    const ss = startOfDay(selectedStart).getTime();
    const hs = startOfDay(hoverDate).getTime();
    if (hs > ss) return ds > ss && ds < hs;
    return false;
  };

  const isHoverEnd = (d: Date) => {
    if (!selectedStart || selectedEnd || !hoverDate) return false;
    return startOfDay(d).getTime() === startOfDay(hoverDate).getTime() &&
      startOfDay(hoverDate).getTime() > startOfDay(selectedStart).getTime();
  };

  const handleClick = (d: Date, e: React.MouseEvent) => {
    if (isPast(d) || isBooked(d)) return;
    const clicked = startOfDay(d);

    if (!selectedStart || selectedEnd) {
      // Start fresh selection — first click, no end yet
      onRangeSelect(clicked);
    } else {
      // Second click — complete range
      if (clicked.getTime() < selectedStart.getTime()) {
        // Clicked before start: swap — new start, old start becomes end
        onRangeSelect(clicked, startOfDay(selectedStart));
      } else if (clicked.getTime() === selectedStart.getTime()) {
        // Same day: single-day booking, reset to start fresh on next click
        onRangeSelect(clicked, clicked);
      } else {
        // Check no booked dates in range
        const range = getDatesInRange(selectedStart, clicked);
        const hasConflict = range.some(isBooked);
        if (hasConflict) {
          toast.error('Selected range contains booked dates');
          return;
        }
        onRangeSelect(selectedStart, clicked);
      }
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectionHint = !selectedStart
    ? 'Click a date to set start'
    : !selectedEnd
    ? 'Now click an end date'
    : null;

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="text-center">
          <span className="font-semibold text-gray-900">{MONTHS[viewMonth]} {viewYear}</span>
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Hint */}
      <div className="text-center mb-3 h-5">
        {selectionHint && (
          <span className={`text-xs font-medium ${!selectedStart ? 'text-gray-400' : 'text-primary-600 animate-pulse'}`}>
            {selectionHint}
          </span>
        )}
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d, idx) => {
          if (!d) return <div key={`empty-${idx}`} />;

          const booked = isBooked(d);
          const past = isPast(d);
          const sel = isSelected(d);
          const hover = isInHoverRange(d);
          const hoverEnd = isHoverEnd(d);
          const isToday = isSameDay(d, today);
          const booker = bookerFor(d);
          const disabled = booked || past;

          let cellClass = 'relative flex flex-col items-center justify-center h-9 text-sm rounded-lg transition-all ';

          if (sel === 'start' || sel === 'end') {
            cellClass += 'bg-primary-600 text-white font-semibold shadow-md ';
          } else if (sel === 'middle') {
            cellClass += 'bg-primary-100 text-primary-700 rounded-none ';
          } else if (hoverEnd) {
            cellClass += 'bg-primary-200 text-primary-800 font-medium ';
          } else if (hover) {
            cellClass += 'bg-primary-50 text-primary-600 rounded-none ';
          } else if (booked) {
            cellClass += 'bg-red-50 text-red-400 cursor-not-allowed ';
          } else if (past) {
            cellClass += 'text-gray-300 cursor-not-allowed ';
          } else {
            cellClass += 'text-gray-700 hover:bg-gray-100 cursor-pointer ';
          }

          return (
            <div
              key={d.toISOString()}
              className={cellClass}
              onClick={(e) => handleClick(d, e)}
              onMouseEnter={() => !disabled && setHoverDate(d)}
              onMouseLeave={() => setHoverDate(null)}
              title={booked ? `Booked by ${booker || 'someone'}` : undefined}
            >
              {isToday && !sel && (
                <span className="absolute top-0.5 right-1 w-1 h-1 rounded-full bg-primary-500" />
              )}
              <span className={`leading-none ${sel ? 'font-bold' : ''}`}>{d.getDate()}</span>
              {booked && (
                <span className="text-[9px] leading-none text-red-300 mt-0.5 truncate w-full text-center px-0.5">
                  {booker ? booker.split(' ')[0] : 'Booked'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary-600 inline-block" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 inline-block" />
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-100 inline-block" />
          Past
        </span>
      </div>
    </div>
  );
}

function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
