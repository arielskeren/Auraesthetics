'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import ScheduleBlockEditModal from './ScheduleBlockEditModal';
import { formatDateForHapioUTC } from '@/lib/hapioDateUtils';

interface ScheduleBlocksCalendarProps {
  resourceId: string;
  locationId: string | null;
}

interface ScheduleBlock {
  id: string;
  starts_at: string;
  ends_at: string;
  metadata?: Record<string, unknown> | null;
}

export default function ScheduleBlocksCalendar({
  resourceId,
  locationId,
}: ScheduleBlocksCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, currentDate]);

  const loadBlocks = async () => {
    try {
      setLoading(true);
      setError(null);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const fromDate = new Date(year, month, 1);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(year, month + 1, 0);
      toDate.setHours(23, 59, 59, 999);
      
      // Format dates in Hapio format: Y-m-d\TH:i:sP
      const from = formatDateForHapioUTC(fromDate);
      const to = formatDateForHapioUTC(toDate);

      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/schedule-blocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&per_page=100`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load schedule blocks');
      }

      const data = await response.json();
      setBlocks(data.data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getBlocksForDate = (date: Date): ScheduleBlock[] => {
    const dateStr = date.toISOString().split('T')[0];
    return blocks.filter((block) => {
      const blockDate = new Date(block.starts_at).toISOString().split('T')[0];
      return blockDate === dateStr;
    });
  };

  const getBlockType = (block: ScheduleBlock): 'closed' | 'open' => {
    // Determine if block is closed or open based on metadata or time range
    // For now, assume all-day blocks (00:00-23:59) are closed
    const start = new Date(block.starts_at);
    const end = new Date(block.ends_at);
    const isAllDay = start.getHours() === 0 && start.getMinutes() === 0 &&
                     end.getHours() === 23 && end.getMinutes() === 59;
    return isAllDay ? 'closed' : 'open';
  };

  const handleDateClick = (date: Date) => {
    const dateBlocks = getBlocksForDate(date);
    if (dateBlocks.length > 0) {
      setSelectedBlock(dateBlocks[0]);
    } else {
      setSelectedBlock(null);
    }
    setSelectedDate(date);
    setShowEditModal(true);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return <div className="text-center py-8 text-warm-gray">Loading calendar...</div>;
  }

  return (
    <div className="space-y-6">
      {/* ID Display */}
      <div className="bg-sage-light/30 border border-sand rounded-lg p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-warm-gray font-medium">Resource ID:</span>
            <span className="font-mono text-xs text-charcoal">{resourceId}</span>
          </div>
          {locationId && (
            <div className="flex items-center gap-2">
              <span className="text-warm-gray font-medium">Location ID:</span>
              <span className="font-mono text-xs text-charcoal">{locationId}</span>
            </div>
          )}
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      <div className="bg-white border border-sand rounded-lg p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePreviousMonth}
            className="p-2 hover:bg-sand/20 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-semibold text-charcoal">
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
        <div className="grid grid-cols-7 gap-1">
          {/* Day Headers */}
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-semibold text-charcoal py-2"
            >
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {getDaysInMonth().map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateBlocks = getBlocksForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isPast = date < new Date() && !isToday;

            let blockType: 'closed' | 'open' | null = null;
            if (dateBlocks.length > 0) {
              blockType = getBlockType(dateBlocks[0]);
            }

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                className={`aspect-square border border-sand rounded-lg p-2 text-sm transition-colors hover:bg-sand/20 ${
                  isToday
                    ? 'bg-dark-sage/20 border-dark-sage font-semibold'
                    : isPast
                    ? 'bg-sand/10 text-warm-gray'
                    : 'bg-white text-charcoal'
                } ${
                  blockType === 'closed'
                    ? 'bg-red-50 border-red-200'
                    : blockType === 'open'
                    ? 'bg-yellow-50 border-yellow-200'
                    : ''
                }`}
              >
                <div className="text-left">
                  <div>{date.getDate()}</div>
                  {dateBlocks.length > 0 && (
                    <div className="text-xs mt-1">
                      {blockType === 'closed' ? 'Closed' : 'Special hours'}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded" />
            <span className="text-warm-gray">Closed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded" />
            <span className="text-warm-gray">Special hours</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border border-sand rounded" />
            <span className="text-warm-gray">Normal</span>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <ScheduleBlockEditModal
          resourceId={resourceId}
          locationId={locationId}
          selectedDate={selectedDate}
          selectedBlock={selectedBlock}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDate(null);
            setSelectedBlock(null);
          }}
          onSave={async () => {
            await loadBlocks();
            setShowEditModal(false);
            setSelectedDate(null);
            setSelectedBlock(null);
          }}
        />
      )}
    </div>
  );
}

