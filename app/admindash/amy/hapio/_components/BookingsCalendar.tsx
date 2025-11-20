'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import BookingDetailModal from '../../BookingDetailModal';
import { formatDateForHapioUTC } from '@/lib/hapioDateUtils';
import { useHapioData } from '../_contexts/HapioDataContext';

interface Booking {
  id: string;
  startsAt: string;
  endsAt: string;
  isCanceled: boolean;
  isTemporary: boolean;
  resourceId?: string | null;
  serviceId?: string;
  locationId?: string;
  resource?: { id: string; name: string };
  service?: { id: string; name: string };
  location?: { id: string; name: string };
  customer?: { name?: string; email?: string; phone?: string };
  metadata?: Record<string, unknown> | null;
}

interface DayStatus {
  date: Date;
  status: 'open' | 'partial' | 'closed';
  bookings: Booking[];
  totalSlots?: number;
  bookedSlots?: number;
}

export default function BookingsCalendar() {
  const {
    services,
    resources,
    locations,
    loadServices,
    loadResources,
    loadLocations,
    getBookings,
    getAvailability,
    getScheduleBlocks,
    isLoadingBookings,
    isLoadingAvailability,
    isLoadingScheduleBlocks,
  } = useHapioData();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<Record<string, Array<{ start: string; end: string }>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; bottom: number } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const dateButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [allScheduleBlocks, setAllScheduleBlocks] = useState<Array<{ starts_at: string; ends_at: string; metadata?: Record<string, unknown> | null }>>([]);

  // Don't call loadServices/loadResources/loadLocations - they're auto-loaded by context
  // Just wait for the data to be available

  // Set first location and resource when data is loaded (only once, using ref to prevent re-triggers)
  const hasSetIdsRef = useRef(false);
  useEffect(() => {
    // Only set IDs once when data becomes available
    if (!hasSetIdsRef.current && locations.length > 0 && Object.keys(resources).length > 0) {
      if (!locationId) {
        setLocationId(locations[0].id);
      }
      if (!resourceId) {
        const firstResourceId = Object.keys(resources)[0];
        setResourceId(firstResourceId);
      }
      hasSetIdsRef.current = true;
    }
  }, [locations, resources, locationId, resourceId]);

  // Load bookings, availability, and schedule blocks when resource/location/date changes
  // Use a ref to prevent duplicate calls - only load once per unique combination
  const hasLoadedRef = useRef<string>('');
  const isLoadingRef = useRef(false);
  
  useEffect(() => {
    // Only proceed if we have both resourceId and locationId, and we're not already loading
    if (resourceId && locationId && !isLoadingRef.current) {
      const loadKey = `${resourceId}-${locationId}-${currentDate.getMonth()}-${currentDate.getFullYear()}`;
      // Only load if this is a new combination
      if (hasLoadedRef.current !== loadKey) {
        hasLoadedRef.current = loadKey;
        isLoadingRef.current = true;
        
        // Call all three in parallel - context will handle deduplication
        Promise.all([
          loadBookings(),
          loadAvailability(),
          loadScheduleBlocksForMonth(),
        ]).catch(err => {
          console.error('[BookingsCalendar] Error loading data:', err);
        }).finally(() => {
          isLoadingRef.current = false;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, locationId, currentDate]);


  const loadBookings = async () => {
    if (!resourceId || !locationId) return;
    
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

      const activeBookings = await getBookings({
        from,
        to,
        resourceId: resourceId,
        locationId: locationId,
      });
      setBookings(activeBookings);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async () => {
    if (!resourceId || !locationId) return;

    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const fromDate = new Date(year, month, 1);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(year, month + 1, 0);
      toDate.setHours(23, 59, 59, 999);

      const from = formatDateForHapioUTC(fromDate);
      const to = formatDateForHapioUTC(toDate);

      const availabilityData = await getAvailability(resourceId, from, to);
      setAvailability(availabilityData);
    } catch (err) {
      console.warn('[BookingsCalendar] Error loading availability:', err);
    }
  };

  const loadScheduleBlocksForMonth = async () => {
    if (!resourceId || !locationId) return;

    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const fromDate = new Date(year, month, 1);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(year, month + 1, 0);
      toDate.setHours(23, 59, 59, 999);

      const from = formatDateForHapioUTC(fromDate);
      const to = formatDateForHapioUTC(toDate);

      const blocks = await getScheduleBlocks(resourceId, from, to);
      setAllScheduleBlocks(blocks);
    } catch (err) {
      console.warn('[BookingsCalendar] Error loading schedule blocks:', err);
      setAllScheduleBlocks([]);
    }
  };

  // Filter schedule blocks for selected date
  const scheduleBlocks = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split('T')[0];
    return allScheduleBlocks.filter((block) => {
      const blockDate = new Date(block.starts_at).toISOString().split('T')[0];
      return blockDate === dateStr;
    });
  }, [selectedDate, allScheduleBlocks]);

  const getDaysInMonth = (): (Date | null)[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const getBookingsForDate = (date: Date): Booking[] => {
    const dateStr = date.toISOString().split('T')[0];
    return bookings.filter((booking) => {
      const bookingDate = new Date(booking.startsAt).toISOString().split('T')[0];
      return bookingDate === dateStr;
    });
  };

  const calculateDayStatus = (date: Date): DayStatus['status'] => {
    const dateStr = date.toISOString().split('T')[0];
    const dayBookings = getBookingsForDate(date);
    const availableTimeRanges = availability[dateStr] || [];

    // If no availability, day is closed
    if (availableTimeRanges.length === 0) {
      return 'closed';
    }

    // Calculate total available minutes
    let totalAvailableMinutes = 0;
    for (const range of availableTimeRanges) {
      const start = new Date(`${dateStr}T${range.start}`);
      const end = new Date(`${dateStr}T${range.end}`);
      totalAvailableMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
    }

    // Calculate booked minutes
    let bookedMinutes = 0;
    for (const booking of dayBookings) {
      const start = new Date(booking.startsAt);
      const end = new Date(booking.endsAt);
      bookedMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
    }

    // If no bookings, day is open
    if (dayBookings.length === 0) {
      return 'open';
    }

    // If fully booked (booked >= 90% of available), day is closed
    if (bookedMinutes >= totalAvailableMinutes * 0.9) {
      return 'closed';
    }

    // Otherwise, partially booked
    return 'partial';
  };

  const getUpcomingBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcoming = bookings.filter((booking) => {
      const bookingDate = new Date(booking.startsAt);
      return bookingDate >= today;
    });

    // Group by EST date (not UTC) to match calendar display
    const grouped: Record<string, Booking[]> = {};
    for (const booking of upcoming) {
      // Convert to EST date string for grouping
      const bookingDate = new Date(booking.startsAt);
      const estDateStr = bookingDate.toLocaleDateString('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      if (!grouped[estDateStr]) {
        grouped[estDateStr] = [];
      }
      grouped[estDateStr].push(booking);
    }

    // Sort dates
    const sortedDates = Object.keys(grouped).sort();
    
    return sortedDates.map((dateStr) => {
      // Parse EST date string (YYYY-MM-DD) and create a date object
      // We need to create a date that represents midnight EST on that date
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date in local timezone, then adjust for EST display
      const dateForStatus = new Date(year, month - 1, day);
      // For display, create a date that when formatted in EST will show the correct day
      // Use a date string that represents the date in EST
      const estDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
      const displayDate = new Date(estDateString + '-05:00'); // EST is UTC-5
      
      return {
        date: displayDate,
        bookings: grouped[dateStr].sort((a, b) => 
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        ),
        status: calculateDayStatus(dateForStatus),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, availability]);

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  if ((loading || isLoadingBookings) && bookings.length === 0) {
    return <div className="text-center py-8 text-warm-gray">Loading calendar...</div>;
  }

  const selectedDayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];
  const selectedDayStatus = selectedDate ? calculateDayStatus(selectedDate) : null;
  const selectedDayAvailability = selectedDate ? availability[selectedDate.toISOString().split('T')[0]] || [] : [];

  return (
    <div className="space-y-4 md:space-y-6">
      {error && <ErrorDisplay error={error} />}

      <div className={`flex flex-col md:flex-row gap-4 md:gap-6 transition-all duration-300 ${selectedDate ? 'md:items-start' : 'md:items-center md:justify-center'}`}>
        {/* Calendar */}
        <div className={`bg-white border border-sand rounded-lg p-3 md:p-4 transition-all duration-300 ${selectedDate ? 'md:w-[420px] md:flex-shrink-0' : 'md:w-[420px]'} w-full relative`}>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <button
              onClick={handlePreviousMonth}
              className="p-2 md:p-1.5 hover:bg-sand/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 md:w-4 md:h-4" />
            </button>
            <h3 className="text-sm md:text-base font-semibold text-charcoal">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <button
              onClick={handleNextMonth}
              className="p-2 md:p-1.5 hover:bg-sand/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5 md:w-4 md:h-4" />
            </button>
          </div>

          {/* Calendar Grid */}
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

              const isPast = isPastDate(date);
              const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
              const status = calculateDayStatus(date);
              const dateBookings = getBookingsForDate(date);

              return (
                <div
                  key={date.toISOString()}
                  className="relative"
                  onMouseEnter={() => {
                    if (!isPast) {
                      setHoveredDate(date);
                      const button = dateButtonRefs.current[date.toISOString()];
                      if (button) {
                        const rect = button.getBoundingClientRect();
                        setTooltipPosition({
                          left: rect.left + rect.width / 2,
                          bottom: window.innerHeight - rect.top + 12,
                        });
                      }
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredDate(null);
                    setTooltipPosition(null);
                  }}
                >
                  <button
                    ref={(el) => {
                      dateButtonRefs.current[date.toISOString()] = el;
                    }}
                    onClick={() => setSelectedDate(isSelected ? null : date)}
                    disabled={isPast}
                    className={`aspect-square border rounded-lg text-xs md:text-sm transition-colors w-full min-h-[44px] md:min-h-0 ${
                      isPast
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : isSelected
                        ? 'ring-2 ring-dark-sage ring-offset-1'
                        : 'hover:bg-sand/20 cursor-pointer active:bg-sand/30'
                    } ${
                      isPast
                        ? ''
                        : status === 'closed'
                        ? 'bg-red-100 border-red-300 text-red-900'
                        : status === 'partial'
                        ? 'bg-yellow-100 border-yellow-300 text-yellow-900'
                        : 'bg-green-50 border-green-300 text-green-900'
                    }`}
                  >
                    <div className="text-center font-medium">{date.getDate()}</div>
                  </button>

                  {/* Tooltip */}
                  {hoveredDate && hoveredDate.toDateString() === date.toDateString() && !isPast && tooltipPosition && (
                    <div 
                      className="fixed z-[9999] pointer-events-none"
                      style={{
                        left: `${tooltipPosition.left}px`,
                        bottom: `${tooltipPosition.bottom}px`,
                        transform: 'translate(-50%, 0)',
                      }}
                    >
                      <div className="bg-white border border-sand rounded-lg shadow-xl overflow-hidden w-64">
                          <div className="bg-sage-light/30 px-3 py-2 border-b border-sand">
                            <div className="text-xs font-semibold text-charcoal">
                              {formatDate(date)}
                            </div>
                          </div>
                          <div className="px-3 py-2.5">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${
                                status === 'closed' ? 'bg-red-500' :
                                status === 'partial' ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`} />
                              <span className="text-sm font-medium text-charcoal">
                                {status === 'closed' ? 'Closed' :
                                 status === 'partial' ? 'Partially Booked' :
                                 'Open'}
                              </span>
                            </div>
                            {dateBookings.length > 0 && (
                              <div className="text-xs text-warm-gray">
                                {dateBookings.length} appointment{dateBookings.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                            <div className="w-3 h-3 bg-white border-r border-b border-sand transform rotate-45" />
                          </div>
                        </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel */}
        {selectedDate ? (
          <div className="flex-1 bg-white border border-sand rounded-lg p-3 md:p-4 w-full md:w-auto">
            <div className="mb-3 md:mb-4">
              <h3 className="text-base md:text-lg font-semibold text-charcoal mb-1">{formatDate(selectedDate)}</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  selectedDayStatus === 'closed' ? 'bg-red-500' :
                  selectedDayStatus === 'partial' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`} />
                <span className="text-sm text-warm-gray">
                  {selectedDayStatus === 'closed' ? 'Closed' :
                   selectedDayStatus === 'partial' ? 'Partially Booked' :
                   'Open'}
                </span>
              </div>
            </div>

            {/* Timeline View */}
            {selectedDayAvailability.length > 0 ? (
              <div className="relative border border-sand rounded-lg overflow-hidden">
                {(() => {
                  // Get the earliest start and latest end from availability ranges
                  let earliestStart = 24;
                  let latestEnd = 0;
                  
                  selectedDayAvailability.forEach((range) => {
                    const startHour = parseInt(range.start.split(':')[0]);
                    const startMin = parseInt(range.start.split(':')[1]);
                    const endHour = parseInt(range.end.split(':')[0]);
                    const endMin = parseInt(range.end.split(':')[1]);
                    
                    const startDecimal = startHour + startMin / 60;
                    const endDecimal = endHour + endMin / 60;
                    
                    if (startDecimal < earliestStart) earliestStart = startDecimal;
                    if (endDecimal > latestEnd) latestEnd = endDecimal;
                  });

                  // Round to nearest hour for display
                  const startHour = Math.floor(earliestStart);
                  const endHour = Math.ceil(latestEnd);
                  const totalHours = latestEnd - earliestStart;
                  const timelineHeight = Math.max(400, totalHours * 60); // 60px per hour, minimum 400px

                  return (
                    <div style={{ height: `${timelineHeight}px`, position: 'relative' }}>
                      {/* Time labels on the left */}
                      <div className="absolute left-0 top-0 bottom-0 w-16 border-r border-sand bg-sage-light/10">
                        {Array.from({ length: endHour - startHour + 1 }, (_, i) => {
                          const hour = startHour + i;
                          const hourTime = new Date(selectedDate);
                          hourTime.setHours(hour, 0, 0, 0);
                          const position = ((hour - earliestStart) / totalHours) * 100;
                          
                          return (
                            <div
                              key={hour}
                              className="absolute left-0 right-0 border-t border-sand/30"
                              style={{ top: `${position}%` }}
                            >
                              <div className="absolute left-2 top-0 text-xs text-warm-gray font-medium pt-1 whitespace-nowrap">
                                {hourTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Booking blocks and schedule blocks */}
                      <div className="ml-16 relative h-full">
                        {/* Schedule Blocks (Breaks) */}
                        {scheduleBlocks.map((block) => {
                          const start = new Date(block.starts_at);
                          const end = new Date(block.ends_at);
                          
                          // Find which availability range this block falls in
                          let range = selectedDayAvailability.find((r) => {
                            const rangeStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${r.start}`);
                            const rangeEnd = new Date(`${selectedDate.toISOString().split('T')[0]}T${r.end}`);
                            return start >= rangeStart && end <= rangeEnd;
                          });

                          if (!range) {
                            range = selectedDayAvailability.find((r) => {
                              const rangeStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${r.start}`);
                              const rangeEnd = new Date(`${selectedDate.toISOString().split('T')[0]}T${r.end}`);
                              return start >= rangeStart && start < rangeEnd;
                            });
                          }

                          if (!range) return null;

                          // Calculate earliest start and latest end from all ranges
                          let earliestStart = 24;
                          let latestEnd = 0;
                          
                          selectedDayAvailability.forEach((r) => {
                            const startHour = parseInt(r.start.split(':')[0]);
                            const startMin = parseInt(r.start.split(':')[1]);
                            const endHour = parseInt(r.end.split(':')[0]);
                            const endMin = parseInt(r.end.split(':')[1]);
                            
                            const startDecimal = startHour + startMin / 60;
                            const endDecimal = endHour + endMin / 60;
                            
                            if (startDecimal < earliestStart) earliestStart = startDecimal;
                            if (endDecimal > latestEnd) latestEnd = endDecimal;
                          });

                          const totalDuration = latestEnd - earliestStart;
                          const blockStartDecimal = start.getHours() + start.getMinutes() / 60;
                          const blockEndDecimal = end.getHours() + end.getMinutes() / 60;
                          const blockDuration = blockEndDecimal - blockStartDecimal;
                          
                          const topPercent = ((blockStartDecimal - earliestStart) / totalDuration) * 100;
                          const heightPercent = (blockDuration / totalDuration) * 100;

                          return (
                            <div
                              key={`block-${block.starts_at}`}
                              className="absolute bg-yellow-200 border-2 border-yellow-400 rounded opacity-80"
                              style={{
                                top: `${topPercent}%`,
                                height: `${heightPercent}%`,
                                left: '0.5rem',
                                right: '0.5rem',
                              }}
                              title={`Break: ${formatTime(block.starts_at)} - ${formatTime(block.ends_at)}`}
                            >
                              <div className="text-xs font-medium text-yellow-900 p-1">
                                Break: {formatTime(block.starts_at)} - {formatTime(block.ends_at)}
                              </div>
                            </div>
                          );
                        })}

                        {/* Booking blocks */}
                        {selectedDayBookings.map((booking) => {
                          const start = new Date(booking.startsAt);
                          const end = new Date(booking.endsAt);
                          
                          // Find which availability range this booking falls in
                          let range = selectedDayAvailability.find((r) => {
                            const rangeStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${r.start}`);
                            const rangeEnd = new Date(`${selectedDate.toISOString().split('T')[0]}T${r.end}`);
                            return start >= rangeStart && end <= rangeEnd;
                          });

                          // If no exact match, find the first range that contains the start time
                          if (!range) {
                            range = selectedDayAvailability.find((r) => {
                              const rangeStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${r.start}`);
                              const rangeEnd = new Date(`${selectedDate.toISOString().split('T')[0]}T${r.end}`);
                              return start >= rangeStart && start < rangeEnd;
                            });
                          }

                          if (!range) return null;

                          // Calculate earliest start and latest end from all ranges
                          let earliestStart = 24;
                          let latestEnd = 0;
                          
                          selectedDayAvailability.forEach((r) => {
                            const startHour = parseInt(r.start.split(':')[0]);
                            const startMin = parseInt(r.start.split(':')[1]);
                            const endHour = parseInt(r.end.split(':')[0]);
                            const endMin = parseInt(r.end.split(':')[1]);
                            
                            const startDecimal = startHour + startMin / 60;
                            const endDecimal = endHour + endMin / 60;
                            
                            if (startDecimal < earliestStart) earliestStart = startDecimal;
                            if (endDecimal > latestEnd) latestEnd = endDecimal;
                          });

                          const totalDuration = latestEnd - earliestStart;
                          
                          const bookingStartDecimal = start.getHours() + start.getMinutes() / 60;
                          const bookingEndDecimal = end.getHours() + end.getMinutes() / 60;
                          const bookingDuration = bookingEndDecimal - bookingStartDecimal;
                    
                          const topPercent = ((bookingStartDecimal - earliestStart) / totalDuration) * 100;
                          const heightPercent = (bookingDuration / totalDuration) * 100;

                          return (
                            <div
                              key={booking.id}
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowDetailModal(true);
                              }}
                              className="absolute bg-dark-sage text-white rounded p-2 cursor-pointer hover:bg-dark-sage/80 transition-colors shadow-sm border border-sage-light"
                              style={{
                                top: `${topPercent}%`,
                                height: `${heightPercent}%`,
                                left: '0.5rem',
                                right: '0.5rem',
                              }}
                            >
                              <div className="text-xs font-medium">{formatTime(booking.startsAt)} - {formatTime(booking.endsAt)}</div>
                              <div className="text-xs font-semibold mt-0.5">
                                {booking.service?.name || (booking.serviceId && services[booking.serviceId]?.name) || 'Service'}
                              </div>
                              {(() => {
                                const customerName =
                                  booking.metadata?.customer_name ||
                                  booking.metadata?.customerName ||
                                  booking.customer?.name;
                                const phone =
                                  booking.customer?.phone ||
                                  booking.metadata?.customer_phone ||
                                  booking.metadata?.phone;
                                const hasNotes =
                                  !!booking.metadata?.notes ||
                                  !!booking.metadata?.customer_notes;
                                return (customerName || phone || hasNotes) ? (
                                  <div className="text-[11px] opacity-90 mt-0.5">
                                    {customerName ? String(customerName) : ''}
                                    {phone ? ` • ${String(phone)}` : ''}
                                    {hasNotes ? ' • has notes' : ''}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-warm-gray">
                {selectedDayStatus === 'closed' ? 'Day is closed' : 'No availability scheduled'}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 bg-white border border-sand rounded-lg p-4">
            <h3 className="text-lg font-semibold text-charcoal mb-4">Upcoming Appointments</h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {getUpcomingBookings.length === 0 ? (
                <div className="text-center py-8 text-warm-gray">No upcoming appointments</div>
              ) : (
                getUpcomingBookings.map((dayGroup) => (
                  <div key={dayGroup.date.toISOString()} className="border-b border-sand pb-4 last:border-b-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${
                        dayGroup.status === 'closed' ? 'bg-red-500' :
                        dayGroup.status === 'partial' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`} />
                      <h4 className="font-semibold text-charcoal">{formatDate(dayGroup.date)}</h4>
                      {dayGroup.status === 'closed' && (
                        <span className="text-xs text-red-600 font-medium">(Closed)</span>
                      )}
                    </div>
                    <div className="space-y-2 ml-4">
                      {dayGroup.bookings.map((booking) => (
                        <div
                          key={booking.id}
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowDetailModal(true);
                          }}
                          className="bg-sage-light/30 border border-sand rounded p-2 cursor-pointer hover:bg-sage-light/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-charcoal">
                                {formatTime(booking.startsAt)} - {formatTime(booking.endsAt)}
                              </div>
                              <div className="text-xs text-warm-gray">
                                {booking.service?.name || (booking.serviceId && services[booking.serviceId]?.name) || 'Service'}
                                {(() => {
                                  const customerName = booking.metadata?.customer_name || booking.metadata?.customerName;
                                  return customerName ? ` • ${String(customerName)}` : '';
                                })()}
                              </div>
                            </div>
                            <button className="p-1 hover:bg-sage-light rounded">
                              <Eye className="w-4 h-4 text-charcoal" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showDetailModal && selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedBooking(null);
            // refresh after closing
            loadBookings();
          }}
          onRefresh={() => {
            loadBookings();
          }}
        />
      )}
    </div>
  );
}

