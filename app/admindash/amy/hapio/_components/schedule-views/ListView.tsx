'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchScheduleData, calculateEffectiveSchedule, EffectiveScheduleSlot } from '../ScheduleDataAggregator';
import LoadingState from '../LoadingState';
import ErrorDisplay from '../ErrorDisplay';
import { useHapioData } from '../../_contexts/HapioDataContext';

interface ListViewProps {
  resourceId: string;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export default function ListView({ resourceId, currentDate, onDateChange }: ListViewProps) {
  const { getRecurringSchedules, getRecurringScheduleBlocks, getScheduleBlocks } = useHapioData();
  const [slots, setSlots] = useState<EffectiveScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [dateRange, setDateRange] = useState({ from: currentDate, to: new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000) });

  useEffect(() => {
    loadScheduleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, dateRange]);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      setError(null);

      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateRange.to);
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

      // Sort by date and time
      effectiveSlots.sort((a, b) => {
        const dateCompare = a.date.getTime() - b.date.getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });

      setSlots(effectiveSlots);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
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
      {/* Date Range Selector */}
      <div className="bg-white border border-sand rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">From</label>
            <input
              type="date"
              value={dateRange.from.toISOString().split('T')[0]}
              onChange={(e) => setDateRange({ ...dateRange, from: new Date(e.target.value) })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">To</label>
            <input
              type="date"
              value={dateRange.to.toISOString().split('T')[0]}
              onChange={(e) => setDateRange({ ...dateRange, to: new Date(e.target.value) })}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30 border-b border-sand">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Services</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {slots.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-warm-gray">
                    No schedule slots in this range
                  </td>
                </tr>
              ) : (
                slots.map((slot, index) => (
                  <tr
                    key={index}
                    className="hover:bg-sand/20 cursor-pointer"
                    onClick={() => onDateChange(slot.date)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-charcoal">
                      {formatDate(slot.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-warm-gray">
                      {slot.startTime} - {slot.endTime}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          slot.type === 'blocked'
                            ? 'bg-red-100 text-red-700'
                            : slot.type === 'exception'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {slot.type === 'blocked'
                          ? 'Closed'
                          : slot.type === 'exception'
                          ? 'Exception'
                          : 'Available'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-warm-gray">
                      {slot.serviceIds.length > 0
                        ? `${slot.serviceIds.length} service${slot.serviceIds.length !== 1 ? 's' : ''}`
                        : 'All services'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

