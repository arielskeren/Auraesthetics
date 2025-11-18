'use client';

import { useState, useEffect } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import BookingDetailModal from '../../BookingDetailModal';
import ErrorDisplay from './ErrorDisplay';
import LoadingState from './LoadingState';

interface Booking {
  id: string;
  hapio_booking_id?: string | null;
  service_name?: string;
  client_name?: string | null;
  client_email?: string | null;
  booking_date?: string | null;
  payment_status?: string;
  amount?: number | string | null;
  refunded_cents?: number | null;
  refund_id?: string | null;
  refund_reason?: string | null;
  refund_date?: string | null;
  created_at?: string;
}

export default function CancelledRefundedBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/bookings');
      if (!response.ok) {
        throw new Error('Failed to load bookings');
      }

      const data = await response.json();
      // Filter for cancelled or refunded bookings
      const filtered = (data.bookings || []).filter(
        (b: Booking) => b.payment_status === 'cancelled' || b.payment_status === 'refunded'
      );
      setBookings(filtered);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadge = (status: string | undefined, refundedCents?: number | null) => {
    if (status === 'cancelled') {
      return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">Cancelled</span>;
    }
    if (status === 'refunded' || refundedCents) {
      return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Refunded</span>;
    }
    return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">Unknown</span>;
  };

  if (loading) {
    return <LoadingState message="Loading cancelled and refunded bookings..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-charcoal">
            Cancelled & Refunded Bookings
          </h3>
          <p className="text-sm text-warm-gray mt-1">
            Showing {bookings.length} cancelled or refunded bookings
          </p>
        </div>
        <button
          onClick={loadBookings}
          className="px-4 py-2 bg-sand/30 text-charcoal rounded-lg hover:bg-sand/50 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Service</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Client</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Amount</th>
                {bookings.some((b) => b.refunded_cents) && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Refunded</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-warm-gray">
                    No cancelled or refunded bookings found
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-sand/10">
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {formatDate(booking.booking_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      {booking.service_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      <div>
                        <div>{booking.client_name || 'N/A'}</div>
                        {booking.client_email && (
                          <div className="text-xs text-warm-gray">{booking.client_email}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(booking.payment_status, booking.refunded_cents)}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal">
                      ${typeof booking.amount === 'number' ? booking.amount.toFixed(2) : booking.amount || '0.00'}
                    </td>
                    {bookings.some((b) => b.refunded_cents) && (
                      <td className="px-4 py-3 text-sm text-charcoal">
                        {booking.refunded_cents ? `$${(booking.refunded_cents / 100).toFixed(2)}` : '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowDetailModal(true);
                        }}
                        className="px-3 py-1 bg-dark-sage text-white rounded hover:bg-dark-sage/80 flex items-center gap-1.5 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedBooking(null);
          }}
          onRefresh={loadBookings}
        />
      )}
    </div>
  );
}

