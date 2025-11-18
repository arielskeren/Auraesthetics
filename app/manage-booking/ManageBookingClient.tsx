'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, User, Mail, Phone, MapPin, X, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import Section from '../_components/Section';
import Button from '../_components/Button';
import { formatInEST } from '@/lib/timezone';

interface Booking {
  id: string;
  hapio_booking_id?: string | null;
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
  created_at?: string;
}

export default function ManageBookingClient() {
  const [searchMode, setSearchMode] = useState<'id' | 'search'>('id');
  const [bookingId, setBookingId] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [searchBookingId, setSearchBookingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
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
        if (!lastName.trim() || !email.trim() || !searchBookingId.trim()) {
          setError('Please fill in all search fields');
          setLoading(false);
          return;
        }
        url += `lastName=${encodeURIComponent(lastName.trim())}&email=${encodeURIComponent(email.trim())}&bookingId=${encodeURIComponent(searchBookingId.trim())}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Booking not found');
        return;
      }

      setBooking(data.booking);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = () => {
    if (!booking || !booking.booking_date) return;
    
    const date = new Date(booking.booking_date);
    setRescheduleDate(date.toISOString().split('T')[0]);
    const timeStr = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    setRescheduleTime(timeStr);
    setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async () => {
    if (!booking || !rescheduleDate || !rescheduleTime) {
      setActionMessage({ type: 'error', text: 'Please select both date and time' });
      return;
    }

    setActionLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/bookings/customer/${booking.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDate: rescheduleDate,
          newTime: rescheduleTime,
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
      timeZone: 'America/New_York',
    });
  };

  const canReschedule = booking && booking.payment_status !== 'cancelled' && booking.hapio_booking_id;
  const canCancel = booking && booking.payment_status !== 'cancelled';

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
                    <div>
                      <label className="block text-sm font-medium text-charcoal mb-2">
                        Booking ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={searchBookingId}
                        onChange={(e) => setSearchBookingId(e.target.value)}
                        placeholder="Enter your booking ID"
                        className="w-full px-4 py-3 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage focus:border-transparent"
                        required
                      />
                    </div>
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
                    booking.payment_status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : booking.payment_status === 'succeeded' || booking.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {booking.payment_status === 'cancelled' ? 'Cancelled' : 'Confirmed'}
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
                  {booking.refunded_cents && booking.refunded_cents > 0 && (
                    <p className="text-sm text-warm-gray mt-2">
                      Refunded: ${(booking.refunded_cents / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {booking.payment_status !== 'cancelled' && (
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
                        onClick={() => setShowRescheduleModal(false)}
                        className="p-1 hover:bg-sand/30 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-charcoal" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          New Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-4 py-3 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">
                          New Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className="w-full px-4 py-3 border border-sage-dark/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
                          required
                        />
                        <p className="mt-2 text-xs text-warm-gray">Time is in EST/EDT</p>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          variant="secondary"
                          onClick={() => setShowRescheduleModal(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant={actionLoading || !rescheduleDate || !rescheduleTime ? 'disabled' : 'primary'}
                          onClick={handleRescheduleSubmit}
                          className="flex-1"
                        >
                          {actionLoading ? 'Rescheduling...' : 'Reschedule'}
                        </Button>
                      </div>
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

