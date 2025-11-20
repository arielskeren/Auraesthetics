'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, User, Mail, Phone, MapPin, X, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import Section from '../_components/Section';
import Button from '../_components/Button';
import { formatInEST, hoursUntilEST, EST_TIMEZONE } from '@/lib/timezone';

interface Booking {
  id: string;
  hapio_booking_id?: string | null;
  service_id?: string | null;
  service_name?: string;
  service_display_name?: string | null;
  service_image_url?: string | null;
  service_duration?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  booking_date?: string | null;
  payment_status?: string;
  payment_amount_cents?: number | null;
  refunded_cents?: number | null;
  cancelled_at?: string | null;
  created_at?: string;
}

type AvailabilitySlot = {
  start: string;
  end: string;
  bufferStart?: string | null;
  bufferEnd?: string | null;
  resources?: Array<{
    id: string;
    name: string;
    enabled: boolean;
    metadata?: any;
  }>;
};

export default function ManageBookingClient() {
  const [searchMode, setSearchMode] = useState<'id' | 'search'>('id');
  const [bookingId, setBookingId] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [serviceSlug, setServiceSlug] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check if booking ID is in URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        setBookingId(id);
        setSearchMode('id');
      }
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setLoading(true);
    setError(null);
    setBooking(null);
    setActionMessage(null);

    try {
      let url = '/api/bookings/customer/lookup?';
      
      if (searchMode === 'id') {
        if (!bookingId.trim()) {
          setError('Please enter a booking ID');
          setLoading(false);
          return;
        }
        url += `id=${encodeURIComponent(bookingId.trim())}`;
      } else {
        if (!lastName.trim() || !email.trim()) {
          setError('Please enter both last name and email address');
          setLoading(false);
          return;
        }
        url += `lastName=${encodeURIComponent(lastName.trim())}&email=${encodeURIComponent(email.trim())}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Booking not found');
        return;
      }

      setBooking(data.booking);
      setError(null);
      
      // Fetch service slug if service_id is available
      if (data.booking?.service_id) {
        try {
          const serviceResponse = await fetch(`/api/services`);
          if (serviceResponse.ok) {
            const services = await serviceResponse.json();
            const service = services.find((s: any) => s.id === data.booking.service_id || s.slug === data.booking.service_id);
            if (service?.slug) {
              setServiceSlug(service.slug);
            }
          }
        } catch (e) {
          console.error('Failed to fetch service slug:', e);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load booking');
    } finally {
      setLoading(false);
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
    if (!booking || !booking.booking_date) return;
    
    const date = new Date(booking.booking_date);
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setRescheduleDate(`${yyyy}-${mm}-${dd}`);
    setRescheduleTime('');
    setAvailabilityStatus('idle');
    setAvailabilitySlots([]);
    setSelectedSlot(null);
    setAvailabilityError(null);
    setShowRescheduleModal(true);
  };

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
        timezone: EST_TIMEZONE,
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

  const handleRescheduleSubmit = async () => {
    if (!booking || !selectedSlot) {
      setActionMessage({ type: 'error', text: 'Please select an available time slot' });
      return;
    }

    setActionLoading(true);
    setActionMessage(null);

    try {
      // Extract date and time from selected slot
      const slotDate = new Date(selectedSlot.start);
      const newDate = slotDate.toISOString().split('T')[0];
      const newTime = slotDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      const response = await fetch(`/api/bookings/customer/${booking.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDate,
          newTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setActionMessage({ type: 'error', text: data.error || 'Failed to reschedule booking' });
        return;
      }

      setActionMessage({ type: 'success', text: 'Booking rescheduled successfully! You will receive a confirmation email.' });
      setShowRescheduleModal(false);
      // Reload booking to show updated date
      setTimeout(() => handleSearch(), 2000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to reschedule booking' });
    } finally {
      setActionLoading(false);
    }
  };

  const formatSlotTime = (slot: AvailabilitySlot) => {
    const date = new Date(slot.start);
    return formatInEST(date, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: EST_TIMEZONE,
    });
  };

  // Group availability slots by day (similar to BookingModal)
  const groupedAvailability = useMemo(() => {
    if (availabilitySlots.length === 0) return [];

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: EST_TIMEZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: EST_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
    });

    const getDateKeyInEST = (date: Date): string => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: EST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const year = parts.find((p) => p.type === 'year')?.value ?? '';
      const month = parts.find((p) => p.type === 'month')?.value ?? '';
      const day = parts.find((p) => p.type === 'day')?.value ?? '';
      return `${year}-${month}-${day}`;
    };

    const groups = new Map<string, { key: string; label: string; slots: AvailabilitySlot[] }>();

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

  const handleCancelSubmit = async () => {
    if (!booking) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/bookings/customer/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        setActionMessage({ type: 'error', text: data.error || 'Failed to cancel booking' });
        return;
      }

      setActionMessage({ type: 'success', text: 'Booking cancelled successfully. You will receive a confirmation email.' });
      setShowCancelModal(false);
      // Reload booking to show updated status
      setTimeout(() => handleSearch(), 2000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to cancel booking' });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return formatInEST(new Date(dateString), {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return formatInEST(new Date(dateString), {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: EST_TIMEZONE,
    });
  };

  // Check if booking is within 72 hours (3 days) in EST context
  const isWithin72Hours = (bookingDate: string | null | undefined): boolean => {
    if (!bookingDate) return false;
    const bookingDateTime = new Date(bookingDate);
    const hoursUntilBooking = hoursUntilEST(bookingDateTime);
    return hoursUntilBooking <= 72;
  };

  const isCancelled = booking?.payment_status === 'cancelled';
  const within72Hours = booking?.booking_date ? isWithin72Hours(booking.booking_date) : false;
  const canReschedule = booking && !isCancelled && !within72Hours && booking.hapio_booking_id;
  const canCancel = booking && !isCancelled && !within72Hours;

  return (
    <div className="min-h-screen bg-ivory">
      <Section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-serif text-charcoal mb-4">
              Manage Your Booking
            </h1>
            <p className="text-lg text-warm-gray max-w-2xl mx-auto">
              Reschedule or cancel your appointment. Enter your booking details below to get started.
            </p>
          </motion.div>

          {/* Search Form */}
          {!booking && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white rounded-lg shadow-lg p-8 mb-8 border border-sage-dark/20"
            >
              {/* Mode Toggle */}
              <div className="flex gap-4 mb-6 border-b border-sage-dark/20 pb-4">
                <button
                  onClick={() => {
                    setSearchMode('id');
                    setError(null);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    searchMode === 'id'
                      ? 'bg-dark-sage text-white'
                      : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                  }`}
                >
                  Booking ID
                </button>
                <button
                  onClick={() => {
                    setSearchMode('search');
                    setError(null);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    searchMode === 'search'
                      ? 'bg-dark-sage text-white'
                      : 'bg-sand/30 text-charcoal hover:bg-sand/50'
                  }`}
                >
                  Search by Details
                </button>
              </div>

              <form onSubmit={handleSearch} className="space-y-6">
                {searchMode === 'id' ? (
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      Booking ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bookingId}
                      onChange={(e) => setBookingId(e.target.value)}
                      placeholder="Enter your booking ID from the confirmation email"
                      className="w-full px-4 py-3 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage focus:border-transparent"
                      required
                    />
                    <p className="mt-2 text-sm text-warm-gray">
                      Find your booking ID in your confirmation email
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-charcoal mb-2">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter your last name"
                        className="w-full px-4 py-3 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-charcoal mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full px-4 py-3 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage focus:border-transparent"
                        required
                      />
                    </div>
                    <p className="text-sm text-warm-gray">
                      We&apos;ll find your most recent booking using your last name and email address.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  variant={loading ? 'disabled' : 'primary'}
                  type="submit"
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    'Find My Booking'
                  )}
                </Button>
              </form>
            </motion.div>
          )}

          {/* Booking Details */}
          {booking && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-lg shadow-lg p-8 border border-sage-dark/20"
            >
              {/* Action Message */}
              {actionMessage && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
                  actionMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {actionMessage.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <p className={`text-sm ${
                    actionMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {actionMessage.text}
                  </p>
                </div>
              )}

              {/* Header with Service Image */}
              <div className="flex items-start gap-6 mb-8 pb-8 border-b border-sage-dark/20">
                {booking.service_image_url ? (
                  <img
                    src={booking.service_image_url}
                    alt={booking.service_display_name || booking.service_name || 'Service'}
                    className="w-24 h-24 object-cover rounded-lg border border-sage-dark/20 flex-shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-dark-sage/20 to-sand/40 rounded-lg border border-sage-dark/20 flex-shrink-0 flex items-center justify-center">
                    <Calendar className="w-12 h-12 text-dark-sage/50" />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-serif text-charcoal mb-2">
                    {booking.service_display_name || booking.service_name || 'Service'}
                  </h2>
                  {booking.service_duration && (
                    <p className="text-warm-gray mb-4">{booking.service_duration}</p>
                  )}
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    isCancelled
                      ? 'bg-red-100 text-red-800'
                      : booking.payment_status === 'succeeded' || booking.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {isCancelled ? 'Cancelled' : 'Confirmed'}
                  </div>
                </div>
              </div>

              {/* Booking Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-dark-sage mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-warm-gray mb-1">Date</p>
                    <p className="font-medium text-charcoal">{formatDate(booking.booking_date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-dark-sage mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-warm-gray mb-1">Time</p>
                    <p className="font-medium text-charcoal">{formatTime(booking.booking_date)} EST</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-dark-sage mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-warm-gray mb-1">Name</p>
                    <p className="font-medium text-charcoal">{booking.client_name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-dark-sage mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-warm-gray mb-1">Email</p>
                    <p className="font-medium text-charcoal break-all">{booking.client_email || 'N/A'}</p>
                  </div>
                </div>
                {booking.client_phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-dark-sage mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-warm-gray mb-1">Phone</p>
                      <p className="font-medium text-charcoal">{booking.client_phone}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-dark-sage mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-warm-gray mb-1">Location</p>
                    <p className="font-medium text-charcoal">2998 Green Palm Court<br />Dania Beach, FL 33312</p>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              {booking.payment_amount_cents && (
                <div className="mb-8 p-4 bg-sage-light/20 rounded-lg border border-sage-dark/20">
                  <p className="text-sm text-warm-gray mb-1">Payment Amount</p>
                  <p className="text-xl font-semibold text-charcoal">
                    ${(booking.payment_amount_cents / 100).toFixed(2)}
                  </p>
                  {booking.refunded_cents != null && booking.refunded_cents > 0 ? (
                    <p className="text-sm text-warm-gray mt-2">
                      Refunded: ${(booking.refunded_cents / 100).toFixed(2)}
                    </p>
                  ) : null}
                </div>
              )}

              {/* Action Buttons */}
              {!isCancelled && (
                <>
                  {within72Hours ? (
                    <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-6">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-yellow-700 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                            Appointment Within 72 Hours
                          </h3>
                          <p className="text-base text-yellow-800 mb-3">
                            This appointment is within 72 hours. To reschedule or cancel, please contact us directly.
                          </p>
                          <p className="text-base text-yellow-800 mb-2">Call or text:</p>
                          <a 
                            href="tel:+14405203337" 
                            className="inline-block text-2xl font-bold text-dark-sage hover:text-sage-dark hover:underline transition-colors"
                          >
                            +1 (440) 520-3337
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-4">
                      {canReschedule && (
                        <Button
                          variant="primary"
                          onClick={handleReschedule}
                          className="flex-1"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reschedule
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          variant="secondary"
                          onClick={() => setShowCancelModal(true)}
                          className="flex-1"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel Booking
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Cancelled Booking Message - Big Red Container */}
              {isCancelled && (
                <div className="bg-red-600 text-white rounded-lg p-6 mb-8">
                  <div className="flex items-start gap-3">
                    <X className="w-6 h-6 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">This appointment has been cancelled</h3>
                      {booking.cancelled_at && (
                        <p className="text-red-100 mb-3">
                          Cancelled on {formatInEST(new Date(booking.cancelled_at), {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: EST_TIMEZONE,
                          })} EST
                        </p>
                      )}
                      <p className="text-red-100 text-sm">
                        If you need to book a new appointment, please visit our booking page.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Back to Search */}
              <button
                onClick={() => {
                  setBooking(null);
                  setError(null);
                  setActionMessage(null);
                }}
                className="mt-6 text-sm text-dark-sage hover:text-sage-dark transition-colors"
              >
                ← Search for another booking
              </button>
            </motion.div>
          )}

          {/* Reschedule Modal */}
          <AnimatePresence>
            {showRescheduleModal && booking && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-lg max-w-md w-full shadow-xl"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-serif text-charcoal">Reschedule Booking</h3>
                      <button
                        onClick={() => {
                          setShowRescheduleModal(false);
                          setAvailabilityStatus('idle');
                          setAvailabilitySlots([]);
                          setSelectedSlot(null);
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
                            Select a date and time to check available slots for rescheduling.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex flex-col">
                              <label className="text-xs text-warm-gray mb-1">Date</label>
                              <select
                                className="h-11 px-3 border border-sand rounded-lg bg-white hover:border-dark-sage focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                                value={rescheduleDate}
                                onChange={(e) => {
                                  setRescheduleDate(e.target.value);
                                  setRescheduleTime('');
                                  setAvailabilityStatus('idle');
                                  setAvailabilitySlots([]);
                                  setSelectedSlot(null);
                                }}
                              >
                                <option value="" disabled>Select date</option>
                                {dateOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col">
                              <label className="text-xs text-warm-gray mb-1">Preferred time</label>
                              <select
                                className="h-11 px-3 border border-sand rounded-lg bg-white hover:border-dark-sage focus:outline-none focus:ring-2 focus:ring-dark-sage text-sm"
                                value={rescheduleTime}
                                onChange={(e) => {
                                  setRescheduleTime(e.target.value);
                                  setAvailabilityStatus('idle');
                                  setAvailabilitySlots([]);
                                  setSelectedSlot(null);
                                }}
                                disabled={!rescheduleDate}
                              >
                                <option value="" disabled>Select time</option>
                                {timeOptions.map((d) => {
                                  const now = new Date();
                                  const isPast =
                                    d.getFullYear() === now.getFullYear() &&
                                    d.getMonth() === now.getMonth() &&
                                    d.getDate() === now.getDate() &&
                                    d.getTime() < now.getTime();
                                  const hh = String(d.getHours()).padStart(2, '0');
                                  const mi = String(d.getMinutes()).padStart(2, '0');
                                  const value = `${hh}:${mi}`;
                                  const label = new Intl.DateTimeFormat(undefined, {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  }).format(d);
                                  return (
                                    <option key={value + d.toISOString()} value={value} disabled={isPast}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="flex flex-col">
                              <label className="text-xs text-warm-gray mb-1 opacity-0">Find times</label>
                              <Button
                                variant={!rescheduleDate || !rescheduleTime || !serviceSlug ? 'disabled' : 'primary'}
                                onClick={handleCheckAvailability}
                                className="w-full h-11"
                              >
                                Find times
                              </Button>
                            </div>
                          </div>
                        </>
                      )}

                      {availabilityStatus === 'loading' && (
                        <div className="text-center py-8">
                          <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-dark-sage" />
                          <p className="text-sm text-warm-gray">Checking available time slots...</p>
                        </div>
                      )}

                      {availabilityStatus === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-sm text-red-800 mb-3">{availabilityError || 'Failed to load availability'}</p>
                          <Button
                            variant="secondary"
                            onClick={handleCheckAvailability}
                            className="w-full"
                          >
                            Try Again
                          </Button>
                        </div>
                      )}

                      {availabilityStatus === 'success' && (
                        <>
                          {availabilitySlots.length === 0 ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <p className="text-sm text-yellow-800">
                                No available slots found for the selected date. Please try a different date or time.
                              </p>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setAvailabilityStatus('idle');
                                  setAvailabilitySlots([]);
                                  setSelectedSlot(null);
                                }}
                                className="w-full mt-3"
                              >
                                Choose Different Date/Time
                              </Button>
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
                                              timeZone: EST_TIMEZONE,
                                            });
                                            const endLabel = formatInEST(endDate, {
                                              hour: 'numeric',
                                              minute: '2-digit',
                                              hour12: true,
                                              timeZone: EST_TIMEZONE,
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
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setAvailabilityStatus('idle');
                                    setAvailabilitySlots([]);
                                    setSelectedSlot(null);
                                  }}
                                  className="flex-1"
                                >
                                  Back
                                </Button>
                                <Button
                                  variant={actionLoading || !selectedSlot ? 'disabled' : 'primary'}
                                  onClick={handleRescheduleSubmit}
                                  className="flex-1"
                                >
                                  {actionLoading ? 'Rescheduling...' : 'Reschedule'}
                                </Button>
                              </div>
                            </>
                          )}
                        </>
                      )}

                      {availabilityStatus === 'idle' && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setShowRescheduleModal(false);
                            setAvailabilityStatus('idle');
                            setAvailabilitySlots([]);
                            setSelectedSlot(null);
                            setAvailabilityError(null);
                          }}
                          className="w-full"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Cancel Modal */}
          <AnimatePresence>
            {showCancelModal && booking && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-lg max-w-md w-full shadow-xl"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-serif text-charcoal">Cancel Booking</h3>
                      <button
                        onClick={() => setShowCancelModal(false)}
                        className="p-1 hover:bg-sand/30 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-charcoal" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <p className="text-charcoal">
                        Are you sure you want to cancel your booking for{' '}
                        <strong>{formatDate(booking.booking_date)}</strong> at{' '}
                        <strong>{formatTime(booking.booking_date)} EST</strong>?
                      </p>
                      {(booking.payment_status === 'succeeded' || booking.payment_status === 'paid') && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="text-sm text-yellow-800">
                            <strong>Note:</strong> If you&apos;ve already paid, you will receive a full refund.{' '}
                            You&apos;ll receive a confirmation email once the cancellation is processed.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <Button
                          variant="secondary"
                          onClick={() => setShowCancelModal(false)}
                          className="flex-1"
                        >
                          Keep Booking
                        </Button>
                        <Button
                          variant={actionLoading ? 'disabled' : 'primary'}
                          onClick={handleCancelSubmit}
                          className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                          {actionLoading ? 'Cancelling...' : 'Yes, Cancel Booking'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </Section>
    </div>
  );
}

