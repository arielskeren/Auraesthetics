'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Trash2, Edit2, Plus } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import ServiceSelectionModal from './ServiceSelectionModal';
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
  const [availability, setAvailability] = useState<Record<string, Array<{ start: string; end: string }>>>({});
  const [recurringBlocks, setRecurringBlocks] = useState<Record<string, Array<{ start: string; end: string; isAllDay: boolean }>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState({
    startTime: '00:00',
    endTime: '23:59',
    blockType: 'closed' as 'closed' | 'open',
    serviceIds: [] as string[],
  });

  useEffect(() => {
    loadBlocks();
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, currentDate]);

  useEffect(() => {
    if (selectedDate && !editingBlock && !isAddingNew) {
      // Reset form when date changes and not editing/adding
      setFormData({
        startTime: '00:00',
        endTime: '23:59',
        blockType: 'closed',
        serviceIds: [],
      });
    }
  }, [selectedDate, editingBlock, isAddingNew]);

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

  const loadAvailability = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const fromDate = new Date(year, month, 1);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(year, month + 1, 0);
      toDate.setHours(23, 59, 59, 999);
      
      const from = formatDateForHapioUTC(fromDate);
      const to = formatDateForHapioUTC(toDate);

      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );

      if (response.ok) {
        const data = await response.json();
        console.log('[ScheduleBlocksCalendar] Availability data:', {
          dates: Object.keys(data.availabilityByDate || {}).length,
          recurringBlocksDates: Object.keys(data.recurringBlocksByDate || {}).length,
          sample: Object.entries(data.availabilityByDate || {}).slice(0, 3),
        });
        setAvailability(data.availabilityByDate || {});
        setRecurringBlocks(data.recurringBlocksByDate || {});
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[ScheduleBlocksCalendar] Availability API error:', response.status, errorData);
      }
      // Silently fail if availability can't be loaded - it's not critical
    } catch (err: any) {
      // Silently fail - availability is optional
      console.warn('[ScheduleBlocksCalendar] Failed to load availability:', err);
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
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

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
    const start = new Date(block.starts_at);
    const end = new Date(block.ends_at);
    const isAllDay = start.getHours() === 0 && start.getMinutes() === 0 &&
                     end.getHours() === 23 && end.getMinutes() === 59;
    return isAllDay ? 'closed' : 'open';
  };

  const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const handleDateClick = (date: Date) => {
    if (isPastDate(date)) return;
    setSelectedDate(date);
  };

  const handleSave = async () => {
    if (!selectedDate || !locationId) {
      setError(new Error('Date and location are required'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dateStr = selectedDate.toISOString().split('T')[0];
      const startDateTime = new Date(`${dateStr}T${formData.startTime}:00`);
      const endDateTime = new Date(`${dateStr}T${formData.endTime}:00`);

      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const startsAtFormatted = formatDateForHapioUTC(startDateTime);
      const endsAtFormatted = formatDateForHapioUTC(endDateTime);

      const payload: any = {
        location_id: locationId,
        starts_at: startsAtFormatted,
        ends_at: endsAtFormatted,
        metadata: {},
      };

      if (formData.blockType === 'open' && formData.serviceIds.length > 0) {
        payload.metadata.service_ids = formData.serviceIds;
      }

      const url = editingBlock
        ? `/api/admin/hapio/resources/${resourceId}/schedule-blocks/${editingBlock.id}`
        : `/api/admin/hapio/resources/${resourceId}/schedule-blocks`;
      const method = editingBlock ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${editingBlock ? 'update' : 'create'} schedule block`);
      }

      await loadBlocks();
      setEditingBlock(null);
      setIsAddingNew(false);
      setFormData({
        startTime: '00:00',
        endTime: '23:59',
        blockType: 'closed',
        serviceIds: [],
      });
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (blockId: string) => {
    if (!confirm('Are you sure you want to delete this schedule block?')) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/schedule-blocks/${blockId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule block');
      }

      await loadBlocks();
      if (editingBlock?.id === blockId) {
        setEditingBlock(null);
        setIsAddingNew(false);
        setFormData({
          startTime: '00:00',
          endTime: '23:59',
          blockType: 'closed',
          serviceIds: [],
        });
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
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

  if (loading && blocks.length === 0) {
    return <div className="text-center py-8 text-warm-gray">Loading calendar...</div>;
  }

  const selectedDateBlocks = selectedDate ? getBlocksForDate(selectedDate) : [];

  return (
    <div className="space-y-6">

      {error && <ErrorDisplay error={error} />}

      <div className={`flex gap-6 transition-all duration-300 ${selectedDate ? 'items-start' : 'items-center justify-center'}`}>
        {/* Calendar - Smaller and Centered */}
        <div className={`bg-white border border-sand rounded-lg p-4 transition-all duration-300 ${selectedDate ? 'w-[420px] flex-shrink-0' : 'w-[420px]'}`}>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={handlePreviousMonth}
              className="p-1.5 hover:bg-sand/20 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-base font-semibold text-charcoal">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-sand/20 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar Grid - Smaller tiles */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day Headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-charcoal py-1"
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
              const isPast = isPastDate(date);
              const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
              const dateStr = date.toISOString().split('T')[0];
              const availableTimeRanges = availability[dateStr] || [];
              const hasAvailability = availableTimeRanges.length > 0;
              const recurringBlocksForDate = recurringBlocks[dateStr] || [];

              // Determine block type: recurring blocks take precedence, then one-off blocks
              let blockType: 'closed' | 'open' | null = null;
              
              // Check recurring blocks first (they override availability)
              if (recurringBlocksForDate.length > 0) {
                const allDayRecurring = recurringBlocksForDate.some((b) => b.isAllDay);
                blockType = allDayRecurring ? 'closed' : 'open';
              } else if (dateBlocks.length > 0) {
                // Fall back to one-off blocks
                blockType = getBlockType(dateBlocks[0]);
              } else if (!hasAvailability) {
                // If no availability and no blocks, the day is unavailable (not on any recurring schedule)
                blockType = 'closed';
              }

              // Format available times for display (e.g., "9:00 AM - 5:00 PM")
              const formatTime = (timeStr: string) => {
                const [hours, minutes] = timeStr.split(':');
                const hour = parseInt(hours, 10);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                return `${displayHour}:${minutes} ${ampm}`;
              };

              // Build tooltip content
              const buildTooltipContent = () => {
                // Check if there are recurring blocks
                const hasRecurringBlocks = recurringBlocksForDate.length > 0;
                const allDayRecurring = recurringBlocksForDate.some((b) => b.isAllDay);
                
                // If no availability and no blocks, show as unavailable
                if (!hasAvailability && !hasRecurringBlocks && dateBlocks.length === 0) {
                  return 'Unavailable (Not on schedule)';
                }
                
                // If fully blocked (all day) by recurring block, just show "Closed"
                if (allDayRecurring) {
                  return 'Closed (Recurring)';
                }

                // If partially blocked by recurring blocks, show availability + recurring blocks
                if (hasRecurringBlocks && !allDayRecurring) {
                  const parts: string[] = [];
                  
                  // Add full availability if available (from recurring schedules)
                  if (hasAvailability) {
                    const availabilityText = availableTimeRanges
                      .map((range) => `${formatTime(range.start)} - ${formatTime(range.end)}`)
                      .join(', ');
                    parts.push(availabilityText);
                  }
                  
                  // Then show recurring blocks section
                  parts.push('Recurring Blocks:');
                  recurringBlocksForDate.forEach((block) => {
                    parts.push(`${formatTime(block.start)} - ${formatTime(block.end)}`);
                  });

                  return parts.length > 0 ? parts : null;
                }

                // If partially blocked by one-off blocks, show availability + blocks
                if (blockType === 'open' && dateBlocks.length > 0) {
                  const partialBlocks = dateBlocks.map((block) => {
                    const start = new Date(block.starts_at);
                    const end = new Date(block.ends_at);
                    const startTime = start.toTimeString().slice(0, 5);
                    const endTime = end.toTimeString().slice(0, 5);
                    return { startTime, endTime };
                  });

                  const parts: string[] = [];
                  
                  // Always show full availability first (from recurring schedules)
                  if (hasAvailability) {
                    const availabilityText = availableTimeRanges
                      .map((range) => `${formatTime(range.start)} - ${formatTime(range.end)}`)
                      .join(', ');
                    parts.push(availabilityText);
                  }
                  
                  // Then show blocks section
                  if (partialBlocks.length > 0) {
                    parts.push('Blocks:');
                    partialBlocks.forEach((block) => {
                      parts.push(`${formatTime(block.startTime)} - ${formatTime(block.endTime)}`);
                    });
                  }

                  return parts.length > 0 ? parts : null;
                }

                // If no blocks, just show availability
                if (hasAvailability) {
                  return availableTimeRanges
                    .map((range) => `${formatTime(range.start)} - ${formatTime(range.end)}`)
                    .join(', ');
                }

                return null;
              };

              const tooltipContent = buildTooltipContent();
              // Show tooltip if there's content, blocks, or if the day is unavailable
              const showTooltip = hoveredDate && hoveredDate.toDateString() === date.toDateString() && !isPast && (tooltipContent || dateBlocks.length > 0 || !hasAvailability);

              return (
                <div
                  key={date.toISOString()}
                  className="relative"
                  onMouseEnter={() => !isPast && setHoveredDate(date)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  <button
                    onClick={() => handleDateClick(date)}
                    disabled={isPast}
                    className={`aspect-square border rounded-lg text-xs transition-colors w-full ${
                      isPast
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : isSelected
                        ? 'ring-2 ring-dark-sage ring-offset-1'
                        : 'hover:bg-sand/20 cursor-pointer'
                    } ${
                      isPast
                        ? '' // Don't apply any block/availability colors to past dates - keep them gray
                        : blockType === 'closed'
                        ? 'bg-red-100 border-red-300 text-red-900'
                        : blockType === 'open'
                        ? 'bg-yellow-100 border-yellow-300 text-yellow-900'
                        : hasAvailability
                        ? 'bg-green-50 border-green-300 text-green-900'
                        : 'bg-red-100 border-red-300 text-red-900' // No availability = unavailable (red)
                    }`}
                  >
                    <div className="text-center font-medium">{date.getDate()}</div>
                    {/* Show indicator for recurring blocks */}
                    {recurringBlocksForDate.length > 0 && (
                      <div className="absolute top-0.5 right-0.5">
                        <div className={`w-2 h-2 rounded-full ${
                          recurringBlocksForDate.some((b) => b.isAllDay)
                            ? 'bg-red-600'
                            : 'bg-yellow-600'
                        }`} />
                      </div>
                    )}
                    {hasAvailability && !blockType && (
                      <div className="absolute bottom-0.5 left-0 right-0 flex justify-center">
                        <div className="w-1 h-1 bg-green-600 rounded-full" />
                      </div>
                    )}
                  </button>
                  
                  {/* Hover Tooltip */}
                  {showTooltip && (
                    <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-64">
                      <div className="bg-white border border-sand rounded-lg shadow-xl overflow-hidden">
                        {/* Tooltip Header */}
                        <div className="bg-sage-light/30 px-3 py-2 border-b border-sand">
                          <div className="text-xs font-semibold text-charcoal">
                            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                        
                        {/* Tooltip Content */}
                        <div className="px-3 py-2.5">
                          {tooltipContent ? (
                            typeof tooltipContent === 'string' ? (
                              <div className="text-sm text-charcoal">
                                {tooltipContent.includes('Unavailable') ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                                    <span className="text-red-700 font-medium">{tooltipContent}</span>
                                  </div>
                                ) : tooltipContent.includes('Closed') ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                                    <span className="text-red-700 font-medium">{tooltipContent}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                    <span className="text-charcoal">{tooltipContent}</span>
                                  </div>
                                )}
                              </div>
                            ) : Array.isArray(tooltipContent) ? (
                              <div className="space-y-2.5">
                                {tooltipContent.map((line, idx) => {
                                  // Check if this is a header line
                                  if (line === 'Blocks:' || line === 'Recurring Blocks:') {
                                    return (
                                      <div key={idx} className="pt-2 border-t border-sand">
                                        <div className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-1.5">
                                          {line}
                                        </div>
                                      </div>
                                    );
                                  }
                                  // Check if this is availability (first item before any "Blocks:" header)
                                  const isAvailability = idx === 0 || !tooltipContent.slice(0, idx).includes('Blocks:') && !tooltipContent.slice(0, idx).includes('Recurring Blocks:');
                                  return (
                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                      {isAvailability ? (
                                        <>
                                          <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                                          <span className="text-charcoal font-medium">{line}</span>
                                        </>
                                      ) : (
                                        <>
                                          <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" />
                                          <span className="text-charcoal">{line}</span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null
                          ) : dateBlocks.length > 0 && blockType === 'open' ? (
                            // Fallback: show blocks even if no availability
                            <div className="space-y-2.5">
                              <div className="pt-2 border-t border-sand">
                                <div className="text-xs font-semibold text-warm-gray uppercase tracking-wide mb-1.5">
                                  Blocks:
                                </div>
                              </div>
                              {dateBlocks.map((block) => {
                                const start = new Date(block.starts_at);
                                const end = new Date(block.ends_at);
                                const startTime = start.toTimeString().slice(0, 5);
                                const endTime = end.toTimeString().slice(0, 5);
                                return (
                                  <div key={block.id} className="flex items-center gap-2 text-sm">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" />
                                    <span className="text-charcoal">
                                      {formatTime(startTime)} - {formatTime(endTime)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {/* Tooltip Arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                        <div className="w-3 h-3 bg-white border-r border-b border-sand transform rotate-45" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-green-50 border border-green-300 rounded" />
              <span className="text-warm-gray">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
              <span className="text-warm-gray">Closed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded" />
              <span className="text-warm-gray">Special hours</span>
            </div>
          </div>
        </div>

        {/* Right Side Panel - Shows blocks for selected day */}
        {selectedDate && (
          <div className="flex-1 bg-white border border-sand rounded-lg p-4 min-w-[380px] max-w-[450px] max-h-[600px] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-charcoal">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </h3>
              <button
                onClick={() => {
                  setSelectedDate(null);
                  setEditingBlock(null);
                  setIsAddingNew(false);
                }}
                className="p-1 hover:bg-sand/20 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {selectedDateBlocks.map((block) => {
                const start = new Date(block.starts_at);
                const end = new Date(block.ends_at);
                const startTime = start.toTimeString().slice(0, 5);
                const endTime = end.toTimeString().slice(0, 5);
                const isAllDay = startTime === '00:00' && endTime === '23:59';
                const serviceIds = (block.metadata?.service_ids as string[]) || [];
                const isEditing = editingBlock?.id === block.id;

                return (
                  <div
                    key={block.id}
                    className={`border rounded-lg p-2.5 ${
                      isAllDay
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    {!isEditing ? (
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-charcoal">
                            {isAllDay ? 'Closed (all day)' : `${startTime} - ${endTime}`}
                          </div>
                          {serviceIds.length > 0 && (
                            <div className="text-xs text-warm-gray mt-0.5">
                              {serviceIds.length} service{serviceIds.length !== 1 ? 's' : ''} blocked
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => {
                              setEditingBlock(block);
                              setIsAddingNew(false);
                              setFormData({
                                startTime,
                                endTime,
                                blockType: isAllDay ? 'closed' : 'open',
                                serviceIds,
                              });
                            }}
                            className="p-1 hover:bg-white/50 rounded transition-colors"
                            disabled={loading}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(block.id)}
                            className="p-1 hover:bg-white/50 rounded transition-colors text-red-600"
                            disabled={loading}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">

                        <div>
                          <label className="block text-xs font-medium text-charcoal mb-1">
                            Block Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.blockType}
                            onChange={(e) =>
                              setFormData({ ...formData, blockType: e.target.value as 'closed' | 'open' })
                            }
                            className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                          >
                            <option value="closed">Block entire day</option>
                            <option value="open">Block specific hours</option>
                          </select>
                        </div>

                        {formData.blockType === 'open' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-charcoal mb-1">
                                Start <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="time"
                                value={formData.startTime}
                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-charcoal mb-1">
                                End <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="time"
                                value={formData.endTime}
                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                              />
                            </div>
                          </div>
                        )}

                        {formData.blockType === 'open' && (
                          <div>
                            <label className="block text-xs font-medium text-charcoal mb-1">
                              Block Services
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowServiceModal(true)}
                              className="w-full px-2 py-1.5 border border-sand rounded text-xs text-left hover:bg-sand/20 transition-colors"
                            >
                              {formData.serviceIds.length > 0
                                ? `${formData.serviceIds.length} service${formData.serviceIds.length !== 1 ? 's' : ''} blocked`
                                : 'All services blocked (click to block specific services only)'}
                            </button>
                            <p className="text-xs text-warm-gray mt-0.5">
                              Leave unselected to block all services during these hours.
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 px-3 py-1.5 bg-dark-sage text-charcoal rounded text-xs hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingBlock(null);
                              setIsAddingNew(false);
                            }}
                            className="px-3 py-1.5 text-xs border border-sand text-charcoal rounded hover:bg-sand/20 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add New Block Button */}
              {!isAddingNew && (
                <button
                  onClick={() => {
                    setIsAddingNew(true);
                    setEditingBlock(null);
                    setFormData({
                      startTime: '00:00',
                      endTime: '23:59',
                      blockType: 'closed',
                      serviceIds: [],
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-sand rounded-lg text-sm text-warm-gray hover:border-dark-sage hover:text-charcoal transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Block
                </button>
              )}

              {/* New Block Form */}
              {isAddingNew && (
                <div className="border-2 border-dashed border-dark-sage rounded-lg p-2.5 bg-sage-light/20">
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-medium text-charcoal mb-1">
                        Block Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.blockType}
                        onChange={(e) =>
                          setFormData({ ...formData, blockType: e.target.value as 'closed' | 'open' })
                        }
                        className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                      >
                        <option value="closed">Block entire day</option>
                        <option value="open">Block specific hours</option>
                      </select>
                    </div>

                    {formData.blockType === 'open' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-charcoal mb-1">
                            Start <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-charcoal mb-1">
                            End <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full px-2 py-1.5 border border-sand rounded text-xs focus:outline-none focus:ring-1 focus:ring-dark-sage"
                          />
                        </div>
                      </div>
                    )}

                    {formData.blockType === 'open' && (
                      <div>
                        <label className="block text-xs font-medium text-charcoal mb-1">
                          Block Services
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowServiceModal(true)}
                          className="w-full px-2 py-1.5 border border-sand rounded text-xs text-left hover:bg-sand/20 transition-colors"
                        >
                          {formData.serviceIds.length > 0
                            ? `${formData.serviceIds.length} service${formData.serviceIds.length !== 1 ? 's' : ''} blocked`
                            : 'All services blocked (click to block specific services only)'}
                        </button>
                        <p className="text-xs text-warm-gray mt-0.5">
                          Leave unselected to block all services during these hours.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleSave}
                        disabled={loading || !locationId}
                        className="flex-1 px-3 py-1.5 bg-dark-sage text-charcoal rounded text-xs hover:bg-dark-sage/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {loading ? 'Creating...' : 'Create Block'}
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingNew(false);
                          setFormData({
                            startTime: '00:00',
                            endTime: '23:59',
                            blockType: 'closed',
                            serviceIds: [],
                          });
                        }}
                        className="px-3 py-1.5 text-xs border border-sand text-charcoal rounded hover:bg-sand/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Service Selection Modal */}
      {showServiceModal && (
        <ServiceSelectionModal
          selectedServiceIds={formData.serviceIds}
          onClose={() => setShowServiceModal(false)}
          onSave={(serviceIds) => {
            setFormData({ ...formData, serviceIds });
            setShowServiceModal(false);
          }}
        />
      )}
    </div>
  );
}
