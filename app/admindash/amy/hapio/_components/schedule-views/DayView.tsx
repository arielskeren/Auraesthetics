'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchScheduleData, calculateEffectiveSchedule, EffectiveScheduleSlot } from '../ScheduleDataAggregator';
import LoadingState from '../LoadingState';
import ErrorDisplay from '../ErrorDisplay';
import { useHapioData } from '../../_contexts/HapioDataContext';

interface DayViewProps {
  resourceId: string;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export default function DayView({ resourceId, currentDate, onDateChange }: DayViewProps) {
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

      const from = new Date(currentDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(currentDate);
      to.setHours(23, 59, 59, 999);

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

  const handlePreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return <LoadingState message="Loading schedule..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="space-y-4">
      {/* Day Navigation */}
      <div className="flex items-center justify-between bg-white border border-sand rounded-lg p-4">
        <button
          onClick={handlePreviousDay}
          className="p-2 hover:bg-sand/20 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold text-charcoal">{formatDate(currentDate)}</h3>
        <button
          onClick={handleNextDay}
          className="p-2 hover:bg-sand/20 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Schedule Slots */}
      <div className="bg-white border border-sand rounded-lg p-6">
        {slots.length === 0 ? (
          <div className="text-center py-8 text-warm-gray">No schedule for this day</div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg ${
                  slot.type === 'blocked'
                    ? 'bg-red-50 border-red-200'
                    : slot.type === 'exception'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-sage-light/30 border-sand'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-charcoal">
                      {slot.startTime} - {slot.endTime}
                    </div>
                    <div className="text-sm text-warm-gray">
                      {slot.type === 'blocked'
                        ? 'Closed'
                        : slot.type === 'exception'
                        ? 'Special hours'
                        : 'Available'}
                    </div>
                    {slot.serviceIds.length > 0 && (
                      <div className="text-xs text-warm-gray mt-1">
                        {slot.serviceIds.length} service{slot.serviceIds.length !== 1 ? 's' : ''} available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

