'use client';

import { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import ServiceSelectionModal from './ServiceSelectionModal';
import { detectOverlaps, validateSchedule } from '@/lib/scheduleUtils';
import { getHapioWeekdayString, getWeekdayFromHapioString } from '@/lib/hapioWeekdayUtils';

interface RecurringScheduleEditModalProps {
  resourceId: string;
  locationId: string | null;
  scheduleId: string | null;
  onClose: () => void;
  onSave: () => void;
}

interface TimeRange {
  id: string; // Unique ID for this time range
  startTime: string;
  endTime: string;
  serviceIds: string[];
}

interface DaySchedule {
  dayOfWeek: number;
  enabled: boolean;
  timeRanges: TimeRange[]; // Multiple time ranges per day
}

const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  // Saturday (value: 6) is excluded - No Work on Shabbat ;)
];

export default function RecurringScheduleEditModal({
  resourceId,
  locationId,
  scheduleId,
  onClose,
  onSave,
}: RecurringScheduleEditModalProps) {
  const [schedules, setSchedules] = useState<DaySchedule[]>(
    DAYS.map((day) => ({
      dayOfWeek: day.value,
      enabled: false,
      timeRanges: [{ id: `default-${day.value}`, startTime: '09:00', endTime: '17:00', serviceIds: [] }],
    }))
  );
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>('');
  const [endDateType, setEndDateType] = useState<'indefinite' | 'date' | 'preset'>('indefinite');
  const [presetDays, setPresetDays] = useState<number | null>(null);
  const [showServiceModal, setShowServiceModal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [allServiceIds, setAllServiceIds] = useState<string[]>([]);

  useEffect(() => {
    loadAllServices();
    if (scheduleId) {
      loadExistingSchedule();
    } else {
      // Reset to defaults for new schedule - will be populated with all services after loadAllServices
      setSchedules(DAYS.map((day) => ({
        dayOfWeek: day.value,
        enabled: false,
        timeRanges: [{ id: `default-${day.value}`, startTime: '09:00', endTime: '17:00', serviceIds: [] }],
      })));
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setEndDateType('indefinite');
      setPresetDays(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const loadAllServices = async () => {
    try {
      const response = await fetch('/api/admin/hapio/services?per_page=100');
      if (response.ok) {
        const data = await response.json();
        const serviceIds = (data.data || []).map((s: any) => s.id);
        setAllServiceIds(serviceIds);
        
        // If this is a new schedule, populate all time ranges with all services
        if (!scheduleId) {
          setSchedules((prev) =>
            prev.map((day) => ({
              ...day,
              timeRanges: day.timeRanges.map((range) => ({
                ...range,
                serviceIds: serviceIds.length > 0 ? [...serviceIds] : [],
              })),
            }))
          );
        }
      }
    } catch (err) {
      console.warn('[RecurringScheduleEditModal] Error loading services:', err);
    }
  };

  const loadExistingSchedule = async () => {
    if (!scheduleId) return;
    
    try {
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/recurring-schedules/${scheduleId}`
      );
      if (response.ok) {
        const data = await response.json();
        const schedule = data.schedule || data;
        
        if (schedule.start_date) {
          setStartDate(schedule.start_date.split('T')[0]);
        }
        if (schedule.end_date) {
          setEndDate(schedule.end_date.split('T')[0]);
          setEndDateType('date');
        } else {
          setEndDateType('indefinite');
        }
        
        // Load blocks for this schedule
        try {
          const blocksResponse = await fetch(
            `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks?recurring_schedule_id=${scheduleId}&per_page=100`
          );
          
          if (blocksResponse.ok) {
            const blocksData = await blocksResponse.json();
            const blocks = blocksData.data || [];
            
            // Initialize all days with empty time ranges
            const initializedSchedules: DaySchedule[] = DAYS.map((day) => ({
              dayOfWeek: day.value,
              enabled: false,
              timeRanges: [],
            }));
            
            blocks.forEach((block: any) => {
              // Hapio returns weekday as a string ("monday", "tuesday", etc.) or legacy number
              const hapioWeekday = block.weekday ?? block.day_of_week;
              const dayOfWeek = getWeekdayFromHapioString(hapioWeekday);
              
              // Skip Saturday (value: 6) - No Work on Shabbat ;)
              if (dayOfWeek === 6) {
                return;
              }
              
              const dayIndex = DAYS.findIndex(day => day.value === dayOfWeek);
              if (dayIndex !== -1) {
                const parseTime = (time: string | null | undefined): string => {
                  if (!time) return '09:00';
                  const parts = time.split(':');
                  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : time;
                };
                
                let serviceIds = (block.metadata?.service_ids as string[]) || [];
                
                // If serviceIds is empty or if there are new services not in the list, default to all services
                // This ensures new services are automatically included
                if (serviceIds.length === 0 || allServiceIds.length > 0) {
                  // Merge: keep existing serviceIds, but add any new services that weren't in the original list
                  const existingSet = new Set(serviceIds);
                  const allServicesSet = new Set(allServiceIds);
                  
                  // If empty, use all services. Otherwise, merge with new services
                  if (serviceIds.length === 0) {
                    serviceIds = [...allServiceIds];
                  } else {
                    // Add any new services that weren't in the original list
                    allServiceIds.forEach((id) => {
                      if (!existingSet.has(id)) {
                        serviceIds.push(id);
                      }
                    });
                  }
                }
                
                // Add time range to the day
                initializedSchedules[dayIndex].timeRanges.push({
                  id: `block-${block.id}`,
                  startTime: parseTime(block.start_time),
                  endTime: parseTime(block.end_time),
                  serviceIds,
                });
                initializedSchedules[dayIndex].enabled = true;
              }
            });
            
            // After loading blocks, ensure allServiceIds is loaded and merge with any new services
            // This needs to happen after allServiceIds is set, so we'll do it in a separate effect
            // For now, we'll merge in loadExistingSchedule after allServiceIds is available
            setSchedules(initializedSchedules);
          }
        } catch (blockErr) {
          console.warn('[RecurringScheduleEditModal] Error loading blocks:', blockErr);
        }
      }
    } catch (err) {
      console.warn('[RecurringScheduleEditModal] Error loading schedule:', err);
    }
  };

  // Effect to merge new services into existing schedules when allServiceIds is loaded
  useEffect(() => {
    if (allServiceIds.length > 0 && scheduleId) {
      setSchedules((prev) =>
        prev.map((daySchedule) => ({
          ...daySchedule,
          timeRanges: daySchedule.timeRanges.map((timeRange) => {
            if (timeRange.serviceIds.length === 0) {
              // If empty, default to all services
              return { ...timeRange, serviceIds: [...allServiceIds] };
            } else {
              // Merge: add any new services that weren't in the original list
              const existingSet = new Set(timeRange.serviceIds);
              const mergedIds = [...timeRange.serviceIds];
              allServiceIds.forEach((id) => {
                if (!existingSet.has(id)) {
                  mergedIds.push(id);
                }
              });
              return { ...timeRange, serviceIds: mergedIds };
            }
          }),
        }))
      );
    }
  }, [allServiceIds, scheduleId]);

  const handleTimeChange = (dayIndex: number, rangeIndex: number, field: 'startTime' | 'endTime', value: string) => {
    const newSchedules = [...schedules];
    const newTimeRanges = [...newSchedules[dayIndex].timeRanges];
    newTimeRanges[rangeIndex] = {
      ...newTimeRanges[rangeIndex],
      [field]: value,
    };
    newSchedules[dayIndex] = {
      ...newSchedules[dayIndex],
      timeRanges: newTimeRanges,
    };
    setSchedules(newSchedules);
  };

  const handleAddTimeRange = (dayIndex: number) => {
    const newSchedules = [...schedules];
    const newTimeRanges = [...newSchedules[dayIndex].timeRanges];
    // Default to all services for new time ranges
    newTimeRanges.push({
      id: `range-${Date.now()}-${dayIndex}`,
      startTime: '09:00',
      endTime: '17:00',
      serviceIds: allServiceIds.length > 0 ? [...allServiceIds] : [],
    });
    newSchedules[dayIndex] = {
      ...newSchedules[dayIndex],
      timeRanges: newTimeRanges,
    };
    setSchedules(newSchedules);
  };

  const handleRemoveTimeRange = (dayIndex: number, rangeIndex: number) => {
    const newSchedules = [...schedules];
    const newTimeRanges = [...newSchedules[dayIndex].timeRanges];
    if (newTimeRanges.length > 1) {
      newTimeRanges.splice(rangeIndex, 1);
      newSchedules[dayIndex] = {
        ...newSchedules[dayIndex],
        timeRanges: newTimeRanges,
      };
      setSchedules(newSchedules);
    }
  };

  const handleToggleEnabled = (dayIndex: number) => {
    const newSchedules = [...schedules];
    newSchedules[dayIndex] = {
      ...newSchedules[dayIndex],
      enabled: !newSchedules[dayIndex].enabled,
    };
    setSchedules(newSchedules);
  };

  const handleServiceSelection = (dayIndex: number, rangeIndex: number, serviceIds: string[]) => {
    const newSchedules = [...schedules];
    const newTimeRanges = [...newSchedules[dayIndex].timeRanges];
    newTimeRanges[rangeIndex] = {
      ...newTimeRanges[rangeIndex],
      serviceIds,
    };
    newSchedules[dayIndex] = {
      ...newSchedules[dayIndex],
      timeRanges: newTimeRanges,
    };
    setSchedules(newSchedules);
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
      const enabledSchedules = schedules.filter((s) => s.enabled && s.timeRanges.length > 0);
      
      // Validate all time ranges
      for (const daySchedule of enabledSchedules) {
        for (const timeRange of daySchedule.timeRanges) {
          const validation = validateSchedule({
            dayOfWeek: daySchedule.dayOfWeek,
            timeRange: {
              start: timeRange.startTime,
              end: timeRange.endTime,
            },
          });

          if (!validation.valid) {
            throw new Error(`${DAYS[daySchedule.dayOfWeek].label}: ${validation.error}`);
          }
        }

        // Check for overlaps within the same day
        const allRangesForDay = daySchedule.timeRanges;
        for (let i = 0; i < allRangesForDay.length; i++) {
          for (let j = i + 1; j < allRangesForDay.length; j++) {
            const range1 = allRangesForDay[i];
            const range2 = allRangesForDay[j];
            
            const overlaps = detectOverlaps(
              {
                dayOfWeek: daySchedule.dayOfWeek,
                timeRange: {
                  start: range1.startTime,
                  end: range1.endTime,
                },
              },
              [{
                dayOfWeek: daySchedule.dayOfWeek,
                timeRange: {
                  start: range2.startTime,
                  end: range2.endTime,
                },
              }]
            );

            if (overlaps.length > 0) {
              throw new Error(
                `${DAYS[daySchedule.dayOfWeek].label}: Time ranges overlap on the same day`
              );
            }
          }
        }
      }

      const endDateValue = calculateEndDate();

      if (!locationId) {
        throw new Error('Location ID is required. Please ensure a location exists.');
      }

      // Create or update recurring schedule
      const scheduleResponse = await fetch(
        scheduleId
          ? `/api/admin/hapio/resources/${resourceId}/recurring-schedules/${scheduleId}`
          : `/api/admin/hapio/resources/${resourceId}/recurring-schedules`,
        {
          method: scheduleId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Schedule from ${startDate}`,
            location_id: locationId,
            start_date: startDate,
            end_date: endDateValue,
            metadata: {},
          }),
        }
      );

      if (!scheduleResponse.ok) {
        const errorData = await scheduleResponse.json();
        throw new Error(errorData.error || 'Failed to save recurring schedule');
      }

      const scheduleData = await scheduleResponse.json();
      const recurringScheduleId = scheduleData.schedule?.id || scheduleData.id || scheduleData.data?.id || scheduleData.schedule?.data?.id || scheduleId;
      
      if (!recurringScheduleId) {
        throw new Error('Failed to get recurring schedule ID from response');
      }

      // Delete existing blocks if editing, then create new ones
      if (scheduleId) {
        try {
          const existingBlocksResponse = await fetch(
            `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks?recurring_schedule_id=${recurringScheduleId}&per_page=100`
          );
          if (existingBlocksResponse.ok) {
            const existingBlocks = await existingBlocksResponse.json();
            for (const block of existingBlocks.data || []) {
              await fetch(
                `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks/${block.id}?recurring_schedule_id=${recurringScheduleId}`,
                { method: 'DELETE' }
              );
            }
          }
        } catch (deleteErr) {
          console.warn('[RecurringScheduleEditModal] Error deleting existing blocks:', deleteErr);
        }
      }

      // Create recurring schedule blocks for each enabled day and time range
      for (const daySchedule of enabledSchedules) {
        // Convert time from HH:mm to HH:mm:ss format (Hapio requires H:i:s)
        const formatTime = (time: string): string => {
          if (time.includes(':')) {
            const parts = time.split(':');
            return parts.length === 2 ? `${time}:00` : time;
          }
          return time;
        };
        
        // Hapio expects weekday as a string enum: "monday", "tuesday", etc.
        const hapioWeekday = getHapioWeekdayString(daySchedule.dayOfWeek);
        
        // Create a block for each time range
        for (const timeRange of daySchedule.timeRanges) {
          const blockPayload = {
            recurring_schedule_id: recurringScheduleId,
            weekday: hapioWeekday, // String format: "monday", "tuesday", etc.
            start_time: formatTime(timeRange.startTime), // Convert HH:mm to HH:mm:ss
            end_time: formatTime(timeRange.endTime), // Convert HH:mm to HH:mm:ss
            metadata: {
              service_ids: timeRange.serviceIds,
            },
          };
          
          console.log('[RecurringScheduleEditModal] Creating block:', {
            day: DAYS[daySchedule.dayOfWeek].label,
            dayOfWeek: daySchedule.dayOfWeek,
            hapioWeekdayString: hapioWeekday,
            payload: blockPayload,
          });

          const blockResponse = await fetch(
            `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(blockPayload),
            }
          );

          if (!blockResponse.ok) {
            const errorData = await blockResponse.json();
            throw new Error(errorData.error || `Failed to create schedule for ${DAYS[daySchedule.dayOfWeek].label}`);
          }
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onSave();
      }, 1000);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-sand px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">
            {scheduleId ? 'Edit Schedule' : 'Create New Schedule'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shabbat Disclaimer */}
        <div className="px-6 pt-4">
          <div className="bg-sage-light/30 border border-sage rounded-lg px-4 py-2 text-center">
            <p className="text-sm text-charcoal font-medium">No Work on Shabbat ;)</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {error && <ErrorDisplay error={error} />}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-sm text-green-700">
              Schedule saved successfully!
            </div>
          )}

          {/* Date Range Selector */}
          <div className="bg-white border border-sand rounded-lg p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-charcoal mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
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
                    <label className="block text-sm font-medium text-charcoal mb-1.5">End Date</label>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="indefinite"
                          name="endDateType"
                          checked={endDateType === 'indefinite'}
                          onChange={() => setEndDateType('indefinite')}
                          className="w-4 h-4 text-dark-sage"
                        />
                        <label htmlFor="indefinite" className="text-sm text-charcoal cursor-pointer">
                          Indefinite (default)
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="specificDate"
                          name="endDateType"
                          checked={endDateType === 'date'}
                          onChange={() => setEndDateType('date')}
                          className="w-4 h-4 text-dark-sage"
                        />
                        <label htmlFor="specificDate" className="text-sm text-charcoal cursor-pointer">
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
                          id="preset"
                          name="endDateType"
                          checked={endDateType === 'preset'}
                          onChange={() => setEndDateType('preset')}
                          className="w-4 h-4 text-dark-sage"
                        />
                        <label htmlFor="preset" className="text-sm text-charcoal cursor-pointer">
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
              {/* Save/Cancel Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSave}
                  disabled={loading || !startDate}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* 7-Day Grid - Compact Layout */}
          <div className="bg-white border border-sand rounded-lg p-4">
            <h3 className="text-base font-semibold text-charcoal mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Weekly Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {schedules.map((schedule, index) => {
                const day = DAYS[index];
                return (
                  <div
                    key={day.value}
                    className={`border rounded-lg p-3 transition-colors ${
                      schedule.enabled ? 'border-dark-sage bg-sage-light/10' : 'border-sand'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id={`day-${day.value}`}
                        checked={schedule.enabled}
                        onChange={() => handleToggleEnabled(index)}
                        className="w-4 h-4 text-dark-sage border-sand rounded focus:ring-dark-sage"
                      />
                      <label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-semibold text-charcoal cursor-pointer flex-1"
                      >
                        {day.label}
                      </label>
                      {schedule.enabled && (
                        <button
                          onClick={() => handleAddTimeRange(index)}
                          className="text-xs px-2 py-1 bg-dark-sage text-charcoal rounded hover:bg-dark-sage/80 transition-colors"
                        >
                          + Add Time
                        </button>
                      )}
                    </div>

                    {schedule.enabled && (
                      <div className="space-y-2">
                        {schedule.timeRanges.map((timeRange, rangeIndex) => (
                          <div key={timeRange.id} className="bg-white border border-sand rounded p-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={timeRange.startTime}
                                onChange={(e) => handleTimeChange(index, rangeIndex, 'startTime', e.target.value)}
                                className="flex-1 px-2 py-1.5 border border-sand rounded text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                              />
                              <span className="text-xs text-warm-gray">to</span>
                              <input
                                type="time"
                                value={timeRange.endTime}
                                onChange={(e) => handleTimeChange(index, rangeIndex, 'endTime', e.target.value)}
                                className="flex-1 px-2 py-1.5 border border-sand rounded text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                              />
                              {schedule.timeRanges.length > 1 && (
                                <button
                                  onClick={() => handleRemoveTimeRange(index, rangeIndex)}
                                  className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Remove time range"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setShowServiceModal(index * 1000 + rangeIndex); // Use composite index
                                // Store day and range index for service selection
                                (window as any).__serviceModalDayIndex = index;
                                (window as any).__serviceModalRangeIndex = rangeIndex;
                              }}
                              className="w-full px-2 py-1 text-xs border border-sand text-charcoal rounded hover:bg-sand/20 transition-colors text-left"
                            >
                              {timeRange.serviceIds.length > 0
                                ? `${timeRange.serviceIds.length} service${timeRange.serviceIds.length !== 1 ? 's' : ''} selected`
                                : 'Select services (optional)'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>


          {/* Service Selection Modal */}
          {showServiceModal !== null && (
            <ServiceSelectionModal
              selectedServiceIds={
                (window as any).__serviceModalDayIndex !== undefined && (window as any).__serviceModalRangeIndex !== undefined
                  ? schedules[(window as any).__serviceModalDayIndex]?.timeRanges[(window as any).__serviceModalRangeIndex]?.serviceIds || []
                  : []
              }
              onClose={() => {
                setShowServiceModal(null);
                (window as any).__serviceModalDayIndex = undefined;
                (window as any).__serviceModalRangeIndex = undefined;
              }}
              onSave={(serviceIds) => {
                const dayIndex = (window as any).__serviceModalDayIndex;
                const rangeIndex = (window as any).__serviceModalRangeIndex;
                if (dayIndex !== undefined && rangeIndex !== undefined) {
                  handleServiceSelection(dayIndex, rangeIndex, serviceIds);
                }
                setShowServiceModal(null);
                (window as any).__serviceModalDayIndex = undefined;
                (window as any).__serviceModalRangeIndex = undefined;
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

