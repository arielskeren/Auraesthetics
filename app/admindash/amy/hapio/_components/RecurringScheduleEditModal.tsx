'use client';

import { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import ServiceSelectionModal from './ServiceSelectionModal';
import { detectOverlaps, validateSchedule } from '@/lib/scheduleUtils';

interface RecurringScheduleEditModalProps {
  resourceId: string;
  locationId: string | null;
  scheduleId: string | null;
  onClose: () => void;
  onSave: () => void;
}

interface DaySchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
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
      startTime: '09:00',
      endTime: '17:00',
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
    if (scheduleId) {
      loadExistingSchedule();
    } else {
      // Reset to defaults for new schedule
      setSchedules(DAYS.map((day) => ({
        dayOfWeek: day.value,
        startTime: '09:00',
        endTime: '17:00',
        enabled: false,
        serviceIds: [],
      })));
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setEndDateType('indefinite');
      setPresetDays(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

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
            
            const newSchedules = [...schedules];
            
            blocks.forEach((block: any) => {
              const hapioWeekday = block.weekday ?? block.day_of_week;
              let dayOfWeek: number;
              if (hapioWeekday === 7) {
                dayOfWeek = 0;
              } else {
                dayOfWeek = hapioWeekday;
              }
              
              const dayIndex = DAYS.findIndex(day => day.value === dayOfWeek);
              if (dayIndex !== -1) {
                const parseTime = (time: string | null | undefined): string => {
                  if (!time) return '09:00';
                  const parts = time.split(':');
                  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : time;
                };
                
                const serviceIds = (block.metadata?.service_ids as string[]) || [];
                
                newSchedules[dayIndex] = {
                  dayOfWeek,
                  startTime: parseTime(block.start_time),
                  endTime: parseTime(block.end_time),
                  enabled: true,
                  serviceIds,
                };
              }
            });
            
            setSchedules(newSchedules);
          }
        } catch (blockErr) {
          console.warn('[RecurringScheduleEditModal] Error loading blocks:', blockErr);
        }
      }
    } catch (err) {
      console.warn('[RecurringScheduleEditModal] Error loading schedule:', err);
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
              `${DAYS[daySchedule.dayOfWeek].label}: Schedule overlaps with another schedule on the same day`
            );
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

      // Create recurring schedule blocks for each enabled day
      for (const daySchedule of enabledSchedules) {
        const formatTime = (time: string): string => {
          if (time.includes(':')) {
            const parts = time.split(':');
            return parts.length === 2 ? `${time}:00` : time;
          }
          return time;
        };
        
        const hapioWeekday = daySchedule.dayOfWeek === 0 ? 7 : daySchedule.dayOfWeek;
        
        const blockPayload = {
          recurring_schedule_id: recurringScheduleId,
          weekday: hapioWeekday,
          start_time: formatTime(daySchedule.startTime),
          end_time: formatTime(daySchedule.endTime),
          metadata: {
            service_ids: daySchedule.serviceIds,
          },
        };

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

        <div className="p-4 space-y-4">
          {error && <ErrorDisplay error={error} />}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-sm text-green-700">
              Schedule saved successfully!
            </div>
          )}

          {/* Date Range Selector */}
          <div className="bg-white border border-sand rounded-lg p-4">
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

          {/* 7-Day Grid */}
          <div className="bg-white border border-sand rounded-lg p-4">
            <h3 className="text-base font-semibold text-charcoal mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Weekly Schedule
            </h3>
            <div className="space-y-2">
              {schedules.map((schedule, index) => {
                const day = DAYS[index];
                return (
                  <div
                    key={day.value}
                    className="border border-sand rounded-lg p-2.5 hover:bg-sand/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <input
                          type="checkbox"
                          id={`day-${day.value}`}
                          checked={schedule.enabled}
                          onChange={() => handleToggleEnabled(index)}
                          className="w-4 h-4 text-dark-sage border-sand rounded focus:ring-dark-sage"
                        />
                        <label
                          htmlFor={`day-${day.value}`}
                          className="text-sm font-medium text-charcoal cursor-pointer"
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
                              className="px-2.5 py-1.5 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                            />
                            <span className="text-xs text-warm-gray">to</span>
                            <input
                              type="time"
                              value={schedule.endTime}
                              onChange={(e) => handleTimeChange(index, 'endTime', e.target.value)}
                              className="px-2.5 py-1.5 border border-sand rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dark-sage"
                            />
                          </div>

                          <button
                            onClick={() => setShowServiceModal(index)}
                            className="px-2.5 py-1.5 text-xs border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors whitespace-nowrap"
                          >
                            {schedule.serviceIds.length > 0
                              ? `${schedule.serviceIds.length} service${schedule.serviceIds.length !== 1 ? 's' : ''}`
                              : 'Select services'}
                          </button>
                        </>
                      )}
                    </div>

                    {schedule.enabled && (
                      <div className="mt-2 pt-2 border-t border-sand">
                        <label className="text-xs text-warm-gray mb-1 block">
                          Apply this schedule to other days:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
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
                              className="ml-1.5 px-2 py-0.5 text-xs bg-dark-sage text-charcoal rounded hover:bg-dark-sage/80 transition-colors"
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
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-sand text-charcoal rounded-lg hover:bg-sand/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !startDate}
              className="flex items-center gap-2 px-6 py-3 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Schedule'}
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
      </div>
    </div>
  );
}

