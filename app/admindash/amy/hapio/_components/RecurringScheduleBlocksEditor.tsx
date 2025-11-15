'use client';

import { useState, useEffect } from 'react';
import { Save, Clock, Calendar, AlertCircle } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import ServiceSelectionModal from './ServiceSelectionModal';
import { detectOverlaps, validateSchedule } from '@/lib/scheduleUtils';

interface RecurringScheduleBlocksEditorProps {
  resourceId: string;
  locationId: string | null;
}

interface DaySchedule {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  enabled: boolean;
  serviceIds: string[];
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

export default function RecurringScheduleBlocksEditor({
  resourceId,
  locationId,
}: RecurringScheduleBlocksEditorProps) {
  const [schedules, setSchedules] = useState<DaySchedule[]>(
    DAYS.map((day) => ({
      dayOfWeek: day.value,
      startTime: '00:00',
      endTime: '23:59',
      enabled: false,
      serviceIds: [],
    }))
  );
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>('');
  const [endDateType, setEndDateType] = useState<'indefinite' | 'date' | 'preset'>('indefinite');
  const [presetDays, setPresetDays] = useState<number | null>(null);
  const [applyToDays, setApplyToDays] = useState<number[]>([]);
  const [showServiceModal, setShowServiceModal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadExistingBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  const loadExistingBlocks = async () => {
    try {
      // Load existing recurring schedule blocks
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks?per_page=100`
      );
      if (response.ok) {
        const data = await response.json();
        // TODO: Parse and populate schedules from API response
        // This will be updated once we have the exact API structure
      } else if (response.status === 404) {
        // 404 is expected if no blocks exist yet - silently ignore
        return;
      } else {
        // Other errors - log but don't show to user
        console.warn('[RecurringScheduleBlocksEditor] Failed to load existing blocks:', response.status);
      }
    } catch (err) {
      // Silently fail - will create new blocks
      console.warn('[RecurringScheduleBlocksEditor] Error loading existing blocks:', err);
    }
  };

  const handleTimeChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const newSchedules = [...schedules];
    newSchedules[dayIndex] = {
      ...newSchedules[dayIndex],
      [field]: value,
    };
    setSchedules(newSchedules);
  };

  const handleToggleEnabled = (dayIndex: number) => {
    const newSchedules = [...schedules];
    newSchedules[dayIndex] = {
      ...newSchedules[dayIndex],
      enabled: !newSchedules[dayIndex].enabled,
    };
    setSchedules(newSchedules);
  };

  const handleServiceSelection = (dayIndex: number, serviceIds: string[]) => {
    const newSchedules = [...schedules];
    newSchedules[dayIndex] = {
      ...newSchedules[dayIndex],
      serviceIds,
    };
    setSchedules(newSchedules);
  };

  const handleApplyToDays = (sourceDayIndex: number) => {
    if (applyToDays.length === 0) return;

    const sourceSchedule = schedules[sourceDayIndex];
    const newSchedules = [...schedules];

    applyToDays.forEach((targetDayIndex) => {
      if (targetDayIndex !== sourceDayIndex) {
        newSchedules[targetDayIndex] = {
          ...newSchedules[targetDayIndex],
          startTime: sourceSchedule.startTime,
          endTime: sourceSchedule.endTime,
          enabled: sourceSchedule.enabled,
          serviceIds: [...sourceSchedule.serviceIds],
        };
      }
    });

    setSchedules(newSchedules);
    setApplyToDays([]);
  };

  const calculateEndDate = (): string | null => {
    if (endDateType === 'indefinite') return null;
    if (endDateType === 'date') return endDate || null;
    if (endDateType === 'preset' && presetDays) {
      const start = new Date(startDate);
      start.setDate(start.getDate() + presetDays);
      return start.toISOString().split('T')[0];
    }
    return null;
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate all enabled schedules
      const enabledSchedules = schedules.filter((s) => s.enabled);
      
      for (const daySchedule of enabledSchedules) {
        const validation = validateSchedule({
          dayOfWeek: daySchedule.dayOfWeek,
          timeRange: {
            start: daySchedule.startTime,
            end: daySchedule.endTime,
          },
        });

        if (!validation.valid) {
          throw new Error(`${DAYS[daySchedule.dayOfWeek].label}: ${validation.error}`);
        }

        // Check for overlaps with other enabled schedules for the same day
        const otherSchedules = enabledSchedules.filter(
          (s) => s.dayOfWeek === daySchedule.dayOfWeek && s !== daySchedule
        );
        
        if (otherSchedules.length > 0) {
          const overlaps = detectOverlaps(
            {
              dayOfWeek: daySchedule.dayOfWeek,
              timeRange: {
                start: daySchedule.startTime,
                end: daySchedule.endTime,
              },
            },
            otherSchedules.map((s) => ({
              dayOfWeek: s.dayOfWeek,
              timeRange: {
                start: s.startTime,
                end: s.endTime,
              },
            }))
          );

          if (overlaps.length > 0) {
            throw new Error(
              `${DAYS[daySchedule.dayOfWeek].label}: Exception overlaps with another exception on the same day`
            );
          }
        }
      }

      const endDateValue = calculateEndDate();

      if (!locationId) {
        throw new Error('Location ID is required. Please ensure a location exists.');
      }

      // First, create a recurring schedule (parent) for the exceptions
      const scheduleResponse = await fetch(
        `/api/admin/hapio/resources/${resourceId}/recurring-schedules`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Recurring exceptions from ${startDate}`,
            location_id: locationId,
            start_date: startDate,
            end_date: endDateValue,
            metadata: {
              is_exception: true,
            },
          }),
        }
      );

      if (!scheduleResponse.ok) {
        const errorData = await scheduleResponse.json();
        throw new Error(errorData.error || 'Failed to create recurring schedule');
      }

      const scheduleData = await scheduleResponse.json();
      const recurringScheduleId = scheduleData.schedule?.id || scheduleData.id;

      // Create recurring schedule blocks for each enabled day
      for (const daySchedule of enabledSchedules) {
        // Convert time from HH:mm to HH:mm:ss format (Hapio requires H:i:s)
        const formatTime = (time: string): string => {
          if (time.includes(':')) {
            const parts = time.split(':');
            return parts.length === 2 ? `${time}:00` : time;
          }
          return time;
        };
        
        // Convert weekday from 0-6 (Sunday-Saturday) to 1-7 (Monday-Sunday)
        // Hapio uses 1-7 where 1=Monday, 7=Sunday
        const hapioWeekday = daySchedule.dayOfWeek === 0 ? 7 : daySchedule.dayOfWeek;
        
        const blockResponse = await fetch(
          `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recurring_schedule_id: recurringScheduleId,
              weekday: hapioWeekday, // Hapio uses 1-7 (Monday=1, Sunday=7)
              start_time: formatTime(daySchedule.startTime), // Convert HH:mm to HH:mm:ss
              end_time: formatTime(daySchedule.endTime), // Convert HH:mm to HH:mm:ss
              metadata: {
                service_ids: daySchedule.serviceIds,
              },
            }),
          }
        );

        if (!blockResponse.ok) {
          const errorData = await blockResponse.json();
          throw new Error(errorData.error || `Failed to create exception for ${DAYS[daySchedule.dayOfWeek].label}`);
        }
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

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

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-yellow-800 mb-1">Recurring Exceptions</h4>
          <p className="text-sm text-yellow-700">
            These schedules will override your regular recurring schedules. Use this for recurring exceptions like
            &quot;closed every Wednesday afternoon&quot; or &quot;special hours every first Monday of the month&quot;.
          </p>
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Recurring exceptions saved successfully!
        </div>
      )}

      {/* Date Range Selector */}
      <div className="bg-white border border-sand rounded-lg p-6">
        <h3 className="text-lg font-semibold text-charcoal mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Date Range
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">End Date</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="indefinite-exception"
                  name="endDateType"
                  checked={endDateType === 'indefinite'}
                  onChange={() => setEndDateType('indefinite')}
                  className="w-4 h-4 text-dark-sage"
                />
                <label htmlFor="indefinite-exception" className="text-sm text-charcoal cursor-pointer">
                  Indefinite (default)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="specificDate-exception"
                  name="endDateType"
                  checked={endDateType === 'date'}
                  onChange={() => setEndDateType('date')}
                  className="w-4 h-4 text-dark-sage"
                />
                <label htmlFor="specificDate-exception" className="text-sm text-charcoal cursor-pointer">
                  Specific date:
                </label>
                {endDateType === 'date' && (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="flex-1 px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="preset-exception"
                  name="endDateType"
                  checked={endDateType === 'preset'}
                  onChange={() => setEndDateType('preset')}
                  className="w-4 h-4 text-dark-sage"
                />
                <label htmlFor="preset-exception" className="text-sm text-charcoal cursor-pointer">
                  Preset:
                </label>
                {endDateType === 'preset' && (
                  <select
                    value={presetDays || ''}
                    onChange={(e) => setPresetDays(e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                  >
                    <option value="">Select preset...</option>
                    <option value="7">1 week</option>
                    <option value="30">1 month</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Grid */}
      <div className="bg-white border border-sand rounded-lg p-6">
        <h3 className="text-lg font-semibold text-charcoal mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recurring Exception Schedule
        </h3>
        <div className="space-y-4">
          {schedules.map((schedule, index) => {
            const day = DAYS[index];
            return (
              <div
                key={day.value}
                className="border border-sand rounded-lg p-4 hover:bg-sand/5 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <input
                      type="checkbox"
                      id={`exception-day-${day.value}`}
                      checked={schedule.enabled}
                      onChange={() => handleToggleEnabled(index)}
                      className="w-4 h-4 text-dark-sage border-sand rounded focus:ring-dark-sage"
                    />
                    <label
                      htmlFor={`exception-day-${day.value}`}
                      className="font-medium text-charcoal cursor-pointer"
                    >
                      {day.label}
                    </label>
                  </div>

                  {schedule.enabled && (
                    <>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) => handleTimeChange(index, 'startTime', e.target.value)}
                          className="px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                        />
                        <span className="text-warm-gray">to</span>
                        <input
                          type="time"
                          value={schedule.endTime}
                          onChange={(e) => handleTimeChange(index, 'endTime', e.target.value)}
                          className="px-3 py-2 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                        />
                      </div>

                      <button
                        onClick={() => setShowServiceModal(index)}
                        className="px-3 py-2 text-sm border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
                      >
                        {schedule.serviceIds.length > 0
                          ? `${schedule.serviceIds.length} service${schedule.serviceIds.length !== 1 ? 's' : ''}`
                          : 'Select services'}
                      </button>
                    </>
                  )}
                </div>

                {/* Apply to other days checkbox */}
                {schedule.enabled && (
                  <div className="mt-3 pt-3 border-t border-sand">
                    <label className="text-xs text-warm-gray mb-2 block">
                      Apply this exception to other days:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.filter((d) => d.value !== day.value).map((otherDay) => (
                        <label
                          key={otherDay.value}
                          className="flex items-center gap-1 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={applyToDays.includes(otherDay.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setApplyToDays([...applyToDays, otherDay.value]);
                              } else {
                                setApplyToDays(applyToDays.filter((d) => d !== otherDay.value));
                              }
                            }}
                            className="w-3 h-3 text-dark-sage border-sand rounded"
                          />
                          <span className="text-warm-gray">{otherDay.short}</span>
                        </label>
                      ))}
                      {applyToDays.length > 0 && (
                        <button
                          onClick={() => handleApplyToDays(index)}
                          className="ml-2 px-2 py-1 text-xs bg-dark-sage text-charcoal rounded hover:bg-dark-sage/80 transition-colors"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading || !startDate}
          className="flex items-center gap-2 px-6 py-3 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Recurring Exceptions'}
        </button>
      </div>

      {/* Service Selection Modal */}
      {showServiceModal !== null && (
        <ServiceSelectionModal
          selectedServiceIds={schedules[showServiceModal].serviceIds}
          onClose={() => setShowServiceModal(null)}
          onSave={(serviceIds) => {
            handleServiceSelection(showServiceModal, serviceIds);
            setShowServiceModal(null);
          }}
        />
      )}
    </div>
  );
}

