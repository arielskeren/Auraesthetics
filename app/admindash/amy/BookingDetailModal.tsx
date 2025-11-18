'use client';

import { X, XCircle, DollarSign, History, User, Calendar, Mail, Phone, Clock as ClockIcon, RefreshCw, Loader2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatInEST } from '@/lib/timezone';

interface Booking {
  id: string;
  cal_booking_id?: string | null;
  hapio_booking_id?: string | null;
  outlook_event_id?: string | null;
  outlook_sync_status?: string | null;
  service_name?: string;
  service_display_name?: string | null;
  service_image_url?: string | null;
  service_duration?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  booking_date?: string | null;
  amount?: number | string | null;
  final_amount?: number | string | null;
  deposit_amount?: number | string | null;
  discount_code?: string | null;
  discount_amount?: number | string | null;
  payment_type?: 'full' | 'deposit' | null;
  payment_status?: string;
  payment_intent_id?: string | null;
  payment_amount_cents?: number | null;
  refunded_cents?: number | null;
  refund_id?: string | null;
  refund_reason?: string | null;
  refund_date?: string | null;
  created_at?: string;
  metadata?: any;
  // Hapio booking object fields (for compatibility)
  startsAt?: string;
  endsAt?: string;
  serviceId?: string;
  service?: { id: string; name: string };
  customer?: { name?: string; email?: string; phone?: string };
}

interface ClientHistory {
  id: string;
  service_name: string;
  booking_date: string | null;
  payment_type: string | null;
  payment_status: string;
  final_amount: number | string | null;
  created_at: string;
}

interface BookingDetailModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function BookingDetailModal({ booking, isOpen, onClose, onRefresh }: BookingDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<Booking | null>(booking);
  const [clientHistory, setClientHistory] = useState<ClientHistory[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundType, setRefundType] = useState<'dollar' | 'percent'>('dollar');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [availabilitySlots, setAvailabilitySlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [serviceSlug, setServiceSlug] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  // Extract booking ID helper - prioritize internal ID, then Hapio ID
  const getBookingId = useCallback((b: Booking | null) => {
    if (!b) return null;
    // Try internal ID first (UUID), then Hapio ID, then any id field
    return (b as any).id || (b as any).hapio_booking_id || b.id || null;
  }, []);

  const fetchBookingDetails = useCallback(async () => {
    if (!booking) return;
    
    const currentBookingId = getBookingId(booking);
    if (!currentBookingId) {
      setActionMessage({ type: 'error', text: 'Invalid booking: missing booking ID' });
      return;
    }
    
    try {
      setLoading(true);
      setActionMessage(null);
      
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(currentBookingId)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 404) {
          setActionMessage({ type: 'error', text: 'Booking not found. This booking may have been deleted.' });
          setTimeout(onClose, 2000);
          return;
        }
        const errorMsg = errorData.error || errorData.details || 'Unknown error';
        setActionMessage({ type: 'error', text: `Failed to load booking: ${errorMsg}` });
        return;
      }
      
      const data = await response.json();
      
      // Race condition check
      if (getBookingId(booking) !== currentBookingId) return;
      
      if (data.success && data.booking) {
        setBookingDetails(data.booking as Booking);
        setClientHistory(data.clientHistory || []);
        
        // Fetch service slug for availability checking
        if ((data.booking as any).service_id) {
          try {
            const serviceResponse = await fetch(`/api/services`);
            if (serviceResponse.ok) {
              const services = await serviceResponse.json();
              const service = services.find((s: any) => s.id === (data.booking as any).service_id || s.slug === (data.booking as any).service_id);
              if (service?.slug) {
                setServiceSlug(service.slug);
              }
            }
          } catch (e) {
            console.error('Failed to fetch service slug:', e);
          }
        }
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to load booking details' });
      }
    } catch (error) {
      console.error('[BookingDetailModal] Fetch error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to load booking details';
      setActionMessage({ type: 'error', text: `Failed to load booking: ${errorMsg}` });
    } finally {
      setLoading(false);
    }
  }, [booking, onClose, getBookingId]);

  useEffect(() => {
    if (isOpen && booking) {
      fetchBookingDetails();
    }
  }, [isOpen, booking, fetchBookingDetails]);

  const handleCancel = async () => {
    if (!booking) return;
    const effective = bookingDetails || booking;
    const bookingId = getBookingId(effective);
    if (!bookingId) return;
    
    const isPaid = (effective.payment_status === 'paid' || effective.payment_status === 'succeeded') && effective.payment_intent_id;
    const confirmMessage = isPaid
      ? 'Are you sure you want to cancel this booking? This will also process a full refund. This action cannot be undone.'
      : 'Are you sure you want to cancel this booking? This action cannot be undone.';
    
    if (!confirm(confirmMessage)) return;
    
    try {
      setActionLoading('cancel');
      setActionMessage(null);
      
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActionMessage({ 
          type: 'success', 
          text: data.refunded 
            ? 'Booking cancelled and refund processed successfully' 
            : 'Booking cancelled successfully' 
        });
        setTimeout(() => {
          onRefresh();
          onClose();
        }, 1500);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to cancel booking' });
      }
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Failed to cancel booking' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = () => {
    setShowRefundModal(true);
  };

  const handleForceSyncOutlook = async () => {
    if (!booking) return;
    const effective = bookingDetails || booking;
    const bookingId = getBookingId(effective);
    if (!bookingId) return;

    setActionLoading('outlook-sync');
    setActionMessage(null);

    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force-sync-outlook' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setActionMessage({ type: 'error', text: data.error || 'Failed to sync with Outlook' });
        return;
      }

      setActionMessage({ type: 'success', text: data.message || 'Successfully synced with Outlook' });
      // Refresh booking details to show updated sync status
      await fetchBookingDetails();
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Failed to sync with Outlook' });
    } finally {
      setActionLoading(null);
    }
  };

  // Generate date options (next 120 days, excluding Saturdays)
  const dateOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    let currentDate = new Date();
    let daysAdded = 0;
    
    while (options.length < 120 && daysAdded < 200) {
      // Skip Saturdays (day 6)
      if (currentDate.getDay() !== 6) {
        const yyyy = String(currentDate.getFullYear());
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDate.getDate()).padStart(2, '0');
        const value = `${yyyy}-${mm}-${dd}`;
        
        if (!seen.has(value)) {
          seen.add(value);
          const label = new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(currentDate);
          options.push({ value, label });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
      daysAdded++;
    }
    return options;
  }, []);

  // Generate time options (9 AM to 7 PM, 15-minute intervals)
  const timeOptions = useMemo(() => {
    if (!rescheduleDate) return [];
    const start = new Date(`${rescheduleDate}T09:00:00`);
    const end = new Date(`${rescheduleDate}T19:00:00`);
    const result: Date[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      result.push(new Date(cursor));
      cursor.setMinutes(cursor.getMinutes() + 15);
    }
    return result;
  }, [rescheduleDate]);

  const handleReschedule = () => {
    const effective = bookingDetails || booking;
    if (!effective) return;
    // Set calendar month to current booking date or today
    if (effective.booking_date) {
      const date = new Date(effective.booking_date);
      setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      const yyyy = String(date.getFullYear());
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      setRescheduleDate(`${yyyy}-${mm}-${dd}`);
    } else {
      const today = new Date();
      setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
      setRescheduleDate('');
    }
    setRescheduleTime('');
    setAvailabilityStatus('idle');
    setAvailabilitySlots([]);
    setSelectedSlot(null);
    setSelectedCalendarDate(null);
    setAvailabilityError(null);
    setShowRescheduleModal(true);
  };

  // Calendar helper functions
  const getDaysInMonth = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
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
  }, [calendarMonth]);

  const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const isSaturday = (date: Date): boolean => {
    return date.getDay() === 6;
  };

  const handleCalendarDayClick = async (date: Date) => {
    if (isPastDate(date) || isSaturday(date) || !serviceSlug) return;
    
    setSelectedCalendarDate(date);
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    setRescheduleDate(dateStr);
    
    // Fetch availability for the selected day
    setAvailabilityStatus('loading');
    setAvailabilityError(null);
    setSelectedSlot(null);
    
    try {
      // Build a window covering the selected day ± two working days
      const chosen = new Date(date);
      chosen.setHours(12, 0, 0, 0); // Set to noon for consistency
      
      const isWorkingDay = (d: Date) => {
        const day = d.getDay();
        return day !== 6; // Exclude Saturday
      };
      
      const prevWorkingDays: Date[] = [];
      const nextWorkingDays: Date[] = [];
      
      // Walk backwards
      {
        const cursor = new Date(chosen);
        for (let i = 0; i < 10 && prevWorkingDays.length < 2; i++) {
          cursor.setDate(cursor.getDate() - 1);
          if (isWorkingDay(cursor)) {
            prevWorkingDays.push(new Date(cursor));
          }
        }
      }
      // Walk forwards
      {
        const cursor = new Date(chosen);
        for (let i = 0; i < 10 && nextWorkingDays.length < 2; i++) {
          cursor.setDate(cursor.getDate() + 1);
          if (isWorkingDay(cursor)) {
            nextWorkingDays.push(new Date(cursor));
          }
        }
      }
      
      const allDays = [...prevWorkingDays.reverse(), new Date(chosen), ...nextWorkingDays];
      const windowStart = new Date(allDays[0]);
      windowStart.setHours(0, 0, 0, 0);
      const windowEnd = new Date(allDays[allDays.length - 1]);
      windowEnd.setHours(23, 59, 59, 0);
      
      const params = new URLSearchParams({
        slug: serviceSlug,
        from: windowStart.toISOString(),
        to: windowEnd.toISOString(),
        timezone: 'America/New_York',
      });
      
      const response = await fetch(`/api/availability?${params.toString()}`);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? 'Failed to load availability');
      }
      
      const json = await response.json();
      setAvailabilitySlots(json?.availability ?? []);
      setAvailabilityStatus('success');
    } catch (error: any) {
      console.error('Failed to fetch availability', error);
      setAvailabilityError(error.message || 'Failed to load availability');
      setAvailabilityStatus('error');
    }
  };

  const handlePreviousMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleCheckAvailability = async () => {
    if (!rescheduleDate || !rescheduleTime || !serviceSlug) {
      setAvailabilityError('Please select a date and time first');
      return;
    }

    setAvailabilityStatus('loading');
    setAvailabilityError(null);
    setSelectedSlot(null);

    try {
      // Build a window covering the chosen day ± two working days
      const [hour, minute] = rescheduleTime.split(':').map((v) => Number(v));
      const chosen = new Date(`${rescheduleDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);

      const isWorkingDay = (d: Date) => {
        const day = d.getDay();
        return day !== 6; // Exclude Saturday
      };

      const prevWorkingDays: Date[] = [];
      const nextWorkingDays: Date[] = [];

      // Walk backwards
      {
        const cursor = new Date(chosen);
        for (let i = 0; i < 10 && prevWorkingDays.length < 2; i++) {
          cursor.setDate(cursor.getDate() - 1);
          if (isWorkingDay(cursor)) {
            prevWorkingDays.push(new Date(cursor));
          }
        }
      }
      // Walk forwards
      {
        const cursor = new Date(chosen);
        for (let i = 0; i < 10 && nextWorkingDays.length < 2; i++) {
          cursor.setDate(cursor.getDate() + 1);
          if (isWorkingDay(cursor)) {
            nextWorkingDays.push(new Date(cursor));
          }
        }
      }

      const allDays = [...prevWorkingDays.reverse(), new Date(chosen), ...nextWorkingDays];
      const windowStart = new Date(allDays[0]);
      windowStart.setHours(0, 0, 0, 0);
      const windowEnd = new Date(allDays[allDays.length - 1]);
      windowEnd.setHours(23, 59, 59, 0);

      const params = new URLSearchParams({
        slug: serviceSlug,
        from: windowStart.toISOString(),
        to: windowEnd.toISOString(),
        timezone: 'America/New_York',
      });

      const response = await fetch(`/api/availability?${params.toString()}`);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? 'Failed to load availability');
      }

      const json = await response.json();
      setAvailabilitySlots(json?.availability ?? []);
      setAvailabilityStatus('success');
    } catch (error: any) {
      console.error('Failed to fetch availability', error);
      setAvailabilityError(error.message || 'Failed to load availability');
      setAvailabilityStatus('error');
    }
  };

  // Group availability slots by day
  const groupedAvailability = useMemo(() => {
    if (availabilitySlots.length === 0) return [];

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const getDateKeyInEST = (date: Date): string => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const year = parts.find((p) => p.type === 'year')?.value ?? '';
      const month = parts.find((p) => p.type === 'month')?.value ?? '';
      const day = parts.find((p) => p.type === 'day')?.value ?? '';
      return `${year}-${month}-${day}`;
    };

    const groups = new Map<string, { key: string; label: string; slots: any[] }>();

    for (const slot of availabilitySlots) {
      const startDate = new Date(slot.start);
      if (Number.isNaN(startDate.getTime())) continue;

      const dayKey = getDateKeyInEST(startDate);
      const dayLabel = dateFormatter.format(startDate);

      if (!groups.has(dayKey)) {
        groups.set(dayKey, { key: dayKey, label: dayLabel, slots: [] });
      }

      groups.get(dayKey)!.slots.push(slot);
    }

    // Sort slots within each day
    const sortedGroups = Array.from(groups.values()).map((group) => ({
      ...group,
      slots: group.slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    }));

    return sortedGroups.sort((a, b) => a.key.localeCompare(b.key));
  }, [availabilitySlots]);

  const handleRescheduleSubmit = async () => {
    if (!booking) return;
    const effective = bookingDetails || booking;
    const bookingId = getBookingId(effective);
    if (!bookingId) return;

    if (!selectedSlot) {
      setActionMessage({ type: 'error', text: 'Please select an available time slot' });
      return;
    }

    try {
      setActionLoading('reschedule');
      setActionMessage(null);
      setShowRescheduleModal(false);
      
      // Extract date and time from selected slot
      const slotDate = new Date(selectedSlot.start);
      const newDate = slotDate.toISOString().split('T')[0];
      const newTime = slotDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reschedule',
          newDate,
          newTime,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActionMessage({ 
          type: 'success', 
          text: 'Booking rescheduled successfully' 
        });
        setTimeout(() => {
          onRefresh();
          fetchBookingDetails();
        }, 2000);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to reschedule booking' });
      }
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Failed to reschedule booking' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefundSubmit = async () => {
    if (!booking) return;
    const effective = bookingDetails || booking;
    const bookingId = getBookingId(effective);
    if (!bookingId) return;

    // Validate reason is required
    if (!refundReason.trim()) {
      setActionMessage({ type: 'error', text: 'Refund reason is required' });
      return;
    }

    // Validate amount
    const amountValue = parseFloat(refundAmount);
    if (!refundAmount.trim() || isNaN(amountValue) || amountValue <= 0) {
      setActionMessage({ type: 'error', text: 'Please enter a valid refund amount' });
      return;
    }

    // Get payment amount to validate against
    const paymentAmountCents = effective.payment_amount_cents || 0;
    if (paymentAmountCents <= 0) {
      setActionMessage({ type: 'error', text: 'No payment found for this booking' });
      return;
    }
    const paymentAmountDollars = paymentAmountCents / 100;

    let percentage: number | null = null;
    let amountCents: number | null = null;

    if (refundType === 'percent') {
      if (amountValue < 1 || amountValue > 100) {
        setActionMessage({ type: 'error', text: 'Percentage must be between 1 and 100' });
        return;
      }
      percentage = amountValue;
    } else {
      if (amountValue > paymentAmountDollars) {
        setActionMessage({ type: 'error', text: `Refund amount cannot exceed payment amount of $${paymentAmountDollars.toFixed(2)}` });
        return;
      }
      amountCents = Math.round(amountValue * 100);
    }
    
    try {
      setActionLoading('refund');
      setActionMessage(null);
      setShowRefundModal(false);
      
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'refund', 
          percentage, 
          amountCents,
          reason: refundReason.trim()
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        // Show detailed error message from API
        const errorMessage = responseData.details || responseData.error || 'Failed to process refund';
        setActionMessage({ 
          type: 'error', 
          text: `Refund failed: ${errorMessage}${responseData.errorType ? ` (${responseData.errorType})` : ''}` 
        });
        setActionLoading(null);
        return;
      }
      
      if (responseData.success) {
        setActionMessage({ 
          type: 'success', 
          text: `Refund processed successfully. Refund ID: ${responseData.refundId || 'N/A'}` 
        });
        // Reset form
        setRefundAmount('');
        setRefundReason('');
        setRefundType('dollar');
        setTimeout(() => {
          onRefresh();
          fetchBookingDetails();
        }, 2000);
      } else {
        setActionMessage({ type: 'error', text: responseData.error || 'Failed to process refund' });
      }
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Failed to process refund' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    return formatInEST(dateString || null);
  };

  // Format date as MM/DD in EST
  const formatDateShort = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date);
    } catch {
      return 'N/A';
    }
  };

  // Format time in EST
  // IMPORTANT: booking_date is stored in UTC in the database (PostgreSQL timestamps are UTC)
  // When retrieved, it may or may not have timezone info, but we need to treat it as UTC
  const formatTimeEST = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      let date: Date;
      
      // PostgreSQL returns timestamps in ISO format, but may not include 'Z'
      // If it's a string without timezone, PostgreSQL timestamps are always UTC
      if (typeof dateString === 'string') {
        // Check if it already has timezone info
        const hasTimezone = dateString.includes('Z') || 
                           dateString.includes('+') || 
                           (dateString.match(/[+-]\d{2}:\d{2}$/) !== null);
        
        if (!hasTimezone && dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
          // ISO format without timezone - PostgreSQL timestamp, treat as UTC
          date = new Date(dateString + 'Z');
        } else {
          // Has timezone info or is already a Date object, use as-is
          date = new Date(dateString);
        }
      } else {
        date = new Date(dateString);
      }
      
      // Validate the date
      if (Number.isNaN(date.getTime())) {
        return 'N/A';
      }
      
      // Format in EST timezone
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return 'N/A';
    }
  };

  const getPaymentTypeLabel = (type: string | null | undefined) => {
    switch (type) {
      case 'full':
        return 'Full Payment';
      case 'deposit':
        return '50% Deposit';
      default:
        return 'N/A';
    }
  };

  // Payment Type Explanation: 
  // 'full' = customer paid the full service amount upfront
  // 'deposit' = customer paid only a partial amount (typically 50%) as a deposit
  // This is different from payment_status which indicates the payment state (succeeded, cancelled, etc.)

  if (!isOpen || !booking) return null;

  const effective = bookingDetails || booking;

  const finalAmount = Number(effective.final_amount) || Number(effective.amount) || 0;
  const depositAmount =
    Number(effective.deposit_amount) || Number(effective.amount) || (effective.payment_type === 'deposit' ? finalAmount / 2 : finalAmount);
  const balanceDue = Math.max(0, finalAmount - depositAmount);
  const hapioBookingId = effective.hapio_booking_id;
  const hasLegacyCalBooking = !!effective.cal_booking_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-sage-dark/20 px-4 py-2 flex justify-between items-center">
          <h2 className="text-xl font-serif text-charcoal">Booking Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-charcoal" />
          </button>
        </div>

        {/* Action Message */}
        {actionMessage && (
          <div className={`mx-4 mt-2 p-2 rounded text-sm ${
            actionMessage.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-4 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-dark-sage"></div>
            <p className="mt-2 text-sm text-warm-gray">Loading booking details...</p>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <div className="p-4 space-y-3">
            {/* Top Section: Client Info + Quick Actions (left) + Service Details (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Left Column: Client Info + Quick Actions */}
              <div className="space-y-3">
                {/* Client Information - Shortened */}
                <div className="bg-sand/20 rounded-lg p-2.5">
                  <h3 className="text-sm font-semibold text-charcoal mb-1.5 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    Client Information
                  </h3>
                  <div className="space-y-1.5">
                    <div>
                      <label className="text-xs text-warm-gray mb-0.5">Name</label>
                      <p className="font-medium text-charcoal text-sm px-2 py-1 border border-sage-dark/20 rounded bg-white">{effective.client_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-warm-gray mb-0.5 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Email
                      </label>
                      <p className="font-medium text-charcoal text-sm px-2 py-1 border border-sage-dark/20 rounded bg-white break-all">{effective.client_email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-warm-gray mb-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        Phone
                      </label>
                      <p className="font-medium text-charcoal text-sm px-2 py-1 border border-sage-dark/20 rounded bg-white">{effective.client_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions - Below Client Info, Same Width */}
                <div className="bg-sand/20 rounded-lg p-2.5">
                  <h3 className="text-sm font-semibold text-charcoal mb-1.5">Quick Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {effective.payment_status !== 'cancelled' && (
                      <>
                        <button
                          onClick={handleReschedule}
                          disabled={actionLoading !== null || !effective.hapio_booking_id}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <ClockIcon className="w-3.5 h-3.5" />
                          Reschedule
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={actionLoading === 'cancel' || actionLoading === 'refund'}
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {((effective.payment_status === 'paid' || effective.payment_status === 'succeeded') && effective.payment_intent_id && !effective.refunded_cents)
                            ? 'Cancel & Refund' 
                            : 'Cancel Booking'}
                        </button>
                        
                        {/* Only show refund button if paid/succeeded AND not already refunded */}
                        {((effective.payment_status === 'paid' || effective.payment_status === 'succeeded') && effective.payment_intent_id && (effective.refunded_cents == null || effective.refunded_cents === 0)) ? (
                          <button
                            onClick={handleRefund}
                            disabled={actionLoading === 'refund' || actionLoading === 'cancel'}
                            className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Refund Only
                          </button>
                        ) : null}
                      </>
                    )}
                    
                    {effective.payment_status === 'cancelled' && (
                      <div className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded">
                        This booking has been cancelled
                      </div>
                    )}
                    
                    {(effective.payment_status === 'refunded' || (effective.refunded_cents != null && effective.refunded_cents > 0)) && effective.payment_status !== 'cancelled' ? (
                      <div className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded">
                        This booking has been refunded (booking remains active)
                      </div>
                    ) : null}
                    
                    {/* Force Sync to Outlook button */}
                    {process.env.NEXT_PUBLIC_OUTLOOK_SYNC_ENABLED !== 'false' && (
                      <button
                        onClick={handleForceSyncOutlook}
                        disabled={actionLoading === 'outlook-sync'}
                        className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        title="Force sync this booking with Outlook calendar"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'outlook-sync' ? 'animate-spin' : ''}`} />
                        {actionLoading === 'outlook-sync' ? 'Syncing...' : 'Sync Outlook'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Service Details - Right Side, Half Width */}
              <div className="bg-sand/20 rounded-lg p-3">
                <h3 className="text-base font-semibold text-charcoal mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Service Details
                </h3>
                
                {/* Service Photo and Name */}
                <div className="flex items-start gap-3 mb-3">
                  {effective.service_image_url ? (
                    <img 
                      src={effective.service_image_url} 
                      alt={effective.service_display_name || effective.service_name || 'Service'}
                      className="w-16 h-16 object-cover rounded-lg border border-sage-dark/20 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-dark-sage/20 to-sand/40 rounded-lg border border-sage-dark/20 flex-shrink-0 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-dark-sage/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-charcoal text-sm leading-tight mb-1">
                      {effective.service_display_name || effective.service_name || 'N/A'}
                    </p>
                    {effective.service_duration && (
                      <p className="text-xs text-warm-gray">{effective.service_duration}</p>
                    )}
                  </div>
                </div>

                {/* Date and Time (side by side) */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Date</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{formatDateShort(effective.booking_date)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Time (EST)</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{formatTimeEST(effective.booking_date)}</p>
                  </div>
                </div>

                {/* Amount Paid */}
                <div>
                  <label className="text-xs text-warm-gray mb-1">Amount Paid</label>
                  <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">${finalAmount.toFixed(2)}</p>
                </div>

                {/* Payment Type - only show if it's a deposit (partial payment) */}
                {effective.payment_type === 'deposit' && (
                  <div className="mt-2">
                    <label className="text-xs text-warm-gray mb-1">
                      Payment Type
                      <span className="ml-1 text-xs text-warm-gray/70" title="This booking was paid as a partial deposit (typically 50%). The remaining balance may be due at the appointment.">
                        (?)
                      </span>
                    </label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{getPaymentTypeLabel(effective.payment_type)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Other Info (left) + Client History (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Other Information - Left Side */}
              <div className="bg-sand/20 rounded-lg p-3">
                <h3 className="text-base font-semibold text-charcoal mb-2">Other Information</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Status</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{effective.payment_status || 'N/A'}</p>
                  </div>
                  {effective.payment_type === 'deposit' && (
                    <div>
                      <label className="text-xs text-warm-gray mb-1">Deposit Details</label>
                      <p className="text-xs text-charcoal px-2 py-1.5 border border-sage-dark/20 rounded bg-white">
                        Deposit: ${depositAmount.toFixed(2)} • Balance Due: ${balanceDue.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {effective.discount_code && (
                    <div>
                      <label className="text-xs text-warm-gray mb-1">Discount</label>
                      <p className="text-xs text-charcoal px-2 py-1.5 border border-sage-dark/20 rounded bg-white">
                        {effective.discount_code} (-${(Number(effective.discount_amount) || 0).toFixed(2)})
                      </p>
                    </div>
                  )}
                  {/* Refund Information */}
                  {(effective.refunded_cents != null && effective.refunded_cents > 0) ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                      <label className="text-xs font-semibold text-yellow-800 mb-1 block">Refund Information</label>
                      <div className="space-y-1">
                        <p className="text-xs text-yellow-800">
                          <strong>Amount Refunded:</strong> ${((effective.refunded_cents || 0) / 100).toFixed(2)}
                        </p>
                        {effective.refund_date && (
                          <p className="text-xs text-yellow-800">
                            <strong>Date Refunded:</strong> {formatDate(effective.refund_date)}
                          </p>
                        )}
                        {effective.refund_reason && (
                          <p className="text-xs text-yellow-800">
                            <strong>Reason:</strong> {effective.refund_reason}
                          </p>
                        )}
                        {effective.refund_id && (
                          <p className="text-xs text-yellow-800 font-mono break-all">
                            <strong>Refund ID:</strong> {effective.refund_id}
                          </p>
                        )}
                        {effective.payment_amount_cents && effective.refunded_cents < effective.payment_amount_cents && (
                          <p className="text-xs text-yellow-700 italic">
                            Partial refund (${((effective.payment_amount_cents - effective.refunded_cents) / 100).toFixed(2)} remaining)
                          </p>
                        )}
                        {effective.payment_amount_cents && effective.refunded_cents >= effective.payment_amount_cents && (
                          <p className="text-xs text-yellow-700 italic">
                            Full refund
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Hapio Booking ID</label>
                    <p className="font-medium text-charcoal font-mono text-xs px-2 py-1.5 border border-sage-dark/20 rounded bg-white break-all">
                      {hapioBookingId || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Payment Intent ID</label>
                    <p className="font-medium text-charcoal font-mono text-xs px-2 py-1.5 border border-sage-dark/20 rounded bg-white break-all">
                      {effective.payment_intent_id || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Outlook Sync</label>
                    <p className="font-medium text-charcoal text-xs px-2 py-1.5 border border-sage-dark/20 rounded bg-white">
                      {effective.outlook_sync_status || 'Not synced'}
                    </p>
                    {effective.outlook_event_id && (
                      <p className="text-xs text-warm-gray mt-1 font-mono break-all">
                        {effective.outlook_event_id}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Created At</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{formatDate(effective.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Notes</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white whitespace-pre-wrap min-h-[2rem]">
                      {effective.metadata?.notes || effective.metadata?.customer_notes || 'None'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Client History - Right Side */}
              {effective.client_email && (
                <div className="bg-sand/20 rounded-lg p-3">
                  <h3 className="text-base font-semibold text-charcoal mb-2 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Client History (Last 5)
                  </h3>
                  {loading ? (
                    <p className="text-xs text-warm-gray">Loading...</p>
                  ) : clientHistory.length === 0 ? (
                    <p className="text-xs text-warm-gray">No previous bookings found</p>
                  ) : (
                    <div className="space-y-1.5">
                      {clientHistory.map((history) => (
                        <div key={history.id} className="bg-white rounded p-2 border border-sage-dark/20">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-charcoal text-sm">{history.service_name}</p>
                              <p className="text-xs text-warm-gray">{formatDate(history.booking_date)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-charcoal text-sm">${(Number(history.final_amount) || 0).toFixed(2)}</p>
                              <p className="text-xs text-warm-gray">{history.payment_status}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-charcoal">Process Refund</h3>
                <button
                  onClick={() => {
                    setShowRefundModal(false);
                    setRefundAmount('');
                    setRefundReason('');
                    setRefundType('dollar');
                  }}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Refund Type Toggle */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">Refund Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRefundType('dollar')}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        refundType === 'dollar'
                          ? 'bg-dark-sage text-white'
                          : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                      }`}
                    >
                      $
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundType('percent')}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        refundType === 'percent'
                          ? 'bg-dark-sage text-white'
                          : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>

                {/* Refund Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Refund Amount {refundType === 'percent' ? '(%)' : '($)'}
                  </label>
                  <div className="flex items-center gap-2">
                    {refundType === 'dollar' && (
                      <span className="text-charcoal font-medium">$</span>
                    )}
                    <input
                      type="number"
                      step={refundType === 'percent' ? '1' : '0.01'}
                      min="0"
                      max={refundType === 'percent' ? '100' : undefined}
                      value={refundAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Only allow numbers and decimal point
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          setRefundAmount(value);
                        }
                      }}
                      placeholder={refundType === 'percent' ? 'Enter percentage (1-100)' : 'Enter amount'}
                      className="flex-1 px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage focus:border-transparent"
                    />
                    {refundType === 'percent' && (
                      <span className="text-charcoal font-medium">%</span>
                    )}
                  </div>
                  {effective.payment_amount_cents && (
                    <p className="text-xs text-warm-gray mt-1">
                      Payment amount: ${((effective.payment_amount_cents || 0) / 100).toFixed(2)}
                      {refundType === 'percent' && refundAmount && !isNaN(parseFloat(refundAmount)) && (
                        <span className="ml-2">
                          ({parseFloat(refundAmount)}% = ${((parseFloat(refundAmount) / 100) * (effective.payment_amount_cents || 0) / 100).toFixed(2)})
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Refund Reason (Required) */}
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Enter reason for refund (required)"
                    rows={3}
                    className="w-full px-3 py-2 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage focus:border-transparent resize-none"
                    required
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowRefundModal(false);
                      setRefundAmount('');
                      setRefundReason('');
                      setRefundType('dollar');
                    }}
                    className="flex-1 px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRefundSubmit}
                    disabled={actionLoading === 'refund' || !refundAmount.trim() || !refundReason.trim()}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {actionLoading === 'refund' ? 'Processing...' : 'Process Refund'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-charcoal">Reschedule Booking</h3>
                <button
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleDate('');
                    setRescheduleTime('');
                    setAvailabilityStatus('idle');
                    setAvailabilitySlots([]);
                    setSelectedSlot(null);
                    setSelectedCalendarDate(null);
                    setAvailabilityError(null);
                  }}
                  className="p-1 hover:bg-sand/30 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-charcoal" />
                </button>
              </div>

              <div className="space-y-4">
                {availabilityStatus === 'idle' && (
                  <>
                    <p className="text-sm text-warm-gray mb-4">
                      Click on a date in the calendar to view available time slots for rescheduling.
                    </p>
                    
                    {/* Calendar Grid */}
                    <div className="bg-white border border-sand rounded-lg p-4">
                      {/* Calendar Header */}
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={handlePreviousMonth}
                          className="p-1.5 hover:bg-sand/20 rounded-lg transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <h3 className="text-base font-semibold text-charcoal">
                          {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
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
                        {getDaysInMonth.map((date, index) => {
                          if (!date) {
                            return <div key={`empty-${index}`} className="aspect-square" />;
                          }

                          const isPast = isPastDate(date);
                          const isSat = isSaturday(date);
                          const isSelected = selectedCalendarDate && date.toDateString() === selectedCalendarDate.toDateString();
                          const isDisabled = isPast || isSat;

                          return (
                            <button
                              key={date.toISOString()}
                              onClick={() => handleCalendarDayClick(date)}
                              disabled={isDisabled}
                              className={`aspect-square border rounded-lg text-xs transition-colors w-full ${
                                isDisabled
                                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : isSelected
                                  ? 'ring-2 ring-dark-sage ring-offset-1 bg-dark-sage/10 border-dark-sage'
                                  : 'hover:bg-sand/20 cursor-pointer bg-white border-sand'
                              }`}
                            >
                              <div className="text-center font-medium">{date.getDate()}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {availabilityStatus === 'loading' && (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-600" />
                    <p className="text-sm text-warm-gray">Checking available time slots...</p>
                  </div>
                )}

                {availabilityStatus === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800 mb-3">{availabilityError || 'Failed to load availability'}</p>
                    <button
                      onClick={handleCheckAvailability}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {availabilityStatus === 'success' && (
                  <>
                    {availabilitySlots.length === 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                          No available slots found for the selected date. Please try a different date or time.
                        </p>
                        <button
                          onClick={() => {
                            setAvailabilityStatus('idle');
                            setAvailabilitySlots([]);
                            setSelectedSlot(null);
                          }}
                          className="w-full mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium text-sm"
                        >
                          Choose Different Date/Time
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-charcoal mb-2">
                            Select Available Time Slot <span className="text-red-500">*</span>
                          </label>
                          {/* Grouped by day grid (similar to BookingModal) */}
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 max-h-96 overflow-y-auto">
                            {groupedAvailability.map((day) => (
                              <div key={day.key} className="border border-dark-sage/40 bg-sand/20 rounded-lg p-3">
                                <div className="text-sm font-semibold text-charcoal mb-2">{day.label}</div>
                                {day.slots.length > 0 ? (
                                  <div className="flex flex-col gap-2">
                                    {day.slots.map((slot) => {
                                      const isSelected = selectedSlot?.start === slot.start && selectedSlot?.end === slot.end;
                                      const startDate = new Date(slot.start);
                                      const endDate = new Date(slot.end);
                                      const startLabel = formatInEST(startDate, {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true,
                                        timeZone: 'America/New_York',
                                      });
                                      const endLabel = formatInEST(endDate, {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true,
                                        timeZone: 'America/New_York',
                                      });
                                      
                                      return (
                                        <button
                                          key={`${slot.start}-${slot.end}`}
                                          type="button"
                                          onClick={() => setSelectedSlot(isSelected ? null : slot)}
                                          className={`w-full text-left px-3 py-2 rounded-md border text-xs font-semibold transition-colors shadow-sm ${
                                            isSelected
                                              ? 'bg-dark-sage text-white border-dark-sage'
                                              : 'bg-white/90 border-dark-sage/30 text-charcoal hover:bg-dark-sage/10 hover:border-dark-sage/60'
                                          }`}
                                        >
                                          {startLabel} – {endLabel}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-xs text-warm-gray italic">No availability</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={() => {
                              setAvailabilityStatus('idle');
                              setAvailabilitySlots([]);
                              setSelectedSlot(null);
                              setSelectedCalendarDate(null);
                            }}
                            className="flex-1 px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors font-medium"
                          >
                            Back to Calendar
                          </button>
                          <button
                            onClick={handleRescheduleSubmit}
                            disabled={actionLoading === 'reschedule' || !selectedSlot}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                          >
                            {actionLoading === 'reschedule' ? 'Rescheduling...' : 'Reschedule'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

