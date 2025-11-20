'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchScheduleData, calculateEffectiveSchedule, EffectiveScheduleSlot } from '../ScheduleDataAggregator';
import LoadingState from '../LoadingState';
import ErrorDisplay from '../ErrorDisplay';
import { useHapioData } from '../../_contexts/HapioDataContext';

interface MonthViewProps {
  resourceId: string;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export default function MonthView({ resourceId, currentDate, onDateChange }: MonthViewProps) {
  const { getRecurringSchedules, getRecurringScheduleBlocks, getScheduleBlocks } = useHapioData();
  const [slots, setSlots] = useState<EffectiveScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    loadScheduleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, currentDate]);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      setError(null);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const from = new Date(year, month, 1);
      from.setHours(0, 0, 0, 0);
      const to = new Date(year, month + 1, 0);
      to.setHours(23, 59, 59, 999);

      // Use context methods (cached) instead of direct fetch
      const { recurringSchedules, recurringScheduleBlocks, scheduleBlocks } =
        await fetchScheduleData(resourceId, from, to, {
          getRecurringSchedules,
          getRecurringScheduleBlocks,
          getScheduleBlocks,
        });

      const effectiveSlots = calculateEffectiveSchedule(
        from,
        to,
        recurringSchedules,
        recurringScheduleBlocks,
        scheduleBlocks
      );

      setSlots(effectiveSlots);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getSlotsForDate = (date: Date | null): EffectiveScheduleSlot[] => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return slots.filter((slot) => {
      const slotDateStr = slot.date.toISOString().split('T')[0];
      return slotDateStr === dateStr;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return <LoadingState message="Loading schedule..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white border border-sand rounded-lg p-4">
        <button
          onClick={handlePreviousMonth}
          className="p-2 hover:bg-sand/20 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold text-charcoal">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-sand/20 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-sand rounded-lg p-6">
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-charcoal py-2"
            >
              {day}
            </div>
          ))}

          {getDaysInMonth().map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateSlots = getSlotsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const hasBlocked = dateSlots.some((s) => s.type === 'blocked');
            const hasException = dateSlots.some((s) => s.type === 'exception');
            const hasNormal = dateSlots.some((s) => s.type === 'normal');

            return (
              <button
                key={date.toISOString()}
                onClick={() => onDateChange(date)}
                className={`aspect-square border rounded-lg p-2 text-sm transition-colors hover:bg-sand/20 ${
                  isToday
                    ? 'bg-dark-sage/20 border-dark-sage font-semibold'
                    : hasBlocked
                    ? 'bg-red-50 border-red-200'
                    : hasException
                    ? 'bg-yellow-50 border-yellow-200'
                    : hasNormal
                    ? 'bg-sage-light/30 border-sand'
                    : 'bg-white border-sand'
                }`}
              >
                <div className="text-left">
                  <div>{date.getDate()}</div>
                  {dateSlots.length > 0 && (
                    <div className="text-xs mt-1">
                      {dateSlots.length} slot{dateSlots.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

