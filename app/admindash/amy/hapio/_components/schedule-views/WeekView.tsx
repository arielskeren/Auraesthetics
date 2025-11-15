'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchScheduleData, calculateEffectiveSchedule, EffectiveScheduleSlot } from '../ScheduleDataAggregator';
import LoadingState from '../LoadingState';
import ErrorDisplay from '../ErrorDisplay';

interface WeekViewProps {
  resourceId: string;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export default function WeekView({ resourceId, currentDate, onDateChange }: WeekViewProps) {
  const [slots, setSlots] = useState<EffectiveScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    loadScheduleData();
  }, [resourceId, currentDate]);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get start of week (Sunday)
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      weekStart.setHours(0, 0, 0, 0);

      // Get end of week (Saturday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const { recurringSchedules, recurringScheduleBlocks, scheduleBlocks } =
        await fetchScheduleData(resourceId, weekStart, weekEnd);

      const effectiveSlots = calculateEffectiveSchedule(
        weekStart,
        weekEnd,
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

  const handlePreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    onDateChange(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    onDateChange(newDate);
  };

  const getWeekDays = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getSlotsForDate = (date: Date): EffectiveScheduleSlot[] => {
    const dateStr = date.toISOString().split('T')[0];
    return slots.filter((slot) => {
      const slotDateStr = slot.date.toISOString().split('T')[0];
      return slotDateStr === dateStr;
    });
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return <LoadingState message="Loading schedule..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  const weekDays = getWeekDays();
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-white border border-sand rounded-lg p-4">
        <button
          onClick={handlePreviousWeek}
          className="p-2 hover:bg-sand/20 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold text-charcoal">
          {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
          {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </h3>
        <button
          onClick={handleNextWeek}
          className="p-2 hover:bg-sand/20 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Week Grid */}
      <div className="bg-white border border-sand rounded-lg p-6">
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const daySlots = getSlotsForDate(day);
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <div
                key={index}
                className={`border rounded-lg p-3 ${
                  isToday ? 'border-dark-sage bg-sage-light/20' : 'border-sand'
                }`}
              >
                <div className="font-semibold text-charcoal mb-2">
                  {dayNames[index]}
                </div>
                <div className="text-xs text-warm-gray mb-3">
                  {day.getDate()}
                </div>
                <div className="space-y-2">
                  {daySlots.length === 0 ? (
                    <div className="text-xs text-warm-gray">No schedule</div>
                  ) : (
                    daySlots.map((slot, slotIndex) => (
                      <div
                        key={slotIndex}
                        className={`text-xs p-2 rounded ${
                          slot.type === 'blocked'
                            ? 'bg-red-50 text-red-700'
                            : slot.type === 'exception'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-sage-light/30 text-charcoal'
                        }`}
                      >
                        {slot.startTime} - {slot.endTime}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

