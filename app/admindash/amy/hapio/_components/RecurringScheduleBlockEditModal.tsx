'use client';

import { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import { getHapioWeekdayString, getWeekdayFromHapioString } from '@/lib/hapioWeekdayUtils';

interface RecurringScheduleBlockEditModalProps {
  resourceId: string;
  locationId: string | null;
  blockId: string | null;
  onClose: () => void;
  onSave: () => void;
}

const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

interface RecurringSchedule {
  id: string;
  start_date: string | null;
  end_date: string | null;
}

export default function RecurringScheduleBlockEditModal({
  resourceId,
  locationId,
  blockId,
  onClose,
  onSave,
}: RecurringScheduleBlockEditModalProps) {
  const [recurringScheduleId, setRecurringScheduleId] = useState<string>('');
  const [availableSchedules, setAvailableSchedules] = useState<RecurringSchedule[]>([]);
  const [weekday, setWeekday] = useState<number>(1); // Monday by default
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>('23:59');
  const [isAllDay, setIsAllDay] = useState<boolean>(true); // Default to all day
  const [loading, setLoading] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    loadAvailableSchedules();
    if (blockId) {
      loadExistingBlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  const loadAvailableSchedules = async () => {
    try {
      setLoadingSchedules(true);
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/recurring-schedules?per_page=100`
      );
      if (response.ok) {
        const data = await response.json();
        const schedules = (data.data || []) as RecurringSchedule[];
        setAvailableSchedules(schedules);
        // Auto-select first schedule if available and not editing
        if (!blockId && schedules.length > 0 && !recurringScheduleId) {
          setRecurringScheduleId(schedules[0].id);
        }
      }
    } catch (err) {
      console.warn('[RecurringScheduleBlockEditModal] Failed to load schedules:', err);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const loadExistingBlock = async () => {
    if (!blockId) return;
    
    try {
      // First, get all blocks to find the one we're editing
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks?list_all=true&per_page=100`
      );
      if (response.ok) {
        const data = await response.json();
        const blocks = data.data || [];
        const block = blocks.find((b: any) => b.id === blockId);
        
        if (block) {
          setRecurringScheduleId(block.recurring_schedule_id);
          
          // Convert weekday from Hapio format to number
          if (block.weekday !== null && block.weekday !== undefined) {
            const dayOfWeek = getWeekdayFromHapioString(block.weekday);
            setWeekday(dayOfWeek);
          }
          
          // Format time from HH:mm:ss to HH:mm for input
          if (block.start_time) {
            const time = block.start_time.split(':').slice(0, 2).join(':');
            setStartTime(time);
          }
          if (block.end_time) {
            const time = block.end_time.split(':').slice(0, 2).join(':');
            setEndTime(time);
          }
          
          // Check if it's all day
          const startTimeStr = block.start_time || '00:00';
          const endTimeStr = block.end_time || '23:59';
          const isAllDayBlock = startTimeStr.startsWith('00:00') && endTimeStr.startsWith('23:59');
          setIsAllDay(isAllDayBlock);
        }
      }
    } catch (err) {
      console.warn('[RecurringScheduleBlockEditModal] Failed to load block:', err);
      setError(err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!recurringScheduleId) {
        throw new Error('Please select a recurring schedule');
      }

      // Convert time from HH:mm to HH:mm:ss format (Hapio requires H:i:s)
      const formatTime = (time: string): string => {
        if (time.includes(':')) {
          const parts = time.split(':');
          return parts.length === 2 ? `${time}:00` : time;
        }
        return time;
      };

      // Hapio expects weekday as a string enum: "monday", "tuesday", etc.
      const hapioWeekday = getHapioWeekdayString(weekday);

      const payload = {
        recurring_schedule_id: recurringScheduleId,
        weekday: hapioWeekday,
        start_time: formatTime(startTime),
        end_time: formatTime(endTime),
      };

      if (blockId) {
        // Update existing block
        const response = await fetch(
          `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks/${blockId}?recurring_schedule_id=${recurringScheduleId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update recurring schedule block');
        }
      } else {
        // Create new block
        const response = await fetch(
          `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create recurring schedule block');
        }
      }

      onSave();
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-charcoal">
            {blockId ? 'Edit Recurring Schedule Block' : 'Create Recurring Schedule Block'}
          </h2>
          <button
            onClick={onClose}
            className="text-warm-gray hover:text-charcoal transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && <ErrorDisplay error={error} />}

          {/* Recurring Schedule Selection */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              Recurring Schedule <span className="text-red-500">*</span>
            </label>
            {loadingSchedules ? (
              <div className="text-sm text-warm-gray">Loading schedules...</div>
            ) : availableSchedules.length === 0 ? (
              <div className="text-sm text-red-600">
                No recurring schedules found. Please create a recurring schedule first.
              </div>
            ) : (
              <select
                value={recurringScheduleId}
                onChange={(e) => setRecurringScheduleId(e.target.value)}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                required
              >
                <option value="">Select a recurring schedule...</option>
                {availableSchedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.start_date || 'No start date'} - {schedule.end_date || 'Indefinite'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Weekday Selection */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              Weekday <span className="text-red-500">*</span>
            </label>
            <select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
              required
            >
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time Range <span className="text-red-500">*</span>
            </label>
            
            {/* All Day Checkbox */}
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsAllDay(checked);
                    if (checked) {
                      setStartTime('00:00');
                      setEndTime('23:59');
                    }
                  }}
                  className="w-4 h-4 text-dark-sage border-sand rounded focus:ring-dark-sage"
                />
                <span className="text-sm text-charcoal font-medium">All Day</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  const newStartTime = e.target.value;
                  setStartTime(newStartTime);
                  // Auto-check all day if both times are set to all day
                  if (newStartTime === '00:00' && endTime === '23:59') {
                    setIsAllDay(true);
                  } else {
                    setIsAllDay(false);
                  }
                }}
                disabled={isAllDay}
                className="flex-1 px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              />
              <span className="text-warm-gray">to</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => {
                  const newEndTime = e.target.value;
                  setEndTime(newEndTime);
                  // Auto-check all day if both times are set to all day
                  if (startTime === '00:00' && newEndTime === '23:59') {
                    setIsAllDay(true);
                  } else {
                    setIsAllDay(false);
                  }
                }}
                disabled={isAllDay}
                className="flex-1 px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              />
            </div>
            {isAllDay && (
              <p className="mt-2 text-sm text-warm-gray">
                This will block the entire day (all day closed).
              </p>
            )}
            {!isAllDay && (
              <p className="mt-2 text-sm text-warm-gray">
                This will block specific hours (partial hours unavailable).
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sand">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-charcoal border border-sand rounded-lg hover:bg-sand/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !recurringScheduleId || loadingSchedules}
              className="flex items-center gap-2 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : blockId ? 'Update Block' : 'Create Block'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

