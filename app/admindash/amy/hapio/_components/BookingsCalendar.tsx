'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import ErrorDisplay from './ErrorDisplay';
import BookingDetailModal from './BookingDetailModal';
import { formatDateForHapioUTC } from '@/lib/hapioDateUtils';

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<Record<string, Array<{ start: string; end: string }>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [services, setServices] = useState<Record<string, { id: string; name: string }>>({});
  const [resources, setResources] = useState<Record<string, { id: string; name: string }>>({});
  const [scheduleBlocks, setScheduleBlocks] = useState<Array<{ starts_at: string; ends_at: string; metadata?: Record<string, unknown> | null }>>([]);

  useEffect(() => {
    loadFirstResourceAndLocation();
  }, []);

  useEffect(() => {
    loadServices();
    loadResources();
  }, []);

  useEffect(() => {
    if (resourceId) {
      loadBookings();
      loadAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, locationId, currentDate]);

  useEffect(() => {
    if (selectedDate && resourceId) {
      loadScheduleBlocksForDate(selectedDate);
    } else {
      setScheduleBlocks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, resourceId]);

  const loadServices = async () => {
    try {
      const response = await fetch('/api/admin/hapio/services?per_page=100');
      if (response.ok) {
        const data = await response.json();
        const servicesMap: Record<string, { id: string; name: string }> = {};
        (data.data || []).forEach((service: any) => {
          servicesMap[service.id] = { id: service.id, name: service.name || 'Unknown Service' };
        });
        setServices(servicesMap);
      }
    } catch (err) {
      console.warn('[BookingsCalendar] Error loading services:', err);
    }
  };

  const loadResources = async () => {
    try {
      const response = await fetch('/api/admin/hapio/resources?per_page=100');
      if (response.ok) {
        const data = await response.json();
        const resourcesMap: Record<string, { id: string; name: string }> = {};
        (data.data || []).forEach((resource: any) => {
          resourcesMap[resource.id] = { id: resource.id, name: resource.name || 'Unknown Resource' };
        });
        setResources(resourcesMap);
      }
    } catch (err) {
      console.warn('[BookingsCalendar] Error loading resources:', err);
    }
  };

  const loadFirstResourceAndLocation = async () => {
    try {
      // Load first resource
      const resourceResponse = await fetch('/api/admin/hapio/resources?per_page=1');
      if (resourceResponse.ok) {
        const resourceData = await resourceResponse.json();
        if (resourceData.data && resourceData.data.length > 0) {
          setResourceId(resourceData.data[0].id);
        }
      }

      // Load first location
      const locationResponse = await fetch('/api/admin/hapio/locations?per_page=1');
      if (locationResponse.ok) {
        const locationData = await locationResponse.json();
        if (locationData.data && locationData.data.length > 0) {
          setLocationId(locationData.data[0].id);
        }
      }
    } catch (err) {
      console.warn('[BookingsCalendar] Error loading resource/location:', err);
    }
  };

  const loadBookings = async () => {
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

      const params = new URLSearchParams();
      params.append('from', from.split('T')[0]);
      params.append('to', to.split('T')[0]);
      if (resourceId) params.append('resource_id', resourceId);
      if (locationId) params.append('location_id', locationId);
      params.append('per_page', '100'); // Hapio API limit is 100

      const response = await fetch(`/api/admin/hapio/bookings?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load bookings');
      }

      const data = await response.json();
      // Filter out canceled bookings for status calculation
      const activeBookings = (data.data || []).filter((b: Booking) => !b.isCanceled);
      setBookings(activeBookings);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async () => {
    if (!resourceId) return;

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
        setAvailability(data.availabilityByDate || {});
      }
    } catch (err) {
      console.warn('[BookingsCalendar] Error loading availability:', err);
    }
  };

  const loadScheduleBlocksForDate = async (date: Date) => {
    if (!resourceId) return;

    try {
      const dateStr = date.toISOString().split('T')[0];
      const fromDate = new Date(date);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(date);
      toDate.setHours(23, 59, 59, 999);

      const from = formatDateForHapioUTC(fromDate);
      const to = formatDateForHapioUTC(toDate);

      const response = await fetch(
        `/api/admin/hapio/resources/${resourceId}/schedule-blocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&per_page=100`
      );

      if (response.ok) {
        const data = await response.json();
        setScheduleBlocks(data.data || []);
      }
    } catch (err) {
      console.warn('[BookingsCalendar] Error loading schedule blocks:', err);
      setScheduleBlocks([]);
    }
  };

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

    // Group by date
    const grouped: Record<string, Booking[]> = {};
    for (const booking of upcoming) {
      const dateStr = new Date(booking.startsAt).toISOString().split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(booking);
    }

    // Sort dates
    const sortedDates = Object.keys(grouped).sort();
    
    return sortedDates.map((dateStr) => ({
      date: new Date(dateStr),
      bookings: grouped[dateStr].sort((a, b) => 
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      ),
      status: calculateDayStatus(new Date(dateStr)),
    }));
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
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  if (loading && bookings.length === 0) {
    return <div className="text-center py-8 text-warm-gray">Loading calendar...</div>;
  }

  const selectedDayBookings = selectedDate ? getBookingsForDate(selectedDate) : [];
  const selectedDayStatus = selectedDate ? calculateDayStatus(selectedDate) : null;
  const selectedDayAvailability = selectedDate ? availability[selectedDate.toISOString().split('T')[0]] || [] : [];

  return (
    <div className="space-y-6">
      {error && <ErrorDisplay error={error} />}

      <div className={`flex gap-6 transition-all duration-300 ${selectedDate ? 'items-start' : 'items-center justify-center'}`}>
        {/* Calendar */}
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
                  onMouseEnter={() => setHoveredDate(date)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  <button
                    onClick={() => setSelectedDate(isSelected ? null : date)}
                    disabled={isPast}
                    className={`aspect-square border rounded-lg text-xs transition-colors w-full ${
                      isPast
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : isSelected
                        ? 'ring-2 ring-dark-sage ring-offset-1'
                        : 'hover:bg-sand/20 cursor-pointer'
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
                    {dateBookings.length > 0 && (
                      <div className="absolute bottom-0.5 left-0 right-0 text-[10px] text-charcoal/70">
                        {dateBookings.length} booking{dateBookings.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </button>

                  {/* Tooltip */}
                  {hoveredDate && hoveredDate.toDateString() === date.toDateString() && !isPast && (
                    <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-64">
                      <div className="bg-white border border-sand rounded-lg shadow-xl overflow-hidden">
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
          <div className="flex-1 bg-white border border-sand rounded-lg p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-charcoal mb-1">{formatDate(selectedDate)}</h3>
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
                              <div className="absolute left-2 top-0 text-xs text-warm-gray font-medium pt-1">
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
                                const customerName = booking.metadata?.customer_name || booking.metadata?.customerName;
                                return customerName ? (
                                  <div className="text-xs opacity-90 mt-0.5">
                                    {String(customerName)}
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
          onClose={() => {
            setShowDetailModal(false);
            setSelectedBooking(null);
          }}
        />
      )}
    </div>
  );
}

