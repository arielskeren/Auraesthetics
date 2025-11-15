'use client';

import { useState, useEffect } from 'react';
import { Eye, Edit, Trash2, Calendar as CalendarIcon, Filter } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import PaginationControls from './PaginationControls';
import BookingDetailModal from './BookingDetailModal';

export default function BookingsManager() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    location_id: '',
    service_id: '',
    resource_id: '',
    status: '',
    page: 1,
    per_page: 20,
  });

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.location_id) params.append('location_id', filters.location_id);
      if (filters.service_id) params.append('service_id', filters.service_id);
      if (filters.resource_id) params.append('resource_id', filters.resource_id);
      if (filters.status) params.append('status', filters.status);
      params.append('page', String(filters.page));
      params.append('per_page', String(filters.per_page));

      const response = await fetch(`/api/admin/hapio/bookings?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load bookings');
      }

      const data = await response.json();
      setBookings(data.data || []);
      setPagination(data.meta ? { ...data.meta, links: data.links } : null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.per_page]);

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleViewBooking = (booking: any) => {
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading && bookings.length === 0) {
    return <LoadingState message="Loading bookings..." />;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-sage-light/30 rounded-lg p-4 border border-sage-light">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-charcoal" />
          <h3 className="font-semibold text-charcoal">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">From Date</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value, page: 1 }))}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">To Date</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value, page: 1 }))}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm"
            >
              <option value="">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>
        <button
          onClick={loadBookings}
          className="mt-4 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
        >
          Apply Filters
        </button>
      </div>

      {error && <ErrorDisplay error={error} />}

      {/* Bookings Table */}
      <div className="bg-white border border-sand rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-sage-light/30 border-b border-sand">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Start Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">End Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-charcoal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-sand/20">
                  <td className="px-4 py-3 text-sm text-charcoal font-mono">{booking.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm text-warm-gray">{formatDate(booking.startsAt)}</td>
                  <td className="px-4 py-3 text-sm text-warm-gray">{formatDate(booking.endsAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        booking.isCanceled
                          ? 'bg-red-100 text-red-700'
                          : booking.isTemporary
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {booking.isCanceled ? 'Canceled' : booking.isTemporary ? 'Temporary' : 'Confirmed'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewBooking(booking)}
                        className="p-1.5 text-dark-sage hover:bg-sage-light rounded transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="px-4 py-4 border-t border-sand">
            <PaginationControls
              meta={pagination}
              onPageChange={handlePageChange}
            />
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

