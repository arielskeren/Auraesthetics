'use client';

import { useState, useEffect } from 'react';
import { Loader2, Calendar, DollarSign, User, Mail, Phone, Filter, Search, Eye } from 'lucide-react';
import BookingDetailModal from './BookingDetailModal';

interface Booking {
  id: string;
  cal_booking_id: string | null;
  service_name: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  booking_date: string | null;
  amount: number | string | null;
  deposit_amount: number | string | null;
  final_amount: number | string | null;
  discount_code: string | null;
  discount_amount: number | string | null;
  payment_type: 'full' | 'deposit' | null;
  payment_status: string;
  payment_intent_id: string | null;
  created_at: string;
}

export default function AdminDashboardClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Filters
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('active'); // Default to 'active' (excludes cancelled/refunded)
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [bookings, paymentStatusFilter, paymentTypeFilter, searchQuery]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/bookings');
      
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      
      const data = await response.json();
      setBookings(data.bookings || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load bookings');
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterBookings = () => {
    let filtered = [...bookings];

    // Payment status filter
    if (paymentStatusFilter === 'active') {
      // Show only active bookings (exclude cancelled and refunded)
      filtered = filtered.filter(b => 
        b.payment_status !== 'cancelled' && b.payment_status !== 'refunded'
      );
    } else if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(b => b.payment_status === paymentStatusFilter);
    }

    // Payment type filter
    if (paymentTypeFilter !== 'all') {
      filtered = filtered.filter(b => b.payment_type === paymentTypeFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.client_name?.toLowerCase().includes(query) ||
        b.client_email?.toLowerCase().includes(query) ||
        b.service_name?.toLowerCase().includes(query) ||
        b.cal_booking_id?.toLowerCase().includes(query)
      );
    }

    // Sort by most recent first
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    setFilteredBookings(filtered);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getPaymentTypeLabel = (type: string | null) => {
    switch (type) {
      case 'full':
        return 'Full Payment';
      case 'deposit':
        return '50% Deposit';
      default:
        return 'N/A';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'authorized':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-dark-sage animate-spin mx-auto mb-4" />
          <p className="text-warm-gray">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-serif text-charcoal mb-2">
            Admin Dashboard
          </h1>
          <p className="text-warm-gray">Manage bookings and operations</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-sage-dark/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-warm-gray mb-1">Total Bookings</p>
                <p className="text-2xl font-semibold text-charcoal">{bookings.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-dark-sage" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-sage-dark/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-warm-gray mb-1">Paid</p>
                <p className="text-2xl font-semibold text-charcoal">
                  {bookings.filter(b => b.payment_status === 'paid').length}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-sage-dark/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-warm-gray mb-1">Deposits</p>
                <p className="text-2xl font-semibold text-charcoal">
                  {bookings.filter(b => b.payment_type === 'deposit').length}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-sage-dark/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-warm-gray mb-1">Pending</p>
                <p className="text-2xl font-semibold text-charcoal">
                  {bookings.filter(b => b.payment_status === 'pending').length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-sage-dark/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-warm-gray" />
              <input
                type="text"
                placeholder="Search bookings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
              />
            </div>

            {/* Payment Status Filter */}
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="px-4 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
            >
              <option value="active">Active (Exclude Cancelled/Refunded)</option>
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="authorized">Authorized</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>

            {/* Payment Type Filter */}
            <select
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              className="px-4 py-2 border border-sage-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
            >
              <option value="all">All Payment Types</option>
              <option value="full">Full Payment</option>
              <option value="deposit">Deposit</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Bookings Table */}
        <div className="bg-white rounded-lg shadow-sm border border-sage-dark/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sage-dark/10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Cal.com ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-charcoal uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-dark/10">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-warm-gray">
                      No bookings found
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => (
                    <tr 
                      key={booking.id} 
                      className="hover:bg-sand/20 cursor-pointer"
                      onClick={() => {
                        setSelectedBooking(booking);
                        setShowDetailModal(true);
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-warm-gray mr-2" />
                          <div>
                            <div className="text-sm font-medium text-charcoal">
                              {booking.client_name || 'N/A'}
                            </div>
                            <div className="text-xs text-warm-gray flex items-center mt-1">
                              <Mail className="w-3 h-3 mr-1" />
                              {booking.client_email || 'N/A'}
                            </div>
                            {booking.client_phone && (
                              <div className="text-xs text-warm-gray flex items-center mt-1">
                                <Phone className="w-3 h-3 mr-1" />
                                {booking.client_phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-charcoal">
                        {booking.service_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-charcoal">
                        {formatDate(booking.booking_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-charcoal">
                        {getPaymentTypeLabel(booking.payment_type)}
                      </td>
                      <td className="px-6 py-4 text-sm text-charcoal">
                        <div className="font-medium">
                          ${(
                            Number(booking.final_amount) ||
                            Number(booking.amount) ||
                            0
                          ).toFixed(2)}
                        </div>
                        {booking.payment_type === 'deposit' && (
                          <div className="text-xs text-warm-gray">
                            Deposit: $
                            {(
                              Number(booking.deposit_amount) ||
                              Number(booking.amount) ||
                              0
                            ).toFixed(2)}{' '}
                            • Balance: $
                            {(
                              Math.max(
                                0,
                                (Number(booking.final_amount) ||
                                  Number(booking.amount) ||
                                  0) -
                                  (Number(booking.deposit_amount) ||
                                    Number(booking.amount) ||
                                    0)
                              )
                            ).toFixed(2)}
                          </div>
                        )}
                        {booking.discount_code && (
                          <div className="text-xs text-warm-gray">
                            {booking.discount_code} (-${(Number(booking.discount_amount) || 0).toFixed(2)})
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(booking.payment_status)}`}>
                          {booking.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-warm-gray font-mono">
                        {booking.cal_booking_id || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(booking);
                            setShowDetailModal(true);
                          }}
                          className="px-3 py-1 bg-dark-sage text-white rounded-lg hover:bg-sage-dark text-sm flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-warm-gray">
          Showing {filteredBookings.length} of {bookings.length} bookings
        </div>

        {/* Booking Detail Modal */}
        <BookingDetailModal
          booking={selectedBooking}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedBooking(null);
          }}
          onRefresh={fetchBookings}
        />
      </div>
    </div>
  );
}

